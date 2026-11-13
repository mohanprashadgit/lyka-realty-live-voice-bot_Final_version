import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { observeSalesTurn, nextSalesAction, salesRuntimeContext } from '../src/utils/salesConversation.ts';
import { isFirmRefusal, isSoftHesitation, isInterestOrConsent, isBusySignal } from '../src/utils/customerObjection.ts';
import { splitNotes, mergeSalesLead } from '../src/utils/salesIntelligence.ts';

// Baseline voice hashes recorded before any modifications
const VOICE_HASHES = {
  naturalVoice: '74A7DD3721F338577019F521DE3CFCE1989421B3F8D42AA8053FAE9AFADC0B8B',
  audio: '21492E23F37C826B4534A011BC9F48C3D6A77389CF80EC5F04801266280300DE'
};

function getSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
}

// ─── 1. Interested customer receives missing profession question ─────────────
test('1. Interested customer receives missing profession question', () => {
  const f = {
    name: 'Karthik',
    current_location: 'Bangalore',
    current_area: 'Indiranagar',
    conversation_disposition: 'engaged',
    engagement_indicator: 'interested'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 3, 'Must be Stage 3');
  assert.equal(action.field, 'profession', 'Must ask profession');
});

// ─── 2. Investment purpose already known does not skip profession ────────────
test('2. Investment purpose already known does not automatically skip profession', () => {
  const f = {
    name: 'Karthik',
    current_location: 'Chennai',
    current_area: 'Anna Nagar',
    investment_purpose: 'investment',
    conversation_disposition: 'engaged'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 3, 'Must still ask Stage 3');
  assert.equal(action.field, 'profession', 'Must ask profession even when investment_purpose is known');
});

// ─── 3. Current city and hometown handled separately ─────────────────────────
test('3. Current city and hometown handled separately', () => {
  const turn1 = observeSalesTurn({}, 'En சொந்த ஊர் Tirunelveli, but ippo Chennai-la dhaan work panren.');
  assert.equal(turn1.hometown, 'Tirunelveli', 'Extracts hometown correctly');
  assert.equal(turn1.current_location, 'Chennai', 'Extracts current_location separately');

  // Customer provided hometown and area and is engaged -> Stage 3 still asks profession without confusion
  const onlyHometown = { name: 'Karthik', hometown: 'Madurai', current_area: 'KK Nagar', engagement_indicator: 'interested', conversation_disposition: 'engaged' };
  const action = nextSalesAction(onlyHometown);
  assert.equal(action.stageNumber, 3, 'Stage must remain 3');
  assert.equal(action.field, 'profession', 'Must ask profession in Stage 3');
});

// ─── 4. Investor receives relevant BHK question ──────────────────────────────
test('4. Investor receives relevant BHK question and supports flexible', () => {
  const f = {
    name: 'Karthik',
    current_location: 'Chennai',
    profession: 'IT Consultant',
    salaried_field: 'software',
    investment_purpose: 'investment',
    flight_offer_status: 'presented',
    golden_visa_offer_status: 'presented',
    purchase_support_offer_status: 'presented',
    location: 'Downtown Dubai',
    property_type: 'apartment',
    conversation_disposition: 'engaged',
    family_lifestyle_checked: 'completed'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 8, 'Must be Stage 8');
  assert.equal(action.field, 'bedrooms', 'Investor must also be asked BHK / bedroom configuration');

  // If customer says flexible, it is recorded and advances
  const fAfterFlex = observeSalesTurn(f, 'Bedrooms flexible-ah irundha okay dhaan');
  assert.equal(fAfterFlex.bedrooms, 'flexible', 'Should record flexible');
  assert.notEqual(nextSalesAction(fAfterFlex).field, 'bedrooms', 'Should not ask bedrooms again');
});

// ─── 5. Budget known → payment preference asked ──────────────────────────────
test('5. Budget known → payment preference asked', () => {
  const f = {
    name: 'Karthik',
    current_location: 'Chennai',
    profession: 'IT Consultant',
    salaried_field: 'software',
    investment_purpose: 'investment',
    flight_offer_status: 'presented',
    golden_visa_offer_status: 'presented',
    purchase_support_offer_status: 'presented',
    location: 'Downtown Dubai',
    property_type: 'apartment',
    bedrooms: '2',
    budget: 'AED 1.5M',
    conversation_disposition: 'engaged',
    family_lifestyle_checked: 'completed'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 9, 'Must be Stage 9');
  assert.equal(action.field, 'payment_preference', 'Must ask full payment vs installments');
});

