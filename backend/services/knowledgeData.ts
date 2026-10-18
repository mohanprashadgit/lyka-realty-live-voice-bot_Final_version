/**
 * knowledgeData.ts — Comprehensive Real Estate Knowledge Base for India & Dubai
 * Provides verified listings, regulatory guidelines, FAQs, and comparison metrics.
 */

export interface PropertyListing {
  id: string;
  title: string;
  jurisdiction: 'India' | 'Dubai';
  city: string;
  locality: string;
  property_type: 'apartment' | 'villa' | 'plot' | 'commercial' | 'penthouse';
  price: number;
  currency: 'INR' | 'AED';
  formatted_price: string;
  bedrooms?: number;
  bathrooms?: number;
  area_sqft: number;
  formatted_area: string;
  status: 'available' | 'reserved' | 'sold';
  developer?: string;
  rera_id?: string;
  cover_image: string;
  highlights: string[];
  last_verified: string;
  source_reference: string;
}

export interface RegulatoryGuide {
  id: string;
  jurisdiction: 'India' | 'Dubai';
  topic: string;
  title: string;
  summary: string;
  key_points: string[];
  applicable_authority: string;
  official_link: string;
  last_updated: string;
}

export interface MarketComparison {
  dimension: string;
  india: string;
  dubai: string;
  key_takeaway: string;
}

export interface RealEstateFaq {
  id: string;
  jurisdiction: 'India' | 'Dubai' | 'Both';
  category: string;
  question_en: string;
  question_tanglish: string;
  answer_en: string;
  answer_tanglish: string;
  source_reference: string;
}

