/**
 * Detects whether an agent utterance is meant to end the call.
 *
 * The detector reads the final transcript of an agent turn (English, Tamil
 * script or Tanglish) instead of matching one exact sentence. Questions,
 * negations and mid-conversation closings are rejected so the agent can talk
 * about ending the call without actually ending it.
 */

const HARD_FAREWELLS: RegExp[] = [
  /\bgood\s*bye\b/,
  /\bbye(?:\s+bye)?\b/,
];

const SOFT_FAREWELLS: RegExp[] = [
  /\bsee you (?:later|soon|around|next time)\b/,
  /\b(?:have|having) a (?:nice|great|good|wonderful|lovely) (?:day|evening|week|weekend|one)\b/,
  /\b(?:thanks|thank you)(?: so much| very much)? for (?:speaking|talking|calling) (?:with|to) (?:us|me|lyka)\b/,
  /\b(?:thanks|thank you) for the call\b/,
  /\bgood night\b/,
];

const END_VERB = String.raw`(?:end|ending|close|closing|disconnect|disconnecting|hang\s*up|hanging\s*up|cut|cutting)`;
const CALL_NOUN = String.raw`(?:call|phone|line|connection)`;

const END_CALL_STATEMENTS: RegExp[] = [
  new RegExp(String.raw`\b(?:i|i'?ll|i'?m|i am|i will|we|we'?ll|we'?re|we are|let me)\b(?:\s+\w+){0,3}\s+${END_VERB}\b(?:\s+\w+){0,3}\s+${CALL_NOUN}\b`),
  new RegExp(String.raw`\b${END_VERB}\b(?:\s+\w+){0,3}\s+${CALL_NOUN}\b`),
  new RegExp(String.raw`\b${CALL_NOUN}\b(?:\s+\w+){0,3}\s+(?:is|will be|has been|can be|should be|must be)\s+(?:now\s+)?(?:ended|ending|closed|closing|disconnected|disconnecting|cut)\b`),
  new RegExp(String.raw`\b(?:i'?ll|i will|let me)\s+(?:let you go|leave you|stop here|end it here)\b`),
];

const TANGLISH_END_VERB = String.raw`(?:end|cut|close|disconnect|mudich\w*|mudik\w*)`;
const TANGLISH_PERSON = String.raw`(?:naan|nan|naa|panren|pannuren|pannraen|panniduren|panniduven|pannikiren|pannitten|panniten|pannu|pannunga|pannidunga|pannikonga|pannalam|pannalaam|pannidalam|pannikalam|pannuvom|panni\s+viduren|panni\s+viduven|viduren|viduven)`;
const TANGLISH_SELF_END = String.raw`(?:mudichiduren|mudichuren|mudichiduven|mudichitten|mudichiten|mudikkiren|mudikiren|mudichuvom|mudichiduvom|mudichidalam|mudikkalam|mudichu)`;

const TANGLISH_END_STATEMENTS: RegExp[] = [
  new RegExp(String.raw`\b(?:call|phone|line)\b(?:\s+\w+){0,4}\s+${TANGLISH_END_VERB}\b(?:\s+\w+){0,4}\s+${TANGLISH_PERSON}\b`),
  new RegExp(String.raw`\b${TANGLISH_PERSON}\b(?:\s+\w+){0,4}\s+(?:call|phone|line)\b(?:\s+\w+){0,4}\s+${TANGLISH_END_VERB}\b`),
  new RegExp(String.raw`\b(?:call|phone|line)\b(?:\s+\w+){0,4}\s+${TANGLISH_SELF_END}\b`),
];

const TAMIL_CALL_END_STATEMENTS: RegExp[] = [
  /(?:கால்|கால|காலை|போன்|லைன்)[\s\S]{0,30}(?:எண்ட்|என்ட்|கட்|முடிக்க|முடிச்சு|முடிச்சிட|வெட்ட|நிறுத்த)/,
  /(?:எண்ட்|என்ட்|கட்|முடிக்க|முடிச்சு|முடிச்சிட|வெட்ட|நிறுத்த)[\s\S]{0,30}(?:கால்|கால|காலை|போன்|லைன்)/,
];

