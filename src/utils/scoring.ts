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
  /என்னை அழைக்காதீர்கள்/i,
  /தொடர்பு கொள்ள வேண்டாம்/i,
  /நம்பரை நீக்குங்கள்/i,
];

// Explicit negative patterns where the user genuinely rejects property inquiries
const EXPLICIT_NEGATIVE_PATTERNS = [
  /not interested/i,
  /no interest/i,
  /don'?t need any property/i,
  /not buying anything/i,
  /no requirement/i,
  /wrong number/i,
  /not looking for any/i,
  /please leave me alone/i,
  /ஆர்வம் இல்லை/i,
  /தேவை இல்லை/i,
  /எதுவும் வேண்டாம்/i,
  /வீடு வேண்டாம்/i,
  /ப்ளாட் வேண்டாம்/i,
];

const POSITIVE_INTENT_PATTERNS = [
  // Tamil markers (covers ஆமா, ஆமாம், ஆமாங்க, ஆமா சார்)
  /ஆமா/i,
  /கண்டிப்பா/i,
  /சரிங்க/i,
  /வேணும்/i,
  /பார்க்கலாம்/i,
  /பார்க்கணும்/i,
  /பாக்குறோம்/i,
  /சொல்லுங்க/i,
  /விவரம்/i,
  /வாங்க/i,
  /முதலீடு/i,
  /விலை/i,
  /பட்ஜெட்/i,
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
  /first time/i,
  /2bhk|3bhk|4bhk|1bhk/i,
  /villa|apartment|flat|plot|house|land|penthouse|duplex/i,
  /buying|investment/i,
];

