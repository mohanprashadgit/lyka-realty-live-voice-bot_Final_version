/**
 * Detects romantic / flirtatious / personal remarks aimed at the agent.
 * Property talk such as "I love this project" or "I like the view" must NOT match,
 * but a romantic remark must still count when the same sentence mentions property
 * details ("3BHK in Dubai Marina ... I love you").
 */
const UNWANTED_SPEECH_PATTERNS: RegExp[] = [
  // English
  /\b(?:love|like)\s+(?:you|u)\b(?!\s+to\b)/i,
  /\b(?:i'?m|i\s+am)\s+(?:in\s+love\s+with\s+you|falling\s+for\s+you)\b/i,
  /\b(?:i'?m|i\s+am)\s+in\s+love\s+with\s+(?:her|him)\b/i,
  /\b(?:i|naan|na)\s+(?:really\s+|romba\s+)?love\s+(?:her|him|ava|avan)\b/i,
  /\b(?:i\s+have\s+a\s+crush\s+on\s+you|crush\s+on\s+you)\b/i,
  /\b(?:you'?re|you\s+are)\s+(?:so\s+|really\s+|very\s+)?(?:beautiful|pretty|cute|hot|sexy|gorgeous|charming|lovely)\b/i,
  /\b(?:i|we)\s+(?:will|would|want\s+to|wanna|can|could|shall|am\s+going\s+to)\s+(?:marry|date|kiss|hug)\s+(?:you|u)\b/i,
  /\b(?:can|could|may)\s+i\s+(?:marry|date|kiss|hug)\s+(?:you|u)\b/i,
  /\b(?:marry|date|kiss|hug)\s+me\b/i,
  /\b(?:let'?s|can\s+we)\s+(?:kiss|date|marry)\b/i,
  /\b(?:be|become)\s+my\s+(?:girlfriend|boyfriend|wife|husband|valentine)\b/i,
  /\b(?:i\s+(?:want|need)\s+you)\b(?!\s+to\b)/i,
  /\b(?:miss\s+you|thinking\s+of\s+you)\b/i,
  /\b(?:you\s+are|you'?re)\s+my\s+(?:everything|life|love|world)\b/i,
  /\b(?:can'?t|cannot)\s+live\s+without\s+you\b/i,
  /\b(?:send|share|kudu)\b[\s\S]{0,20}\b(?:your|ur)\s+(?:photo|picture)\b/i,
  /\b(?:your|ur)\s+(?:photo|picture)\b[\s\S]{0,15}\b(?:please|kudu|send|share)\b/i,
  // Tanglish
  /\b(?:naan|na)\s+(?:unga|ungal|ungalai|unna|unne|unnai)\s+(?:romba\s+)?(?:love|like)\s+(?:panren|panrean|pannuren|pannran|pannuven)\b/i,
  /\b(?:unga|ungal|ungalai|unna|unne|unnai)\s+(?:romba\s+)?(?:love|like)\s+(?:panren|panrean|pannuren|pannran|pannuven)\b/i,
  /\b(?:en|un)\s+(?:girlfriend|boyfriend)\s+(?:aava|aavala|aagalaam)\b/i,
  /\b(?:unna|unnai)\s+(?:kalyanam|kiss|hug)\b/i,
  /\b(?:kalyanam|kiss)\s+(?:pannikalaam|pannalama|pannalaam)\b/i,
  // Tamil script
  /(?:உங்களை|உங்கள|உங்கள்|உங்களுக்கு|உன்னை|உன்ன|உனக்கு)\s*(?:ரொம்ப\s*|நல்லா\s*)?(?:காதலிக்கிறேன்|விரும்புகிறேன்|காதல்|லவ்)/,
  /(?:என்னை|எனக்கு)\s*(?:காதலிக்கிறாயா|காதலிக்கிறீங்களா|காதல்|லவ்)/,
  /(?:உன்னை|உன்ன)\s*(?:கல்யாணம்|கிஸ்)/,
  /(?:என்|உன்)\s*(?:கேர்ள்ஃபிரண்ட்|பாய்ஃபிரண்ட்)/,
];

/**
 * Detects whether the speech is related to property / real estate inquiries.
 * If true, normal real estate inquiries must not be treated as unrelated.
 */
export function isPropertyRelatedSpeech(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    /\b(?:property|project|apartment|flat|villa|plot|house|land|home|veedu|veetu|bhk|sqft|cents|grounds|acres)\b/i.test(t) ||
    /\b(?:buy|buying|rent|renting|invest|investing|lease|resale|vaanga|vaadagai|muthaleedu|sell)\b/i.test(t) ||
    /\b(?:budget|price|rate|cost|lakh|lakhs|crore|crores|cr|million|aed|dirham|dirhams|inr|rupee|rupees)\b/i.test(t) ||
    /\b(?:omr|ecr|chennai|dubai|bangalore|coimbatore|madurai|trichy|thoothukudi|location|area|locality)\b/i.test(t) ||
    /\b(?:site\s*visit|brochure|whatsapp|catalog|rera|cmda|dtcp|patta|chitta|ec|loan|advance|down\s*payment)\b/i.test(t) ||
    /\b(?:ready\s*to\s*move|under\s*construction|handover|timeline|1\s*month|3\s*months|next\s*month)\b/i.test(t) ||
    /\b(?:commercial|residential|gated\s*community|penthouse|duplex)\b/i.test(t)
  );
}

/**
 * Detects off-topic / unrelated requests (jokes, singing, poems, cooking, weather, politics, non-property banter).
 */
export function detectUnrelatedSpeech(raw: string): boolean {
  const text = (raw || '').trim();
  if (!text) return false;
  if (isPropertyRelatedSpeech(text)) return false;

  const t = text.toLowerCase();

  // Jokes, stories, entertainment, singing, riddles
  if (/\b(?:joke|jokes|story|kadhai|song|paatu|paattu|sing|dance|poem|kavithai|riddle)\b/i.test(t)) return true;

  // Personal queries about the representative / eating / sleeping / dressing
  if (/\b(?:sapteengala|sapteengla|lunch\s*aacha|dinner\s*aacha|breakfast\s*aacha|what\s*did\s*you\s*eat|enna\s*saapda|what\s*are\s*you\s*eating)\b/i.test(t)) return true;
  if (/\b(?:what\s*are\s*you\s*wearing|enna\s*dress|where\s*do\s*you\s*live|where\s*are\s*you\s*sleeping|sleeping)\b/i.test(t)) return true;

  // Movies, cricket, sports, celebrities
  if (/\b(?:cricket|ipl|football|match\s*score|cinema|movie|actor|hero|actress|rajini|kamal|vijay|ajith)\b/i.test(t)) return true;

  // Weather, politics, cooking recipes
  if (/\b(?:weather|climate|rain|mazhai|recipe|biryani|cooking|tea|coffee|sollu|politics|election|modi|stalin)\b/i.test(t)) return true;

  // Repetitive "what are you doing" / "who are you" with no property context
  if (/^(?:who\s*are\s*you|neenga\s*yaar|neenga\s*yar|enna\s*panreenga|what\s*are\s*you\s*doing)[.!?\s]*$/i.test(t)) return true;

  return false;
}

export function detectUnwantedSpeech(raw: string): boolean {
  const text = (raw || '').trim();
  if (!text) return false;

  // Also catch unrelated queries (jokes, stories, songs, recipes, personal banter)
  if (detectUnrelatedSpeech(text)) return true;

  if (/^(?:please\s+)?(?:tell me (?:a joke|a story)|sing (?:me )?a song|write (?:me )?a poem|give me a recipe)[.!?\s]*$/i.test(text)) return true;
  // "You're nice / you are so sweet" only counts as a complete short remark,
  // so a genuine "you are nice for helping" does not trigger a warning.
  const compact = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:you'?re|you are|your)\s+(?:so\s+|really\s+|very\s+)?(?:nice|sweet)$/.test(compact)) return true;
  return UNWANTED_SPEECH_PATTERNS.some((re) => re.test(text));
}
