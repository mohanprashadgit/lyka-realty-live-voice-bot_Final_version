# Conversational sales behaviour (live voice prompt)
- server.ts getSystemInstruction (used by the browser /api/live-ws session and the Twilio stream): greeting asks for a free moment, not the name; name is asked later, once, only at a natural gap; no "Hello sir!" openers; "sir/madam" rationed and never inferred from voice or name; language adapts turn by turn in bilingual mode (English in, English out); discovery before any pitch.
- Removed claims the knowledge base does not verify: 80% loan approval, a promised 6-8% return in the opener, a booked weekend site-visit slot, a payment-plan adjustment, and "premier" / "clear compliance" wording.
- Added: harsh/angry customer handling (apologize once, slow down, offer callback or stop), trust and verification answers, no-inventory and no-booked-visit guards, slow-lookup wording, and correction handling.
- Fixed: the prompt rendered "Hello undefined" when no lead name was passed.
- Unchanged on purpose: objection counting and do-not-call (server-side), unwanted-speech escalation, lead_source/status extraction, update_lead_info schema, CRM persistence, calling infrastructure, AI-disclosure policy.
- Tests: tests/voice_prompt.test.ts (13 checks; run with node --import tsx --test tests/voice_prompt.test.ts).
- Known gaps: the Twilio media stream has no server-side objection or unwanted-speech guard; the Hindi and Arabic openers still ask for the name; instructions/*.md are not loaded at runtime and are not updated.

# Voice improvements (Tanglish accuracy + emotion)
- src/utils/audio.ts: removed browser SpeechRecognition (ta-IN); added 400ms pre-roll so barge-in speech isn't clipped.
- server.ts (Gemini Live config): languageCode ta-IN, temperature 0.7, tuned server VAD (700ms silence, 300ms prefix).
- server.ts (prompt): Tanglish vocabulary list, numbers/confirmation rules, laugh/pause/emotion examples.
- server.ts: customer transcript fragments merged into ONE turn, then cleaned by a Flash model (normalizeTanglishTranscript); UI replaces raw text via `user_transcript_normalized`.
- AI-disclosure rule changed: bot now truthfully says it is an AI (with a friendly laugh) - server.ts + instructions/SYSTEM_INSTRUCTIONS.md.
- Verify: languageCode / realtimeInputConfig / model IDs against your SDK version.
- Not changed: Twilio backend (main.py still doesn't forward audio to Gemini), AudioWorklet migration.
