/**
 * requirementExtractor.ts — Deterministic Natural Language Requirement Normalizer
 * Lyka Realty AI CRM
 * 
 * Safely extracts and normalizes structured property & land requirements from natural language / voice transcripts
 * in English, Tamil, and Tanglish. Prevents hallucinations and ensures INR & area unit consistency.
 */

import { StructuredRequirements, convertAreaToSqft } from './propertyMatchingService.js';

/**
 * Normalise Lakhs / Crores / K / Millions into numeric INR
 * e.g. "70 lakhs" -> 7000000, "1.5 cr" -> 15000000, "65L" -> 6500000, "30 lakhs kulla" -> 3000000 (strict)
 */
export function parseInrBudget(text: string): { budget_min: number | null; budget_max: number | null; strict: boolean } {
  if (!text) return { budget_min: null, budget_max: null, strict: false };

  const lower = text.toLowerCase();
  const strict =
    lower.includes('strictly') ||
    lower.includes('not more than') ||
    lower.includes('maximum') ||
    lower.includes('max') ||
    lower.includes('under') ||
    lower.includes('below') ||
    lower.includes('kulla') ||
    lower.includes('kulle') ||
    lower.includes('குள்ள');

  // Match crore / cr: e.g. "1.5 cr", "2 crore", "1.5crore", "₹2 crore"
  const crMatch = lower.match(/(?:under|below|upto|up to|within|around|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/i);
  if (crMatch) {
    const val = parseFloat(crMatch[1]) * 10000000;
    return { budget_min: null, budget_max: Math.round(val), strict };
  }

  // Match lakh / lakhs / L: e.g. "70 lakhs", "65 lakh", "50l", "80 lac", "40 lakh"
  const lakhMatch = lower.match(/(?:under|below|upto|up to|within|around|₹)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]) * 100000;
    return { budget_min: null, budget_max: Math.round(val), strict };
  }

  // Match direct numbers >= 100000 e.g. "₹4000000"
  const numMatch = lower.match(/(?:under|below|upto|up to|₹)\s*(\d{5,9})/i);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    return { budget_min: null, budget_max: val, strict };
  }

  return { budget_min: null, budget_max: null, strict };
}

/**
 * Extracts structured land & property requirements from natural language message and/or lead record
 */
