import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerIntelligence } from '../src/components/CustomerIntelligence.tsx';
import { extractCustomerIntelligence, customerFacts } from '../src/utils/customerIntelligence.ts';
import { observeSalesTurn, nextSalesAction } from '../src/utils/salesConversation.ts';
import { mergeSalesLead, splitNotes } from '../src/utils/salesIntelligence.ts';
import { LiveAudioPlayer } from '../src/utils/audio.ts';
import { knownCustomerName, recordOfferDelivery } from '../src/utils/salesIntelligence.ts';

test('friendly permission and busy Tanglish control the actual next action', () => {
  const f = observeSalesTurn({ name: 'Customer', budget: 'INR 3 Crore', timeline: 'within_3_months' }, 'Hello, sollunga.');
  assert.equal(nextSalesAction(f).field, 'name');
  assert.equal(nextSalesAction(observeSalesTurn(f, 'Ippo busy')).stage, 'closing');
  for (const name of ['Customer', 'Lead', 'Prospect']) assert.equal(knownCustomerName(name), undefined);
});
test('Salem multi-fact disclosure extracts INR crore without losing family details', () => {
  const f = observeSalesTurn({}, 'Naan Salem, family-la four members, rendu pasanga, budget 3 crore, 3 BHK venum.');
  assert.equal(f.hometown, 'Salem'); assert.equal(f.family_size, '4');
  assert.equal(f.children_dependants, '2'); assert.equal(f.budget, 'INR 3 crore'); assert.equal(f.bedrooms, '3');
});
test('neutral customer takes core route while interested customer gets deeper discovery', () => {
  const f = { name: 'Anand', hometown: 'Chennai', profession: 'Engineer', property_type: 'apartment', bedrooms: '2', location: 'Dubai Marina', conversation_disposition: 'engaged', investment_purpose: 'investment', budget: 'AED 1M', payment_preference: 'full payment', timeline: 'within_3_months', flight_offer_status: 'presented', golden_visa_offer_status: 'presented', purchase_support_offer_status: 'presented', phone_confirmed: 'confirmed', follow_up_permission: 'granted', preferred_contact_method: 'whatsapp', phone: '+971501234567', trust_building_completed: 'true', family_lifestyle_checked: 'completed' };
  assert.equal(nextSalesAction(f).stage, 'recommendation');
  // Highly interested customer gets deeper qualification (payment preference) before recommendation.
  assert.equal(nextSalesAction({ ...f, payment_preference: undefined, engagement_indicator: 'highly interested' }).field, 'payment_preference');
});
test('offer output evidence never promotes attempted speech to customer acknowledgement', () => {
  const f = recordOfferDelivery({}, 'We offer flight ticket booking support.', false);
  assert.equal(f.flight_offer_delivery, 'attempted'); assert.equal(f.flight_offer_status, undefined);
  const interrupted = recordOfferDelivery(f, 'We offer flight ticket booking support.', true);
  assert.equal(interrupted.flight_offer_delivery, 'interrupted');
});

