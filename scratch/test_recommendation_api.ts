/**
 * test_recommendation_api.ts — Integration tests for Recommendation REST Endpoints
 */
const BASE_URL = 'http://127.0.0.1:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== INTEGRATION TEST SUITE: /api/crm/matching/* Endpoints ===\n');

  // 1. Core Recommendation: 2 BHK apartment under 70L near metro in Chennai
  console.log('1. POST /api/crm/matching/recommend (2 BHK in Chennai < 70L, near metro)');
  let recId = '';
  let topPropId = '';
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session-rec-1',
        original_message: 'I need a 2 BHK flat in Chennai under 70 lakhs, near a metro station, with a good locality.',
        requirements: {
          property_type: 'apartment',
          bedrooms: 2,
          location: 'Chennai',
          locality: 'OMR',
          budget_max: 7000000,
          near_metro: true,
          locality_preference: 'good',
        },
        limit: 5,
        persist: true,
      }),
    });

    assert(res.status === 200, `Status is 200: ${res.status}`);
    const data: any = await res.json();
    assert(data.success === true, 'Response success is true');
    assert(data.results && data.results.length > 0, `Returned ${data.results.length} recommendations`);
    assert(!data.unmatched, 'Not marked as unmatched');
    recId = data.recommendation_id;
    assert(recId.startsWith('REC-'), `Generated valid recommendation ID: ${recId}`);

    const top = data.results[0];
    topPropId = top.property_id;
    assert(top.property_id === 'PROP-OMR-2BHK', `Top match is PROP-OMR-2BHK: ${top.property_id}`);
    assert(top.final_score >= 90, `Top match score is ${top.final_score}% (>= 90%)`);
    assert(top.match_category === 'Excellent Match', `Match category: ${top.match_category}`);
    assert(top.why_it_matches.length > 0, `Why it matches: ${top.why_it_matches.join('; ')}`);
    assert(top.criteria.length === 6, `Returned full 6 criteria breakdown`);
  }

  // 2. Strict Budget Exclusion
  console.log('\n2. POST /api/crm/matching/recommend with Strict Budget');
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session-strict',
        requirements: {
          property_type: 'apartment',
          budget_max: 6000000, // 60L limit
          strict_budget: true, // Should exclude 65L OMR flat
        },
        persist: false,
      }),
    });

    const data: any = await res.json();
    assert(data.success === true, 'Response success is true');
    const hasOverBudget = data.results.some((p: any) => p.price > 6000000);
    assert(!hasOverBudget, 'No properties priced over ₹60L returned under strict budget');
  }

  // 3. Save Interested Property
  console.log('\n3. POST /api/crm/matching/interest');
  let interestId = '';
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: topPropId,
        recommendation_id: recId,
        customer_id: 'cust-demo-1',
        notes: 'Interested in Prestige Courtyard 2BHK flat',
      }),
    });

    assert(res.status === 200, `Status is 200: ${res.status}`);
    const data: any = await res.json();
    assert(data.success === true, 'Interest recorded successfully');
    interestId = data.id;
    assert(interestId.startsWith('INT-'), `Generated interest ID: ${interestId}`);
  }

  // 4. Schedule Site Visit from Recommendation
  console.log('\n4. POST /api/crm/matching/site-visit');
  let visitId = '';
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/site-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: topPropId,
        customer_id: 'cust-demo-1',
        visit_date: '2026-10-18',
        visit_time: '11:00 AM',
        notes: 'Client requested weekend morning visit with family.',
      }),
    });

    assert(res.status === 201, `Status is 201: ${res.status}`);
    const data: any = await res.json();
    assert(data.success === true, 'Site visit scheduled');
    visitId = data.id;
    assert(visitId.startsWith('VISIT-'), `Generated visit ID: ${visitId}`);
  }

  // 5. Record Customer Feedback
  console.log('\n5. POST /api/crm/matching/feedback');
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recommendation_id: recId,
        feedback: 'schedule_visit',
        selected_property_id: topPropId,
        notes: 'Customer confirmed preferred slot on Sunday',
      }),
    });

    assert(res.status === 200, `Status is 200: ${res.status}`);
    const data: any = await res.json();
    assert(data.success === true, 'Feedback recorded');
  }

  // 6. Recommendation History
  console.log('\n6. GET /api/crm/matching/history');
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/history?session_id=test-session-rec-1`);
    assert(res.status === 200, `Status is 200: ${res.status}`);
    const data: any = await res.json();
    assert(data.success === true, 'Fetched history successfully');
    assert(data.data.length >= 1, `Found ${data.data.length} recommendation records for session`);
    assert(data.data[0].id === recId, `Record ID matches ${recId}`);
    assert(data.data[0].customer_feedback === 'schedule_visit', `Status reflects feedback: ${data.data[0].customer_feedback}`);
  }

  // 7. Unmatched Request Handling
  console.log('\n7. POST /api/crm/matching/recommend (Unmatched Search)');
  {
    const res = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-unmatched-session',
        requirements: {
          property_type: 'villa',
          location: 'Coimbatore', // No listings in Coimbatore in Chennai database
          budget_max: 2000000,
        },
        persist: true,
      }),
    });

    assert(res.status === 200, `Status is 200: ${res.status}`);
    const data: any = await res.json();
    assert(data.unmatched === true, 'Marked as unmatched');
    assert(data.unmatched_reason !== null, `Unmatched reason provided: ${data.unmatched_reason}`);

    // Check unmatched queue as Admin
    const unmatchRes = await fetch(`${BASE_URL}/api/crm/matching/unmatched`, {
      headers: { 'x-user-role': 'Super Admin' },
    });
    const unmatchData: any = await unmatchRes.json();
    assert(unmatchData.success === true, 'Fetched unmatched queue as Admin');
    assert(unmatchData.data.some((r: any) => r.session_id === 'test-unmatched-session'), 'Unmatched record visible in sales review queue');
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
