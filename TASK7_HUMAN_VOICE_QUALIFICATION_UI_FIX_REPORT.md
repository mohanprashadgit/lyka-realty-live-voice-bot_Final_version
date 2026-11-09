# Task 7 human voice, qualification and UI fix

## Result and scope

Targeted changes are implemented in the existing Node browser/Twilio voice runtime, shared sales selector, CRM envelope and React panels. Native Gemini audio, existing barge-in, scoring, DNC, database schema and routes remain in use. This report distinguishes code verification from audible acceptance.

## Root causes found

1. The selector placed family/lifestyle and profession before core budget/timeline, regardless of engagement. Neutral customers received an unnecessarily long qualification path.
2. The conservative local permission parser missed ?Hello, sollunga?; the busy parser missed ?Ippo busy?. A volunteered purpose could overwrite a stop disposition. Placeholder-name validation excluded Customer but missed Prospect and Lead.
3. Connection instructions supplied only a current action alongside conflicting older flow prose. The runtime policy now supplies the priority plan and engagement conditions, and existing tool replies continue to return deterministic next_action. This is guidance through Gemini tools, not a hard pre-generation audio gate.
4. Offer completion depended solely on model-supplied status. Output attempts had no distinct transport evidence. Completed/interrupted transcript processing now records attempt evidence without asserting playback or acknowledgement.
5. The UI rendered every optional field in expanded cards, producing dozens of missing-value rows. The laptop layout switched to twelve columns too early, compressing transcript and profile content.
6. The active-call deletion regression had two problems: started_at was omitted from the SELECT, and the subsequent JavaScript age comparison was unreliable with database timestamp interpretation. The final fix calculates active_now using CURRENT_TIMESTAMP in MySQL.

## Orchestration and CRM changes

The shared nextSalesAction selector now prioritizes permission, actual name, purpose, budget and timeline. It skips saved and declined values. Remaining offers are introduced in short segments. Interested/family/budget-focused customers proceed to relevant deeper discovery; neutral customers progress toward the verified-options follow-up path after core qualification and offers. Trust objections pause the sequence; busy/refusal/end dispositions stop it. Income remains optional and children are captured only when volunteered.

The same observeSalesTurn fallback handles browser and Twilio input. It accepts friendly Tanglish permission and busy signals, captures ?Naan Salem, family-la four members, rendu pasanga, budget 3 crore, 3 BHK venum?, and preserves stop precedence. Explicit lakh/crore amounts without currency use the project's INR convention; ambiguous other amounts still need currency clarification. Gemini remains the semantic extractor for unrestricted Tamil/Tanglish, corrections and short contextual answers.

New flight_offer_delivery, golden_visa_offer_delivery and purchase_support_offer_delivery fields use the existing notes envelope. Output transcription establishes attempted/interrupted only. A completed attempt is not automatically re-pitched; an interrupted attempt remains eligible for resumption. Existing presented/understood values remain model-reported introduction/customer-acknowledgement statuses. No playback acknowledgement was invented. Browser completed-turn evidence is saved asynchronously through upsertLead; Twilio uses persistPhoneCall.

## Natural Tanglish and emotional delivery

The active runtime policy supplies conversational examples and explicitly discourages repetitive sir, scripted acknowledgements, stage directions and repeated greetings. It calls for gentle curiosity, concise factual reassurance and warmer detail for explicit interest. Existing naturalVoice expression guidance remains active. Engagement affects actual selector depth rather than only voice wording. It is based on conversational evidence, not a claim about the customer's psychological state.

Before (illustrative): neutral buyer is asked property type, profession and family details before budget/timeline.
After (illustrative): ?Approximate-ah evlo budget range-la paakreenga?? If budget/timeline are known, skip them and continue to the next suitable action.

Before (illustrative): ?Hello, sollunga? leaves permission unrecognized locally.
After (tested state transition): permission becomes engaged and the next missing field is the actual name.

Trust example (intended style, not a recorded live utterance): ?Puriyudhu... documents verify pannittu dhaan decide pannanum. DLD project details and applicable escrow arrangements check panna team guidance kuduppanga. Developer pathi doubt-ah, illa investment risk pathiya?? No guaranteed safety, returns or government endorsement is implied.

## Audio diagnosis and preservation

The preceding final-fix implementation removed repeated full sendClientContent context injection from ASR callbacks and the mandatory wait-for-CRM instruction. Live tools are NON_BLOCKING with SILENT responses; background saves should not trigger another spoken turn. Cancellation IDs persist across browser callback messages, obsolete session callbacks are ignored, and player epochs prevent old onended callbacks from changing a new queue after interruption. These fixes are retained.

