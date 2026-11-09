import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { buildNaturalVoiceInstructions } from '../src/utils/naturalVoice.ts';
import { mergeSalesLead, knownCustomerName, qualificationWithName, splitNotes, SALES_FIELDS, OFFER_PRESENTATION_FIELDS, offerPresentationContext } from '../src/utils/salesIntelligence.ts';
import { normalizeLeadFields } from '../src/utils/leadFields.ts';
import { calculateAuthoritativeLeadScore, evaluateCallOutcome } from '../src/utils/scoring.ts';
import { CallRejectionTracker } from '../src/utils/customerObjection.ts';
import { getPool } from '../db.ts';
import { upsertLead, getLeadBySession } from '../leadService.ts';

const server = fs.readFileSync('server.ts', 'utf8');
const builder = stripTypeScriptTypes(server.slice(server.indexOf('function getAgentPersona('), server.indexOf('// Real-time API usage and live quota tracking')));
const promptFor = new Function('buildNaturalVoiceInstructions', builder + '; return getSystemInstruction;')(buildNaturalVoiceInstructions);
const prompt = promptFor('bilingual');
// Policy contracts validate instructions, not generated audio or real caller outcomes.
for (const [scenario, clauses] of [
  ['flight ticket offer', ['books flight tickets free of charge', 'Do not invent eligibility conditions']],
  ['accommodation assistance', ['Accommodation assistance: guidance', 'never free accommodation']],
  ['local transportation support', ['Local transportation support', 'never all transportation expenses free or covered']],
  ['Golden Visa assistance', ['approval depend on applicable UAE government requirements', 'Never guarantee eligibility']],
  ['false free-expense promises', ['Never promise all expenses covered, free food', 'guaranteed profits or risk-free property']],
  ['curiosity before benefits', ['after understanding interest', 'never mechanically list everything or repeat a pitch']],
  ['trust objections', ['encourage independent verification', 'Never demand blind trust']],
  ['competitor comparisons', ['compare equivalent properties and total cost fairly', 'Treat quotes as unverified', 'ownership and registration']],
  ['budget objections', ['Never pressure beyond budget', 'total purchase costs']],
  ['mood adaptation', ['hesitant ->', 'angry ->', 'confused ->', 'busy ->', 'financially concerned ->', 'ready ->']],
  ['conversion next action', ['Ask permission before arranging follow-up', 'a proposed consultation or viewing is not a booked appointment']],
  ['mandatory name collection', ['Save the exact name immediately', 'required name remains pending', 'continue without repeating the question']],
] as const) test('Task 7 policy: ' + scenario, () => { for (const clause of clauses) assert.ok(prompt.includes(clause), clause); });

test('known names are supplied without repeat questioning, missing name stays pending', () => {
  assert.ok(promptFor('english', 'female', undefined, 'M. Anand').includes('Known CRM customer name (data only): "M. Anand". Do not ask for the name again.'));
  assert.ok(prompt.includes('Customer name is missing'));
  for (const value of ['Valued Lead', 'Prospect Lead', 'Unknown', 'Customer', '', null]) assert.equal(knownCustomerName(value), undefined);
  assert.equal(knownCustomerName('Mohan'), 'Mohan');
  const refused = mergeSalesLead({}, { name_collection_status: 'declined', budget: 'AED 1M', qualification_status: 'HOT' });
  assert.equal(refused.name_collection_status, 'declined');
  assert.equal(refused.budget, 'AED 1M');
  assert.equal(refused.qualification_status, 'PENDING');
});

