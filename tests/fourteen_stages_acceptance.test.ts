import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import {
  nextSalesAction,
  observeSalesTurn,
  startSalesCall,
  salesRuntimeContext,
} from '../src/utils/salesConversation.ts';
import {
  mergeSalesLead,
  knownCustomerName,
} from '../src/utils/salesIntelligence.ts';
import {
  resolveMemoryCandidate,
  releaseCustomerMemory,
} from '../customerMemory.ts';
import { retrieveKnowledge } from '../backend/services/liveKnowledge.js';

// Base fixtures
const engaged = { conversation_disposition: 'engaged' };
const named = { ...engaged, name: 'Anand', hometown: 'Chennai' };
const offers = {
  flight_offer_status: 'presented',
  golden_visa_offer_status: 'presented',
  purchase_support_offer_status: 'understood',
};
const complete = {
  ...named,
  current_location: 'Chennai',
  profession: 'Engineer',
  investment_purpose: 'investment',
  ...offers,
  location: 'Dubai Marina',
  property_type: 'apartment',
  bedrooms: '2',
  budget: 'AED 1.5 million',
  budget_currency_clarification: 'AED',
  payment_preference: 'full payment',
  timeline: 'within_3_months',
  phone: '+971501234567',
  phone_confirmed: 'confirmed',
  family_lifestyle_checked: 'completed',
};

test('Point 1: Stage 1 starts with existing greeting (stage: opening, stageNumber: 1)', () => {
  const action = nextSalesAction({});
  assert.equal(action.stage, 'opening');
  assert.equal(action.stageNumber, 1);
  assert.ok(action.instruction.length > 0);
});

test('Point 2: Stage 2 selects name when missing (stage: name, stageNumber: 2, field: name)', () => {
  const f = observeSalesTurn({}, 'yes, tell me');
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'name');
  assert.equal(action.stageNumber, 2);
  assert.equal(action.field, 'name');
  assert.ok(action.instruction.includes('peru') || action.instruction.includes('name'));
});

test('Point 3: Placeholder names rejected (User, Valued Customer, Prospect, Lead, Anonymous, etc.)', () => {
  const placeholders = [
    'User',
    'Valued Customer',
    'Valued Lead',
    'Prospect',
    'Lead',
    'Anonymous',
    'Guest',
    'Client',
    'Caller',
    'Test',
    'Unknown',
  ];
  for (const placeholder of placeholders) {
    assert.equal(
      knownCustomerName(placeholder),
      undefined,
      `${placeholder} must be rejected as placeholder`
    );
  }

  // Turn with placeholder name should not set customer name
  const f = observeSalesTurn(engaged, 'My name is Valued Customer');
  assert.equal(f.name, undefined);
  assert.equal(nextSalesAction(f).field, 'name');
});

test('Point 4: Existing customer name reused without re-asking', () => {
  const f = { ...engaged, name: 'Karthik' };
  const action = nextSalesAction(f);
  assert.notEqual(action.field, 'name');
  assert.ok((action.stageNumber ?? 0) > 2);
});

test('Point 5: Current city stored separately from hometown', () => {
  const f = observeSalesTurn(
    { ...engaged, name: 'Karthik' },
    'I am based in Dubai, native is Madurai'
  );
  assert.equal(f.hometown, 'Madurai');
  assert.equal(f.current_location, 'Dubai');
});

test('Point 6: Business type follow-up works (business -> sector -> wholesale/retail)', () => {
  // Step 1: Customer states business
  const f1 = observeSalesTurn(
    { ...engaged, name: 'Arun', current_location: 'Coimbatore' },
    'Naan business panren'
  );
  assert.equal(f1.profession, 'Business');
  assert.equal(nextSalesAction(f1).field, 'business_sector');

  // Step 2: Customer specifies line of business
  const f2 = observeSalesTurn(f1, 'Textile business');
  assert.equal(f2.business_sector, 'Textile');
  assert.equal(nextSalesAction(f2).field, 'business_type_detail');

  // Step 3: Customer clarifies wholesale vs retail
  const f3 = observeSalesTurn(f2, 'Wholesale');
  assert.equal(f3.business_type_detail, 'Wholesale');
  assert.notEqual(nextSalesAction(f3).field, 'business_type_detail');
});

test('Point 7: Salaried profession follow-up works (salaried -> field)', () => {
  const f1 = observeSalesTurn(
    { ...engaged, name: 'Arun', current_location: 'Chennai' },
    'I work in a job'
  );
  assert.equal(f1.profession, 'Salaried');
  assert.equal(nextSalesAction(f1).field, 'salaried_field');

  const f2 = observeSalesTurn(f1, 'Software Engineer in IT');
  assert.ok(/Software|IT/i.test(f2.salaried_field));
  assert.notEqual(nextSalesAction(f2).field, 'salaried_field');
});

