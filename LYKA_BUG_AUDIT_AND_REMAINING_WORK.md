# LYKA REALTY — ZIP bug audit and targeted fixes
Date: 2026-11-07
Input: `06.11.26.zip` (the uploaded snapshot, not an independently confirmed live deployment).

## Fixed in this package
1. **Incorrect name/hometown classification (high impact)**: `observeSalesTurn()` previously marked `Naan Tirunelveli`, `Naan Madurai-la irukken` and `Naan business panren` as customer names. This skipped the mandatory name question and polluted CRM. Name extraction is now contextual/explicit; hometown recognition uses explicit location expressions or known town names, and standalone name replies work in the name stage.
2. **Mixed-field hometown recognition**: `Naan Salem, family-la four members, rendu pasanga, budget 3 crore, 3 BHK venum` remains a valid multi-field utterance. Prior name/hometown fixes do not prevent location extraction when a town is followed by another clause.
3. **Gemini tool merge defense**: if a tool reports the same unconfirmed value as customer name and hometown, CRM will not silently accept it as a verified name; explicit customer name confirmation remains possible.
4. **Tanglish refusal/busy/DNC state**: `Vendam`, `No thanks`, `Ippo time illa` and `Inime call pannadheenga` now stop proactive qualification and properly flag explicit DNC; rejecting one property preference (e.g. `2BHK vendam 3BHK venum`) does not cancel the call. The existing objection classifier is reused.
5. **False family relocation inference**: `Naan Dubai-la settle aaganum` alone no longer means moving **with family**. Family relocation is recorded only if family is actually mentioned.
6. **Existing SQL startup query**: `db.ts` selected nonexistent `leads.location` in the lead scoring recalculation query. It now aliases `original_location AS location`, which exists in the reviewed lead schema. This was the reported known startup issue; a real database startup test is still required.
7. **Regression tests**: added tests to `tests/proactive_qualification.test.ts` for each newly discovered bug.

## Evidence and validation
- TypeScript: `tsc --noEmit` passed.
- Source compiled with TypeScript into a temporary ESM test directory.
- 233/233 compiled regression tests passed after staging source/fixture paths needed by the Windows-authored tests.
- A native Vite build was **not confirmed in this Linux container**: the ZIP's node_modules contains Windows-specific esbuild/rolldown binaries. This is an environment incompatibility, not proof of an app build failure.
- No production CRM access, microphone listening or Twilio PSTN call was performed.

## Remaining tasks: not claimed fixed
- **Live-agent determinism**: Gemini must actually follow `next_action` on the spoken turn, not merely receive text policy and tool responses. Needs end-to-end audio test; transcript-only state updates do not inject new speech turns.
- **Phone verification**: `nextSalesAction` has no dedicated contact-number confirmation/collection step before permission-based telephone follow-up. Add only with correct Twilio/CRM phone hydration; never request a known number unnecessarily.
- **Optional hometown rapport**: hometown recognition and style examples exist, but `nextSalesAction` does not proactively schedule a distinct hometown question for every receptive caller. Decide when to ask without blocking the core sales journey.
- **Audio naturalness**: native expression guidance exists; real Tanglish pacing, laughter, stuttering and interruptions remain unverified.
- **Task 6**: memory/identity gate exists; confirm real cross-call access, permissions, retention and deletion policy; no biometric identity assurance.
- **Task 8**: competitor comparison logic exists, but `backend/knowledge/transactions.json` is empty; no verified current transaction comparisons.
- **Task 9**: approved live property inventory/recommendation retrieval is not implemented. Current fallback requests specialist verification.
- **Task 10**: live browser microphone, PSTN/Twilio and visual CRM tests pending.
- **Task 11**: authentication, secret handling, CRM privacy, permissions and production hardening need a dedicated review. **Uploaded ZIP contains `.env` and a CRM SQL export — do not share either publicly. Rotate secrets if exposed.**

## Apply
This patch modifies ONLY five paths (four application modules + one test). Extract the accompanying fix ZIP over the same project root, making sure to back up or commit the current branch first. Do not apply blindly to a newer checkout: compare against current modifications before applying. The archive deliberately excludes `.env`, SQL exports, `node_modules`, and build output.

Retest with the project's native package manager on the actual development machine:
- `npm run lint`
- `npm run build`
- run all test suites using the project's existing TypeScript test runner
- complete one browser and one Twilio voice scenario.
