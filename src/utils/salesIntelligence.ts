import { normalizeLeadFields } from './leadFields.js';

/** Task 7 facts use existing notes and lead_interactions.metadata; no migration. */
export const OFFER_PRESENTATION_FIELDS = ['flight_offer_status', 'golden_visa_offer_status', 'purchase_support_offer_status'] as const;
export const SALES_FIELDS = {
  current_stage: 'Current deterministic call stage number from 1 to 14',
  completed_stages: 'Comma-separated stage numbers completed so far, e.g. 1,2,3',
  offers_permission: 'Permission to present 3 offers: not_asked, asked, granted, delivered, declined',
  trust_building_completed: 'true once Stage 12 trust building has been presented and acknowledged',
  family_lifestyle_checked: 'completed once Stage 6 family and lifestyle requirements have been explored',
  soft_objection_count: 'Number of consecutive soft hesitations (0, 1, 2, 3)',
  soft_objection_type: 'Current hesitation category: timing, knowledge, budget, safety, thinking, or general',
  soft_objection_step: 'clarification_offered, explained, low_commitment_offered, or resolved',
  active_soft_objection: 'active while customer has an active soft hesitation, inactive or resolved when answered',
  firm_refusal: 'true when customer gave a firm unambiguous refusal',
  not_interested_count: 'Number of times customer stated not interested (0, 1, 2, 3)',
  inappropriate_count: 'Number of times customer made inappropriate or romantic comments (0, 1, 2, 3)',
  business_sector: 'Customer-stated business sector; no inferred income',
  business_type_detail: 'Customer-stated wholesale, retail, manufacturing or specific business line',
  business_subdetail: 'Customer-stated wholesale vs retail or specific supply detail',
  salaried_field: 'Customer-stated field of employment if salaried',
  profession_role: 'Customer-stated role or specialization in profession (e.g. development vs testing in IT, school vs college for teacher)',
  location_acknowledged: 'true once local hometown/city connection has been acknowledged to avoid repetition',
  current_area: 'Customer stated specific area, locality, or neighborhood within their living city/hometown (e.g. Palayamkottai, Anna Nagar, KTC Nagar); distinct from preferred Dubai property location',
  area_acknowledged: 'true once locality/area has been acknowledged to avoid repetition',
  budget_currency_clarification: 'needed, clarified, or not_needed; whether INR vs AED currency was confirmed',
  phone_confirmed: 'confirmed or pending; whether existing contact number was confirmed',
  acquisition_source_status: 'asked, captured, declined, or skipped near closing',
  fast_mode: 'true when customer requested brief/quick call',
  previous_call_memory: 'Dated prior summaries; lower priority than current explicit corrections',
  fact_provenance: 'Server-recorded update time and source; not inferred verification',
  competitor_name: 'Customer-provided realtor name, unverified',
  competitor_project: 'Customer-provided competing project, unverified',
  competitor_quote: 'Customer-provided total quoted price and currency, unverified',
  competitor_location: 'Customer-reported community of competing property',
  competitor_size: 'Customer-reported size with sqft/sqm and built-up/plot basis',
  competitor_verification: 'customer_provided_unverified or insufficient_comparables; verified only with actual evidence',
  legal_concern: 'Customer legal question, not a legal conclusion',
  knowledge_sources: 'Retrieved source identifiers, publishers, URLs and verification dates',
  comparison_result: 'Server-calculated historical comparison or no-data status, never an advertised universal market price',

  skipped_fields: 'Comma-separated irrelevant questions skipped by customer context; never force them again',
  flight_offer_delivery: 'Transport evidence only: attempted or interrupted, never proves customer heard or understood',
  golden_visa_offer_delivery: 'Transport evidence only: attempted or interrupted',
  purchase_support_offer_delivery: 'Transport evidence only: attempted or interrupted',

  hometown: 'Customer stated hometown/current home city; keep separate from preferred Dubai property location',
  current_location: 'Current location only if voluntarily shared; not the preferred property location',
  engagement_indicator: 'Conservative contextual indicator: highly interested, curious, neutral, skeptical, family focused, budget conscious, busy, frustrated or not interested; not a psychological fact',
  engagement_evidence: 'Brief relevant conversational evidence for engagement; never infer solely from audio tone',
  active_objection: 'trust while a current trust concern needs an answer; inactive after it has been addressed or the customer moves on',

  conversation_disposition: 'Current call only: engaged after explicit permission or voluntary property discussion; busy, angry, uninterested or end when stated. Never infer consent from silence.',
  declined_fields: 'Cumulative comma-separated exact field names the customer declined or cannot provide; skip those questions for this call.',

  profession: 'Professional background voluntarily shared; never infer wealth or affordability',
  approximate_income_range: 'Optional approximate income range with currency and period as stated; never exact savings or bank balance',
  income_discussion_permission: 'granted or declined only when explicit; declining income discussion does not mean rejecting property interest',
  down_payment_comfort: 'Voluntary approximate comfortable initial payment range with currency; not evidence of available savings',
  monthly_payment_comfort: 'Voluntary comfortable monthly allocation with currency; never calculated from income',
  payment_preference: 'Customer-stated full payment or installments; no implied plan availability',
  financing_interest: 'Customer-stated mortgage/bank financing or developer payment plan interest; not approval',
  funds_readiness: 'arranged, planning or uncertain only as voluntarily stated; do not infer from income or profession',
  financial_qualification_status: 'budget_only, preferences_captured, verification_pending or declined; not a credit assessment or mortgage approval',

  family_size: 'Number of household members only as voluntarily stated; never infer from bedrooms or marital status',
  children_dependants: 'Optional household needs/counts voluntarily shared; no names, exact ages, schools attended or sensitive medical details',
  family_relocation: 'Customer-stated solo or family relocation plans; do not assume',
  extra_bedroom_needs: 'Customer-stated space for parents, guests, work or other needs',
  lifestyle_requirements: 'Customer priorities such as schools, nurseries, beach access, parks, healthcare, shops, transport, community, pool, gym, privacy or security; requirements are not verified property features',
  recommendation_status: 'requirements_captured, verification_pending or verified_options_discussed; use the last only when actual verified property information was available and discussed',
  family_details_confirmation: 'confirmed only when the customer explicitly corrects previously saved family/lifestyle details; uncertain when unclear',

  flight_offer_status: 'presented only after the complete flight booking explanation; understood only if customer explicitly acknowledges understanding. Do not mark interrupted explanations complete.',
  golden_visa_offer_status: 'presented only after explaining assistance and government eligibility/approval limits; understood only on explicit acknowledgement.',
  purchase_support_offer_status: 'presented only after explaining dedicated selection, viewing, documentation and purchase support; understood only on explicit acknowledgement.',

  investment_purpose: 'Own use, rental investment or other purpose in the customer words',
  flight_booking_interest: 'interested or declined; only when explicitly stated',
  accommodation_assistance_interest: 'interested or declined; assistance only, not free accommodation',
  transportation_support_interest: 'interested or declined; support, not all expenses paid',
  golden_visa_assistance_interest: 'interested or declined; never guaranteed approval',
  competitor_details: 'Customer-reported company/agent, project, location, quoted price and currency, size and unit, type, developer, payment plan, extra charges, ownership and registration; distinguish unverified quotes',
  customer_objections: 'Customer concerns in their own words; never invent objections',
  customer_mood: 'Explicit contextual mood: interested, curious, hesitant, angry, confused, busy, financially concerned or ready',
  buying_readiness: 'exploring, considering or ready; ready needs explicit purchase intent, not questions',
  follow_up_permission: 'granted or declined only on explicit permission or refusal; never infer from curiosity',
  agreed_next_action: 'Customer-agreed consultation/viewing/follow-up and timing; not a confirmed booking',
  name_collection_status: 'pending or declined when name is unavailable; never pressure',
  name_confirmation: 'confirmed only for an explicit customer name correction/confirmation; uncertain if unclear',
} as const;
const start = '[Task 7 sales]';
const end = '[/Task 7 sales]';
export function splitNotes(value: unknown): { text: string; sales: Record<string, string> } {
  const notes = String(value || '');
  const from = notes.lastIndexOf(start), to = notes.indexOf(end, from);
  if (from < 0 || to < 0) return { text: notes, sales: {} };
  try {
    const parsed = JSON.parse(notes.slice(from + start.length, to));
    const sales: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) if (key in SALES_FIELDS && typeof val === 'string') sales[key] = val;
    return { text: (notes.slice(0, from) + notes.slice(to + end.length)).trim(), sales };
  } catch { return { text: notes, sales: {} }; }
}
export function knownCustomerName(value: unknown): string | undefined {
  const name = typeof value === 'string' ? value.trim() : '';
  return name && !/^(unknown(?: \/ not mentioned)?|not (?:provided|mentioned|known)|n\/a|none|null|pending|customer|prospect|lead|there|valued lead|prospect lead|valued customer|anonymous|user|guest|client|caller|test)$/i.test(name) ? name : undefined;
}
export function mergeSalesLead(existing: Record<string, any>, input: Record<string, any>): Record<string, any> {
  const clean = normalizeLeadFields(input);
  const priorName = (knownCustomerName(existing.customer_name_raw) || knownCustomerName(existing.full_name) || knownCustomerName(existing.name));
  const incomingName = knownCustomerName(clean.customer_name_raw || clean.name);
  // Guard Gemini tool extraction too: a town supplied as both hometown and name
  // is ambiguous, not a customer-confirmed name.
  const matchesUnconfirmedHometown = !!incomingName && !!clean.hometown &&
    incomingName.toLocaleLowerCase() === String(clean.hometown).toLocaleLowerCase() &&
    clean.name_confirmation !== 'confirmed';
  if (!incomingName || matchesUnconfirmedHometown || clean.name_confirmation === 'uncertain' || (priorName && incomingName !== priorName && clean.name_confirmation !== 'confirmed')) {
    delete clean.name; delete clean.customer_name_raw;
  } else { clean.name = incomingName; clean.customer_name_raw = incomingName; }
  if (clean.name_confirmation === 'uncertain') delete clean.customer_preferred_name;
  if (clean.qualification_status === 'HOT') clean.qualification_status = qualificationWithName('HOT', { ...existing, ...clean });
  const previous = splitNotes(existing.notes), incoming = splitNotes(clean.notes);
  const sales = { ...previous.sales, ...incoming.sales };
  for (const key of Object.keys(SALES_FIELDS)) if (typeof clean[key] === 'string') sales[key] = clean[key];
  // Progress survives partial updates and stale cumulative summaries; interest is separate.
  for (const key of OFFER_PRESENTATION_FIELDS) {
    const values = [previous.sales[key], existing[key], incoming.sales[key], clean[key]];
    const status = values.includes('understood') ? 'understood' : values.includes('presented') ? 'presented' : undefined;
    delete clean[key];
    if (status) sales[key] = status; else delete sales[key];
  }
  for (const key of ['family_size', 'children_dependants', 'family_relocation', 'extra_bedroom_needs', 'lifestyle_requirements']) {
    const prior = previous.sales[key] || existing[key];
    if (clean.family_details_confirmation === 'uncertain' || (prior && sales[key] !== prior && clean.family_details_confirmation !== 'confirmed')) {
      delete clean[key];
      if (prior) sales[key] = prior; else delete sales[key];
    }
  }
  sales.name_collection_status = clean.name || priorName ? 'collected' : sales.name_collection_status === 'declined' ? 'declined' : 'pending';
  // Keep earlier facts even if a model sends a partial rather than cumulative summary.
  const text = !incoming.text ? previous.text : !previous.text || incoming.text.includes(previous.text) ? incoming.text : previous.text.includes(incoming.text) ? previous.text : previous.text + '\n' + incoming.text;
  clean.notes = [text, start + JSON.stringify(sales) + end].filter(Boolean).join('\n');
  Object.assign(clean, sales);
  return clean;
}
export function qualificationWithName(status: string, data: Record<string, any>): string {
  if (status === 'HOT' && data.buying_readiness === 'exploring') return 'WARM';
  if (status === 'HOT' && !(knownCustomerName(data.customer_name_raw) || knownCustomerName(data.full_name) || knownCustomerName(data.name))) return 'PENDING';
  return status;
}