const REACH_AGAIN_PATTERNS = [
  /call back/i,
  /call later/i,
  /call again/i,
  /reach again/i,
  /busy right now/i,
  /busy now/i,
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
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkIsNotInterested(text: string): boolean {
  return EXPLICIT_NEGATIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkIsPositive(text: string): boolean {
  return POSITIVE_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkIsReachAgain(text: string): boolean {
  return REACH_AGAIN_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Intelligent extractor that extracts qualification slots directly from conversation turns
 * if not already extracted by the AI tool call.
 */
export function extractLeadDetailsFromTranscript(
  transcript: TranscriptTurn[],
  existingData: LeadData
): Partial<LeadData> {
  const extracted: Partial<LeadData> = {};

  const userText = transcript
    .filter((t) => t.role === 'user')
    .map((t) => t.text)
    .join(' ');

  const fullText = transcript.map((t) => t.text).join(' ');

  // 1. Property Type
  if (!existingData.property_type) {
    if (/(\d\s*bhk|\d\s*bedroom)/i.test(fullText)) {
      const match = fullText.match(/(\d\s*bhk|\d\s*bedroom)/i);
      const raw = match ? match[0].toUpperCase().replace(/\s+/, '') : '';
      if (/villa|வில்லா/i.test(fullText)) {
        extracted.property_type = `${raw} Villa`;
      } else {
        extracted.property_type = `${raw} Flat / Apartment`;
      }
    } else if (/villa|வில்லா/i.test(fullText)) {
      extracted.property_type = 'Independent Villa';
    } else if (/apartment|flat|அபார்ட்மெண்ட்|பிளாட்|ப்ளாட்/i.test(fullText)) {
      extracted.property_type = 'Apartment';
    } else if (/plot|land|மனை|ப்ளாட்|இடம்/i.test(fullText)) {
      extracted.property_type = 'Residential Plot';
    } else if (/house|home|வீடு|தனி\s*வீடு/i.test(fullText)) {
      extracted.property_type = 'Independent House';
    } else if (/commercial|office/i.test(fullText)) {
      extracted.property_type = 'Commercial Property';
    }
  }

  // 2. Budget
  if (!existingData.budget) {
    const crMatch = fullText.match(/(\d+(?:\.\d+)?\s*(?:cr|crore|crores|கோடி))/i);
    const lakhMatch = fullText.match(/(\d+(?:\.\d+)?\s*(?:lakh|lakhs|lac|lacs|லட்சம்))/i);
    const dollarMatch = fullText.match(/(?:\$)\s*(\d+(?:,\d+)*(?:\.\d+)?\s*[kmb]?)/i);
    const inrMatch = fullText.match(/(?:₹)\s*(\d+(?:,\d+)*(?:\.\d+)?\s*(?:cr|lakh|lac|k)?)/i);
    const kMatch = fullText.match(/(\d+\s*k)/i);

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
      const match = fullText.match(pat);
      if (match) {
        extracted.location = match[0].trim();
        break;
      }
    }
  }

  // 4. Timeline
  if (!existingData.timeline) {
    if (/immediate|urgent|right\s+now|today|ready\s+to\s+move|உடனே|இப்பவே/i.test(fullText)) {
      extracted.timeline = 'Immediate (Ready to Move)';
    } else if (/(\d+)\s*(?:month|months|மாச|மாத)/i.test(fullText)) {
      const m = fullText.match(/(\d+)\s*(?:month|months|மாச|மாத)/i);
      extracted.timeline = `Within ${m ? m[1] : '1-3'} months`;
    } else if (/அடுத்த\s*(\d+)\s*மாச/i.test(fullText)) {
      const m = fullText.match(/அடுத்த\s*(\d+)\s*மாச/i);
      extracted.timeline = `Within ${m ? m[1] : '1-3'} months`;
    } else if (/(\d+)\s*(?:days?|நாட்கள்)/i.test(fullText)) {
      const m = fullText.match(/(\d+)\s*(?:days?|நாட்கள்)/i);
      extracted.timeline = `Within ${m ? m[1] : '60'} days`;
    } else if (/soon|next\s+quarter|சீக்கிரம்|அடுத்த\s*மாசம்/i.test(fullText)) {
      extracted.timeline = 'Within 1-3 months';
    } else if (/flexible|next\s+year|பொறுமையா/i.test(fullText)) {
      extracted.timeline = 'Flexible (3+ months)';
    }
  }

  // 5. Buyer Type
  if (!existingData.buyer_type) {
    if (/first\s*time|first-time|முதல்\s*முறை|முதல்\s*முறையா/i.test(fullText)) {
      extracted.buyer_type = 'First-Time Homebuyer';
    } else if (/invest|investment|investing|rental\s*yield|roi|முதலீடு|முதலீட்டு/i.test(fullText)) {
      extracted.buyer_type = 'Property Investor';
    } else if (/upgrade|upgrading|family|own\s*use|சொந்த\s*வீடு|வசிக்க/i.test(fullText)) {
      extracted.buyer_type = 'End-User / Family';
    }
  }

  // 6. Interest
  if (!existingData.interest) {
    if (extracted.buyer_type === 'Property Investor' || /invest|முதலீடு/i.test(fullText)) {
      extracted.interest = 'Property Investment';
    } else if (checkIsPositive(userText) || extracted.property_type || extracted.budget) {
      extracted.interest = 'Buying Residential Property';
    }
  }

  return extracted;
}

/**
 * Deterministic qualification scoring engine:
 *
 * HOT:
 *  - Clear intent to buy or invest with verified details (budget, property type, or timeline <= 6 months)
 *  - OR AI explicit tool qualification HOT
 *  - OR high engagement with at least 2 answered qualification slots + positive sentiment
 *
 * WARM:
 *  - Interested in property, but timeline is flexible or budget exploratory
 *  - OR at least 1 answered qualification slot with positive/receptive sentiment
 *  - OR AI explicit tool qualification WARM
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

  // Combine user turns text
  const userText = transcript
    .filter((t) => t.role === 'user')
    .map((t) => t.text)
    .join(' ');

  const fullConversation = transcript.map((t) => t.text).join(' ');

  // 1. Check Opt-Out
  const isOptOut =
    checkIsOptOut(userText) ||
    Boolean(leadData.notes?.toLowerCase().includes('opt_out')) ||
    Boolean(leadData.notes?.toLowerCase().includes('dnc')) ||
    (leadData.qualification_status === 'OPT_OUT') ||
    (leadData.qualification_status === 'COLD' && checkIsOptOut(leadData.notes || ''));

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
    Boolean(leadData.notes?.toLowerCase().includes('unavailable')) ||
    Boolean(leadData.notes?.toLowerCase().includes('answered by')) ||
    Boolean(leadData.notes?.toLowerCase().includes('brother')) ||
    Boolean(leadData.notes?.includes('கால் திரும்ப'));

  if (isReachAgain) {
    const customNote = leadData.notes?.trim() || '';
    const summary = customNote.length > 5
      ? customNote
      : `${leadName} callback requested: Contact or representative asked to call back later.`;
    return {
      outcome: 'REACH_AGAIN',
      sentiment: 'neutral',
      answeredSlotsCount: 0,
      isOptOut: false,
      isNotInterested: false,
      summary,
      nextAction: 'Scheduled callback requested: Call back at the requested time (e.g. in 2 hours).',
      extractedLeadData: { qualification_status: 'REACH_AGAIN' },
    };
  }

  // 3. Extract any missing qualification details from transcript
  const extracted = extractLeadDetailsFromTranscript(transcript, leadData);

  // Merge extracted with leadData for scoring
  const mergedInterest = leadData.interest || extracted.interest || '';
  const mergedBuyerType = leadData.buyer_type || extracted.buyer_type || '';
  const mergedPropertyType = leadData.property_type || extracted.property_type || '';
  const mergedBudget = leadData.budget || extracted.budget || '';
  const mergedLocation = leadData.location || extracted.location || '';
  const mergedTimeline = leadData.timeline || extracted.timeline || '';

  // Positive intent indicators
  const hasPositiveIntent =
    checkIsPositive(userText) ||
    checkIsPositive(fullConversation) ||
    Boolean(mergedInterest && !mergedInterest.toLowerCase().includes('not interested')) ||
    Boolean(mergedPropertyType) ||
    Boolean(mergedBudget);

  // Negative intent indicators - Ensure we don't trigger false negative if user asks for specific property (e.g. "I don't need a flat, I want a villa")
  const rawNegative = checkIsNotInterested(userText);
  const isExplicitNotInterested =
    (rawNegative && !mergedPropertyType && !mergedBudget) ||
    mergedInterest.toLowerCase().includes('not interested') ||
    mergedInterest.toLowerCase().includes('வேண்டாம்') ||
    mergedInterest.toLowerCase().includes('ஆர்வம் இல்லை');

  // Count answered slots
  let answeredSlots = 0;
  if (mergedInterest && !isExplicitNotInterested) answeredSlots++;
  if (mergedBuyerType) answeredSlots++;
  if (mergedPropertyType) answeredSlots++;
  if (mergedBudget) answeredSlots++;
  if (mergedTimeline) answeredSlots++;
  if (mergedLocation) answeredSlots++;

  const hasBudget = Boolean(mergedBudget && mergedBudget.trim().length > 1);
  const hasPropertyType = Boolean(mergedPropertyType && mergedPropertyType.trim().length > 1);

  // Timeline within 6 months check
  const tl = (mergedTimeline || '').toLowerCase();
  const isTimelineWithin6Months =
    tl.includes('immediate') ||
    tl.includes('ready') ||
    tl.includes('30') ||
    tl.includes('60') ||
    tl.includes('days') ||
    tl.includes('1 month') ||
    tl.includes('2 month') ||
    tl.includes('3 month') ||
    tl.includes('4 month') ||
    tl.includes('5 month') ||
    tl.includes('6 month') ||
    tl.includes('soon') ||
    tl.includes('now') ||
    tl.includes('quarter') ||
    tl.includes('உடனே') ||
    tl.includes('1 மாச') ||
    tl.includes('2 மாச') ||
    tl.includes('3 மாச') ||
    tl.includes('அடுத்த மாசம்');

  // Determine sentiment
  let sentiment: 'positive' | 'negative' | 'neutral' | 'opt_out' = 'neutral';
  if (isExplicitNotInterested) {
    sentiment = 'negative';
  } else if (hasPositiveIntent || answeredSlots >= 1) {
    sentiment = 'positive';
  }

  // -------------------------------------------------------------
  // Deterministic Evaluation Logic
  // -------------------------------------------------------------
  let outcome: LeadOutcome = 'COLD';
  let nextAction = '';

  // Check 1: Explicitly Not Interested & No requirement
  if (isExplicitNotInterested && !hasPropertyType && !hasBudget) {
    outcome = 'COLD';
    nextAction = 'Archive lead or enroll into inactive nurture list.';
  }
  // Check 2: Explicit AI Flag from Gemini Live toolCall
  else if (leadData.qualification_status === 'HOT') {
    outcome = 'HOT';
    nextAction = 'Immediate Senior Sales Agent callback with curated project inventory.';
  } else if (leadData.qualification_status === 'WARM') {
    outcome = 'WARM';
    nextAction = 'Follow-up via WhatsApp brochure & scheduled callback in 2-3 weeks.';
  }
  // Check 3: HOT Lead
  // Criteria:
  // - High positive purchase intent AND
  //   (Has verified Budget AND (hasPropertyType || isTimelineWithin6Months || Boolean(mergedLocation))) OR
  //   (hasPropertyType AND (isTimelineWithin6Months || hasBudget)) OR
  //   (answeredSlots >= 3)
  else if (
    sentiment === 'positive' &&
    (
      (hasBudget && (hasPropertyType || isTimelineWithin6Months || Boolean(mergedLocation))) ||
      (hasPropertyType && (isTimelineWithin6Months || hasBudget)) ||
      answeredSlots >= 3
    )
  ) {
    outcome = 'HOT';
    nextAction = 'Immediate Senior Sales Agent callback with curated project inventory.';
  }
  // Check 4: WARM Lead
  // Criteria:
  // - Positive or receptive interest
  // - Answered at least 1 qualification slot (e.g. gave property type, or location, or general budget, or exploratory interest)
  else if (
    sentiment === 'positive' ||
    hasPropertyType ||
    hasBudget ||
    mergedLocation ||
    answeredSlots >= 1
  ) {
    outcome = 'WARM';
    nextAction = 'Follow-up via WhatsApp brochure & scheduled callback in 2-3 weeks.';
  }
  // Check 5: Default COLD
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
      isExplicitNotInterested ? 'stated not interested' : `${answeredSlots}/5 slots provided`
    }).`;
  }

  // Build resolved extractedLeadData to return back to caller
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

/**
 * calculateDeterministicLeadScore — Transparent, rule-based 100-point scoring.
 * Evaluates: Purchase Timeline (25), Budget Clarity (25), Property Specificity (20),
 * Decision Readiness (15), and Willingness to Take Next Step (15).
 */
export function calculateDeterministicLeadScore(
  data: Partial<LeadData> | Record<string, any>,
  transcriptText: string = ''
): import('../types/agent').LeadScoreBreakdown {
  const factors: import('../types/agent').LeadScoreFactor[] = [];
  const reasons: string[] = [];
  const missingInformation: string[] = [];

  const raw = { ...data };
  const combinedText = `${transcriptText} ${JSON.stringify(raw)}`.toLowerCase();

  // 1. Purchase Timeline (Max 25 pts)
  let timelinePts = 0;
  let timelineReason = '';
  const tl = (raw.timeline || '').toLowerCase();

  if (tl.includes('immediate') || tl.includes('ready') || tl.includes('30') || combinedText.includes('immediate') || combinedText.includes('ready to move') || combinedText.includes('உடனே')) {
    timelinePts = 25;
    timelineReason = 'Urgent / Immediate timeline (within 30 days)';
    reasons.push('High urgency: Looking to purchase immediately (+25 pts)');
  } else if (tl.includes('1') || tl.includes('2') || tl.includes('3') || tl.includes('60') || combinedText.includes('2 months') || combinedText.includes('3 months') || combinedText.includes('அடுத்த')) {
    timelinePts = 20;
    timelineReason = 'Active short-term timeline (1 to 3 months)';
    reasons.push('Active timeline: Target purchase within 1-3 months (+20 pts)');
  } else if (tl.includes('6') || combinedText.includes('6 months')) {
    timelinePts = 10;
    timelineReason = 'Medium-term horizon (3 to 6 months)';
    reasons.push('Medium-term horizon: 3 to 6 months (+10 pts)');
  } else if (tl.includes('flexible') || tl.includes('year') || combinedText.includes('flexible')) {
    timelinePts = 5;
    timelineReason = 'Exploratory / Flexible timeline (> 6 months)';
    reasons.push('Exploratory timeline: Greater than 6 months (+5 pts)');
  } else {
    timelinePts = 0;
    timelineReason = 'Purchase timeline unstated';
    missingInformation.push('Purchase timeline (e.g. immediate, 1-3 months)');
  }

  factors.push({
    factor: 'Purchase Timeline',
    points: timelinePts,
    maxPoints: 25,
    reason: timelineReason,
  });

  // 2. Budget Clarity (Max 25 pts)
  let budgetPts = 0;
  let budgetReason = '';
  const bg = (raw.budget || '').trim();

  if (bg && (bg.includes('cr') || bg.includes('lakh') || bg.includes('m') || bg.includes('aed') || bg.includes('inr') || /\d/.test(bg))) {
    budgetPts = 25;
    budgetReason = `Verified stated budget: ${bg}`;
    reasons.push(`Clear budget stated: ${bg} (+25 pts)`);
  } else if (combinedText.includes('crore') || combinedText.includes('lakh') || combinedText.includes('million') || combinedText.includes('aed')) {
    budgetPts = 18;
    budgetReason = 'Conversational budget range detected';
    reasons.push('Ballpark budget range mentioned in discussion (+18 pts)');
  } else {
    budgetPts = 0;
    budgetReason = 'No clear budget stated yet';
    missingInformation.push('Budget & currency range (e.g. ₹1.5 Cr, AED 1.8M)');
  }

  factors.push({
    factor: 'Budget Clarity',
    points: budgetPts,
    maxPoints: 25,
    reason: budgetReason,
  });

  // 3. Property Specificity (Max 20 pts)
  let propPts = 0;
  let propReason = '';
  const hasLoc = Boolean(raw.location && String(raw.location).trim().length > 1);
  const hasType = Boolean(raw.property_type && String(raw.property_type).trim().length > 1);

  if (hasLoc && hasType) {
    propPts = 20;
    propReason = `Explicit property type (${raw.property_type}) and locality (${raw.location})`;
    reasons.push(`Targeted requirement: ${raw.property_type} in ${raw.location} (+20 pts)`);
  } else if (hasLoc || hasType) {
    propPts = 10;
    propReason = hasLoc ? `Location specified (${raw.location})` : `Property type specified (${raw.property_type})`;
    reasons.push(`Partial property requirement identified (+10 pts)`);
    if (!hasLoc) missingInformation.push('Preferred location/locality');
    if (!hasType) missingInformation.push('Property type (apartment, villa, plot, etc.)');
  } else {
    propPts = 0;
    propReason = 'No location or property type identified';
    missingInformation.push('Location and property type preferences');
  }

  factors.push({
    factor: 'Property Specificity',
    points: propPts,
    maxPoints: 20,
    reason: propReason,
  });

  // 4. Decision Readiness (Max 15 pts)
  let decisionPts = 0;
  let decisionReason = '';
  const bt = (raw.buyer_type || '').toLowerCase();

  if (bt.includes('investor') || combinedText.includes('invest') || combinedText.includes('cash ready') || combinedText.includes('pre-approved')) {
    decisionPts = 15;
    decisionReason = 'Active investor or pre-qualified capital';
    reasons.push('High decision readiness: Verified investor profile (+15 pts)');
  } else if (bt.includes('first-time') || bt.includes('family') || bt.includes('buyer')) {
    decisionPts = 10;
    decisionReason = 'Genuine primary homebuyer / end-user';
    reasons.push('Active homebuyer looking for personal use (+10 pts)');
  } else if (combinedText.includes('looking') || combinedText.includes('buying')) {
    decisionPts = 5;
    decisionReason = 'Early discovery / browsing stage';
    reasons.push('Early discovery stage (+5 pts)');
  } else {
    decisionPts = 0;
    decisionReason = 'Buyer profile unconfirmed';
    missingInformation.push('Buyer profile (investor, first-time buyer, upgrading family)');
  }

  factors.push({
    factor: 'Decision Readiness',
    points: decisionPts,
    maxPoints: 15,
    reason: decisionReason,
  });

  // 5. Willingness to Take Next Step (Max 15 pts)
  let nextStepPts = 0;
  let nextStepReason = '';

  if (combinedText.includes('site visit') || combinedText.includes('viewing') || combinedText.includes('visit') || combinedText.includes('appointment')) {
    nextStepPts = 15;
    nextStepReason = 'Agreed to site viewing / appointment booking';
    reasons.push('High engagement: Requested site viewing (+15 pts)');
  } else if (combinedText.includes('call back') || combinedText.includes('whatsapp') || combinedText.includes('brochure') || (raw.phone && String(raw.phone).length >= 10)) {
    nextStepPts = 10;
    nextStepReason = 'Provided contact info for follow-up documentation';
    reasons.push('Provided verified contact details (+10 pts)');
  } else {
    nextStepPts = 0;
    nextStepReason = 'No follow-up action agreed yet';
    missingInformation.push('Contact phone / WhatsApp for brochure sharing');
  }

  factors.push({
    factor: 'Next Step Willingness',
    points: nextStepPts,
    maxPoints: 15,
    reason: nextStepReason,
  });

  // Total Score Calculation
  const totalScore = Math.min(100, timelinePts + budgetPts + propPts + decisionPts + nextStepPts);

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
    nextAction = 'Low Priority: Add to monthly newsletter and automated market insights drip.';
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