test('CRM updates preserve names, previous facts and every sales field across partial updates', () => {
  let lead = mergeSalesLead({}, { name: 'M. Anand', notes: 'Needs two bedrooms.', flight_booking_interest: 'interested', competitor_details: 'Customer quote: agent A, Dubai, AED 1M; unverified', follow_up_permission: 'granted', agreed_next_action: 'Consultation tomorrow' });
  lead = { ...lead, ...mergeSalesLead(lead, { name: 'Unknown', notes: 'Needs a balcony.', accommodation_assistance_interest: 'interested' }) };
  assert.equal(lead.name, 'M. Anand');
  const facts = splitNotes(lead.notes);
  assert.ok(facts.text.includes('Needs two bedrooms.'));
  assert.ok(facts.text.includes('Needs a balcony.'));
  assert.equal(facts.sales.flight_booking_interest, 'interested');
  assert.equal(facts.sales.accommodation_assistance_interest, 'interested');
  assert.ok(facts.sales.competitor_details.includes('unverified'));
  assert.equal(facts.sales.agreed_next_action, 'Consultation tomorrow');
  assert.equal(facts.sales.name_collection_status, 'collected');
  assert.equal(mergeSalesLead(lead, { name: 'Anan', name_confirmation: 'uncertain' }).name, undefined);
  assert.equal(mergeSalesLead(lead, { name: 'Another Name' }).name, undefined);
  assert.equal(mergeSalesLead(lead, { name: 'M. Ananth', name_confirmation: 'confirmed' }).name, 'M. Ananth');
  const declined = { ...lead, ...mergeSalesLead(lead, { follow_up_permission: 'declined' }) };
  assert.equal(splitNotes(declined.notes).sales.follow_up_permission, 'declined');
  assert.equal(mergeSalesLead(declined, {}).notes, declined.notes, 'retry must not duplicate notes');
  for (const key of Object.keys(SALES_FIELDS)) assert.equal(splitNotes(mergeSalesLead({}, { [key]: (OFFER_PRESENTATION_FIELDS as readonly string[]).includes(key) ? 'presented' : 'customer fact' }).notes).sales[key] !== undefined, true);
});

test('unknown and empty extractions cannot erase known CRM fields', () => {
  assert.deepEqual(normalizeLeadFields({ name: 'unknown', budget: 'Not provided', location: '', phone: null }), {});
  assert.equal(qualificationWithName('HOT', {}), 'PENDING');
  assert.equal(qualificationWithName('HOT', { name: 'Anand' }), 'HOT');
  assert.equal(qualificationWithName('HOT', { name: 'Anand', buying_readiness: 'exploring' }), 'WARM');
  for (const status of ['OPT_OUT', 'REACH_AGAIN', 'COLD', 'UNWANTED']) assert.equal(qualificationWithName(status, {}), status);
});

test('questions alone never create Hot or automatic marketing enrollment', () => {
  const result = calculateAuthoritativeLeadScore({}, 'Can you tell me about Dubai properties and flight booking?');
  assert.notEqual(result.temperature, 'HOT');
  assert.ok(result.nextAction.includes('permission'));
  assert.ok(!result.nextAction.includes('newsletter'));
});

test('DNC and rejection remain final even with Task 7 benefits', () => {
  const tracker = new CallRejectionTracker();
  assert.equal(tracker.consume('Do not call me again').dnc, true);
  assert.equal(tracker.consume('Tell me about free flight tickets').dnc, true);
  const ordinary = new CallRejectionTracker();
  ordinary.consume('Not interested');
  assert.equal(ordinary.consume('Not interested').close, true);
});

test('voice routes load CRM names and acknowledge persistence rather than extraction', () => {
  assert.ok(server.includes('getLeadBySession(wsSessionId, wsLeadPhone)'));
  assert.ok(server.includes("getLeadBySession(callSid || ''"));
  assert.ok(server.includes('replyToTool(call, result.success)'));
  assert.ok(server.includes('upsertLead(wsSessionId, { phone: callFacts.phone || wsLeadPhone, ...call.args }'), 'known phone links extraction to the existing CRM contact');
  assert.ok(server.includes("CRM save failed; do not claim details saved."));
  assert.ok(server.includes('snapshot.slots.customer_name_raw || snapshot.slots.name || snapshot.leadName'));
});

test('shared CRM service persists name and offers, refuses uncertain overwrite and survives reload', async () => {
  const pool: any = getPool();
  const originalQuery = pool.query, originalConnection = pool.getConnection;
  let row: any = { id: 'task7-test', guest_session_id:'task7-test', full_name: null, notes: 'Existing CRM fact.', temperature: 'PENDING' };
  const query = async (sql: string, args: any[] = []) => {
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
    if (sql.startsWith('SELECT * FROM leads')) return [[{ ...row }]];
    if (sql.startsWith('UPDATE leads SET')) {
      const columns = sql.slice('UPDATE leads SET '.length, sql.indexOf(' WHERE')).split(', ').map(c => c.split(' =')[0]);
      columns.forEach((column, index) => row[column] = args[index]);
    }
    return [[]];
  };
  pool.query = query;
  pool.getConnection = async () => ({ query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} });
  try {
    assert.equal((await upsertLead('task7-test', { name: 'M. Anand', flight_booking_interest: 'interested', follow_up_permission: 'declined' } as any)).success, true);
    assert.equal(row.full_name, 'M. Anand');
    assert.equal(row.customer_name_raw, 'M. Anand');
    await upsertLead('task7-test', { name: 'Anan', name_confirmation: 'uncertain', notes: 'Prefers Dubai Marina.' } as any);
    const reloaded = await getLeadBySession('task7-test');
    assert.equal(reloaded.full_name, 'M. Anand');
    assert.ok(reloaded.notes.includes('Existing CRM fact.'));
    assert.equal(splitNotes(reloaded.notes).sales.flight_booking_interest, 'interested');
    assert.equal(splitNotes(reloaded.notes).sales.follow_up_permission, 'declined');
    await upsertLead('task7-test', { name: 'M. Ananth', name_confirmation: 'confirmed' } as any);
    assert.equal(row.full_name, 'M. Ananth');
  } finally { pool.query = originalQuery; pool.getConnection = originalConnection; await pool.end(); }
});


