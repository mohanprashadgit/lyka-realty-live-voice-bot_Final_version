import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {knowledgeTools} from '../backend/services/liveKnowledge.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {retrieveKnowledge,approvedKnowledge,compareTransactions,knowledgeToolResult,knowledgeTrace, type Transaction} from '../backend/services/liveKnowledge.js';
import {resolveMemoryCandidate,releaseCustomerMemory} from '../customerMemory.js';
import {startSalesCall,nextSalesAction,observeSalesTurn} from '../src/utils/salesConversation.js';
import {mergeSalesLead,splitNotes} from '../src/utils/salesIntelligence.js';
import {CustomerIntelligence} from '../src/components/CustomerIntelligence.js';
const now=new Date('2026-11-06T12:00:00Z');
for(const q of ['ownership freehold','title deed','off-plan escrow','developer registration','handover delay refund','registration fees','mortgage','Golden Visa','rental yield','service charges','inheritance','tenancy','Madurai','Salem','Nagercoil','Tirunelveli','Arjan','Dubai South','Dubai Creek Harbour']) test('retrieval: '+q,()=>{
 const r=retrieveKnowledge(q,now);assert.equal(r.status,'retrieved');assert.ok(r.evidence.length<=4);assert.ok(r.evidence.every(e=>e.source&&e.verifiedAt&&e.limitations));
});
test('unknown query and stale legal rules provide no claim',()=>{
 assert.equal(retrieveKnowledge('unknown xyz town',now).status,'no_evidence');
 const r=retrieveKnowledge('title deed',new Date('2027-11-06'));assert.equal(r.status,'revalidation_required');assert.equal(r.evidence.length,0);
});
test('separate visa authority records remain separate evidence',()=>{
 const r=retrieveKnowledge('golden visa eligibility',now);assert.ok(r.evidence.some(e=>e.id==='visa-dld'));assert.ok(r.evidence.some(e=>e.id==='visa-gdrfa'));assert.ok(r.evidence.some(e=>e.id==='visa-icp'));
});
test('retrieval failure does not fabricate a response',()=>assert.equal(knowledgeToolResult('retrieve_dubai_knowledge',{query:'escrow'},{retrieve:()=>{throw Error('offline')},transactions:()=>[]})?.status,'retrieval_failed'));
const quote={location:'Dubai Marina',project:'TEST',propertyType:'apartment',bedrooms:2,area:1000,areaUnit:'sqft',areaBasis:'built_up',currency:'AED',status:'ready',price:900000};
const rows:Transaction[]=[900000,1000000,1100000].map((price,i)=>({id:String(i),kind:'registered_sale',source:'https://dubailand.gov.ae/en/open-data/real-estate-data/',verifiedAt:'2026-11-01',date:'2026-10-01',location:'Dubai Marina',project:'TEST',propertyType:'apartment',bedrooms:2,area:1000,areaUnit:'sqft',areaBasis:'built_up',price,currency:'AED',status:'ready'}));
test('historical comparison calculates sample, median and period',()=>{const r:any=compareTransactions(quote,rows,now);assert.equal(r.status,'historical_comparison');assert.equal(r.median,1000);assert.equal(r.sampleSize,3);assert.equal(r.quoteVerification,'customer_provided_unverified');});
for(const [label,patch] of Object.entries({land:{propertyType:'land',areaBasis:'plot'},currency:{currency:'INR'},period:{date:'2024-01-01'},stale:{verifiedAt:'2024-01-01'},listing:{kind:'asking_price'},fakeSource:{source:'https://example.com/'},units:{areaUnit:'acre'},infinite:{price:Infinity},size:{area:400},bedrooms:{bedrooms:3},handover:{status:'off_plan'}})) test('rejects incomparable '+label,()=>assert.equal(compareTransactions(quote,rows.map(r=>({...r,...patch})) as Transaction[],now).status,'insufficient_comparables'));
test('sqm converted explicitly, duplicate records never inflate sample',()=>{
 assert.equal(compareTransactions({...quote,area:1000/10.7639104167,areaUnit:'sqm'},rows,now).status,'historical_comparison');
 assert.equal(compareTransactions(quote,[rows[0],rows[0],rows[0]],now).status,'insufficient_comparables');
 assert.equal(compareTransactions({price:900000,currency:'AED'},rows,now).status,'insufficient_details');
 assert.equal(knowledgeToolResult('compare_competitor_quote',quote)?.status,'insufficient_comparables');
});
const old={id:'one',guest_session_id:'old',phone:'+919999999991',name:'Arun',budget:'AED 1500000',family_size:'4',investment_purpose:'own use',declined_fields:'profession',customer_objections:'Developer concern'};
test('identity candidates do not merge names, shared phones or conflicting session phones',()=>{
 assert.equal(resolveMemoryCandidate([old],'new','+919999999991')?.id,'one');assert.equal(resolveMemoryCandidate([old,{...old,id:'two'}],'new','+919999999991'),null);
 assert.equal(resolveMemoryCandidate([old],'old','+919999999992'),null);assert.equal(resolveMemoryCandidate([old],'new',''),null);
});
test('new call permission, identity gate, correction and declined facts survive memory',()=>{
 const pending={name:'Arun',memory_identity_pending:'pending'};assert.equal(nextSalesAction(pending).stage,'opening');assert.equal(nextSalesAction({...pending,conversation_disposition:'engaged'}).stage,'identity');
 const restored=releaseCustomerMemory({...pending,budget:'AED 1700000'},old,true);assert.equal(restored.released,true);assert.equal(restored.facts.budget,'AED 1700000');assert.equal(restored.facts.family_size,'4');assert.equal(restored.facts.declined_fields,'profession');assert.notEqual(nextSalesAction(restored.facts).field,'name');assert.notEqual(nextSalesAction(restored.facts).field,'budget');
 assert.equal(nextSalesAction(startSalesCall(restored.facts)).stage,'opening');
 assert.equal(releaseCustomerMemory(pending,old,false).facts.family_size,undefined);assert.equal(releaseCustomerMemory(pending,{...old,qualification_status:'OPT_OUT'},true).released,false);
});
test('competitor discovery asks one next missing field, then resumes original plan',()=>{
 let f:any=observeSalesTurn({name:'Arun',hometown:'Chennai',budget:'AED 1500000',bedrooms:'3',conversation_disposition:'engaged'},'Another realtor quotes AED 900000 for 2 BHK');assert.equal(nextSalesAction(f).field,'competitor_name');assert.equal(f.budget,'AED 1500000');assert.equal(f.competitor_quote,'AED 900000');assert.equal(f.bedrooms,'3');
 f={...f,...mergeSalesLead(f,{competitor_name:'TEST agent'})};assert.equal(nextSalesAction(f).field,'competitor_project');
 f=observeSalesTurn(f,'Forget that, back to my requirements');assert.equal(nextSalesAction(f).field,'investment_purpose');
 assert.equal(nextSalesAction(observeSalesTurn(f,'I am busy')).stage,'closing');
});
test('quote and evidence survive notes and render readable CRM sections',()=>{
 const result=compareTransactions(quote,[],now);const trace=knowledgeTrace('compare_competitor_quote',quote,result);
 const merged=mergeSalesLead({}, {...trace,previous_call_memory:'Previous call: family home',legal_concern:'Title deed',...knowledgeTrace('retrieve_dubai_knowledge',{},retrieveKnowledge('title deed',now))});
 const markup=renderToStaticMarkup(React.createElement(CustomerIntelligence,{data:{intelligence:splitNotes(merged.notes).sales}}));
 assert.match(markup,/AED 900000/);assert.match(markup,/Previous call: family home/);assert.match(markup,/insufficient comparables/);assert.match(markup,/https:\/\/dubailand/);assert.ok(!markup.includes('&quot;status&quot;'));
});