export function extractStructuredRequirements(message: string, existingLead?: any): StructuredRequirements | null {
  if (!message && !existingLead) return null;

  const text = (message || '').toLowerCase();
  const lead = existingLead || {};

  // Check if message is related to property or land inquiry
  const isLandInquiry =
    text.includes('land') ||
    text.includes('plot') ||
    text.includes('plots') ||
    text.includes('site') ||
    text.includes('sites') ||
    text.includes('parcel') ||
    text.includes('cents') ||
    text.includes('cent') ||
    text.includes('acres') ||
    text.includes('acre') ||
    text.includes('grounds') ||
    text.includes('ground') ||
    text.includes('idam') ||
    text.includes('manai') ||
    text.includes('nilam') ||
    text.includes('மனை') ||
    text.includes('நிலம்') ||
    text.includes('இடம்') ||
    text.includes('zoning') ||
    text.includes('cmda') ||
    text.includes('dtcp') ||
    text.includes('road access') ||
    text.includes('veedu katta') ||
    text.includes('build house') ||
    text.includes('building a house');

  const isPropertyInquiry =
    isLandInquiry ||
    text.includes('bhk') ||
    text.includes('flat') ||
    text.includes('apartment') ||
    text.includes('villa') ||
    text.includes('house') ||
    text.includes('penthouse') ||
    text.includes('commercial') ||
    text.includes('budget') ||
    text.includes('lakh') ||
    text.includes('crore') ||
    text.includes('metro') ||
    text.includes('property') ||
    text.includes('buy') ||
    text.includes('rent') ||
    text.includes('looking for') ||
    text.includes('need a') ||
    text.includes('chennai') ||
    text.includes('omr') ||
    text.includes('ecr') ||
    text.includes('anna nagar') ||
    text.includes('tambaram') ||
    text.includes('medavakkam') ||
    !!lead.property_type ||
    !!lead.bedrooms ||
    !!lead.budget;

  if (!isPropertyInquiry) {
    return null;
  }

  // 1. Category & Type extraction
  let listingCategory: 'property' | 'land' | 'any' = 'property';
  let propertyType: string | null = null;
  let landType: string | null = null;
  let intendedUse: string | null = null;

  const mentionsBuilt =
    text.includes('apartment') ||
    text.includes('flat') ||
    text.includes('bhk') ||
    text.includes('villa') ||
    text.includes('penthouse') ||
    text.includes('condo') ||
    text.includes('house');

  if (isLandInquiry && mentionsBuilt) {
    listingCategory = 'any';
  } else if (isLandInquiry) {
    listingCategory = 'land';
  } else {
    listingCategory = 'property';
  }

  if (listingCategory === 'land' || (isLandInquiry && !mentionsBuilt)) {
    propertyType = 'residential_plot';
    landType = 'residential_plot';

    if (text.includes('commercial') || text.includes('business') || text.includes('shop')) {
      intendedUse = 'commercial';
      landType = 'commercial_land';
      propertyType = 'commercial_land';
    } else if (text.includes('agri') || text.includes('agricultural') || text.includes('farm')) {
      intendedUse = 'agricultural';
      landType = 'agricultural_land';
      propertyType = 'agricultural_land';
    } else {
      intendedUse = 'residential';
      landType = 'residential_plot';
      propertyType = 'residential_plot';
    }
  } else {
    if (text.includes('villa') || text.includes('independent house')) {
      propertyType = 'villa';
    } else if (text.includes('apartment') || text.includes('flat') || text.includes('bhk') || text.includes('condo')) {
      propertyType = 'apartment';
    } else if (text.includes('penthouse')) {
      propertyType = 'penthouse';
    } else if (lead.property_type) {
      propertyType = String(lead.property_type).toLowerCase();
    }
  }

  // 2. Bedroom count extraction (for properties)
  let bedrooms: number | null = null;
  const bhkMatch = text.match(/(\d+)\s*(?:bhk|bedroom|bed)/i);
  if (bhkMatch) {
    bedrooms = parseInt(bhkMatch[1], 10);
  } else if (lead.bedrooms) {
    const parsed = parseInt(String(lead.bedrooms).replace(/\D/g, ''), 10);
    if (!isNaN(parsed)) bedrooms = parsed;
  }

  // 3. Location / Locality in Chennai
  let city: string | null = 'Chennai';
  let locality: string | null = null;
  const knownLocalities = [
    'omr', 'ecr', 'anna nagar', 'boat club road', 'boat club', 'velachery', 'guindy',
    'sholinganallur', 'perungudi', 'thoraipakkam', 'kovalam', 'injambakkam', 'adambakkam',
    'porur', 'teynampet', 'alwarpet', 'mylapore', 'nungambakkam', 'besant nagar', 'adyar',
    'kilpauk', 'shenoy nagar', 'medavakkam', 'tambaram', 'pallikaranai', 'siruseri', 'navaluru'
  ];

  for (const loc of knownLocalities) {
    if (text.includes(loc)) {
      locality = loc.toUpperCase() === 'OMR' || loc.toUpperCase() === 'ECR'
        ? loc.toUpperCase()
        : loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  if (!locality && lead.locality) {
    locality = lead.locality;
  } else if (!locality && lead.location) {
    locality = lead.location;
  }

  // 4. Budget extraction
  const budgetInfo = parseInrBudget(text);
  let budgetMax = budgetInfo.budget_max;
  let budgetMin = budgetInfo.budget_min;
  let strictBudget = budgetInfo.strict;

  if (!budgetMax) {
    if (lead.budget_max) {
      budgetMax = lead.budget_max;
      budgetMin = lead.budget_min || null;
      if (lead.strict_budget !== undefined && !budgetInfo.strict) {
        strictBudget = lead.strict_budget;
      }
    } else if (lead.budget) {
      const parsedLeadBudget = parseInrBudget(String(lead.budget));
      budgetMax = parsedLeadBudget.budget_max;
      budgetMin = parsedLeadBudget.budget_min;
    }
  }

  // 5. Area & Unit extraction
  let areaMin: number | null = null;
  let areaUnit: string | null = null;

  // Cents match: e.g. "5 cents", "3.5 cent"
  const centsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cents?|cent|சென்ட்)/i);
  if (centsMatch) {
    areaMin = parseFloat(centsMatch[1]);
    areaUnit = 'cents';
  }

  // Grounds match: e.g. "1 ground", "2 grounds"
  const groundMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:grounds?|ground|கிரவுண்ட்)/i);
  if (!areaMin && groundMatch) {
    areaMin = parseFloat(groundMatch[1]);
    areaUnit = 'grounds';
  }

  // Acres match: e.g. "2 acres", "1 acre"
  const acreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre)/i);
  if (!areaMin && acreMatch) {
    areaMin = parseFloat(acreMatch[1]);
    areaUnit = 'acres';
  }

  // Sqft match: e.g. "2,400 sq. ft.", "2400 sqft", "1200 square feet"
  const sqftMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:sqft|sq\.ft|square\s*feet|sq\s*ft)/i);
  if (!areaMin && sqftMatch) {
    areaMin = parseFloat(sqftMatch[1].replace(/,/g, ''));
    areaUnit = 'sqft';
  }

  // 6. Road access requirement
  const roadAccessRequired =
    text.includes('road access') ||
    text.includes('tar road') ||
    text.includes('blacktop') ||
    text.includes('road connectivity') ||
    text.includes('road access oda') ||
    text.includes('ரோடு');

  let minRoadWidthFt: number | null = null;
  const roadWidthMatch = text.match(/(\d+)\s*(?:ft|feet|adi)\s*(?:road|access|wide)/i);
  if (roadWidthMatch) {
    minRoadWidthFt = parseInt(roadWidthMatch[1], 10);
  }

  // 7. Utilities requirement
  const wantsWater = text.includes('water') || text.includes('borewell') || text.includes('drinking water') || text.includes('தண்ணீர்');
  const wantsPower = text.includes('electricity') || text.includes('eb') || text.includes('power') || text.includes('மின்சாரம்');
  const utilitiesRequired = (wantsWater || wantsPower) ? { water: wantsWater, electricity: wantsPower } : null;

  // 8. Zoning requirement
  let zoningReq: string | null = null;
  if (text.includes('cmda')) zoningReq = 'CMDA Approved';
  else if (text.includes('dtcp')) zoningReq = 'DTCP Approved';

  // 9. Metro proximity
  const nearMetro =
    text.includes('metro') ||
    text.includes('metro station') ||
    text.includes('near metro') ||
    text.includes('metro connectivity') ||
    text.includes('மெட்ரோ');

  // 10. Locality preference
  let localityPref: string | null = null;
  if (text.includes('good locality') || text.includes('prime') || text.includes('peaceful') || text.includes('posh') || text.includes('secure')) {
    localityPref = 'good';
  }

  // 11. Amenities
  const amenities: string[] = [];
  if (text.includes('parking') || text.includes('car park')) amenities.push('Parking');
  if (text.includes('lift') || text.includes('elevator')) amenities.push('Lift');
  if (text.includes('gym')) amenities.push('Gym');
  if (text.includes('pool') || text.includes('swimming')) amenities.push('Swimming Pool');
  if (text.includes('security') || text.includes('gated')) amenities.push('24/7 Security');
  if (text.includes('power backup') || text.includes('generator')) amenities.push('Power Backup');
  if (text.includes('fencing') || text.includes('compound wall')) amenities.push('Compound Wall');

  // Validate that at least one meaningful requirement was found
  if (!propertyType && !bedrooms && !locality && !budgetMax && !nearMetro && !areaMin && !roadAccessRequired && !isLandInquiry) {
    return null;
  }

  return {
    listing_category: listingCategory,
    property_type: propertyType || (listingCategory === 'land' ? 'residential_plot' : 'apartment'),
    land_type: landType,
    intended_use: intendedUse,
    zoning: zoningReq,
    bedrooms: bedrooms,
    location: locality ? `${locality}, Chennai` : 'Chennai',
    locality: locality,
    city: 'Chennai',
    budget_max: budgetMax,
    budget_min: budgetMin,
    area_min: areaMin,
    area_max: areaMin,
    area_unit: areaUnit || (listingCategory === 'land' ? 'cents' : 'sqft'),
    near_metro: nearMetro,
    road_access_required: roadAccessRequired || (minRoadWidthFt !== null),
    min_road_width_ft: minRoadWidthFt,
    utilities_required: utilitiesRequired,
    strict_budget: strictBudget,
    locality_preference: localityPref,
    amenities: amenities.length > 0 ? amenities : null,
  };
}