const WEAK_CLOSINGS: RegExp[] = [
  /\b(?:that'?s|that is|this is) all (?:for (?:today|now)|from my side|then)\b/,
  /\b(?:talk|speak|chat|catch up) (?:to|with) you (?:later|soon|tomorrow|next time|again)\b/,
  /\bnice (?:talking|speaking) (?:to|with) you\b/,
  /\b(?:i'?ll|i will|let me) (?:let you go|leave you|stop here|end it here)\b/,
  /\b(?:thanks|thank you)(?: so much| very much)? for (?:your time|your patience|your interest|speaking|talking|calling|the call|today)\b/,
  /\btake care\b(?!\s+of\b)/,
  /\ball the best\b/,
  /\bbest of luck\b/,
  /\b(?:i'?ll|i will) (?:call|message|text|whatsapp) you (?:later|soon|back)\b/,
  /\b(?:we'?ll|we will|i'?ll|i will) (?:be in touch|talk soon)\b/,
  /\bkeep in touch\b/,
  /\b(?:our|my) team will (?:contact|call|reach out to) you (?:soon|shortly|later)\b/,
  /\b(?:appuram|aprom|apram|pinnadi|pinnaadi|naalaikku|naalai|nalaikku|nalikku) (?:pesalam|pesuvom)\b/,
  /\b(?:poi|poitu|poittu|poytu|pondu) (?:varen|varren|vaaren|varom)\b/,
  /\b(?:naan\s+)?(?:kilamburen|kilambren|kilambitten|kilambiten|kelamburen|kelambren)\b/,
  /(?:போய்|போய்விட்டு)\s*(?:வருகிறேன்|வரேன்|வருவேன்|வர்றேன்)/,
  /(?:அப்புறம்|பிறகு|நாளைக்கு|நாளை|அடுத்ததா)\s*(?:பேசலாம்|பேசுவோம்|பேசாலாம்)/,
  /(?:நான்\s*)?(?:கிளம்புகிறேன்|கிளம்புறேன்|புறப்படுகிறேன்|புறப்படுறேன்)/,
];

const HARD_NEGATIONS: RegExp[] = [
  /\b(?:do not|don'?t|dont|never|not|won'?t|wont|wouldn'?t|wouldnt|shouldn'?t|shouldnt|can'?t|cannot)\s+(?:ever\s+)?(?:end|close|disconnect|hang\s*up|cut)\b/,
  /\b(?:do not|don'?t|dont|never|won'?t|wont|wouldn'?t|wouldnt|shouldn'?t|shouldnt|can'?t|cannot)\s+(?:want|wish|need|have|intend|plan|mean)\s+to\s+(?:end|close|disconnect|hang\s*up|cut)\b/,
  /\bnot\s+(?:going|planning|ready)\s+to\s+(?:end|close|disconnect|hang\s*up|cut)\b/,
  /\bnot\s+(?:the\s+)?(?:end|ending|close|closing)\s+(?:of\s+)?(?:the\s+|this\s+|our\s+)?(?:call|phone|line)\b/,
  /\bno need to (?:end|close|disconnect|hang\s*up|cut)\b/,
  /\bnot necessary to (?:end|close|disconnect|hang\s*up|cut)\b/,
  /\b(?:do not|don'?t|dont|never)\s+(?:say|saying)\s+(?:goodbye|good\s*bye|bye)\b/,
  /\bbefore (?:i|we) (?:end|go|disconnect|hang\s*up|leave)\b/,
  /\bwhy (?:should|would) (?:i|we) (?:end|close|disconnect|hang\s*up)\b/,
  /\b(?:call|phone|line)\b(?:\s+\w+){0,4}\s+(?:end|cut|close|disconnect)(?:\s+\w+){0,3}\s+(?:vendaam|vendam|venda|pannatheenga|pannadheenga|pannaadheenga|pannakoodathu|illa|illai)\b/,
  /\b(?:end|cut|close|disconnect)\b(?:\s+\w+){0,3}\s+(?:vendaam|vendam|pannatheenga|pannadheenga|pannaadheenga|pannakoodathu|illa|illai)\b/,
  /(?:முடிக்க|முடிச்சு|முடிச்சிட|எண்ட்|என்ட்|கட்|வெட்ட|நிறுத்த)[\s\S]{0,24}(?:வேண்டாம்|வேண்டாங்|பண்ணாதீங்க|பண்ணவேண்டாம்|பண்ணவேணாம்|இல்லை|மாட்டேன்)/,
  /(?:வேண்டாம்|பண்ணாதீங்க|பண்ணவேண்டாம்|மாட்டேன்)[\s\S]{0,24}(?:முடிக்க|முடிச்சு|எண்ட்|என்ட்|கட்|வெட்ட|நிறுத்த)/,
];

const SOFT_PAUSES: RegExp[] = [
  /\b(?:wait|hold on|one moment|just a (?:minute|second|moment)|give me a (?:minute|second|moment))\b/,
  /\bnot (?:yet|now)\b/,
];

const PERMISSION_QUESTIONS: RegExp[] = [
  new RegExp(String.raw`\b(?:shall|should|may|can|could)\s+(?:i|we|you)\b(?:\s+\w+){0,4}\s+(?:end|ending|close|closing|disconnect|hang\s*up|cut)\b`),
  new RegExp(String.raw`\b(?:shall|should|may|can|could)\s+(?:i|we|you)\b(?:\s+\w+){0,5}\s+${CALL_NOUN}\b`),
  new RegExp(String.raw`\b(?:do you want|would you like|is it (?:ok|okay)|ok(?:ay)? to|do we|shall we)(?:\s+\w+){0,5}\s+(?:end|ending|close|closing|disconnect|hang\s*up|cut)\b`),
  /\b(?:do you want|would you like)\s+me\s+to\b/,
  /\b(?:shall|should|may|can|could)\s+(?:i|we)\s+(?:say|wish)\s+(?:goodbye|good\s*bye|bye)\b/,
  /\b(?:pannalama|pannalaama|pannalamaa|pannattuma|pannatuma|pannattumaa|mudikkalama|mudikkalaama|mudikkattuma)\b/,
  /(?:முடிக்கலாமா|முடிக்கலாம்|முடிக்கட்டுமா|பண்ணலாமா|பண்ணட்டுமா|பண்ணலாம்|வேண்டுமா)/,
];

const CONTINUATIONS = /\b(?:but|however|although|though|first|before|let me|let's|i need|i want|we need|we want|i have|we have|can you|could you|would you|will you|please|shall|should|do you|are you|is there|would you like|what|which|when|where|how|why|who|okay so|so we|so i|also|another|one more|any (?:other )?questions|aana|aanal|innum|mudhalla|mudhalil)\b|(?:ஆனால்|இன்னும்|முதலில்|முதல்ல|முன்னாடி)/;

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'")
    .replace(/-+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}?'\s.]/gu, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastMatchEnd(text: string, patterns: RegExp[]): number {
  let end = -1;
  for (const pattern of patterns) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    let match: RegExpExecArray | null;
    while ((match = global.exec(text))) {
      end = Math.max(end, match.index + match[0].length);
      if (!match[0].length) global.lastIndex += 1;
    }
  }
  return end;
}

function hasTamilByeToken(text: string): boolean {
  if (/(?:குட்\s*பை|பை\s*பை|பைபை)/.test(text)) return true;
  return text.split(/[^\p{L}\p{M}\p{N}]+/u).includes('பை');
}

function isPermissionQuestion(text: string): boolean {
  return PERMISSION_QUESTIONS.some(pattern => pattern.test(text));
}

export function detectCallEndingIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const tail = normalized.slice(-320);
  const hardFarewell = HARD_FAREWELLS.some(pattern => pattern.test(normalized)) || hasTamilByeToken(normalized);
  const softFarewellEnd = lastMatchEnd(normalized, SOFT_FAREWELLS);
  const explicitEnd = Math.max(
    lastMatchEnd(normalized, END_CALL_STATEMENTS),
    lastMatchEnd(normalized, TANGLISH_END_STATEMENTS),
    lastMatchEnd(normalized, TAMIL_CALL_END_STATEMENTS)
  );
  const weakEnd = lastMatchEnd(tail, WEAK_CLOSINGS);

  if (!hardFarewell && softFarewellEnd < 0 && explicitEnd < 0 && weakEnd < 0) return false;

  if (HARD_NEGATIONS.some(pattern => pattern.test(normalized))) return false;
  if (isPermissionQuestion(normalized)) return false;
  if (softFarewellEnd >= 0 && /\b(?:not yet|not now)\b/.test(normalized)) return false;
  if (!hardFarewell && SOFT_PAUSES.some(pattern => pattern.test(normalized))) return false;

  // A closing that is followed by another question or a "but first..." continuation
  // is not the end of the conversation yet.
  if (!hardFarewell) {
    const closingEnd = Math.max(
      softFarewellEnd,
      explicitEnd,
      weakEnd >= 0 ? normalized.length - tail.length + weakEnd : -1
    );
    if (closingEnd >= 0) {
      const after = normalized.slice(closingEnd).trim();
      if (/[?]\s*$/.test(normalized) || CONTINUATIONS.test(after)) return false;
    }
  }

  return true;
}
