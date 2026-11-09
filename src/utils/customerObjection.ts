/**
 * Meaning-based classifier for customer objections on a live sales call.
 *
 * Only genuine, direct rejections of the call or the property offer count.
 * Clarification questions, property preferences ("2BHK vendam, 3BHK venum"),
 * busy/callback replies and unrelated answers must stay neutral.
 */
export type ObjectionSignal = 'do_not_call' | 'rejection' | 'interest' | 'none';

const DO_NOT_CALL_PATTERNS: RegExp[] = [
  // English
  /\b(?:do\s+not|don'?t|never)\s+(?:ever\s+)?call\s+(?:me|us)\b/i,
  /\b(?:do\s+not|don'?t)\s+call\s+(?:me\s+|us\s+)?(?:again|back|anymore|any\s+more)\b/i,
  /\bstop\s+(?:calling|phoning)\b/i,
  /\bno\s+(?:more|further)\s+calls\b/i,
  /\b(?:remove|delete)\s+(?:my|our)\s+(?:number|contact|details)\b/i,
  /\b(?:take|put)\s+(?:me|us)\s+(?:off|on)\s+(?:your|the)\s+(?:list|do[- ]not[- ]call)\b/i,
  /\bdo[- ]not[- ]call\b/i,
  /\bunsubscribe\b/i,
  // Tanglish
  /\b(?:call|phone)\s+(?:pannadhinga|pannadheenga|pannathinga|pannatheenga)\b/i,
  /\b(?:call|phone)\s+panna\s+(?:vendaam|vendam)\b/i,
  /\b(?:ini|innum|melum)\s+(?:call|phone)\s+(?:vendaam|vendam|pannadhinga|pannathinga)\b/i,
  /\b(?:en|engal)\s+(?:number|nambara|nambaru|contact)-?a?\s+(?:remove|delete)\s+(?:pannunga|pannu)\b/i,
  /\b(?:en\s*kitta|en\s*kitte|ennoda|ennodu)\s+pesa\s+(?:vendaam|vendam)\b/i,
  /^(?:pesa|pesu)\s+(?:vendaam|vendam)\s*(?:sir|ji)?\s*[.!]*$/i,
  /\bthodarbu\s+(?:vendaam|vendam)\b/i,
  // Tamil script
  /(?:அழைக்காதீர்கள்|அழைக்காதீங்க|கூப்பிடாதீர்கள்|கூப்பிடாதீங்க)/,
  /(?:தொந்தரவு\s*செய்யாதீர்கள்|தொந்தரவு\s*செய்யாதீங்க)/,
  /(?:என்\s*)?(?:எண்ணை|நம்பரை|தொடர்பை)\s*(?:நீக்குங்கள்|நீக்கவும்|அழிக்கவும்)/,
  /(?:இனி\s*)?(?:அழைக்க|கூப்பிட)\s*வேண்டாம்/,
];

const REJECTION_PATTERNS: RegExp[] = [
  // English
  /\b(?:i'?m|i\s+am|we'?re|we\s+are)\s+not\s+interested\b/i,
  /^not\s+interested\b/i,
  /\bnot\s+interested\b/i,
  /\b(?:i\s+)?(?:do\s+not|don'?t)\s+(?:want|need)\s+(?:this|it|anything|any\s+property|the\s+property|your\s+(?:offer|call|property|help))\b/i,
  /\b(?:i\s+)?(?:do\s+not|don'?t)\s+(?:want|need)\s+to\s+(?:buy|invest|purchase|talk|continue|hear|proceed)\b/i,
  /\bnot\s+(?:looking|searching)\s+for\s+(?:a\s+|any\s+)?(?:property|properties|flat|villa|plot|house|investment|anything)\b/i,
  /\b(?:i\s+)?(?:do\s+not|don'?t)\s+need\s+(?:a\s+|any\s+)?(?:property|investment|flat|villa|plot|house)\b/i,
  /\b(?:i'?m|i\s+am)\s+not\s+(?:buying|investing|purchasing)\b/i,
  /\bno\s+(?:need|thanks|thank\s+you)\b/i,
  /\b(?:no\s+i\s+said\s+no|i\s+said\s+no|i\s+already\s+said\s+no|no\s+means\s+no|no\s+no)\b/i,
  /\bnot\s+needed\b/i,
  /\b(?:end|cut|hang\s*up)\s+(?:the\s+)?call\b/i,
  /\b(?:call|phone)\s+(?:-a\s+)?(?:cut\s+pannunga|cut\s+pannu|cut\s+panu|mudiyunga|mudi)\b/i,
  // Tanglish
  /\b(?:enakku|enaku|engalukku|engaluku)\s+(?:\w+\s+){0,2}(?:interest\s+(?:illa|illai)|virumbala|vendaam|vendam|venda|thevai\s+illa|thevaiyilla)\b/i,
  /\b(?:naan|na|naanga)\s+(?:\w+\s+){0,2}(?:interest\s+(?:illa|illai)|virumbala|vendaam|vendam|venda|thevai\s+illa|thevaiyilla)\b/i,
  /^(?:vendaam|vendam|venda)\s*(?:sir|madam|ji)?\s*[.!]*$/i,
  /\b(?:idhu|ithu|intha\s+\w+|indha\s+\w+)\s+(?:enakku\s+)?(?:vendaam|vendam|venda)\b/i,
  /\binterest\s+(?:illa|illai)\b/i,
  // Tamil script
  /(?:எனக்கு|எங்களுக்கு)[^.!?\n]{0,40}(?:வேண்டாம்|வேணாம்|தேவை\s*இல்லை|தேவை\s*இல்ல|ஆர்வம்\s*இல்லை|ஆர்வம்\s*இல்ல|இன்ட்ரஸ்ட்\s*இல்ல)/,
  /(?:வேண்டாம்|வேணாம்|தேவையில்லை|தேவை\s*இல்ல)/,
  /(?:ஆர்வம்|இன்ட்ரஸ்ட்|விருப்பம்)\s*(?:இல்லை|இல்ல|கிடையாது)/,
  /(?:போனை|போன்)\s*(?:வச்சிருங்க|வைங்க|கட்\s*பண்ணுங்க|கட்\s*பண்ணிருங்க)/,
];

const INTEREST_PATTERNS: RegExp[] = [
  // English
  /\b(?:tell|show)\s+me\s+(?:more|something|the\s+details|details|options)\b/i,
  /\bmore\s+(?:details|information|info)\b/i,
  /\b(?:send|share)\s+(?:me\s+)?(?:the\s+)?(?:details|brochure|options|information)\b/i,
  /\bwhat\s+(?:properties|options|projects)\b/i,
  /\bwhat\s+do\s+you\s+have\b/i,
  /\b(?:i'?m|i\s+am)\s+interested\b/i,
  /\b(?:okay|ok|yes|yeah|sure|fine|alright)\b[,.!\s]*(?:tell|share|send|go\s+ahead|continue|explain)\b/i,
  /\bgo\s+ahead\b/i,
  /\b(?:what|how\s+much)\s+(?:is|are)?\s*(?:the\s+)?(?:price|cost|rate|budget|emi|payment)\b/i,
  /\b(?:end|cut|hang\s*up)\s+(?:the\s+)?call\b/i,
  /\b(?:call|phone)\s+(?:-a\s+)?(?:cut\s+pannunga|cut\s+pannu|cut\s+panu|mudiyunga|mudi)\b/i,
  // Tanglish
  /\b(?:sollunga|solunga|sollu|pesalam|pesalaam|pesuvom|kekkalaam|kekalam)\b/i,
  /\b(?:details|vivaram)\s+(?:sollunga|anuppunga|share\s+pannunga)\b/i,
  /\b(?:anuppunga|anupunga|share\s+pannunga|whatsapp\s+pannunga)\b/i,
  /\b(?:ok|okay|seri|sari|aama)\b[,.!\s]*(?:sollunga|solunga|sollu|pesalam|pesalaam|paakalam|paakalaam)\b/i,
  /\b(?:naan|na)\s+(?:interested|interest)\b/i,
  /\b(?:enna|epdi)\s+(?:options|property|properties|rate|price|budget)\b/i,
  /\b(?:rate|price|budget)\s+(?:enna|evlo|sollunga)\b/i,
  /\b(?:site\s+visit|visit)\s+(?:pannalam|pannalaam|poganuma)\b/i,
  // Tamil script
  /(?:சொல்லுங்கள்|சொல்லுங்க|பேசலாம்|விவரங்கள்|ஆர்வம்\s*(?:இருக்கு|உண்டு)|அனுப்புங்கள்)/,
];

/**
 * A rejection of one unit type or location inside an otherwise active
 * requirement conversation is a preference, not a rejection of the call.
 */
function isPropertyPreference(text: string): boolean {
  if (/\bnot\s+interested\s+in\s+(?:a\s+)?(?:\d\s*bhk|bhk|villa|apartment|flat|plot|land|commercial|rental|renting|resale)\b/i.test(text)) {
    return true;
  }
  if (/\b(?:do\s+not|don'?t)\s+(?:want|need)\s+(?:this|that|the)\s+(?:\d\s*bhk|villa|apartment|flat|plot)\b/i.test(text)) {
    return true;
  }
  if (/\b(?:do\s+not|don'?t)\s+(?:want|need)\s+to\s+(?:buy|invest\s+in|purchase)\s+(?:a\s+|an\s+)?(?:\d\s*bhk|villa|apartment|flat|plot|land|commercial)\b/i.test(text)) {
    return true;
  }
  if (/\bnot\s+interested\s+in\s+(?:buying|investing\s+in|purchasing|renting)\s+(?:a\s+|an\s+)?(?:\d\s*bhk|villa|apartment|flat|plot|land|commercial)\b/i.test(text)) {
    return true;
  }
  if (/\b(?:\d\s*bhk|villa|apartment|flat|plot)\s+(?:vendaam|vendam|venda)\b/i.test(text)) {
    return true;
  }
  // "2BHK வேண்டாம், 3BHK வேண்டும்" describes a preference.
  if (/வேண்டும்/.test(text)) return true;
  // "X vendam, Y venum" describes a preference.
  if (/\bvenum\b/i.test(text)) return true;
  return false;
}

function isQuestion(text: string): boolean {
  return /\?\s*$/.test(text);
}

export function detectObjectionSignal(raw: string): ObjectionSignal {
  const text = (raw || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) return 'none';

  if (DO_NOT_CALL_PATTERNS.some((re) => re.test(text))) return 'do_not_call';

  if (!isPropertyPreference(text) && REJECTION_PATTERNS.some((re) => re.test(text))) {
    // A bare "not interested?" echo is a question, not a rejection.
    if (isQuestion(text) && !/\b(?:do\s+not|don'?t|stop|never)\b/i.test(text)) return 'none';
    return 'rejection';
  }

  if (INTEREST_PATTERNS.some((re) => re.test(text))) return 'interest';
  return 'none';
}

export type SoftObjectionType = 'timing' | 'knowledge' | 'budget' | 'safety' | 'thinking' | 'general';

export interface SoftHesitationMatch {
  isSoft: boolean;
  type?: SoftObjectionType;
}

const FIRM_REFUSAL_PATTERNS: RegExp[] = [
  /\b(?:no[,.\s]+)?(?:i\s+)?(?:do\s+not|don'?t)\s+want\s+to\s+(?:discuss|talk|speak|continue|hear|proceed)(?:\s+this)?\b/i,
  /\bstop\s+(?:selling|talking|calling|bothering\s+me)\b/i,
  /\bleave\s+me\s+alone\b/i,
  /\bnot\s+interested[,.\s]+(?:goodbye|bye)\b/i,
  /\b(?:end|cut|hang\s*up)\s+(?:the\s+)?call\b/i,
  /\b(?:call|phone)\s+(?:-a\s+)?(?:cut\s+pannunga|cut\s+pannu|cut\s+panu|mudiyunga|mudi)\b/i,
  /\b(?:vendaam|vendam|venda)[,.\s]+(?:call\s+)?(?:cut\s+pannunga|cut\s+pannu|cut\s+panu)\b/i,
  /\b(?:vendaam|vendam|venda)[,.\s]+(?:bye|goodbye)\b/i,
  /\b(?:pesa\s+)?(?:virumbala|virumbavillai|mudiyadhu|koodadhu)\b/i,
  /\b(?:call\s+)?cut\s+pannunga\b/i,
  /\bnever\s+call\s+(?:me\s+|us\s+)?again\b/i,
  /\bcompletely\s+not\s+interested\b/i,
  /\bnot\s+interested\s+at\s+all\b/i,
];

const TIMING_HESITATION_PATTERNS: RegExp[] = [
  /\b(?:ippo|ippove|ippo\s+dhan)\s+(?:interest\s+illa|vendam|thevai\s+illa)[,.\s]*(?:maybe\s+later|later|aprom|appuram)?\b/i,
  /\b(?:maybe\s+)?(?:later|not\s+now|after\s+some\s+time|some\s+other\s+time)\b/i,
  /\b(?:not\s+interested\s+(?:right\s+now|at\s+the\s+moment|now)|currently\s+not\s+interested)\b/i,
  /\b(?:ippo\s+(?:illa|vendam|thevai\s+illa)|later\s+paakalaam|aprom\s+pesalaam)\b/i,
];

const KNOWLEDGE_HESITATION_PATTERNS: RegExp[] = [
  /\b(?:property|dubai)(?:\s+pathi)?\s+(?:enakku\s+)?(?:romba\s+)?(?:idea\s+illa|theriyadhu|teriyadhu)\b/i,
  /\b(?:no\s+idea|not\s+much\s+idea|don'?t\s+know\s+much)\s+(?:about\s+)?(?:dubai|property|properties|investment)?\b/i,
  /\bnever\s+thought\s+(?:about|of)\s+dubai\b/i,
  /\b(?:idea\s+illa|romba\s+theriyadhu|clarity\s+illa)\b/i,
];

const BUDGET_HESITATION_PATTERNS: RegExp[] = [
  /\bbudget\s+(?:konjam\s+)?(?:high|adhigam|perusu|romba\s+high|too\s+high)\b/i,
  /\b(?:too\s+expensive|very\s+costly|costly|romba\s+expensive|budget\s+pathadhu)\b/i,
  /\b(?:kai-?la\s+)?(?:panam|kaasu|amount|funds?)\s+(?:illa|pathadhu|kammi)\b/i,
];

const SAFETY_HESITATION_PATTERNS: RegExp[] = [
  /\b(?:dubai\s+)?(?:investment\s+)?(?:safe-?ah|safe\s+ah|safe\s+dhaana|safe\s+illaya)\b/i,
  /\b(?:is\s+it\s+safe|is\s+dubai\s+(?:property\s+)?safe|how\s+safe\s+is\s+it)\b/i,
  /\b(?:risky|risk-?ah|doubt-?ah\s+irukku|fear-?ah\s+irukku|bayama\s+irukku)\b/i,
  /\bfriends?\s+(?:negative\s+review|said\s+risky|cautioned)\b/i,
];

const THINKING_HESITATION_PATTERNS: RegExp[] = [
  /\b(?:i\s+)?need\s+to\s+think\b/i,
  /\b(?:konjam\s+)?(?:yosikanum|yosichu\s+solren|yosikiren|time\s+venum)\b/i,
  /\bneed\s+(?:some\s+)?time\s+to\s+decide\b/i,
  /\bhave\s+to\s+discuss\s+with\s+(?:family|wife|husband|partner|father)\b/i,
];

const GENERAL_SOFT_PATTERNS: RegExp[] = [
  /\bippo\s+interest\s+illa\b/i,
  /\bmaybe\s+not\s+now\b/i,
  /\bnot\s+sure\b/i,
];

const CONSENT_PATTERNS: RegExp[] = [
  /^(?:yes|sure|okay|ok|go ahead|sollunga|solunga|tell me|explain|share|share pannunga|share pannalaam|kandippa|aama)[.!\s]*$/i,
  /\b(?:sollunga|solunga|explain|share\s+pannunga|share\s+panrom|details\s+sollunga)\b/i,
  /\b(?:investment-?ku\s+paakalaam|explore\s+pannalaam|options\s+paakalaam|kandippa\s+paakalaam)\b/i,
  /\b(?:interested\s+to\s+know|tell\s+me\s+more|send\s+details)\b/i,
];

const BUSY_PATTERNS: RegExp[] = [
  /\b(?:i'?m|i\s+am)\s+busy\b/i,
  /\b(?:ippo\s+)?busy(?:-ah\s+irukken)?\b/i,
  /\b(?:driving|in\s+a\s+meeting|at\s+work|travelling)\b/i,
  /\b(?:call\s+(?:me\s+)?later|later\s+call|call\s+back\s+later)\b/i,
  /\b(?:time\s+illa|ippo\s+time\s+illa|ippo\s+pesa\s+mudiyadhu)\b/i,
];

export function isFirmRefusal(raw: string): boolean {
  const text = (raw || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) return false;
  return FIRM_REFUSAL_PATTERNS.some(re => re.test(text));
}

export function isSoftHesitation(raw: string): SoftHesitationMatch {
  const text = (raw || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) return { isSoft: false };
  if (detectObjectionSignal(text) === 'do_not_call' || isPropertyPreference(text)) {
    return { isSoft: false };
  }
  if (TIMING_HESITATION_PATTERNS.some(re => re.test(text))) return { isSoft: true, type: 'timing' };
  if (KNOWLEDGE_HESITATION_PATTERNS.some(re => re.test(text))) return { isSoft: true, type: 'knowledge' };
  if (BUDGET_HESITATION_PATTERNS.some(re => re.test(text))) return { isSoft: true, type: 'budget' };
  if (SAFETY_HESITATION_PATTERNS.some(re => re.test(text))) return { isSoft: true, type: 'safety' };
  if (THINKING_HESITATION_PATTERNS.some(re => re.test(text))) return { isSoft: true, type: 'thinking' };
  if (GENERAL_SOFT_PATTERNS.some(re => re.test(text))) return { isSoft: true, type: 'general' };
  if (detectObjectionSignal(text) === 'rejection' || FIRM_REFUSAL_PATTERNS.some(re => re.test(text))) {
    return { isSoft: true, type: 'general' };
  }
  return { isSoft: false };
}

export function isInterestOrConsent(raw: string): boolean {
  const text = (raw || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) return false;
  return CONSENT_PATTERNS.some(re => re.test(text));
}

export function isBusySignal(raw: string): boolean {
  const text = (raw || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) return false;
  return BUSY_PATTERNS.some(re => re.test(text));
}

/** One instance per call; consume completed utterances, never streaming fragments. */
export class CallRejectionTracker {
  count = 0;
  dnc = false;
  consume(text: string) {
    const signal = this.count > 0 && /^(?:no|nope|illa|illai)[.!\s]*$/i.test(text.trim())
      ? 'rejection' : detectObjectionSignal(text);
    if (signal === 'do_not_call') this.dnc = true;
    if (signal === 'rejection') this.count = Math.min(3, this.count + 1);
    return {
      signal,
      count: this.count,
      dnc: this.dnc,
      close: this.dnc || this.count >= 2,
      terminate: this.dnc || this.count >= 3,
      clarificationAllowed: !this.dnc && this.count < 2 && signal === 'rejection',
      attempt: this.count,
    };
  }
}