// ─── 6. Interested customer receives Stage 12 trust explanation ──────────────
test('6. Interested customer receives Stage 12 trust explanation before recommendations', () => {
  const f = {
    name: 'Karthik',
    current_location: 'Chennai',
    profession: 'IT Consultant',
    salaried_field: 'software',
    investment_purpose: 'investment',
    flight_offer_status: 'presented',
    golden_visa_offer_status: 'presented',
    purchase_support_offer_status: 'presented',
    location: 'Downtown Dubai',
    property_type: 'apartment',
    bedrooms: '2',
    budget: 'AED 1.5M',
    payment_preference: 'full payment',
    timeline: '3 months',
    phone_confirmed: 'confirmed',
    follow_up_permission: 'granted',
    preferred_contact_method: 'whatsapp',
    phone: '+971501234567',
    conversation_disposition: 'engaged',
    family_lifestyle_checked: 'completed'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 12, 'Must be Stage 12');
  assert.equal(action.stage, 'trust', 'Stage must be trust');
  assert.equal(action.field, 'trust_building_completed', 'Must perform trust building before recommendations');
  assert.ok(action.instruction.includes('Dubai Land Department (DLD) registered developers'), 'Instruction contains verified DLD escrow credibility point');
});

// ─── 7. Stage 11 → 12 → 13 order ─────────────────────────────────────────────
test('7. Stage 11 → 12 → 13 order is strictly sequential', () => {
  const base = {
    name: 'Karthik',
    current_location: 'Chennai',
    profession: 'IT Consultant',
    salaried_field: 'software',
    investment_purpose: 'investment',
    flight_offer_status: 'presented',
    golden_visa_offer_status: 'presented',
    purchase_support_offer_status: 'presented',
    location: 'Downtown Dubai',
    property_type: 'apartment',
    bedrooms: '2',
    budget: 'AED 1.5M',
    payment_preference: 'full payment',
    timeline: '3 months',
    conversation_disposition: 'engaged',
    family_lifestyle_checked: 'completed'
  };

  // Step A: Stage 11 must fire first (Contact & Follow-up Permission)
  const action11 = nextSalesAction(base);
  assert.equal(action11.stageNumber, 11, 'Step A must be Stage 11');
  assert.equal(action11.stage, 'conversion', 'Stage 11 is conversion/follow-up');

  // Step B: Once Stage 11 is completed, Stage 12 must fire (Trust & Credibility)
  const withStage11 = {
    ...base,
    phone_confirmed: 'confirmed',
    follow_up_permission: 'granted',
    preferred_contact_method: 'whatsapp',
    phone: '+971501234567'
  };
  const action12 = nextSalesAction(withStage11);
  assert.equal(action12.stageNumber, 12, 'Step B must be Stage 12');
  assert.equal(action12.stage, 'trust', 'Stage 12 is trust building');

  // Step C: Once Stage 12 is completed, Stage 13 must fire (Property Recommendation)
  const withStage12 = {
    ...withStage11,
    trust_building_completed: 'true'
  };
  const action13 = nextSalesAction(withStage12);
  assert.equal(action13.stageNumber, 13, 'Step C must be Stage 13');
  assert.equal(action13.stage, 'recommendation', 'Stage 13 is property recommendation');
});

// ─── 8. First soft objection → one permission-based clarification ─────────────
test('8. First soft objection → one permission-based clarification', () => {
  const f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, 'Dubai investment safe-ah? Konjam doubt-ah irukku.');
  assert.equal(f.active_soft_objection, 'active');
  assert.equal(f.soft_objection_count, '1');
  assert.equal(f.soft_objection_type, 'safety');

  const action = nextSalesAction(f);
  assert.equal(action.stage, 'objection_handling');
  assert.ok(action.field === 'objection_credibility_layer' || action.field === 'soft_objection_clarification');
  assert.ok(action.instruction.includes('Credibility Layer') || action.instruction.includes('rough idea'));
});

// ─── 9. Second soft objection → distinct, respectful explanation ──────────────
test('9. Second soft objection → distinct, respectful explanation if welcomed', () => {
  let f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, 'Ippo interest illa, maybe later.');
  assert.equal(f.soft_objection_count, '1');

  // Agent provided clarification, but customer hesitates again
  f = observeSalesTurn(f, 'Budget konjam high-ah irukku.');
  assert.equal(f.soft_objection_count, '2');

  const action = nextSalesAction(f);
  assert.equal(action.stage, 'objection_handling');
  assert.ok(action.field === 'objection_clarity_layer' || action.field === 'soft_objection_low_commitment');
  assert.ok(action.instruction.includes('Clarity Layer') || action.instruction.includes('force'));
});

