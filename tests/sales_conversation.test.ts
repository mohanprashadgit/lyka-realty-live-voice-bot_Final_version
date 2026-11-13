import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { nextSalesAction as next, observeSalesTurn as turn, startSalesCall, salesRuntimeContext } from '../src/utils/salesConversation.ts';
import { determineLeadStatusFromData } from '../src/utils/scoring.ts';
import { mergeSalesLead } from '../src/utils/salesIntelligence.ts';
import { customerAskedForWait } from '../src/utils/customerWaitRequest.ts';

const engaged = { conversation_disposition: 'engaged' };
const named = { ...engaged, name: 'Anand', hometown: 'Chennai' };
const offers = { flight_offer_status: 'presented', golden_visa_offer_status: 'presented', purchase_support_offer_status: 'understood' };
const investor = { ...named, profession: 'Engineer', property_type: 'apartment', bedrooms: '2', ...offers, investment_purpose: 'investment', engagement_indicator: 'interested', budget: 'AED 1M', timeline: 'within_3_months', location: 'Dubai', phone: '+971501234567', family_lifestyle_checked: 'completed' };
const complete = { ...investor, property_type: 'apartment', profession: 'Engineer', bedrooms: '2', budget: 'AED 1M', payment_preference: 'full payment', location: 'Dubai', timeline: 'next year', follow_up_permission: 'granted', preferred_contact_method: 'WhatsApp', trust_building_completed: 'true' };

test('new customer: opening, permission, name, purpose', () => {
  assert.equal(next({}).stage, 'opening');
  let f = turn({}, 'yes');
  assert.equal(next(f).field, 'name');
  f = turn(f, 'My name is Anand');
  assert.equal(next(f).field, 'current_location');
  f = turn(f, "I'm from Chennai.");
  assert.equal(next(f).field, 'investment_purpose');
});
test('saved name skips name', () => assert.equal(next(named).field, 'investment_purpose'));
test('database column aliases restore budget and location without asking again', () => {
  const f = startSalesCall({ budget_max: 1500000, currency: 'AED', original_location: 'Dubai Marina' });
  assert.equal(f.budget, 'AED maximum 1500000');
  assert.equal(f.location, 'Dubai Marina');
});
test('voluntary income refusal does not decline unrelated pending question', () => {
  const f = turn(named, 'I prefer not to share my income');
  assert.equal(f.income_discussion_permission, 'declined');
  assert.equal(next(f).field, 'investment_purpose');
});
test('name and approximate budget together are preserved', () => {
  const f = turn(engaged, 'My name is Anand and budget is AED 1.5 million');
  assert.equal(f.name, 'Anand'); assert.equal(f.budget, 'AED 1.5 million');
  assert.equal(next(f).field, 'current_location');
});
test('refused name is not repeated', () => assert.equal(next(turn(engaged, 'I prefer not to share')).field, 'current_location'));
test('investment skips family after offers', () => assert.equal(next({ ...investor, property_type: undefined }).field, 'property_type'));
test('family use proactively asks family size', () => assert.equal(next({ ...investor, investment_purpose: 'own use' }).field, 'family_size'));
test('family refusal advances without forcing children disclosure', () => {
  const f = turn({ ...investor, investment_purpose: 'own use' }, 'I prefer not to share');
  assert.equal(next(f).field, 'family_relocation');
});
test('income refusal never blocks budget qualification', () => assert.equal(next({ ...investor, property_type: 'villa', profession: 'declined', budget: undefined, income_discussion_permission: 'declined' }).field, 'budget'));
test('approximate budget skips the budget question', () => assert.equal(next(turn({ ...investor, property_type: 'villa', profession: 'Engineer' }, 'budget is AED 2 million')).field, 'payment_preference'));
test('installments selects payment comfort', () => assert.equal(next(turn(complete, 'I prefer installments')).field, 'down_payment_comfort'));
test('interrupted offer stays pending; completed offers do not restart', () => {
  const f = { ...named, profession: 'Engineer', property_type: 'villa', budget: 'AED 1M', timeline: 'within_3_months', investment_purpose: 'investment', flight_offer_status: 'presented' };
  const merged = { ...f, ...mergeSalesLead(f, { golden_visa_offer_status: 'interrupted' }) };
  assert.equal(next(merged).field, 'golden_visa_offer_status');
});
for (const [label, field, text] of [
  ['Golden Visa question', 'golden_visa_offer_status', 'Can I get a Golden Visa?'],
  ['flight booking question', 'flight_offer_status', 'How are flight tickets arranged?'],
  ['support question', 'purchase_support_offer_status', 'What purchase support is provided?'],
]) test(label + ' preserves remaining offer workflow', () => {
  const f: Record<string, any> = { ...investor }; delete f[field];
  assert.equal(next(turn(f, text)).field, field);
});
test('competitor objection starts evidence discovery without resetting facts', () => {
 const f=turn(complete,'A competitor has cheaper properties');
 assert.equal(next(f).field,'competitor_name'); assert.equal(f.budget,complete.budget);
});
for (const [scenario, text] of [['busy', 'I am busy'], ['angry', 'Stop bothering me'], ['end call', 'End the call']])
  test(scenario + ' stops qualification immediately', () => assert.equal(next(turn(investor, text)).stage, 'closing'));