This increment does not inject new audio triggers or introduce TTS. Offer evidence is processed at completed/interrupted output boundaries. Existing 16 kHz browser input, 24 kHz native output, telephone mu-law conversion and Twilio clear are retained. Existing diagnostics expose turn duration, interruption, queue depth, queued milliseconds, clears and underruns. Code inspection establishes avoidable race/latency risks, but no recording was listened to that proves these were the sole cause of the reported stuttering.

## UI changes and skill use

The installed landing-page-design skill was read in the prior implementation and applied again here without rereading it unnecessarily. Its named typography, approved Manrope face for the customer panel, spacing scale, flat cards, complete borders, responsive sizing and focus visibility are retained. The user's CRM scope takes precedence over marketing-page hero/tagline requirements.

Before: all profile/family/payment/sales fields were visible, including many missing-value labels.
After: compact core summary, next relevant field/stage and agreed next step are visible first. Optional sections use native keyboard-accessible details/summary. Investment-only customers do not see an empty family section. Offer attempts and acknowledgements have distinct labels. Enum values such as within_3_months and own_use have readable labels; numeric currency uses locale grouping. The lead-detail dialog remains native and keyboard accessible.

Live screen: twelve-column arrangement begins at the wider xl breakpoint; child columns may shrink, and transcript text wraps long words. Leads & Calls: fixed table geometry with a horizontal scrolling container and bounded action buttons. These are implemented CSS changes; actual desktop/mobile screenshots and interaction acceptance remain unverified.

## Real data trace

Input used in the database test: ?My name is TEST Human Voice. Naan Salem, family-la four members, rendu pasanga, budget 3 crore, 3 BHK venum.?

Observed chain: observeSalesTurn -> upsertLead -> MySQL -> refreshed /api/leads -> CustomerIntelligence server rendering.
Verified fields: hometown Salem; family size 4; children 2; budget 30000000 INR; bedrooms 3. Refreshed API and rendered panel contain the expected family fields and 3 BHK label. Test lead retained: 8f75e370-bb02-4ef1-a360-0d8d98b18c3a, labelled test-only/do not dial. Earlier integration test lead retained: 57c97733-bf53-4fbb-b258-5cba1debf608.

## Files changed in this increment

- server.ts
- callRecords.ts
- src/utils/salesConversation.ts
- src/utils/salesIntelligence.ts
- src/utils/customerIntelligence.ts
- src/components/CustomerIntelligence.tsx
- src/components/LiveCallWorkspace.tsx
- src/components/LeadsAndCallsTab.tsx
- src/App.tsx
- src/index.css
- tests/sales_conversation.test.ts
- tests/task7_final.test.ts
- tests/lead-sync.integration.ts
- TASK7_HUMAN_VOICE_QUALIFICATION_UI_FIX_REPORT.md

The preceding implementation also introduced the customer panel, API intelligence mapping, dashboard selector, audio epoch guard and scoped Manrope font loading. Those remain in place.

## Validation results

- Automated suite: 149 passed, 0 failed, including actual browser/Twilio handler fragments, state transitions, offer evidence, rendered markup and audio callback tests.
- TypeScript: npm run lint passed.
- Production build: npm run build passed. Existing Vite warning remains about NODE_ENV=production in .env.
- Lead integration: passed actual MySQL writes, concurrent updates, production API mapping, restart recovery and the new family-data-to-rendered-panel trace.
- Call-record integration: initial rerun reproduced expected 409 versus actual 200. Final SQL clock calculation passed the full integration including active-call protection, rollback, soft deletion and fresh-process recovery.
- Gemini provider smoke: configured model and voice returned native PCM successfully. This tests connectivity/output only, not the full runtime or listening quality.
- Browser transport: automated handler/player coverage passed; no new listened browser call performed in this increment.
- Twilio: automated conversion/clear/state coverage passed; no actual telephone call placed or listened to.
- Visual UI: server-rendered content tested; desktop/mobile screenshots, overflow measurements and focus interaction were not performed. Prior Computer Use ended because its Windows URL policy could not establish the browser URL. No bypass was attempted.

## Remaining acceptance work

Listen to consented browser and telephone calls for warm greeting, friendly curiosity, reassurance, positive interest and closing in Tamil/Tanglish/English. Exercise interruption during each offer, multiple tool calls, reconnect and long conversations. Check 390px mobile and common laptop widths visually. Automated tests do not establish audible warmth, pacing, stutter-free delivery, provider adherence to every selected action or actual customer hearing of an offer.

Gemini still owns native turn generation; tool use and semantic extraction are model-dependent. The selector is not a forced speech gate. Broad multilingual extraction and explicit acknowledgement depend on the provider. No verified inventory retrieval was added: matching requirements and arranging consented specialist follow-up remain the supported fallback. The server also reports a pre-existing lead-score recalculation notice for missing l.location at startup; this unrelated schema/query issue remains outside these changes.
