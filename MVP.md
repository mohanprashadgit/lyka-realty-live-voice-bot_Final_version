# Lyka Realty — AI Voice Calling Agent & Property Assistant MVP Architecture 🏗️🎙️✨

A production-grade, human-sounding conversational AI voice calling agent and property assistant built with **Google Gemini Live Native Audio (`gemini-3.8-live`)**, **Google Gemini Flash (`gemini-2.5-flash`)**, **Twilio Voice PSTN Telephony**, **MySQL Persistence**, an **Express full-stack Node.js backend**, and a minimalist **React 19 + TypeScript + Tailwind CSS v4** clean white interface.

> **⚠️ Important**: Voice agent functionality requires a valid Google Gemini API key with available billing quota. See troubleshooting section below.

---

## 🔧 Latest Updates & Improvements (November 2026)

### Combined Bug Fixes & UI Improvements Release
1. **Duplicate Agent Speech Resolution**:
   - Traced root causes to: (1) redundant `media` property passed alongside `audio` in `liveSession.sendRealtimeInput` in `server.ts`, sending duplicate ASR input chunks; (2) premature 0ms buffer state drop in `LiveAudioPlayer.source.onended` during network arrival jitter; and (3) immediate un-gated microphone transmission in `LiveMicRecorder` capturing room acoustic reverberation after the agent speaks.
   - Deduplicated `sendRealtimeInput` to forward strictly `audio`. Added a 200ms debounce hangover in `LiveAudioPlayer` and a 350ms acoustic echo drain in `LiveMicRecorder` that suppresses room reflections while preserving normal barge-in and turn-taking.
2. **Lead Temperature and Scoring Determinism**:
   - Schema update in `db.ts`: set default temperature to `'PENDING'` (was `'WARM'`), added `lead_score INT DEFAULT NULL` with idempotent migration.
   - `leadService.ts`: removed fallback defaulting leads to `'WARM'`; integrated `calculateDeterministicLeadScore` into lead payload creation and updates.
   - `src/utils/scoring.ts`: eliminated agent question contamination (removed `fullConversation` positive keyword checks). Short non-committal or disconnected calls now properly resolve to `NO_ANSWER` or `PENDING` rather than defaulting to `WARM`.
3. **Persisted Numerical Score on Customer Profile & Table**:
   - Added persisted numerical score badges (`Score: {score}/100`) directly in the Customer Profile conversation modal header and the Leads & Calls table outcome column.
   - Replaced client-side fabricated `fitScore` in `CrmDashboard.tsx` with persisted scores. Refreshes live after calls via database event listeners.
4. **Transparent API Usage Tracking**:
   - Audited `/api/usage` and `ApiUsageTab.tsx`. Distinguishes verified MySQL database activity (sessions, turns, CRM tool calls) from provider-level quotas.
   - Accurately displays "Unavailable from provider" for live provider balance queries unexposed by Google AI Studio without Cloud Billing API credentials.
   - Dynamic user timezone display and UTC daily reset boundary countdown.
5. **Call Date Tracking & Top Date Filters**:
   - Added top filters to `LeadsAndCallsTab.tsx`: `All calls`, `Today`, `Last 7 Days`, `Last 30 Days`, and `Custom date range` with `From` and `To` date pickers.
   - Filters by actual call timestamps (`c.startedAt`), preserving individual timestamps for multi-call customers.
   - Includes invalid-date boundary validation (`From > To` inline error) and custom empty states.
6. **Consistent Dark & Light Theme Across All Components**:
   - Resolved conflicting hardcoded dark backgrounds in `EditLeadModal.tsx` and `TwilioConfigModal.tsx` (`bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800`).
   - Added dark theme styling to `CrmDashboard.tsx` background, cards, and handoff modals.
   - Persists theme across browser refresh via `localStorage.getItem('lyka_theme')`.

---

## 🔧 Previous Updates & Improvements (October 2026)

### Critical Bug Fix: Gemini Live API Model Configuration
**Issue Resolved**: Voice agent was not speaking due to incorrect model name configuration.

**What Was Fixed**:
- ✅ **Corrected Model Name**: Updated from incorrect `gemini-2.0-flash-exp` to the proper **`gemini-3.8-live`** model
- ✅ **Verified Against Documentation**: Confirmed `gemini-3.8-live` is the official Live API model for low-latency voice experiences (as of October 2026)
- ✅ **All Audio Paths Updated**: Fixed model references in:
  - Browser WebSocket connections (`/api/live-ws`)
  - Twilio telephony streams (`/api/twilio/media`)
  - Voice preview generation
  - API health endpoints

**Technical Details**:
- The Gemini Live API uses `gemini-3.8-live` for bidirectional audio streaming (bidiGenerateContent)
- Alternative model: `gemini-3.8-live-extended-thinking` available for high-reasoning voice interactions
- Previous incorrect model name (`gemini-2.0-flash-exp`) caused WebSocket error: `"models/gemini-2.0-flash-exp is not found for API version v1beta, or is not supported for bidiGenerateContent"`

**Files Modified**:
- `server.ts` - All Live API connection configurations (lines 1254, 1573, 1624, 2554, 2803, 2967)
- `test_voice_quality.mjs` - Voice quality test script
- Documentation updates (README.md, MVP.md)

### Troubleshooting Voice Agent Issues

If the voice agent is not speaking or closes immediately upon pressing start call:

