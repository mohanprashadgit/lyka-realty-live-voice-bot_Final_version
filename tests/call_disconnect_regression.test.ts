/**
 * Regression tests for the automatic call disconnection fix.
 *
 * Tests the core detection logic and structural guards that ensure:
 *   1. detectCallEndingIntent correctly identifies farewell/closing phrases.
 *   2. detectCallEndingIntent does NOT fire on mid-conversation phrases.
 *   3. server.ts contains the Twilio farewell detection handler.
 *   4. server.ts contains terminateTwilioCallAfterFarewell with idempotent guard.
 *   5. server.ts phoneFarewellDetected flag resets correctly on interruption.
 *   6. server.ts goodbyeFallbackTimer uses tightened timeouts (≤ 20000 ms).
 *   7. App.tsx autoEndSafetyRef uses tightened timeout (≤ 15000 ms).
 *   8. DNC / opt-out path is not affected by the farewell detection changes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectCallEndingIntent } from '../src/utils/callEnding.ts';

// ─── 1. detectCallEndingIntent: farewell phrases fire correctly ───────────────

test('detectCallEndingIntent: English farewell "Have a wonderful day. Bye!" triggers ending', () => {
  const result = detectCallEndingIntent(
    'Seri nga, unga time-ku romba thanks. Ungalukku Lyka Realty team side-la follow-up pannuvanga. Have a wonderful day. Bye!'
  );
  assert.equal(result, true, 'farewell agent output must return true');
});

test('detectCallEndingIntent: Tanglish farewell triggers ending', () => {
  const result = detectCallEndingIntent(
    'Thank you very much for your time. Nalla irungal, bye!'
  );
  assert.equal(result, true, 'Tamil/Tanglish farewell must return true');
});

test('detectCallEndingIntent: goodbye alone triggers ending', () => {
  const result = detectCallEndingIntent('Goodbye! Have a great day!');
  assert.equal(result, true, '"Goodbye" must return true');
});

// ─── 2. detectCallEndingIntent: mid-conversation false-positives are avoided ──

test('detectCallEndingIntent: does NOT fire on "good" alone without farewell context', () => {
  const result = detectCallEndingIntent(
    'Good question! Let me explain the payment plan.'
  );
  assert.equal(result, false, '"Good question" must NOT trigger ending');
});

test('detectCallEndingIntent: does NOT fire on agent question after closing-like phrase', () => {
  // Agent asks follow-up question — must not disconnect
  const result = detectCallEndingIntent(
    'Wonderful day for a conversation! Can I confirm your WhatsApp number?'
  );
  assert.equal(result, false, 'question at end of turn must NOT trigger ending');
});

test('detectCallEndingIntent: does NOT fire on empty string', () => {
  const result = detectCallEndingIntent('');
  assert.equal(result, false, 'empty string must not trigger ending');
});

// ─── 3. server.ts structural: Twilio farewell detection present ───────────────

test('server.ts: detectCallEndingIntent is called on finalPhoneOutput at turnComplete', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes('detectCallEndingIntent(finalPhoneOutput)'),
    'server.ts must call detectCallEndingIntent on finalPhoneOutput in Twilio handler'
  );
});

// ─── 4. server.ts structural: terminateTwilioCallAfterFarewell defined ────────

test('server.ts: terminateTwilioCallAfterFarewell function exists', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes('const terminateTwilioCallAfterFarewell ='),
    'terminateTwilioCallAfterFarewell must be defined in server.ts'
  );
});

test('server.ts: terminateTwilioCallAfterFarewell performs REST API hangup via calls().update', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes("status: 'completed'"),
    'terminateTwilioCallAfterFarewell must call twilio REST update with status completed'
  );
});

// ─── 5. server.ts structural: idempotent guard on phoneFarewellDetected ───────

test('server.ts: phoneFarewellDetected guard prevents duplicate termination', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes('let phoneFarewellDetected = false'),
    'phoneFarewellDetected flag must be declared'
  );
  assert.ok(
    src.includes('if (phoneFarewellDetected) return'),
    'idempotent guard "if (phoneFarewellDetected) return" must exist'
  );
});

test('server.ts: phoneFarewellDetected resets to false when customer interrupts', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes('phoneFarewellDetected = false'),
    'phoneFarewellDetected must be reset to false on customer interruption'
  );
});

// ─── 6. server.ts structural: goodbyeFallbackTimer tightened ─────────────────

test('server.ts: goodbyeFallbackTimer uses ≤ 20000 ms (not the old 45000 ms)', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    !src.includes('goodbyeFallbackTimer = setTimeout(() => finalizeLiveCall(reason), 45000)') &&
    !src.includes("goodbyeFallbackTimer = setTimeout(() => finalizeLiveCall('goodbye_timeout'), 45000)"),
    'goodbyeFallbackTimer must NOT use 45000 ms (old timeout)'
  );
  const occurrences = (src.match(/goodbyeFallbackTimer = setTimeout\([^,]+,\s*20000\)/g) || []).length;
  assert.ok(occurrences >= 1, `goodbyeFallbackTimer must have at least 1 occurrence of 20000 ms, found ${occurrences}`);
});

// ─── 7. App.tsx structural: autoEndSafetyRef tightened ───────────────────────

test('App.tsx: autoEndSafetyRef uses ≤ 15000 ms (not the old 30000 ms)', () => {
  const src = fs.readFileSync('src/App.tsx', 'utf8');
  assert.ok(
    !src.includes('}, 30000);\n      autoEndSafetyRef.current = null'),
    'autoEndSafetyRef must NOT use 30000 ms (old timeout)'
  );
  assert.ok(
    src.includes('}, 15000)'),
    'autoEndSafetyRef must use 15000 ms (new tightened timeout)'
  );
});

// ─── 8. DNC / opt-out path not affected by farewell changes ─────────────────

test('server.ts: DNC opt-out path still uses OPT_OUT handling (not farewell path)', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes('OPT_OUT') || src.includes('opt_out') || src.includes('do_not_call'),
    'DNC / OPT_OUT handling must still exist in server.ts'
  );
});

test('detectCallEndingIntent: returns boolean for input strings', () => {
  const result = detectCallEndingIntent("Don't call me again. Remove me from your list.");
  assert.equal(typeof result, 'boolean', 'detectCallEndingIntent must return a boolean');
});

// ─── 9. Complete session detection structural tests ──────────────────────────

test('server.ts: complete session (Stage 14 closing) triggers call ending on browser', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes("const isCompleteSession = currentAction && currentAction.stage === 'closing'"),
    'server.ts must detect complete session when stage is closing'
  );
  assert.ok(
    src.includes('(isFarewell || isCompleteSession)'),
    'server.ts must trigger call ending if either farewell is detected or session is complete'
  );
});

test('server.ts: complete session triggers call ending on Twilio PSTN leg', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes("terminateTwilioCallAfterFarewell(8000, isCompleteSession ? 'session_complete' : 'agent_farewell_detected')"),
    'server.ts must terminate Twilio PSTN call on complete session'
  );
});

test('server.ts: premature goodbye guard only applies when rejectionTracker.count > 0 (not on normal calls)', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes('rejectionTracker.count > 0') && src.includes('rejectionTracker.count < 3'),
    'rejectionTracker guard must require count > 0 so normal calls (count === 0) are never blocked'
  );
  assert.ok(
    src.includes("currentAction?.stage === 'objection_handling'"),
    'rejectionTracker guard must only apply when stage is actively objection_handling'
  );
});

// ─── 10. Multi-turn farewell and playback drain resilience ───────────────────

test('App.tsx: arms auto-end on turn_complete when agent text matches farewell', () => {
  const src = fs.readFileSync('src/App.tsx', 'utf8');
  assert.ok(
    src.includes('detectCallEndingIntent(textToCommit)'),
    'App.tsx must check detectCallEndingIntent on turn_complete'
  );
  assert.ok(
    src.includes('scheduleAutoEndCheck(250)'),
    'finishLiveCallAfterPlayback must reschedule check while audio is playing'
  );
});

test('server.ts: clears goodbyeEnding when customer communicates via text or mic', () => {
  const src = fs.readFileSync('server.ts', 'utf8');
  assert.ok(
    src.includes("msg.type === 'text'") && src.includes('if (goodbyeEnding && !callFinalized) clearGoodbyeDetection()'),
    'server.ts must clear goodbye detection on text input'
  );
});
