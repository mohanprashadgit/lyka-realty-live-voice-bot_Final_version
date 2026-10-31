# Transcript and records changes

Inspected the main React/Express/MySQL application and these reference ZIP components before editing: `server/call/leadStore.ts`, `src/lib/transcript.ts`, and `server/call/recorder.ts`, together with the reference file inventory. Adapted identity-based updates, persistent call records, contact reuse, and transcript finalization; did not transplant the reference application or its JSON database/audio recorder.

## Findings

- The initial UI greeting was hardcoded rather than transcribed. Agent sentence deduplication removed legitimate repeated speech. Asynchronous transliteration could replace the recognized customer text, while history retained different text. Inserting spaces between every text fragment broke subwords.
- Partial customer input could arrive in the same event as agent output and be processed too late. Interrupted agent speech and typed live-call messages were not consistently saved.
- Conversation/message IDs were regenerated on retries. Lead lookup only considered session identity, and concurrent lookup/create operations could race. Existing-lead updates did not link the new conversation.
- The call-history join could multiply rows. History supplied fictional durations, scores, property details, and placeholder transcripts. Database failures appeared as empty successful results.
- Phone-call records existed only in process memory. Local lead reads reinserted demonstration contacts and resurrected empty/deleted lists.

## Modified application files

- `server.ts`: transcript event handling/finalization; stable turn identifiers; typed/interrupted message persistence; ordered message metadata; phone-call persistence through existing MySQL tables; accurate history mapping and explicit storage failures. Removed two shadowed duplicate tool-schema properties to resolve existing compile errors without changing their effective values.
- `leadService.ts`: deterministic conversation/message IDs; contact lookup by session or formatted phone digits; serialized transactional lead upserts and conversation linking.
- `src/App.tsx`: empty initial transcript; fresh transcript for each call; preserve original transcription/repetitions; interruption deduplication; preserve pending agent text on local hangup; stable typed-message IDs.
- `src/components/LeadsAndCallsTab.tsx`: surface history-loading failures within the existing layout.
- `src/storage/leads.ts`: no automatic demo-record resurrection; normalized-phone duplicate prevention for saves/imports.
- `src/storage/calls.ts`: derive lead outcome from the newest call.

Added `tests/records.test.ts`, `tests/voice-smoke.mjs`, this report, and implementation scripts/backups under `scratch`. Production build regenerated `dist`.

## Preservation

No changes to `.env`, API keys, dependencies, database schema, existing database records, CSS, animation components, voice IDs/models, TTS settings, audio buffers, sample rates, microphone capture, or audio transport. Original versions of the six edited application files are retained as `.bak` files in `scratch/before-record-fixes`.

## Validation

- `npm.cmd run lint`: passed. Baseline had duplicate-property errors and a nullable-conversation-ID error.
- `npm.cmd run build`: passed.
- `node --import tsx --test tests/records.test.ts`: four tests passed, covering local record reload/deduplication, database adapter identity/linking with an isolated query double, literal transcript fragments, and unchanged live voice connection/audio transport configuration.
- `node tests/voice-smoke.mjs`: passed against the existing `gemini-3.8-live` model with `Sulafat`; received audio. No telephone call was placed, and no credential was printed.
- Read-only connection check: MySQL refused `127.0.0.1:3306`. No server/service configuration was changed.

## Outstanding verification and limitations

Real MySQL writes, concurrent transactions, and persistence across an application/database restart remain unverified until the configured database is available. The database-adapter test uses a query double, not MySQL. Browser microphone/playback, live interruption timing, and real Twilio calls require an interactive end-to-end check. Voice-provider audio generation alone does not verify those paths.

Existing historical duplicates were not deleted or merged. Existing records with timestamp ties and no ordering metadata cannot have their original order reconstructed reliably. Phone matching retains country-code digits; it does not infer a missing country code. The existing history API still returns its latest 50 records. No new lead-management UI was introduced; the changes adapt persistence and deduplication to the existing lead extraction, storage, and history interfaces.

When MySQL is unavailable, new records cannot be durably saved to it; the UI now reports this instead of claiming a successful empty history. Restart persistence must not be considered fully verified yet.