/** Pass only validated offer progress to the prompt, never arbitrary CRM notes. */
export function offerPresentationContext(lead: Record<string, any> = {}): string {
  const saved = splitNotes(lead.notes).sales;
  return OFFER_PRESENTATION_FIELDS.map(key => {
    const values = [saved[key], lead[key]];
    const state = values.includes('understood') ? 'understood' : values.includes('presented') ? 'presented' : 'not recorded';
    return key + ': ' + state;
  }).join('; ');
}

/** Output transcription proves an attempt, not playback or understanding. */
export function recordOfferDelivery(facts: Record<string, any>, text: string, interrupted: boolean) {
  const patch: Record<string, string> = {};
  for (const [key, pattern] of [
    ['flight_offer_delivery', /flight.*(?:ticket|booking)/i],
    ['golden_visa_offer_delivery', /golden visa/i],
    ['purchase_support_offer_delivery', /(?:property|relocation|dedicated).*(?:guidance|support|stay|settle)/i],
  ] as const) if (pattern.test(text)) patch[key] = interrupted ? 'interrupted' : 'attempted';

  if (!interrupted) {
    if (/flight/i.test(text) && /visa/i.test(text) && /(?:guidance|settle|support|stay)/i.test(text)) {
      patch.offers_permission = 'delivered';
      patch.flight_offer_status = 'presented';
      patch.golden_visa_offer_status = 'presented';
      patch.purchase_support_offer_status = 'presented';
    }
  }
  return { ...facts, ...mergeSalesLead(facts, patch) };
}