for(const transport of ['browser','phone']) test('actual '+transport+' knowledge tool branch returns evidence without client generation',()=>{
 const src=fs.readFileSync('server.ts','utf8');
 const start=transport==='phone'?src.indexOf('if (knowledgeTools.functionDeclarations!.some'):src.lastIndexOf('if (knowledgeTools.functionDeclarations!.some');
 const end=src.indexOf("} else if (call.name === 'update_lead_info'",start);
 const block=stripTypeScriptTypes(src.slice(start,end)+'}');
 const replies:any[]=[],writes:any[]=[];
 const session={sendToolResponse:(r:any)=>replies.push(r),sendClientContent:()=>{throw Error('unexpected generation trigger')}};
 const run=new Function('knowledgeTools','knowledgeToolResult','knowledgeTrace','releaseCustomerMemory','mergeSalesLead','responseSession','liveSession','nextSalesAction','upsertLead',`
   const call={id:'evidence-1',name:'retrieve_dubai_knowledge',args:{query:'title deed'}};
   let callFacts={}, pendingCustomerMemory=null, pendingPhoneMemory=null;
   const callSid='test',activeTwilioCalls={test:{slots:{}}},journal=null,wsSessionId='test',wsConversationId='',wsLeadPhone='';
   const safeSend=()=>{};
   ${block}
   return {browser:callFacts,phone:activeTwilioCalls.test.slots};
 `);
 const state=run(knowledgeTools,knowledgeToolResult,knowledgeTrace,releaseCustomerMemory,mergeSalesLead,session,session,nextSalesAction,async(...args:any[])=>{writes.push(args);return {success:true}});
 assert.equal(replies.length,1);assert.equal(replies[0].functionResponses[0].id,'evidence-1');assert.equal(replies[0].functionResponses[0].response.output.status,'retrieved');
 assert.ok(state[transport].knowledge_sources.includes('dubailand.gov.ae'));
});
test('new call clears attempted transport delivery but keeps acknowledged offers',()=>{
 const f=startSalesCall(mergeSalesLead({},{flight_offer_delivery:'attempted',golden_visa_offer_status:'understood'}));
 assert.equal(f.flight_offer_delivery,undefined);assert.equal(f.golden_visa_offer_status,'understood');
});
