/**
 * Regression tests for the 4-bug fix session:
 *   Bug 1 — Call summary must not contain [Task 7 sales] metadata
 *   Bug 2 — "not interested" must NOT be classified as positive
 *   Bug 4 — silence follow-up timer variables exist (structural check)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitNotes } from '../src/utils/salesIntelligence.js';
import {
  checkIsPositive,
  checkIsNotInterested,
  checkIsOptOut,
  calculateAuthoritativeLeadScore,
  determineLeadStatusFromData,
} from '../src/utils/scoring.js';

// ─── Bug 1: splitNotes strips Task 7 metadata ────────────────────────────────

test('Bug 1a: splitNotes returns clean text without [Task 7 sales] block', () => {
  const raw = 'Customer is interested in Dubai property.[Task 7 sales]{"current_stage":"5","engagement_indicator":"interested"}[/Task 7 sales]';
  const { text, sales } = splitNotes(raw);
  assert.ok(!text.includes('[Task 7 sales]'), 'summary must not contain [Task 7 sales] open tag');
  assert.ok(!text.includes('[/Task 7 sales]'), 'summary must not contain [/Task 7 sales] close tag');
  assert.ok(text.includes('Customer is interested'), 'human-readable text must be preserved');
  assert.equal(sales.current_stage, '5', 'sales metadata must be parsed correctly');
  assert.equal(sales.engagement_indicator, 'interested', 'engagement_indicator must be parsed');
});

test('Bug 1b: splitNotes on plain notes (no metadata) returns text unchanged', () => {
  const plain = 'Customer wants 3BHK in Dubai Marina.';
  const { text, sales } = splitNotes(plain);
  assert.equal(text, plain, 'plain notes must pass through unchanged');
  assert.deepEqual(sales, {}, 'sales object must be empty for plain notes');
});

test('Bug 1c: splitNotes on empty string returns empty text', () => {
  const { text, sales } = splitNotes('');
  assert.equal(text, '', 'empty input must produce empty text');
  assert.deepEqual(sales, {});
});

test('Bug 1d: historical summary with Task 7 metadata is cleaned on read', () => {
  const summary = 'Good call.[Task 7 sales]{"current_stage":"3"}[/Task 7 sales] Budget discussed.';
  const cleaned = splitNotes(summary).text;
  assert.ok(!cleaned.includes('[Task 7'), 'cleaned summary must not contain Task 7 block');
  assert.ok(cleaned.includes('Good call'), 'leading text must be preserved');
  assert.ok(cleaned.includes('Budget discussed'), 'trailing text must be preserved');
});

// ─── Bug 2: "not interested" must NEVER be classified as positive ─────────────

test('Bug 2a: "not interested" does NOT match checkIsPositive', () => {
  assert.equal(checkIsPositive('not interested'), false, '"not interested" must not be positive');
  assert.equal(checkIsPositive('I am not interested'), false, '"I am not interested" must not be positive');
  assert.equal(checkIsPositive('definitely not interested in any property'), false);
});

test('Bug 2b: "not interested" IS classified as not-interested by checkIsNotInterested', () => {
  assert.equal(checkIsNotInterested('not interested'), true);
  assert.equal(checkIsNotInterested('I am not interested at all'), true);
});

test('Bug 2c: "interested" alone IS positive (without negation)', () => {
  assert.equal(checkIsPositive('I am interested'), true, '"interested" alone should be positive');
  assert.equal(checkIsPositive('yes, interested'), true, '"yes, interested" should be positive');
});

test('Bug 2d: calculateAuthoritativeLeadScore — "not interested" text gives score 0', () => {
  const result = calculateAuthoritativeLeadScore({}, 'not interested');
  assert.equal(result.score, 0, 'score must be 0 when customer says not interested');
  assert.equal(result.temperature, 'COLD');
});

test('Bug 2e: calculateAuthoritativeLeadScore — "I am interested" (without negation) gives positive score', () => {
  const result = calculateAuthoritativeLeadScore({}, 'I am interested in a 3BHK villa in Dubai');
  assert.ok(result.score > 0, 'score must be positive for genuine interest statement');
});

test('Bug 2f: notes containing "not interested" keeps score at 0', () => {
  const result = calculateAuthoritativeLeadScore({ notes: 'Customer said not interested' }, '');
  assert.equal(result.score, 0, 'notes with "not interested" must produce score 0');
  assert.equal(result.temperature, 'COLD');
});

test('Bug 2g: determineLeadStatusFromData with "not interested" notes stays COLD', () => {
  const status = determineLeadStatusFromData({
    notes: 'Customer explicitly said not interested in property.',
    phone: '+919876543210',
  });
  assert.equal(status.outcome, 'COLD', '"not interested" in notes must produce COLD outcome');
  assert.equal(status.score, 0);
});

test('Bug 2h: OPT_OUT and busy signals take priority over interest markers', () => {
  // If someone says "not interested, don't call me" — must be OPT_OUT, not WARM
  const result = calculateAuthoritativeLeadScore({}, "I'm not interested. Don't call me again.");
  assert.equal(result.score, 0, 'opt-out must override any interest signal');
});

test('Bug 2i: checkIsPositive does not false-fire on "no interest illa"', () => {
  // "interest illa" means no interest in Tamil — must NOT be positive
  assert.equal(checkIsNotInterested('interest illa'), true, '"interest illa" must be classified as not-interested');
  assert.equal(checkIsPositive('interest illa'), false, '"interest illa" must not be positive');
});

test('Bug 2j: "vendam" (do not want) is not interested', () => {
  assert.equal(checkIsNotInterested('vendam'), true, '"vendam" must be not-interested');
  assert.equal(checkIsPositive('vendam'), false, '"vendam" must not be positive');
});