export const VERIFIED_LISTINGS: PropertyListing[] = [
  // ── Dubai Properties ──
  {
    id: 'dxb-001',
    title: 'Marina Gate Luxury Tower Residences',
    jurisdiction: 'Dubai',
    city: 'Dubai',
    locality: 'Dubai Marina',
    property_type: 'apartment',
    price: 1850000,
    currency: 'AED',
    formatted_price: 'AED 1.85 Million',
    bedrooms: 2,
    bathrooms: 2,
    area_sqft: 1240,
    formatted_area: '1,240 sq.ft',
    status: 'available',
    developer: 'Select Group',
    rera_id: 'DLD-PERMIT-48921',
    cover_image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    highlights: ['Freehold Foreign Ownership', 'Direct Marina Walk Access', 'Expected Net Rental Yield: 7.2%', 'High Floor Canal View'],
    last_verified: '2026-10-15',
    source_reference: 'Dubai Land Department (DLD) Registry',
  },
  {
    id: 'dxb-002',
    title: 'Downtown Views II — Burj Khalifa Facing',
    jurisdiction: 'Dubai',
    city: 'Dubai',
    locality: 'Downtown Dubai',
    property_type: 'apartment',
    price: 2450000,
    currency: 'AED',
    formatted_price: 'AED 2.45 Million',
    bedrooms: 2,
    bathrooms: 3,
    area_sqft: 1380,
    formatted_area: '1,380 sq.ft',
    status: 'available',
    developer: 'Emaar Properties',
    rera_id: 'DLD-PERMIT-51042',
    cover_image: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80',
    highlights: ['Golden Visa Eligible (Above AED 2M)', 'Full Burj Khalifa View', '5 Mins Walk to Dubai Mall', '60/40 Post-Handover Payment Plan'],
    last_verified: '2026-10-14',
    source_reference: 'Emaar Approved Agency Inventory',
  },
  {
    id: 'dxb-003',
    title: 'Dubai Hills Estate — Club Villas',
    jurisdiction: 'Dubai',
    city: 'Dubai',
    locality: 'Dubai Hills Estate',
    property_type: 'villa',
    price: 4800000,
    currency: 'AED',
    formatted_price: 'AED 4.80 Million',
    bedrooms: 4,
    bathrooms: 5,
    area_sqft: 3450,
    formatted_area: '3,450 sq.ft',
    status: 'available',
    developer: 'Emaar Properties',
    rera_id: 'DLD-PERMIT-62119',
    cover_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    highlights: ['18-Hole Championship Golf Course', 'Private Garden & Rooftop Terrace', '10-Year UAE Golden Visa Eligible', 'Freehold Community'],
    last_verified: '2026-10-12',
    source_reference: 'DLD Title Registry & Developer Release',
  },
  {
    id: 'dxb-004',
    title: 'Palm Jumeirah Luxury Beachfront Penthouse',
    jurisdiction: 'Dubai',
    city: 'Dubai',
    locality: 'Palm Jumeirah',
    property_type: 'penthouse',
    price: 8900000,
    currency: 'AED',
    formatted_price: 'AED 8.90 Million',
    bedrooms: 4,
    bathrooms: 5,
    area_sqft: 4800,
    formatted_area: '4,800 sq.ft',
    status: 'available',
    developer: 'Nakheel / Omniyat',
    rera_id: 'DLD-PERMIT-73015',
    cover_image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    highlights: ['Private Beach Access', 'Infinity Plunge Pool', 'Full Arabian Gulf Skyline View', 'Ultra-Luxury Finishing'],
    last_verified: '2026-10-16',
    source_reference: 'Nakheel Verified Resale Portfolio',
  },

  // ── India Properties ──
  {
    id: 'ind-001',
    title: 'The Grand Crest — Luxury Sea-Facing Residences',
    jurisdiction: 'India',
    city: 'Chennai',
    locality: 'ECR (East Coast Road)',
    property_type: 'apartment',
    price: 21500000,
    currency: 'INR',
    formatted_price: '₹2.15 Crore',
    bedrooms: 3,
    bathrooms: 3,
    area_sqft: 2100,
    formatted_area: '2,100 sq.ft',
    status: 'available',
    developer: 'Lyka Signature Developments',
    rera_id: 'TN/29/Building/0192/2024',
    cover_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    highlights: ['TN RERA Approved', '100% Clear Title & Nil Encumbrance Certificate', 'Direct Sea View', '15 Mins from Thiruvanmiyur'],
    last_verified: '2026-10-16',
    source_reference: 'TN RERA Public Registry Portal',
  },
  {
    id: 'ind-002',
    title: 'Aura Heights — High-Rise Tech Corridor Living',
    jurisdiction: 'India',
    city: 'Chennai',
    locality: 'OMR (Old Mahabalipuram Road)',
    property_type: 'apartment',
    price: 8500000,
    currency: 'INR',
    formatted_price: '₹85 Lakhs',
    bedrooms: 2,
    bathrooms: 2,
    area_sqft: 1180,
    formatted_area: '1,180 sq.ft',
    status: 'available',
    developer: 'Lyka Realty Projects',
    rera_id: 'TN/29/Building/0341/2023',
    cover_image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    highlights: ['Close to Sholinganallur Junction', 'Upcoming Metro Line Phase 2', 'Ready for Immediate Registration', 'Bank Approved 85% Loan'],
    last_verified: '2026-10-15',
    source_reference: 'TN RERA & Sub-Registrar Office Verification',
  },
  {
    id: 'ind-003',
    title: 'Emerald Palms Gated Villa Enclave',
    jurisdiction: 'India',
    city: 'Chennai',
    locality: 'Anna Nagar West Extension',
    property_type: 'villa',
    price: 36000000,
    currency: 'INR',
    formatted_price: '₹3.60 Crore',
    bedrooms: 4,
    bathrooms: 4,
    area_sqft: 3200,
    formatted_area: '3,200 sq.ft (1.2 Grounds Land)',
    status: 'available',
    developer: 'Prestige & Lyka Partner Group',
    rera_id: 'TN/29/Building/0088/2024',
    cover_image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    highlights: ['CMDA Approved Layout', 'Independent Patta in Buyer Name', 'Private Garden & 2-Car Parking', 'Prestigious Residential Zone'],
    last_verified: '2026-10-11',
    source_reference: 'CMDA Planning Permission & Legal Audit',
  },
  {
    id: 'ind-004',
    title: 'Green Meadows Premium Residential Plots',
    jurisdiction: 'India',
    city: 'Chennai',
    locality: 'Kelambakkam - OMR Corridor',
    property_type: 'plot',
    price: 3800000,
    currency: 'INR',
    formatted_price: '₹38 Lakhs',
    area_sqft: 2178,
    formatted_area: '5 Cents (2,178 sq.ft)',
    status: 'available',
    developer: 'Lyka Land Ventures',
    rera_id: 'TN/29/Layout/0219/2024',
    cover_image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    highlights: ['DTCP & RERA Approved Layout', '30 Feet Blacktop Tar Road', 'Sweet Ground Water at 40 Feet', 'Clear Patta & Legal Title'],
    last_verified: '2026-10-16',
    source_reference: 'DTCP Office Chengalpattu & Taluk Office',
  },
];

