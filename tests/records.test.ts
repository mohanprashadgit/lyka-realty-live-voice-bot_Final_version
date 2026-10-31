import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPool } from '../db.js';
import { createConversation, saveMessage, upsertLead } from '../leadService.js';
import { getLeads, saveLead, importLeads, deleteLead } from '../src/storage/leads.ts';
import { getCalls, saveCall } from '../src/storage/calls.ts';

test('browser records survive module reload; imports and retries preserve identity', async () => {
  const disk = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => disk.set(k, v),
    removeItem: (k: string) => disk.delete(k),
  }, configurable: true });
  assert.deepEqual(getLeads(), []);
  const lead: any = { id: 'a', phone: '+91 12345 67890', name: 'Test', createdAt: '2026-01-01', callStatus: 'NOT_CALLED' };
  saveLead(lead);
  saveLead({ ...lead, id: 'b', phone: '911234567890', name: 'Updated' });
  assert.equal(getLeads().length, 1);
  assert.equal(getLeads()[0].id, 'a');
  assert.equal(importLeads([{ phone: '+91 (12345) 67890' }]).added, 0);
  const call: any = { callId: 'call-a', leadId: 'a', transcript: [{ role: 'user', text: 'Hello' }] };
  saveCall(call); saveCall(call);
  assert.equal(getCalls().length, 1);
  const reloadPath = '../src/storage/calls.ts?restart';
  const reloaded = await import(reloadPath);
  assert.deepEqual(reloaded.getCalls(), [call]);
  deleteLead('a');
  assert.deepEqual(getLeads(), []);
});

test('database adapters reuse call/message IDs and link an existing lead', async () => {
  // Isolated query double: never writes to the configured database.
  const pool: any = getPool();
  const originalQuery = pool.query;
  const originalConnection = pool.getConnection;
  const conversations = new Map();
  const messages = new Map();
  const writes: any[] = [];
  let released = false;
  let committed = false;
  const query = async (sql: string, values: any[] = []) => {
    writes.push([sql, values]);
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
    if (sql.startsWith('SELECT id FROM leads')) return [[{ id: 'existing-contact' }]];
    if (sql.startsWith('SELECT id FROM conversations')) return [[...conversations.values()].filter((c: any) => c.session === values[0])];
    if (sql.startsWith('INSERT INTO conversations')) conversations.set(values[0], { id: values[0], session: values[2] });
    if (sql.startsWith('INSERT INTO conversation_messages')) messages.set(values[0], values);
    return [[]];
  };
  pool.query = query;
  pool.getConnection = async () => ({ query, beginTransaction: async () => {}, commit: async () => { committed = true; }, rollback: async () => {}, release: () => { released = true; } });
  try {
    const ids = await Promise.all([createConversation('session-a', 'voice', 'tamil'), createConversation('session-a', 'voice', 'tamil')]);
    assert.equal(ids[0], ids[1]);
    assert.equal(conversations.size, 1);
    await saveMessage(ids[0]!, 'user', 'வணக்கம்', 'voice:000000001', 'turn-a');
    await saveMessage(ids[0]!, 'user', 'வணக்கம்', 'voice:000000001', 'turn-a');
    await saveMessage(ids[0]!, 'user', 'வணக்கம்', 'voice:000000002', 'turn-b');
    assert.equal(messages.size, 2, 'retry deduplicates; legitimate repeated speech stays');
    const lead = await upsertLead('session-b', { phone: '+91 12345 67890', name: 'Test' }, ids[0]!);
    assert.equal(lead.leadId, 'existing-contact');
    assert.ok(writes.some(([sql]) => sql.startsWith('UPDATE conversations SET lead_id')));
    assert.ok(committed && released);
    assert.ok(writes.some(([sql]) => sql.includes('RELEASE_LOCK')));
  } finally {
    pool.query = originalQuery; pool.getConnection = originalConnection;
    await pool.end();
  }
});

test('transcript fragments preserve words, scripts, punctuation and repeated sentences', () => {
  const source = fs.readFileSync('server.ts', 'utf8');
  const body = source.match(/function appendTranscriptChunk\(acc: string, chunk: string\): string \{([\s\S]*?)\n\}/)![1];
  const append = new Function('acc', 'chunk', body);
  assert.equal(['Van', 'akkam', ' sir', '!'].reduce((a, b) => append(a, b), ''), 'Vanakkam sir!');
  assert.equal(['வண', 'க்கம்', '!', ' Yes.', ' Yes.'].reduce((a, b) => append(a, b), ''), 'வணக்கம்! Yes. Yes.');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.ok(!app.includes('uniqueSentences'));
  assert.ok(!app.includes("msg.type === 'user_transcript_normalized'"));
});

test('voice models, connection configs and audio transport remain unchanged', () => {
  const before = fs.readFileSync('scratch/before-record-fixes/server.ts.bak', 'utf8');
  const after = fs.readFileSync('server.ts', 'utf8');
  const configs = (s: string) => [...s.matchAll(/ai\.live\.connect\(\{([\s\S]*?)callbacks:/g)].map(m => m[1].replace(/\s/g, ''));
  assert.deepEqual(configs(after), configs(before));
  const realtime = (s: string) => [...s.matchAll(/liveSession\.sendRealtimeInput\(\{([\s\S]*?)\}\s*(?:as any)?\);/g)].map(m => m[1].replace(/\s/g, ''));
  assert.deepEqual(realtime(after), realtime(before));
});
