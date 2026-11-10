# SILENCE FOLLOW-UP — IMPLEMENTATION REPORT

Intelligent silence detection & natural customer follow-up for the LYKA REALTY AI voice
agent. Covers **both** the browser live call (WebSockets + Gemini Live) and the
Twilio automated PSTN call (media streams), in all supported languages
(Tamil/Tanglish, English, Hindi, Arabic), for both Priya and Harish personas.

---

## 1. Root cause of the previous behaviour

The earlier implementation only had a **single-stage** silence mechanism, and it had
gaps that made the agent feel broken or robotic during customer silence:

| Gap | Effect before the fix |
|---|---|
| Single stage only | The agent asked the same "Hello sir…" check-in once after ~6 s and then went permanently quiet; no escalation, no polite re-check. |
| Browser only | On Twilio calls there was no silence detection at all — the agent never checked in when the customer went silent on the phone. |
| No playback ack guard | (Browser) the timer could start while the agent was still finishing / re-speaking because it was not tied to the exact completed turn. |
| No acknowledgment lines | When the customer answered a check-in ("Yes sir"), the agent had no short confirmation ("Sure sir." / "Okay sir, thank you.") before resuming. |
| No wait-request handling | If the customer said "One minute", "Konjam wait pannunga", "Let me think", the counter kept ticking and the agent interrupted the customer's thinking time with check-ins. |
| No stage resume discipline | After a check-in the agent could repeat already-answered questions instead of continuing from the exact previous point. |
| Silence could imply call end | No explicit guard prevented the model from treating silence as "customer is busy / wants to end the call" and producing goodbyes or reschedule offers. |

---

## 2. What was implemented

### 2.1 Staged, configurable check-ins

Three escalating stages, each fired when the customer has been silent for the
configured delay **after the agent's previous turn finished playing**:

| Stage | Delay (default) | Tamil / Tanglish (bilingual) | English |
|---|---|---|---|
| 1 | 6 s (`SILENCE_STAGE1_MS`) | "Hello sir, line-la irukeengala?" | "Hello sir, are you still there?" |
| 2 | 8 s (`SILENCE_STAGE2_MS`) | "Sir, en voice kekkutha?" | "Sir, can you hear me?" |
| 3 | 10 s (`SILENCE_STAGE3_MS`) | "Sir, disturb panrenaa?" | "Just checking, are you still connected?" |

* Hindi and Arabic equivalents are included ("हैलो सर, लाइन पर हैं आप?…" / "ألو سيدي، هل ما زلت على الخط؟…").
* All timings are environment-configurable and clamped to a sane range (2 s – 120 s).

### 2.2 Correct lifecycle rules (both call types)

* **Never fires while the AI is speaking** — the countdown starts only after the
  agent's turn finished playing.
  * Browser: armed via the existing `playback_complete` acknowledgment
    (`pendingSilenceArmTurnId`), so the timer truly starts when the browser
    finished audible playback of that exact turn.
  * Twilio: armed on `turnComplete`, with the delay **adjusted for the age of the
    last agent audio packet** (`phoneLastAgentAudioAt`), since no playback ack
    exists on the phone media stream.
* **Customer speech resets everything** — a valid customer turn (speech, or a
  barge-in/`interrupted` event on the phone) cancels any pending check-in and
  resets the stage counter to 0.
* **Acknowledgment then exact resume** — after a check-in, if the customer
  confirms ("Yes", "Yes, sollunga", "kekkudhu"), the agent answers with exactly
  one short line:
  * after the **first** check-in: **"Sure sir."**
  * after the **second** check-in: **"Okay sir, thank you."**
  * (third check-in has no extra ack line),
  then **continues from the exact previous point of the conversation** — never
  restarting the conversation, never repeating already-answered questions, never
  changing the topic.
* **Customer wait requests hold everything** — while a wait request is active
  ("One minute", "Konjam wait pannunga", "Let me think", "Wait", Hindi
  "रुकिए/zara rukiye", Arabic "انتظر"), all further check-ins are suspended for a
  hold window (`SILENCE_WAIT_HOLD_MS`, default 60 s, max 5 min). When the wait
  expires the counter re-arms and the pending stage fires naturally. Any other
  finalized customer speech ends the wait hold immediately. A wait request that
  arrives mid-window also re-evaluates the timer.
* **Customer interrupts during a check-in** — the
  audio is flushed (`clear` event / player stop), the counter resets, and the
  agent listens. A barge-in while idle never mutes the next answer.

### 2.3 Hard safety rules — silence NEVER ends the call

The injected system directive instructs the model explicitly:

* The check-in is **ONLY a connection / hearing check**.
* **NEVER** assume the customer is busy, unavailable, uninterested, in a meeting,
  sleeping, or wants to end the call.
* **NEVER** say the line is disconnected, promise to call back, offer to end the
  call, suggest rescheduling, or produce any goodbye.
* On the Twilio side the check-in arming is hard-gated:
  `if (turnComplete && !phoneFarewellDetected) armPhoneSilenceFollowUp();`
  — silence check-ins never arm after a goodbye, and the check-in helpers never
  touch `terminateTwilioCallAfterFarewell` / `finalizeLiveCall`.
* Call termination remains **only** via the existing call-ending mechanisms,
  and the final farewell audio always finishes before disconnect.

---

## 3. Files modified

### New files (pure utility modules, no embedded-prompt surgery)

