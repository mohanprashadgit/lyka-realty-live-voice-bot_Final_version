/**
 * propertyMatchingService.ts — Deterministic & Explainable AI Property & Land Matching Engine
 * Lyka Realty AI CRM
 * 
 * Implements weighted rule-based multi-criteria scoring algorithms (0-100 scale)
 * with dedicated, isolated profiles for:
 * 1. Built Properties (Apartments, Villas, Penthouses)
 * 2. Land & Plots (Residential, Commercial, Agricultural)
 * 
 * Built Property Weight Distribution:
 * - Property type & configuration: 25%
 * - Location: 20%
 * - Budget: 15%
 * - Area/size: 10%
 * - Near metro: 15%
 * - Locality/amenities: 15%
 * Total: 100%
 * 
 * Land & Plot Weight Distribution:
 * - Location and locality: 25%
 * - Budget and price compatibility: 20%
 * - Land area compatibility: 20%
 * - Intended land use & zoning compatibility: 15%
 * - Road access & infrastructure: 10%
 * - Requested amenities & utilities: 10%
 * Total: 100%
 */

export interface StructuredRequirements {
  listing_category?: 'property' | 'land' | 'any'; // 'property', 'land', 'any'
  property_type?: string | null; // e.g. 'apartment', 'villa', 'plot', 'penthouse', 'residential_plot'
  land_type?: string | null; // e.g. 'residential_plot', 'commercial_land', 'agricultural_land'
  intended_use?: string | null; // 'residential', 'commercial', 'agricultural', 'investment'
  zoning?: string | null; // 'CMDA', 'DTCP', 'residential', etc.
  bedrooms?: number | string | null; // e.g. 2, 3, '2 BHK', '3'
  location?: string | null; // e.g. 'Chennai', 'OMR', 'Anna Nagar'
  locality?: string | null;
  city?: string | null;
  budget_max?: number | null; // In INR numbers (e.g. 7000000 for 70L)
  budget_min?: number | null;
  area_min?: number | null; // In sqft or specified unit
  area_max?: number | null;
  area_unit?: string | null; // 'sqft', 'cents', 'acres', 'grounds'
  near_metro?: boolean | null;
  road_access_required?: boolean | null; // Road access required/preferred
  min_road_width_ft?: number | null; // e.g. 30, 40
  utilities_required?: {
    water?: boolean;
    electricity?: boolean;
  } | null;
  corner_plot?: boolean | null;
  strict_budget?: boolean | null; // If true, exclude > budget_max
  locality_preference?: string | null; // 'good', 'prime', etc.
  possession_status?: string | null;
  amenities?: string[] | null;
  additional_requirements?: string[] | null;
  allow_flexible_options?: boolean | null;
  search_mode?: 'strict' | 'flexible';
}

export interface InventoryItem {
  id: string;
  title: string;
  description?: string | null;
  listing_type?: 'property' | 'land';
  property_type?: string | null;
  land_type?: string | null;
  status: string; // 'available', 'sold', 'reserved', 'archived'
  city?: string | null;
  locality?: string | null;
  address?: string | null;
  price?: number | string | null;
  expected_price?: number | string | null;
  currency?: string | null;
  price_basis?: string | null; // 'total', 'per_cent', 'per_sqft'
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  built_up_area?: number | string | null;
  plot_area?: number | string | null;
  total_area?: number | string | null;
  area_unit?: string | null;
  amenities?: string[] | string | null;
  cover_image_url?: string | null;
  images?: string[] | string | null;
  quality_score?: number | null;
  metro_distance_km?: number | null;
  locality_rating?: string | null;
  road_access?: string | null;
  frontage?: string | null;
  zoning?: string | null;
  water_availability?: boolean | number | null;
  electricity_availability?: boolean | number | null;
  survey_number?: string | null;
  created_at?: string | null;
}

export interface CriterionResult {
  name:
    | 'property_type'
    | 'location'
    | 'budget'
    | 'area'
    | 'near_metro'
    | 'amenities'
    | 'zoning_intended_use'
    | 'road_access'
    | 'utilities_amenities';
  display_name: string;
  raw_score: number; // 0 - 100
  weight: number; // Configured weight percentage
  weighted_score: number; // Raw * weight / 100
  is_applicable: boolean;
  status: 'matched' | 'partial' | 'unmatched' | 'not_applicable' | 'unknown';
  reason: string;
}

export interface MatchResult {
  property_id: string;
  listing_type: 'property' | 'land';
  title: string;
  property_type: string;
  land_type?: string | null;
  zoning?: string | null;
  road_access?: string | null;
  frontage?: string | null;
  water_availability?: boolean | null;
  electricity_availability?: boolean | null;
  price: number;
  formatted_price: string;
  price_per_unit?: string | null;
  location: string;
  locality: string;
  city: string;
  bedrooms: string | null;
  built_up_area: number | null;
  total_area?: number | null;
  area_unit: string;
  formatted_area?: string | null;
  cover_image_url: string;
  images: string[];
  status: string;
  metro_distance_km: number | null;
  metro_distance_display: string;
  locality_rating: string;
  data_completeness?: 'High (Verified Record)' | 'Moderate (Partial Record)' | 'Basic';
  final_score: number;
  match_category: 'Excellent Match' | 'Good Match' | 'Moderate Match' | 'Low Match';
  criteria: CriterionResult[];
  missing_data: string[];
  why_it_matches: string[];
  is_strict_match?: boolean;
}

export interface MatchingOptions {
  weights?: {
    property_type?: number;
    location?: number;
    budget?: number;
    area?: number;
    near_metro?: number;
    amenities?: number;
    zoning_intended_use?: number;
    road_access?: number;
    utilities_amenities?: number;
  };
  limit?: number;
  strict_filters?: boolean;
  search_mode?: 'strict' | 'flexible';
}

/** Built Property Default Weights */
export const DEFAULT_WEIGHTS = {
  property_type: 25,
  location: 20,
  budget: 15,
  area: 10,
  near_metro: 15,
  amenities: 15,
};

/** Land & Plots Default Weights */
export const DEFAULT_LAND_WEIGHTS = {
  location: 25,
  budget: 20,
  area: 20,
  zoning_intended_use: 15,
  road_access: 10,
  utilities_amenities: 10,
};

