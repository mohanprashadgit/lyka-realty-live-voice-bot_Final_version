// Targeted regression tests for:
// 1. Company Trust, Credibility and Official Facts
// 2. City -> Area -> Local Conversation Flow
// Run with: npx tsx --test tests/company_trust_and_location.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
  observeSalesTurn,
  nextSalesAction,
  FOURTEEN_STAGES,
} from '../src/utils/salesConversation.ts';
import {
  formatLocationAcknowledgment,
  formatCityAreaQuestion,
  formatAreaAcknowledgment,
  getVerifiedLocalNews,
  getLocalConnection,
} from '../src/utils/localKnowledge.ts';

// ─── Absolute Voice Lock Hashes ──────────────────────────────────────────────
const KNOWN_VOICE_HASHES = {
  naturalVoice: '460702b7929b38288f2409e149b917373eab0c4e0d4fb9f4237ba5e42f4f6eb8',
  audio: '7d3de8061b574d9f14419b3f45c84a7a24b625cca438d0cbf61b154ab3f8dc26',
};

test('1. "Who are you?" → accurate company identity and verified facts', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Yaaru neenga? Unga company pathi sollunga.'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'trust');
  assert.equal(action.stageNumber, 12);
  assert.ok(action.instruction.includes('Lyka Realty'));
  assert.ok(action.instruction.includes('Dubai-based real estate brokerage') || action.instruction.includes('lykarealty.ae'));
});

test('2. "Is this a scam?" → verification-based response with DLD guidance', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Idhu scam / fraud illaiya? Idhellam nambalama?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.equal(action.stage, 'trust');
  assert.ok(action.instruction.includes('DLD') || action.instruction.includes('Dubai Land Department'));
  assert.ok(action.instruction.includes('validate') || action.instruction.includes('Dubai REST'));
});

test('3. "Website irukka?" → correct official website lykarealty.ae', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Unga official website irukka?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('lykarealty.ae'));
});

test('4. "Contact number?" → exact official number +971 52 348 5758', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Unga customer care contact number enna?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('+971 52 348 5758') || action.instruction.includes('five two, three four eight'));
  assert.ok(action.instruction.includes('admin@lykarealty.ae'));
});

test('5. "Office enga?" → accurate address (DAMAC Executive Heights, Barsha Heights, Office 1002)', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Unga Dubai office enga irukku?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('DAMAC Executive Heights'));
  assert.ok(action.instruction.includes('Barsha Heights'));
  assert.ok(action.instruction.includes('Office 1002'));
  assert.ok(action.instruction.includes('appointment'));
});

test('6. "10 years company-ah?" → no unsupported age claim', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Company evlo years-ah irukku? 10 years-ah?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('Do NOT claim 10+ years without evidence') || action.instruction.includes('unsupported 10+ year claims'));
  assert.ok(action.instruction.includes('lykarealty.ae'));
});

test('7. "7000 customers-ah?" → cites official website over 300 clients, no invented count', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Ethana customers-ku property vaangi kuduthirukkeenga? 7000 customers-ah?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('Over 300 clients served across Dubai'));
  assert.ok(action.instruction.includes('Never inflate to 700+ or 7,000+'));
});

test('8. "ORN number?" → only independently verified license claims (DLD validate service / Dubai REST)', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Unga ORN number enna? RERA license number irukka?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('Dubai Land Department (DLD) validate-real-estate-licenses'));
  assert.ok(action.instruction.includes('Do not claim ORN 47999 unless verified'));
});

test('9. "Escrow guarantee-ah?" → legally accurate explanation (Dubai Law No. 8 of 2007)', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Ramesh' },
    'Escrow irundha 100% guarantee-ah? Money full-ah refund varuma?'
  );
  assert.equal(f.active_objection, 'trust');
  const action = nextSalesAction(f);
  assert.ok(action.instruction.includes('Dubai Law No. 8 of 2007'));
  assert.ok(action.instruction.includes('Escrow does NOT guarantee returns, completion, or refund'));
});

test('10. Tirunelveli → brief verified local acknowledgment', () => {
  const ack = formatLocationAcknowledgment('Tirunelveli');
  assert.ok(ack.includes('Tirunelveli-ah'));
  assert.ok(ack.includes('Nellaiappar Kovil') || ack.includes('halwa'));
  assert.ok(!ack.includes('festival') && !ack.includes('yesterday'));
});

