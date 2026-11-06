# Task 3 — natural voice implementation and verification

Implemented on 6 November 2026. Task 3 code and automated checks are complete; audible-expression acceptance and real-call testing remain pending. No Task 4 work was started.

1. **Reference analysis and techniques adopted**

Reference: `C:/Users/Sathish Kumar PA/Downloads/cold-caller-agent-extracted/cold-caller-agent-main`.
Inspected `ESSENCE.md`, `server/agent/content/persona.ts`, `fewshots.ts`, `openers.ts`, `server/core/phoneVoice.ts`, and relevant acknowledgement, phone voice and interruption test coverage.

Adopted context-first reactions, brief responses, one idea at a time, restrained humour, recent-phrase avoidance, colloquial Tamil grammar with English property terms, and slowing down for concerns and numbers. The reference distinguishes its text-to-speech stage annotations from its native-audio instructions; Lyka uses the latter approach.

Did not copy the reference's offers, return figures, enquiry assumptions, business workflow, separate acknowledgement audio, TTS providers, background ambience, timing delays, speech-rate transforms or phone filters. `phoneVoice.ts` controls audio level/filtering; it does not create laughter. Its tests are not evidence that Lyka generates expressions.

2. **All 15 requested categories**

The structured library in `src/utils/naturalVoice.ts` includes happiness/excitement; laughter/chuckling; thinking/hesitation; surprise/curiosity; empathy/sympathy; reassurance/confidence; waiting/resuming; friendly humour; professional explanation; apology/acknowledgement; confusion/clarification; gentle persuasion; concern/seriousness; transitions; and polite closing/farewell.

Each category supplies context and alternative Tanglish/spoken-Tamil-in-Latin-script and English lines. Existing honorific and language rules still apply. Mood guidance covers happy, funny, angry, sad, confused, interested, hesitant and busy customers. Seriousness overrides humour, including nervous laughter about financial loss. Selection and four-turn phrase avoidance are instructions evaluated by Gemini in the current session, not a deterministic emotion classifier or enforced counter. No customer-memory service was added.

3. **Exact files changed or added**

| File | Change |
|---|---|
| `server.ts` | Import and append the Task 3 policy to the shared agent prompt; reject audio in interrupted packets on both transports; suppress remaining browser audio after manual interruption until cancellation/turn completion, without muting an idle caller's next response. |
| `src/utils/naturalVoice.ts` | New structured expression library and native-audio delivery policy. |
| `instructions/SYSTEM_INSTRUCTIONS.md` | Append Task 3 only. |
| `instructions/PERSONAS.md` | Append Task 3 only. |
| `instructions/LANGUAGE_GUIDELINES.md` | Append Task 3 only. |
| `tests/voice_prompt.test.ts` | Supply the new prompt dependency to the existing isolated prompt test. |
| `tests/task3_voice.test.ts` | New preservation, policy-contract, actual audio-forwarding block, codec and mocked playback cancellation tests. |
| `tests/task3-instruction-baseline.json` | Original instruction byte lengths and SHA-256 hashes. |
| `tests/task3-audio-smoke.mjs` | Generate synthetic expression review recordings through the existing Gemini provider. |
| `TASK3_VOICE_REPORT.md` | This report. |

Generated verification artifacts: `scratch/task3-baseline/` (original files), `scratch/append-task3.mjs` (append helper), `scratch/task3-audio/results.json`, 12 native 24 kHz WAVs and six 8 kHz phone-codec WAVs. Production build regenerated `dist/`. No credentials were printed or copied into the recordings/report.

4. **Instructions appended and preservation evidence**

Each protected document now ends with `ADVANCED NATURAL VOICE EXPRESSIONS – TASK 3`. The same policy is appended to the runtime voice prompt used by browser agent mode and Twilio. It adds contextual selection, mood delivery, phrase variation, optional laughter limits, financial/anger/sadness exclusions, genuine-tool-only holding, interruption recovery, and plain-speech fallback instead of stage tags.

All three documents retain their original bytes, confirmed by SHA-256 prefix tests. The original runtime prompt and opening builder also compare equal after removing the one new appended interpolation and normalizing line endings. No existing rule was deleted or replaced. Task 1 qualification, Task 2 openings, refusal tracking, immediate DNC, CRM tools, database persistence, UI, capture/playback implementation and conversion functions remain in place. Gemini models, voices, configuration and Twilio integration were not replaced. No RAG, customer memory, competitor intelligence, dependencies or paid provider were added.

5. **Audio pipeline findings**

Browser: microphone PCM at 16 kHz → existing WebSocket → Gemini Live → native PCM at 24 kHz → existing WebSocket → `LiveAudioPlayer`. Twilio: 8 kHz mu-law input → existing PCM conversion → Gemini Live → native 24 kHz PCM → existing 8 kHz mu-law conversion → Twilio media messages. Gemini interruption messages trigger browser queue clearing or Twilio `clear`.

Expression context travels only in the system instruction. There is no expression metadata event, tag parser, SSML renderer or separate TTS step in these paths. Provider output transcription is preserved verbatim; it is not rewritten to hide tags or replaced with intended dialogue. Transcripts are provider transcripts, not guaranteed recordings of what was heard after an interruption.