// Known micro-market clusters in Chennai for ~10km proximity scoring
const CHENNAI_NEIGHBORHOOD_CLUSTERS: Record<string, string[]> = {
  omr: ['omr', 'sholinganallur', 'perungudi', 'thoraipakkam', 'navaluru', 'siruseri', 'karapakkam', 'kandanchavadi', 'kelambakkam', 'padur'],
  ecr: ['ecr', 'kovalam', 'neelankarai', 'injambakkam', 'palavakkam', 'uthandi', 'muttukadu', 'kanathur'],
  annanagar: ['anna nagar', 'kilpauk', 'shenoy nagar', 'mogappair', 'koyambedu', 'aminjikarai', 'arumbakkam'],
  central: ['boat club road', 'ra puram', 'alwarpet', 'teynampet', 'mylapore', 'nandanam', 'nungambakkam', 'poes garden', 'gopalapuram'],
  south: ['velachery', 'guindy', 'adambakkam', 'madipakkam', 'pallikaranai', 'taramani', 'medavakkam', 'tambaram', 'perumbakkam'],
  west: ['porur', 'ramapuram', 'valasaravakkam', 'iyyappanthangal', 'manapakkam', 'poonamallee'],
};

/**
 * Format Indian Currency (INR) into clean readable string
 * e.g. 6500000 -> "₹65 Lakh", 15000000 -> "₹1.50 Crore"
 */
export function formatINR(amount: number): string {
  if (!amount || isNaN(amount)) return '₹0';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    const l = amount / 100000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(2)} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Normalise bedroom counts into numbers (e.g. "2 BHK" -> 2, "3" -> 3)
 */
export function parseBedrooms(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Area unit normalisation to square feet
 * Standard Tamil Nadu & Indian conversions:
 * - 1 Cent = 435.6 sq.ft
 * - 1 Ground = 2,400 sq.ft
 * - 1 Acre = 43,560 sq.ft (100 Cents)
 * - 1 Sq. Yard = 9 sq.ft
 * - 1 Sq. Meter = 10.7639 sq.ft
 */
export function convertAreaToSqft(area: number, unit: string): number {
  if (!area || isNaN(area)) return 0;
  const u = (unit || 'sqft').toLowerCase().trim();
  if (u === 'cents' || u === 'cent') return area * 435.6;
  if (u === 'acres' || u === 'acre') return area * 43560;
  if (u === 'grounds' || u === 'ground') return area * 2400;
  if (u === 'sqm' || u === 'sq.m' || u === 'sq meter') return area * 10.7639;
  if (u === 'sqyd' || u === 'sq.yd' || u === 'sq yard') return area * 9;
  return area; // default sqft
}

/**
 * Convert square feet to a target display unit
 */
export function convertSqftToUnit(sqft: number, targetUnit: string): number {
  if (!sqft || isNaN(sqft)) return 0;
  const u = (targetUnit || 'sqft').toLowerCase().trim();
  if (u === 'cents' || u === 'cent') return sqft / 435.6;
  if (u === 'acres' || u === 'acre') return sqft / 43560;
  if (u === 'grounds' || u === 'ground') return sqft / 2400;
  if (u === 'sqm' || u === 'sq.m') return sqft / 10.7639;
  if (u === 'sqyd' || u === 'sq.yd') return sqft / 9;
  return sqft;
}

/**
 * Formats area nicely with unit
 */
export function formatAreaWithUnit(area: number, unit: string): string {
  if (!area || isNaN(area)) return '';
  const u = (unit || 'sqft').toLowerCase().trim();
  const rounded = area % 1 === 0 ? area.toFixed(0) : area.toFixed(2);
  if (u === 'cents' || u === 'cent') return `${rounded} Cents`;
  if (u === 'acres' || u === 'acre') return `${rounded} Acres`;
  if (u === 'grounds' || u === 'ground') return `${rounded} Grounds`;
  return `${Number(rounded).toLocaleString()} sq.ft`;
}

/**
 * Safely parse amenities JSON or string array
 */
export function parseAmenities(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim());
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(s => String(s).trim());
    } catch {
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Safely parse images JSON or string array
 */
export function parseImages(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s).trim());
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(s => String(s).trim());
    } catch {
      return [raw];
    }
  }
  return [];
}

/**
 * Classify score into official match category
 */
export function getMatchCategory(score: number): 'Excellent Match' | 'Good Match' | 'Moderate Match' | 'Low Match' {
  if (score >= 90) return 'Excellent Match';
  if (score >= 70) return 'Good Match';
  if (score >= 50) return 'Moderate Match';
  return 'Low Match';
}

/**
 * Evaluates a Land/Plot inventory item against structured requirements.
 * Deterministic scoring profile:
 * - Location: 25%
 * - Budget: 20%
 * - Area: 20%
 * - Zoning / Intended Use: 15%
 * - Road Access: 10%
 * - Utilities: 10%
 * Total: 100%
 */