test('topic change preserves unfinished stage', () => assert.equal(next(turn(named, 'What is the weather?')).field, 'investment_purpose'));
test('already knows all offers skips them', () => assert.equal(next({ ...investor, property_type: undefined }).field, 'property_type'));
test('full workflow reaches verification, consent and closing', () => {
  const base = { ...investor, property_type: 'apartment', profession: 'Engineer', bedrooms: '2', budget: 'AED 1M', payment_preference: 'full payment', location: 'Dubai', timeline: 'next year', phone_confirmed: 'confirmed' };
  assert.equal(next(base).field, 'follow_up_permission');
  let f: Record<string, any> = { ...base, follow_up_permission: 'granted' };
  assert.equal(next(f).field, 'preferred_contact_method');
  f = turn(f, 'Email is fine.');
  assert.equal(next(f).field, 'trust_building_completed');
  f = { ...f, trust_building_completed: 'true' };
  assert.equal(next(f).stage, 'recommendation');
  f = { ...f, recommendation_status: 'verification_pending' };
  assert.equal(next(f).field, 'agreed_next_action');
  f = { ...f, ...mergeSalesLead(f, { agreed_next_action: 'Consultation tomorrow' }) };
  assert.equal(next(f).stage, 'closing');
});
test('CRM round trip preserves progress but new call requires permission', () => {
  const persisted = { ...complete, ...mergeSalesLead(complete, { conversation_disposition: 'engaged', declined_fields: 'family_size' }) };
  assert.equal(next(persisted).stage, 'recommendation');
  assert.equal(next(startSalesCall(persisted)).stage, 'opening');
  assert.ok(salesRuntimeContext(persisted).includes('AED 1M'));
});

test('actual browser transcript handler updates state and saves CRM without a generation trigger', async () => {
  const source = fs.readFileSync('server.ts', 'utf8');
  const start = source.indexOf('  const updateSalesTurn =');
  const end = source.indexOf('\n  };', start) + '\n  };'.length;
  const sent: any[] = [], saves: any[] = [];
  const run = new Function('observeSalesTurn', 'salesRuntimeContext', 'liveSession', 'upsertLead', 'safeSend', 'nextSalesAction', `
    let currentMode='voice', callFacts={}, journal=null, wsSessionId='test', wsLeadPhone='', wsConversationId='';
    ${stripTypeScriptTypes(source.slice(start, end))}
    updateSalesTurn('yes'); updateSalesTurn('My name is Anand and budget is AED 1 million');
    return callFacts;
  `);
  const facts = run(turn, salesRuntimeContext, { sendClientContent: (v: any) => sent.push(v) }, async (...args: any[]) => { saves.push(args); return { success: true }; }, () => {}, next);
  assert.equal(next(facts).field, 'current_location');
  assert.equal(saves.at(-1)[1].budget, 'AED 1 million');
  assert.equal(sent.length, 0, 'ASR must not call sendClientContent');
});

test('actual browser tool reply returns decision even when CRM save fails', () => {
  const source = fs.readFileSync('server.ts', 'utf8');
  const start = source.indexOf('              const replyToTool =');
  const end = source.indexOf('\n              };', start) + '\n              };'.length;
  const replies: any[] = [];
  const run = new Function('nextSalesAction', 'responseSession', 'callFacts', `
    const currentMode='voice', isClosing=false, callFinalized=false, replaced=false;
    const cancelledToolIds=new Set();
    const FunctionResponseScheduling={SILENT:'SILENT'};
    const attemptSessionRecovery=()=>{};
    ${stripTypeScriptTypes(source.slice(start, end))}
    replyToTool({id:'tool1',name:'update_lead_info'}, false);
  `);
  run(next, { sendToolResponse: (r: any) => replies.push(r) }, named);
  const output = replies[0].functionResponses[0].response.output;
  assert.equal(output.success, false);
  assert.equal(output.next_action.field, 'investment_purpose');
  assert.match(output.error, /save failed/);
});