export const REGULATORY_GUIDES: RegulatoryGuide[] = [
  {
    id: 'reg-ind-001',
    jurisdiction: 'India',
    topic: 'RERA & Project Verification',
    title: 'Real Estate (Regulation and Development) Act — State Nuances',
    summary: 'RERA mandates that every commercial and residential real estate project where land exceeds 500 sq.m or 8 apartments must be registered with the State RERA.',
    key_points: [
      'Each Indian state has its own regulatory authority (TN RERA for Tamil Nadu, MahaRERA for Maharashtra, K-RERA for Karnataka).',
      'Builders cannot market, advertise, or collect more than 10% advance without an active RERA registration number.',
      '70% of buyer payments must be deposited in a designated escrow bank account to fund only construction and land costs.',
      'Carpet area (usable floor area) is the legal standard for pricing and sale deeds, not super built-up area.',
      'Promoters are liable for structural defect rectifications for 5 years after handover without extra charges.',
    ],
    applicable_authority: 'State RERA Authorities (e.g. TNRERA, MahaRERA, K-RERA)',
    official_link: 'https://rera.tn.gov.in',
    last_updated: '2026-10-01',
  },
  {
    id: 'reg-ind-002',
    jurisdiction: 'India',
    topic: 'Stamp Duty, Registration & Documentation',
    title: 'Property Registration, Stamp Duty & Encumbrance Certificate (EC)',
    summary: 'Property transfer in India requires formal execution of a Sale Deed registered under the Registration Act 1908 at the Sub-Registrar Office.',
    key_points: [
      'Tamil Nadu: Stamp duty is 7% and Registration fee is 4% (Total 11% on Guideline Value or Market Value, whichever is higher). Other states vary (e.g. Maharashtra 5-6%, Karnataka 5%).',
      'Encumbrance Certificate (EC / வில்லங்கச் சான்றிதழ்): Essential 30-year search document from Sub-Registrar showing all registered mortgages, liens, or prior sales.',
      'Revenue Documents: Patta and Chitta establish recorded possession and ownership in government revenue taluk records.',
      'TDS on Property Sale (Section 194-IA): 1% TDS must be deducted by the buyer and paid to the Income Tax Dept if property value exceeds ₹50 Lakhs.',
      'NRI Buyers: Non-Resident Indians can acquire residential/commercial properties freely via inward remittances through normal banking channels (NRE/NRO/FCNR accounts), but cannot purchase agricultural land or farm houses without RBI prior permission.',
    ],
    applicable_authority: 'Inspector General of Registration & Revenue Department',
    official_link: 'https://tnreginet.gov.in',
    last_updated: '2026-09-15',
  },
  {
    id: 'reg-dxb-001',
    jurisdiction: 'Dubai',
    topic: 'Foreign Ownership & Freehold Zones',
    title: 'Dubai Freehold vs Leasehold Foreign Buyer Eligibility',
    summary: 'Law No. 7 of 2006 concerning Real Property Registration in the Emirate of Dubai permits foreign nationals and expatriates to acquire absolute freehold ownership in designated areas.',
    key_points: [
      'Freehold (100% Foreign Ownership): Foreigners can own absolute title in perpetuity in designated investment zones: Dubai Marina, Downtown Dubai, Palm Jumeirah, Business Bay, Dubai Hills, Creek Harbour, JVC, and Emirates Living.',
      'Leasehold: Grants rights to occupy a property for a long duration (typically up to 99 years) in non-freehold areas, where title remains with the primary national landlord.',
      'Registration: All contracts are registered with the Dubai Land Department (DLD). DLD issues the official electronic Title Deed.',
      'Off-plan purchases are registered via "Oqood" (interim registration certificate) until completion and handover.',
      'No property taxes: Dubai levies zero annual property tax and zero capital gains tax on real estate sales.',
    ],
    applicable_authority: 'Dubai Land Department (DLD) & Real Estate Regulatory Agency (RERA)',
    official_link: 'https://dubailand.gov.ae',
    last_updated: '2026-10-10',
  },
  {
    id: 'reg-dxb-002',
    jurisdiction: 'Dubai',
    topic: 'DLD Fees, Escrow Protection & UAE Golden Visa',
    title: 'Transaction Fees, Escrow Safety & 10-Year Golden Visa',
    summary: 'Dubai provides transparent government-mandated transaction charges, strict project escrow account rules under Law No. 8, and long-term residency through property investment.',
    key_points: [
      'DLD Transfer Fee: 4% of property purchase price + AED 4,000 + 5% VAT admin fee, payable to Dubai Land Department at transfer.',
      'Developer Escrow Accounts: Every developer selling off-plan property must maintain an escrow account with an approved bank under RERA oversight. Funds are released strictly in stages linked to independent construction milestone audits.',
      '10-Year UAE Golden Visa: Foreign investors purchasing property worth AED 2,000,000 (AED 2 Million) or more qualify for a renewable 10-year Golden Visa for themselves and immediate family, including off-plan purchases with mortgage options.',
      'Currency Stability: The UAE Dirham (AED) has been pegged to the US Dollar (USD) at a fixed exchange rate of 3.6725 since 1997, protecting foreign investments from domestic currency devaluations.',
      'Ejari System: Mandatory official tenancy registration system ensuring dispute-free landlord-tenant relations and rental index rent cap adherence.',
    ],
    applicable_authority: 'Dubai Land Department & Federal Authority for Identity, Citizenship, Customs and Port Security (ICP)',
    official_link: 'https://dubailand.gov.ae/en/services/golden-visa/',
    last_updated: '2026-10-12',
  },
];

