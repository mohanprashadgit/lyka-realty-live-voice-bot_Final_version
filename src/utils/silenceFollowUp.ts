/**
 * Intelligent silence detection & natural customer follow-up — shared
 * configuration for the browser live call and the Twilio PSTN call.
 *
 * Behaviour contract (mirrors the LYKA REALTY feature spec):
 *   Stage 1 — after the configured first delay (default 6 s) of customer
 *             silence following the agent's completed turn:
 *             "Hello sir, line-la irukeengala?"
 *   Stage 2 — after the second delay (default 8 s):
 *             "Sir, en voice kekkutha?"
 *   Stage 3 — after the third delay (default 10 s):
 *             "Sir, disturb panrenaa?"
 *
 * Hard rules enforced by the callers:
 *   - Never fire while the agent's audio is still playing.
 *   - Timings are configurable through environment variables.
 *   - A check-in never repeats within the same silence window and the
 *     escalation counter resets as soon as the customer speaks.
 *   - Silence NEVER ends the call: the agent must only ask whether the
 *     customer is still connected, must never assume the customer is busy,
 *     unavailable or wants to hang up, and must never offer to end,
 *     reschedule or call back without an explicit customer request.
 *
 * Pure module — no session, WebSocket or database dependencies.
 */

export const SILENCE_STAGE_COUNT = 3;

/** Number of escalating check-in stages (kept as a getter for callers/tests). */
export function getSilenceStageCount(): number {
  return SILENCE_STAGE_COUNT;
}

const SILENCE_STAGE_ENV_KEYS = ['SILENCE_STAGE1_MS', 'SILENCE_STAGE2_MS', 'SILENCE_STAGE3_MS'];
const SILENCE_STAGE_DEFAULTS = [6000, 8000, 10000];
const MIN_SILENCE_STAGE_MS = 2000;
const MAX_SILENCE_STAGE_MS = 120000;

/** Configurable delay before the check-in of the given stage (0-based). */
export function getSilenceStageDelayMs(stageIndex: number): number {
  if (stageIndex < 0 || stageIndex >= SILENCE_STAGE_COUNT) stageIndex = 0;
  const envKey = SILENCE_STAGE_ENV_KEYS[stageIndex];
  const raw = Number(process.env?.[envKey]);
  const value = Number.isFinite(raw) && raw > 0 ? raw : SILENCE_STAGE_DEFAULTS[stageIndex];
  return Math.min(MAX_SILENCE_STAGE_MS, Math.max(MIN_SILENCE_STAGE_MS, value));
}

/**
 * Natural, polite check-in lines per call language (0-based stage).
 * Tamil / Tanglish stays the default human-sounding set; other supported
 * languages get the equivalent line instead of a forced Tamil phrase.
 */
const SILENCE_STAGE_PROMPTS: Record<string, string[]> = {
  bilingual: ['Hello sir, line-la irukeengala?', 'Sir, en voice kekkutha?', 'Sir, disturb panrenaa?'],
  tamil: ['Hello sir, line-la irukeengala?', 'Sir, en voice kekkutha?', 'Sir, disturb panrenaa?'],
  english: ['Hello sir, are you still there?', 'Sir, can you hear me?', 'Just checking, are you still connected?'],
  hindi: ['हैलो सर, लाइन पर हैं आप?', 'सर, मेरी आवाज़ सुनाई दे रही है क्या?', 'सर, क्या मैं डिस्टर्ब कर रहा हूँ?'],
  arabic: ['ألو سيدي، هل ما زلت على الخط؟', 'سيدي، هل تسمعني؟', 'سيدي، هل أقاطعك؟'],
};

/** The exact check-in phrase the agent should say for a stage (0-based). */
export function getSilenceStagePrompt(language: string, stageIndex: number): string {
  const bank = SILENCE_STAGE_PROMPTS?.[language] || SILENCE_STAGE_PROMPTS.bilingual;
  return bank[stageIndex % bank.length];
}

/** How long a customer wait request suspends all check-ins. Configurable. */
export function getSilenceWaitHoldMs(): number {
  const raw = Number(process.env?.SILENCE_WAIT_HOLD_MS);
  const value = Number.isFinite(raw) && raw > 0 ? raw : 60000;
  return Math.min(300000, Math.max(5000, value));
}

/** Short confirmation the agent gives when the customer answers a check-in. */
const SILENCE_STAGE_ACKS: Record<string, string[]> = {
  bilingual: ['Sure sir.', 'Okay sir, thank you.', ''],
  tamil: ['Sure sir.', 'Okay sir, thank you.', ''],
  english: ['Sure, sir.', 'Okay sir, thank you.', ''],
  hindi: ['जी बिल्कुल सर।', 'ठीक है सर, धन्यवाद।', ''],
  arabic: ['حسناً سيدي.', 'حسناً سيدي، شكراً لك.', ''],
};

/**
 * Builds the system directive injected as an (invisible) user turn so the
 * native Gemini Live voice speaks the check-in through the SAME voice and
 * session. Keeps the conversation context intact: the agent acknowledges the
 * customer's confirmation and resumes the exact previous point of the call.
 */
export function buildSilenceFollowUpDirective(language: string, stageIndex: number, previousDelayMs?: number): string {
  const stage = Math.min(Math.max(0, stageIndex), SILENCE_STAGE_COUNT - 1) + 1;
  const phrase = getSilenceStagePrompt(language, stageIndex);
  const ack = (SILENCE_STAGE_ACKS?.[language] || SILENCE_STAGE_ACKS.bilingual)[stageIndex] || '';
  const ackLine = ack
    ? `If the customer confirms they are on the line or can hear you (e.g. "Yes", "Yes, sollunga", "kekkudhu"), FIRST acknowledge very briefly with exactly one short line: "${ack}" and then IMMEDIATELY continue the exact previous point of the conversation. `
    : 'If the customer then responds, acknowledge warmly in one short line and IMMEDIATELY continue the exact previous point of the conversation. ';
  return (
    `[System: The customer has been silent for ${previousDelayMs ?? getSilenceStageDelayMs(stageIndex)} ms after your last turn finished playing. ` +
    `Gently ask ONCE, natural, warm and human — not robotic: "${phrase}" — then stop talking and wait quietly. ` +
    `This is ONLY a connection / hearing check. ` +
    `NEVER assume the customer is busy, unavailable, uninterested, in a meeting, sleeping or wants to end the call. ` +
    `NEVER say the line is disconnected, NEVER promise to call back, NEVER offer to end the call, NEVER suggest rescheduling, and NEVER produce any goodbye. Only ask the check-in above and resume the previous topic when the customer answers. ` +
    ackLine +
    `Do NOT restart the conversation, do NOT repeat questions already answered, and do NOT change the topic. ` +
    `If the customer asks you to wait ("One minute", "konjam wait pannunga", "Let me think"), accept politely ("Okay sir, take your time") and stay quiet while they take that time.]`
  );
}