| File | Purpose |
|---|---|
| `src/utils/silenceFollowUp.ts` | Stage count, per-stage delays (env-configurable), per-language check-in phrases, per-language ack lines, and `buildSilenceFollowUpDirective()` which builds the invisible system directive. |
| `src/utils/customerWaitRequest.ts` | `customerAskedForWait()` — detects explicit customer wait requests in Tamil/Tanglish, English, Hindi (Devanagari + transliterations) and Arabic; deliberately does **not** false-positive on phrasings like "flat one minute-la venum". |

### Modified files

| File | Changes |
|---|---|
| `server.ts` | **Browser handler**: staged helpers `clearSilenceFollowUp`, `resetSilenceStage`, `clearSilenceWaitHold`, `holdSilenceForWaitRequest`, `deliverSilenceFollowUp`, `armSilenceFollowUp` around the existing `silenceFollowUpTimer` / `silenceFollowUpFired` / `pendingSilenceArmTurnId` names; output-active guard so a check-in never overlaps agent audio; hooks in `flushUserTranscript`, `prepareVoiceSwitch`, `inputTranscription`, `interrupted`, audio, `barge_in`, `text`, `user_speech_transcript` handlers; `clearSilenceWaitHold()` in `finalizeLiveCall`, `closeCallForUnwantedSpeech`, `armObjectionEnd` and websocket close. **Twilio handler**: self-contained mirror (`phoneSilenceTimer`, `phoneSilenceFired`, `phoneSilenceStage`, `phoneSilencePausedUntil`, `phoneSilenceWaitHoldTimer`, `phoneLastAgentAudioAt`, `clearPhoneSilenceFollowUp`, `resetPhoneSilenceStage`, `clearPhoneSilenceWaitHold`, `holdPhoneSilenceForWaitRequest`, `deliverPhoneSilenceFollowUp`, `armPhoneSilenceFollowUp`), armed only on `turnComplete` when no farewell is active, audio-age-adjusted delay, cleaned up on the media-stream `stop` event and both websocket close handlers. |
| `tests/silence_playback.test.ts` | Suite rewritten/extended (32 tests) covering: per-stage phrases in all languages, env-configurable delays and clamping, directive content (ack lines, never-busy/never-end rules, wait acceptance), wait-request detection across languages (incl. the negative case), and the server wiring for both browser and Twilio flows. |
| `tests/task3_voice.test.ts` | Eval-harness fixtures updated with the new outer-scope values (`phoneLastAgentAudioAt`, `resetPhoneSilenceStage`), plus the pre-existing barge-in harness missing `resetSilenceStage`. No behavioural test changes. |
| `tests/sales_conversation.test.ts` | Eval-harness fixture extended with the new Twilio scope values (`customerAskedForWait` real detector, wait-hold no-ops, `phoneSilencePausedUntil`), plus the pre-existing missing `phoneFarewellDetected`/`phoneCloseTimer`. No behavioural test changes. |

### Not modified (confirmed intact)

14-stage sales flow, personas & system prompts (Priya/Harish untouched — the
check-in is injected as an invisible turn, not a prompt change), CRM write
logic, scoring, voice/persona configuration, Twilio numbers/credentials/streams
configuration, UI/CSS (`src/App.tsx` sends the pre-existing `playback_complete`
ack unchanged), DNC handling, objection flow, the existing call-ending
implementation, and all other test files.

---

## 4. How it works

* **Browser call**: after each agent turn the browser replies with the existing
  `playback_complete` ack (`pendingPlaybackAckRef` in `src/App.tsx`, untouched).
  The server matches the acked turn id (`pendingSilenceArmTurnId`) and only then
  starts the stage-1 timer. When a stage fires, the server sends the invisible
  directive built by `buildSilenceFollowUpDirective()` as a user turn — the
  Gemini Live session speaks the check-in in the **same voice, same persona,
  same session**, so the conversation context is fully preserved. Stage
  advances 1 → 2 → 3 and stops (repeats nothing); any customer utterance resets
  to stage 1 for the next silence window. A `browserOutputActive` guard keeps
  the countdown honest if audio is still queued.
* **Twilio call**: the same state machine runs inside the media-stream handler.
  Arming happens only on `turnComplete` when `phoneFarewellDetected` is false.
  Customer input transcriptions (`inputTranscription`, finished or final) reset
  the stage and cancel pending timers; `interrupted` triggers the `clear` event
  and a reset; wait requests pause the countdown for the hold window; speech
  during a hold resumes normal behaviour via timer or next finalized speech.
* **Never-busy guarantee**: no code path from silence ever reaches
  `terminateTwilioCallAfterFarewell` or `finalizeLiveCall`; the directive
  additionally constrains the model's wording.

---

## 5. Test results

```
tests: node ./node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
  385 tests
  385 pass
  0 fail / 0 cancelled / 0 skipped
```

* Baseline before this change: 372 tests, 371 pass, **1 pre-existing failure**
  (`sales_conversation.test.ts` eval `ReferenceError: phoneFarewellDetected is not defined`).
* That pre-existing failure was fixed by completing the eval-harness scope
  (fixture-only, alongside the new silence scope values).
* 13 new tests added beyond baseline (silence_playback suite now 32 tests).
* `npm run lint` (`tsc --noEmit`): **passes with no errors**.

---

## 6. Configuration reference

| Env var | Default | Meaning |
|---|---|---|
| `SILENCE_STAGE1_MS` | 6000 | Delay before stage-1 check-in ("line-la irukeengala?") |
| `SILENCE_STAGE2_MS` | 8000 | Delay before stage-2 check-in ("en voice kekkutha?") |
| `SILENCE_STAGE3_MS` | 10000 | Delay before stage-3 check-in ("disturb panrenaa?") |
| `SILENCE_WAIT_HOLD_MS` | 60000 | How long an explicit customer wait request suspends check-ins (max 300000) |