export const MARKET_COMPARISONS: MarketComparison[] = [
  {
    dimension: 'Gross Rental Yields',
    india: '2.5% to 4.0% per annum in top tier-1 metros (Chennai, Bangalore, Mumbai, NCR). Higher for prime commercial (7-9%).',
    dubai: '6.0% to 9.0% per annum across established residential districts (Dubai Marina, JVC, Business Bay, Downtown).',
    key_takeaway: 'Dubai residential properties offer significantly higher rental returns, often exceeding double Indian metro rental yields.',
  },
  {
    dimension: 'Taxation on Property Income & Gains',
    india: 'Rental income taxed at slab rates (with 30% standard deduction). Long-Term Capital Gains (LTCG) taxed at 12.5% without indexation.',
    dubai: '0% personal income tax on rental yields. 0% capital gains tax on property resale. No annual property wealth taxes.',
    key_takeaway: 'Dubai offers 100% tax-free rental yield retention, whereas Indian real estate gains are subject to capital gains and income tax.',
  },
  {
    dimension: 'Transaction & Registration Costs',
    india: 'Approx. 8% to 11% of property value (Stamp duty 5-7% + Registration fee 1-4% + legal fees).',
    dubai: 'Approx. 6% total (4% DLD transfer fee + 2% standard agency commission + admin fee).',
    key_takeaway: 'Upfront transaction charges are substantially lower in Dubai compared to Indian state registration duties.',
  },
  {
    dimension: 'Currency & Exchange Rate Exposure',
    india: 'Priced in Indian Rupee (INR). Exposed to historical INR-to-USD depreciation (~3-4% p.a. long-term trend).',
    dubai: 'Priced in UAE Dirham (AED), officially pegged to USD at 3.6725. Serves as a hard-currency dollar asset.',
    key_takeaway: 'Dubai investment acts as a hedge against INR currency depreciation for NRI and Indian HNIs.',
  },
  {
    dimension: 'Legal Due Diligence & Speed',
    india: 'Requires in-depth 30-year Encumbrance Certificate search, title deed lineage, revenue Patta/Chitta matching, and physical SRO visit.',
    dubai: 'Digitized DLD registry. Instant electronic verification of Title Deeds via DLD REST app or portal; transfers take 24-48 hours.',
    key_takeaway: 'Dubai offers fully digitized instantaneous verification, while India requires comprehensive lawyer due diligence across multiple departments.',
  },
  {
    dimension: 'Financing & Mortgage Basics',
    india: 'Domestic banks provide 75-85% LTV at interest rates between 8.5% and 9.5% p.a. based on CIBIL credit score (750+).',
    dubai: 'UAE banks provide up to 50-60% LTV for non-residents and up to 80% for UAE residents. Attractive off-plan developer payment plans (e.g. 1% per month).',
    key_takeaway: 'India offers higher LTV for domestic buyers; Dubai developers offer flexible developer payment plans with zero interest.',
  },
];

