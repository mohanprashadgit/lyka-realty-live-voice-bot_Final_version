import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import express from 'express';
import dotenv from 'dotenv';
import { getPool } from '../db.js';
import { createConversation, upsertLead } from '../leadService.js';
import { callRecordsRouter, CallJournal, readCalls, recordsAccess, callOutcome, ensureCallRecords } from '../callRecords.js';
dotenv.config({ quiet: true });

if (process.argv.includes('--restart')) {
  const id = process.argv.at(-1)!;
  const call = (await readCalls(id))[0];
  assert.equal(call.summary, 'TEST: customer requests an OMR apartment.');
  assert.deepEqual(call.transcript.map((t: any) => t.text), ['I want an OMR apartment.', 'What is your budget?', '75 lakh.']);
  await getPool().end(); console.log('PASS: call summary and transcript survive a fresh process');
} else {
  await ensureCallRecords();
  const app = express(); app.use(express.json()); app.use('/api', callRecordsRouter);
  const source = fs.readFileSync('server.ts', 'utf8');
  const start = source.indexOf("app.get('/api/leads'");
  const end = source.indexOf("app.use('/api', callRecordsRouter)", start);
  new Function('app', 'getPool', 'recordsAccess', stripTypeScriptTypes(source.slice(start, end)))(app, getPool, recordsAccess);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (path: string, body?: any, headers?: Record<string, string>) => fetch(base + path, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  const makeCall = async (session: string, leadName: string) => {
    const id = (await createConversation(session, 'voice', 'english'))!;
    const result = await upsertLead(session, { name: leadName, notes: 'TEST fixture - do not dial.' }, id);
    assert.ok(result.success, result.error);
    return { id, leadId: result.leadId };
  };
  try {
    const a = await makeCall(randomUUID(), 'TEST Records Customer A');
    const b = await makeCall(randomUUID(), 'TEST Records Customer B');
    const failures: unknown[] = [];
    const journal = new CallJournal(a.id, err => failures.push(err));
    journal.turn('user', 'I want', 'customer-1');
    journal.turn('user', 'I want an OMR apartment.', 'customer-1');
    journal.turn('assistant', 'What is your budget?', 'agent-1');
    journal.turn('user', '75 lakh.', 'customer-2');
    journal.turn('assistant', 'What is your budget?', 'agent-1'); // final/retry of same turn
    journal.details({ name: 'TEST Records Customer A', notes: 'TEST: customer requests an OMR apartment.', qualification_status: 'HOT' });
    await journal.drain(); assert.equal(failures.length, 0);
    const other = new CallJournal(b.id, err => failures.push(err));
    other.turn('user', 'Tell me a joke.', 'b1');
    other.turn('assistant', 'I can help with property enquiries.', 'b2');
    other.details({ name: 'TEST Records Customer B', notes: 'TEST: call ended after repeated unrelated requests.' }, 'unwanted_speech');
    other.details({ qualification_status: 'HOT' }); // late extraction must not erase the termination reason
    await other.drain(); assert.equal(failures.length, 0);
    await getPool().query('UPDATE conversations SET ended_at = CURRENT_TIMESTAMP WHERE id IN (?)', [[a.id, b.id]]);
    const call = (await (await request(`/api/calls/${a.id}`)).json()).call;
    assert.equal(call.leadId, a.leadId); assert.equal(call.transcript.length, 3);
    assert.deepEqual(call.transcript.map((t: any) => t.role), ['user', 'agent', 'user']);
    assert.ok(call.transcript.every((t: any) => !Number.isNaN(Date.parse(t.timestamp))));
    assert.equal(call.summary, 'TEST: customer requests an OMR apartment.');
    await getPool().query('UPDATE leads SET notes = ? WHERE id = ?', ['TEST: later unrelated lead summary', a.leadId]);
    assert.equal((await readCalls(a.id))[0].summary, call.summary);
    assert.equal((await readCalls(b.id))[0].outcome, 'UNWANTED');
    const leadList = await (await request('/api/leads')).json();
    assert.equal(leadList.leads.find((l: any) => l.id === b.leadId).outcome, 'UNWANTED');
    assert.equal(callOutcome(undefined, 'UNWANTED'), 'PENDING');
    assert.equal(callOutcome('completed', 'HOT'), 'HOT');
    const detectorStart = source.indexOf('const UNWANTED_SPEECH_PATTERNS');
    const detectorEnd = source.indexOf('function getAgentPersona', detectorStart);
    const detect = new Function(stripTypeScriptTypes(source.slice(detectorStart, detectorEnd)) + '\nreturn detectUnwantedSpeech;')();
    for (const text of ['I love this property.', 'What is your WhatsApp number?', 'Share your office contact number.', 'I want to buy an apartment.']) assert.equal(detect(text), false, text);
    for (const text of ['Tell me a joke.', 'Will you marry me?']) assert.equal(detect(text), true, text);
    assert.equal((await request('/api/calls', undefined, { Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await request('/api/calls', undefined, { 'X-Forwarded-For': '203.0.113.2' })).status, 401);
    assert.equal((await request('/api/records/delete', { kind: 'calls', ids: [a.id], confirmed: false })).status, 400);
    assert.equal((await request('/api/records/delete', { kind: 'calls', ids: ["' OR 1=1"], confirmed: true })).status, 400);
    assert.equal((await request('/api/records/delete', { kind: 'leads', ids: [a.leadId], confirmed: true })).status, 200);
    assert.ok(!(await (await request('/api/leads')).json()).leads.some((l: any) => l.id === a.leadId));
    assert.equal((await request(`/api/calls/${a.id}`)).status, 200, 'lead deletion preserves calls');
    const c = await makeCall(randomUUID(), 'TEST Records Delete Selection');
    const d = await makeCall(randomUUID(), 'TEST Records Delete Selection 2');
    assert.equal((await request('/api/records/delete', { kind: 'leads', ids: [c.leadId], confirmed: true, includeCalls: true })).status, 409, 'active call protects entire transaction');
    const [tombstones]: any = await getPool().query('SELECT lead_id FROM voice_record_deletions WHERE lead_id = ?', [c.leadId]);
    assert.equal(tombstones.length, 0);
    await getPool().query('UPDATE conversations SET ended_at = CURRENT_TIMESTAMP WHERE id IN (?)', [[c.id, d.id]]);
    assert.equal((await request('/api/records/delete', { kind: 'calls', ids: [c.id, d.id], confirmed: true })).status, 200);
    assert.equal((await request(`/api/calls/${c.id}`)).status, 404);
    const [retained]: any = await getPool().query('SELECT id FROM conversations WHERE id IN (?)', [[c.id, d.id]]);
    assert.equal(retained.length, 2, 'soft delete never erases stored calls');
    assert.equal((await request('/api/records/delete', { kind: 'leads', ids: [c.leadId, d.leadId], confirmed: true, includeCalls: true })).status, 200);
    const restarted = spawnSync(process.execPath, ['--import', 'tsx', 'tests/call-records.integration.ts', '--restart', a.id], { encoding: 'utf8' });
    assert.equal(restarted.status, 0, restarted.stderr); console.log(restarted.stdout.trim());
    fs.writeFileSync('scratch/call-records-test-ids.json', JSON.stringify({ a, b, c, d }));
    console.log('PASS: real DB View isolation/order/timestamps, per-call summaries, UNWANTED, authorization, confirmation, bulk soft deletion, call preservation and restart');
  } finally { server.close(); await getPool().end(); }
}
