import {loadCustomerMemory,releaseCustomerMemory} from '../customerMemory.js';
import {getLeadBySession} from '../leadService.js';
import {saveCallDetails} from '../callRecords.js';
import {knowledgeTrace,knowledgeToolResult} from '../backend/services/liveKnowledge.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerIntelligence } from '../src/components/CustomerIntelligence.tsx';
import { observeSalesTurn } from '../src/utils/salesConversation.ts';
import { determineLeadStatusFromData, calculateAuthoritativeLeadScore } from '../src/utils/scoring.ts';
import { normalizeAcquisitionSource } from '../src/utils/acquisitionSource.ts';
import { qualificationWithName, splitNotes } from '../src/utils/salesIntelligence.ts';
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
  new Function('app', 'getPool', 'upsertLead', 'recordsAccess', 'callRecordsRouter', 'determineLeadStatusFromData', 'calculateAuthoritativeLeadScore', 'normalizeAcquisitionSource', 'qualificationWithName', 'splitNotes', js)(app, getPool, upsertLead, recordsAccess, callRecordsRouter, determineLeadStatusFromData, calculateAuthoritativeLeadScore, normalizeAcquisitionSource, qualificationWithName, splitNotes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const conversationId = await createConversation(sessionId, 'voice', 'english');
    assert.ok(conversationId);
    const captured = {
      hometown: 'Salem', family_size: '4', children_dependants: '2', family_relocation: 'Dubai with family', investment_purpose: 'family residence', bedrooms: '3', payment_preference: 'installments', family_details_confirmation: 'confirmed',
      flight_booking_interest: 'interested', accommodation_assistance_interest: 'interested',
      transportation_support_interest: 'interested', golden_visa_assistance_interest: 'interested',
      competitor_details: 'TEST customer quote: Dubai Marina, AED 800000; unverified',
      follow_up_permission: 'granted', agreed_next_action: 'TEST consultation at 7 PM',
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
    const response = await fetch(base + '/api/lead/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, conversationId, leadData: { name: 'Uncertain test transcription', name_confirmation: 'uncertain', budget: 'AED 750000', best_time_to_contact: '7 PM' } }) });
    assert.equal(response.status, 200);
    const data = await (await fetch(base + '/api/leads')).json();
    const lead = data.leads.find((r: any) => r.id === first.leadId);
    assert.ok(lead, 'production Prospect Leads endpoint must include saved lead');
    for (const [key, expected] of Object.entries({ name: 'TEST - Lead Sync Verification', phone: '+999000000001', location: 'OMR, Chennai, India', intent: 'buy', preferred_contact_method: 'WhatsApp', best_time_to_contact: '7 PM', propertyType: 'apartment', budget: '750000.00', currency: 'AED', timeline: 'within_1_month', outcome: 'HOT' })) assert.equal(lead[key], expected, key);
    const sales = lead.intelligence;
    for (const [key, value] of Object.entries({ hometown: 'Salem', family_size: '4', children_dependants: '2', family_relocation: 'Dubai with family', payment_preference: 'installments' })) assert.equal(sales[key], value);
    assert.equal(String(lead.bedrooms), '3');
    assert.equal(sales.flight_booking_interest, 'interested');
    assert.equal(sales.accommodation_assistance_interest, 'interested');
    assert.equal(sales.transportation_support_interest, 'interested');
    assert.equal(sales.golden_visa_assistance_interest, 'interested');
    assert.equal(sales.follow_up_permission, 'granted');
    assert.equal(sales.agreed_next_action, 'TEST consultation at 7 PM');
    assert.ok(sales.competitor_details.includes('unverified'));
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
    const familyFacts = observeSalesTurn({}, 'My name is TEST Human Voice. Naan Salem, family-la four members, rendu pasanga, budget 3 crore, 3 BHK venum.');
    const familySave = await upsertLead('task7-human-family-trace', { ...familyFacts, notes: familyFacts.notes + '\nTEST ONLY. Do not dial.' });
    assert.ok(familySave.success, familySave.error);
    const refreshed = await (await fetch(base + '/api/leads')).json();
    const familyLead = refreshed.leads.find((row: any) => row.id === familySave.leadId);
    assert.equal(familyLead.intelligence.hometown, 'Salem');
    assert.equal(familyLead.intelligence.family_size, '4');
    assert.equal(familyLead.intelligence.children_dependants, '2');
    assert.equal(Number(familyLead.budget), 30000000);
    assert.equal(familyLead.currency, 'INR');
    assert.equal(String(familyLead.bedrooms), '3');
    const rendered = renderToStaticMarkup(React.createElement(CustomerIntelligence, { data: familyLead }));
    assert.ok(rendered.includes('Salem')); assert.ok(rendered.includes('3 BHK'));
    assert.ok(rendered.includes('Family members'));
    const memorySession='task6-memory-trace-'+Date.now();
    const memoryCall=await createConversation(memorySession,'voice','bilingual');
    const evidence=knowledgeTrace('retrieve_dubai_knowledge',{},knowledgeToolResult('retrieve_dubai_knowledge',{query:'title deed'}));
    const quote={competitor_name:'TEST company',competitor_quote:'AED 900000',competitor_verification:'customer_provided_unverified'};
    const initialMemory=await upsertLead(memorySession,{name:'TEST Memory Arun',phone:'+999000000068',budget:'AED 1500000',family_size:'4',family_details_confirmation:'confirmed',declined_fields:'profession',...quote,...evidence} as any,memoryCall!);
    assert.ok(initialMemory.success,initialMemory.error);
    await saveCallDetails(memoryCall!,{notes:'TEST ONLY. Customer discussed a family home and requested document verification.'});
    await getPool().query('UPDATE conversations SET ended_at=CURRENT_TIMESTAMP WHERE id=?',[memoryCall]);
    const found=await getLeadBySession('task6-returning-call','+999000000068');assert.equal(found.id,initialMemory.leadId);
    const candidate=await loadCustomerMemory(found);assert.equal(candidate?.family_size,'4');assert.match(candidate?.previous_call_memory||'',/document verification/);
    const blocked=await upsertLead('task6-unconfirmed',{phone:'+999000000068',budget:'AED 1',memory_identity_pending:'pending'} as any);
    assert.equal(blocked.success,false);
    const released=releaseCustomerMemory({budget:'AED 1700000'},candidate,true);
    const corrected=await upsertLead('task6-returning-call',{...released.facts,phone:'+999000000068'});assert.equal(corrected.leadId,initialMemory.leadId);
    const afterMemory=await (await fetch(base+'/api/leads')).json();
    const memoryLead=afterMemory.leads.find((r:any)=>r.id===initialMemory.leadId);
    assert.equal(Number(memoryLead.budget),1700000);assert.equal(memoryLead.intelligence.competitor_quote,'AED 900000');
    assert.equal(memoryLead.intelligence.declined_fields,'profession');
    assert.ok(JSON.parse(memoryLead.intelligence.fact_provenance).budget.recordedAt);
    const memoryMarkup=renderToStaticMarkup(React.createElement(CustomerIntelligence,{data:memoryLead}));
    assert.match(memoryMarkup,/document verification/);assert.match(memoryMarkup,/AED 900000/);assert.match(memoryMarkup,/Knowledge evidence/);
    console.log('PASS: cross-call lookup -> withheld memory -> identity confirmation -> correction -> same CRM lead -> production API -> rendered memory, quote and sources');
    console.log('PASS: Tanglish -> call state -> MySQL -> refreshed production API -> rendered customer panel; retained test lead', familySave.leadId);

  } finally { server.close(); await getPool().end(); }
}
