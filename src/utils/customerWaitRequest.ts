/**
 * Detects a customer's explicit request for waiting time during a live call.
 *
 * When the customer asks for a pause ("One minute", "konjam wait pannunga",
 * "let me think", "Wait", Hindi "ek minute", Arabic "dakika wahida", ...), the
 * silence follow-up mechanism must go quiet for the requested period instead of
 * repeatedly asking "line-la irukeengala?" while the customer is thinking,
 * checking something or speaking to someone nearby.
 *
 * Intentionally a narrow phrase matcher (not a generic keyword scan): a false
 * positive merely suspends gentle connection check-ins for one window, and the
 * phrases below are common spoken requests in all supported call languages
 * (Tanglish, Tamil script, English, Hindi and Arabic).
 *
 * Pure function — no session, network or state dependencies.
 */

const WAIT_REQUEST_PATTERNS: RegExp[] = [
  // ── Tanglish / Tamil (Latin script) ──
  /\bkonjam\s+(?:wait|nim(?:i)?sham|nimadi|time)\b/i, // konjam wait / konjam time
  /\bwait\s+(?:pannu(?:nga|nku|ru|ringa|renga|ra)?|irunga|irukka|please|pls|nga|sir|madam)/i, // wait pannunga / wait please
  /\bpannu(?:nga|nku|ru|ringa|renga|ra)?\s+(?:wait|waite?)(?:-?ah)?\b/i, // pannunga wait
  /\boru\s+nim(?:i)?sham\b/i, // oru nimisham = one moment
  // "one minute"-style: anchored so a property timeline ("flat one minute-la
  // venum") does not read as a pause request.
  /(?:^|[,.!?;]\s*|\b(?:ok(?:ay)?|hello|hi|sorry|sir|madam|nga|seri|stop|just|na)\s+)(?:one|oru)\s+(?:minute|min\b|second|moment|nimisham|nimadi)\b/i, // one minute (at phrase start / greeting / polite prefix)
  /\b(?:me|na)\s+one\s+(?:minute|second|moment)\b/i, // give me one minute
  /\b(?:konjam\s+)?time\s+kudunga\b/i, // konjam time kudunga = give me time
  /\btime\s+venum\b/i, // time venum = need time
  /\b(?:yosikko|yosikkiren|think\s+pannittu)\b/i, // thinking about it
  /\bwaite?(?:-?ah)?\b[\s.,!]*$/i, // utterance ends with a bare "wait" / "wait ah"

  // ── English ──
  /\blet\s+me\s+(?:think|check|see|ask|finish|complete|do|tell|decide|verify|confirm)/i, // let me think ...
  /\b(?:just|only)\s+(?:a|one)\s+(?:minute|second|moment)/i, // just a minute
  /\bgive\s+me\s+(?:a|one|some)\s+(?:minute|second|moment|while|time)/i, // give me a minute
  /\bhold\s+on\b/i, // hold on
  /\bi\s+need\s+(?:some\s+|more\s+)?(?:time|a\s+(?:minute|moment|second))/i, // need some time
  /\bwait\b[\s.,!]*$/i, // bare trailing "wait"
  /\bstand\s?by\b/i, // stand by

  // ── Tamil script ──
  /ஒரு\s*நிமிடம்/, // oru nimidam (one minute)
  /காத்திரு/, // kaathiru / kaathirunga (wait)
  /கொஞ்சம்\s*(?:டைம்|நேரம்)/, // konjam time / konjam neram
  /வெயிட்/, // transliterated "wait"
  /ஒன்னு\s*மினிட்?/, // onnu minit (one minute)

  // ── Hindi (Latin transliteration + Devanagari) ──
  /\b(?:ek|do|teen)\s+(?:minute|min\b|second)/i, // ek minute / ek second
  /\b(?:thodi|thoda|zara)\s+(?:der|dheer|ruk)/i, // thodi der / zara rukiye
  /\bmujhe\s+(?:thoda|thodi|kuch)?\s*(?:der|time|waqt)\b/i, // mujhe thoda time
  /\binteza?ar\b/i, // intezaar (wait)
  /एक\s*मिनिट?(?:े)?/, /एक\s*मिनट/, // ek minute
  /थोड़ी?\s*देर/, /थोड़ा\s*रुक/, /इंतज़ा?र/, /रुकिए/, // thodi der / ruk jaiye / intezar

  // ── Arabic (script + common transliterations) ──
  /دقيقة\s*واحدة/, // dakika wahida (one minute)
  /انتظر/, /اسنني/, /ثانية\s*واحدة/, // intathir / ismenni / thania wahida
  /\b(?:istanna|istannid|intathir|dakika)\b/i, // transliterations
];

/**
 * Utterances that may contain the word "wait" but are NOT a pause request
 * ("I can't wait to see the site", "don't make me wait so long", ...).
 */
const WAIT_NON_REQUEST: RegExp[] = [
  /\b(?:can'?t|cannot|can not|no longer|never)\s+(?:wait|waite)/i,
  /(?:make|making|keeps?|kept)\s+(?:me|us|him|her|them|people)\s+(?:wait|waite?ing)/i,
  /\b(?:long|endless|too much)\s+wait\b/i,
];

/**
 * True when the customer explicitly asks for a pause / waiting time.
 * Designed for finalized voice transcripts received from the live ASR.
 */
export function customerAskedForWait(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const raw = text.trim();
  if (!raw || raw.length > 220) return false; // lengthy utterances are conversations, not pause requests
  if (WAIT_NON_REQUEST.some((pattern) => pattern.test(raw))) return false;
  return WAIT_REQUEST_PATTERNS.some((pattern) => pattern.test(raw));
}
