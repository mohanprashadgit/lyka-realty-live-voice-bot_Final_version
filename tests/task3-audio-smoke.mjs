// Generates review recordings; successful PCM generation is NOT an audible-expression verdict.
// Run: node tests/task3-audio-smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import { buildNaturalVoiceInstructions } from '../src/utils/naturalVoice.ts';
dotenv.config({ quiet: true });
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const builder = stripTypeScriptTypes(source.slice(source.indexOf('function getAgentPersona('), source.indexOf('// Real-time API usage and live quota tracking')));
const prompt = new Function('buildNaturalVoiceInstructions', `${builder}; return getSystemInstruction;`)(buildNaturalVoiceInstructions)('bilingual');
const codecs = stripTypeScriptTypes(source.slice(source.indexOf('function linear16ToMuLaw('), source.indexOf('// Function declaration for structured lead qualification')));
const { encode, decode } = new Function(`${codecs}; return { encode: pcm24kToMuLaw8k, decode: muLawToLinear16 };`)();
const out = path.resolve('scratch/task3-audio');
fs.mkdirSync(out, { recursive: true });
const cases = [
  ['joke', 'Dubai property pathi pesalaam. Balcony en plants-ku dhaan, naan guest maadhiri! Just joking.'],
  ['sad', 'Actually I lost my job recently. Property vaanga ippo mudiyadhu.'],
  ['angry', 'Why are you pressuring me? I am annoyed.'],
  ['confused', 'Payment plan-na enna? Enakku puriyala. Simple-ah sollunga.'],
  ['finance', 'Return guaranteed-aa? I cannot afford to lose my savings, haha.'],
  ['thinking', 'Dubai-la own use illa investment, edhu suit aagumnu yosikkaren.'],
];
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const results = [];
// Independent sessions avoid carrying sadness/anger into unrelated test cases.
for (const [route, voiceName] of [['browser', 'Sulafat'], ['phone-codec', 'Kore']]) {
  for (const [name, customer] of cases) {
    let session;
    let timer;
    const chunks = [];
    let transcript = '';
    try {
      let finish, fail;
      const completed = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
      // Attach a rejection handler immediately, including while connect is pending.
      completed.catch(() => {});
      timer = setTimeout(() => fail(new Error('timeout')), 25000);
      const connecting = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: prompt,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } }, ...(route === 'browser' ? { languageCode: 'ta-IN' } : {}) },
          ...(route === 'browser' ? { temperature: 0.75 } : {}),
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage(msg) {
            const content = msg.serverContent;
            for (const part of content?.modelTurn?.parts || []) if (part.inlineData?.data) chunks.push(Buffer.from(part.inlineData.data, 'base64'));
            if (content?.outputTranscription?.text) transcript += content.outputTranscription.text;
            if (content?.turnComplete) finish();
          },
          onerror() { fail(new Error('provider connection error')); },
          onclose() { fail(new Error('provider closed before turn completion')); },
        },
      });
      // Close a late connection if the bounded wait expired.
      let expired = false;
      connecting.then(s => { if (expired) s.close(); }, () => {});
      try { session = await Promise.race([connecting, completed.then(() => { throw new Error('closed before setup'); })]); }
      catch (error) { expired = true; throw error; }
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: customer }] }], turnComplete: true });
      await completed;
      const pcm = Buffer.concat(chunks);
      if (!pcm.length) throw new Error('no audio received');
      fs.writeFileSync(path.join(out, `${route}-${name}-native.wav`), wav(pcm, 24000));
      if (route === 'phone-codec') {
        // Use the production conversion per chunk, just as Twilio media messages do.
        const mulaw = Buffer.concat(chunks.map(encode));
        const decoded = Buffer.alloc(mulaw.length * 2);
        mulaw.forEach((v, i) => decoded.writeInt16LE(decode(v), i * 2));
        fs.writeFileSync(path.join(out, `${route}-${name}-8khz.wav`), wav(decoded, 8000));
      }
      const stageTagInTranscript = /\[(?:laughs?|chuckles?|soft laugh|sighs?|pauses?)\]/i.test(transcript);
      results.push({ route, voiceName, scenario: name, audioSeconds: pcm.length / 48000, transcript, stageTagInTranscript, audibleVerification: 'NOT REVIEWED', transport: 'Direct Gemini API; not a browser device or real phone call' });
      console.log(`CAPTURED ${route}/${name}: ${(pcm.length / 48000).toFixed(1)} seconds; listening review required`);
    } catch {
      // Never log SDK errors which may include request URLs or credentials.
      results.push({ route, scenario: name, status: 'FAILED', audibleVerification: 'NOT VERIFIED' });
      console.error(`FAIL ${route}/${name}: provider unavailable, timeout, or no completed audio`);
      process.exitCode = 1;
    } finally {
      clearTimeout(timer);
      session?.close();
      fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    }
  }
}
