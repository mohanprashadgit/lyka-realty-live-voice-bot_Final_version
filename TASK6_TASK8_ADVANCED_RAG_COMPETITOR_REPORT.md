# Task 6 + Task 8 ? implementation and verification report

Date: 2026-11-06. Existing Node/TypeScript, React, MySQL, Gemini Live Native Audio and Twilio architecture retained. No new paid service, embedding API, vector database or schema migration.

## Architecture and root causes established

`server.ts` builds the live system instructions; Markdown files alone do not drive speech. Browser `/api/live-ws` uses `callFacts`; Twilio `/api/twilio/media` uses `activeTwilioCalls[callSid].slots`. Both already used Task 7 `observeSalesTurn`, `nextSalesAction`, `mergeSalesLead` and `update_lead_info`. `naturalVoice.ts` already supplied expression guidance and `customerObjection.ts` governed refusal/DNC.

Before this increment, CRM startup loaded facts without an explicit identity-release boundary or recent-call-summary retrieval. The older `getRagGroundingContext` returns an empty string. `knowledgeData.ts` fed `/api/knowledge`, not a Gemini evidence tool. Its listing prices and permit-like references lacked an auditable comparable-transaction dataset. `requirementExtractor.ts` provides legacy property/land normalization, including INR conventions; it was not suitable as a source of verified Dubai prices and was not repurposed into one.

Existing call journals, `conversations`, `voice_call_details`, lead notes and interaction metadata provide the storage. `/api/leads` already serializes the notes intelligence for `CustomerIntelligence`. No duplicate sales controller was created.

## Implemented runtime changes

### Customer memory

`customerMemory.ts` resolves an unambiguous session/normalized-phone candidate; it never merges on name. Conflicting session phones and shared-phone ambiguity are rejected. It loads an allowlisted CRM snapshot and up to three dated completed-call summaries, omitting deleted calls and limiting summary length.

Both voice paths initially expose only candidate name/contact and DNC state, not private previous requirements. Current-call permission precedes identity confirmation. `confirm_customer_memory` releases the candidate only after the model records explicit identity and permission confirmation. Fresh current-call facts take precedence; confirmation is idempotent. A wrong-person response closes qualification and requires operator contact resolution. Pending/rejected identity cannot overwrite the old CRM lead. Explicit DNC can still be saved without other customer details. Telephone call journals continue independently while CRM identity is pending.

Known budget, household information, objections, previous declines, agreed next action and introduced/acknowledged offers survive calls. Attempted audio delivery resets on a new call; it never proves understanding. Old conversation permission is removed. Browser provider recovery retains the in-call facts. New Twilio stream state can reload persisted CRM memory and requires identity/permission again.

`leadService.ts` retains the existing notes envelope and interaction history, adds per-field recorded time/source/confidence, and rejects ambiguous phone merges. Provenance identifies CRM extraction/operator input as reported, not independently verified. Confirmed corrections update the same lead. No savings or banking credential fields were added.

### Mini RAG and legal handling

`backend/services/liveKnowledge.ts` exposes `retrieve_dubai_knowledge` and `compare_competitor_quote`; both are registered in the actual Gemini configurations for browser and Twilio. Retrieval is local, lexical, compact and dated. The model translates Tamil/Tanglish intent into canonical query terms. It returns up to four relevant records, source/publisher, scope, limitations and freshness. Expired evidence cannot supply a current exact rule.

There are 33 approved records spanning legal/process basics, investment concepts, payment verification, company services, all twelve requested Dubai communities and four Tamil Nadu places. These are a curated starting knowledge base, not an exhaustive legal encyclopedia. See `backend/knowledge/APPROVED_KNOWLEDGE.md` and its source register. For example, ownership/title checks use DLD sources; residency retains separate DLD/GDRFA/ICP guidance; mortgage context uses CBUAE. Complex disputes and succession remain qualified-professional referrals.

Tool outputs are returned in the existing native tool lifecycle with the next sales action. No transcript-driven `sendClientContent` context injection or extra speech generator was added. CRM saves retain non-blocking silent replies; knowledge checks are blocking before consequential claims. The legacy HTTP knowledge response now also exposes the approved retriever and removes its unsupported blanket verification claim.

### Competitor intelligence

