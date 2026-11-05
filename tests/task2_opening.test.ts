import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CallRejectionTracker } from '../src/utils/customerObjection.ts';
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const scenarios: [string, string, string][] = [
  ['friendly customer', 'Yes, go ahead', 'interest'],
  ['unfamiliar with Dubai investment', 'I do not know about Dubai investment', 'none'],
  ['who is calling', 'Who is calling?', 'none'],
  ['busy customer', 'I am busy, call later', 'none'],
  ['Tanglish customer', 'Seri sollunga', 'interest'],
  ['customer interrupts', 'Wait, let me explain', 'none'],
  ['property preference', '2BHK vendam, 3BHK venum', 'none'],
];
for (const [name, text, signal] of scenarios) test(name, () => {
  const result = new CallRejectionTracker().consume(text);
  assert.equal(result.signal, signal);
  assert.equal(result.count, 0);
  assert.equal(result.close, false);
});
test('first, second and third refusals never imply DNC; calls are isolated', () => {
  const tracker = new CallRejectionTracker();
  const first = tracker.consume('Not interested');
  assert.equal(first.clarificationAllowed, true);
  assert.equal(first.close, false);
  tracker.consume('Tell me more');
  const second = tracker.consume('No thanks');
  assert.equal(second.count, 2);
  assert.equal(second.close, true);
  assert.equal(second.clarificationAllowed, false);
  assert.equal(second.dnc, false);
  assert.equal(tracker.consume('Enakku interest illa').count, 3);
  assert.equal(new CallRejectionTracker().count, 0);
});
test('explicit DNC is immediate and cannot be undone by interest', () => {
  for (const phrase of ['Do not call me again', 'Call pannadhinga']) {
    const tracker = new CallRejectionTracker();
    assert.equal(tracker.consume(phrase).dnc, true);
    assert.equal(tracker.consume('Tell me more').close, true);
  }
});
test('angry customer, unfamiliarity and identity have explicit prompt guidance', () => {
  for (const rule of ['Unfamiliar customer:', 'Who is calling:', 'are angry or busy, close instead', 'Wait for explicit consent', 'Dubai properties only']) assert.ok(server.includes(rule), rule);
});
test('interruptions retain browser stop and telephone clear paths', () => {
  assert.ok(server.includes("event: 'clear'"));
  assert.ok(server.includes("type: 'interrupted'"));
  assert.ok(server.includes('When interrupted, stop speaking, listen fully'));
  const audio = fs.readFileSync(new URL('../src/utils/audio.ts', import.meta.url), 'utf8');
  assert.ok(audio.includes('public stopAndClear()'));
  assert.ok(audio.includes('src.stop()'));
});
test('both transports use per-call tracker and ordinary refusal stays COLD', () => {
  assert.ok(server.includes('const phoneRejections = new CallRejectionTracker()'));
  assert.ok(server.includes('const rejectionTracker = new CallRejectionTracker()'));
  assert.ok(!server.includes("recordDoNotCall('customer_declined')"));
  const records = fs.readFileSync(new URL('../callRecords.ts', import.meta.url), 'utf8');
  assert.ok(records.includes("if (reason === 'customer_declined') return 'COLD'"));
});

test('a short no after clarification permission closes, but initial no is ambiguous', () => {
  const tracker = new CallRejectionTracker();
  assert.equal(tracker.consume('No').count, 0);
  tracker.consume('Not interested');
  assert.equal(tracker.consume('No').close, true);
});