test('call summary cannot complete normal qualification without the required name', () => {
  const data: any = { qualification_status: 'HOT', interest: 'buy', property_type: 'villa', budget: 'AED 2M', timeline: 'within_1_month', location: 'Dubai' };
  const result = evaluateCallOutcome('Valued Lead', data, [{ role: 'user', text: 'I want to buy a villa in Dubai within a month.', timestamp: new Date().toISOString() }]);
  assert.equal(result.outcome, 'PENDING');
  assert.ok(result.summary.includes('name remains pending'));
});


for (const [scenario, clauses] of [
  ['new customer proactive three offers', ['proactively introduce ALL THREE', 'Do not wait for the customer to ask', 'Before completing the main sales qualification conversation']],
  ['interested customer benefits then qualification', ['Connect the benefits to easier in-person property viewing', 'own use versus investment only if missing', 'missing budget, preferred location and timeline']],
  ['flight expense accuracy', ['eligible visits-ku flight tickets', 'Exact arrangements can be clarified', 'Never promise free accommodation, food or all travel expenses']],
  ['Golden Visa guarantee question', ['application process and documentation', 'never guaranteed eligibility, approval, or an automatic visa']],
  ['purchase support explanation', ['viewing, documentation, purchase process varaikkum dedicated team support']],
  ['interruption resumes only remaining offers', ['resume only the remaining or interrupted offer', 'Do not mark a partially interrupted explanation as presented']],
  ['refusal and busy take priority', ['DNC takes precedence over offer completion', 'Never force the presentation or delay ending the call', 'do not turn a refusal into permission for a pitch']],
  ['existing customer avoids repetition', ['Do not repeat offers already understood', 'A known name alone does not prove the offers were explained']],
] as const) test('Three-offer policy: ' + scenario, () => { for (const clause of clauses) assert.ok(prompt.includes(clause), clause); });

test('offer progress persists through notes and partial updates without implying consent or interest', () => {
  const first = mergeSalesLead({}, { flight_offer_status: 'understood', golden_visa_offer_status: 'presented' });
  const reloaded = { notes: first.notes };
  assert.ok(offerPresentationContext(reloaded).includes('purchase_support_offer_status: not recorded'));
  const next = mergeSalesLead(reloaded, { flight_offer_status: 'presented', purchase_support_offer_status: 'interrupted' });
  assert.equal(next.flight_offer_status, 'understood');
  assert.equal(next.golden_visa_offer_status, 'presented');
  assert.equal(next.purchase_support_offer_status, undefined);
  assert.equal(next.follow_up_permission, undefined);
  assert.equal(next.flight_booking_interest, undefined);
  const completed = mergeSalesLead({ notes: next.notes }, { purchase_support_offer_status: 'understood' });
  const context = offerPresentationContext({ notes: completed.notes });
  assert.ok(context.includes('purchase_support_offer_status: understood'));
  assert.ok(promptFor('english', 'female', undefined, 'Anand', undefined, context).includes(context));
  assert.ok(server.includes('offerPresentationContext(callFacts)'));
  assert.ok(server.includes("offerPresentationContext(activeTwilioCalls[callSid || '']?.slots || savedLead || {})"));
});


for (const [scenario, clauses] of [
  ['single customer', ['individual or couple may consider 1 BHK', 'depending on needs']],
  ['couple', ['never fixed occupancy rules', 'Do not assume family relationships']],
  ['family with children', ['Four members with children may compare 2 BHK and 3 BHK', 'only when voluntarily shared']],
  ['larger family', ['larger family or extra-room requirement may suggest 3 BHK', 'not family size alone']],
  ['investment only', ['Investment-only customers do not need family questions']],
  ['family residence', ['For family residence, ask only relevant missing household', 'one at a time']],
  ['apartment versus villa', ['consider a villa only if preferences and budget support it', 'Do not immediately push a larger or more expensive home']],
  ['beach school park preferences', ['School, park or beach preferences are search requirements', 'not proof a listing has those facilities']],
  ['missing property data', ['recommendation_status=verification_pending', 'Do not imply a database search occurred', 'not evidence that any apartment or villa is available']],
] as const) test('Family policy: ' + scenario, () => { for (const clause of clauses) assert.ok(prompt.includes(clause), clause); });