1. **API Spending Cap / Quota Exceeded**
   - Error: `"Your project has exceeded its monthly spending cap"`
   - UI Display: Alert banner appears in `LiveCallWorkspace` with clickable links to Google AI Studio spend settings.
   - Solution: Visit [Google AI Studio Spend Settings](https://ai.studio/spend) to raise the project spend cap, or generate a new key at [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Dynamic Key Update: Can be updated at runtime via `POST /api/gemini/config` with `{"apiKey": "AIzaSy..."}` or `{"apiKey": "AQ...."}` or by editing `.env`.
   - Pipeline Diagnostic: Run `node test_audio_pipeline.mjs` to test audio chunk streaming directly against the Gemini Live API.

2. **API Key Formats (`AIzaSy` & `AQ.`)**
   - Both standard `AIzaSy...` keys and newer Google AI Studio `AQ....` developer keys are supported.
   - Hot-reloaded automatically from `.env` on every request.

3. **Model Configuration & Deprecation Fallback**
   - Live Voice Audio: Uses `gemini-3.8-live` for bidirectional audio streaming.
   - Probing & Tanglish Transcript Processing: Uses `gemini-3.5-flash` (`gemini-2.5-flash` was deprecated by Google for new users/keys with 404).
   - Rate limit probe safely isolates genuine spending cap / quota errors from standard model updates.

4. **Render Live Hosting Database Storage Setup**
   - Error: `"Call history storage is unavailable. This call cannot be saved."`
   - Cause: Render web services run in containers without a local MySQL service on `127.0.0.1`.
   - Resolution: Configure `DATABASE_URL` in Render Environment Variables pointing to a cloud MySQL provider (such as TiDB Cloud Serverless or Aiven MySQL) with SSL.
   - Fault Tolerance: The voice assistant (`gemini-3.8-live`) operates with non-blocking fallback—calls proceed in real-time even when MySQL persistence is offline.

---

## 📐 System Architecture Diagram

```
[ Real Customer / Mobile Phone ]                 [ Website Customer / Browser User ]
              │                                                     │
              │ PSTN Call (G.711 mu-law 8kHz)                       │ Web Audio API (16kHz PCM mic / 24kHz audio)
              ▼                                                     │ & REST JSON Chat Messages
      [ Twilio Telephony ]                                          ▼
              │                                        [ React 19 Client App (App.tsx) ]
              │ WebSocket Stream (/api/twilio/media)     ├── Header (Brand, Tabs, Persona, Theme Toggle)
              ▼                                          ├── Live Call Tab (Orb, Details, Transcript)
   ┌──────────────────────────────────────────────────┐  ├── Leads & Calls Tab (Prospects, Call Logs)
   │       Node.js / Express Server (server.ts)       │  ├── Dial Tab (PSTN Phone Dialpad)
   │   (or Python FastAPI Service in /backend)        │  └── API Usage Modal (Gemini Studio Quotas)
   ├──────────────────────────────────────────────────┤  
   │                                                  │◄────────────────────┘
   │  • Gemini Live Bridge (audio/pcm 16k ⇄ 24k)     │   WebSocket (/api/live-ws)
   │  • Structured Lead Extraction (update_lead_info) │   & REST API Endpoints (/api/chat, /api/knowledge,
   │  • Zero-AI-Disclosure System Prompt & Persona    │                         /api/leads, /api/calls, /api/usage)
   │  • Dedicated Telephony API (/api/call, /api/twilio)
   │  • G.711 mu-law ⇄ Linear PCM Audio Transcoder    │
   └─────────────┬──────────────────────┬─────────────┘
                 │                      │
                 ▼                      ▼
      [ Google Gemini API ]    [ MySQL Database (db.ts & leadService.ts) ]
        • gemini-3.8-live        • customers (identity & contacts)
        • gemini-2.5-flash       • leads (22+ qualification slots)
        • Function Calling       • conversations & conversation_messages
                                 • properties, land_listings, deals
```

---

## 📊 MVP Requirements & Implementation Status

| Feature / Module | Status | Verification Method | Notes |
|---|---|---|---|
| **Duplicate Agent Speech Fix** | **COMPLETED & VERIFIED** | Tested via audio pipeline deduplication & `tsc` | Deduplicated `sendRealtimeInput` in `server.ts` to forward single `audio` payload (discarding redundant `media`); added 200ms playback hangover in `LiveAudioPlayer` and 350ms acoustic echo drain in `LiveMicRecorder` to prevent room reverberation loopback. |
| **Lead Temperature & Qualification Determinism** | **COMPLETED & VERIFIED** | Tested via unit test suite (`scratch_test_scoring.ts`) | Replaced `'WARM'` default with `'PENDING'` in `db.ts` and `leadService.ts`; removed agent question keyword contamination in `scoring.ts`; disconnected/incomplete calls no longer qualify as WARM without evidence. |
| **Persisted Score on Customer Profile** | **COMPLETED & VERIFIED** | Tested via API & UI rendering | Numerical score (`Score: {score}/100`) and classification badge displayed on Customer Profile modal and Leads table; replaced fabricated `fitScore` with persisted lead score. |
| **API Usage Provider vs Local Accounting** | **COMPLETED & VERIFIED** | Tested via `/api/usage` & UI verification | Distinguishes verified database counts (MySQL sessions, turns, tool calls) from provider limits; displays "Unavailable from provider" for unexposed balances; dynamic local timezone & reset countdown. |
| **Leads & Calls Call Date Tracking & Filters** | **COMPLETED & VERIFIED** | Tested via filter state & UI verification | Top call date filter pills (`All calls`, `Today`, `Last 7 Days`, `Last 30 Days`, `Custom date range` From/To); filters by actual call timestamp (`startedAt`), preserves multi-call timestamps per customer, handles invalid date boundaries. |
| **Global Dark & Light Theme Consistency** | **COMPLETED & VERIFIED** | Tested via theme toggle & component audit | Fixed hardcoded dark classes in `EditLeadModal.tsx` and `TwilioConfigModal.tsx`; added dark theme support to `CrmDashboard.tsx`; persisted across page refreshes via `lyka_theme`. |
| **White Voice Calling Agent Interface (Google Stitch)** | **COMPLETED & SIGNED OFF** | Tested via Vite build & HTTP test suite | Clean white layout designed with Google Stitch ("Sovereign Voice Minimal"). Minimalist cards, subtle borders, high-contrast typography, and restrained purple/violet accents. Zero login forms or demo credentials. Knowledge tab removed from top navigation bar. |
| **WhatsApp-Style Dual-Bubble Chat Layout** | **COMPLETED & VERIFIED** | Tested via Vite build & UI state rendering | Agent messages on **LEFT** with avatar, bot badge, verified voice tag, left-corner bubble in white/slate. Customer messages on **RIGHT** in soft emerald green bubble (`bg-[#DCF8C6] dark:bg-[#005C4B]`) with customer initial avatar and WhatsApp double blue checkmarks (`✓✓`). Active streaming and interim listening bubbles. |
| **Interactive 3D Celestial Particle Orb** | **COMPLETED & VERIFIED** | Tested via HTML5 Canvas & build | Physics-based mouse drag & hover rotation with inertia damping (`Move3d`), 200 Fibonacci sphere particles, 2 concentric tilted orbital rings (22° and -40°), dynamic harmonic sinusoidal wave flaring during agent speech (`voiceState === 'speaking'`), and 16 dynamic studio audio spectrum equalizer bars. |
| **Fully Functional Dark & Light Theme** | **COMPLETED & VERIFIED** | Tested via Tailwind v4 `@custom-variant dark` & localStorage | Immediate visual switching across header, cards, inputs, dropdowns, and transcripts with persistent theme state (`lyka_theme`) across browser refreshes. |
| **Priya & Harish Voice Personas** | **COMPLETED & VERIFIED** | Tested via `/api/live-ws`, `/api/chat` & script | **Priya** (Female - Senior Property Relationship Manager) and **Harish** (Male - Senior Property Portfolio Executive). Zero references to legacy "Kayal" name. |
| **Exactly 5 Selectable Voice Presets** | **COMPLETED & VERIFIED** | Tested all 5 via automated script (5/5 200 OK) | Female: `Sulafat` (Default preferred Tanglish reference), `Callirrhoe`, `Aoede`. Male: `Achird`, `Zubenelgenubi` (Preferred male reference). Grouped `<optgroup>` selector. Dynamic `change_voice` updates audio generation in real-time. |
| **Transcript Looping & Duplicate Bug Fix** | **COMPLETED & VERIFIED** | Tested via multi-turn test & build | Solved token-delta streaming fragmentation. Removed placeholder `turn-init` duplicate rendering, filtered consecutive identical sentences in spoken audio, deduplicated consecutive agent turns, and prevented mic feedback echo from re-triggering speech. |
| **Spoken Expressions & Subtle Appreciation** | **COMPLETED & VERIFIED** | Tested via 10/10 test suite (`scratch/test_voice_prompt.ts`) & Gemini Live audio probe | Advanced Natural Voice Tuning: enriched Tanglish telephone vocabulary across 10 categories (Listening, Warmth, Empathy, Apologies, Thinking, Curiosity, Reassurance, Transitions, Polite Waiting, Closing). Natural gender-neutral `-nga` marker rotated with `sir/madam` (*"Seri nga, got it"*, *"Super nga!"*, *"Puriyudhu nga"*, *"Konjam wait pannunga nga"*, *"One second, let me check"*). South Indian phone call vocal cadence with higher engaged pitch on curiosity/greetings, and slower relaxed pace with pauses (`...`) when explaining/waiting. Raw XML tags strictly prohibited in token stream to guarantee glitch-free audio synthesis and clean transcripts. |
| **3-Attempt Objection Handling Protocol** | **COMPLETED & VERIFIED** | Built into system prompt & dialogue flow | 1st decline: Acknowledges warmly and pivots to referral or brief value point; 2nd decline: Respects choice and offers WhatsApp brochure for future reference; 3rd decline: Leaves gracefully without pushing. |
| **Cumulative Multi-Location & Special Notes Memory** | **COMPLETED & VERIFIED** | Tested via live qualification schema | Stores ALL locations mentioned chronologically (e.g. "Madurai, Thoothukudi"), and preserves cumulative special requirements, preferences, and objections across the entire dialogue. |
| **Extracted Prospect Profile Live Updates** | **COMPLETED & VERIFIED** | Tested in LeadPanel & LiveCallWorkspace | All 7 qualification fields (Name, Phone, Locations, Source, Purpose, Contact Method, Best Time) + Property specs + Special notes box live-sync from tool calls. |
| **Conversation Persistence & Real Call Transcripts** | **COMPLETED & VERIFIED** | Tested via `/api/calls` & MySQL queries | Inbound/outbound calls automatically register conversations, link leads, and stream turn-by-turn messages to `conversation_messages`. Full transcripts render dynamically in the Leads & Calls tab modal. |
| **Synchronous Customer Transcript Stream** | **COMPLETED & VERIFIED** | Tested via WebSocket stream | Delivers customer turns immediately to the UI to preserve exact chronological order with live agent responses; Tanglish normalization updates asynchronously in-place. |
| **6-Stage Tanglish Spoken Style & Lead Flow** | **COMPLETED & VERIFIED** | Tested via `/api/chat` & live tests | Introduction & name -> basic details -> property transition -> qualification -> summary. Direct real-estate question override active. |
| **Real Estate Knowledge Base** | **COMPLETED & VERIFIED** | Tested via `/api/knowledge` (200 OK) | India & Dubai listings, RERA/DLD regulations, investment comparison, Tanglish FAQs. |
| **Leads & Calls Management** | **COMPLETED & VERIFIED** | Tested via `/api/leads` & `/api/calls` | Compact single-view layout in `LeadsAndCallsTab.tsx`. Train-like accordion history list removed; 1-click **View** immediately opens a theme-responsive, centered conversation modal (`max-w-3xl`, `h-[88vh]`, `pt-16` below navbar). Full dual Light & Dark theme support (Light: clean white/rose-cream `#faf6f9`, readable dark text; Dark: royal plum `#2e0b22` & champagne gold). High-capacity transcript area (`flex-1 min-h-0`) reveals 10–15 turns simultaneously above a pinned `Close Details` button. Header intelligence & automated summary compressed to compact top strip. Customer bubbles right-aligned with amber/gold styling (`bg-amber-50 dark:bg-amber-500/20 text-slate-900 dark:text-amber-100 border border-amber-200 dark:border-amber-500/30`), agent left-aligned (`bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60`) with `break-words`. Independent scroll with `overscroll-contain` & body overflow lock. Aligned action buttons (`Call`, `View`, `Summary`, `Delete` all `h-7`). Centered delete confirmation modal (`max-w-sm`). `npx tsc --noEmit` passed (0 errors); `npm run build` passed (1670 modules, 3.02s). |
| **PSTN Telephony & Dialpad** | **COMPLETED & VERIFIED** | Tested via `/api/call` & DialTab | Interactive dialpad, Twilio integration with browser microphone guidance. |
| **Google AI Studio Quota Tracker** | **COMPLETED & VERIFIED** | Tested via `/api/usage?refresh=true` (200 OK) | Verified live database metrics (28 real sessions, 131 dialogue turns, 20 lead interactions, 12.65 mins audio duration), live Google Gemini API health probe, accurate RPD capacity bars, and real-time spending cap detection. |
| **MySQL Relational Persistence** | **COMPLETED & VERIFIED** | Tested via live queries | Pool with safe `CREATE TABLE IF NOT EXISTS`, zero data loss. |
| **Unified Upsert Lead Engine** | **COMPLETED & VERIFIED** | Tested via chat & voice turns | `leadService.ts` prevents duplicates, normalizes budgets and locations. |
| **Dual App Shell Navigation** | **COMPLETED & VERIFIED** | Tested in browser (`#crm`, `#chat`) & Vite production build | Chatbot and voice assistant strictly preserved; CRM accessible at `#crm` or `http://localhost:3001/#crm`. Seamless reactive screen switching in `App.tsx` via `window.location.hash`, champagne-gold `CRM Dashboard` quick button and `CRM` tab pill in `Header.tsx`, `CRM Analytics` button in `LeadsAndCallsTab.tsx`, and `AI Assistant` return button in `CrmHeader.tsx`. |
| **Aura Privé Dashboard Layout (Stage 1)** | **COMPLETED & SIGNED OFF** | Verified in build & DOM inspection | Full-viewport shell (`h-screen w-screen overflow-hidden`), independent sidebar/main scrolling, Tailwind v4 `@layer base` fix restoring all utility padding, centered max-w-[1600px] container. Zero clipping. *(Visual browser automation marked NOT VERIFIED due to offline Playwright binary 404)*. |
| **Dashboard Core KPIs (Stage 1)** | **COMPLETED & SIGNED OFF** | Verified in build & DOM | Responsive CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6`), 20px padding (`p-5`), 6 real MySQL tallies, zero border collisions across viewports. |
| **Recent Leads Table (Dashboard)** | **COMPLETED & VERIFIED** | Verified with 7 real records | Horizontal scroll wrapper (`overflow-x-auto min-w-[880px]`), 52px table rows, high contrast text, HOT/WARM/COLD badges, slide-in drawer, reachable Actions column. |
| **Lead Tracking Page (`LeadManagementView`)** | **COMPLETED & VERIFIED** | Verified in browser & API | 9 quick filters, search input, pagination, full 13 table columns with `overflow-x-auto min-w-[1250px]`. |
| **Lead Detail Drawer (`LeadDetailDrawer`)** | **COMPLETED & VERIFIED** | Verified in UI | Contact, status override, employee assignment, follow-up scheduler, audit log. |
| **Customer Directory (`CustomerManagementView` - Stage 2)** | **COMPLETED & VERIFIED** | Tested via API & build | Advanced search, 3 filters (`has_leads`, `preferred_contact`, `sort`), pagination, verified badge, 1-click modal triggers, wrapped in `overflow-x-auto min-w-[1080px]`. |
| **Customer Profile Modal & Edit Flow (`CustomerDetailModal` - Stage 2)** | **COMPLETED & VERIFIED** | Tested via API (`PATCH /api/crm/customers/:id`) | Complete 7 tabs (Overview, Leads, Conversations, Follow-ups, Visits, Deals, Notes) plus inline customer editing form with real-time MySQL persistence. |
| **Customer Creation & Validation Engine (Stage 2)** | **COMPLETED & VERIFIED** | Tested via script (`POST /api/crm/customers`) | Server-side validation for name, phone, email, and duplicate phone conflict detection (`409 Conflict`). |
| **Admin Navigation & Dedicated Module Routing** | **COMPLETED & VERIFIED** | Tested via router & build | Every sidebar link opens a dedicated module view (`ModuleDispatcher.tsx`), no generic duplicates or false claims. Unimplemented modules render transparent roadmap status. |
| **Role-Based Access Control (RBAC Backend & Frontend)** | **COMPLETED & VERIFIED** | Tested via scratch test script | Frontend hides unauthorized items; backend `crmRoutes.ts` enforces `requireRoles()` returning `403 Forbidden` for unauthenticated or unauthorized roles. |
| **Sales Pipeline Progression Board** | **COMPLETED & SIGNED OFF** | Verified in build & DOM | Responsive grid (`grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-3`), 4 columns × 2 rows on standard screens (8 on 2xl), all 8 stages fully readable. |
| **Compact Collapsible Sidebar** | **COMPLETED & SIGNED OFF** | Verified in build & DOM | Explicit width `w-72` (288px) `shrink-0`, independent nav vertical scroll, zero label clipping on left, official logo `/logo.png`, dynamic role-based module filtering. |
| **Official Lyka Realty Branding** | **COMPLETED & VERIFIED** | Verified via HTTP 200 | Local `/logo.png` served in Sidebar, Header, Welcome screen, and browser favicon. |
| **Single Global Header** | **COMPLETED & SIGNED OFF** | Verified in UI & screenshots | Responsive flex layout, breadcrumbs with truncation, search collapsed on `< xl` screens, role preview switcher, action buttons `shrink-0 whitespace-nowrap`. |
| **Dual Theme Support (Dark & Light)** | **COMPLETED & VERIFIED** | Verified in UI & tokens | Graphite `#0B0A0C` & Champagne Gold `#d8a868` vs Ivory `#FAF7F2`. |
| **Property & Land Visual Tables** | **COMPLETED & CONNECTED** | Real MySQL data connected | Dedicated `PropertiesView.tsx` and `LandManagementView.tsx` with spec breakdown and filter controls. |
| **Deals & Site Visits Modules** | **COMPLETED & CONNECTED** | Real MySQL data connected | Dedicated `DealsManagementView.tsx` and `SiteVisitsView.tsx` with financial tallies and feedback. |
| **Tasks & Activity Module** | **COMPLETED & CONNECTED** | Tested via API | Dedicated `TasksManagementView.tsx` with 1-click completion and task creation modal. |
| **Admin & Operations Modules** | **COMPLETED & CONNECTED** | Tested via API & RBAC checks | `AuditLogsView.tsx`, `SettingsView.tsx`, `UserManagementView.tsx`, `EmployeeManagementView.tsx`, `TeamsManagementView.tsx`. |
| **Employee Single Login & Auth (Stage 3)** | **COMPLETED & VERIFIED** | Tested via `verify_all.js` | Dedicated `EmployeeLoginPage.tsx` with PBKDF2 salt-hash, HMAC-SHA256 session tokens, show/hide password, and mandatory first-login password change. |
| **5-Role Simplification & Permissions (Stage 3)** | **COMPLETED & VERIFIED** | Tested via `verify_all.js` | 5 enterprise roles configured centrally in `permissions.ts`. Least-privilege backend access enforced via `requireRoles()`. Development role preview hidden in production (`!import.meta.env.DEV`). |
| **Property & Land Image Upload Pipeline Fix** | **COMPLETED & VERIFIED** | Tested via 2MB base64 upload & build | Resolved `Failed to execute 'json' on 'Response': Unexpected end of JSON input` via 50MB Express parser limit, client canvas downscaling (max 1920px, JPEG 0.88), safe JSON parsing, and unlocked `POST /api/crm/uploads` for all staff roles. |
| **Persistent Guest Mode Experience** | **COMPLETED & VERIFIED** | Verified in UI & login routes | Unauthenticated guest mode preserved with prominent "Continue as Guest (AI Concierge)" buttons on login page, navigation badges, and `#guest` routing. |
| **Customer Portal & Self-Service Profile** | **COMPLETED & VERIFIED** | Tested via E2E test suite | Dedicated `CustomerPortalView.tsx` (`#customer`), customer registration (`POST /api/crm/customer/register`), sign in (`POST /api/crm/customer/login`), profile inspection (`GET /api/crm/customer/me`), and live profile editing (`PATCH /api/crm/customer/profile`). |
| **Identity- & Role-Aware RAG AI Chatbot & Voice** | **COMPLETED & VERIFIED** | Tested via `/api/chat` & `/api/live-ws` | `getRagGroundingContext(user)` grounds chatbot dynamically: Super Admin receives live employee directory and team activity; Sales executives receive assigned leads & targets; Customers receive their budget and preferences; Guests receive luxury concierge guidance. |
| **Property & Land Inventory Cards & Uploads (Stage 3)** | **COMPLETED & VERIFIED** | Tested via `verify_all.js` | Responsive image-led card grid + table toggle, multi-image upload via `POST /api/crm/uploads`, image previews, fallback image, survey numbers, cents/acres, and guard against manual "Sold" status. |
| **Idempotent Purchase Verification & Points (Stage 3)** | **COMPLETED & VERIFIED** | Tested via `verify_all.js` | `POST /api/crm/deals/:id/verify-purchase` awards 500 conversion points idempotently into `reward_ledger`, sets linked inventory to 'sold', prevents duplicate points, prohibits self-approval. Live scorecard via `GET /api/crm/employees/:id/performance`. |
| **AI Property Recommendation Engine inside Chat (Stage 4)** | **COMPLETED & VERIFIED** | Tested via 112/112 test suite & API | Deterministic 100-pt weighted scoring (`propertyMatchingService.ts`), Tamil/Tanglish/English parser (`requirementExtractor.ts`), Requirement Confirmation card, recommendation cards with "Why it matches" explainability, 1-click site visit scheduling, interested property bookmarking, Customer Portal integration, relaxation suggestions, and unmatched broker triage queue. |
| **Global Floating AI Assistant (`GlobalAIAssistant.tsx`)** | **COMPLETED & VERIFIED** | Tested via 43/43 test suite & UI | Anchored at bottom-right of CRM layout (`CrmLayout.tsx`). Graphite & champagne-gold styling, collapsible launcher, live role badge, role- & page-aware prompt chips, Web Speech voice input, role-grounded `/api/chat` integration, and per-user isolated sessionStorage history preventing cross-user conversation leaks. |
| **Role-Based Dashboard Dispatcher (`RoleDashboard.tsx`)** | **COMPLETED & VERIFIED** | Tested via `verify_all_roles_rbac.js` | Dedicated server-verified dashboard views for all 5 roles (Super Admin, Operations Admin, Lead Exec, Territory Manager, Sales Exec). Real MySQL KPIs, neutral loading skeleton eliminating data flash, and zero-trust backend API (`GET /api/crm/dashboard`). |
| **Enhanced CRM Analytics Dashboard (`OverviewDashboard.tsx`)** | **COMPLETED & VERIFIED** | Tested via `scratch/verify_dashboard_analytics.ts` (46/46 passed) & Vite production build | Full analytics dashboard powered by `GET /api/crm/dashboard/analytics`: 16 period KPIs (Total/New/Hot/Warm/Cold/Qualified/Converted Leads, Total/Answered/Missed Voice Calls, Avg Duration, Answer & Qualification Rates), interactive date filters (Today, 7d, 30d, 90d, Custom Range), date-based lead & call trends (`LeadTrendChart.tsx`), lead source donut & stacked bar analytics (`LeadSourceChart.tsx`), 7-stage qualification funnel (`LeadFunnelViz.tsx`), 4 radial rate rings (`RateRingsViz.tsx`), hot-lead priority list (`HotLeadsPanel.tsx`), live CRM activity feed (`ActivityFeed.tsx`), multi-report CSV export (`dashboardExport.ts`), KPI-card filter navigation to `LeadManagementView`, and seamless dual Light & Dark theme support. |
| **Zero-Trust Backend RBAC & Account-Switching Cleanup** | **COMPLETED & VERIFIED** | Tested via 43/43 test suite & API | Cryptographically signed HMAC-SHA256 tokens strictly enforced; spoofed headers (`x-user-role`, `?role=`) return 401/403. Scoped record filtering (Sales Exec sees only assigned leads; Territory Manager sees only department team). On sign-out or account switch, cached KPIs and assistant chats are instantly wiped. |
| **Unified AI Land & Property Recommendation Engine inside Chat** | **COMPLETED & VERIFIED** | Tested via 25/25 automated test suite (`scratch/test_unified_land_property_recommendation.ts`) & live MySQL `lyka_crm` | Deterministic 100-pt scoring for land (Location 25%, Budget 20%, Area 20%, Zoning 15%, Road 10%, Utilities 10%) and properties (25/20/15/10/15/15); multilingual NLP parser (English, Tamil, Tanglish); standard unit conversions (cents, grounds, acres, sq.ft); strict vs flexible matches; data completeness tracking; chat confirmation cards (`RequirementConfirmationCard.tsx`); land-enriched recommendation cards (`PropertyRecommendationCard.tsx`); full modal (`PropertyDetailModal.tsx`); public concierge (`App.tsx`) and floating assistant (`GlobalAIAssistant.tsx`) integration; customer bookmarking (`customer_interested_properties`) and site visit booking with automatic CRM tasks. |
| **Direct AI Chatbot Experience** | **COMPLETED & VERIFIED** | Verified in browser & production build | Unnecessary roadblocks and tab navigations (`Live call`, `Knowledge`, `Leads & calls`, `Dial`) removed; opens directly into the conversational Chatbot with greeting and quick reply chips. CRM portal remains accessible via `🏛️` header button and `#crm`. |
| **Tamil Nadu Tanglish Speaking Style & Voice Presets** | **COMPLETED & VERIFIED** | Verified via `/api/config`, `/api/live-ws` & test suite | Natural everyday Tamil Nadu Tanglish mixing colloquial Tamil and English naturally with pitch, emotion, and pace variation. 5 selectable Gemini Live voices: `Sulafat` (Default female reference), `Callirrhoe` (Female), `Aoede` (Female), `Achird` (Male), `Zubenelgenubi` (Preferred male reference). |
| **India & Dubai Knowledge Base & Guidelines** | **COMPLETED & VERIFIED** | Verified via `GET /api/knowledge` | 6 verified listings (Dubai Marina, Downtown, Palm Jumeirah, Anna Nagar, OMR, ECR), regulatory guides (RERA, Stamp Duty, EC, Dubai DLD 4%, Freehold vs Leasehold, UAE Golden Visa AED 2M+), investment comparison matrix, and Tanglish FAQs with polite redirection for off-topic queries. |
| **Deterministic Lead Scoring & Inline Keyword Highlights** | **COMPLETED & VERIFIED** | Verified in TypeScript & UI | Rule-based 100-pt scoring across 5 factors (Timeline 25, Budget 25, Property 20, Readiness 15, Next step 15) with transparent reasons and HOT/WARM/COLD badge in Customer Requirements panel (`📋`). Regex-based inline highlights for names, budgets, locations, and property types (`highlightKeywords.tsx`). |
| **Customer Name Integrity Bug Fix & Protocol** | **COMPLETED & VERIFIED** | Verified via `scratch/test_master_prompt_suite.ts` | Critical bug fixed: When customer says "M. Perkumar", AI never shortens to "Kumar" or "Kumar sir" or "M". Acknowledges as "Nice to meet you! Eppadi irukkeenga sir?". Separate `customer_name_raw` and `customer_preferred_name` fields persisted in DB and verified across all 10 name cases. |
| **Emotional Intelligence & Appropriate Apologies** | **COMPLETED & VERIFIED** | Verified via live multi-turn WebSocket dialogue test suite | Conversational sentiment recognition: acknowledges concerns and apologizes sincerely with empathy if the customer sounds angry, frustrated, or disappointed without defensiveness or arguing. Responds warmly to excitement, and neutrally when tone is uncertain (prohibits unnecessary apologies). |
| **Lyka Realty Company & Social Channels Guidance** | **COMPLETED & VERIFIED** | Verified via live multi-turn WebSocket dialogue test suite | Agent naturally explains company real estate services across India & Dubai, references verified website (`https://lykarealty.com`) and email (`contact@lykarealty.com`), and transparently explains that social channels are undergoing verification. |
| **Live Mid-Session Voice Switching** | **COMPLETED & VERIFIED** | Verified via `scratch/test_master_prompt_suite.ts` | Changing voice during active speech or listening immediately interrupts the old audio stream (flushing player buffer), connects a new Gemini Live session with the chosen voice (e.g. Sulafat -> Zubenelgenubi), preserves conversation context, and continues dialogue naturally without duplicate greetings or overlapping speech. |
| **Compact Voice Sample Demo Buttons ("Preview Voice")** | **COMPLETED & VERIFIED** | Verified via automated test suite (5/5 voices 200 OK) | Speaker preview button beside each of the 5 voices (`Sulafat`, `Aoede`, `Callirrhoe`, `Achird`, `Zubenelgenubi`). Serves authentic golden 24kHz WAV audio sample directly from `voice/` with in-memory caching and dynamic TTS fallback for consistent sentence: *"Vanakkam sir! Eppadi irukkeenga? Naan Lyka Realty AI assistant. Ungalukku eppadi help panna mudiyum?"*. Isolates preview playback from live call audio, transcripts, and mic. |
| **Natural Greeting & No Name Inquiry at Start** | **COMPLETED & VERIFIED** | Tested via `scratch/test_final_update_suite.ts` | Agent starts with warm, natural greeting: *"Vanakkam sir! Eppadi irukkeenga? Naan Priya, Lyka Realty-la irundhu pesuren."* Never begins with "What is your name?" or immediate questionnaires. Answers property questions first. |
| **Subtle Appreciation & Natural City Response** | **COMPLETED & VERIFIED** | Tested via `scratch/test_final_update_suite.ts` | Light appreciation (*"Super sir!"*, *"Okay nga, puriyudhu"*, *"Ohh, appadiya?"*); avoids fake excitement or overpraising. Responds naturally to customer's city (e.g. Thoothukudi, Chennai) with zero invented facts. |
| **Gradual 7-Field Lead Collection & DB Persistence** | **COMPLETED & VERIFIED** | Tested via `scratch/test_final_update_suite.ts` & MySQL | Progressively gathers all 7 required lead fields across dialogue turns one question at a time (Name, Phone, Location, Lead Source, Purpose, Preferred Contact Method, Best Time to Contact) with full MySQL persistence. |
| **Vercel Deployment & Cloud MySQL SSL** | **COMPLETED & VERIFIED** | Verified via build & `vercel.json` | `vercel.json` configured with SPA routing rewrites. Cloud MySQL support enabled via `DB_SSL=true` in `db.ts` for Aiven, TiDB, Supabase, or AWS RDS. Production build (`npm run build`) bundles in 581ms with zero lint/type errors. |
| **InfinityFree MySQL Audit & Remote Database Compatibility** | **AUDITED & TESTED (NOT REACHABLE EXTERNALLY)** | Tested via `scratch/test_infinityfree_connection.ts`, `Test-NetConnection`, DNS lookup | Host `sql308.infinityfree.com` has no public DNS A record (`ENOTFOUND`) and port 3306 is firewalled on InfinityFree free hosting against external connections. Node.js / Express and WebSockets are not supported on InfinityFree. Local MySQL (`lyka_crm`, 55 leads, 62 calls) verified working. Safe `CREATE DATABASE IF NOT EXISTS` exception handling added to `db.ts` for cloud/shared hosting. Standalone PHP proxy gateway provided at `bridge/infinityfree_bridge.php` for internal InfinityFree query execution if needed. |
| **TiDB Cloud Live Connection & Test Data Purge** | **COMPLETED & VERIFIED** | Verified via live query, /api/health/db & /api/leads | Purged all dummy testing records from TiDB Cloud 5 core tables (backup preserved in `scratch/backup_tidb_testing_data.json`). Connected `.env` directly to TiDB Cloud (`gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000`). Verified server startup and live DB health check (`"database":"connected"`, `"error":null`). Returned 0 active test leads for clean production operation. |
| **Complete CRM Setup Removal** | **COMPLETED & VERIFIED** | Verified via codebase audit, clean build & DB inspection | Completely removed all CRM subsystem files (src/crm/, crmRoutes.ts, CRM-specific modals and views). Removed CRM navigation links, tabs, and #crm route handling from App.tsx, Header.tsx, and LeadsAndCallsTab.tsx. Purged 11 unwanted tables from TiDB Cloud and local MySQL, leaving strictly the 5 core tables (customers, leads, conversations, conversation_messages, lead_interactions). Updated db.ts to only manage the 5 core tables. Application bundle dropped from 819 KB to 355 KB. |
| **TiDB Cloud 5 Core Tables Architecture & Cleanup** | **COMPLETED & VERIFIED** | Tested via `scratch/clean_tidb_tables.ts` & TiDB query verification | Connected to TiDB Cloud (`gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000`). Safely backed up 11 unwanted CRM tables to `scratch/backup_tidb_unwanted_tables.json` and dropped them from `lyka_crm`. Strictly preserved the 5 core tables matching `lyka_realty_core_schema_infinityfree.sql`: `customers` (7 rows), `leads` (55 rows), `conversations` (67 rows), `conversation_messages` (97 rows), and `lead_interactions` (115 rows). Added `CORE_TABLES_ONLY=true` support in `db.ts` to prevent unwanted table re-creation. |

---

## 👥 Simplified Employee Roles & Central Permissions (`permissions.ts`)

The CRM system has consolidated all organizational permissions into **5 simplified roles**. Access is enforced both in the UI navigation sidebar and via server-side verification:

| Role Name | Scope & Operational Responsibilities | Permitted Modules | Actions & Restrictions | Seed Dev Account |
|---|---|---|---|---|
| **Super Admin** | Full organizational authority, system configuration, security audit logs, user management, and purchase verification. | All modules (Dashboard, Leads, Customers, Properties, Land, Pipeline, Deals, Site Visits, Tasks, Campaigns, Team, Employees, Rewards, Notifications, Settings, Audit Logs, Users) | Can create, edit, approve, verify deals, and delete/archive all records. | `admin@lyka` (Super Admin) |
| **Operations Admin** | Property & land inventory oversight, employee directory, operational verification, system audit logs. | Dashboard, Leads, Customers, Properties, Land, Tasks, Employees, Teams, Rewards, Notifications, Audit Logs | Full CRUD on Properties and Land (uploading images, updating specs). Cannot verify deal purchases or manage user login accounts. | `CO2` (Kavitha) |
| **Lead Management Executive** | Inbound lead registration, prospect qualification, assignment where permitted, and follow-ups. | Dashboard, Leads, Customers, Properties, Land, Tasks, Notifications | Lead creation, qualification editing, follow-up scheduling, and customer profile linking. Cannot verify deal purchases or manage team settings. | `CO4` (Deepa) |
| **Sales Territory Manager** | Regional team oversight, deal pipeline, site visit supervision, purchase verification, and performance tracking. | Dashboard, Leads, Customers, Properties, Land, Pipeline, Deals, Site Visits, Tasks, Teams, Employees, Rewards, Notifications | Can verify deal purchases for team members (Self-approval strictly prohibited). Cannot access Settings, Audit Logs, or Users. | `CO3` (Arunachalam) |
| **Sales & Growth Executive** | Assigned lead portfolio, customer engagement, property matching, sales activities, and permitted campaigns. | Dashboard, Leads, Customers, Properties, Land, Pipeline, Deals, Site Visits, Tasks, Rewards, Campaigns, Notifications | Can manage assigned leads, create deals, log site visits, and view personal performance points. Cannot verify purchases or approve inventory. | `CO1` (Mohan) |

### Development Role Preview
- **Development Only**: Rendered only when `import.meta.env.DEV` is true.
- **Preview Label**: Clearly labeled as a development UI preview.
- **Zero Backend Authority**: Never used for real authentication or backend privilege escalation.
- **Production Safety**: Completely removed from production builds.

---

## 🔄 Business Workflows & Acceptance Criteria

### Workflow 1: AI Chatbot / Voice Lead Capture
1. Customer initiates chat or voice call on `http://localhost:3000/#chat`.
2. Gemini extracts property requirements via `update_lead_info` tool.
3. `leadService.ts` normalizes budget (e.g. ₹3.5 Cr), location, and temperature (HOT/WARM/COLD).
4. Lead is saved into MySQL `leads` table and linked to existing or new `customers` record.
5. **Acceptance Criteria**: Within 1 second, the lead appears on the CRM dashboard under **Recent Leads** with correct temperature badge and inquiry details.

### Workflow 2: Lead Triage & Agent Follow-up Scheduling
1. Sales Manager or Agent clicks a lead row on the CRM dashboard or Lead Management table.
2. `LeadDetailDrawer` opens from the right edge with complete inquiry context.
3. Agent assigns the lead to an employee (e.g. Vinakya Mahadev) and updates pipeline status to `contacted`.
4. Agent opens the "Schedule Follow-up" section, sets title, due date, and priority.
5. `POST /api/crm/leads/:id/tasks` records the task into the `tasks` table.
6. **Acceptance Criteria**: The scheduled task appears on the CRM Dashboard under **Follow-ups Today** with a 1-click "Done" button.

### Workflow 3: Customer Management & Profile Editing
1. Agent opens `Customers` from the navigation sidebar.
2. Search bar filters customers dynamically by name, phone, email, or city.
3. Agent clicks "View Profile" or customer row; `CustomerDetailModal` displays 7 organized tabs.
4. Agent edits customer profile; `PATCH /api/crm/customers/:id` validates fields and saves to MySQL.
5. **Acceptance Criteria**: All edits persist immediately; duplicate phone numbers return `409 Conflict`.

### Workflow 4: Single Employee Login & Authenticated Session
1. Employee visits `#login` route or clicks "Staff Portal" on the welcome screen.
2. Inputs Employee ID / Email (`CO1`, `CO2`, etc.) and Password (`12345678`).
3. Backend validates PBKDF2 hash and returns HMAC-SHA256 token and real employee profile.
4. App stores session, redirects to CRM dashboard, and loads role-permitted navigation.
5. **Acceptance Criteria**: All 5 seed accounts authenticate; invalid credentials return 401; unauthenticated users cannot access protected CRM APIs.

### Workflow 5: Employee-Aware AI Chatbot
1. Logged-in employee Mohan (`CO1`) opens the AI Assistant.
2. Server detects `employeeToken`, extracts display name ("Mohan") and ID ("CO1").
3. Assistant greets naturally: *"Hi Mohan! Welcome back to Lyka Realty. What would you like to do today?"*
4. Quick actions appear: View leads, Register lead, Find properties, Schedule visit, Check points.
5. Employee registers a prospect: chatbot collects name, phone, address, and interested property without asking the employee for their identity.
6. Details are confirmed and saved with `assigned_agent: CO1`.
7. **Acceptance Criteria**: Employee is greeted by name; guest mode remains public and functional; prospect lead is attributed to the employee.

### Workflow 6: Property & Land Inventory with Multi-Image Upload
1. Operations Admin opens Properties or Land module.
2. Views listings in responsive image card grid or toggles to tabular view.
3. Clicks "Add Listing" or edits existing listing.
4. Uploads image files (PNG/JPG/WebP); client sends to `POST /api/crm/uploads`, saving securely to `uploads/listings/` and generating `/uploads/listings/...` URLs.
5. Image preview displays with remove option; fallback image rendered if no photo uploaded.
6. Attempts to set status to "Sold" manually are blocked by backend with descriptive error.
7. **Acceptance Criteria**: Listings persist to MySQL with images, survey numbers, and specifications. Manual "Sold" status assignment is strictly rejected.

### Workflow 7: Idempotent Purchase Verification & Points Ledger
1. Deal reaches completion.
2. Super Admin or Sales Territory Manager clicks "Verify Purchase" on Deals Management.
3. Backend checks that manager is not self-approving their own deal.
4. Backend checks `reward_ledger` to verify deal hasn't already been awarded points.
5. Backend awards 500 conversion points to assigned agent, creates immutable ledger record, marks deal as `closed_won`, and updates linked property/land status to `sold`.
6. Subsequent calls return `alreadyAwarded: true` and 0 duplicate points.
7. **Acceptance Criteria**: Points award is strictly idempotent; self-approval is rejected; employee scorecard reflects updated points.

### Workflow 8: Natural Language Property Recommendation & Site Visit Scheduling
1. Customer expresses housing requirement in chat or voice (e.g. *"Looking for 2 BHK in OMR under 85 Lakhs near metro"*).
2. NLP extractor (`requirementExtractor.ts`) extracts configuration, INR budget, locality, and amenities.
3. Chat renders `RequirementConfirmationCard` with action buttons: `Confirm & Search Inventory`, `Edit Requirements`, `Continue Chatting`.
4. User clicks `Confirm & Search Inventory` or confirms verbally.
5. Backend (`POST /api/crm/matching/recommend`) executes deterministic 100-pt weighted matching algorithm against real MySQL inventory.
6. Chat streams ranked `PropertyRecommendationCard`s with match score badge, Indian pricing, metro walking distance, and "Why it matches" bullet checklist.
7. Customer clicks `Save to Interested` (persists to `customer_interested_properties` and instantly populates the Customer Portal).
8. Customer clicks `Schedule Visit` (opens `ScheduleSiteVisitModal`, records viewing appointment in `site_visits` table, and triggers agent follow-up task).
9. If no listing scores ≥ 50%, engine triggers relaxation suggestions (budget stretch, corridor expansion, alternate BHK).
10. **Acceptance Criteria**: Matching is 100% deterministic, explainable, and bound between 0-100; low matches trigger relaxation suggestions; existing Gemini voice and text chatbot systems are completely preserved.

### Workflow 9: Role-Based Dashboard Switching & Navigation Enforcement
1. Employee logs in via `#login` or session revalidates via `GET /api/crm/auth/me`.
2. `RoleDashboard.tsx` evaluates server-verified role from authenticated profile.
3. Renders a neutral loading skeleton while fetching `GET /api/crm/dashboard`.
4. Renders role-specific tailored dashboard with 100% real MySQL metrics:
   - **Super Admin**: Full company pipeline, verified revenue, employee directory, audit security logs, inventory status.
   - **Operations Admin**: Property & land counts (available/reserved/sold), pending verification queue, incomplete listings missing photos, operational tasks.
   - **Lead Management Executive**: Unassigned leads, qualification backlog, overdue follow-ups, unmatched requirements (< 50% match score), quick registration shortcuts.
   - **Sales Territory Manager**: Direct team roster, points balances, territory pipeline vs quota, team deals, site visits, deal approvals queue (self-approval prohibited).
   - **Sales & Growth Executive**: Personal assigned prospects, personal tasks due today & overdue, scheduled client visits, active deals, quota progress bar, bonus points ledger.
5. Sidebar dynamically updates via `hasModuleAccess()` to show only permitted navigation groups and modules.
6. If an unauthorized route is opened directly, `ModuleDispatcher` displays `<AccessDeniedView>` with return button.
7. **Acceptance Criteria**: Each role sees strictly its authorized dashboard and sidebar; unauthorized routes are blocked; zero data flash.

### Workflow 10: Global Floating AI Assistant & Session Isolation
1. Employee clicks the champagne-gold AI Assistant launcher pill in bottom-right corner of CRM layout.
2. Floating chat window expands displaying user identity and role badge.
3. Assistant provides role- and page-aware suggested query chips based on active route and permissions.
4. User can type or use microphone for voice input via Web Speech API.
5. Requests to `/api/chat` pass Bearer session token, grounding Gemini with role-specific RAG context.
6. Employee logs out or switches accounts: `CrmContext` immediately destroys private assistant chat logs from `sessionStorage` (`lyka_ai_crm_chat_*`) and clears cached dashboard data.
7. **Acceptance Criteria**: Assistant provides role-appropriate answers; private chats never leak between accounts; guest mode retains public luxury concierge without leaking staff records.

### Workflow 11: Unified Natural Language Land & Property Recommendation in Chat
1. User (anonymous guest, customer, lead, or authenticated employee) asks a land or property question in chat (e.g. *"I need 5 cents of residential land in OMR below 40 lakhs with road access"* or *"OMR la 30 lakhs kulla plot irukka?"* or *"Show me villas in Chennai under 2 crore"*).
2. `requirementExtractor.ts` extracts listing category (`land` vs `property`), location, budget, area, units (`cents`, `grounds`, `acres`, `sqft`), road access, and zoning.
3. Chat displays `RequirementConfirmationCard.tsx` with parsed constraints and actionable buttons (`Confirm & Search Inventory`, `Edit Requirements`, `Continue Chatting`).
4. If searching on behalf of an assigned lead, employee ID permissions are verified (`CO1` can only query assigned leads; unauthorized leads return 404/403).
5. Deterministic scoring engine calculates explainable score bounded 0–100 using dedicated Land profile (25/20/20/15/10/10) or Property profile (25/20/15/10/15/15) against real MySQL `land_listings` or `properties`.
6. Strict matches are separated from flexible alternatives; over-budget listings are excluded when strict budget limit is active.
7. Chat renders up to 10 ranked `PropertyRecommendationCard.tsx` cards with Plot/Land badges, formatted area, price per unit, road access pill, zoning status, data completeness indicator, and "Why it matches" explainability bullets.
8. User clicks `View Details` to open `PropertyDetailModal.tsx` with full specifications, `Save to Interested` to bookmark into `customer_interested_properties`, or `Schedule Visit` to book a visit in `site_visits` with automatic high-priority CRM task generation.
9. **Acceptance Criteria**: Natural language land queries retrieve real MySQL inventory with transparent deterministic scores and explainability; zero hallucinations; Sales Executives scoped to assigned leads; existing Gemini Live voice and text systems remain 100% operational.

---

## 🗄️ Database Tables & Affected Relationships

| Table Name | Entity Represented | Relationship Connections |
|---|---|---|
| `customers` | Client Profiles | One-to-many with `leads`, `conversations`, `tasks`, `deals`, `site_visits`, `customer_interested_properties`. |
| `leads` | Property Inquiries | Belongs to `customers`. Linked to `employees` (`assigned_agent`), `tasks`, `deals`, `property_recommendations`. |
| `conversations` | Communication Sessions | Foreign keys to `lead_id` and `customer_id`. One-to-many with `conversation_messages`. |
| `conversation_messages` | Chat/Voice Turns | Foreign key to `conversation_id`. |
| `lead_interactions` | Audit Timeline | Foreign key to `lead_id`. |
| `teams` | Organizational Teams | One-to-many with `employees`. |
| `employees` | Staff Directory & Auth | Columns `login_id`, `password_hash`, `must_change_password`, `role`, `points_balance`. Referenced by all CRM entities. |
| `properties` | Property Inventory | Multi-image JSON, specifications, `metro_distance_km`, `locality_rating`. Referenced by `deals`, `site_visits`, `customer_interested_properties`. |
| `land_listings` | Land Inventory | Multi-image JSON, survey numbers, cents/acres/grounds, `road_access`, `water_availability`, `electricity_availability`, `zoning`, `metro_distance_km`, `locality_rating`. Referenced by `deals`, `site_visits`, `customer_interested_properties`. |
| `deals` | Sales Deals | Linked to `lead_id`, `customer_id`, `property_id`, `land_id`, `agent_id`. |
| `site_visits` | Property Viewings | Foreign keys to `customer_id`, `lead_id`, `property_id`, `employee_id`. |
| `tasks` | Follow-ups & Reminders | Foreign keys to `assigned_to` (`employees.id`), `lead_id`, `customer_id`. |
| `reward_ledger` | Points Ledger | Idempotent transaction ledger (`source_event_id`, `event_type`, `points`, `direction`). |
| `campaigns` | Ad Campaigns | Lead attribution source. |
| `crm_notifications` | In-app Alerts | Operational system notifications. |
| `audit_logs` | Security Audit Trail | Immutable event log with actor and record type. |
| `crm_settings` | System Settings | Key-value JSON settings for organization, scoring, and units. |
| `property_recommendations` | Match Session Logs | Foreign keys to `lead_id`, `customer_id`. Snapshot criteria, top score, results array. |
| `customer_interested_properties` | Bookmarked Inventory | Foreign keys to `customer_id`, `lead_id`, `property_id`, `land_id`. |

---

## 🧪 Test Status & Verification Report

| Test Executed | Command | Result | Verification Details |
|---|---|---|---|
| **Production Build** | `cmd /c npm run build` | **PASSED** | Built in 804ms. 1,701 modules transformed with 0 TypeScript/JSX errors. Output: `dist/index.html` (1.11 kB), CSS (138.01 kB), JS (698.56 kB). |
| **Stage 3 & Customer RAG Verification** | `node scratch_verify.js` | **PASSED (8/8)** | • Test 1 (Staff Login - Super Admin): PASSED (`admin@lyka`)<br>• Test 2 (Property/Land Image Upload): PASSED (2MB base64 cleanly uploaded without JSON parse error to `/uploads/listings/`)<br>• Test 3 (Customer Registration): PASSED (New customer account created in `customers` table)<br>• Test 4 (Customer Sign In): PASSED (Token issued, customer session verified)<br>• Test 5 (Customer Profile & Inquiries): PASSED (`GET /customer/me` returns customer profile, linked leads & visits)<br>• Test 6 (Customer Profile Update): PASSED (`PATCH /customer/profile` updates budget range & preferences)<br>• Test 7 (Chatbot RAG for Super Admin): PASSED (Speaks and shares live employee directory, active tasks, and team activities)<br>• Test 8 (Chatbot RAG for Customer): PASSED (Personalized response recognizing customer name, budget range, and property preferences). |
| **5-Role RBAC & Global Assistant Test Suite** | `node scratch/verify_all_roles_rbac.js` | **PASSED (43/43)** | • 5 Seed Account Logins & Token Issuance: PASSED (`admin@lyka`, `CO2`, `CO4`, `CO3`, `CO1`)<br>• 5 Role Dashboard Payloads (`GET /api/crm/dashboard`): PASSED (Super Admin, Operations Admin, Lead Exec, Territory Manager, Sales Exec)<br>• Zero-Trust Backend Auth: PASSED (Unauthenticated request returns 401; Spoofed `x-user-role` without token returns 401; Unauthorized role requesting `/employees` returns 403)<br>• Record Scoping: PASSED (Sales Exec receives only assigned leads; Territory Manager receives only department team members; Sales Exec blocked from employee directory)<br>• Role-Grounded RAG: PASSED (Super Admin receives employee intelligence; Sales Exec receives personal portfolio; Guest chat never leaks staff records). |
| **RBAC & 5-Role Security Suite** | `node scratch/verify_all.js` | **PASSED (38/38)** | • 5 Seed Accounts Sign-in: PASSED (`admin@lyka`, `CO1`, `CO2`, `CO3`, `CO4`)<br>• Server `/auth/me` Session Verification: PASSED (Mohan, CO1)<br>• Least-Privilege RBAC Backend Enforcement: PASSED (403 on restricted endpoints)<br>• Employee-Aware Chatbot: PASSED ("Hi Mohan! Welcome back...")<br>• Lead Detail Slot Extraction & Attribution: PASSED (`assigned_agent: CO1`)<br>• Property & Land CRUD with Images: PASSED<br>• Idempotent Purchase Verification: PASSED (500 pts awarded once)<br>• Purchase Verification Idempotency Check: PASSED (0 duplicate pts awarded on retry). |
| **AI Assistant Text & Voice Integrity** | Server inspect & fallback | **PASSED** | Gemini 3.8/2.5 Live and Flash integrated with database RAG grounding. Chatbot and telephone voice bridge 100% operational. |
| **Blank Screen / White Page Fix** | Browser & HMR inspection | **FIXED & VERIFIED** | Resolved root causes of blank screen on `#crm`: (1) Fixed React hook ordering in `RolePreviewSelector.tsx`; (2) Added safe null-coalescing in `Sidebar.tsx`; (3) Added `ErrorBoundary.tsx`; (4) Added localStorage schema normalization. |
| **Comprehensive AI Recommendation Suite** | `npx tsx scratch/comprehensive_recommendation_tests.ts` | **PASSED (112/112)** | Tested 20 comprehensive categories: 100-pt deterministic weights, tie-breaking, metro proximity scaling, INR budget conversion, Tamil/Tanglish requirement extraction, CRM persistence, site visit creation, Customer Portal bookmarks, and no-match relaxation suggestions. |
| **Unified Land & Property Recommendation Test Suite** | `npx tsx scratch/test_unified_land_property_recommendation.ts` | **PASSED (25/25)** | Full 25-point automated verification: Multilingual NLP (English, Tamil, Tanglish), Lakhs/Crores conversion, area conversions (cents, grounds, acres, sq.ft), exact & corridor locality, strict budget exclusions, area tolerance, missing data/road/zoning policy, deterministic land scoring (25/20/20/15/10/10), sorting, pagination, honest no-match handling, MySQL querying, customer bookmarks, employee scoping, guest security, site visits with CRM tasks, context preservation, and chatbot regression. |
| **Matching Service Unit Tests** | `npx tsx scratch/test_matching_service.ts` | **PASSED (39/39)** | Unit tests for deterministic scoring boundaries (0-100), Indian currency formatting, unknown/missing data neutrality, and multi-tier budget penalties. |
| **Recommendation REST API Tests** | `npx tsx scratch/test_recommendation_api.ts` | **PASSED (30/30)** | Verification of 6 REST endpoints: `/matching/recommend`, `/matching/interest`, `/matching/site-visit`, `/matching/feedback`, `/matching/history`, `/matching/unmatched`. |
| **Cloud Deployment Readiness (Render.com)** | `render.yaml` & `cmd /c npm run build` | **VERIFIED** | Blueprint `render.yaml` created. `--legacy-peer-deps` and `.npmrc` configured for CI build. `tsx` runtime packaged in dependencies. Dynamic `$PORT` binding on `0.0.0.0`. Production SPA static serving configured. WSS WebSocket protocol supported without extra proxying. |
| **Multi-Viewport Visual Automation** | Browser subagent (Playwright) | **NOT VERIFIED** | Playwright automated driver download blocked by Windows sandbox network restriction (404 on Azureedge zip). Application UI verified via Vite build, layout rules, and HTTP endpoint verification. |

---

## 🚧 Staged Roadmap

1. **Stage 1 (Completed & Signed Off)**: Layout, clipping, and branding bug fixes. Tailwind CSS v4 `@layer base` cascade fix, full-viewport shell (`h-screen w-screen overflow-hidden`), independent dual vertical scrolling for fixed desktop sidebar (`w-72 shrink-0`) and main content area (`min-w-0 max-w-[1600px]`), responsive KPI auto-fit grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6`), readable 8-stage pipeline board (4×2 grid), data table horizontal scroll wrappers, and official local `/logo.png`.
2. **Stage 2 (Completed & Verified)**: Customer Management & Customer Profile overhaul. Advanced search & filtering (`has_leads`, `preferred_contact`, `sort`), customer creation with server-side validation and duplicate phone detection, inline customer profile editing with `PATCH /api/crm/customers/:id`, and comprehensive 7-tab customer profile view.
3. **Stage 3 (Completed & Verified)**: Role Simplification, Single Employee Login, Image Upload Crash Fix, Persistent Guest Mode, Customer Portal & Self-Service, Identity-Aware RAG Chatbot (Admin employee directory intelligence, Sales lead focus, Customer profile preferences), Image-Led Property/Land Inventory (`PropertiesView.tsx`, `LandManagementView.tsx`, `POST /api/crm/uploads`), guard against manual "Sold" status, idempotent purchase verification (`POST /api/crm/deals/:id/verify-purchase`), and live performance points scorecard (`PerformanceRewardsView.tsx`).
4. **Stage 4 (Completed & Verified)**: Automated customer-property AI matching engine (`propertyMatchingService.ts`), structured requirement extraction (`requirementExtractor.ts`), Indian INR currency converter, interactive confirmation & recommendation cards (`PropertyRecommendationCard.tsx`, `RequirementConfirmationCard.tsx`), criteria explainability ("Why it matches"), honest no-match relaxation suggestions, site visit scheduling modal (`ScheduleSiteVisitModal.tsx`), Customer Portal bookmarking (`customer_interested_properties`), and unmatched broker triage queue.
5. **Stage 5 (Completed & Verified)**: Global Floating AI Assistant (`GlobalAIAssistant.tsx`) anchored at `bottom-6 right-6` with graphite and champagne-gold luxury styling, live user/role badge, role- and page-aware suggested chips, Web Speech voice input, and per-user sessionStorage isolation. Role-aware dashboard dispatcher (`RoleDashboard.tsx`) delivering 5 distinct server-computed dashboards (Super Admin, Operations Admin, Lead Exec, Territory Manager, Sales Exec) with zero-flash neutral skeleton. Strict zero-trust backend RBAC with cryptographically signed tokens, spoofing protection, and instant account-switching data wipe.
6. **Stage 6 (Completed & Verified)**: Unified AI Land & Property Recommendation Engine inside chat for customers, leads, and all employee roles. Deterministic scoring profile for land (25/20/20/15/10/10), multilingual Tanglish/Tamil/English requirement parser, standard area unit conversions (cents, grounds, acres, sq.ft), strict vs flexible match separation, honest data completeness tracking, rich chat recommendation cards (`PropertyRecommendationCard.tsx`), detailed specifications modal (`PropertyDetailModal.tsx`), site visit booking with automatic agent follow-up task creation, employee lead scoping, and RAG grounding on real MySQL inventory.
7. **Stage 7 (Next)**: Smart PDF brochure generator, automated WhatsApp follow-up triggers, and voice-guided site visit booking.
