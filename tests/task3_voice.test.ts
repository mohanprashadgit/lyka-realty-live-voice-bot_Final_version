import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { buildNaturalVoiceInstructions, NATURAL_VOICE_CATEGORIES } from '../src/utils/naturalVoice.ts';
import { LiveAudioPlayer } from '../src/utils/audio.ts';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const policy = buildNaturalVoiceInstructions();

test('original instruction bytes preserved and appendices match the live policy', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./task3-instruction-baseline.json', import.meta.url), 'utf8'));
  for (const [file, value] of Object.entries(manifest) as [string, { bytes: number; sha256: string; normalizedLength: number; normalizedSha256: string }][]) {
    const bytes = fs.readFileSync(new URL(`../${file}`, import.meta.url));
    const exactPrefix = crypto.createHash('sha256').update(bytes.subarray(0, value.bytes)).digest('hex') === value.sha256;
    const normalized = bytes.toString().replace(/\r\n/g, '\n');
    // Git may convert CRLF on checkout; accept only that transformation.
    assert.ok(exactPrefix || crypto.createHash('sha256').update(normalized.slice(0, value.normalizedLength)).digest('hex') === value.normalizedSha256, file);
    assert.equal(normalized.slice(value.normalizedLength), '\n\n## ' + policy);
  }
});

test('all 15 contextual categories have alternative spoken examples without tags', () => {
  assert.equal(NATURAL_VOICE_CATEGORIES.length, 15);
  assert.equal(new Set(NATURAL_VOICE_CATEGORIES.map(c => c.name)).size, 15);
  for (const category of NATURAL_VOICE_CATEGORIES) {
    assert.ok(category.when.length > 20);
    assert.ok(category.examples.length >= 2);
    assert.ok(!/[\[\]<>]/.test(category.examples.join(' ')));
  }
});

// These are policy-contract checks, not evidence of generated behaviour or audible acting.
const scenarios = [
  ['natural laughter', 'Laugh only at customer-led light humour'],
  ['customer joke', 'Customer jokes about needing a balcony'],
  ['sadness plus nervous laughter', 'I lost my job, haha'],
  ['angry customer', 'follow immediate DNC and closing'],
  ['thinking', 'Holding phrases such as Oru nimisham'],
  ['Tanglish pronunciation guidance', 'Tamil grammar with familiar English property terms'],
  ['repetition prevention', 'within the last four assistant turns'],
  ['serious finance', 'Financial sensitivity, sadness, anger, refusal and busy signals take priority'],
  ['contextual selection', "customer's latest complete meaning and audible tone"],
  ['no fake waiting', 'require an actual available tool check in progress'],
  ['fallback without stage tags', 'omit it and speak a plain appropriate sentence'],
];
for (const [name, rule] of scenarios) test(`policy: ${name}`, () => assert.ok(policy.includes(rule)));

test('browser sends native audio unchanged and suppresses interrupted or manually abandoned audio', () => {
  const block = server.slice(server.indexOf('// Audio chunks from model native speech'), server.indexOf('// Streaming output transcription of agent speech'));
  const run = new Function('modelTurn', 'interrupted', 'suppressInterruptedAudio', 'safeSend', 'usageMetrics', 'browserOutputActive', block);
  for (const [interrupted, manual, expected] of [[false, false, 1], [true, false, 0], [false, true, 0], [true, true, 0]]) {
    const sent: any[] = [];
    run({ parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/pcm;rate=24000' } }] }, interrupted, manual, (m: any) => sent.push(m), { totalAudioSecondsReceived: 0 });
    assert.equal(sent.length, expected);
    if (expected) assert.equal(sent[0].data, 'AAAA');
  }
  const manualStart = server.indexOf("} else if (msg.type === 'barge_in')");
  const manualBlock = server.slice(manualStart + "} else if (msg.type === 'barge_in') {".length, server.indexOf("} else if (msg.type === 'end')", manualStart));
  const manual = new Function('browserOutputActive', 'safeSend', 'clearSilenceFollowUp', `let suppressInterruptedAudio = false; ${manualBlock}; return suppressInterruptedAudio;`);
  const noop = () => {};
  assert.equal(manual(true, noop, noop), true);
  assert.equal(manual(false, noop, noop), false, 'interrupt while idle must not mute the next answer');
  assert.match(server, /if \(turnComplete\) \{\s*suppressInterruptedAudio = false/);
});

test('Twilio converts native PCM only when not interrupted and preserves duration', () => {
  const codecs = server.slice(server.indexOf('function linear16ToMuLaw('), server.indexOf('// Function declaration for structured lead qualification'));
  const convert = new Function(`${stripTypeScriptTypes(codecs)}; return pcm24kToMuLaw8k;`)();
  const begin = server.indexOf('if (!interrupted && modelTurn?.parts && streamSid)');
  const block = server.slice(begin, server.indexOf('// Save transcript', begin));
  const run = new Function('interrupted', 'modelTurn', 'streamSid', 'pcm24kToMuLaw8k', 'sendToTwilio', block);
  for (const interrupted of [false, true]) {
    const sent: any[] = [];
    run(interrupted, { parts: [{ inlineData: { data: Buffer.alloc(4800).toString('base64') } }] }, 'test-stream', convert, (m: any) => sent.push(m));
    assert.equal(sent.length, interrupted ? 0 : 1);
    if (!interrupted) {
      assert.equal(Buffer.from(sent[0].media.payload, 'base64').length, 800);
      assert.ok(Buffer.from(sent[0].media.payload, 'base64').every(v => v === 255));
    }
  }
  const clearBegin = server.indexOf('if (interrupted && streamSid)');
  const clearEnd = server.indexOf('\n              }', clearBegin) + '\n              }'.length;
  const sent: any[] = [];
  new Function('interrupted', 'streamSid', 'sendToTwilio', server.slice(clearBegin, clearEnd))(true, 'test-stream', (m: any) => sent.push(m));
  assert.deepEqual(sent, [{ event: 'clear', streamSid: 'test-stream' }]);
});

test('browser barge-in stops every queued source and resets scheduling', () => {
  const player = new LiveAudioPlayer();
  const state = player as any;
  let stopped = 0;
  let disconnected = 0;
  state.ctx = { currentTime: 10 };
  state.nextPlayTime = 30;
  state.isPlaying = true;
  state.activeSources = Array.from({ length: 3 }, () => ({ stop() { stopped++; }, disconnect() { disconnected++; } }));
  player.stopAndClear();
  assert.equal(stopped, 3);
  assert.equal(disconnected, 3);
  assert.equal(state.nextPlayTime, 0);
  assert.equal(state.activeSources.length, 0);
  assert.equal(player.isPlaying, false);
});

test('transcript remains provider text, never reconstructed from expression examples', () => {
  const start = server.indexOf('function appendTranscriptChunk(');
  const end = server.indexOf('function getAgentPersona(', start);
  const append = new Function(`${stripTypeScriptTypes(server.slice(start, end))}; return appendTranscriptChunk;`)();
  assert.equal(append('Puriyudhu. ', '[chuckles] Budget?'), 'Puriyudhu. [chuckles] Budget?');
  assert.ok(server.includes('text: outputTranscription.text'));
  assert.ok(server.includes('delta: outputTranscription.text'));
  assert.ok(server.includes("systemInstruction: getSystemInstruction('bilingual', 'female', undefined, knownCustomerName(leadName), undefined, offerPresentationContext(activeTwilioCalls[callSid || '']?.slots || savedLead || {}))"));
  assert.ok(server.includes(': getSystemInstruction(language, gender, persona.name, leadName, voiceName, offerPresentationContext(callFacts))'));
});