test('actual Twilio transcript block applies the same stop decision without a generation trigger', () => {
  const source = fs.readFileSync('server.ts', 'utf8');
  const start = source.indexOf('if (callSid && activeTwilioCalls[callSid]) {', source.indexOf('if (phoneInput.trim()'));
  const end = source.indexOf('const decision = phoneRejections.consume(phoneInput);', start);
  const sent: any[] = [];
  const records = { test: { slots: investor } };
  // The extracted slice references several outer scoped values (farewell
  // cancel guard, silence wait-hold helpers, pause timestamp); the harness
  // provides them as scope values so the snippet executes standalone.
  new Function('callSid', 'activeTwilioCalls', 'phoneInput', 'phoneFarewellDetected', 'phoneCloseTimer', 'observeSalesTurn', 'salesRuntimeContext', 'liveSession', 'customerAskedForWait', 'holdPhoneSilenceForWaitRequest', 'clearPhoneSilenceWaitHold', 'phoneSilencePausedUntil', stripTypeScriptTypes(source.slice(start, end)))('test', records, 'I am busy', false, undefined, turn, salesRuntimeContext, { sendClientContent: (v: any) => sent.push(v) }, customerAskedForWait, () => {}, () => {}, 0);
  assert.equal(next(records.test.slots).stage, 'closing');
  assert.equal(sent.length, 0, 'telephone ASR must not inject context');
});

test('Tamil investor answers are stored and the lead stays warm', () => {
  let f: Record<string, any> = {};
  for (const line of [
    'பேசுங்க.',
    'investment',
    'ஓகே, நான் வந்து அகாடமிஷியன். ப்ரொஃபசர்.',
    'research in cyber security',
    'ஜenerallah search பண்ணுங்க.',
    'ஒரு டூ 2.5 மில்லியன் ஏஇடி.',
    'ஃULL பேமெண்ட், இஃப் பாசிபிள் கிரிப்டோ அல்லது வயர் டிரான்ஸ்ஃபர்.',
    'immediate consideration',
    'ஆ சரி.',
    'WhatsApp',
  ]) f = turn(f, line);
  assert.equal(f.conversation_disposition, 'engaged');
  assert.equal(f.investment_purpose, 'investment');
  assert.equal(f.intent, 'invest');
  assert.equal(f.profession, 'Professor');
  assert.equal(f.salaried_field, 'Cyber security');
  assert.equal(f.location, 'flexible');
  assert.equal(f.budget, 'AED 1 to 2.5 million');
  assert.equal(f.payment_preference, 'full payment');
  assert.equal(f.timeline, 'immediate');
  assert.equal(f.preferred_contact_method, 'WhatsApp');
  assert.equal(f.follow_up_permission, 'granted');
  assert.equal(determineLeadStatusFromData(f).outcome, 'WARM');
});

test('personal-use Tamil answers are stored and the missing family question stays open', () => {
  let f: Record<string, any> = {};
  for (const line of [
    'நான் பேசுறேன்.',
    'Satish personal purpose.',
    'இந்தியால இருந்து எக்ஸ்போ.',
    'நான் வந்து ப்ரொஃபசரா இருக்கேன்.',
    'இல்ல, எனக்கு இத பத்தி ஆல்ரெடி தெரியும். உங்க அட்வர்டைஸ்மென்ட்ல பாத்துருக்கேன்.',
    'சூட்டபிள் ஆச்சு. லொகேஷன்ஸ் ஆச்சு.',
    'வில்லா வில்லா ப்ராப்பர்ட்டீஸ்',
    '4 BHK',
    'ஒரு 25 க்ரோர்ஸ்.',
    'INR full payment',
    'இம்மediate.',
    'WhatsApp',
    'ஒரு 10:30',
  ]) f = turn(f, line);
  assert.equal(f.name, 'Satish');
  assert.equal(f.investment_purpose, 'own use');
  assert.equal(f.intent, 'buy');
  assert.equal(f.current_location, 'India');
  assert.equal(f.profession, 'Professor');
  assert.equal(f.lead_source, 'Advertisement');
  assert.equal(f.flight_offer_status, 'understood');
  assert.equal(f.location, 'flexible');
  assert.equal(f.property_type, 'villa');
  assert.equal(f.bedrooms, '4');
  assert.equal(f.budget, 'INR 25 crore');
  assert.equal(f.payment_preference, 'full payment');
  assert.equal(f.timeline, 'immediate');
  assert.equal(f.preferred_contact_method, 'WhatsApp');
  assert.equal(f.best_time_to_contact, '10:30');
  assert.equal(next(f).field, 'family_size');
  assert.equal(determineLeadStatusFromData(f).outcome, 'HOT');
});
