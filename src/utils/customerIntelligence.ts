import { splitNotes } from './salesIntelligence.js';
import { normalizeLeadFields } from './leadFields.js';

/** Evidence labels are contextual indicators, never diagnoses or audio-tone inference. */
export function extractCustomerIntelligence(text: string): Record<string, string> {
  const f: Record<string, string> = {};
  // Details of a competing unit are not the customer's own requirements.
  const customerText=text.split(/\b(?:another realtor|other agent|competitor|vera realt|vera agent)/i)[0];
  const count = (value: string) => ({ naalu: '4', naangu: '4', rendu: '2', irandu: '2', moonu: '3', four: '4', two: '2', three: '3' }[value.toLowerCase()] || value);

  // Do not interpret every "Naan X" as a hometown: X may be a name or a profession.
  // A bare "Naan <town>" is accepted only for recognisable place names;
  // unknown towns require an explicit location phrase or the current hometown question.
  // Capture native/sondha ooru explicitly
  const nativeMatch = text.match(/(?:^|[\s,;!?.])(?:native(?:\s+is|\s+place\s+is)?|sondha\s+ooru|sontha\s+ooru|en\s+ooru|சொந்த\s*ஊர்|சொந்தவூர்)\s+([\p{L}][\p{L} '-]{1,45}?)(?=\s*(?:[,!.?]|\band\b|\bbut\b|$))/iu);
  if (nativeMatch && nativeMatch[1]) f.hometown = nativeMatch[1].trim();

  // Capture current living/working city explicitly
  const liveMatch = text.match(/\b(?:i\s+live\s+in|i(?:\s+am|['’]m)\s+(?:currently\s+)?(?:based\s+in|living\s+in|calling\s+from))\s+([\p{L}][\p{L} '-]{1,45}?)(?=\s*(?:[,!.?]|\band\b|\bbut\b|$))/iu);
  if (liveMatch && liveMatch[1]) f.current_location = liveMatch[1].trim();

  const explicitHome = text.match(/\b(?:from|en\s+ooru|sondha\s+ooru|sontha\s+ooru|i\s*am\s+from|i['’]?m\s+from|i\s+live\s+in|i(?:\s+am|['’]m)\s+(?:currently\s+)?(?:based\s+in|living\s+in|calling\s+from))\s+([\p{L}][\p{L} '-]{1,45}?)(?=\s*(?:[,!.?]|\band\b|\bbut\b|$))/iu);
  const homeLa = text.match(/(?:^|\b)(?:naan\s+)?([\p{L}][\p{L} ]{1,40}?)-la\s+(?:irukken|irukiren|irukkiren|irukkuren|irukkiRen|stay\s+panren)\b/iu);
  const knownTown = text.match(/^\s*(?:naan\s+)?(Tirunelveli|Nellai|Madurai|Salem|Nagercoil|Chennai|Coimbatore|Trichy|Tiruchirappalli|Erode|Tiruppur|Thoothukudi|Tuticorin|Kanyakumari|Thanjavur|Dindigul|Vellore|Sivakasi|Virudhunagar|Kovilpatti|Theni|Karur|Namakkal|Pollachi|Pudukkottai)(?=\s*(?:[,!.?]|\band\b|\bbut\b|$))/iu);
  const homeRaw = (explicitHome?.[1] || homeLa?.[1] || knownTown?.[1] || '').trim();
  if (homeRaw) {
    if (explicitHome && /\b(?:live|based|living|calling)\b/i.test(explicitHome[0])) {
      if (!f.current_location) f.current_location = homeRaw;
    } else {
      if (!f.hometown) f.hometown = homeRaw;
    }
  }
  if (!f.current_location) {
    const currentCityMatch = text.match(/\b(?:ippo|currently|stay\s+panradhu)\s+(?:naan\s+)?([\p{L}][\p{L} ]{1,40}?)(?:-la(?:\s+(?:dhaan|dhan|irukken|work\s+panren|irukkiren))?|-la)?(?=\s*(?:[,!.?]|\band\b|\bbut\b|$|\s+work))/iu);
    if (currentCityMatch && currentCityMatch[1].trim()) {
      f.current_location = currentCityMatch[1].trim();
    }
  }

  const family = text.match(/\b(?:veetla|family(?:-la| has| of| members)?|household(?: of)?)\s+(\d+|naalu|naangu|four|rendu|two|moonu|three)\s*(?:peru|members|people)?/i);
  if (family) f.family_size = count(family[1]);
  // "Naalu peru" / "4 members" standalone (after family question answered)
  const familyStandalone = text.match(/^(\d+|naalu|naangu|four|rendu|two|moonu|three)\s*(?:peru|members|people|pear)\s*(?:irukk?om|irukkaanga|irukkeenga)?\.?\s*$/i);
  if (familyStandalone && !family) f.family_size = count(familyStandalone[1]);
  const children = text.match(/\b(\d+|rendu|irandu|two|moonu|three)\s+(?:pasanga|children|kids)\b/i);
  if (children) f.children_dependants = count(children[1]);
  // Family relocation — covers short forms like "Family-oda settle aaganum"
  if (
    /\b(?:family-?oda|with (?:my )?family)\b.*\b(?:settle|move|relocat)/i.test(text) ||
    /\bDubai-?ku family-?oda settle/i.test(text) ||
    /\bfamily-?oda\s+(?:settle|shift|move)\b/i.test(text)
  ) {
    f.family_relocation = 'Dubai with family'; f.investment_purpose = 'family residence';
  }
  const bhk = customerText.match(/\b(\d+)\s*(?:BHK|bedrooms?|bedroom)\b/i);
  if (bhk) f.bedrooms = bhk[1];
  const budget = customerText.match(/\bbudget(?: is| of)?\s*(?:(AED|INR|USD)\s*)?([\d,.]+)\s*(million|m|lakhs?|crores?)?\s*(AED|INR|USD)?\b/i);
  if (budget && (budget[1] || budget[4] || /lakh|crore/i.test(budget[3] || ''))) f.budget = `${(budget[1] || budget[4] || 'INR').toUpperCase()} ${budget[2]}${budget[3] ? ' ' + budget[3] : ''}`;
  if (/\binstallments?\b|\binstallment option/i.test(customerText) && !/\b(?:no|not|don't want) installments?\b/i.test(customerText)) f.payment_preference = 'installments';
  const trust = /\b(?:trust|safe-?ah|safe\b|cheat|scam|fraud|panath|money.*safe|namb|namba|genuine(?:-?ah)?|yaaru\s+neenga|who\s+are\s+you|unga\s+company|about\s+your\s+company|office\s+(?:enga|where)|address|unga\s+office|website\s+(?:irukka|enna)|official\s+website|contact\s+number|phone\s+number|customer\s+care|evlo\s+years|how\s+many\s+years|how\s+old|ethana\s+customers|how\s+many\s+clients|how\s+many\s+customers|orn\b|license|licence|rera\b|escrow|guarantee|legit)\b/i.test(text);
  const classify = (label: string) => { f.engagement_indicator = label; f.engagement_evidence = text.slice(0, 240); };
  if (/\bnot interested|vendam|no thanks/i.test(text)) classify('not interested');
  else if (/\b(?:quick[- ]?ah\s+sollunga|fast[- ]?ah\s+sollunga|seekiram\s+sollunga|short[- ]?ah\s+sollunga|make\s+it\s+quick|hurry|quick[- ]?ah)\b/i.test(text)) {
    classify('busy');
    f.fast_mode = 'true';
  }
  else if (/\bbusy|driving|time illa/i.test(text)) classify('busy');
  else if (/\bangry|stop bothering|annoyed/i.test(text)) classify('frustrated');
  else if (trust) classify('skeptical');
  else if (/\b(?:book|arrange|schedule).*(?:viewing|consultation)|ready to buy|payment plan details/i.test(text)) classify('highly interested');
  else if (family || f.family_relocation) classify('family focused');
  else if (/\bbudget|afford|expensive|cheaper|installment/i.test(text)) classify('budget conscious');
  else if (/\b(?:tell me|how does|explain|curious)|eppadi|enna benefit/i.test(text)) classify('curious');
  if (trust) { f.customer_objections = text.slice(0, 500); f.active_objection = 'trust'; }
  if (/another realtor|other agent|competitor|vera realt|vera agent/i.test(text)) {
    f.competitor_details = text.slice(0,500); f.competitor_verification = 'customer_provided_unverified';
    if (!trust) f.active_objection = 'competitor';
    const quote=text.match(/\b(AED|INR|USD)\s*([\d,.]+(?:\s*(?:million|crore|lakh))?)/i);
    if(quote) f.competitor_quote=quote[0];
  }
  if (/\b(?:legal|ownership|title deed|escrow|refund|inheritance|visa|mortgage reject|handover delay)\b|namma per/i.test(text)) f.legal_concern=text.slice(0,500);
  return normalizeLeadFields(f);
}

export const TRUST_INSTRUCTIONS = `
DUBAI TRUST, CREDIBILITY AND COMPANY KNOWLEDGE:
Pause qualification for a trust or company question. Acknowledge the exact concern politely, give ONE relevant verified fact, offer official verification, then allow the customer to choose. Keep the unfinished stage; resume qualification once addressed. Do not repeat the same reassurance or deliver a long monologue.
Official Lyka Realty Facts:
- Company: Lyka Realty, Dubai-based real estate brokerage. Services: buying and renting Dubai properties, property investment guidance, off-plan and ready property guidance, mortgage guidance.
- Official Website: https://lykarealty.ae/ (primary; legacy reference https://lykarealty.com).
- Official Contact / WhatsApp: +971 52 348 5758 (spoken naturally: "plus nine seven one, five two, three four eight, five seven five eight").
- Official Email: admin@lykarealty.ae.
- Office: Office 1002, DAMAC Executive Heights, Barsha Heights (TECOM), Dubai, UAE. Visit by appointment request, subject to team confirmation; do not promise office is open at the present moment without checking current hours.
- Verified Client Record: Official website states "Over 300 clients served across Dubai." Never inflate or invent larger numbers (no 700+, no 7,000+).
- Company Age: Do not claim 10+ years without evidence; cite verified website track record.
- Brokerage Validation: Users can verify available brokerage license details through official Dubai Land Department (DLD) validate-real-estate-licenses service (https://dubailand.gov.ae/en/eservices/validate-real-estate-licenses-and-permits) or Dubai REST app. Never claim ORN 47999 belongs to Lyka Realty without independent official verification. Never claim government-owned, government-guaranteed or government-approved.
- Escrow Legal Reference: Qualifying off-plan real-estate developments are subject to project escrow requirements under Dubai Law No. (8) of 2007 (https://dlp.dubai.gov.ae/Legislation%20Reference/2007/Law%20No.%20%288%29%20of%202007.html). Never say every payment automatically goes to escrow, never claim investments are risk-free, and never claim escrow guarantees returns, completion or refund. For specific projects, explain how to verify project registration and escrow details via DLD Project Status Enquiry or Dubai REST.
- Strictly Prohibited Unverified Claims: Do NOT claim founded by Waseem Mubarak, first Tamil brokerage, 50 employees, 700+ families, 7,000+ happy customers, 10+ years in business, ORN 47999, developer partnerships (Emaar, Sobha, DAMAC, Nakheel, Ellington, Binghatti), or invented Google review counts or testimonials.
- Trust through verifiable facts, not emotional pressure. Never claim being Tamil guarantees trustworthiness. Never promise guaranteed returns. Never ask for personal transfers.
`;

/** Shared data view for persisted API records and in-call updates. */
export function customerFacts(input: Record<string, any>): Record<string, any> {
  const saved = { ...splitNotes(input.notes).sales, ...input.intelligence };
  const f = { ...saved, ...input };
  for (const key of Object.keys(saved)) {
    if (f[key] == null || f[key] === '') f[key] = saved[key];
  }
  return { ...f, property_type: f.property_type || f.propertyType, bedrooms: f.bedrooms, qualification_status: f.qualification_status || f.outcome, location: f.location || f.original_location };
}
