# Lead synchronization fix

## Root causes

The profile consumed `lead_update` immediately, independently of persistence. MySQL was offline, and the frontend ignored `lead_save_result`. Operator edits posted to the nonexistent `POST /api/leads` instead of `/api/lead/save`. The records tab fetched only once and coupled lead loading to call-history loading. Extraction wrappers (`{value: ...}`), incomplete updates, original location, and numeric budget formatting also needed consistent handling. A subsequent call with only partial information could fail to find the already-linked contact.

## Changes

- `src/utils/leadFields.ts`: shared scalar/wrapped-field normalization; omit empty or invalid values.
- `leadService.ts`: use normalized extraction data; find leads through their conversation link; correct comma-separated budgets and currency/unit ambiguity.
- `server.ts`: return actual save HTTP status; include session/conversation identities in save acknowledgements; return original location, intent, contact details and numeric budget correctly; order recently updated leads first. Added optional `--skip-schema-init` for restarting against existing tables without running seeds.
- `src/App.tsx`: consume save acknowledgements, report failures, notify records subscribers on successful commits, preserve the session/conversation for operator edits, and use the correct save API.
- `src/components/LeadsAndCallsTab.tsx`: refresh after a committed save, on focus, and every five seconds; keep leads independent of call-history errors; show contact method/time and enquiry purpose within existing table cells.
- `src/types/agent.ts`: include contact preferences and intent in the lead record type.
- `tests/lead-sync.integration.ts`: explicit real-MySQL integration verification.

The existing layout, columns, CSS, voice model/configuration, TTS, and audio transport were preserved. No schema or global configuration changes, database replacement, record deletion, or seed initialization was performed. Backups of edited files are in `scratch/before-lead-sync`. The production build regenerated `dist`.

## Verification

Started the existing XAMPP MySQL instance with approval using its existing configuration. The real integration test passed: extraction-shaped payload → shared save service → existing MySQL → actual production HTTP handlers. It verifies every requested field, concurrent update deduplication, empty-field protection, operator edits, transcript/call linkage, and recovery in a fresh Node process.

Retained one explicitly labelled test lead, `TEST - Lead Sync Verification` (`b6b700ac-5045-4755-b22a-28219ebe7727`), and its test conversation. Its artificial phone must not be dialled. These are test records, not fallback/mock application data.

TypeScript checks, production build, and all four existing records regression tests passed. The latter confirm unchanged voice connection configuration and audio transport. A microphone-driven conversation and visual browser automation were not performed in this turn; extraction-shaped conversation input was tested through real persistence and HTTP routes.

Restarted the app with `npm.cmd run dev -- --skip-schema-init`. The running API at **http://127.0.0.1:3000** returned the saved test lead once and its linked call after restart. On this machine `localhost:3000` reaches a different listener that returns no leads; use the explicit IPv4 address. MySQL must remain running for persistence. Vite also reports its pre-existing hot-reload port conflict; production compilation succeeds.
