import { LeadData, LeadOutcome, TranscriptTurn } from '../types/agent';

export interface EvaluationResult {
  outcome: LeadOutcome;
  sentiment: 'positive' | 'negative' | 'neutral' | 'opt_out';
  answeredSlotsCount: number;
  isOptOut: boolean;
  isNotInterested: boolean;
  summary: string;
  nextAction: string;
  extractedLeadData: Partial<LeadData>;
}

const OPT_OUT_PATTERNS = [
  /don'?t call me again/i,
  /stop calling/i,
  /remove my number/i,
  /remove me from/i,
  /take me off/i,
  /do not call/i,
  /unsubscribe/i,
  /never call/i,
  /dont call/i,
  /don'?t call/i,
  /don'?t contact/i,
  /call pannadhinga/i,
  /call panna vendam/i,
  /என்னை அழைக்காதீர்கள்/i,
  /தொடர்பு கொள்ள வேண்டாம்/i,
  /நம்பரை நீக்குங்கள்/i,
];

// Explicit negative patterns where the user genuinely rejects property inquiries
const EXPLICIT_NEGATIVE_PATTERNS = [
  /not interested/i,
  /no interest/i,
  /don'?t need any property/i,
  /don'?t need/i,
  /not buying anything/i,
  /not buying/i,
  /no requirement/i,
  /wrong number/i,
  /not looking for any/i,
  /not looking/i,
  /please leave me alone/i,
  /leave me alone/i,
  /not for me/i,
  /no thanks/i,
  /no thank you/i,
  /interest illa/i,
  /theva illa/i,
  /vendam/i,
  /வேண்டாம்/i,
  /ஆர்வம் இல்லை/i,
  /தேவை இல்லை/i,
  /எதுவும் வேண்டாம்/i,
  /வீடு வேண்டாம்/i,
  /ப்ளாட் வேண்டாம்/i,
];

const POSITIVE_INTENT_PATTERNS = [
  // Tamil markers for active property interest
  /கண்டிப்பா/i,
  /வேணும்/i,
  /பார்க்கலாம்/i,
  /பார்க்கணும்/i,
  /பாக்குறோம்/i,
  /முதலீடு/i,
  /அனுப்புங்க/i,
  /விசிட்/i,
  /சைட்/i,
  // English markers
  /interested/i,
  /looking to buy/i,
  /want to buy/i,
  /want to invest/i,
  /looking for/i,
  /send details/i,
  /send brochure/i,
  /whatsapp/i,
  /schedule a visit/i,
  /view property/i,
  /site visit/i,
  /quote|pricing|rate/i,
  /ready to move/i,
  /first-time buyer/i,
  /2bhk|3bhk|4bhk|1bhk/i,
  /villa|apartment|flat|plot|house|land|penthouse|duplex/i,
  /buying|investment/i,
];

const REACH_AGAIN_PATTERNS = [
  /call back/i,
  /call later/i,
  /call again/i,
  /reach again/i,
  /call (?:me )?back/i,
  /call (?:me )?later/i,
  /call (?:me )?tomorrow/i,
  /call (?:me )?next week/i,
  /call me/i,
  /busy right now/i,
  /busy now/i,
  /busy/i,
  /not available/i,
  /speak later/i,
  /talk later/i,
  /after \d+ hours?/i,
  /in \d+ hours?/i,
  /2 hours/i,
  /1 hour/i,
  /3 hours/i,
  /evening/i,
  /tomorrow/i,
  /next week/i,
  /next month/i,
  /நாளைக்கு/i,
  /அடுத்த வாரம்/i,
  /திரும்ப கூப்பிடு/i,
  /திரும்ப பேசு/i,
  /திரும்ப கால்/i,
  /கால் பண்ணுங்க/i,
  /கால் திரும்ப/i,
  /அப்புறம் கூப்பிடு/i,
  /அப்புறம் பேசு/i,
  /அப்புறம் கால்/i,
  /அவங்க வரதுக்கு/i,
  /மணி கழிச்சு/i,
  /ஹவர்ஸ் கழிச்சு/i,
  /2 ஹவர்ஸ்/i,
  /இப்ப பேச முடியாது/i,
  /வெளியே இருக்கா/i,
  /வெளிய இருக்கா/i,
  /மீட்டிங்ல இருக்கா/i,
  /பிறகு அழைக்கவும்/i,
  /வேற யாராச்சும்/i,
];