test('11. Tirunelveli → ask specific area', () => {
  const f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Anand', engagement_indicator: 'interested' },
    'Naan Tirunelveli-la irukken.'
  );
  assert.equal(f.hometown, 'Tirunelveli');
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 3, 'Must remain Stage 3');
  assert.equal(action.field, 'current_area', 'Must ask specific area');
  assert.ok(action.instruction.includes('Tirunelveli-la endha area'));
});

test('12. Palayamkottai → capture locality in current_area', () => {
  let f = observeSalesTurn(
    { conversation_disposition: 'engaged', name: 'Anand', hometown: 'Tirunelveli', engagement_indicator: 'interested' },
    'Palayamkottai.'
  );
  assert.equal(f.current_area, 'Palayamkottai');
  assert.notEqual(f.location, 'Palayamkottai', 'Tamil Nadu locality must never overwrite preferred Dubai property location');
});

test('13. Area known → don\'t ask again', () => {
  const f = {
    conversation_disposition: 'engaged',
    name: 'Anand',
    hometown: 'Tirunelveli',
    current_area: 'Palayamkottai',
    engagement_indicator: 'interested'
  };
  const action = nextSalesAction(f);
  assert.notEqual(action.field, 'current_area', 'Must not re-ask area when already known');
});

test('14. After locality → profession discovery resumes with area acknowledgment', () => {
  const f = {
    conversation_disposition: 'engaged',
    name: 'Anand',
    hometown: 'Tirunelveli',
    current_area: 'Palayamkottai',
    engagement_indicator: 'interested'
  };
  const action = nextSalesAction(f);
  assert.equal(action.stageNumber, 3, 'Must be Stage 3');
  assert.equal(action.field, 'profession', 'Must ask profession after area');
  assert.ok(action.instruction.includes('Palayamkottai side-ah! Nice'));
});

test('15. Business → relevant business detail follows smoothly', () => {
  let f: Record<string, any> = {
    conversation_disposition: 'engaged',
    name: 'Anand',
    hometown: 'Tirunelveli',
    current_area: 'Palayamkottai',
    engagement_indicator: 'interested'
  };
  f = observeSalesTurn(f, 'Business panren.');
  assert.equal(f.profession, 'Business');
  const action = nextSalesAction(f);
  assert.equal(action.field, 'business_sector');
});

test('16. Unknown city → no fabricated local knowledge, polite neutral acknowledgment', () => {
  const ack = formatLocationAcknowledgment('UnknownVillage999');
  assert.equal(ack, 'Ohh appadiya sir! Nice.');
  assert.equal(getLocalConnection('UnknownVillage999'), null);
});

test('17. Recent festival without verification → no invented recency', () => {
  assert.equal(getVerifiedLocalNews('Tirunelveli'), null);
  assert.equal(getVerifiedLocalNews('Madurai'), null);
  assert.equal(getVerifiedLocalNews('Chennai'), null);
});

test('18. Busy/negative/DNC → no optional small talk', () => {
  const busyLead = {
    conversation_disposition: 'busy',
    name: 'Anand',
    hometown: 'Tirunelveli',
    engagement_indicator: 'busy',
    fast_mode: 'true'
  };
  const action = nextSalesAction(busyLead);
  assert.notEqual(action.field, 'current_area', 'Must not ask area small talk when caller is busy');
});

test('19. Existing 14-stage sequence unchanged', () => {
  assert.equal(FOURTEEN_STAGES.length, 14);
  assert.equal(FOURTEEN_STAGES[0].stageNumber, 1);
  assert.equal(FOURTEEN_STAGES[1].stageNumber, 2);
  assert.equal(FOURTEEN_STAGES[2].stageNumber, 3);
  assert.equal(FOURTEEN_STAGES[10].stageNumber, 11);
  assert.equal(FOURTEEN_STAGES[11].stageNumber, 12);
  assert.equal(FOURTEEN_STAGES[12].stageNumber, 13);
  assert.equal(FOURTEEN_STAGES[13].stageNumber, 14);
});

test('20. Voice-related file hashes and configurations unchanged (strict voice lock)', () => {
  const calc = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toLowerCase();
  assert.equal(calc('src/utils/naturalVoice.ts'), KNOWN_VOICE_HASHES.naturalVoice, 'naturalVoice.ts must remain identical');
  assert.equal(calc('src/utils/audio.ts'), KNOWN_VOICE_HASHES.audio, 'audio.ts must remain identical');
});
