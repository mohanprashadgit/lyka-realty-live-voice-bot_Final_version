# Lyka Realty — Full Fixed Source Package

This package contains the complete **application source** from the user's `06.11.26.zip` snapshot with the targeted fixes previously applied to:

- `db.ts`
- `src/utils/customerIntelligence.ts`
- `src/utils/salesConversation.ts`
- `src/utils/salesIntelligence.ts`
- `tests/proactive_qualification.test.ts`

Original project code, frontend, backend, Twilio/Gemini integration, knowledge files, tests and documentation are included. This package is **not** a claim that the service is production-ready.

## Start locally

1. Install Node.js and run `npm ci` from this directory.
2. Copy `.env.example` to `.env`, and fill in **your own** API keys/database settings. Do not commit `.env`.
3. Run `npm run lint` and `npm run build` on your machine.
4. Run `npm run dev`.
5. Verify CRM, browser voice, and Twilio end-to-end with valid test credentials.

## Packaging and security

Excluded deliberately: real `.env`, `.npmrc`, `node_modules`, compiled `dist`, local scratch/build data, and SQL records/exports (which may contain personal information). The database **schema** SQL file remains included. The PHP InfinityFree bridge now requires `LYKA_BRIDGE_SECRET` to be set on its host; unauthenticated diagnostic `ping` is no longer allowed. Do not deploy this bridge before a full security review. Do not use the included example DB credentials as production values.

## Known limitations

- Current approved Dubai real-estate transaction file is empty; exact live market comparisons cannot be claimed.
- Real browser microphone/Twilio audio, voice style, calls and production database were not verified by this package operation.
- Prior targeted bug validation reported 233/233 compiled regression tests and clean TypeScript; repeat checks in your actual deployment environment.
- Phone verification/discovery and actual customer-field prompting still require real-call testing.
- Security and privacy hardening (Task 11) remains pending.

See `LYKA_BUG_AUDIT_AND_REMAINING_WORK.md`.
