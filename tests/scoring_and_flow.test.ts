import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuthoritativeLeadScore, determineLeadStatusFromData } from '../src/utils/scoring.js';
import { detectUnwantedSpeech, detectUnrelatedSpeech, isPropertyRelatedSpeech } from '../src/utils/unwantedSpeech.js';

test('1. Explicit buyer receives strong buying intent points (30 pts)', () => {
  const result = calculateAuthoritativeLeadScore(
    { intent: 'buy' },
    'I want to buy a property'
  );

  const intentFactor = result.factors.find(f => f.factor.includes('Buying/renting intent'));
  assert.ok(intentFactor, 'Intent factor must exist in score breakdown');
  assert.equal(intentFactor.points, 30, 'Explicit buyer must receive 30 buying intent points');
  assert.ok(result.score >= 30, `Score must be at least 30 pts (was ${result.score})`);
});

test('2. Fully qualified buyer receives near-100 or 100 points and HOT classification', () => {
  const result = calculateAuthoritativeLeadScore(
    {
      intent: 'buy',
      property_type: '3 BHK Villa',
      location: 'OMR, Chennai',
      locality: 'OMR',
      city: 'Chennai',
      budget: '₹1.5 Cr',
      budget_max: 15000000,
      timeline: 'Immediate (Ready to Move)',
      phone: '+919876543210',
      name: 'Ramanathan',
    },
    'I want to buy a 3 BHK Villa in OMR Chennai within 1 month. My budget is 1.5 crore. Please schedule a site visit.'
  );

  assert.equal(result.score, 100, `Fully qualified lead should receive 100 points, got ${result.score}`);
  assert.equal(result.temperature, 'HOT', 'Fully qualified lead must be HOT');

  const intentFactor = result.factors.find(f => f.factor.includes('intent'));
  const budgetFactor = result.factors.find(f => f.factor.includes('Budget'));
  const propFactor = result.factors.find(f => f.factor.includes('Property type'));
  const locFactor = result.factors.find(f => f.factor.includes('location'));
  const timelineFactor = result.factors.find(f => f.factor.includes('timeline'));
  const engagementFactor = result.factors.find(f => f.factor.includes('Engagement'));

  assert.equal(intentFactor?.points, 30);
  assert.equal(budgetFactor?.points, 20);
  assert.equal(propFactor?.points, 15);
  assert.equal(locFactor?.points, 10);
  assert.equal(timelineFactor?.points, 15);
  assert.equal(engagementFactor?.points, 10);
});

test('3. Explicit "Not Interested" produces score 0 and COLD classification', () => {
  const resultTamil = calculateAuthoritativeLeadScore(
    { phone: '+919876543210', name: 'Kumar' },
    'Enakku vendam, interest illa.'
  );
  assert.equal(resultTamil.score, 0, 'Not interested must receive score 0');
  assert.equal(resultTamil.temperature, 'COLD', 'Not interested cannot be WARM or HOT');

  const status = determineLeadStatusFromData({
    phone: '+919876543210',
    notes: 'Customer explicitly stated not interested',
  });
  assert.equal(status.score, 0);
  assert.equal(status.outcome, 'COLD');
});

test('4. "Don\'t call me again" / Opt-Out produces score 0 and OPT_OUT status', () => {
  const result = calculateAuthoritativeLeadScore(
    { phone: '+919876543210', temperature: 'OPT_OUT' },
    'Don\'t call me again, remove my number.'
  );
  assert.equal(result.score, 0, 'Opt-out must receive score 0');

  const status = determineLeadStatusFromData({
    phone: '+919876543210',
    isOptedOut: true,
    notes: 'Do not call requested',
  });
  assert.equal(status.outcome, 'OPT_OUT');
  assert.equal(status.score, 0);
});

test('5. Callback request retains REACH_AGAIN without being misclassified as unwanted', () => {
  const status = determineLeadStatusFromData({
    phone: '+919876543210',
    notes: 'Customer is busy right now, requested callback tomorrow at 3 PM',
  });
  assert.equal(status.outcome, 'REACH_AGAIN');

  const statusTamil = determineLeadStatusFromData({
    phone: '+919876543210',
    notes: 'Naalaikku call pannunga, ippo busy-ah irukken',
  });
  assert.equal(statusTamil.outcome, 'REACH_AGAIN');
});

test('6. Greeting-only conversation earns 0 points', () => {
  const result = calculateAuthoritativeLeadScore(
    {},
    'Hello! Vanakkam.'
  );
  assert.equal(result.score, 0, 'Greeting only must earn 0 points');
  assert.equal(result.temperature, 'COLD');
});

test('7. Missing information earns zero points for missing categories without inventing details', () => {
  const result = calculateAuthoritativeLeadScore(
    { intent: 'buy' },
    'I want to buy'
  );
  const budgetFactor = result.factors.find(f => f.factor.includes('Budget'));
  const propFactor = result.factors.find(f => f.factor.includes('Property type'));
  const locFactor = result.factors.find(f => f.factor.includes('location'));
  const timelineFactor = result.factors.find(f => f.factor.includes('timeline'));

  assert.equal(budgetFactor?.points, 0);
  assert.equal(propFactor?.points, 0);
  assert.equal(locFactor?.points, 0);
  assert.equal(timelineFactor?.points, 0);
  assert.ok(result.missingInformation.length >= 4, 'Missing categories must be documented');
});