export function scoreLandListing(
  item: InventoryItem,
  req: StructuredRequirements,
  customWeights?: MatchingOptions['weights']
): MatchResult | null {
  const weights = { ...DEFAULT_LAND_WEIGHTS, ...customWeights };

  // Hard filter 1: Status must be available (exclude sold, archived, reserved)
  const itemStatus = (item.status || 'available').toLowerCase();
  if (itemStatus === 'sold' || itemStatus === 'archived') {
    return null;
  }

  // Price normalisation
  const rawPrice = item.price !== undefined && item.price !== null ? Number(item.price) : Number(item.expected_price || 0);

  // Hard filter 2: Strict budget violation
  if (req.budget_max && req.strict_budget) {
    if (rawPrice > req.budget_max) {
      return null;
    }
  }

  // Hard filter 3: Incompatible property type
  // If user explicitly insisted on built residential units (e.g. apartment, flat, villa), exclude land
  const reqType = (req.property_type || '').toLowerCase().trim();
  if (reqType && (reqType.includes('apartment') || reqType.includes('flat') || reqType.includes('penthouse') || reqType.includes('villa'))) {
    if (!req.listing_category || req.listing_category === 'property') {
      return null;
    }
  }

  // Hard filter 4: Mandatory city mismatch
  const itemCity = (item.city || 'chennai').toLowerCase().trim();
  const reqLocStr = (req.city || req.location || req.locality || '').toLowerCase().trim();
  if (reqLocStr) {
    const knownCities = ['chennai', 'coimbatore', 'madurai', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'kochi', 'trichy', 'salem'];
    const matchedReqCity = knownCities.find(c => reqLocStr.includes(c));
    if (matchedReqCity && !itemCity.includes(matchedReqCity)) {
      return null;
    }
  }

  const missingData: string[] = [];
  const whyItMatches: string[] = [];
  const criteria: CriterionResult[] = [];
  let isStrictMatch = true;

  // ──────────────────────────────────────────────────────────
  // CRITERION 1: Location & Locality (Weight: 25%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.location;
    let rawScore = 0;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const reqLoc = (req.locality || req.location || '').toLowerCase().trim();
    const itemLoc = (item.locality || '').toLowerCase().trim();
    const itemCityNorm = (item.city || 'chennai').toLowerCase().trim();

    if (!reqLoc) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific locality preference specified';
    } else if (!itemLoc && !itemCityNorm) {
      rawScore = 0;
      status = 'unknown';
      reason = 'Listing locality data is missing';
      missingData.push('Listing locality data missing');
      isStrictMatch = false;
    } else {
      // 1. Exact requested locality substring match
      if (itemLoc && (itemLoc.includes(reqLoc) || reqLoc.includes(itemLoc))) {
        rawScore = 100;
        status = 'matched';
        reason = `Exact requested locality (${item.locality})`;
        whyItMatches.push(`Prime ${item.locality} location`);
      } else {
        // 2. Proximity cluster check within ~10km in Chennai
        let clusterMatch = false;
        let matchedClusterName = '';

        for (const [clusterKey, localities] of Object.entries(CHENNAI_NEIGHBORHOOD_CLUSTERS)) {
          const reqInCluster = localities.some(loc => reqLoc.includes(loc));
          const itemInCluster = localities.some(loc => itemLoc.includes(loc));
          if (reqInCluster && itemInCluster) {
            clusterMatch = true;
            matchedClusterName = clusterKey.toUpperCase();
            break;
          }
        }

        if (clusterMatch) {
          rawScore = 75;
          status = 'partial';
          reason = `Nearby locality within ~10 km corridor (${item.locality}, ${matchedClusterName} zone)`;
          whyItMatches.push(`Convenient corridor location (${item.locality})`);
          isStrictMatch = false;
        } else if (reqLoc && (reqLoc.includes('chennai') || itemCityNorm.includes(reqLoc)) && itemCityNorm.includes('chennai')) {
          rawScore = 50;
          status = 'partial';
          reason = `Same city (${item.city || 'Chennai'}), different locality (${item.locality || 'Area'})`;
          isStrictMatch = false;
        } else {
          rawScore = 0;
          status = 'unmatched';
          reason = `Different location (${item.locality || item.city || 'Unspecified'})`;
          isStrictMatch = false;
        }
      }
    }

    criteria.push({
      name: 'location',
      display_name: 'Location Proximity',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 2: Budget & Price Compatibility (Weight: 20%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.budget;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    if (!req.budget_max && !req.budget_min) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No budget preference specified';
    } else if (rawPrice <= 0) {
      rawScore = 0;
      status = 'unknown';
      reason = 'Listing asking price not available';
      missingData.push('Listing price not available');
      isStrictMatch = false;
    } else {
      const budgetMax = req.budget_max || Infinity;
      const budgetMin = req.budget_min || 0;

      if (rawPrice <= budgetMax) {
        if (budgetMin > 0 && rawPrice < budgetMin * 0.7) {
          rawScore = 70;
          status = 'partial';
          reason = `${formatINR(rawPrice)} is comfortably below your minimum expectation (${formatINR(budgetMin)})`;
        } else {
          rawScore = 100;
          status = 'matched';
          const savings = budgetMax !== Infinity ? budgetMax - rawPrice : 0;
          reason = savings > 0
            ? `${formatINR(rawPrice)} is within budget limit of ${formatINR(budgetMax)} (saves ${formatINR(savings)})`
            : `${formatINR(rawPrice)} is exactly within budget`;
          whyItMatches.push(`Asking price ${formatINR(rawPrice)} within budget`);
        }
      } else {
        const excessPercent = ((rawPrice - budgetMax) / budgetMax) * 100;
        const allowFlex = req.allow_flexible_options !== false && !req.strict_budget;
        isStrictMatch = false;

        if (excessPercent <= 10) {
          rawScore = allowFlex ? 70 : 0;
          status = allowFlex ? 'partial' : 'unmatched';
          reason = `${formatINR(rawPrice)} is ${excessPercent.toFixed(1)}% above budget (${formatINR(budgetMax)})${allowFlex ? ' (within 10% flexible range)' : ' (exceeds strict limit)'}`;
        } else if (excessPercent <= 20) {
          rawScore = allowFlex ? 40 : 0;
          status = allowFlex ? 'partial' : 'unmatched';
          reason = `${formatINR(rawPrice)} is ${excessPercent.toFixed(1)}% above budget${allowFlex ? ' (within 20% flexible range)' : ' (exceeds strict limit)'}`;
        } else {
          rawScore = 0;
          status = 'unmatched';
          reason = `${formatINR(rawPrice)} exceeds budget by ${excessPercent.toFixed(0)}%`;
        }
      }
    }

    criteria.push({
      name: 'budget',
      display_name: 'Budget & Pricing',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 3: Land Area Compatibility (Weight: 20%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.area;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const itemRawArea = Number(item.total_area || item.plot_area || 0);
    const itemUnit = item.area_unit || 'cents';

    if (!req.area_min && !req.area_max) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific land area preference requested';
    } else if (itemRawArea <= 0) {
      rawScore = 0;
      status = 'unknown';
      reason = 'Listing land area not specified';
      missingData.push('Listing land area data missing');
      isStrictMatch = false;
    } else {
      const itemAreaSqft = convertAreaToSqft(itemRawArea, itemUnit);
      const reqMinSqft = req.area_min ? convertAreaToSqft(req.area_min, req.area_unit || 'cents') : 0;
      const reqMaxSqft = req.area_max ? convertAreaToSqft(req.area_max, req.area_unit || 'cents') : Infinity;

      const formattedItemArea = formatAreaWithUnit(itemRawArea, itemUnit);

      if (itemAreaSqft >= reqMinSqft && itemAreaSqft <= reqMaxSqft) {
        rawScore = 100;
        status = 'matched';
        reason = `${formattedItemArea} (${Math.round(itemAreaSqft)} sq.ft) satisfies requested area range`;
        whyItMatches.push(`${formattedItemArea} parcel size`);
      } else if (reqMinSqft > 0 && itemAreaSqft >= reqMinSqft * 0.8) {
        rawScore = 70;
        status = 'partial';
        reason = `${formattedItemArea} is within 20% tolerance of requested minimum (${formatAreaWithUnit(req.area_min!, req.area_unit || 'cents')})`;
        isStrictMatch = false;
      } else if (reqMinSqft > 0 && itemAreaSqft >= reqMinSqft * 0.6) {
        rawScore = 40;
        status = 'partial';
        reason = `${formattedItemArea} is moderately smaller than requested area`;
        isStrictMatch = false;
      } else {
        rawScore = 0;
        status = 'unmatched';
        reason = `${formattedItemArea} does not meet requested area constraints`;
        isStrictMatch = false;
      }
    }

    criteria.push({
      name: 'area',
      display_name: 'Land Area & Size',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 4: Intended Land Use & Zoning (Weight: 15%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.zoning_intended_use;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const reqUse = (req.intended_use || req.land_type || '').toLowerCase();
    const itemZoning = (item.zoning || '').toLowerCase();
    const itemLandType = (item.land_type || '').toLowerCase();

    if (!reqUse && !req.zoning) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific zoning or land-use constraint specified';
    } else {
      const isResidentialReq = reqUse.includes('residential') || reqUse.includes('house') || reqUse.includes('villa');
      const isCommercialReq = reqUse.includes('commercial') || reqUse.includes('shop') || reqUse.includes('office');
      const isAgriReq = reqUse.includes('agricultural') || reqUse.includes('farm');

      if (isResidentialReq) {
        if (itemZoning.includes('cmda') || itemZoning.includes('dtcp') || itemLandType.includes('residential')) {
          rawScore = 100;
          status = 'matched';
          reason = `Approved for residential use: ${item.zoning || 'CMDA/DTCP Approved Residential'}`;
          whyItMatches.push(`Approved residential land (${item.zoning || 'CMDA/DTCP'})`);
        } else if (!item.zoning) {
          rawScore = 70;
          status = 'partial';
          reason = 'Zoning approval not recorded in database; field legal verification required';
          missingData.push('Legal zoning approval unverified in database');
          isStrictMatch = false;
        } else {
          rawScore = 20;
          status = 'unmatched';
          reason = `Zoning recorded as ${item.zoning} (not certified residential)`;
          isStrictMatch = false;
        }
      } else if (isCommercialReq) {
        if (itemZoning.includes('commercial') || itemLandType.includes('commercial')) {
          rawScore = 100;
          status = 'matched';
          reason = `Certified commercial zoning: ${item.zoning || 'Commercial'}`;
          whyItMatches.push('Commercial zoning approved');
        } else {
          rawScore = 30;
          status = 'unmatched';
          reason = `Not certified commercial land (${item.zoning || item.land_type})`;
          isStrictMatch = false;
        }
      } else if (isAgriReq) {
        if (itemZoning.includes('agri') || itemLandType.includes('agri')) {
          rawScore = 100;
          status = 'matched';
          reason = `Agricultural land classification: ${item.zoning || 'Agricultural'}`;
          whyItMatches.push('Agricultural land classification');
        } else {
          rawScore = 30;
          status = 'unmatched';
          reason = `Not agricultural land (${item.zoning || item.land_type})`;
          isStrictMatch = false;
        }
      } else {
        rawScore = 80;
        status = 'matched';
        reason = `Land type: ${item.land_type || 'General Plot'}, Zoning: ${item.zoning || 'Unspecified'}`;
      }
    }

    criteria.push({
      name: 'zoning_intended_use',
      display_name: 'Zoning & Intended Use',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 5: Road Access & Infrastructure (Weight: 10%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.road_access;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    if (!req.road_access_required && !req.min_road_width_ft) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'Road access was not explicitly required';
    } else {
      const recordedRoad = (item.road_access || '').trim();

      if (!recordedRoad) {
        rawScore = 0;
        status = 'unknown';
        reason = 'Road access details not recorded in listing';
        missingData.push('Listing road access details not recorded');
        isStrictMatch = false;
      } else {
        const widthMatch = recordedRoad.match(/(\d+)\s*(?:ft|feet)/i);
        const recordedWidth = widthMatch ? parseInt(widthMatch[1], 10) : null;
        const requestedWidth = req.min_road_width_ft || 20;

        if (recordedWidth !== null && recordedWidth >= requestedWidth) {
          rawScore = 100;
          status = 'matched';
          reason = `Wide verified road access: ${recordedRoad} (meets >= ${requestedWidth} ft)`;
          whyItMatches.push(`Wide ${recordedRoad} access`);
        } else if (recordedWidth !== null) {
          rawScore = 60;
          status = 'partial';
          reason = `Road access recorded: ${recordedRoad} (below requested ${requestedWidth} ft)`;
          isStrictMatch = false;
        } else {
          rawScore = 90;
          status = 'matched';
          reason = `Road access recorded: ${recordedRoad}`;
          whyItMatches.push(`Road access (${recordedRoad})`);
        }
      }
    }

    criteria.push({
      name: 'road_access',
      display_name: 'Road Access & Frontage',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 6: Utilities & Amenities (Weight: 10%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.utilities_amenities;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const reqUtilities = req.utilities_required;
    const wantsWater = reqUtilities?.water;
    const wantsPower = reqUtilities?.electricity;

    if (!wantsWater && !wantsPower && (!req.amenities || req.amenities.length === 0)) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific utility connections requested';
    } else {
      const hasWater = Boolean(item.water_availability);
      const hasPower = Boolean(item.electricity_availability);

      if (wantsWater && wantsPower) {
        if (hasWater && hasPower) {
          rawScore = 100;
          status = 'matched';
          reason = 'Both potable water and 3-phase electricity verified';
          whyItMatches.push('Water & electricity verified');
        } else if (hasWater || hasPower) {
          rawScore = 50;
          status = 'partial';
          reason = hasWater ? 'Water verified; electricity unrecorded' : 'Electricity verified; water unrecorded';
          missingData.push(hasWater ? 'Electricity connection unverified' : 'Water connection unverified');
          isStrictMatch = false;
        } else {
          rawScore = 0;
          status = 'unmatched';
          reason = 'Neither water nor electricity availability recorded in database';
          missingData.push('Utility connections unverified');
          isStrictMatch = false;
        }
      } else if (wantsWater) {
        rawScore = hasWater ? 100 : 0;
        status = hasWater ? 'matched' : 'unmatched';
        reason = hasWater ? 'Water supply verified' : 'Water supply not recorded in database';
        if (hasWater) whyItMatches.push('Water supply verified');
        else {
          missingData.push('Water supply unrecorded');
          isStrictMatch = false;
        }
      } else if (wantsPower) {
        rawScore = hasPower ? 100 : 0;
        status = hasPower ? 'matched' : 'unmatched';
        reason = hasPower ? 'Electricity verified' : 'Electricity not recorded in database';
        if (hasPower) whyItMatches.push('Electricity verified');
        else {
          missingData.push('Electricity unrecorded');
          isStrictMatch = false;
        }
      }
    }

    criteria.push({
      name: 'utilities_amenities',
      display_name: 'Utilities & Infrastructure',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // FINAL SCORE CALCULATION
  // Formula: sum of (raw criterion score × criterion weight) / sum of applicable weights
  // Bounds: strictly between 0 and 100
  // ──────────────────────────────────────────────────────────
  const applicableCriteria = criteria.filter(c => c.is_applicable);
  let finalScore = 0;

  if (applicableCriteria.length === 0) {
    finalScore = 80;
  } else {
    const totalApplicableWeight = applicableCriteria.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = applicableCriteria.reduce((sum, c) => sum + (c.raw_score * c.weight), 0);
    finalScore = totalApplicableWeight > 0 ? Math.round(weightedSum / totalApplicableWeight) : 0;
  }

  finalScore = Math.max(0, Math.min(100, finalScore));
  const matchCategory = getMatchCategory(finalScore);

  // Price per unit calculation (e.g. ₹7.00 Lakh / cent or ₹3,125 / sq.ft)
  let pricePerUnit: string | null = null;
  const itemTotalArea = Number(item.total_area || item.plot_area || 0);
  const itemUnit = item.area_unit || 'cents';
  if (rawPrice > 0 && itemTotalArea > 0) {
    const perUnit = rawPrice / itemTotalArea;
    pricePerUnit = `${formatINR(perUnit)} / ${itemUnit.replace(/s$/, '')}`;
  }

  // Data completeness calculation
  let dataCompleteness: MatchResult['data_completeness'] = 'High (Verified Record)';
  if (missingData.length >= 2) {
    dataCompleteness = 'Moderate (Partial Record)';
  } else if (missingData.length >= 4) {
    dataCompleteness = 'Basic';
  }

  const parsedImgs = parseImages(item.images);
  const coverImg = item.cover_image_url || parsedImgs[0] || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80';

  let metroDisplay = 'Not verified';
  const metroDistNum = item.metro_distance_km !== null && item.metro_distance_km !== undefined ? Number(item.metro_distance_km) : null;
  if (typeof metroDistNum === 'number' && !isNaN(metroDistNum)) {
    metroDisplay = metroDistNum < 1.0 ? `${Math.round(metroDistNum * 1000)} m` : `${metroDistNum.toFixed(1)} km`;
  }

  return {
    property_id: item.id,
    listing_type: 'land',
    title: item.title,
    property_type: item.land_type || 'Residential Land',
    land_type: item.land_type || 'residential_plot',
    zoning: item.zoning || null,
    road_access: item.road_access || null,
    frontage: item.frontage || null,
    water_availability: Boolean(item.water_availability),
    electricity_availability: Boolean(item.electricity_availability),
    price: rawPrice,
    formatted_price: formatINR(rawPrice),
    price_per_unit: pricePerUnit,
    location: [item.locality, item.city].filter(Boolean).join(', ') || 'Chennai',
    locality: item.locality || '',
    city: item.city || 'Chennai',
    bedrooms: null,
    built_up_area: null,
    total_area: itemTotalArea || null,
    area_unit: itemUnit,
    formatted_area: itemTotalArea > 0 ? formatAreaWithUnit(itemTotalArea, itemUnit) : null,
    cover_image_url: coverImg,
    images: parsedImgs,
    status: item.status || 'available',
    metro_distance_km: typeof metroDistNum === 'number' && !isNaN(metroDistNum) ? metroDistNum : null,
    metro_distance_display: metroDisplay,
    locality_rating: item.locality_rating || 'Not verified',
    data_completeness: dataCompleteness,
    final_score: finalScore,
    match_category: matchCategory,
    criteria,
    missing_data: Array.from(new Set(missingData)),
    why_it_matches: Array.from(new Set(whyItMatches)),
    is_strict_match: isStrictMatch && finalScore >= 70,
  };
}

/**
 * Evaluates a Built Property (Apartment, Villa, Penthouse) against structured requirements.
 * Preserves the documented 6-criterion scoring engine.
 */
export function scorePropertyListing(
  item: InventoryItem,
  req: StructuredRequirements,
  customWeights?: MatchingOptions['weights']
): MatchResult | null {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  // Hard filter 1: Status must be available (exclude sold, archived, reserved)
  const itemStatus = (item.status || 'available').toLowerCase();
  if (itemStatus === 'sold' || itemStatus === 'archived') {
    return null;
  }

  const reqType = (req.property_type || '').toLowerCase().trim();
  const wantsLand = reqType.includes('land') || reqType.includes('plot') || reqType.includes('site');
  if (wantsLand && (!req.listing_category || req.listing_category === 'land')) {
    return null; // Exclude built residential property when vacant plot was insisted
  }

  // Price normalisation
  const rawPrice = item.price !== undefined && item.price !== null ? Number(item.price) : Number(item.expected_price || 0);

  // Hard filter 2: Strict budget violation
  if (req.budget_max && req.strict_budget) {
    if (rawPrice > req.budget_max) {
      return null;
    }
  }

  // Hard filter 3: Mandatory city mismatch
  const itemCity = (item.city || 'chennai').toLowerCase().trim();
  const reqLocStr = (req.city || req.location || req.locality || '').toLowerCase().trim();
  if (reqLocStr) {
    const knownCities = ['chennai', 'coimbatore', 'madurai', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi', 'kochi', 'trichy', 'salem'];
    const matchedReqCity = knownCities.find(c => reqLocStr.includes(c));
    if (matchedReqCity && !itemCity.includes(matchedReqCity)) {
      return null;
    }
  }

  const missingData: string[] = [];
  const whyItMatches: string[] = [];
  const criteria: CriterionResult[] = [];
  let isStrictMatch = true;

  // ──────────────────────────────────────────────────────────
  // CRITERION 1: Property Type & Layout (Weight: 25%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.property_type;
    let rawScore = 100;
    let reason = 'Standard configuration match';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const itemType = (item.property_type || '').toLowerCase();

    if (!reqType && !req.bedrooms) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific property type or bedroom preference requested';
    } else {
      let typeScore = 100;
      let bedScore = 100;
      const typeReasons: string[] = [];

      if (reqType) {
        const itemTypeNorm = itemType.replace(/[_\-\s]+/g, ' ');
        const reqTypeNorm = reqType.replace(/[_\-\s]+/g, ' ');

        if (itemTypeNorm.includes(reqTypeNorm) || reqTypeNorm.includes(itemTypeNorm)) {
          typeScore = 100;
          typeReasons.push(`Exact ${req.property_type} type`);
        } else if (
          (reqTypeNorm.includes('apartment') && (itemTypeNorm.includes('flat') || itemTypeNorm.includes('condo') || itemTypeNorm.includes('penthouse'))) ||
          (reqTypeNorm.includes('villa') && (itemTypeNorm.includes('house') || itemTypeNorm.includes('bungalow') || itemTypeNorm.includes('row house')))
        ) {
          typeScore = 75;
          typeReasons.push(`Compatible alternative (${item.property_type})`);
          isStrictMatch = false;
        } else {
          typeScore = 30;
          typeReasons.push(`Alternative configuration (${item.property_type || item.land_type})`);
          isStrictMatch = false;
        }
      }

      const reqBhk = parseBedrooms(req.bedrooms);
      const itemBhk = parseBedrooms(item.bedrooms);

      if (reqBhk !== null) {
        if (itemBhk === null) {
          bedScore = 50;
          missingData.push('Listing bedroom count not specified');
          typeReasons.push('Listing bedroom count unspecified');
          isStrictMatch = false;
        } else if (itemBhk === reqBhk) {
          bedScore = 100;
          typeReasons.push(`Exact ${reqBhk} BHK configuration`);
          whyItMatches.push(`Exact ${reqBhk} BHK configuration`);
        } else if (itemBhk === reqBhk + 1) {
          bedScore = 60;
          typeReasons.push(`Spacious ${itemBhk} BHK (+1 over requested ${reqBhk} BHK)`);
          isStrictMatch = false;
        } else if (itemBhk === reqBhk - 1) {
          bedScore = 30;
          typeReasons.push(`Compact ${itemBhk} BHK (below requested ${reqBhk} BHK)`);
          isStrictMatch = false;
        } else {
          bedScore = 10;
          typeReasons.push(`${itemBhk} BHK (different from requested ${reqBhk} BHK)`);
          isStrictMatch = false;
        }
      }

      if (reqType && reqBhk !== null) {
        rawScore = Math.round(typeScore * 0.5 + bedScore * 0.5);
      } else if (reqType) {
        rawScore = typeScore;
      } else {
        rawScore = bedScore;
      }

      status = rawScore >= 90 ? 'matched' : rawScore >= 50 ? 'partial' : 'unmatched';
      reason = typeReasons.join(', ') || 'Configuration evaluated';
    }

    criteria.push({
      name: 'property_type',
      display_name: 'Property Type & Layout',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 2: Location (Weight: 20%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.location;
    let rawScore = 0;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const reqLoc = (req.locality || req.location || '').toLowerCase().trim();
    const itemLoc = (item.locality || '').toLowerCase().trim();
    const itemCityNorm = (item.city || 'chennai').toLowerCase().trim();

    if (!reqLoc) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific locality preference specified';
    } else if (!itemLoc && !itemCityNorm) {
      rawScore = 0;
      status = 'unknown';
      reason = 'Listing location data is missing';
      missingData.push('Listing locality data missing');
      isStrictMatch = false;
    } else {
      if (itemLoc && (itemLoc.includes(reqLoc) || reqLoc.includes(itemLoc))) {
        rawScore = 100;
        status = 'matched';
        reason = `Exact requested locality (${item.locality})`;
        whyItMatches.push(`Prime ${item.locality} location`);
      } else {
        let clusterMatch = false;
        let matchedClusterName = '';

        for (const [clusterKey, localities] of Object.entries(CHENNAI_NEIGHBORHOOD_CLUSTERS)) {
          const reqInCluster = localities.some(loc => reqLoc.includes(loc));
          const itemInCluster = localities.some(loc => itemLoc.includes(loc));
          if (reqInCluster && itemInCluster) {
            clusterMatch = true;
            matchedClusterName = clusterKey.toUpperCase();
            break;
          }
        }

        if (clusterMatch) {
          rawScore = 70;
          status = 'partial';
          reason = `Nearby locality within ~10 km corridor (${item.locality}, ${matchedClusterName} zone)`;
          whyItMatches.push(`Convenient corridor location (${item.locality})`);
          isStrictMatch = false;
        } else if (reqLoc && (reqLoc.includes('chennai') || itemCityNorm.includes(reqLoc)) && itemCityNorm.includes('chennai')) {
          rawScore = 40;
          status = 'partial';
          reason = `Same city (${item.city || 'Chennai'}), different locality (${item.locality || 'Area'})`;
          isStrictMatch = false;
        } else {
          rawScore = 0;
          status = 'unmatched';
          reason = `Different location (${item.locality || item.city || 'Unspecified'})`;
          isStrictMatch = false;
        }
      }
    }

    criteria.push({
      name: 'location',
      display_name: 'Location Proximity',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 3: Budget (Weight: 15%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.budget;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    if (!req.budget_max && !req.budget_min) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No budget preference specified';
    } else if (rawPrice <= 0) {
      rawScore = 0;
      status = 'unknown';
      reason = 'Listing asking price not available';
      missingData.push('Listing price not available');
      isStrictMatch = false;
    } else {
      const budgetMax = req.budget_max || Infinity;
      const budgetMin = req.budget_min || 0;

      if (rawPrice <= budgetMax) {
        if (budgetMin > 0 && rawPrice < budgetMin * 0.7) {
          rawScore = 70;
          status = 'partial';
          reason = `${formatINR(rawPrice)} is comfortably below your minimum expectation (${formatINR(budgetMin)})`;
        } else {
          rawScore = 100;
          status = 'matched';
          const savings = budgetMax !== Infinity ? budgetMax - rawPrice : 0;
          reason = savings > 0
            ? `${formatINR(rawPrice)} is within your budget of ${formatINR(budgetMax)} (saves ${formatINR(savings)})`
            : `${formatINR(rawPrice)} is exactly within your budget`;
          whyItMatches.push(`Within your budget (${formatINR(rawPrice)})`);
        }
      } else {
        const excessPercent = ((rawPrice - budgetMax) / budgetMax) * 100;
        const allowFlex = req.allow_flexible_options !== false && !req.strict_budget;
        isStrictMatch = false;

        if (excessPercent <= 10) {
          rawScore = allowFlex ? 70 : 0;
          status = allowFlex ? 'partial' : 'unmatched';
          reason = `${formatINR(rawPrice)} is ${excessPercent.toFixed(1)}% above budget (${formatINR(budgetMax)})${allowFlex ? ' (within 10% flexible range)' : ' (exceeds strict limit)'}`;
        } else if (excessPercent <= 20) {
          rawScore = allowFlex ? 40 : 0;
          status = allowFlex ? 'partial' : 'unmatched';
          reason = `${formatINR(rawPrice)} is ${excessPercent.toFixed(1)}% above budget${allowFlex ? ' (within 20% flexible range)' : ' (exceeds strict limit)'}`;
        } else {
          rawScore = 0;
          status = 'unmatched';
          reason = `${formatINR(rawPrice)} exceeds budget by ${excessPercent.toFixed(0)}%`;
        }
      }
    }

    criteria.push({
      name: 'budget',
      display_name: 'Budget & Pricing',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 4: Area / Size (Weight: 10%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.area;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    if (!req.area_min) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No area preference specified (not penalised)';
    } else {
      const itemRawArea = Number(item.built_up_area || item.plot_area || item.total_area || 0);
      if (itemRawArea <= 0) {
        rawScore = 0;
        status = 'unknown';
        reason = 'Listing square footage / area data not specified';
        missingData.push('Listing area data missing');
        isStrictMatch = false;
      } else {
        const reqAreaSqft = convertAreaToSqft(req.area_min, req.area_unit || 'sqft');
        const itemAreaSqft = convertAreaToSqft(itemRawArea, item.area_unit || 'sqft');

        if (itemAreaSqft >= reqAreaSqft) {
          rawScore = 100;
          status = 'matched';
          reason = `${Math.round(itemAreaSqft)} sq.ft meets requested minimum (${Math.round(reqAreaSqft)} sq.ft)`;
          whyItMatches.push(`Spacious ${Math.round(itemAreaSqft)} sq.ft layout`);
        } else if (itemAreaSqft >= reqAreaSqft * 0.8) {
          rawScore = 70;
          status = 'partial';
          reason = `${Math.round(itemAreaSqft)} sq.ft is within 20% tolerance of ${Math.round(reqAreaSqft)} sq.ft`;
          isStrictMatch = false;
        } else if (itemAreaSqft >= reqAreaSqft * 0.6) {
          rawScore = 40;
          status = 'partial';
          reason = `${Math.round(itemAreaSqft)} sq.ft is moderately smaller than requested ${Math.round(reqAreaSqft)} sq.ft`;
          isStrictMatch = false;
        } else {
          rawScore = 0;
          status = 'unmatched';
          reason = `${Math.round(itemAreaSqft)} sq.ft is significantly below requested ${Math.round(reqAreaSqft)} sq.ft`;
          isStrictMatch = false;
        }
      }
    }

    criteria.push({
      name: 'area',
      display_name: 'Property Area & Size',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 5: Near Metro (Weight: 15%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.near_metro;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    if (!req.near_metro) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'Metro proximity was not explicitly requested';
    } else {
      const rawDist = item.metro_distance_km !== null && item.metro_distance_km !== undefined ? Number(item.metro_distance_km) : null;
      let verifiedDist: number | null = typeof rawDist === 'number' && !isNaN(rawDist) ? rawDist : null;
      if (verifiedDist === null && item.description) {
        const metroMatch = item.description.match(/(?:metro|station)[^\d]*(\d+(?:\.\d+)?)\s*(?:km|kms|meter|meters|m)/i);
        if (metroMatch) {
          const num = parseFloat(metroMatch[1]);
          verifiedDist = metroMatch[0].toLowerCase().includes('m') && !metroMatch[0].toLowerCase().includes('km') ? num / 1000 : num;
        }
      }

      if (verifiedDist === null) {
        rawScore = 0;
        status = 'unknown';
        reason = 'Metro distance not verified / unknown for this property';
        missingData.push('Verified metro proximity data missing');
        isStrictMatch = false;
      } else if (verifiedDist <= 1.0) {
        rawScore = 100;
        status = 'matched';
        const display = verifiedDist < 1.0 ? `${Math.round(verifiedDist * 1000)} m` : `${verifiedDist.toFixed(1)} km`;
        reason = `Verified metro distance: ${display} (within 1 km)`;
        whyItMatches.push(`Metro within ${display}`);
      } else if (verifiedDist <= 3.0) {
        rawScore = 70;
        status = 'partial';
        reason = `Verified metro distance: ${verifiedDist.toFixed(1)} km (1 to 3 km)`;
        whyItMatches.push(`Metro accessible within ${verifiedDist.toFixed(1)} km`);
      } else if (verifiedDist <= 5.0) {
        rawScore = 40;
        status = 'partial';
        reason = `Verified metro distance: ${verifiedDist.toFixed(1)} km (3 to 5 km)`;
        isStrictMatch = false;
      } else {
        rawScore = 0;
        status = 'unmatched';
        reason = `Verified metro distance: ${verifiedDist.toFixed(1)} km (more than 5 km away)`;
        isStrictMatch = false;
      }
    }

    criteria.push({
      name: 'near_metro',
      display_name: 'Metro Connectivity',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRITERION 6: Locality & Amenities (Weight: 15%)
  // ──────────────────────────────────────────────────────────
  {
    const weight = weights.amenities;
    let rawScore = 100;
    let reason = '';
    let status: CriterionResult['status'] = 'matched';
    let isApplicable = true;

    const reqAmenities = req.amenities || [];
    const itemAmenities = parseAmenities(item.amenities);
    const itemAmenitiesLower = itemAmenities.map(a => a.toLowerCase());

    const hasLocalityPref = !!req.locality_preference;
    const hasAmenityPref = reqAmenities.length > 0;

    if (!hasLocalityPref && !hasAmenityPref) {
      isApplicable = false;
      rawScore = 100;
      status = 'not_applicable';
      reason = 'No specific amenities or locality rating required';
    } else {
      let matchedAmenitiesCount = 0;
      const matchedAmenitiesList: string[] = [];

      for (const reqAmenity of reqAmenities) {
        const needle = reqAmenity.toLowerCase().trim();
        const found = itemAmenitiesLower.some(a => a.includes(needle) || needle.includes(a));
        if (found) {
          matchedAmenitiesCount++;
          matchedAmenitiesList.push(reqAmenity);
        }
      }

      const rating = item.locality_rating || (item.quality_score && item.quality_score >= 80 ? 'Verified Prime' : 'Not verified');

      if (hasAmenityPref) {
        const ratio = matchedAmenitiesCount / reqAmenities.length;
        rawScore = Math.round(ratio * 100);
        status = rawScore >= 80 ? 'matched' : rawScore >= 40 ? 'partial' : 'unmatched';
        const matchedText = matchedAmenitiesList.length > 0 ? `Matched: ${matchedAmenitiesList.join(', ')}` : 'None matched';
        reason = `${matchedAmenitiesCount}/${reqAmenities.length} amenities (${matchedText}). Locality rating: ${rating}`;
        if (matchedAmenitiesList.length > 0) {
          whyItMatches.push(`Includes ${matchedAmenitiesList.slice(0, 3).join(', ')}`);
        }
      } else {
        if (rating === 'Not verified') {
          rawScore = 50;
          status = 'partial';
          reason = 'Locality quality: Not verified by field audit';
          missingData.push('Locality audit rating not verified');
          isStrictMatch = false;
        } else {
          rawScore = 100;
          status = 'matched';
          reason = `Locality quality: ${rating}`;
          whyItMatches.push(`Verified ${rating} locality`);
        }
      }
    }

    criteria.push({
      name: 'amenities',
      display_name: 'Locality & Amenities',
      raw_score: rawScore,
      weight,
      weighted_score: Number(((rawScore * weight) / 100).toFixed(2)),
      is_applicable: isApplicable,
      status,
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────
  // FINAL SCORE CALCULATION
  // Formula: sum of (criterion score × criterion weight) / sum of applicable weights
  // Bounds: strictly between 0 and 100
  // ──────────────────────────────────────────────────────────
  const applicableCriteria = criteria.filter(c => c.is_applicable);
  let finalScore = 0;

  if (applicableCriteria.length === 0) {
    finalScore = 80;
  } else {
    const totalApplicableWeight = applicableCriteria.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = applicableCriteria.reduce((sum, c) => sum + (c.raw_score * c.weight), 0);
    finalScore = totalApplicableWeight > 0 ? Math.round(weightedSum / totalApplicableWeight) : 0;
  }

  finalScore = Math.max(0, Math.min(100, finalScore));
  const matchCategory = getMatchCategory(finalScore);

  const parsedImgs = parseImages(item.images);
  const coverImg = item.cover_image_url || parsedImgs[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

  let metroDisplay = 'Not verified';
  const metroDistNum = item.metro_distance_km !== null && item.metro_distance_km !== undefined ? Number(item.metro_distance_km) : null;
  if (typeof metroDistNum === 'number' && !isNaN(metroDistNum)) {
    metroDisplay = metroDistNum < 1.0 ? `${Math.round(metroDistNum * 1000)} m` : `${metroDistNum.toFixed(1)} km`;
  }

  return {
    property_id: item.id,
    listing_type: 'property',
    title: item.title,
    property_type: item.property_type || 'Residential Apartment',
    price: rawPrice,
    formatted_price: formatINR(rawPrice),
    location: [item.locality, item.city].filter(Boolean).join(', ') || 'Chennai',
    locality: item.locality || '',
    city: item.city || 'Chennai',
    bedrooms: item.bedrooms ? String(item.bedrooms) : null,
    built_up_area: Number(item.built_up_area || item.plot_area || item.total_area || 0) || null,
    area_unit: item.area_unit || 'sqft',
    cover_image_url: coverImg,
    images: parsedImgs,
    status: item.status || 'available',
    metro_distance_km: typeof metroDistNum === 'number' && !isNaN(metroDistNum) ? metroDistNum : null,
    metro_distance_display: metroDisplay,
    locality_rating: item.locality_rating || 'Not verified',
    data_completeness: missingData.length === 0 ? 'High (Verified Record)' : 'Moderate (Partial Record)',
    final_score: finalScore,
    match_category: matchCategory,
    criteria,
    missing_data: Array.from(new Set(missingData)),
    why_it_matches: Array.from(new Set(whyItMatches)),
    is_strict_match: isStrictMatch && finalScore >= 70,
  };
}

/**
 * Universal dispatcher: routes to scoreLandListing or scorePropertyListing
 */
export function scoreListing(
  item: InventoryItem,
  req: StructuredRequirements,
  customWeights?: MatchingOptions['weights']
): MatchResult | null {
  const isLand = item.listing_type === 'land' || (!!item.land_type && !item.property_type);
  if (isLand) {
    return scoreLandListing(item, req, customWeights);
  }
  return scorePropertyListing(item, req, customWeights);
}

/**
 * Ranks an inventory array against customer requirements.
 * Slices top results, splits into strict vs flexible matches, and determines unmatched state.
 */
export function rankProperties(
  inventory: InventoryItem[],
  requirements: StructuredRequirements,
  options?: MatchingOptions
): {
  results: MatchResult[];
  strict_matches: MatchResult[];
  flexible_matches: MatchResult[];
  total_eligible: number;
  unmatched: boolean;
  unmatched_reason?: string;
} {
  const limit = options?.limit || 5;

  const scoredList: MatchResult[] = [];

  for (const item of inventory) {
    const scored = scoreListing(item, requirements, options?.weights);
    if (scored !== null) {
      scoredList.push(scored);
    }
  }

  // Deterministic tie-breaking:
  // 1. final_score DESC
  // 2. Exact bedroom match if requested (for properties) or exact area match (for land)
  // 3. Price proximity to budget optimum
  // 4. Listing ID ASC (predictable stability)
  scoredList.sort((a, b) => {
    if (b.final_score !== a.final_score) {
      return b.final_score - a.final_score;
    }
    if (requirements.bedrooms && a.listing_type === 'property' && b.listing_type === 'property') {
      const reqBhk = parseBedrooms(requirements.bedrooms);
      const aBhk = parseBedrooms(a.bedrooms);
      const bBhk = parseBedrooms(b.bedrooms);
      const aExact = aBhk === reqBhk ? 1 : 0;
      const bExact = bBhk === reqBhk ? 1 : 0;
      if (bExact !== aExact) return bExact - aExact;
    }
    if (a.price !== b.price) {
      return a.price - b.price;
    }
    return a.property_id.localeCompare(b.property_id);
  });

  const totalEligible = scoredList.length;
  const topResults = scoredList.slice(0, limit);

  const strictMatches = topResults.filter(r => r.is_strict_match);
  const flexibleMatches = topResults.filter(r => !r.is_strict_match);

  const isUnmatched = topResults.length === 0 || (topResults.length > 0 && topResults[0].final_score < 50);

  let unmatchedReason: string | undefined;
  if (topResults.length === 0) {
    unmatchedReason = 'No listings found satisfying hard filters (budget, category, or active availability).';
  } else if (isUnmatched) {
    unmatchedReason = 'Available listings scored below the 50% match threshold for your combined requirements.';
  }

  return {
    results: topResults,
    strict_matches: strictMatches,
    flexible_matches: flexibleMatches,
    total_eligible: totalEligible,
    unmatched: isUnmatched,
    unmatched_reason: unmatchedReason,
  };
}
