// Explicit integration test: retains a clearly labelled test lead; never deletes records.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import { stripTypeScriptTypes } from 'node:module';
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { getPool } from '../db.js';
import { createConversation, upsertLead, saveMessage } from '../leadService.js';
import { normalizeLeadFields } from '../src/utils/leadFields.js';
import { recordsAccess, callRecordsRouter } from '../callRecords.js';
dotenv.config({ quiet: true });
const sessionId = 'lyka-lead-sync-integration-v1';
if (process.argv.includes('--verify-restart')) {
  const [rows]: any = await getPool().query('SELECT id FROM leads WHERE guest_session_id = ?', [sessionId]);
  assert.equal(rows.length, 1);
  await getPool().end();
  console.log('PASS: saved lead recovered in a fresh Node process');
} else {
  // Mount the actual production routes without booting voice services or schema seeds.
  const source = fs.readFileSync('server.ts', 'utf8');
  const start = source.indexOf("app.post('/api/lead/save'");
  const end = source.indexOf('// Push project to GitHub', start);
  const js = stripTypeScriptTypes(source.slice(start, end));
  const app = express(); app.use(express.json());
  new Function('app', 'getPool', 'upsertLead', 'recordsAccess', 'callRecordsRouter', js)(app, getPool, upsertLead, recordsAccess, callRecordsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const conversationId = await createConversation(sessionId, 'voice', 'english');
    assert.ok(conversationId);
    const captured = {
      name: { value: 'TEST - Lead Sync Verification' }, phone: { value: '+999000000001' },
      location: 'OMR, Chennai, India', intent: 'buy', preferred_contact_method: 'WhatsApp',
      best_time_to_contact: 'Weekdays after 6 PM', property_type: 'apartment',
      budget: 'INR 75,00,000', timeline: 'within_3_months', qualification_status: 'HOT',
      notes: 'Explicit integration-test record. Not a real prospect; do not dial.',
    };
    // Same service and payload used by update_lead_info in the live voice handler.
    const first = await upsertLead(sessionId, captured as any, conversationId!);
    assert.equal(first.success, true, first.error);
    await saveMessage(conversationId!, 'user', 'TEST conversation: I want to buy an apartment in OMR for INR 75 lakh. Contact me on WhatsApp after 6 PM.', 'voice', 'test-customer-turn');
    const writes = await Promise.all(Array.from({ length: 3 }, () => upsertLead(sessionId, { name: '', phone: '', qualification_status: 'invalid', timeline: 'within_1_month' }, conversationId!)));
    assert.ok(writes.every(r => r.success && r.leadId === first.leadId));
    const response = await fetch(base + '/api/lead/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, conversationId, leadData: { budget: 'AED 750000', best_time_to_contact: '7 PM' } }) });
    assert.equal(response.status, 200);
    const data = await (await fetch(base + '/api/leads')).json();
    const lead = data.leads.find((r: any) => r.id === first.leadId);
    assert.ok(lead, 'production Prospect Leads endpoint must include saved lead');
    for (const [key, expected] of Object.entries({ name: 'TEST - Lead Sync Verification', phone: '+999000000001', location: 'OMR, Chennai, India', intent: 'buy', preferred_contact_method: 'WhatsApp', best_time_to_contact: '7 PM', propertyType: 'apartment', budget: '750000.00', currency: 'AED', timeline: 'within_1_month', outcome: 'HOT' })) assert.equal(lead[key], expected, key);
    const history = await (await fetch(base + '/api/calls')).json();
    const call = history.calls.find((c: any) => c.callId === conversationId);
    assert.equal(call.leadId, first.leadId);
    assert.ok(call.transcript.some((t: any) => t.text.startsWith('TEST conversation')));
    assert.deepEqual(normalizeLeadFields({ name: { value: '' }, phone: null, qualification_status: 'invalid' }), {});
    const restarted = spawnSync(process.execPath, ['--import', 'tsx', 'tests/lead-sync.integration.ts', '--verify-restart'], { encoding: 'utf8' });
    assert.equal(restarted.status, 0, restarted.stderr);
    console.log(restarted.stdout.trim());
    console.log('PASS: actual MySQL writes, concurrent updates, empty-field protection, all field mappings, production HTTP routes, and call association');
    console.log('Retained test lead:', first.leadId);
  } finally { server.close(); await getPool().end(); }
}