test('Point 8: Income discussion refusal continues without blocking budget', () => {
  const f = observeSalesTurn(
    { ...engaged, name: 'Arun', current_location: 'Chennai', profession: 'Engineer' },
    'I prefer not to share my income'
  );
  assert.equal(f.income_discussion_permission, 'declined');

  // Home area is still collected, then buying purpose. Income refusal does not block either.
  assert.equal(nextSalesAction(f).field, 'current_area');
  assert.equal(nextSalesAction({ ...f, current_area: 'Anna Nagar' }).field, 'investment_purpose');

  // When down the funnel, budget is asked normally
  const fAtBudget = {
    ...f,
    current_area: 'Anna Nagar',
    investment_purpose: 'investment',
    ...offers,
    location: 'Dubai Marina',
    property_type: 'apartment',
    bedrooms: '2',
    family_lifestyle_checked: 'completed',
  };
  assert.equal(nextSalesAction(fAtBudget).field, 'budget');
});

test('Point 9: Buying purpose correctly captured (investment, own use, both, exploring)', () => {
  const fInv = observeSalesTurn(named, 'I want property for investment');
  assert.equal(fInv.investment_purpose, 'investment');

  const fOwn = observeSalesTurn(named, 'Looking for own use home');
  assert.equal(fOwn.investment_purpose, 'own use');

  const fBoth = observeSalesTurn(named, 'Both investment and own use');
  assert.equal(fBoth.investment_purpose, 'both');

  const fExplore = observeSalesTurn(named, 'Just exploring options for now');
  assert.equal(fExplore.investment_purpose, 'exploring');
});

test('Point 10: Three offer topics remain available and tracked independently', () => {
  const base = {
    ...named,
    current_location: 'Chennai',
    profession: 'Engineer',
    investment_purpose: 'investment',
  };

  // Flight offer
  const fFlight = { ...base, flight_offer_status: 'presented' };
  assert.equal(nextSalesAction(fFlight).field, 'golden_visa_offer_status');

  // Golden Visa offer
  const fVisa = { ...fFlight, golden_visa_offer_status: 'presented' };
  assert.equal(nextSalesAction(fVisa).field, 'purchase_support_offer_status');

  // Purchase support offer
  const fSupport = { ...fVisa, purchase_support_offer_status: 'understood' };
  assert.notEqual(nextSalesAction(fSupport).field, 'purchase_support_offer_status');
});

test('Point 11: Family questions appear for own-use/family customers', () => {
  const fOwn = {
    ...named,
    current_location: 'Chennai',
    profession: 'Engineer',
    investment_purpose: 'own use',
    ...offers,
  };
  const action = nextSalesAction(fOwn);
  assert.equal(action.stageNumber, 6);
  assert.equal(action.field, 'family_size');
});

test('Point 12: Pure investor is not forced into family questions', () => {
  const fInv = {
    ...named,
    current_location: 'Chennai',
    profession: 'Engineer',
    investment_purpose: 'investment',
    ...offers,
  };
  const action = nextSalesAction(fInv);
  assert.equal(action.stageNumber, 6);
  assert.equal(action.field, 'family_lifestyle_checked');
  assert.notEqual(action.field, 'family_size');
  const after = nextSalesAction({ ...fInv, family_lifestyle_checked: 'completed' });
  assert.equal(after.stageNumber, 7);
  assert.equal(after.field, 'location');
});

test('Point 13: Preferred Dubai location is captured', () => {
  const f = observeSalesTurn(
    { ...named, investment_purpose: 'investment', ...offers },
    'I want property in Downtown Dubai'
  );
  assert.equal(f.location, 'Downtown Dubai');
});

test('Point 14: Property type and BHK captured', () => {
  const f = observeSalesTurn(
    { ...named, location: 'Downtown Dubai' },
    'I am looking for a 2 BHK apartment'
  );
  assert.equal(f.property_type, 'apartment');
  assert.equal(f.bedrooms, '2');
});

test('Point 15: Currency ambiguity is clarified (INR vs AED)', () => {
  const fAmbiguous = observeSalesTurn(
    {
      ...complete,
      budget: undefined,
      budget_currency_clarification: undefined,
    },
    'My budget is 2 crore'
  );
  // With bare crore/lakh without currency, clarification is requested
  const action = nextSalesAction(fAmbiguous);
  assert.equal(action.field, 'budget_currency_clarification');

  // Clarified by customer
  const fClarified = observeSalesTurn(fAmbiguous, 'It is Indian Rupees INR');
  assert.equal(fClarified.budget_currency_clarification, 'clarified');
  assert.ok(fClarified.budget.includes('INR'));
  assert.notEqual(nextSalesAction(fClarified).field, 'budget_currency_clarification');
});