export const FAMILY_SCENARIO = 'My name is Anand. Naan Salem-la irukken. Enga veetla naalu peru, rendu pasanga irukkaanga. Dubai-ku family-oda settle aaganum. Enakku 3 BHK venum. Budget 1.5 million AED. Installment option irundha nalla irukkum.';
test('mixed Tanglish scenario extracts all volunteered requirements and survives CRM envelope', () => {
  const f = observeSalesTurn({ conversation_disposition: 'engaged' }, FAMILY_SCENARIO);
  for (const [key, value] of Object.entries({ name: 'Anand', hometown: 'Salem', family_size: '4', children_dependants: '2', family_relocation: 'Dubai with family', investment_purpose: 'family residence', bedrooms: '3', budget: 'AED 1.5 million', payment_preference: 'installments' })) assert.equal(f[key], value, key);
  const roundTrip = customerFacts({ ...f, notes: mergeSalesLead({}, f).notes });
  assert.equal(roundTrip.family_size, '4');
  const markup = renderToStaticMarkup(React.createElement(CustomerIntelligence, { data: roundTrip }));
  for (const value of ['Salem', 'Dubai with family', 'AED 1.5 million', 'Installments', 'Not provided']) assert.ok(markup.includes(value), value);
  assert.ok(!markup.includes('[Task 7 sales]'));
});
test('trust objection pauses workflow, preserves facts and resumes on customer topic change', () => {
  let f = observeSalesTurn({ name: 'Anand', hometown: 'Chennai', profession: 'Engineer', property_type: 'apartment', budget: 'AED 1M', timeline: 'within_3_months', conversation_disposition: 'engaged' }, 'Dubai-la eppadi trust panradhu?');
  assert.equal(nextSalesAction(f).stage, 'trust');
  assert.equal(f.engagement_indicator, 'skeptical');
  f = observeSalesTurn(f, 'I want it for investment');
  assert.equal(f.budget, 'AED 1M');
  assert.equal(nextSalesAction(f).stage, 'offers');
});
for (const [text, indicator] of [
  ['Please arrange a viewing', 'highly interested'], ['How does this work?', 'curious'],
  ['Can I trust Lyka?', 'skeptical'], ['My budget is limited', 'budget conscious'],
  ['I am busy', 'busy'], ['I am angry', 'frustrated'], ['Not interested', 'not interested'],
]) test('evidence-based engagement: ' + indicator, () => {
  const f = extractCustomerIntelligence(text);
  assert.equal(f.engagement_indicator, indicator);
  assert.equal(f.engagement_evidence, text);
  assert.equal(f.customer_mood, undefined);
});
test('confirmed family correction replaces earlier value; ambiguous update preserves it', () => {
  const f = observeSalesTurn({ family_size: '4' }, 'Actually family has 5 members');
  assert.equal(f.family_size, '5');
  assert.equal(splitNotes(mergeSalesLead(f, { family_size: '6', family_details_confirmation: 'uncertain' }).notes).sales.family_size, '5');
});
test('old audio onended callbacks cannot change new playback after interruption', () => {
  const sources: any[] = [];
  (globalThis as any).window = { atob: globalThis.atob };
  const ctx: any = { state: 'running', currentTime: 1, destination: {}, createBuffer: (_: number, n: number) => ({ duration: n / 24000, getChannelData: () => new Float32Array(n) }), createBufferSource: () => { const s = { connect() {}, disconnect() {}, start() {}, stop() {}, onended: () => {} }; sources.push(s); return s; } };
  const player: any = new LiveAudioPlayer(); player.ctx = ctx;
  const chunk = Buffer.alloc(4800).toString('base64');
  player.playChunk(chunk); const oldEnded = sources[0].onended;
  player.stopAndClear(); player.playChunk(chunk); oldEnded();
  assert.equal(player.activeSources.length, 1);
  assert.equal(player.diagnostics.queueDepth, 1);
  player.stopAndClear();
});

test('John’s disclosed details reach the existing overview and survive partial updates', () => {
  let facts = observeSalesTurn({ phone: '+919876543210' }, 'Yes');
  assert.equal(nextSalesAction(facts).field, 'name');
  for (const reply of [
    'My name is John.', "I'm from Chennai.", "I'm interested in an apartment in Dubai.",
    'For investment.', 'My budget is around AED 2.2 million.', 'Within six months.',
    'You can use the same number I am calling from.', 'WhatsApp is fine.',
  ]) facts = observeSalesTurn(facts, reply);
  const overview = (data: Record<string, any>) => renderToStaticMarkup(
    React.createElement(CustomerIntelligence, { data }),
  ).split('ci-next')[0];
  const expected = {
    name: 'John', current_location: 'Chennai', investment_purpose: 'investment',
    phone: '+919876543210', location: 'Dubai', property_type: 'Apartment',
    budget: 'AED 2.2 million', timeline: 'Within six months', follow_up_permission: 'WhatsApp',
  };
  const html = overview(facts);
  for (const [field, value] of Object.entries(expected)) {
    assert.equal(html.split(`data-field="${field}"`).length, 2, field);
    assert.ok(html.includes(`data-field="${field}">${value}</dd>`), field);
  }
  facts = observeSalesTurn(facts, 'My alternate number is +971 50 123 4567.');
  for (const phone of ['', '+91 98765', '+91 98765432', '+91 XXXXX 54321']) {
    facts = { ...facts, ...mergeSalesLead(facts, { phone, name: '', location: '' }) };
  }
  assert.equal(facts.phone, '+971501234567');
  assert.equal(facts.name, 'John');
  assert.equal(facts.location, 'Dubai');
  assert.ok(overview({ ...facts, follow_up_permission: 'declined' }).includes('>Do not contact</dd>'));
  assert.equal(observeSalesTurn({}, 'Use the same number I am calling from.').phone, undefined);
  assert.equal(observeSalesTurn(facts, 'The agent quoted around AED 3 million.').budget, facts.budget);
});

test('a current city, hometown and property area can differ', () => {
  let facts = observeSalesTurn({}, "I'm from Chennai and currently looking at apartments.");
  facts = observeSalesTurn(facts, "I'm currently based in London.");
  assert.equal(facts.hometown, 'Chennai');
  assert.equal(facts.current_location, 'London');
  assert.equal(facts.location, undefined);
  const restored = customerFacts({ notes: facts.notes, current_location: '' });
  assert.equal(restored.current_location, 'London');
});