export function checkIsOptOut(text: string): boolean {
  if (!text) return false;
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkIsNotInterested(text: string): boolean {
  if (!text) return false;
  return EXPLICIT_NEGATIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkIsPositive(text: string): boolean {
  if (!text) return false;
  return POSITIVE_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkIsReachAgain(text: string): boolean {
  if (!text) return false;
  return REACH_AGAIN_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Extracts a normalized callback timeframe from user speech.
 */
export function extractCallbackTimeframe(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('tomorrow morning')) return 'Tomorrow morning';
  if (lower.includes('tomorrow evening')) return 'Tomorrow evening';
  if (lower.includes('tomorrow') || lower.includes('நாளைக்கு')) return 'Tomorrow';
  if (lower.includes('next week') || lower.includes('அடுத்த வாரம்')) return 'Next week';
  if (lower.includes('next month') || lower.includes('அடுத்த மாதம்')) return 'Next month';
  if (lower.includes('weekend') || lower.includes('வாரம்')) return 'This weekend';
  if (lower.includes('evening') || lower.includes('சாயங்காலம்')) return 'This evening';
  if (lower.includes('after 2 hours') || lower.includes('in 2 hours') || lower.includes('2 hours')) return 'In 2 hours';
  if (lower.includes('after 1 hour') || lower.includes('in 1 hour') || lower.includes('1 hour')) return 'In 1 hour';
  if (lower.includes('monday')) return 'Next Monday';
  if (lower.includes('busy now') || lower.includes('busy')) return 'Later today';
  return null;
}

/**
 * Intelligent extractor that extracts qualification slots directly from customer speech
 * (Strictly parses customer turns to avoid prompt contamination from agent greeting).
 */
export function extractLeadDetailsFromTranscript(
  transcript: TranscriptTurn[],
  existingData: LeadData
): Partial<LeadData> {
  const extracted: Partial<LeadData> = {};

  const userText = (transcript || [])
    .filter((t) => t.role === 'user' || t.speaker === 'customer')
    .map((t) => t.text)
    .join(' ');

  if (!userText.trim()) return extracted;

  // 1. Property Type
  if (!existingData.property_type) {
    if (/(\d\s*bhk|\d\s*bedroom)/i.test(userText)) {
      const match = userText.match(/(\d\s*bhk|\d\s*bedroom)/i);
      const raw = match ? match[0].toUpperCase().replace(/\s+/, '') : '';
      if (/villa|வில்லா/i.test(userText)) {
        extracted.property_type = `${raw} Villa`;
      } else {
        extracted.property_type = `${raw} Flat / Apartment`;
      }
    } else if (/villa|வில்லா/i.test(userText)) {
      extracted.property_type = 'Independent Villa';
    } else if (/apartment|flat|அபார்ட்மெண்ட்|பிளாட்|ப்ளாட்/i.test(userText)) {
      extracted.property_type = 'Apartment';
    } else if (/plot|land|மனை|ப்ளாட்|இடம்/i.test(userText)) {
      extracted.property_type = 'Residential Plot';
    } else if (/house|home|வீடு|தனி\s*வீடு/i.test(userText)) {
      extracted.property_type = 'Independent House';
    } else if (/commercial|office/i.test(userText)) {
      extracted.property_type = 'Commercial Property';
    }
  }

  // 2. Budget
  if (!existingData.budget) {
    const crMatch = userText.match(/(\d+(?:\.\d+)?\s*(?:cr|crore|crores|கோடி))/i);
    const lakhMatch = userText.match(/(\d+(?:\.\d+)?\s*(?:lakh|lakhs|lac|lacs|லட்சம்))/i);
    const dollarMatch = userText.match(/(?:\$)\s*(\d+(?:,\d+)*(?:\.\d+)?\s*[kmb]?)/i);
    const inrMatch = userText.match(/(?:₹)\s*(\d+(?:,\d+)*(?:\.\d+)?\s*(?:cr|lakh|lac|k)?)/i);
    const kMatch = userText.match(/(\d+\s*k)/i);

    if (crMatch) {
      extracted.budget = `₹${crMatch[1].replace(/கோடி/i, 'Cr').trim()}`;
    } else if (lakhMatch) {
      extracted.budget = `₹${lakhMatch[1].replace(/லட்சம்/i, 'L').trim()}`;
    } else if (dollarMatch) {
      extracted.budget = `$${dollarMatch[1]}`;
    } else if (inrMatch) {
      extracted.budget = `₹${inrMatch[1]}`;
    } else if (kMatch) {
      extracted.budget = `$${kMatch[1]}`;
    }
  }

  // 3. Location
  if (!existingData.location) {
    const locPatterns = [
      /anna\s*nagar|அண்ணா\s*நகர்/i,
      /omr/i,
      /ecr|ஈசிஆர்/i,
      /velachery|வேளச்சேரி/i,
      /porur|போரூர்/i,
      /tambaram|தாம்பரம்/i,
      /adyar|அடையார்/i,
      /t\s*nagar/i,
      /sholinganallur/i,
      /medavakkam/i,
      /chennai|சென்னை/i,
      /bangalore|பெங்களூரு/i,
      /hyderabad/i,
      /mumbai/i,
      /dubai|துபாய்/i,
      /downtown/i,
    ];
    for (const pat of locPatterns) {
      const match = userText.match(pat);
      if (match) {
        extracted.location = match[0].trim();
        break;
      }
    }
  }

  // 4. Timeline
  if (!existingData.timeline) {
    if (/immediate|urgent|right\s+now|today|ready\s+to\s+move|உடனே|இப்பவே/i.test(userText)) {
      extracted.timeline = 'Immediate (Ready to Move)';
    } else if (/(\d+)\s*(?:month|months|மாச|மாத)/i.test(userText)) {
      const m = userText.match(/(\d+)\s*(?:month|months|மாச|மாத)/i);
      extracted.timeline = `Within ${m ? m[1] : '1-3'} months`;
    } else if (/அடுத்த\s*(\d+)\s*மாச/i.test(userText)) {
      const m = userText.match(/அடுத்த\s*(\d+)\s*மாச/i);
      extracted.timeline = `Within ${m ? m[1] : '1-3'} months`;
    } else if (/(\d+)\s*(?:days?|நாட்கள்)/i.test(userText)) {
      const m = userText.match(/(\d+)\s*(?:days?|நாட்கள்)/i);
      extracted.timeline = `Within ${m ? m[1] : '60'} days`;
    } else if (/soon|next\s+quarter|சீக்கிரம்|அடுத்த\s*மாசம்/i.test(userText)) {
      extracted.timeline = 'Within 1-3 months';
    } else if (/flexible|next\s+year|பொறுமையா/i.test(userText)) {
      extracted.timeline = 'Flexible (3+ months)';
    }
  }

  // 5. Buyer Type
  if (!existingData.buyer_type) {
    if (/first\s*time|first-time|முதல்\s*முறை|முதல்\s*முறையா/i.test(userText)) {
      extracted.buyer_type = 'First-Time Homebuyer';
    } else if (/invest|investment|investing|rental\s*yield|roi|முதலீடு|முதலீட்டு/i.test(userText)) {
      extracted.buyer_type = 'Property Investor';
    } else if (/upgrade|upgrading|family|own\s*use|சொந்த\s*வீடு|வசிக்க/i.test(userText)) {
      extracted.buyer_type = 'End-User / Family';
    }
  }

  // 6. Interest
  if (!existingData.interest) {
    if (extracted.buyer_type === 'Property Investor' || /invest|முதலீடு/i.test(userText)) {
      extracted.interest = 'Property Investment';
    } else if (checkIsPositive(userText) || extracted.property_type || extracted.budget) {
      extracted.interest = 'Buying Residential Property';
    }
  }

  // 7. Callback timeframe
  const cb = extractCallbackTimeframe(userText);
  if (cb && !existingData.best_time_to_contact) {
    extracted.best_time_to_contact = cb;
  }

  return extracted;
}

/**
 * calculateAuthoritativeLeadScore — Authoritative 100-point lead scoring function.
 * Evaluates strictly from actual evidence across 6 standardized categories:
 *  1. Interest and buying/renting intent: 0–30 points
 *  2. Budget clarity: 0–20 points
 *  3. Property type and requirements: 0–15 points
 *  4. Preferred location: 0–10 points
 *  5. Purchase timeline: 0–15 points
 *  6. Engagement and readiness: 0–10 points
 * Total: 100 points.
 *
 * Rules:
 *  - Explicitly saying "I want to buy a property" must receive strong buying-intent points (30 pts),
 *    even if other details are not yet available.
 *  - A customer who confirms buying intent, gives a budget, specifies requirements, and plans to
 *    buy soon receives a substantially higher score than one who only expresses general interest.
 *  - "Not interested" receives 0 points and must not be classified as HOT or WARM.
 *  - "Don't call me again" / Opt-Out triggers 0 points and OPT_OUT outcome.
 *  - Unwanted / off-topic banter triggers 0 points and UNWANTED outcome.
 *  - A customer who requests a callback retains REACH_AGAIN; do not misclassify as unwanted.
 *  - A greeting alone earns 0 points across all categories.
 *  - Missing information earns 0 points for that category; never invent details.
 *  - Numerical score, temperature, callback status, and opt-out are kept as separate concepts.
 */
export function calculateAuthoritativeLeadScore(
  data: Partial<LeadData> | Record<string, any>,
  transcriptText: string = ''
): import('../types/agent').LeadScoreBreakdown {
  const factors: import('../types/agent').LeadScoreFactor[] = [];
  const reasons: string[] = [];
  const missingInformation: string[] = [];

  const raw: any = { ...data };
  const notes = String(raw.notes || '');
  const notesLower = notes.toLowerCase();
  const transcriptLower = transcriptText.toLowerCase();
  const combinedText = `${transcriptLower} ${notesLower} ${JSON.stringify(raw).toLowerCase()}`;

  // 0. Explicit "Not Interested", Opt-Out, or Unwanted Detection
  const isNotInterested =
    checkIsNotInterested(notes) ||
    checkIsNotInterested(transcriptText) ||
    combinedText.includes('not interested') ||
    combinedText.includes('no requirement') ||
    combinedText.includes('wrong number') ||
    combinedText.includes('vendam') ||
    combinedText.includes('interest illa');

  const isOptOut =
    checkIsOptOut(notes) ||
    checkIsOptOut(transcriptText) ||
    Boolean(raw.isOptedOut) ||
    raw.temperature === 'OPT_OUT' ||
    raw.qualification_status === 'OPT_OUT';

  const isUnwanted =
    raw.temperature === 'UNWANTED' ||
    raw.qualification_status === 'UNWANTED' ||
    raw.outcome === 'UNWANTED' ||
    raw.end_reason === 'unwanted_speech' ||
    raw.end_reason === 'out_of_scope' ||
    notesLower.includes('unwanted_speech') ||
    notesLower.includes('unwanted speech') ||
    notesLower.includes('unwanted or unrelated') ||
    notesLower.includes('unwanted or romantic') ||
    notesLower.includes('unwanted remark') ||
    notesLower.includes('romantic remark');

  // Check for greeting-only or minimal introductory speech
  const hasGreetingOnly =
    !isNotInterested &&
    !isOptOut &&
    !isUnwanted &&
    (transcriptLower.trim() === '' || /^(?:hello|hi|vanakkam|good morning|good afternoon|how are you|hey)[.!?\s]*$/i.test(transcriptLower.trim())) &&
    (!notes || notesLower.includes('hello') || notesLower.includes('no customer speech') || notesLower.trim() === '');

  // ─── 1. Buying / Renting Intent (0–30 points) ─────────────────────────
  let interestPts = 0;
  let interestReason = '';

  if (isNotInterested || isOptOut || isUnwanted) {
    interestPts = 0;
    interestReason = isOptOut
      ? 'Customer requested opt-out (DNC)'
      : isUnwanted
      ? 'Unwanted or off-topic conversation'
      : 'Customer explicitly stated not interested';
    if (isNotInterested) reasons.push('Customer stated not interested (0 pts)');
    if (isUnwanted) reasons.push('Flagged as unwanted speech / out of scope (0 pts)');
  } else if (hasGreetingOnly && !raw.intent && !raw.property_type && !raw.budget && !raw.budget_max) {
    interestPts = 0;
    interestReason = 'Greeting only; no property intent stated';
    missingInformation.push('Interest & buying intent (e.g. buying, investing, renting)');
  } else {
    const intentLower = String(raw.intent || raw.buyer_type || raw.purpose || '').toLowerCase();
    const hasExplicitBuyOrRentIntent =
      intentLower.includes('buy') ||
      intentLower.includes('invest') ||
      intentLower.includes('rent') ||
      intentLower.includes('purchase') ||
      combinedText.includes('want to buy') ||
      combinedText.includes('looking to buy') ||
      combinedText.includes('ready to buy') ||
      combinedText.includes('planning to buy') ||
      combinedText.includes('plan to buy') ||
      combinedText.includes('i want a property') ||
      combinedText.includes('buy property') ||
      combinedText.includes('buying property') ||
      combinedText.includes('buy panna') ||
      combinedText.includes('invest panna') ||
      combinedText.includes('rent-ku') ||
      combinedText.includes('property vaanga') ||
      combinedText.includes('property investment');

    const hasExpressedInterest =
      hasExplicitBuyOrRentIntent ||
      transcriptLower.includes('interested') ||
      transcriptLower.includes("i'm interested") ||
      transcriptLower.includes('yes interested') ||
      transcriptLower.includes('interest irukku') ||
      transcriptLower.includes('share details') ||
      transcriptLower.includes('send details') ||
      transcriptLower.includes('options paakalaam') ||
      transcriptLower.includes('enquir') ||
      notesLower.includes('interested') ||
      notesLower.includes('interest') ||
      notesLower.includes('enquir') ||
      Boolean(raw.interest && String(raw.interest).trim().length > 1 && !String(raw.interest).toLowerCase().includes('not'));

    const hasVagueBrowsing =
      combinedText.includes('exploring') ||
      combinedText.includes('just looking') ||
      combinedText.includes('curious') ||
      combinedText.includes('checking prices') ||
      combinedText.includes('paakuren');

    if (hasExplicitBuyOrRentIntent) {
      interestPts = 30;
      interestReason = 'Explicit buying, renting, or investment intent stated';
      reasons.push('High intent: Stated explicit purchase, rental, or investment goal (+30 pts)');
    } else if (hasExpressedInterest) {
      interestPts = 20;
      interestReason = 'Expressed genuine buying / property inquiry interest';
      reasons.push('Active interest: Customer confirmed interest in property options (+20 pts)');
    } else if (hasVagueBrowsing) {
      interestPts = 10;
      interestReason = 'Early discovery / exploratory browsing';
      reasons.push('Browsing stage: Exploratory property interest (+10 pts)');
    } else {
      interestPts = 0;
      interestReason = 'No buying intent stated';
      missingInformation.push('Interest & buying intent (e.g. buying, investing, renting)');
    }
  }

  factors.push({
    factor: 'Buying/renting intent',
    points: interestPts,
    maxPoints: 30,
    reason: interestReason,
  });

  // ─── 2. Budget Clarity (0–20 points) ──────────────────────────────────
  let budgetPts = 0;
  let budgetReason = '';
  const bg = String(raw.budget || '').trim();
  const bgMax = typeof raw.budget_max === 'number' ? raw.budget_max : parseFloat(raw.budget_max || '0');

  if (isNotInterested || isOptOut || isUnwanted) {
    budgetPts = 0;
    budgetReason = 'No budget assessed due to negative or unwanted status';
  } else if (bgMax > 0) {
    budgetPts = 20;
    budgetReason = `Verified stated budget: ${bgMax}`;
    reasons.push(`Budget clarity: Verified stated budget of ${bgMax} (+20 pts)`);
  } else if (bg && (bg.includes('cr') || bg.includes('lakh') || bg.includes('m') || bg.includes('aed') || bg.includes('inr') || /\d/.test(bg))) {
    budgetPts = 20;
    budgetReason = `Verified stated budget: ${bg}`;
    reasons.push(`Budget clarity: Verified stated budget of ${bg} (+20 pts)`);
  } else if (
    transcriptLower.includes('crore') ||
    transcriptLower.includes('lakh') ||
    transcriptLower.includes('million') ||
    transcriptLower.includes('aed') ||
    transcriptLower.includes('budget') ||
    notesLower.includes('crore') ||
    notesLower.includes('lakh') ||
    notesLower.includes('million') ||
    notesLower.includes('aed') ||
    notesLower.includes('budget')
  ) {
    budgetPts = 12;
    budgetReason = 'Conversational ballpark budget range mentioned';
    reasons.push('Budget indication: Ballpark budget range mentioned (+12 pts)');
  } else {
    budgetPts = 0;
    budgetReason = 'No budget stated';
    missingInformation.push('Budget range (e.g. ₹80 Lakhs, 1.5 Cr, AED 2M)');
  }

  factors.push({
    factor: 'Budget clarity',
    points: budgetPts,
    maxPoints: 20,
    reason: budgetReason,
  });

  // ─── 3. Property Type and Requirements (0–15 points) ───────────────────
  let propPts = 0;
  let propReason = '';
  const pType = String(raw.property_type || '').trim();
  const pTypeLower = pType.toLowerCase();

  const isSpecificConfig =
    /\d\s*bhk/i.test(pType) ||
    /sqft|sq\.ft|cents|grounds|acres/i.test(combinedText) ||
    raw.bedrooms != null ||
    (pTypeLower.includes('villa') && (pTypeLower.includes('independent') || pTypeLower.includes('luxury'))) ||
    pTypeLower.includes('penthouse') ||
    pTypeLower.includes('commercial');

  const isBroadCategory =
    pTypeLower.includes('apartment') ||
    pTypeLower.includes('villa') ||
    pTypeLower.includes('flat') ||
    pTypeLower.includes('plot') ||
    pTypeLower.includes('land') ||
    pTypeLower.includes('house') ||
    combinedText.includes('apartment') ||
    combinedText.includes('villa') ||
    combinedText.includes('plot') ||
    combinedText.includes('flat');

  if (isNotInterested || isOptOut || isUnwanted) {
    propPts = 0;
    propReason = 'No property requirement assessed';
  } else if (isSpecificConfig) {
    propPts = 15;
    propReason = `Detailed property configuration specified: ${pType}`;
    reasons.push(`Specific requirement: Clear property specifications identified (${pType}) (+15 pts)`);
  } else if (isBroadCategory || pType.length > 1) {
    propPts = 10;
    propReason = `General property category identified: ${pType || 'Residential'}`;
    reasons.push(`Property requirement: Category identified (+10 pts)`);
  } else {
    propPts = 0;
    propReason = 'No property type specified';
    missingInformation.push('Property type (e.g. 3 BHK Villa, Apartment, Plot)');
  }

  factors.push({
    factor: 'Property type and requirements',
    points: propPts,
    maxPoints: 15,
    reason: propReason,
  });

  // ─── 4. Preferred Location (0–10 points) ───────────────────────────────
  let locPts = 0;
  let locReason = '';
  const loc = String(raw.location || raw.original_location || raw.city || raw.locality || '').trim();
  const locLower = loc.toLowerCase();

  const hasSpecificLocality =
    Boolean(raw.locality && String(raw.locality).trim().length > 1) ||
    locLower.includes('ecr') ||
    locLower.includes('omr') ||
    locLower.includes('anna nagar') ||
    locLower.includes('velachery') ||
    locLower.includes('porur') ||
    locLower.includes('tambaram') ||
    locLower.includes('downtown') ||
    locLower.includes('marina') ||
    locLower.includes('palm jumeirah') ||
    locLower.includes('business bay') ||
    locLower.includes('whitefield') ||
    locLower.includes('indiranagar');

  const hasBroadCity =
    locLower.includes('chennai') ||
    locLower.includes('dubai') ||
    locLower.includes('bangalore') ||
    locLower.includes('coimbatore') ||
    locLower.includes('madurai') ||
    locLower.includes('trichy') ||
    (loc.length > 2 && !['unknown', 'prospect', 'customer'].includes(locLower));

  if (isNotInterested || isOptOut || isUnwanted) {
    locPts = 0;
    locReason = 'No location assessed';
  } else if (hasSpecificLocality) {
    locPts = 10;
    locReason = `Specific locality preference identified: ${loc}`;
    reasons.push(`Targeted locality: Specific neighborhood identified (${loc}) (+10 pts)`);
  } else if (hasBroadCity) {
    locPts = 6;
    locReason = `Broad city / market identified: ${loc}`;
    reasons.push(`Location identified: City / territory preference known (${loc}) (+6 pts)`);
  } else {
    locPts = 0;
    locReason = 'No location preference stated';
    missingInformation.push('Target location or city (e.g. ECR Chennai, Downtown Dubai)');
  }

  factors.push({
    factor: 'Preferred location',
    points: locPts,
    maxPoints: 10,
    reason: locReason,
  });

  // ─── 5. Purchase Timeline (0–15 points) ─────────────────────────────────
  let timelinePts = 0;
  let timelineReason = '';
  const tl = String(raw.timeline || '').toLowerCase();

  const isImmediate =
    tl.includes('immediate') ||
    tl.includes('ready') ||
    tl.includes('30') ||
    tl.includes('within_1_month') ||
    combinedText.includes('immediate') ||
    combinedText.includes('ready to move') ||
    combinedText.includes('ready to buy') ||
    combinedText.includes('this month') ||
    combinedText.includes('உடனே') ||
    combinedText.includes('seekiram');

  const isShortTerm =
    tl.includes('1-3') ||
    tl.includes('within_3_months') ||
    tl.includes('60') ||
    combinedText.includes('next month') ||
    combinedText.includes('2 months') ||
    combinedText.includes('3 months') ||
    combinedText.includes('அடுத்த மாசம்');

  const isMediumTerm =
    tl.includes('6') ||
    tl.includes('within_6_months') ||
    combinedText.includes('6 months') ||
    combinedText.includes('few months');

  const isLongTerm =
    tl.includes('flexible') ||
    tl.includes('year') ||
    tl.includes('exploring') ||
    combinedText.includes('next year') ||
    combinedText.includes('flexible') ||
    combinedText.includes('just exploring');

  if (isNotInterested || isOptOut || isUnwanted) {
    timelinePts = 0;
    timelineReason = 'No purchase timeline assessed';
  } else if (isImmediate) {
    timelinePts = 15;
    timelineReason = 'Urgent / Immediate timeline (within 30 days)';
    reasons.push('High urgency: Target purchase within 30 days (+15 pts)');
  } else if (isShortTerm) {
    timelinePts = 10;
    timelineReason = 'Active short-term timeline (1 to 3 months)';
    reasons.push('Active timeline: Target purchase within 1-3 months (+10 pts)');
  } else if (isMediumTerm) {
    timelinePts = 5;
    timelineReason = 'Medium-term horizon (3 to 6 months)';
    reasons.push('Medium-term horizon: 3 to 6 months (+5 pts)');
  } else if (isLongTerm) {
    timelinePts = 2;
    timelineReason = 'Flexible / Long-term timeline (> 6 months)';
    reasons.push('Exploratory timeline: Greater than 6 months (+2 pts)');
  } else {
    timelinePts = 0;
    timelineReason = 'Purchase timeline unstated';
    missingInformation.push('Purchase timeline (e.g. immediate, 1-3 months)');
  }

  factors.push({
    factor: 'Purchase timeline',
    points: timelinePts,
    maxPoints: 15,
    reason: timelineReason,
  });

  // ─── 6. Engagement and Readiness (0–10 points) ─────────────────────────
  let engagementPts = 0;
  let engagementReason = '';

  const hasSiteVisit =
    combinedText.includes('site visit') ||
    combinedText.includes('viewing') ||
    combinedText.includes('appointment') ||
    combinedText.includes('inspection');

  const hasFollowupOrCallback =
    combinedText.includes('call back') ||
    combinedText.includes('reach again') ||
    combinedText.includes('whatsapp') ||
    combinedText.includes('brochure') ||
    Boolean(raw.best_time_to_contact) ||
    raw.temperature === 'REACH_AGAIN' ||
    raw.qualification_status === 'REACH_AGAIN';

  const hasReceptiveDialogue =
    Boolean(raw.phone) ||
    Boolean(raw.name && !String(raw.name).toLowerCase().includes('unknown') && !String(raw.name).toLowerCase().includes('prospect')) ||
    Boolean(raw.customer_name_raw) ||
    Boolean(raw.customer_preferred_name) ||
    transcriptText.trim().length > 20 ||
    notes.trim().length > 10;

  if (isNotInterested || isOptOut || isUnwanted) {
    engagementPts = 0;
    engagementReason = 'No positive engagement assessed';
  } else if (hasSiteVisit) {
    engagementPts = 10;
    engagementReason = 'High engagement: Agreed to or requested property site viewing / appointment';
    reasons.push('High engagement: Requested site visit or appointment booking (+10 pts)');
  } else if (hasFollowupOrCallback) {
    engagementPts = 7;
    engagementReason = 'Active engagement: Requested callback / follow-up documentation';
    reasons.push('Active engagement: Agreed to callback or follow-up brochure (+7 pts)');
  } else if (hasReceptiveDialogue && interestPts > 0) {
    engagementPts = 4;
    engagementReason = 'Receptive conversation: Participated in dialogue and shared details';
    reasons.push('Receptive: Customer actively shared requirements in conversation (+4 pts)');
  } else {
    engagementPts = 0;
    engagementReason = 'No active engagement or follow-up agreed yet';
    missingInformation.push('Agreed next step (e.g. site visit, WhatsApp brochure, callback)');
  }

  factors.push({
    factor: 'Engagement and readiness',
    points: engagementPts,
    maxPoints: 10,
    reason: engagementReason,
  });

  // ─── Total Score Calculation ──────────────────────────────────────────
  let totalScore = Math.min(100, Math.max(0, interestPts + budgetPts + propPts + locPts + timelinePts + engagementPts));

  // If customer is explicitly not interested, opted out, or unwanted, final score must be 0
  if (isNotInterested || isOptOut || isUnwanted) {
    totalScore = 0;
  }

  let temperature: 'HOT' | 'WARM' | 'COLD' = 'COLD';
  let nextAction = '';

  if (totalScore >= 75) {
    temperature = 'HOT';
    nextAction = 'Immediate Priority: Assign senior relationship manager and schedule site visit within 24 hours.';
  } else if (totalScore >= 45) {
    temperature = 'WARM';
    nextAction = 'Nurture Priority: Send WhatsApp curated property catalog and schedule follow-up call within 48 hours.';
  } else {
    temperature = 'COLD';
    nextAction = isNotInterested || isOptOut || isUnwanted
      ? 'Do not pursue: Prospect opted out, stated no interest, or call was out of scope.'
      : 'Low Priority: Add to monthly newsletter and automated market insights drip.';
  }

  return {
    score: totalScore,
    temperature,
    factors,
    reasons,
    missingInformation,
    nextAction,
  };
}

export const calculateDeterministicLeadScore = calculateAuthoritativeLeadScore;

/**
 * determineLeadStatusFromData — Deterministic rule engine to classify a lead
 * from available record fields (notes, budget, timeline, property_type, intent, etc.)
 * rather than blindly defaulting to WARM.
 */
export function determineLeadStatusFromData(
  data: Record<string, any>
): { outcome: LeadOutcome; score: number } {
  const d = data as any;
  const notes = String(d.notes || '');
  const notesLower = notes.toLowerCase();
  const qStatus = String(d.qualification_status || d.temperature || '').toUpperCase();
  const bContact = String(d.best_time_to_contact || '').toLowerCase();

  // 1. Opt Out or Unwanted
  if (
    qStatus === 'OPT_OUT' ||
    qStatus === 'UNWANTED' ||
    Boolean(d.isOptedOut) ||
    checkIsOptOut(notes) ||
    notesLower.includes('dnc') ||
    notesLower.includes('opt_out') ||
    notesLower.includes('opt-out') ||
    notesLower.includes('do not call') ||
    notesLower.includes('unwanted') ||
    notesLower.includes('unrelated remarks')
  ) {
    const outcome = (qStatus === 'UNWANTED' || notesLower.includes('unwanted') || notesLower.includes('unrelated remarks')) ? 'UNWANTED' : 'OPT_OUT';
    return { outcome, score: 0 };
  }

  // 2. Reach Again (Callback requested)
  if (
    qStatus === 'REACH_AGAIN' ||
    checkIsReachAgain(notes) ||
    checkIsReachAgain(bContact) ||
    notesLower.includes('callback') ||
    notesLower.includes('call back') ||
    notesLower.includes('reach again') ||
    notesLower.includes('tomorrow') ||
    notesLower.includes('next week') ||
    notesLower.includes('busy') ||
    bContact.includes('tomorrow') ||
    bContact.includes('next week') ||
    bContact.includes('later')
  ) {
    const calculated = calculateAuthoritativeLeadScore(data);
    return { outcome: 'REACH_AGAIN', score: calculated.score };
  }

  // 3. Explicit Not Interested
  if (
    checkIsNotInterested(notes) ||
    notesLower.includes('not interested') ||
    notesLower.includes('no requirement') ||
    notesLower.includes('wrong number') ||
    notesLower.includes('leave me alone') ||
    notesLower.includes('interest illa') ||
    notesLower.includes('vendam')
  ) {
    return { outcome: 'COLD', score: 0 };
  }

  // Check property specifications
  const propType = (d.property_type || '').trim();
  const budgetStr = String(d.budget || '').trim();
  const budgetMax = typeof d.budget_max === 'number' ? d.budget_max : parseFloat(d.budget_max || '0');
  const hasBudget = Boolean(budgetMax > 0 || (budgetStr && /\d/.test(budgetStr)));
  const timeline = (d.timeline || '').toLowerCase();
  const intent = (d.intent || d.buyer_type || '').toLowerCase();
  const hasLocation = Boolean((d.location || d.city || d.locality || '').trim());

  const isNearTermTimeline =
    timeline.includes('immediate') ||
    timeline.includes('ready') ||
    timeline.includes('30') ||
    timeline.includes('60') ||
    timeline.includes('days') ||
    timeline.includes('1 month') ||
    timeline.includes('2 month') ||
    timeline.includes('3 month') ||
    timeline.includes('within_1_month') ||
    timeline.includes('within_3_months') ||
    timeline.includes('soon') ||
    timeline.includes('now') ||
    timeline.includes('உடனே') ||
    timeline.includes('1 மாச') ||
    timeline.includes('2 மாச') ||
    timeline.includes('3 மாச');

  const hasSpecificRequirement = Boolean(
    propType || (intent.includes('buy') || intent.includes('invest') || intent.includes('villa') || intent.includes('apartment') || intent.includes('land'))
  );

  // 4. No buying intent / Only said "Hello" / Empty prospect (regardless of legacy WARM default)
  const isMinimalOrHello =
    !hasSpecificRequirement &&
    !hasBudget &&
    !timeline &&
    !hasLocation &&
    (!notes || notesLower.includes('hello') || notesLower.includes('customer introduced') || notesLower.includes('test fixture') || notesLower.includes('no customer speech') || notesLower.trim() === '');

  if (isMinimalOrHello && qStatus !== 'HOT') {
    const calculated = calculateAuthoritativeLeadScore(data);
    return { outcome: 'COLD', score: calculated.score };
  }

  // 5. Qualified Buyer with clear requirements, budget, and near-term timeline -> HOT
  if (
    (hasSpecificRequirement && hasBudget && (isNearTermTimeline || hasLocation)) ||
    (qStatus === 'HOT') ||
    (hasBudget && isNearTermTimeline && hasSpecificRequirement)
  ) {
    const calculated = calculateAuthoritativeLeadScore(data);
    return { outcome: 'HOT', score: calculated.score };
  }

  // 6. Interested but insufficiently qualified (has requirement, interest notes, budget or location) -> WARM
  if (
    hasSpecificRequirement ||
    hasBudget ||
    (intent.includes('buy') || intent.includes('invest')) ||
    notesLower.includes('interest') ||
    notesLower.includes('looking for') ||
    notesLower.includes('enquir') ||
    (qStatus === 'WARM' && (hasSpecificRequirement || hasBudget || hasLocation || timeline || notesLower.includes('interest')))
  ) {
    const calculated = calculateAuthoritativeLeadScore(data);
    return { outcome: 'WARM', score: calculated.score };
  }

  // 7. Otherwise COLD
  const calculated = calculateAuthoritativeLeadScore(data);
  return { outcome: calculated.score >= 75 ? 'HOT' : calculated.score >= 45 ? 'WARM' : 'COLD', score: calculated.score };
}

/**
 * Deterministic qualification scoring engine:
 *
 * HOT:
 *  - Clear intent to buy or invest with verified details (budget, property type, or timeline <= 6 months)
 *  - OR AI explicit tool qualification HOT
 *
 * WARM:
 *  - Interested in property, but timeline is flexible or budget exploratory
 *
 * REACH_AGAIN:
 *  - Customer or representative asked to call back later (e.g. in 2 hours, busy now, answered by relative)
 *  - Always kept in follow-up queue, never dropped to COLD
 *
 * OPT_OUT:
 *  - Explicit request to not be called again / DNC
 *
 * COLD:
 *  - Explicitly not interested, no property requirements, or refused all discussion
 */
export function evaluateCallOutcome(
  leadName: string,
  leadData: LeadData,
  transcript: TranscriptTurn[],
  callConnected: boolean = true
): EvaluationResult {
  // If call was never connected or cancelled immediately
  if (!callConnected) {
    return {
      outcome: 'NO_ANSWER',
      sentiment: 'neutral',
      answeredSlotsCount: 0,
      isOptOut: false,
      isNotInterested: false,
      summary: `${leadName} was called but did not answer or the connection timed out.`,
      nextAction: 'Retry outbound call during business hours.',
      extractedLeadData: {},
    };
  }

  // Combine user speech strictly
  const userText = (transcript || [])
    .filter((t) => t.role === 'user' || t.speaker === 'customer')
    .map((t) => t.text)
    .join(' ');

  // 1. Check Opt-Out
  const isOptOut =
    checkIsOptOut(userText) ||
    Boolean(leadData.notes && checkIsOptOut(leadData.notes)) ||
    Boolean(leadData.notes?.toLowerCase().includes('opt_out')) ||
    Boolean(leadData.notes?.toLowerCase().includes('dnc')) ||
    (leadData.qualification_status === 'OPT_OUT') ||
    ((leadData as any).qualification_status === 'UNWANTED');

  if (isOptOut) {
    return {
      outcome: 'OPT_OUT',
      sentiment: 'opt_out',
      answeredSlotsCount: 0,
      isOptOut: true,
      isNotInterested: true,
      summary: `${leadName} requested to be removed from the calling list (Opt-Out / Do Not Call).`,
      nextAction: 'Permanently mark as DNC; suppress from all future call queues.',
      extractedLeadData: { qualification_status: 'OPT_OUT' },
    };
  }

  // 2. Check Reach Again / Callback
  const isReachAgain =
    leadData.qualification_status === 'REACH_AGAIN' ||
    checkIsReachAgain(userText) ||
    Boolean(leadData.notes && checkIsReachAgain(leadData.notes)) ||
    Boolean(leadData.notes?.toLowerCase().includes('call back')) ||
    Boolean(leadData.notes?.toLowerCase().includes('reach again')) ||
    Boolean(leadData.notes?.toLowerCase().includes('tomorrow')) ||
    Boolean(leadData.notes?.toLowerCase().includes('next week')) ||
    Boolean(leadData.notes?.toLowerCase().includes('unavailable')) ||
    Boolean(leadData.notes?.toLowerCase().includes('answered by')) ||
    Boolean(leadData.notes?.toLowerCase().includes('brother')) ||
    Boolean(leadData.notes?.includes('கால் திரும்ப'));

  if (isReachAgain) {
    const timeframe = extractCallbackTimeframe(userText) || extractCallbackTimeframe(leadData.notes || '') || 'Callback requested';
    const baseNote = leadData.notes?.trim() || '';
    const summary = baseNote.length > 5
      ? (baseNote.toLowerCase().includes(timeframe.toLowerCase()) ? baseNote : `${baseNote} | Callback: ${timeframe}`)
      : `${leadName} requested a callback (${timeframe}).`;

    return {
      outcome: 'REACH_AGAIN',
      sentiment: 'neutral',
      answeredSlotsCount: 0,
      isOptOut: false,
      isNotInterested: false,
      summary,
      nextAction: `Scheduled callback requested: Call back at requested timeframe (${timeframe}).`,
      extractedLeadData: {
        qualification_status: 'REACH_AGAIN',
        best_time_to_contact: timeframe,
        notes: summary,
      },
    };
  }

  // 3. Extract any missing qualification details from customer speech strictly
  const extracted = extractLeadDetailsFromTranscript(transcript, leadData);

  // Merge extracted with leadData for scoring
  const mergedInterest = leadData.interest || extracted.interest || '';
  const mergedBuyerType = leadData.buyer_type || extracted.buyer_type || '';
  const mergedPropertyType = leadData.property_type || extracted.property_type || '';
  const mergedBudget = leadData.budget || extracted.budget || '';
  const mergedLocation = leadData.location || extracted.location || '';
  const mergedTimeline = leadData.timeline || extracted.timeline || '';

  // Count answered slots
  let answeredSlots = 0;
  if (mergedPropertyType) answeredSlots++;
  if (mergedBudget) answeredSlots++;
  if (mergedLocation) answeredSlots++;
  if (mergedTimeline) answeredSlots++;
  if (mergedBuyerType) answeredSlots++;

  // Explicit not interested check
  const isExplicitNotInterested =
    checkIsNotInterested(userText) ||
    (leadData.notes ? checkIsNotInterested(leadData.notes) : false) ||
    Boolean(leadData.notes?.toLowerCase().includes('not interested')) ||
    Boolean(leadData.notes?.toLowerCase().includes('no requirement')) ||
    Boolean(leadData.notes?.toLowerCase().includes('vendam')) ||
    leadData.qualification_status === 'COLD' && checkIsNotInterested(userText);

  // Intent checks
  const isPositive = checkIsPositive(userText) || Boolean(mergedInterest && !mergedInterest.toLowerCase().includes('not'));

  // Sentiment determination
  let sentiment: 'positive' | 'negative' | 'neutral' | 'opt_out' = 'neutral';
  if (isExplicitNotInterested) {
    sentiment = 'negative';
  } else if (isPositive || answeredSlots >= 2) {
    sentiment = 'positive';
  }

  // Determine outcome
  let outcome: LeadOutcome;
  let nextAction = '';

  // Rule 1: Explicitly Not Interested -> COLD
  if (isExplicitNotInterested) {
    outcome = 'COLD';
    nextAction = 'Do not follow up immediately; prospect stated no interest.';
  }
  // Rule 2: Explicit Qualification from Agent
  else if (leadData.qualification_status === 'HOT') {
    outcome = 'HOT';
    nextAction = 'Priority lead: Route to senior sales specialist for direct call within 2 hours.';
  } else if (leadData.qualification_status === 'WARM') {
    outcome = 'WARM';
    nextAction = 'Nurture lead: Send WhatsApp brochure catalog and follow up in 24 hours.';
  }
  // Rule 3: Qualified buyer with clear requirements, budget, and near-term timeline -> HOT
  else if (
    mergedPropertyType &&
    mergedBudget &&
    mergedTimeline &&
    !mergedTimeline.toLowerCase().includes('flexible') &&
    sentiment === 'positive'
  ) {
    outcome = 'HOT';
    nextAction = 'Priority lead: Route to senior sales specialist for direct call within 2 hours.';
  }
  // Rule 4: Interested but insufficiently qualified -> WARM
  else if (
    (mergedPropertyType || mergedBudget || isPositive) &&
    !isExplicitNotInterested
  ) {
    outcome = 'WARM';
    nextAction = 'Nurture lead: Send WhatsApp brochure catalog and follow up in 24 hours.';
  }
  // Rule 5: Only says "Hello" / no buying intent / greetings -> COLD
  else {
    outcome = 'COLD';
    nextAction = 'Send automated quarterly market update newsletter.';
  }

  // Generate natural descriptive summary
  let summary = '';
  if (outcome === 'HOT') {
    summary = `${leadName} is actively looking to purchase ${
      mergedPropertyType || 'a residential property'
    }${mergedLocation ? ` in ${mergedLocation}` : ''} with a verified budget of ${
      mergedBudget || 'market standard range'
    }. Timeline: ${mergedTimeline || 'within 1-3 months'}. Highly responsive prospect.`;
  } else if (outcome === 'WARM') {
    summary = `${leadName} expressed interest in ${
      mergedPropertyType || 'real estate opportunities'
    }${mergedLocation ? ` in ${mergedLocation}` : ''}. Budget: ${
      mergedBudget || 'Flexible / unfinalized'
    }. Timeline: ${mergedTimeline || 'Flexible or exploratory'}.`;
  } else {
    summary = `${leadName} was reached but did not have active property requirements at this time (${
      isExplicitNotInterested ? 'stated not interested' : userText.trim().length ? 'general inquiry / no buying intent' : 'no customer speech'
    }).`;
  }

  const resolvedExtracted: Partial<LeadData> = {
    ...extracted,
    interest: mergedInterest || (outcome === 'HOT' || outcome === 'WARM' ? 'Buying Residential Property' : 'Not interested'),
    buyer_type: mergedBuyerType,
    property_type: mergedPropertyType,
    budget: mergedBudget,
    location: mergedLocation,
    timeline: mergedTimeline,
    qualification_status: outcome,
  };

  return {
    outcome,
    sentiment,
    answeredSlotsCount: answeredSlots,
    isOptOut: false,
    isNotInterested: isExplicitNotInterested,
    summary,
    nextAction,
    extractedLeadData: resolvedExtracted,
  };
}