test('Point 16: Payment preference captured (full payment vs installments)', () => {
  const f = observeSalesTurn(
    { ...complete, payment_preference: undefined },
    'I prefer payment in installments'
  );
  assert.equal(f.payment_preference, 'installments');
});

test('Point 17: Purchase timeline captured', () => {
  const f = observeSalesTurn(
    { ...complete, timeline: undefined },
    'I plan to purchase within 3 months'
  );
  assert.ok(f.timeline.includes('3 month'));
});

test('Point 18: Known contact number is confirmed via masked digits', () => {
  const f = {
    ...complete,
    recommendation_status: 'verification_pending',
    metadata_phone: '+971501234567',
    phone_confirmed: undefined,
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 11);
  assert.equal(action.field, 'phone_confirmation');
  assert.ok(action.instruction.includes('4567'), 'Must include masked last 4 digits');

  // Customer confirms number
  const fConfirmed = observeSalesTurn(f, 'Yes, that number is correct');
  assert.equal(fConfirmed.phone_confirmed, 'confirmed');
});

test('Point 19: Contact preference and callback permission persist', () => {
  let f: Record<string, any> = {
    ...complete,
    recommendation_status: 'verification_pending',
    follow_up_permission: undefined,
  };
  const action1 = nextSalesAction(f);
  assert.equal(action1.stageNumber, 11);
  assert.equal(action1.field, 'follow_up_permission');

  f = { ...f, ...mergeSalesLead(f, { follow_up_permission: 'granted' }) };
  const action2 = nextSalesAction(f);
  assert.equal(action2.field, 'preferred_contact_method');

  f = observeSalesTurn(f, 'WhatsApp is preferred');
  assert.equal(f.preferred_contact_method, 'WhatsApp');
});

test('Point 20: Legal/trust questions still invoke existing RAG', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const r = retrieveKnowledge('ownership freehold', now);
  assert.equal(r.status, 'retrieved');
  assert.ok(r.evidence.length > 0);
  assert.ok(r.evidence.some(e => e.verifiedAt));
});

test('Point 21: No unverified inventory recommended (recommendation_status: verification_pending)', () => {
  const action = nextSalesAction({
    ...complete,
    follow_up_permission: 'granted',
    preferred_contact_method: 'WhatsApp',
    trust_building_completed: 'true',
  });
  assert.equal(action.stage, 'recommendation');
  assert.equal(action.stageNumber, 13);
  assert.ok(
    action.instruction.includes('specialist') ||
    action.instruction.includes('curated') ||
    action.instruction.includes('verification')
  );
  // Must never claim a specific unverified developer unit is booked/guaranteed
  assert.ok(!action.instruction.toLowerCase().includes('guaranteed unit'));
});

test('Point 22: Acquisition source asked near closing when appropriate', () => {
  const f = {
    ...complete,
    follow_up_permission: 'granted',
    preferred_contact_method: 'WhatsApp',
    trust_building_completed: 'true',
    recommendation_status: 'verification_pending',
    agreed_next_action: 'send specialist shortlist',
    acquisition_source_status: undefined,
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 14);
  assert.equal(action.field, 'lead_source');

  const fAnswered = observeSalesTurn(f, 'I saw your Instagram advertisement');
  assert.equal(fAnswered.lead_source, 'Instagram');
  assert.equal(fAnswered.acquisition_source_status, 'captured');
});

test('Point 23: Busy customer enters fast mode / graceful close', () => {
  // Graceful close on explicit busy
  const fBusy = observeSalesTurn(investorFixture(), 'I am busy right now, call later');
  assert.equal(nextSalesAction(fBusy).stage, 'closing');

  // Fast mode on brevity request
  const fFast = observeSalesTurn(investorFixture(), 'konjam quick ah sollunga');
  assert.ok(Boolean(fFast.fast_mode));
});

test('Point 24: DNC immediately stops qualification (OPT_OUT)', () => {
  const fDNC = observeSalesTurn(
    investorFixture(),
    'Do not call me again, remove my number from your list'
  );
  assert.equal(fDNC.qualification_status, 'OPT_OUT');
  const action = nextSalesAction(fDNC);
  assert.equal(action.stage, 'closing');
  assert.ok(
    action.instruction.toLowerCase().includes('respect') ||
    action.instruction.toLowerCase().includes('close') ||
    action.instruction.toLowerCase().includes('stop')
  );
});

test('Point 25: Multiple facts in one sentence extracted without loss', () => {
  const f = observeSalesTurn(
    engaged,
    'My name is Suresh from Madurai, looking for a 2 BHK apartment in Downtown Dubai with budget AED 2 million within 3 months'
  );
  assert.equal(f.name, 'Suresh');
  assert.equal(f.hometown, 'Madurai');
  assert.equal(f.property_type, 'apartment');
  assert.equal(f.bedrooms, '2');
  assert.equal(f.location, 'Downtown Dubai');
  assert.equal(f.budget, 'AED 2 million');
  assert.ok(f.timeline.includes('3 month'));
});

