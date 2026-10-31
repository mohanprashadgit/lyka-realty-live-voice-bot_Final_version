import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
dotenv.config({ quiet: true });
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let session;
const timeout = setTimeout(() => { console.error('FAIL: voice provider timed out'); session?.close(); process.exit(1); }, 20000);
try {
  session = await ai.live.connect({
    model: 'gemini-3.8-live',
    config: { responseModalities: [Modality.AUDIO], outputAudioTranscription: {}, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } } },
    callbacks: {
      onmessage(msg) {
        if (msg.serverContent?.modelTurn?.parts?.some(p => p.inlineData?.data)) {
          console.log('PASS: existing model and voice returned audio'); clearTimeout(timeout); session?.close(); process.exit(0);
        }
      },
      onerror() { console.error('FAIL: voice provider connection error'); clearTimeout(timeout); process.exit(1); },
      onclose(event) { console.log('Provider closed connection:', event.code); },
    },
  });
  session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'Say hello.' }] }], turnComplete: true });
} catch {
  clearTimeout(timeout); console.error('FAIL: could not connect to the configured voice provider'); process.exitCode = 1;
}