// ─── 10. Third negative response → polite end ─────────────────────────────────
test('10. Third negative response → polite end without further persuasion', () => {
  let f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, 'Maybe later.');
  f = observeSalesTurn(f, 'Property pathi idea illa.');
  f = observeSalesTurn(f, 'I need to think.');

  assert.equal(f.soft_objection_count, '3');
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'closing');
  assert.equal(action.stageNumber, 14);
  assert.ok(action.instruction.includes('3rd rejection reached') || action.instruction.includes('Graceful Exit'), 'Immediately stops persuasion and ends');
});

// ─── 11. Cold call 3-layer objection framework: 1st/2nd "no" stays in line, 3rd "no" exits ──────────
test('11. Cold call 3-layer objection framework: 1st/2nd "no" stays in line, 3rd "no" exits', () => {
  // Turn 1: 1st "No" (Customer: "இல்லங்க, எனக்கு interest இல்ல." / "இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.")
  let f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, 'இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.');
  assert.equal(f.soft_objection_count, '1');
  let action = nextSalesAction(f);
  assert.equal(action.stage, 'objection_handling', 'Turn 1 must NOT drop call — enters objection_handling');
  assert.equal(action.field, 'objection_credibility_layer');
  assert.ok(action.instruction.includes('Credibility Layer'), 'Delivers Credibility Layer');

  // Turn 2: 2nd "No" (Customer: "இல்லங்க, எனக்கு இதெல்லாம் வேணாம்.")
  f = observeSalesTurn(f, 'இல்லங்க, எனக்கு இதெல்லாம் வேணாம்.');
  assert.equal(f.soft_objection_count, '2');
  action = nextSalesAction(f);
  assert.equal(action.stage, 'objection_handling', 'Turn 2 must NOT drop call — enters objection_handling');
  assert.equal(action.field, 'objection_clarity_layer');
  assert.ok(action.instruction.includes('Clarity Layer'), 'Delivers Clarity Layer');

  // Turn 3: 3rd "No" (Customer: "வேணாம்னு சொல்லிட்டேன் இல்ல.")
  f = observeSalesTurn(f, 'வேணாம்னு சொல்லிட்டேன் இல்ல.');
  assert.equal(f.soft_objection_count, '3');
  action = nextSalesAction(f);
  assert.equal(action.stage, 'closing', 'Turn 3 closes the call');
  assert.equal(action.stageNumber, 14);
  assert.ok(action.instruction.includes('Graceful Exit & Referral'), 'Delivers Graceful Exit & Referral');
});

// ─── 12. DNC → immediate opt-out ──────────────────────────────────────────────
test('12. DNC → immediate opt-out regardless of attempt count', () => {
  const dncPhrases = [
    "Don't call me again",
    'Remove my number',
    'Do not call this number',
    'En number delete pannunga'
  ];
  for (const phrase of dncPhrases) {
    const f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, phrase);
    assert.equal(f.qualification_status, 'OPT_OUT', `"${phrase}" sets qualification_status OPT_OUT`);
    const action = nextSalesAction(f);
    assert.equal(action.stage, 'closing');
    assert.ok(action.instruction.includes('Stop qualification and offers'), 'Immediately respects DNC');
  }
});

// ─── 13. Busy customer → fast exit ───────────────────────────────────────────
test('13. Busy customer → fast exit with optional callback timeframe', () => {
  const busyPhrases = [
    'I am busy right now',
    'Ippo konjam busy-ah irukken, apram pesunga',
    'Driving right now',
    'In a meeting'
  ];
  for (const phrase of busyPhrases) {
    assert.ok(isBusySignal(phrase), `"${phrase}" must be recognized as busy`);
    const f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, phrase);
    assert.equal(f.conversation_disposition, 'busy');
    const action = nextSalesAction(f);
    assert.equal(action.stage, 'closing');
    assert.ok(action.instruction.includes('Customer is busy. Respect their time with a fast exit'), 'Provides fast exit instruction');
  }
});

// ─── 14. Objection answered and customer becomes interested → resume ──────────
test('14. Objection answered and customer becomes interested → resume correct stage', () => {
  // Step 1: customer expresses hesitation
  let f = observeSalesTurn({ name: 'Karthik', current_location: 'Chennai', current_area: 'T Nagar', conversation_disposition: 'engaged' }, 'Ippo interest illa, Dubai pathi enakku idea illa.');
  assert.equal(f.active_soft_objection, 'active');

  // Step 2: Customer agrees to listen
  f = observeSalesTurn(f, 'Seri sollunga.');
  assert.equal(f.soft_objection_step, 'explained');

  // Step 3: Customer expresses interest to look into investment
  f = observeSalesTurn(f, 'Okay, investment-ku paakalaam.');
  assert.notEqual(f.active_soft_objection, 'active', 'Soft objection is no longer active');
  assert.equal(f.investment_purpose, 'investment', 'Captured investment purpose');

  // Next action resumes 14-stage qualification from the next missing field without restarting greeting
  const action = nextSalesAction(f);
  assert.notEqual(action.stage, 'opening', 'Must not restart greeting');
  assert.equal(action.field, 'profession', 'Must resume from missing Stage 3 profession');
});