Task 7 now pauses for competitor discovery: company, project/community, quotation and size/basis, one missing question at a time. It can skip declined fields and resume the unfinished sales plan when the comparison is dropped. The model can obtain further readiness/payment/charge details as needed. Quoted prices, property sizes and source status persist separately from customer affordability. Transcript fallback no longer overwrites the customer's BHK/budget/payment preference with competing-unit details.

The comparator uses only the server's approved transaction file. It checks location/type/size/bedrooms/project/readiness/currency/basis/date; converts sqm explicitly; requires three distinct comparable registered sales; returns median/range, sample and dates. Tests use synthetic rows marked TEST. **The production transaction file is empty. No current market rate, actual market comparison or live inventory claim is implemented without an approved feed.** The supported live result is fair discovery and evidence-request/specialist follow-up.

### Rapport, emotion and qualification

Existing Tanglish/native expression guidance remains active. New runtime guidance permits one brief retrieved hometown acknowledgement for receptive customers, forbids fabricated personal stories or religion assumptions, and allows restrained customer-led humour only outside serious concerns. Business-sector discovery follows a voluntarily stated business background; hometown is optional deeper discovery for highly interested customers. Trust/legal concerns receive calm evidence-first delivery. Refusal/DNC overrides all discovery and offers.

No playback-speed manipulation, synthetic laughter tags, forced pauses or new TTS engine was introduced. Twilio now guards duplicate connection starts, cancelled tool responses and late output after socket closure; native VAD, PCM conversions and clear events remain intact. Incoming stream state is initialized when absent rather than assuming every call originated through the dashboard.

### Dashboard

Existing compact summary and expandable details now include previous-call memory, competitor quotation/comparison, legal/trust concerns and clickable knowledge sources with review dates. Comparison JSON is formatted into readable status/figures; missing data remains explicit. The installed `landing-page-design` skill was read earlier in this implementation sequence and applied to the operational CRM hierarchy, existing typography, spacing and disclosure components. No marketing-page conversion or unrelated route redesign.

## Validation actually performed

- Unit/regression suite: **191 passed, 0 failed** at final validation. Includes retrieval/freshness/unknown queries, separate visa records, retrieval failure, unit/currency/type/date/sample rejection, memory identity and correction, competitor stage transitions, notes/UI rendering, actual browser and Twilio knowledge-handler execution, audio interruption and existing Task 1/2/3/7 checks.
- `npm run lint` (`tsc --noEmit`): passed.
- `npm run build`: passed. Existing Vite warning about `NODE_ENV=production` in `.env` remains.
- `tests/lead-sync.integration.ts`: passed real MySQL writes, concurrent updates, restart recovery, production HTTP serialization and React server rendering. New memory trace: completed call -> same-phone candidate -> withheld update -> explicit release -> corrected budget -> same CRM ID -> API -> memory/quote/evidence rendered in panel. Clearly labelled test records retained; no real customers dialed.
- `tests/call-records.integration.ts`: passed, including active-call deletion protection. The earlier expected-409/actual-200 issue was reproduced and fixed in Task 7 using database-time `active_now`; this regression remains passing.
- `tests/live-knowledge-smoke.mjs`: passed against the running `/api/live-ws` route and real configured Gemini. Synthetic text input triggered DLD retrieval, source-state update and native audio output after the tool reply. This is **not microphone, listening or audible-expression acceptance**.
- A targeted runner invocation encountered Windows sandbox `uv_os_get_passwd` ENOMEM; rerunning the full suite outside that sandbox passed. Two initial development failures (old competitor expectation and a provenance merge dropping core fields) were corrected before the passing suite.
- Real telephone call: **not placed**. Twilio handler/codec/clear tests passed; PSTN delivery, hearing, long-call pacing and network reconnect need real-call verification.
- Desktop/mobile visual screenshots and interactive layout/focus review: **not performed**. Component markup/data rendering passed. Earlier Computer Use was blocked by its Windows URL-policy check; it was not bypassed.

## Real data-to-dashboard trace

Synthetic spoken-content input from the existing integration test: ?My name is TEST Human Voice. Naan Salem, family-la four members, rendu pasanga, budget 3 crore, 3 BHK venum.? The actual fallback/state service saved Salem, family=4, children=2, INR 30,000,000 and bedrooms=3 into MySQL. A fresh production `/api/leads` response and real component server render showed those values. The new separate memory fixture stored an unverified AED 900,000 competitor quotation and DLD evidence, then changed own budget from AED 1,500,000 to AED 1,700,000 without changing the quotation or creating another lead.