The policy avoids supplying bracket annotations as spoken examples and explicitly prohibits reading stage directions. It asks for native delivery, with plain appropriate speech if an effect cannot be produced. This minimizes annotation risk but cannot guarantee model compliance or retroactively remove words already present in streamed PCM. Filtering the transcript would not fix spoken audio. No claim of absolute annotation suppression is made.

Google documents native emotional delivery, but capability documentation alone is not audible verification of this installation. Model-dependent configuration should not be copied blindly. Existing configuration was preserved. Sources: [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [Gemini 3.8 Live developer guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-live).

6. **Tests and build results**

| Check | Result and scope |
|---|---|
| `node --import tsx --test tests/task3_voice.test.ts tests/voice_prompt.test.ts tests/task2_opening.test.ts tests/scoring_and_flow.test.ts tests/records.test.ts` | 58 passed, 0 failed. Includes 17 new Task 3 checks. |
| `npm.cmd run lint` | Passed: TypeScript `tsc --noEmit`. |
| `npm.cmd run build` | Passed. Existing Vite warning about `NODE_ENV=production` in `.env`; `.env` unchanged. |
| `node tests/voice-smoke.mjs` | Passed: configured model returned audio. |
| `node tests/task3-audio-smoke.mjs` | 12/12 completed audio responses: six synthetic customer cases each with Sulafat and Kore. Saved native WAVs and actual production-codec conversions for Kore. |

Initial plain-Node test execution could not resolve the project's existing TypeScript import conventions; the required tsx test run passed. The sandbox blocked tsx user lookup and the new harness's network access; approved retries succeeded. These were environment failures, not silently counted as passing tests.

| Requested scenario | Evidence obtained |
|---|---|
| Natural laughter / customer jokes | Policy checks and generated joke recordings for both voices; actual laughter not listened to or verified. |
| Sad customer | Both transcripts responded empathetically and ended without a pitch; emotional sound unverified. |
| Angry customer | Both recordings generated; one transcript requested callback timing, a known acceptance issue below. |
| Thinking / hesitation | Generated in both voices; one transcript includes Hmm; natural cadence unverified. |
| Tanglish pronunciation | Latin Tanglish transcripts and recordings exist; pronunciation requires a fluent listener. |
| Repetition prevention | Policy-contract check only; no multi-turn audible repetition acceptance test performed. |
| Interruption during speech | Executed audio-forwarding blocks reject interrupted audio; mocked browser sources all stop; Twilio clear event verified. Real acoustic/network latency untested. |
| Browser voice output | Direct Gemini audio using browser voice settings and tested forwarding; no speaker/microphone end-to-end test. |
| Twilio voice output | Direct Gemini audio using Kore and production mu-law conversion; no actual outbound call. |
| Serious financial discussion | Both generated transcripts rejected guaranteed returns; absence of audible laughter unverified. |
| Contextual selection | Policy checks and generated response samples; model compliance is imperfect. |

7. **What actually works in generated audio**

Verified: nonempty completed native audio generation for all 12 cases and successful phone-codec conversion. The recordings range from approximately 5.8 to 13.5 seconds. No recognized bracket stage tags appeared in the 12 provider transcripts. That does not establish that no annotation was spoken, nor that laughter, chuckling, sighing, pauses, emotional tone or pronunciation was correct. **No individual audible expression has been certified by listening.** Review recordings in `scratch/task3-audio/`; exact transcripts and status are in `results.json`.

8. **Preserved conflicts and observed limitations — approval needed before rewriting existing rules**

- Older document examples require a laugh on AI disclosure, while Task 2 says not to force one.
- Older prompts contain Indian/non-Dubai property examples despite the Dubai-only opening policy.
- Older language locks and the Task 2 automatic-language-switch wording disagree about English-mode precedence.
- Older delivery instructions mandate breaths or punctuation beats, while newer rules reject artificial pauses.
- Older busy/callback examples encourage asking for callback timing; newer policy permits this only when invited. The generated Sulafat angry-customer response asked when to call again. This is a real observed behavioural issue, not a passing scenario.
- The thinking samples re-asked own-use versus investment when the customer had said they were undecided. The joke samples added qualification questions. The financial browser sample mentioned sharing project documents without tool evidence. Some responses exceeded the older approximate eight-second target. No external action was actually taken in these synthetic tests.

These conflicts and failures were reported without deleting or rewriting protected instructions. The additive library improves guidance but does not eliminate contradictory legacy prompt influence. Approval to reconcile existing instructions would be a separate change.

9. **Real-call acceptance still required**

A fluent Tamil/Tanglish listener should review the recordings and then test real browser and Twilio calls: natural versus forced laughter, no laughter during sadness/anger/financial discussion, soft delivery without theatrical sighs, pronunciation of Dubai terms and amounts, multi-turn filler repetition, interruption during queued speech, resuming without stale sentences, microphone echo, actual retrieval holds, sustained silence, busy/refusal/DNC handling and different selected voices. Compare native recordings to the 8 kHz conversions. A direct API recording or mocked queue test cannot establish the live phone experience.

No real customer was called and no Task 4 feature was implemented.