test('8. Unwanted speech and persistent unrelated queries detection', () => {
  // Property related utterances should NOT be flagged as unrelated
  assert.equal(isPropertyRelatedSpeech('I want a 3 BHK villa in OMR'), true);
  assert.equal(isPropertyRelatedSpeech('Budget is 1.5 crore, ready to move'), true);
  assert.equal(isPropertyRelatedSpeech('Neenga plot sale panreengala?'), true);

  // Unrelated topics should be flagged by detectUnrelatedSpeech
  assert.equal(detectUnrelatedSpeech('Can you tell me a funny joke?'), true);
  assert.equal(detectUnrelatedSpeech('Who will win the cricket match today?'), true);
  assert.equal(detectUnrelatedSpeech('What is your favorite food? Sapteengala?'), true);
  assert.equal(detectUnrelatedSpeech('Sing me a song please'), true);

  // Inappropriate / persistent unrelated speech flagged by detectUnwantedSpeech
  assert.equal(detectUnwantedSpeech('Tell me a bedtime story and sing a song'), true);

  // Caller with unwanted outcome gets score 0
  const unwantedResult = calculateAuthoritativeLeadScore(
    { notes: 'Call ended after three explicit unwanted or unrelated remarks' },
    'Tell me a joke. Sing a song. What are you wearing?'
  );
  assert.equal(unwantedResult.score, 0, 'Unwanted caller must have score 0');
});

test('9. Contrast verification: Qualified buyer vs General interest vs Unwanted caller', () => {
  // Fully qualified buyer
  const qualified = calculateAuthoritativeLeadScore(
    {
      intent: 'buy',
      budget: '₹2 Cr',
      budget_max: 20000000,
      property_type: 'Villa',
      locality: 'ECR',
      timeline: 'Within 1-3 months',
      phone: '+919999988888',
    },
    'I want to buy a villa in ECR within 3 months, budget is 2 crore.'
  );

  // Explicit buyer with no other details
  const earlyBuyer = calculateAuthoritativeLeadScore(
    { intent: 'buy', phone: '+919999988888' },
    'I want to buy a property'
  );

  // Unwanted caller
  const unwantedCaller = calculateAuthoritativeLeadScore(
    { notes: 'unwanted_speech', phone: '+919999988888' },
    'Tell me a joke. Sing a song.'
  );

  // Not interested caller
  const notInterested = calculateAuthoritativeLeadScore(
    { phone: '+919999988888' },
    'Not interested at all'
  );

  assert.ok(qualified.score >= 80, `Qualified buyer score (${qualified.score}) must be >= 80`);
  assert.ok(earlyBuyer.score >= 30, `Early buyer score (${earlyBuyer.score}) must be >= 30`);
  assert.equal(unwantedCaller.score, 0, `Unwanted caller must receive 0, got ${unwantedCaller.score}`);
  assert.equal(notInterested.score, 0, `Not interested caller must receive 0, got ${notInterested.score}`);

  // The qualified buyer must be substantially higher than early buyer
  assert.ok(qualified.score > earlyBuyer.score + 40, 'Qualified buyer must be substantially higher than early buyer');
  // Early buyer must be substantially higher than unwanted / uninterested caller
  assert.ok(earlyBuyer.score > unwantedCaller.score + 25, 'Early buyer must be substantially higher than unwanted caller');
});

test('10. Conversation flow prompt structure verification', async () => {
  const fs = await import('node:fs');
  const serverCode = fs.readFileSync('./server.ts', 'utf-8');

  // Verify progressive qualification step order: timeline strictly after budget
  assert.ok(serverCode.includes('1. Confirm buying or renting intent:'), 'Prompt must include Step 1');
  assert.ok(serverCode.includes('2. Ask what type of property they need:'), 'Prompt must include Step 2');
  assert.ok(serverCode.includes('3. Ask the preferred location:'), 'Prompt must include Step 3');
  assert.ok(serverCode.includes('4. Ask their budget:'), 'Prompt must include Step 4');
  assert.ok(serverCode.includes('5. Ask purchase timeline'), 'Prompt must include Step 5');

  // Verify 3-tier unrelated conversation protocol
  assert.ok(serverCode.includes('FIRST UNRELATED ATTEMPT: Politely redirect towards property'), 'Prompt must include 1st attempt redirect');
  assert.ok(serverCode.includes('SECOND CONSECUTIVE UNRELATED ATTEMPT: Give one final, polite warning and redirect'), 'Prompt must include 2nd attempt final warning');
  assert.ok(serverCode.includes('THIRD CONSECUTIVE UNRELATED ATTEMPT: End the call politely'), 'Prompt must include 3rd attempt polite close');
});

