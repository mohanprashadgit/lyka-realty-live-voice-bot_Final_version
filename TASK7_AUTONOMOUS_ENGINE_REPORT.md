# Task 7 runtime orchestration report

## Root cause and architecture

The Node runtime is server.ts. Browser /api/live-ws forwards 16 kHz PCM to Gemini Live and plays native output through the existing player. Twilio /api/twilio/media converts inbound mu-law to PCM and outbound 24 kHz PCM to 8 kHz mu-law. Both use getSystemInstruction, getAgentPersona, buildVoiceOpening and update_lead_info. Browser state is callFacts; telephone state is activeTwilioCalls[callSid].slots. Browser journaling and telephone persistPhoneCall feed existing records/lead services. leadService.upsertLead merges and stores CRM facts; Task 7 extensions live in the existing notes envelope and interaction metadata. Existing scoring and rejection trackers remain authoritative for outcomes and DNC.

Evidence before modification:
- Task 7 family, financial and three-offer policies WERE in getSystemInstruction and passed to both live connections. Missing prompt inclusion was not the main cause.
- The older Step 4 prescribed property type/location/budget before name, conflicting with Task 7 ordering.
- SPEED & EXTRACTION instructed speaking before the parallel tool update.
- Tool replies returned storage success only. Neither transport computed a next sales action from state.
- Input transcripts fed objection handling and records, but not a qualification decision function.
- Connection prompts received the name and offer summary, not all collected qualification facts. Browser recovery retained callFacts in memory but did not expose that full state in the replacement prompt.
- Markdown instruction files are not loaded by the live server. Editing them alone cannot fix this path.
- backend/main.py is a separate incomplete Python telephone scaffold: it decodes audio but does not connect Gemini. It is not the Node application's functioning Twilio implementation.

## Files changed

- server.ts: both live setup prompts, both tool replies, both transcript paths, browser text/transcript input, CRM hydration and extraction ordering.
- src/utils/salesConversation.ts: shared deterministic decision function, new-call hydration, conservative transcript fallback, runtime context builder.
- src/utils/salesIntelligence.ts: disposition and declined-field schema using existing persistence.
- tests/sales_conversation.test.ts: workflow and actual-handler execution tests.
- TASK7_AUTONOMOUS_ENGINE_REPORT.md: this report.

## Implemented

One shared selector reads existing facts and returns a single stage/field/instruction. Sequence: permission, missing name, purpose, each remaining offer, relevant family/lifestyle needs, property/financial requirements, location/timeline, verified-data fallback, follow-up consent, agreed action, closing. Investment-only conversations skip household discovery. Income is optional and never a required stage. Known and declined fields are skipped. Budget and original_location database columns are restored to runtime aliases. New calls do not inherit prior-call permission.

Gemini receives the runtime policy and known facts at connection/recovery. Final user transcripts update existing call state and supply a context-only sendClientContent message with turnComplete=false, avoiding an extra forced speech turn. The existing update_lead_info tool now returns next_action together with actual CRM save status. Gemini is instructed to call it before every post-opening sales response, including turns with no new facts. The existing multilingual semantic extractor remains Gemini's function calling; a conservative local fallback handles explicit English statements, simple permission, name/budget, purpose, installments and refusals. No additional paid API or TTS was introduced.

Customer questions and objections take precedence in the speech instructions; the pending stage is retained. Busy, angry, end and uninterested dispositions stop qualification. Native audio, browser queue clearing, Twilio clear, existing DNC handling, UI, database schema and lead scoring were retained.

## Validation

- node --import tsx --test tests/*.test.ts: 134 passed, 0 failed. Includes 20 requested scenario categories, additional state/CRM hydration cases, execution of actual browser/Twilio transcript blocks and browser tool reply, and existing audio/barge-in regressions.
- npm.cmd run lint: passed (tsc --noEmit).
- npm.cmd run build: passed. Existing Vite warning: NODE_ENV=production in .env is not supported for that configuration mechanism.
- node --import tsx tests/lead-sync.integration.ts: passed actual database writes, concurrent updates, field preservation, HTTP routes, call association and fresh-process recovery. Retained labelled test lead 57c97733-bf53-4fbb-b258-5cba1debf608.
- node --import tsx tests/call-records.integration.ts: FAILED at line 85: active call deletion protection expected 409, received 200. callRecords.ts was not modified. No baseline rerun proves whether this is environment-dependent or pre-existing; it remains unresolved. The test performed its earlier labelled-record operations before failing.
- Initial sandbox test invocation failed in tsx/os.userInfo (uv_os_get_passwd ENOMEM); rerun with approved execution permissions passed.

## Partial implementation and real-call limits

Deterministic state selection and runtime wiring are implemented and tested. This is NOT a hard audio-generation gate: native Gemini can begin generating before its input transcription is delivered, and tool invocation and semantic extraction still depend on Gemini. Context refresh and tool results actively guide the session, but tests do not prove that every audible response obeys them. A strictly enforced pre-generation gate would require changing turn ownership/audio scheduling; that was not introduced here to avoid silently altering native VAD and barge-in.

Offer completion still relies on Gemini recording presented/understood only after a completed explanation (next customer turn). Interrupted status is not persisted as completed, but there is no transport playback acknowledgement proving the caller heard each offer. Tests prove state transitions, not semantic answer quality or delivered audio. Objection answers remain model-generated under the existing policy.

No verified property inventory tool is exposed to these live sessions. The controller explicitly takes the permitted requirements-and-team-follow-up path; actual listing matching is not implemented. No new Twilio reconnection mechanism was added. Browser recovery reuses callFacts and now includes runtime context.

No live Gemini audio session or real Twilio call was placed during this work; credentials were not used to assert audible verification. Real-call verification is required for natural Tanglish/English, latency, tool adherence, interrupted-offer resumption, topic detours and full end-to-end customer experience. Database persistence verification is separate and did run successfully.

## Real-call acceptance checklist

Run a browser call and a consented test telephone call: permission -> name -> purpose -> three short offers -> relevant family needs -> budget/payment -> team follow-up consent. Interrupt the second offer; confirm only the remaining explanation resumes. Volunteer name/budget together and decline income; confirm no repeated questions. Say busy/end in English and Tanglish; confirm qualification stops. Reconnect the browser session midway; confirm no repeated greeting or known questions. Check saved facts and consent against the transcript. Listen to the recordings before treating naturalness and proactive delivery as verified.
