import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { observeSalesTurn, nextSalesAction } from '../src/utils/salesConversation.ts';
import { detectObjectionSignal, CallRejectionTracker } from '../src/utils/customerObjection.ts';
import { getLocalConnection, formatLocationAcknowledgment } from '../src/utils/localKnowledge.ts';

// ─── 1. Voice Lock Integrity Check ──────────────────────────────────────────
const EXPECTED_HASHES = {
  naturalVoice: '74A7DD3721F338577019F521DE3CFCE1989421B3F8D42AA8053FAE9AFADC0B8B',
  audio: '21492E23F37C826B4534A011BC9F48C3D6A77389CF80EC5F04801266280300DE'
};

function getSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
}

test('Voice Lock: Audio pipeline and natural voice files remain 100% identical', () => {
  assert.equal(getSha256('src/utils/naturalVoice.ts'), EXPECTED_HASHES.naturalVoice);
  assert.equal(getSha256('src/utils/audio.ts'), EXPECTED_HASHES.audio);
});

// ─── 2. User Reported Screenshot: 3-Layer Objection Framework ────────────────
test('Turn 1: "இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல" stays on line with Credibility Layer', () => {
  const userText = 'இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.';
  
  // 1. Must be recognized as rejection, NOT DNC
  const signal = detectObjectionSignal(userText);
  assert.equal(signal, 'rejection');

  // 2. Tracker must not terminate on turn 1
  const tracker = new CallRejectionTracker();
  const decision = tracker.consume(userText);
  assert.equal(decision.count, 1);
  assert.equal(decision.terminate, false);
  assert.equal(decision.dnc, false);

  // 3. observeSalesTurn must set active_soft_objection with count 1
  const f = observeSalesTurn({}, userText);
  assert.equal(f.active_soft_objection, 'active');
  assert.equal(f.soft_objection_count, '1');
  assert.notEqual(f.conversation_disposition, 'end');

  // 4. nextSalesAction must return Credibility Layer and NOT hang up
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'objection_handling');
  assert.equal(action.field, 'objection_credibility_layer');
  assert.ok(action.instruction.includes('Do NOT hang up'), 'Instruction must explicitly mandate staying on the line');
  assert.ok(action.instruction.includes('rough idea'), 'Instruction delivers Credibility Layer question');
});

test('Turn 2: Customer declines a 2nd time -> stays on line with Clarity Layer', () => {
  let f = observeSalesTurn({}, 'இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.');
  f = observeSalesTurn(f, 'இல்லங்க, எனக்கு இதெல்லாம் வேணாம்.');
  assert.equal(f.soft_objection_count, '2');
  assert.equal(f.active_soft_objection, 'active');
  assert.notEqual(f.conversation_disposition, 'end');

  const action = nextSalesAction(f);
  assert.equal(action.stage, 'objection_handling');
  assert.equal(action.field, 'objection_clarity_layer');
  assert.ok(action.instruction.includes('force panna maatten') || action.instruction.includes('force பண்ண மாட்டேன்'));
  assert.ok(action.instruction.includes('6-8%') || action.instruction.includes('6-8 percent'));
});

test('Turn 3: Customer declines a 3rd time -> graceful exit and NOW cuts the call', () => {
  let f = observeSalesTurn({}, 'இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.');
  f = observeSalesTurn(f, 'இல்லங்க, எனக்கு இதெல்லாம் வேணாம்.');
  f = observeSalesTurn(f, 'வேணாம் call cut பண்ணுங்க.');
  assert.equal(f.soft_objection_count, '3');
  assert.equal(f.conversation_disposition, 'end');

  const action = nextSalesAction(f);
  assert.equal(action.stage, 'closing');
  assert.equal(action.stageNumber, 14);
  assert.ok(action.instruction.includes('Layer 3') || action.instruction.includes('Exit'));
});

test('Explicit DNC is immediate opt-out on Turn 1', () => {
  const f = observeSalesTurn({}, 'Don\'t call me again, remove my number');
  assert.equal(f.qualification_status, 'OPT_OUT');
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'closing');
  assert.ok(action.instruction.includes('DNC'));
});

// ─── 3. Profession Deep Follow-ups ──────────────────────────────────────────
const baseCustomer = { conversation_disposition: 'engaged', name: 'Karthik', current_location: 'Chennai', current_area: 'T Nagar', engagement_indicator: 'interested' };

test('Business Owner: Business -> Sector -> Contracting/Supply -> Wholesale/Retail', () => {
  // Step 1: Profession = Business
  let f = observeSalesTurn(baseCustomer, 'Naan business panren.');
  assert.equal(f.profession, 'Business');
  let action = nextSalesAction(f);
  assert.equal(action.field, 'business_sector');
  assert.ok(action.instruction.includes('Enna line business'));

  // Step 2: Sector = Electrical
  f = observeSalesTurn(f, 'Electrical business.');
  assert.equal(f.business_sector, 'Electrical');
  action = nextSalesAction(f);
  assert.equal(action.field, 'business_type_detail');
  assert.ok(action.instruction.includes('Contracting side-ah, illa electrical materials supply side-ah'));

  // Step 3: Type detail = Materials supply
  f = observeSalesTurn(f, 'Materials supply.');
  assert.equal(f.business_type_detail, 'Materials Supply');
  action = nextSalesAction(f);
  assert.equal(action.field, 'business_subdetail');
  assert.ok(action.instruction.includes('Wholesale-ah, retail-ah'));

  // Step 4: Subdetail = Wholesale and Retail
  f = observeSalesTurn(f, 'Wholesale and retail rendu side-um panrom.');
  assert.equal(f.business_subdetail, 'Wholesale and Retail');
  action = nextSalesAction(f);
  assert.equal(action.stageNumber, 4, 'Advances cleanly to Stage 4 after complete business discovery');
  assert.equal(action.field, 'investment_purpose');
});