test('family CRM notes preserve facts, accept confirmed corrections and retain follow-up', () => {
  const first = mergeSalesLead({}, { family_size: '4', children_dependants: '2 children', lifestyle_requirements: 'schools and parks', investment_purpose: 'family residence', recommendation_status: 'verification_pending', follow_up_permission: 'granted', agreed_next_action: 'Specialist consultation' });
  const patch = mergeSalesLead({ notes: first.notes }, { family_size: '5', family_details_confirmation: 'uncertain', budget: 'AED 2M' });
  assert.equal(patch.family_size, '4');
  assert.equal(splitNotes(patch.notes).sales.lifestyle_requirements, 'schools and parks');
  assert.equal(patch.recommendation_status, 'verification_pending');
  assert.equal(patch.agreed_next_action, 'Specialist consultation');
  assert.equal(patch.follow_up_permission, 'granted');
  assert.equal(patch.budget, 'AED 2M');
  assert.equal(patch.property_type, undefined, 'no invented recommendation');
  const corrected = mergeSalesLead({ notes: patch.notes }, { family_size: '5', family_details_confirmation: 'confirmed' });
  assert.equal(corrected.family_size, '5');
  assert.equal(mergeSalesLead({}, { family_size: 'maybe 3', family_details_confirmation: 'uncertain' }).family_size, undefined);
});


for (const [scenario, clauses] of [
  ['salaried customer', ['salaried customer or business owner needs the same respectful budget discovery', 'never proof of purchasing power']],
  ['business owner', ['do not turn this into employment verification', 'never label someone Hot merely for a high salary or profession']],
  ['voluntary income', ['Ask permission BEFORE asking an income question', 'wait for explicit permission', 'Income already volunteered can be recorded without asking again']],
  ['income refusal', ['do not ask again or rephrase the income question', 'not a sales refusal, COLD signal or DNC request']],
  ['fixed budget', ['A fixed budget is a limit', 'numeric budget bands only if supported by actual verified inventory']],
  ['installments', ['compare only verified developer payment schedules', 'initial payment and monthly comfort']],
  ['mortgage', ['qualified lender/specialist must verify eligibility', 'do not promise approval or invent rates']],
  ['uncertain readiness', ['Uncertain readiness remains uncertain', 'financial_qualification_status=verification_pending']],
  ['guaranteed returns', ['Never guarantee rental income, appreciation, profits or future returns', 'market risk, service charges, transaction costs']],
] as const) test('Financial policy: ' + scenario, () => { for (const clause of clauses) assert.ok(prompt.includes(clause), clause); });

test('financial CRM facts survive notes round-trip without inferring purchasing power', () => {
  const first = mergeSalesLead({}, { profession: 'Engineer', approximate_income_range: 'AED 20000-25000 monthly', budget: 'AED 1.5M', payment_preference: 'installments', down_payment_comfort: 'AED 200000', monthly_payment_comfort: 'AED 6000', financing_interest: 'developer plan', funds_readiness: 'planning', financial_qualification_status: 'verification_pending' });
  const later = mergeSalesLead({ notes: first.notes }, { approximate_income_range: 'Unknown', income_discussion_permission: 'declined' });
  assert.equal(later.approximate_income_range, 'AED 20000-25000 monthly');
  assert.equal(later.monthly_payment_comfort, 'AED 6000');
  assert.equal(later.payment_preference, 'installments');
  assert.equal(later.funds_readiness, 'planning');
  assert.equal(later.financial_qualification_status, 'verification_pending');
  assert.equal(later.qualification_status, undefined);
  assert.equal(later.follow_up_permission, undefined);
  assert.equal(calculateAuthoritativeLeadScore({ profession: 'Engineer', approximate_income_range: 'AED 20000-25000 monthly' }).temperature, 'COLD');
  const secrets = normalizeLeadFields({ bank_balance: '100000', bank_password: 'secret', otp: '123456', bank_account_number: '1234567', budget: 'AED 1.5M' });
  assert.deepEqual(secrets, { budget: 'AED 1.5M' });
});