## Illustrative conversations ? not recordings or claims of audible verification

A. Returning customer: Agent first asks permission and confirms Arun's identity. After confirmation/tool release: ?Last time family-ku 3 BHK pathi discuss pannom. Adhe requirement dhaana, illa change irukka?? Customer: ?Budget ippo AED 1.7 million.? The correction wins; household and declined profession are retained.

B. Madurai: Customer: ?Naan Madurai.? After retrieving regional context: ?Oh, Madurai-ya! Chithirai festival-ku famous ooru. Neenga enna work panreenga?? Only if receptive; no religion or festival timing assumption, no invented visit.

C. Business owner: Customer: ?Textile business panren.? Agent: ?Seri. Property-ku approximate-ah evlo budget range comfortable?? No income or wealth inference.

D. Cheaper competitor: Customer: ?Vera realtor 2 BHK-ku AED 900,000 solraanga.? Agent: ?Andha project endha community-la irukku?? With inadequate approved observations: ?Exact current rate guess panna virumbala. Quotation and size irundha team verify panni fair comparison share pannalaam.? This is the present production fallback.

E. Legal trust: Customer: ?Ownership namma per-la varuma?? After relevant DLD retrieval: ?Eligible freehold property-na ownership register panna mudiyum; exact area and property documents verify pannanum. Ready property-ah, off-plan-ah?? General information only; no universal ownership promise.

F. Golden Visa: Customer: ?Visa confirm-ah?? After applicable authority retrieval: ?Approval guarantee panna mudiyadhu. Property value, ownership and authority requirements check pannanum. Neenga endha property pathi kekkareenga?? Lyka offers assistance, not issuance.

G. Uninterested: Customer: ?Vendam, call pannadheenga.? Agent: ?Seri, contact panna vendam-nu note pannikkiren. Thank you.? DNC and closing; no offers or competitor follow-ups.

H. Family buyer: Customer: ?Family-la four members.? Agent: ?2 BHK comfortable-ah irukkuma, illa 3 BHK prefer panreengala?? Customer: ?3 BHK.? Agent: ?Schools, parks, community facilities-la edhu priority?? No family-size-based upsell or invented unit amenities.

## Modified files in this increment

- `server.ts`, `leadService.ts`, new `customerMemory.ts`
- `backend/services/liveKnowledge.ts` (new)
- `backend/knowledge/approvedDubai.json`, `transactions.json`, `APPROVED_KNOWLEDGE.md` (new)
- `src/utils/salesConversation.ts`, `salesIntelligence.ts`, `customerIntelligence.ts`
- `src/components/CustomerIntelligence.tsx`
- `tests/task6_task8.test.ts`, `tests/live-knowledge-smoke.mjs` (new)
- `tests/lead-sync.integration.ts`, `tests/sales_conversation.test.ts`, `tests/task7_sales.test.ts`
- This report. Earlier Task 7 changes and report remain in place.

## Completion boundaries

Implemented: shared live knowledge tools, compact source/freshness retrieval, gated memory hydration, correction/provenance persistence, competitor discovery/comparison algorithm, notes/API/dashboard integration, automated validation and local running server.

Partial / data-dependent: A?Z knowledge is broad introductory coverage, not exhaustive current case law, detailed school/medical directories or live inventory. Exact current prices need an approved DLD transaction import; detailed project features and payment terms need approved documents. Updates are curator-driven, not automated web revalidation. Prior summaries are stored notes/customer-statement summaries rather than a new semantic summarization model.

Requires real-call verification: Tamil/Tanglish/English pronunciation, warmth, chuckles, timing, long conversations, microphone interruptions, actual offer hearing, provider adherence to tool/identity rules, PSTN audio and Twilio reconnect. Confirmation is conversational, not biometric or strong identity authentication. The language model still owns speech generation and semantic extraction; automated tests do not guarantee every future response.

Known existing issue: normal schema startup can report the old lead-score recalculation query referencing missing `l.location`; the running development server uses the existing supported `--skip-schema-init` option. No unrelated database migration was made.
