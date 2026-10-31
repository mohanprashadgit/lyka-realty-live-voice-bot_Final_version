# Voice improvements (Tanglish accuracy + emotion)
- src/utils/audio.ts: removed browser SpeechRecognition (ta-IN); added 400ms pre-roll so barge-in speech isn't clipped.
- server.ts (Gemini Live config): languageCode ta-IN, temperature 0.7, tuned server VAD (700ms silence, 300ms prefix).
- server.ts (prompt): Tanglish vocabulary list, numbers/confirmation rules, laugh/pause/emotion examples.
- server.ts: customer transcript fragments merged into ONE turn, then cleaned by a Flash model (normalizeTanglishTranscript); UI replaces raw text via `user_transcript_normalized`.
- AI-disclosure rule changed: bot now truthfully says it is an AI (with a friendly laugh) - server.ts + instructions/SYSTEM_INSTRUCTIONS.md.
- Verify: languageCode / realtimeInputConfig / model IDs against your SDK version.
- Not changed: Twilio backend (main.py still doesn't forward audio to Gemini), AudioWorklet migration.
