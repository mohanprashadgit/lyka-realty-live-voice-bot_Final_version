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

export function detectUnwantedSpeech(raw: string): boolean {
  const text = (raw || '').trim();
  if (!text) return false;
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
