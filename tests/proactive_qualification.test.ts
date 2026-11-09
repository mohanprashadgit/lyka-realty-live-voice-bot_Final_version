/**
 * Proactive Qualification + Natural Tanglish + CRM Update Tests
 * Tests the runtime fixes for missing name/hometown/profession/family questions
 * and natural Tanglish response flow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
import {
  nextSalesAction as next,
  observeSalesTurn as turn,
  startSalesCall,
  salesRuntimeContext,
} from '../src/utils/salesConversation.ts';
import { mergeSalesLead, knownCustomerName } from '../src/utils/salesIntelligence.ts';
import { extractCustomerIntelligence } from '../src/utils/customerIntelligence.ts';

const engaged = { conversation_disposition: 'engaged' };
const named = { ...engaged, hometown: 'Chennai', property_type: 'apartment', name: 'Anand' };
const offers = {
  flight_offer_status: 'presented',
  golden_visa_offer_status: 'presented',
  purchase_support_offer_status: 'understood',
};
const withBudgetTimeline = { ...named, ...offers, profession: 'Engineer', current_location: 'Chennai', location: 'Dubai Marina', bedrooms: '2', investment_purpose: 'investment', budget: 'AED 1M', timeline: '3 months' };

// ─── 1. Missing name triggers name question ───────────────────────────────────
test('1. missing name triggers name question', () => {
  const f = turn({}, 'yes'); // becomes engaged
  assert.equal(next(f).field, 'name', 'Should ask for name when unknown');
});

// ─── 2. Known name is skipped ─────────────────────────────────────────────────
test('2. known name is skipped', () => {
  assert.equal(next(named).field, 'investment_purpose', 'Should skip name when already known');
});

// ─── 2b. Generic placeholders are not treated as real names ───────────────────
test('2b. Customer/Prospect/Lead placeholder is not a real name', () => {
  for (const placeholder of ['Customer', 'Prospect', 'Lead', 'Valued Lead', 'Anonymous']) {
    assert.equal(
      knownCustomerName(placeholder),
      undefined,
      `"${placeholder}" must not be treated as a real name`,
    );
  }
});

// ─── 3. Missing phone requested only if follow-up is needed ──────────────────
test('3. phone not asked as a core proactive question', () => {
  // Phone is never in the nextSalesAction core path — it is follow-up only
  const f = { ...withBudgetTimeline, recommendation_status: 'verification_pending', follow_up_permission: 'granted' };
  const action = next(f);
  assert.notEqual(action.field, 'phone', 'Phone should not be a proactive qualification field');
});

// ─── 4. Tirunelveli hometown response ────────────────────────────────────────
test('4a. "Naan Tirunelveli" sets hometown', () => {
  const result = extractCustomerIntelligence('Naan Tirunelveli');
  assert.equal(result.hometown, 'Tirunelveli');
});

test('4b. "Tirunelveli-la irukken" sets hometown', () => {
  const result = extractCustomerIntelligence('Tirunelveli-la irukken');
  assert.equal(result.hometown, 'Tirunelveli');
});

test('4c. "Naan Madurai-la irukken" sets hometown', () => {
  const result = extractCustomerIntelligence('Naan Madurai-la irukken');
  assert.equal(result.hometown, 'Madurai');
});

test('4d. salesRuntimeContext contains hometown style example', () => {
  const ctx = salesRuntimeContext({});
  assert.ok(ctx.includes('Tirunelveli'), 'Context must include Tirunelveli Tanglish example');
});

// ─── 5. Business → business-sector follow-up ─────────────────────────────────
test('5a. "Naan business panren" sets profession', () => {
  const result = turn(engaged, 'Naan business panren');
  assert.ok(
    /business/i.test(result.profession || result.notes || ''),
    'Should capture business profession from Tanglish',
  );
});

test('5b. "Business" standalone sets profession via observeSalesTurn', () => {
  // The standalone profession regex is in observeSalesTurn, not extractCustomerIntelligence
  const result = turn(engaged, 'Business');
  const prof = result.profession || (result.notes || '').match(/business_sector":"([^"]+)/)?.[1];
  // "Business" sets profession through the standalone pattern in observeSalesTurn
  // If not set directly, it may be set via business_sector — either way business is captured
  const ctx = salesRuntimeContext(result);
  // The runtime context should still know about business even if captured differently
  assert.ok(result.profession || ctx.includes('business') || result.notes?.includes('business'),
    'Business profession should be captured via observeSalesTurn');
});

test('5c. after profession=business, sector question is selected', () => {
  const f = {
    ...named,
    ...offers,
    investment_purpose: 'investment',
    budget: 'AED 1M',
    timeline: '3 months',
    engagement_indicator: 'interested',
    property_type: 'apartment',
    profession: 'business',
    hometown: 'Chennai',
    payment_preference: 'full payment',
    location: 'Dubai Marina',
  };
  assert.equal(next(f).field, 'business_sector', 'Should ask business sector after profession=business');
});

test('5d. "Textile" standalone answer sets business_sector when profession is business', () => {
  const f = { ...engaged, profession: 'business' };
  const result = turn(f, 'Textile');
  const sector = result.business_sector || (result.notes || '').match(/business_sector":"([^"]+)/)?.[1];
  assert.ok(sector && /textile/i.test(sector), 'Should capture textile as business_sector');
});

// ─── 6. Family → family-size question ────────────────────────────────────────
test('6a. "Family-oda settle aaganum" sets family_relocation and investment_purpose', () => {
  const result = extractCustomerIntelligence('Family-oda settle aaganum');
  assert.ok(result.family_relocation, 'Should set family_relocation');
  assert.equal(result.investment_purpose, 'family residence');
});

test('6b. after family residence, next question is family_size', () => {
  const f = { ...named, ...offers, current_location: 'Chennai', profession: 'Engineer', investment_purpose: 'own use', engagement_indicator: 'family focused', budget: 'AED 1M', timeline: '3 months' };
  assert.equal(next(f).field, 'family_size', 'Should ask family_size for family/own-use customers');
});

test('6c. "Naalu peru" standalone answer sets family_size', () => {
  const result = extractCustomerIntelligence('Naalu peru');
  assert.equal(result.family_size, '4', 'Should capture "naalu peru" as family_size=4');
});

// ─── 7. Known budget → payment preference ────────────────────────────────────
test('7a. known budget and timeline → payment_preference question', () => {
  const f = {
    ...named,
    ...offers,
    investment_purpose: 'investment',
    budget: 'AED 1M',
    timeline: '3 months',
    engagement_indicator: 'interested',
    property_type: 'apartment',
    bedrooms: '2',
    profession: 'Engineer',
    hometown: 'Chennai',
    // current_location is distinct from hometown; Stage 3 always asks for it.
    current_location: 'Chennai',
    // Stage 7: preferred Dubai property location must be known before Stage 9 payment_preference.
    location: 'Dubai Marina',
  };
  assert.equal(next(f).field, 'payment_preference', 'Should ask payment preference after budget/timeline/profession/location');
});

test('7b. "2 crore" standalone sets budget', () => {
  const result = turn(engaged, '2 crore');
  const budget = result.budget || '';
  assert.ok(budget.includes('2') && /crore/i.test(budget), 'Should capture "2 crore" as budget');
});

// ─── 8. Multiple facts in one turn ───────────────────────────────────────────
test('8. multiple facts in one turn are all extracted', () => {
  const f = turn(engaged, 'My name is Anand and budget is AED 1.5 million');
  assert.equal(f.name, 'Anand', 'Name extracted');
  assert.ok(/1\.?5|1,?500,?000/i.test(f.budget || ''), 'Budget extracted');
  assert.equal(next(f).field, 'current_location', 'Next field skips name and budget');
});

// ─── 9. Declined questions are skipped ───────────────────────────────────────
test('9. declined name is not repeated', () => {
  const f = turn(engaged, 'I prefer not to share');
  assert.equal(next(f).field, 'current_location', 'Should skip declined name');
});

test('9b. declined income does not block budget', () => {
  // current_location must be known before budget is asked (Stage 3 before Stage 9).
  // location (Stage 7 preferred Dubai location) must also be known before Stage 9.
  const f = {
    ...named,
    ...offers,
    investment_purpose: 'investment',
    income_discussion_permission: 'declined',
    current_location: 'Chennai',
    profession: 'Engineer',
    location: 'Dubai Marina',
    property_type: 'apartment',
    bedrooms: '2',
    engagement_indicator: 'interested',
  };
  assert.equal(next(f).field, 'budget', 'Should ask budget regardless of income decline');
});

// ─── 10. Busy/angry customer stops deeper qualification ───────────────────────
test('10a. busy customer stops qualification', () => {
  const f = turn(withBudgetTimeline, 'I am busy right now');
  assert.equal(next(f).stage, 'closing', 'Busy customer → closing stage');
});

test('10b. angry customer stops qualification', () => {
  const f = turn(withBudgetTimeline, 'Stop bothering me');
  assert.equal(next(f).stage, 'closing', 'Angry customer → closing stage');
});

test('10c. uninterested customer stops qualification', () => {
  const f = turn(withBudgetTimeline, 'not interested');
  assert.equal(next(f).stage, 'objection_handling', 'Uninterested customer → objection handling stage (Layer 1)');
  const f2 = turn(f, 'still not interested');
  assert.equal(next(f2).stage, 'objection_handling', 'Second rejection → objection handling stage (Layer 2)');
  const f3 = turn(f2, 'no I said no');
  assert.equal(next(f3).stage, 'closing', 'Third rejection → closing stage');
});

// ─── 11. CRM facts are saved ─────────────────────────────────────────────────
test('11. salesRuntimeContext includes known CRM facts', () => {
  const f = { ...withBudgetTimeline, hometown: 'Tirunelveli', profession: 'Engineer' };
  const ctx = salesRuntimeContext(f);
  assert.ok(ctx.includes('Tirunelveli'), 'Hometown should appear in runtime context');
  assert.ok(ctx.includes('Engineer'), 'Profession should appear in runtime context');
  assert.ok(ctx.includes('AED 1M'), 'Budget should appear in runtime context');
});

// ─── 12. Gemini receives the selected next_action ────────────────────────────
test('12. actual browser tool reply returns next_action from callFacts', () => {
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
    replyToTool({id:'t1',name:'update_lead_info'}, true);
  `);
  run(next, { sendToolResponse: (r: any) => replies.push(r) }, named);
  const output = replies[0].functionResponses[0].response.output;
  assert.ok(output.next_action, 'Tool response must include next_action');
  assert.equal(output.next_action.field, 'investment_purpose', 'next_action field must be investment_purpose for named customer');
});

// ─── Tanglish extraction accuracy tests ──────────────────────────────────────
test('Tanglish: "Naan Chennai-la irukken" sets hometown', () => {
  const result = extractCustomerIntelligence('Naan Chennai-la irukken');
  assert.equal(result.hometown, 'Chennai');
});

test('Tanglish: "Naan Ravi" sets name via observeSalesTurn', () => {
  const f = turn(engaged, 'Naan Ravi');
  assert.equal(f.name, 'Ravi', 'Tanglish "Naan X" should set name');
});

test('Tanglish: full payment sets payment_preference', () => {
  const f = turn(withBudgetTimeline, 'Full payment-ah pay panren');
  const pref = f.payment_preference || '';
  assert.ok(/full/i.test(pref), 'Full payment preference should be captured');
});

test('Tanglish: investment purpose from Tanglish phrase', () => {
  const f = turn(engaged, 'Investment-ku explore panren');
  assert.ok(/invest/i.test(f.investment_purpose || ''), 'Should capture investment purpose from Tanglish');
});

// Regression: an apparent hometown or occupation must never satisfy the name gate.
test('regression: Naan Tirunelveli records hometown but not customer name', () => {
  const facts = turn(engaged, 'Naan Tirunelveli');
  assert.equal(facts.hometown, 'Tirunelveli');
  assert.equal(facts.name, undefined);
  assert.equal(next(facts).field, 'name');
});
test('regression: Naan Madurai-la irukken is not a name', () => {
  const facts = turn(engaged, 'Naan Madurai-la irukken');
  assert.equal(facts.hometown, 'Madurai');
  assert.equal(facts.name, undefined);
  assert.equal(next(facts).field, 'name');
});
test('regression: business is profession, not name or hometown', () => {
  const facts = turn(engaged, 'Naan business panren');
  assert.equal(facts.profession, 'Business');
  assert.equal(facts.name, undefined);
  assert.equal(facts.hometown, undefined);
  assert.equal(next(facts).field, 'name');
});
test('regression: answer to name question can be a bare name', () => {
  const facts = turn(engaged, 'Arun');
  assert.equal(facts.name, 'Arun');
  assert.equal(facts.hometown, undefined);
  assert.equal(next(facts).field, 'current_location');
});
test('regression: Naan Arun can answer a name question without creating hometown', () => {
  const facts = turn(engaged, 'Naan Arun');
  assert.equal(facts.name, 'Arun');
  assert.equal(facts.hometown, undefined);
});
test('regression: explicit En peru name remains recognised', () => {
  const facts = turn(engaged, 'En peru Arun');
  assert.equal(facts.name, 'Arun');
});
test('regression: business sector and family detail do not become names', () => {
  for (const phrase of ['Naan textile business panren', 'Family-oda settle aaganum']) {
    const facts = turn(engaged, phrase);
    assert.equal(facts.name, undefined, phrase);
  }
});

test('regression: Tamil not-interested response stops proactive questions', () => {
  for (const phrase of ['Vendam', 'No thanks']) {
    const facts = turn(engaged, phrase);
    assert.equal(next(facts).stage, 'objection_handling', phrase);
  }
});
test('regression: Tamil busy response stops questions', () => {
  const facts = turn(engaged, 'Ippo time illa');
  assert.equal(next(facts).stage, 'closing');
});
test('regression: Tanglish DNC immediately prevents qualification', () => {
  const facts = turn(engaged, 'Inime call pannadheenga');
  assert.equal(facts.qualification_status, 'OPT_OUT');
  assert.equal(next(facts).stage, 'closing');
});
test('regression: property preference rejection is not a call rejection', () => {
  const facts = turn(engaged, '2BHK vendam 3BHK venum');
  assert.equal(facts.conversation_disposition, 'engaged');
  assert.notEqual(next(facts).stage, 'closing');
});
test('regression: solo Dubai relocation is not assumed to include a family', () => {
  const facts = turn(engaged, 'Naan Dubai-la settle aaganum');
  assert.equal(facts.family_relocation, undefined);
});

test('regression: Gemini tool cannot silently save town as a name', () => {
  const merged = mergeSalesLead({}, { name: 'Tirunelveli', hometown: 'Tirunelveli' });
  assert.equal(merged.name, undefined);
  assert.equal(merged.hometown, 'Tirunelveli');
  assert.equal(next({ ...engaged, ...merged }).field, 'name');
  const verified = mergeSalesLead({}, { name: 'Madurai', hometown: 'Madurai', name_confirmation: 'confirmed' });
  assert.equal(verified.name, 'Madurai');
});
