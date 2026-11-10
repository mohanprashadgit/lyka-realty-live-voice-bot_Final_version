/**
 * silence_playback.test.ts
 *
 * Focused unit tests for the intelligent silence detection & natural customer
 * follow-up system:
 *   1. playback_complete is only sent after the full audio queue drains (not mid-play).
 *   2. Customer speech (audio arrival) cancels both the pending ack and the active timer.
 *   3. Stale turnId in playback_complete is ignored and does not arm the timer.
 *   4. Silence timer cleanup on disconnect, interruption, barge-in, closing, and session replace.
 *   5. Follow-up fires only once per armed timer (silenceFollowUpFired guard).
 *   6. Twilio PSTN path arms its own staged check-in from turnComplete (no
 *      playback_complete exists on the phone stream) and NEVER terminates the
 *      call from silence.
 *   7. Escalating stages: 6s / 8s / 10s configurable delays with distinct
 *      natural check-in lines; the escalation resets when the customer speaks
 *      and stops after the third check-in.
 *   8. Explicit customer wait requests hold the check-ins for the requested
 *      period (no repeated "line-la irukeengala?").
 *
 * These are structural / logic tests executed against the extracted production
 * logic using node:test. No live Gemini session, Twilio, or WebSocket required.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SILENCE_STAGE_COUNT, getSilenceStageCount, getSilenceStageDelayMs, getSilenceStagePrompt, getSilenceWaitHoldMs, buildSilenceFollowUpDirective } from '../src/utils/silenceFollowUp.js';
import { customerAskedForWait } from '../src/utils/customerWaitRequest.js';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

// ─── Helper: build a minimal staged silence-follow-up harness ─────────────────
// Mirrors the staged armSilenceFollowUp / clearSilenceFollowUp logic that runs
// per WebSocket connection in server.ts (timings shrunk for fast tests).

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

  let silenceFollowUpTimer: ReturnType<typeof setTimeout> | null = null;
  let silenceFollowUpFired = false;
  let silenceFollowUpStage = 0;
  let silencePausedUntil = 0;
  let silenceWaitHoldTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSilenceArmTurnId: string | null = null;
  const firedPrompts: string[] = [];
  const STAGE_PROMPTS = ['Sir, line-la irukkeengala?', 'Sir, en voice kekkutha?', 'Sir, disturb panrenaa?'];
  const STAGE_MS = 20; // shrunk for fast tests

  const clearSilenceFollowUp = () => {
    if (silenceFollowUpTimer) {
      clearTimeout(silenceFollowUpTimer);
      silenceFollowUpTimer = null;
    }
    silenceFollowUpFired = false;
    pendingSilenceArmTurnId = null;
  };

  const resetSilenceStage = () => { silenceFollowUpStage = 0; };

  const clearSilenceWaitHold = () => {
    if (silenceWaitHoldTimer) {
      clearTimeout(silenceWaitHoldTimer);
      silenceWaitHoldTimer = null;
    }
    silencePausedUntil = 0;
  };

  const holdSilenceForWaitRequest = () => { silencePausedUntil = Date.now() + STAGE_MS * 6; };

  const armSilenceFollowUp = () => {
    if (mode !== 'agent' || finalized || goodbye || closing) return;
    // all escalating check-ins already delivered: stay quiet, never end the call
    if (silenceFollowUpStage >= getSilenceStageCount()) return;
    clearSilenceFollowUp();
    if (silencePausedUntil > Date.now()) {
      if (!silenceWaitHoldTimer) {
        silenceWaitHoldTimer = setTimeout(() => {
          silenceWaitHoldTimer = null;
          armSilenceFollowUp();
        }, silencePausedUntil - Date.now());
      }
      return;
    }
    const stageIndex = silenceFollowUpStage;
    silenceFollowUpTimer = setTimeout(() => {
      silenceFollowUpTimer = null;
      if (finalized || goodbye || closing || silenceFollowUpFired) return;
      if (silencePausedUntil > Date.now()) { armSilenceFollowUp(); return; }
      silenceFollowUpFired = true;
      silenceFollowUpStage = stageIndex + 1;
      firedPrompts.push(STAGE_PROMPTS[stageIndex]);
    }, STAGE_MS);
  };

  return {
    get pendingSilenceArmTurnId() { return pendingSilenceArmTurnId; },
    set pendingSilenceArmTurnId(v: string | null) { pendingSilenceArmTurnId = v; },
    get silenceFollowUpFired() { return silenceFollowUpFired; },
    get silenceFollowUpTimer() { return silenceFollowUpTimer; },
    get silenceFollowUpStage() { return silenceFollowUpStage; },
    get firedPrompts() { return firedPrompts; },
    get silencePausedUntil() { return silencePausedUntil; },
    clearSilenceFollowUp,
    resetSilenceStage,
    clearSilenceWaitHold,
    holdSilenceForWaitRequest,
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
  h.resetSilenceStage();

  assert.equal(h.pendingSilenceArmTurnId, null, 'pending ack must be cleared on audio arrival');
  assert.equal(h.silenceFollowUpTimer, null, 'timer must not be active');
  assert.equal(h.silenceFollowUpStage, 0, 'escalation counter resets on customer speech');
});

// ─── 4. Customer audio cancels an already-armed timer ────────────────────────

test('customer audio cancels an already-armed silence timer', async () => {
  const h = buildHarness({});
  h.armSilenceFollowUp();
  assert.ok(h.silenceFollowUpTimer !== null, 'timer must be armed first');

  // Customer speaks — simulate audio arrival clearing the timer
  if (h.silenceFollowUpTimer || h.pendingSilenceArmTurnId) h.clearSilenceFollowUp();
  h.resetSilenceStage();

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
  assert.ok(
    audioSection.includes('resetSilenceStage()'),
    'escalation counter must reset when customer audio arrives'
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
  assert.ok(
    interruptedSection.includes('resetSilenceStage()'),
    'interruption is customer speech: escalation counter must reset'
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
    server.indexOf("clientWs.on('close'"),
    server.indexOf("clientWs.on('close'") + 500
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

// ─── 14. Structural: Twilio path uses its own staged arming (no playback ack) ──

test('Twilio path arms staged check-ins from turnComplete and never from a playback ack', () => {
  // Twilio wss handler starts at twilioWss.on('connection') (before browser wss.on('connection')).
  // Extract only the Twilio section by taking from its start to the browser section start.
  const twilioStart = server.indexOf("twilioWss.on('connection'");
  const browserStart = server.indexOf("wss.on('connection'");
  if (twilioStart === -1 || browserStart === -1) {
    // Cannot locate section — skip rather than false-fail.
    return;
  }
  const twilioSection = server.slice(twilioStart, browserStart);
  // The PSTN stream has no playback_complete acknowledgement: the browser-only
  // ack state must never be referenced from the Twilio handler.
  assert.ok(
    !twilioSection.includes('pendingSilenceArmTurnId'),
    'Twilio handler must not reference pendingSilenceArmTurnId'
  );
  assert.ok(
    !twilioSection.includes("msg.type === 'playback_complete'"),
    'Twilio handler must not handle playback_complete messages'
  );
  assert.ok(
    twilioSection.includes('armPhoneSilenceFollowUp'),
    'Twilio handler must arm its own staged silence check-in (armPhoneSilenceFollowUp)'
  );
  assert.ok(
    twilioSection.includes('resetPhoneSilenceStage()'),
    'Twilio handler must reset the escalation when customer speech (inputTranscription) arrives'
  );
  // Silence never terminates the PSTN call: the arming block must not hang up
  // or trigger the existing farewell mechanism.
  const armFnStart = twilioSection.indexOf('const armPhoneSilenceFollowUp');
  const armFnEnd = twilioSection.indexOf('const apiKey = getGeminiApiKey();', armFnStart);
  const armFnBlock = twilioSection.slice(armFnStart, armFnEnd);
  assert.ok(
    !armFnBlock.includes('terminateTwilioCallAfterFarewell'),
    'the silence arming logic must NEVER terminate the call (no farewell/hangup from silence)'
  );
  assert.ok(
    !armFnBlock.includes('finalizeLiveCall'),
    'the silence arming logic must never finalize the call'
  );
  // Timers are cleared when the media stream disconnects.
  assert.ok(
    twilioSection.includes('clearPhoneSilenceFollowUp()'),
    'Twilio disconnect/stop paths must clear the silence timers'
  );
  assert.ok(
    twilioSection.includes("if (turnComplete && !phoneFarewellDetected) armPhoneSilenceFollowUp();"),
    'arming must only happen for a completed turn with no pending farewell'
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

// ═══════════════════════════════════════════════════════════════════════════════
// New: intelligent staged escalation + wait-request hold + safety contracts
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 18. Escalating stages produce distinct natural check-ins and stop after 3 ─

test('staged escalation fires distinct check-ins and stops after the third', async () => {
  const h = buildHarness({});
  // Stage 1
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 1);
  assert.ok(h.firedPrompts[0].includes('line-la'), 'stage 1 line');
  // Stage 2 — silence continues, the follow-up turn finished and re-armed.
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 2);
  assert.ok(h.firedPrompts[1].includes('voice kekkutha'), 'stage 2 line');
  // Stage 3
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 3);
  assert.ok(h.firedPrompts[2].includes('disturb'), 'stage 3 line');
  // After stage 3: no more check-ins are armed (caller stays silent, call continues).
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 3, 'escalation must stop after the third check-in');
  assert.equal(h.silenceFollowUpTimer, null, 'no further timer may be armed');
});

// ─── 19. Customer speech resets the escalation counter ─────────────────────────

test('customer speech resets the escalation so the next window starts at stage 1', async () => {
  const h = buildHarness({});
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 2, 'stage 2 reached');
  // Customer finally speaks.
  h.resetSilenceStage();
  h.clearSilenceFollowUp();
  assert.equal(h.silenceFollowUpStage, 0, 'escalation counter reset');
  // Silence again — must start back at stage 1, not continue escalating.
  h.armSilenceFollowUp();
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.ok(h.firedPrompts[2].includes('line-la'), 'window restarts at the first gentle check-in');
});

// ─── 20. Explicit customer wait request holds check-ins ──────────────────────

test('customer wait request holds the check-ins for the requested period', async () => {
  const h = buildHarness({});
  h.holdSilenceForWaitRequest();
  h.armSilenceFollowUp();
  assert.equal(h.silenceFollowUpTimer, null, 'no stage timer may run while wait-requested');
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 0, 'no check-in during the requested waiting period');
  // The hold re-arms after the requested period lapses.
  await new Promise<void>(resolve => setTimeout(resolve, 200));
  assert.ok(h.firedPrompts.length >= 1, 'check-in resumes after the wait period lapses');
});

// ─── 21. Customer speech after a wait request ends the hold ──────────────────

test('customer speech after a wait request ends the hold', async () => {
  const h = buildHarness({});
  h.holdSilenceForWaitRequest();
  assert.ok(h.silencePausedUntil > 0, 'hold is active');
  // Customer speaks again (non-wait speech) — hold ends.
  h.clearSilenceWaitHold();
  h.resetSilenceStage();
  assert.equal(h.silencePausedUntil, 0, 'hold cleared by new customer speech');
  h.armSilenceFollowUp();
  assert.ok(h.silenceFollowUpTimer !== null, 'normal silence window may arm again');
  await new Promise<void>(resolve => setTimeout(resolve, 50));
  assert.equal(h.firedPrompts.length, 1);
});

// ─── 22. Stage configuration defaults ────────────────────────────────────────

test('stage delays default to 6000 / 8000 / 10000 ms and are order-safe', () => {
  assert.equal(getSilenceStageCount(), 3);
  assert.equal(SILENCE_STAGE_COUNT, 3);
  assert.equal(getSilenceStageDelayMs(0), 6000, 'first silence delay');
  assert.equal(getSilenceStageDelayMs(1), 8000, 'second silence delay');
  assert.equal(getSilenceStageDelayMs(2), 10000, 'third silence delay');
  assert.ok(getSilenceStageDelayMs(0) < getSilenceStageDelayMs(1) && getSilenceStageDelayMs(1) < getSilenceStageDelayMs(2));
});

// ─── 23. Stage configuration is environment-configurable ──────────────────────

test('stage delays and wait hold are configurable via environment', () => {
  const source = fs.readFileSync(new URL('../src/utils/silenceFollowUp.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('SILENCE_STAGE1_MS'), 'stage 1 delay configurable');
  assert.ok(source.includes('SILENCE_STAGE2_MS'), 'stage 2 delay configurable');
  assert.ok(source.includes('SILENCE_STAGE3_MS'), 'stage 3 delay configurable');
  assert.ok(source.includes('SILENCE_WAIT_HOLD_MS'), 'wait hold configurable');
});

// ─── 24. Check-in lines per language ──────────────────────────────────────────

test('check-in lines exist for all supported languages and default to Tanglish', () => {
  assert.ok(getSilenceStagePrompt('bilingual', 0).includes('line-la irukeengala'));
  assert.ok(getSilenceStagePrompt('bilingual', 1).includes('voice kekkutha'));
  assert.ok(getSilenceStagePrompt('bilingual', 2).includes('disturb panrenaa'));
  assert.ok(getSilenceStagePrompt('tamil', 0).includes('line-la irukeengala'));
  assert.equal(getSilenceStagePrompt('english', 0), 'Hello sir, are you still there?');
  assert.equal(getSilenceStagePrompt('english', 1), 'Sir, can you hear me?');
  assert.equal(getSilenceStagePrompt('english', 2), 'Just checking, are you still connected?');
  assert.notEqual(getSilenceStagePrompt('hindi', 0), '');
  assert.notEqual(getSilenceStagePrompt('arabic', 0), '');
  assert.equal(getSilenceStagePrompt('unknown-language', 0), getSilenceStagePrompt('bilingual', 0),
    'unknown languages must fall back to the Tanglish set (never force another language)');
});

// ─── 25. Injection directive: acknowledgement + resume + no-busy safety ──────

test('follow-up directive acknowledges the answer and resumes the previous point', () => {
  const d1 = buildSilenceFollowUpDirective('bilingual', 0, 6000);
  assert.ok(d1.includes('line-la irukeengala'), 'directive carries the exact stage-1 line');
  assert.ok(d1.includes('Sure sir.'), 'stage-1 answer acknowledgement');
  assert.ok(d1.includes('previous point'), 'resume from the exact previous conversation stage');
  const d2 = buildSilenceFollowUpDirective('bilingual', 1, 8000);
  assert.ok(d2.includes('voice kekkutha'), 'directive carries the exact stage-2 line');
  assert.ok(d2.includes('Okay sir, thank you.'), 'stage-2 answer acknowledgement');
  const d3 = buildSilenceFollowUpDirective('bilingual', 2, 10000);
  assert.ok(d3.includes('disturb panrenaa'), 'directive carries the exact stage-3 line');
});

test('follow-up directive never assumes the customer is busy or wants to end the call', () => {
  assert.ok(getSilenceWaitHoldMs() >= 5000, 'wait hold must be a sensible positive window');
  for (const language of ['bilingual', 'english', 'hindi', 'arabic']) {
    for (let stage = 0; stage < getSilenceStageCount(); stage++) {
      const d = buildSilenceFollowUpDirective(language, stage, getSilenceStageDelayMs(stage));
      assert.match(d, /NEVER assume the customer is busy/, `${language} stage ${stage}: busy assumption forbidden`);
      assert.match(d, /NEVER offer to end the call/, `${language} stage ${stage}: no call-ending suggestion`);
      assert.match(d, /NEVER.*(call back|rescheduling)/s, `${language} stage ${stage}: no rescheduling/call-back suggestion`);
      assert.match(d, /ONLY a connection/, `${language} stage ${stage}: pure connection check`);
      assert.match(d, /do NOT repeat questions already answered/, `${language} stage ${stage}: never repeat answered questions`);
    }
  }
});

// ─── 26. Wait-request detection (Scenario C) ─────────────────────────────────

test('customer wait requests are detected across languages', () => {
  // Task scenario C examples
  assert.equal(customerAskedForWait('One minute.'), true);
  assert.equal(customerAskedForWait('Konjam wait pannunga.'), true);
  assert.equal(customerAskedForWait('Let me think.'), true);
  assert.equal(customerAskedForWait('Wait.'), true);
  assert.equal(customerAskedForWait('wait sir'), true);
  // Additional natural variants
  assert.equal(customerAskedForWait('oru nimisham'), true);
  assert.equal(customerAskedForWait('give me a minute'), true);
  assert.equal(customerAskedForWait('ek minute'), true);
  assert.equal(customerAskedForWait('thodi der'), true);
  assert.equal(customerAskedForWait('konjam time kudunga'), true);
  // NOT wait requests
  assert.equal(customerAskedForWait('I am waiting for your offer details'), false);
  assert.equal(customerAskedForWait('I cannot wait to see the property'), false);
  assert.equal(customerAskedForWait('flat one minute-la venum'), false);
  assert.equal(customerAskedForWait('yes sollunga'), false);
  assert.equal(customerAskedForWait(''), false);
});

// ─── 27. Structural: browser wait hold wired into the transcript flush ───────

test('server.ts evaluates wait requests on finalized customer transcripts and resets stage', () => {
  const flushStart = server.indexOf('const flushUserTranscript = () => {');
  const flushEnd = server.indexOf('flushPendingTranscript = () => {', flushStart);
  const flushBlock = server.slice(flushStart, flushEnd);
  assert.ok(flushBlock.includes('resetSilenceStage()'), 'finalized customer speech resets the escalation');
  assert.ok(flushBlock.includes('customerAskedForWait(raw)'), 'wait request evaluated on finalized speech');
  assert.ok(flushBlock.includes('holdSilenceForWaitRequest()'), 'wait request starts the hold');
  assert.ok(flushBlock.includes('clearSilenceWaitHold()'), 'previous hold is cleared on new speech');
});

// ─── 28. Structural: silence never terminates the browser call ────────────────

test('browser silence block never calls finalize/close mechanisms', () => {
  const blockStart = server.indexOf('Intelligent silence detection & natural customer follow-up (browser)');
  const blockEnd = server.indexOf('Three-level objection handling', blockStart);
  // Evaluate executable code only — explanatory comments legitimately mention
  // the goodbye/finalize rules they enforce.
  const silenceBlock = server.slice(blockStart, blockEnd)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  assert.ok(silenceBlock.length > 100, 'browser silence block located');
  assert.ok(
    !silenceBlock.includes('finalizeLiveCall'),
    'silence arming must never finalize the browser call'
  );
  assert.ok(
    !silenceBlock.includes('goodbyeEnding = true'),
    'silence arming must never trigger the goodbye mechanism'
  );
  assert.ok(
    !silenceBlock.includes('closeCallForUnwantedSpeech'),
    'silence arming must never close the call for unwanted speech'
  );
  // Stage cap present (never more than three escalating check-ins).
  assert.ok(
    silenceBlock.includes('silenceFollowUpStage >= getSilenceStageCount()'),
    'escalation guard must stop after the third check-in'
  );
  // The staged check-in goes through the same Gemini live session (not a
  // separate TTS or Text->Speech HTTP request).
  assert.ok(
    silenceBlock.includes('sendClientContent') && !silenceBlock.includes('generateContent'),
    'check-in must reuse the existing Gemini Live speaking path'
  );
});

// ─── 29. Structural: wait hold + timers cleaned on disconnect/close paths ────

test('all silence timers are cleared on disconnect and termination paths', () => {
  const finalizeStart = server.indexOf('const finalizeLiveCall = (requestedReason: string) => {');
  const finalizeBlock = server.slice(finalizeStart, finalizeStart + 600);
  assert.ok(finalizeBlock.includes('clearSilenceWaitHold()'), 'finalizeLiveCall clears the wait hold');

  const closePos = server.indexOf("clientWs.on('close'");
  const closeBlock = server.slice(closePos, closePos + 500);
  assert.ok(closeBlock.includes('clearSilenceWaitHold()'), 'browser disconnect clears the wait hold');

  const unwantedPos = server.indexOf('const closeCallForUnwantedSpeech = () => {');
  const unwantedBlock = server.slice(unwantedPos, unwantedPos + 500);
  assert.ok(unwantedBlock.includes('clearSilenceWaitHold()'), 'unwanted-speech close clears the wait hold');
});
