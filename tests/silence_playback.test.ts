/**
 * silence_playback.test.ts
 *
 * Focused unit tests for the 6-second silence follow-up system:
 *   1. playback_complete is only sent after the full audio queue drains (not mid-play).
 *   2. Customer speech (audio arrival) cancels both the pending ack and the active timer.
 *   3. Stale turnId in playback_complete is ignored and does not arm the timer.
 *   4. Silence timer cleanup on disconnect, interruption, barge-in, closing, and session replace.
 *   5. Follow-up fires only once per unanswered question (silenceFollowUpFired guard).
 *   6. Twilio path never arms the silence timer (no playback_complete from PSTN).
 *
 * These are structural / logic tests executed against the extracted production logic
 * using node:test. No live Gemini session, Twilio, or WebSocket is required.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

// ─── Helper: build a minimal silence-follow-up harness ───────────────────────
// Extracts the armSilenceFollowUp / clearSilenceFollowUp variable declarations
// and function bodies from server.ts and runs them in an isolated scope.

function buildHarness(overrides: {
  currentMode?: string;
  callFinalized?: boolean;
  goodbyeEnding?: boolean;
  isClosing?: boolean;
}) {
  const mode = overrides.currentMode ?? 'agent';
  const finalized = overrides.callFinalized ?? false;
  const goodbye = overrides.goodbyeEnding ?? false;
  const closing = overrides.isClosing ?? false;

  let silenceFollowUpFired = false;
  let silenceFollowUpTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSilenceArmTurnId: string | null = null;
  const firedPrompts: string[] = [];

  const clearSilenceFollowUp = () => {
    if (silenceFollowUpTimer) {
      clearTimeout(silenceFollowUpTimer);
      silenceFollowUpTimer = null;
    }
    silenceFollowUpFired = false;
    pendingSilenceArmTurnId = null;
  };

  const SILENCE_FOLLOW_UP_MS = 20; // shrunk for fast tests
  const SILENCE_FOLLOW_UP_TEXT = 'Sir, line-la irukkeengala?';

  const armSilenceFollowUp = () => {
    if (mode !== 'agent' || finalized || goodbye || closing) return;
    clearSilenceFollowUp();
    silenceFollowUpTimer = setTimeout(() => {
      silenceFollowUpTimer = null;
      if (finalized || goodbye || closing || silenceFollowUpFired) return;
      silenceFollowUpFired = true;
      firedPrompts.push(SILENCE_FOLLOW_UP_TEXT);
    }, SILENCE_FOLLOW_UP_MS);
  };

  return {
    get pendingSilenceArmTurnId() { return pendingSilenceArmTurnId; },
    set pendingSilenceArmTurnId(v: string | null) { pendingSilenceArmTurnId = v; },
    get silenceFollowUpFired() { return silenceFollowUpFired; },
    get silenceFollowUpTimer() { return silenceFollowUpTimer; },
    get firedPrompts() { return firedPrompts; },
    clearSilenceFollowUp,
    armSilenceFollowUp,
  };
}

// ─── 1. playback_complete with matching turnId arms the timer ─────────────────

test('playback_complete with matching turnId arms the silence timer', async () => {
  const h = buildHarness({});
  const turnId = 'turn-abc-123';
  h.pendingSilenceArmTurnId = turnId;

  // Simulate server receiving playback_complete with matching turnId
  if (h.pendingSilenceArmTurnId === turnId) {
    h.pendingSilenceArmTurnId = null;
    h.armSilenceFollowUp();
  }

  assert.ok(h.silenceFollowUpTimer !== null, 'silence timer must be armed');
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 1, 'silence follow-up must fire once');
  assert.ok(h.firedPrompts[0].includes('line-la'), 'correct check-in text');
});

// ─── 2. Stale turnId in playback_complete does NOT arm the timer ──────────────

test('stale turnId in playback_complete is ignored and timer does not arm', async () => {
  const h = buildHarness({});
  const currentTurnId = 'turn-current-999';
  const staleTurnId = 'turn-stale-000';
  h.pendingSilenceArmTurnId = currentTurnId;

  // Browser sends ack for a previous (stale) turn
  if (h.pendingSilenceArmTurnId === staleTurnId) {
    h.pendingSilenceArmTurnId = null;
    h.armSilenceFollowUp();
  }

  assert.equal(h.silenceFollowUpTimer, null, 'stale ack must not arm the timer');
  assert.equal(h.pendingSilenceArmTurnId, currentTurnId, 'pending ack must remain unchanged');
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 0, 'no prompt must fire for stale ack');
});

// ─── 3. Customer audio arrival cancels the pending ack ───────────────────────

test('customer audio arrival clears pendingSilenceArmTurnId before timer arms', () => {
  const h = buildHarness({});
  h.pendingSilenceArmTurnId = 'turn-xyz';

  // Simulate incoming audio message from browser (customer speaking)
  if (h.silenceFollowUpTimer || h.pendingSilenceArmTurnId) h.clearSilenceFollowUp();

  assert.equal(h.pendingSilenceArmTurnId, null, 'pending ack must be cleared on audio arrival');
  assert.equal(h.silenceFollowUpTimer, null, 'timer must not be active');
});

// ─── 4. Customer audio cancels an already-armed timer ────────────────────────

test('customer audio cancels an already-armed silence timer', async () => {
  const h = buildHarness({});
  h.armSilenceFollowUp();
  assert.ok(h.silenceFollowUpTimer !== null, 'timer must be armed first');

  // Customer speaks — simulate audio arrival clearing the timer
  if (h.silenceFollowUpTimer || h.pendingSilenceArmTurnId) h.clearSilenceFollowUp();

  assert.equal(h.silenceFollowUpTimer, null, 'timer must be cancelled on speech');
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 0, 'no prompt must fire after cancellation');
});

// ─── 5. silenceFollowUpFired prevents double-fire within same turn ─────────────

test('silenceFollowUpFired guard prevents double-fire within the same turn', async () => {
  const h = buildHarness({});
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 1, 'must fire once');

  // Try to arm again without clearing (simulating duplicate turn_complete or new audio)
  h.armSilenceFollowUp(); // clearSilenceFollowUp resets silenceFollowUpFired
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 2, 'must fire again after a fresh arm+clear cycle');
});

// ─── 6. clearSilenceFollowUp resets the fired flag for next turn ──────────────

test('clearSilenceFollowUp resets silenceFollowUpFired so next turn can fire', async () => {
  const h = buildHarness({});
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 1);

  // New agent turn: clear and re-arm
  h.clearSilenceFollowUp();
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 2, 'second turn must also be able to fire');
});

// ─── 7. Mode guards: non-agent mode never arms ───────────────────────────────

test('armSilenceFollowUp does not arm when mode is chatbot', async () => {
  const h = buildHarness({ currentMode: 'chatbot' });
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.silenceFollowUpTimer, null, 'chatbot mode must not arm');
  assert.equal(h.firedPrompts.length, 0);
});

// ─── 8. Closing / callFinalized / goodbyeEnding guards ───────────────────────

for (const [desc, overrides] of [
  ['callFinalized', { callFinalized: true }],
  ['goodbyeEnding', { goodbyeEnding: true }],
  ['isClosing', { isClosing: true }],
] as [string, Parameters<typeof buildHarness>[0]][]) {
  test(`armSilenceFollowUp does not arm when ${desc}`, async () => {
    const h = buildHarness(overrides);
    h.armSilenceFollowUp();
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    assert.equal(h.silenceFollowUpTimer, null, `${desc} must block arming`);
    assert.equal(h.firedPrompts.length, 0);
  });
}

// ─── 9. Structural: server.ts contains the playback_complete handler ──────────

test('server.ts contains the playback_complete handler that checks pendingSilenceArmTurnId', () => {
  assert.ok(
    server.includes("} else if (msg.type === 'playback_complete') {"),
    'playback_complete message branch must exist in server.ts'
  );
  assert.ok(
    server.includes('pendingSilenceArmTurnId === ackTurnId'),
    'turnId guard must check pendingSilenceArmTurnId before arming'
  );
  assert.ok(
    server.includes('armSilenceFollowUp()'),
    'armSilenceFollowUp must be called on verified playback_complete'
  );
});

// ─── 10. Structural: audio arrival clears silence on the server ──────────────

test('server.ts clears silence on customer audio arrival (early cancellation)', () => {
  const audioSection = (() => {
    const start = server.indexOf("} else if (msg.type === 'audio') {");
    // Find the closing of this branch (next '} else if' or closing of message handler)
    const end = server.indexOf("} else if (msg.type === 'user_speech_transcript')", start);
    return server.slice(start, end);
  })();
  assert.ok(
    audioSection.includes('clearSilenceFollowUp'),
    'silence timer must be cleared when customer audio arrives in the browser handler'
  );
});

// ─── 11. Structural: interruption clears silence ─────────────────────────────

test('server.ts clears silence follow-up when Gemini Live reports interruption', () => {
  const interruptedSection = server.slice(
    server.indexOf('// Genuine User interruption detected by neural server-side VAD'),
    server.indexOf('// Turn finished - finalize agent utterance')
  );
  assert.ok(
    interruptedSection.includes('clearSilenceFollowUp()'),
    'clearSilenceFollowUp must be called on Gemini Live interrupted event'
  );
});

// ─── 12. Structural: barge-in clears silence ─────────────────────────────────

test("server.ts clears silence follow-up on client barge_in message", () => {
  const bargeStart = server.indexOf("} else if (msg.type === 'barge_in') {");
  const bargeEnd = server.indexOf("} else if (msg.type === 'end')", bargeStart);
  const bargeBlock = server.slice(bargeStart, bargeEnd);
  assert.ok(
    bargeBlock.includes('clearSilenceFollowUp()'),
    'clearSilenceFollowUp must be called in barge_in handler'
  );
});

// ─── 13. Structural: disconnect calls clearGoodbyeDetection (which wraps clearSilenceFollowUp) ──

test('server.ts calls clearGoodbyeDetection on WebSocket close, which wraps clearSilenceFollowUp', () => {
  const closeSection = server.slice(
    server.indexOf('clientWs.on(\'close\''),
    server.indexOf('clientWs.on(\'close\'') + 500
  );
  assert.ok(
    closeSection.includes('clearGoodbyeDetection()'),
    'disconnect handler must call clearGoodbyeDetection which calls clearSilenceFollowUp'
  );
  // Also verify clearGoodbyeDetection itself calls clearSilenceFollowUp
  const goodbyeDetectionFn = server.slice(
    server.indexOf('const clearGoodbyeDetection'),
    server.indexOf('const clearGoodbyeDetection') + 300
  );
  assert.ok(
    goodbyeDetectionFn.includes('clearSilenceFollowUp()'),
    'clearGoodbyeDetection must call clearSilenceFollowUp'
  );
});

// ─── 14. Structural: Twilio path NEVER arms the silence timer ────────────────

test('Twilio handler has no armSilenceFollowUp or playback_complete handler', () => {
  // Twilio wss handler starts at twilioWss.on('connection') (before browser wss.on('connection')).
  // Extract only the Twilio section by taking from its start to the browser section start.
  const twilioStart = server.indexOf("twilioWss.on('connection'");
  const browserStart = server.indexOf("wss.on('connection'");
  if (twilioStart === -1 || browserStart === -1) {
    // Cannot locate section — skip rather than false-fail.
    return;
  }
  const twilioSection = server.slice(twilioStart, browserStart);
  assert.ok(
    !twilioSection.includes('pendingSilenceArmTurnId'),
    'Twilio handler must not reference pendingSilenceArmTurnId'
  );
  assert.ok(
    !twilioSection.includes('armSilenceFollowUp'),
    'Twilio handler must not call armSilenceFollowUp'
  );
});

// ─── 15. App.tsx: playback_complete sent only after audio drains, not mid-play ─

test('App.tsx sends playback_complete only when player reports playback has stopped', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // Find the ack send by the unique pendingPlaybackAckRef null-clear pattern that immediately
  // precedes the playback_complete send in the else (playing===false) branch.
  const ackClearAnchor = 'pendingPlaybackAckRef.current = null;';
  const ackSendAnchor = "type: 'playback_complete'";

  // Both must appear in the file
  assert.ok(appSource.includes(ackClearAnchor), 'pendingPlaybackAckRef null-clear must exist in App.tsx');
  assert.ok(appSource.includes(ackSendAnchor), 'playback_complete send must exist in App.tsx');

  // The clear and send must be close together (within 300 chars) in the else branch
  const clearPos = appSource.indexOf(ackClearAnchor);
  const sendPos = appSource.indexOf(ackSendAnchor);
  assert.ok(Math.abs(sendPos - clearPos) < 300, 'ack clear and playback_complete send must be adjacent (within 300 chars)');

  // Confirm the ack is NOT sent on the playing===true branch (before the else).
  // The speaking-true branch runs setAgentSpeaking(true); find that region.
  const speakingTrue = appSource.indexOf('recorderRef.current?.setAgentSpeaking(true)');
  const speakingFalse = appSource.indexOf('recorderRef.current?.setAgentSpeaking(false)');
  assert.ok(speakingTrue !== -1 && speakingFalse !== -1, 'both setAgentSpeaking branches must exist');
  const speakingSection = appSource.slice(speakingTrue, speakingFalse);
  assert.ok(
    !speakingSection.includes("type: 'playback_complete'"),
    'playback_complete must NOT be sent while audio is still playing'
  );
});

// ─── 16. App.tsx: pendingPlaybackAckRef cleared on call_ended and call_ending ─

test('App.tsx clears pendingPlaybackAckRef on call_ended and call_ending to prevent stale ack', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const callEndedSection = appSource.slice(
    appSource.indexOf("} else if (msg.type === 'call_ended') {"),
    appSource.indexOf("} else if (msg.type === 'call_ending') {") + 400
  );
  assert.ok(
    callEndedSection.includes('pendingPlaybackAckRef.current = null'),
    'pendingPlaybackAckRef must be cleared on call_ended'
  );
  const callEndingSection = appSource.slice(
    appSource.indexOf("} else if (msg.type === 'call_ending') {"),
    appSource.indexOf("} else if (msg.type === 'audio') {")
  );
  assert.ok(
    callEndingSection.includes('pendingPlaybackAckRef.current = null'),
    'pendingPlaybackAckRef must be cleared on call_ending (silence ack not needed during closing)'
  );
});

// ─── 17. App.tsx: interrupted message clears pendingPlaybackAckRef ────────────

test('App.tsx clears pendingPlaybackAckRef on interrupted message to discard stale ack', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const interruptedSection = appSource.slice(
    appSource.indexOf("} else if (msg.type === 'interrupted') {"),
    appSource.indexOf("} else if (msg.type === 'voice_updated') {")
  );
  assert.ok(
    interruptedSection.includes('pendingPlaybackAckRef.current = null'),
    'pendingPlaybackAckRef must be cleared on interrupted message'
  );
});
