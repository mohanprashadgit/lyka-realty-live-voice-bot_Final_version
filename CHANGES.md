# Voice improvements (Tanglish accuracy + emotion)
- src/utils/audio.ts: removed browser SpeechRecognition (ta-IN); added 400ms pre-roll so barge-in speech isn't clipped.
- server.ts (Gemini Live config): languageCode ta-IN, temperature 0.7, tuned server VAD (700ms silence, 300ms prefix).
- server.ts (prompt): Tanglish vocabulary list, numbers/confirmation rules, laugh/pause/emotion examples.
- server.ts: customer transcript fragments merged into ONE turn, then cleaned by a Flash model (normalizeTanglishTranscript); UI replaces raw text via `user_transcript_normalized`.
- AI-disclosure rule changed: bot now truthfully says it is an AI (with a friendly laugh) - server.ts + instructions/SYSTEM_INSTRUCTIONS.md.
- Verify: languageCode / realtimeInputConfig / model IDs against your SDK version.
- Not changed: Twilio backend (main.py still doesn't forward audio to Gemini), AudioWorklet migration.

# Customer-facing identity & self-introduction (Priya / Harish)
- server.ts: agent opens with name only - "Vanakkam sir! Eppadi irukkeenga? Naan Priya/Harish, Lyka Realty-la irundhu pesuren." (persona `defaultGreeting`s, Step 1 of the call flow, phrase register, Twilio and Gemini Live opening triggers).
- server.ts: the calling agent never volunteers AI/bot/assistant wording; it also never claims to be a real human (identity framing line and IDENTITY RULE rewritten).
- server.ts: if the caller directly asks about AI identity, the agent answers truthfully in one short line ("Lyka Realty-oda virtual voice assistant") and returns to the enquiry.
- server.ts: romantic 3-strike deflections reworded without AI wording.
- server.ts / prompt: the "Never say: Vanakkam" bans keep working everywhere except the first self-introduction line.
- Unchanged: voice presets and configurations, chatbot (`mode: chatbot`) identity, voice-preview sample text, Dashboard/UI, qualification, objection-handling and call start/end logic.