// ─── 15. No duplicated persuasion or objection loop ──────────────────────────
test('15. No duplicated persuasion or objection loop', () => {
  let f = observeSalesTurn({ name: 'Karthik', conversation_disposition: 'engaged' }, 'Dubai investment safe-ah?');
  assert.equal(f.soft_objection_count, '1');

  f = observeSalesTurn(f, 'Budget konjam high-ah irukku.');
  assert.equal(f.soft_objection_count, '2');

  f = observeSalesTurn(f, 'Vendaam sir, interest illa.');
  assert.equal(f.soft_objection_count, '3');

  // Any subsequent turn remains in closing and does NOT loop back or reset count
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'closing');

  f = observeSalesTurn(f, 'No thanks');
  assert.equal(nextSalesAction(f).stage, 'closing');
});

// ─── 16. Existing Gemini next-action delivery preserved ───────────────────────
test('16. Existing Gemini next-action delivery preserved in salesRuntimeContext', () => {
  const context = salesRuntimeContext({
    name: 'Karthik',
    current_location: 'Chennai',
    current_area: 'Anna Nagar',
    conversation_disposition: 'engaged',
    investment_purpose: 'investment'
  });

  assert.ok(context.includes('SALES RUNTIME CONTROLLER'), 'Context includes SALES RUNTIME CONTROLLER header');
  assert.ok(context.includes('Priority plan (14-stage structure)'), 'Context includes 14-stage structure');
  assert.ok(context.includes('Current next_action:'), 'Context includes Current next_action');
  assert.ok(context.includes('"profession"'), 'Next action indicates profession');
});

// ─── 17. Call-summary metadata remains hidden ────────────────────────────────
test('17. Call-summary metadata remains hidden from user-facing notes', () => {
  const lead = mergeSalesLead({}, {
    name: 'Karthik',
    current_location: 'Chennai',
    soft_objection_count: '2',
    soft_objection_type: 'budget',
    active_soft_objection: 'active'
  });

  const parsed = splitNotes(lead.notes);
  assert.ok(parsed.sales.soft_objection_count, 'Sales metadata stored in sales object');
  assert.ok(!parsed.text.includes('[Task 7 sales]'), 'Clean text excludes [Task 7 sales] block');
  assert.ok(!parsed.text.includes('soft_objection_count'), 'Clean text excludes internal counters');
});

// ─── 18. Current voice files and config unchanged ────────────────────────────
test('18. Current voice files/config unchanged (strict voice lock)', () => {
  const naturalVoicePath = path.resolve('src/utils/naturalVoice.ts');
  const audioPath = path.resolve('src/utils/audio.ts');

  const currentNaturalVoiceHash = getSha256(naturalVoicePath);
  const currentAudioHash = getSha256(audioPath);

  assert.equal(currentNaturalVoiceHash, VOICE_HASHES.naturalVoice, 'src/utils/naturalVoice.ts hash must match baseline');
  assert.equal(currentAudioHash, VOICE_HASHES.audio, 'src/utils/audio.ts hash must match baseline');
});

// ─── 19. Existing six-second silence behavior unchanged ──────────────────────
test('19. Existing six-second silence behavior contracts preserved', () => {
  const serverPath = path.resolve('server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  // Verify core silence logic remains intact in server.ts
  assert.ok(serverCode.includes('playback_complete'), 'Must handle playback_complete');
  assert.ok(serverCode.includes('pendingSilenceArmTurnId'), 'Must guard with pendingSilenceArmTurnId');
  assert.ok(serverCode.includes('clearSilenceFollowUp'), 'Must have clearSilenceFollowUp');
  assert.ok(serverCode.includes('silenceFollowUpFired'), 'Must guard with silenceFollowUpFired');
});

// ─── 20. Existing Task 6/7/8 regressions preserved ───────────────────────────
test('20. Existing Task 6/7/8 regressions preserved', () => {
  // Test three offers presentation
  const f = {
    name: 'Karthik',
    current_location: 'Chennai',
    profession: 'Doctor',
    investment_purpose: 'investment',
    conversation_disposition: 'engaged'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 5, 'Stage 5 presents offers');
  assert.equal(action.stage, 'offers');
  assert.equal(action.field, 'flight_offer_status');
});