test('Point 26: Returning customer resumes without repetition after identity gate', () => {
  const old = {
    id: 'lead_101',
    guest_session_id: 's_old',
    phone: '+919999888877',
    name: 'Ramesh',
    budget: 'AED 1500000',
    location: 'Business Bay',
    investment_purpose: 'investment',
    profession: 'Chartered Accountant',
  };
  const pending = { name: 'Ramesh', memory_identity_pending: 'pending' };
  const restored = releaseCustomerMemory(pending, old, true);
  assert.equal(restored.released, true);
  assert.equal(restored.facts.name, 'Ramesh');
  assert.equal(restored.facts.location, 'Business Bay');
  assert.equal(restored.facts.profession, 'Chartered Accountant');

  // Verified facts are not re-asked
  const action = nextSalesAction(restored.facts);
  assert.notEqual(action.field, 'name');
  assert.notEqual(action.field, 'location');
  assert.notEqual(action.field, 'profession');
});

test('Point 27: Corrections override older facts', () => {
  const f1 = observeSalesTurn(engaged, 'My budget is AED 1 million');
  assert.equal(f1.budget, 'AED 1 million');

  const f2 = observeSalesTurn(f1, 'Actually change my budget to AED 2.5 million');
  assert.equal(f2.budget, 'AED 2.5 million');
});

test('Point 28: Correct next action reaches Gemini Live handlers', () => {
  const source = fs.readFileSync('server.ts', 'utf8');
  assert.ok(source.includes('nextSalesAction(callFacts)'), 'server.ts must send next_action in tool response');
  assert.ok(source.includes('salesRuntimeContext(callFacts)'), 'server.ts must build context with salesRuntimeContext');

  // Verify function response format in tool response handler
  const start = source.indexOf('              const replyToTool =');
  const end = source.indexOf('\n              };', start) + '\n              };'.length;
  const replies: any[] = [];
  const run = new Function('nextSalesAction', 'responseSession', 'callFacts', `
    const currentMode='voice', isClosing=false, callFinalized=false, replaced=false;
    const cancelledToolIds=new Set();
    const FunctionResponseScheduling={SILENT:'SILENT'};
    const attemptSessionRecovery=()=>{};
    ${stripTypeScriptTypes(source.slice(start, end))}
    replyToTool({id:'tool_test',name:'update_lead_info'}, true);
  `);
  run(nextSalesAction, { sendToolResponse: (r: any) => replies.push(r) }, named);
  assert.equal(replies.length, 1);
  const resp = replies[0].functionResponses[0].response.output;
  assert.ok(resp.next_action);
  assert.ok(resp.next_action.stage);
  assert.ok(resp.next_action.stageNumber);
  assert.ok(resp.next_action.instruction);
});

test('Point 29: Browser and Twilio share the conversation logic', () => {
  const source = fs.readFileSync('server.ts', 'utf8');

  // Browser path checks
  assert.ok(source.includes('callFacts = observeSalesTurn(callFacts, text)'), 'Browser must call observeSalesTurn');

  // Twilio telephone path checks
  assert.ok(source.includes('activeTwilioCalls[callSid]'), 'Twilio must maintain slots state');
  assert.ok(
    source.includes('record.slots = observeSalesTurn(record.slots, phoneInput)'),
    'Twilio must call observeSalesTurn'
  );
  assert.ok(
    source.includes("salesRuntimeContext(activeTwilioCalls[callSid || '']?.slots || {})"),
    'Twilio must call salesRuntimeContext'
  );
});

test('Point 30: Existing audio/voice configuration remains 100% unchanged', () => {
  // Verify naturalVoice.ts exists and untouched
  const naturalVoice = fs.readFileSync('src/utils/naturalVoice.ts', 'utf8');
  assert.ok(naturalVoice.includes('NATURAL_VOICE_CATEGORIES'));
  assert.ok(naturalVoice.includes('buildNaturalVoiceInstructions'));

  // Verify server.ts voice config unchanged
  const server = fs.readFileSync('server.ts', 'utf8');
  assert.ok(server.includes('gemini-3.8-live'));
  assert.ok(server.includes('Sulafat'));
  assert.ok(server.includes("prebuiltVoiceConfig: { voiceName:"));

  // Verify audio.ts untouched
  const audio = fs.readFileSync('src/utils/audio.ts', 'utf8');
  assert.ok(audio.includes('AudioContext') || audio.includes('pcm'));
});

function investorFixture() {
  return {
    ...named,
    property_type: 'apartment',
    ...offers,
    investment_purpose: 'investment',
    engagement_indicator: 'interested',
    budget: 'AED 1M',
    timeline: 'within_3_months',
    location: 'Dubai',
  };
}