export const REAL_ESTATE_FAQS: RealEstateFaq[] = [
  {
    id: 'faq-001',
    jurisdiction: 'Dubai',
    category: 'Foreign Buyer Eligibility',
    question_en: 'Can Indian citizens and foreign nationals buy property in Dubai?',
    question_tanglish: 'Indian citizens and NRIs Dubai-la direct-ah property vaanga mudiyuma?',
    answer_en: 'Yes, absolutely. Under Dubai Law No. 7 of 2006, foreign nationals (including Indian citizens and NRIs) can purchase 100% freehold properties in designated freehold zones without needing a local partner or sponsor. You receive a registered Title Deed from the Dubai Land Department (DLD).',
    answer_tanglish: 'Kandippa mudiyum nga! Dubai Law No. 7 of 2006 padi, foreign nationals and Indian citizens direct-ah 100% freehold ownership-la property vaangalaam. Local sponsor edhuvum theva illa. Ungalukku Dubai Land Department (DLD) moolama official Title Deed kedaikkum.',
    source_reference: 'Dubai Land Department Regulations Law No. 7 of 2006',
  },
  {
    id: 'faq-002',
    jurisdiction: 'Dubai',
    category: 'Residency & Visa',
    question_en: 'How much property investment is needed to get the UAE 10-year Golden Visa?',
    question_tanglish: 'Dubai Golden Visa kedaikka evvalavu property investment pannanum?',
    answer_en: 'To qualify for the 10-year renewable UAE Golden Visa, the total property purchase value must be at least AED 2,000,000 (AED 2 Million, approx. ₹4.5 Crore). You can combine multiple properties to reach this threshold, and both ready properties and approved off-plan properties qualify.',
    answer_tanglish: 'UAE 10-year Golden Visa-kku unga total property value minimum AED 2 Million (approx ₹4.5 Crore) irukkanum nga. Orey property-ah irukkalam, illa 2-3 properties combine panni AED 2M vandhalum Golden Visa apply pannalaam. Ready property and off-plan rendume eligible dhaan.',
    source_reference: 'Federal Authority for Identity, Citizenship, Customs and Port Security (ICP)',
  },
  {
    id: 'faq-003',
    jurisdiction: 'India',
    category: 'Documentation & Due Diligence',
    question_en: 'What are the essential legal documents to verify before buying property in Tamil Nadu / India?',
    question_tanglish: 'Tamil Nadu-la property vaangum bothu enna legal documents compulsory check pannanum?',
    answer_en: 'The essential documents are: (1) 30-year Encumbrance Certificate (EC / வில்லங்கச் சான்றிதழ்) showing clear title and no unpaid mortgages; (2) Parent documents tracing 30-year ownership lineage; (3) Government Patta and Chitta in the seller name; (4) Approved Layout / Building Plan from CMDA or DTCP; (5) RERA Registration Certificate; and (6) Property Tax receipts.',
    answer_tanglish: 'Important-ah 6 documents verify pannanum nga: (1) Minimum 30 years Encumbrance Certificate (EC - வில்லங்கச் சான்றிதழ்) nil-ah irukka nu paakkanum; (2) 30 years Parent Title Deeds; (3) Seller per-la irukkura Patta and Chitta; (4) CMDA or DTCP approval copy; (5) TN RERA project registration; and (6) Up-to-date Property Tax receipts.',
    source_reference: 'Registration Department TN (tnreginet.gov.in) & Legal Verification Standard',
  },
  {
    id: 'faq-004',
    jurisdiction: 'Both',
    category: 'International Comparison',
    question_en: 'Should I invest in Chennai / India or Dubai for high rental income?',
    question_tanglish: 'Rental income-kku India-la invest panradhu nalladha, illa Dubai better-ah?',
    answer_en: 'If your primary goal is high recurring passive income, Dubai typically offers gross rental yields between 6% and 8.5% with 0% tax deductions. Indian metro residential yields average 2.5% to 3.8% and are taxable. However, India offers familiar local management and strong long-term domestic land appreciation. We recommend evaluating your investment horizon and currency hedging preference.',
    answer_tanglish: 'Unga main goal passive rental income dhaan-na, Dubai rental yield 6% to 8% tax-free-ah irukku nga, whereas India-la residential rental yield around 2.5% to 3.5% dhaan varum. Aana India-la land value appreciation and local accessibility nalla irukkum. Unga budget and time horizon poruthu rendayum compare panni best option choose pannalaam nga.',
    source_reference: 'Lyka Realty Market Analytics (Q3 2026)',
  },
];