test('Salaried IT: IT -> Role (Development vs Testing)', () => {
  let f = observeSalesTurn(baseCustomer, 'Naan IT-la work panren.');
  assert.equal(f.profession, 'IT');
  let action = nextSalesAction(f);
  assert.equal(action.field, 'profession_role');
  assert.ok(action.instruction.includes('Development-ah, testing-ah'));

  f = observeSalesTurn(f, 'Software development side.');
  assert.equal(f.profession_role, 'Development');
  assert.equal(f.salaried_field, 'IT');
  action = nextSalesAction(f);
  assert.equal(action.stageNumber, 4);
});

test('Teacher: Education -> School vs College', () => {
  let f = observeSalesTurn(baseCustomer, 'Naan teacher-ah irukken.');
  assert.equal(f.profession, 'Teacher');
  let action = nextSalesAction(f);
  assert.equal(action.field, 'profession_role');
  assert.ok(action.instruction.includes('School side-ah, college side-ah'));

  f = observeSalesTurn(f, 'College-la professor-ah irukken.');
  assert.equal(f.profession_role, 'College');
  action = nextSalesAction(f);
  assert.equal(action.stageNumber, 4);
});

test('Healthcare: Healthcare -> Role (Doctor vs Nurse)', () => {
  let f = observeSalesTurn(baseCustomer, 'Naan healthcare-la work panren.');
  assert.equal(f.profession, 'Healthcare');
  let action = nextSalesAction(f);
  assert.equal(action.field, 'profession_role');
  assert.ok(action.instruction.includes('Healthcare-la endha role'));

  f = observeSalesTurn(f, 'Doctor-ah irukken.');
  assert.equal(f.profession_role, 'Doctor');
  action = nextSalesAction(f);
  assert.equal(action.stageNumber, 4);
});

// ─── 4. Natural Location-Based Small Talk ────────────────────────────────────
test('Local Knowledge: Tirunelveli halwa and Nellaiappar temple connection', () => {
  const loc = getLocalConnection('Tirunelveli');
  assert.ok(loc);
  assert.equal(loc?.displayName, 'Tirunelveli');
  assert.ok(loc?.fact.includes('Nellaiappar Kovil'));
  assert.ok(loc?.fact.includes('halwa'));

  const ack = formatLocationAcknowledgment('Tirunelveli');
  assert.ok(ack.includes('Tirunelveli-ah'));
  assert.ok(ack.includes('halwa') || ack.includes('Nellaiappar'));
});

test('Local Knowledge: Madurai Meenakshi Amman Kovil connection', () => {
  const ack = formatLocationAcknowledgment('Madurai');
  assert.ok(ack.includes('Madurai-ah'));
  assert.ok(ack.includes('Meenakshi Amman'));
});

test('Local Knowledge: Thoothukudi port and macaroons connection', () => {
  const ack = formatLocationAcknowledgment('Thoothukudi');
  assert.ok(ack.includes('Thoothukudi-ah'));
  assert.ok(ack.includes('macaroons') || ack.includes('Port'));
});

test('Local Knowledge: Unknown town receives neutral polite acknowledgement without hallucination', () => {
  const ack = formatLocationAcknowledgment('RandomSmallVillageXYZ');
  assert.ok(ack.includes('Ohh appadiya sir! Nice.'));
  assert.ok(!ack.includes('famous temple') && !ack.includes('famous sweets'), 'Must not hallucinate nonexistent facts');
});

test('Location acknowledgment is included once and not repeated', () => {
  // Turn 1: Customer gives hometown Tirunelveli
  let f = observeSalesTurn({ conversation_disposition: 'engaged', name: 'Sathish', engagement_indicator: 'interested' }, 'Naan Tirunelveli.');
  assert.equal(f.hometown, 'Tirunelveli');
  assert.notEqual(f.location_acknowledged, 'true');

  // Next action must prepend local connection
  let action = nextSalesAction(f);
  assert.ok(action.instruction.includes('Tirunelveli-ah'));
  assert.ok(action.instruction.includes('halwa') || action.instruction.includes('Nellaiappar'));

  // Turn 2: Customer replies with profession
  f = observeSalesTurn(f, 'Business panren.');
  assert.equal(f.location_acknowledged, 'true', 'Must mark location acknowledged');

  // Next action must NOT repeat local connection
  action = nextSalesAction(f);
  assert.ok(!action.instruction.includes('Nellaiappar'), 'Must never repeat local connection once acknowledged');
});
