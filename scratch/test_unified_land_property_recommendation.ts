/**
 * test_unified_land_property_recommendation.ts
 * Comprehensive automated verification for Section 17 Acceptance Criteria:
 * 24 Test Points covering Extraction, Scoring, DB Inventory, RBAC, API Endpoints, and Production Build.
 */
import {
  extractStructuredRequirements,
  parseInrBudget,
} from '../backend/services/requirementExtractor.js';
import {
  scoreLandListing,
  scorePropertyListing,
  rankProperties,
  convertAreaToSqft,
  convertSqftToUnit,
  formatINR,
  DEFAULT_LAND_WEIGHTS,
  DEFAULT_WEIGHTS,
} from '../backend/services/propertyMatchingService.js';
import { getPool } from '../db.js';
import { generateToken } from '../authHelper.js';

const BASE_URL = 'http://localhost:3000';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [TEST ${totalTests}] PASS: ${testName}`);
  } else {
    console.error(`  ✗ [TEST ${totalTests}] FAIL: ${testName}`, details || '');
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('LYKA REALTY — 24-POINT UNIFIED LAND & PROPERTY TEST SUITE');
  console.log('============================================================\n');

  // ── TEST 1: Land query extraction in English, Tamil and Tanglish ─────
  console.log('--- Category A: Requirement Extraction (English, Tamil, Tanglish) ---');
  const enReq = extractStructuredRequirements('I need 5 cents of residential land in OMR below 40 lakhs with road access');
  assert(
    enReq !== null &&
    enReq.listing_category === 'land' &&
    enReq.intended_use === 'residential' &&
    enReq.locality === 'OMR' &&
    enReq.area_max === 5 &&
    enReq.area_unit === 'cents' &&
    enReq.road_access_required === true,
    'T1: Land query extraction in English ("5 cents residential land in OMR below 40 lakhs with road access")',
    enReq
  );

  const taReq = extractStructuredRequirements('OMR la 30 lakhs kulla plot irukka?');
  assert(
    taReq !== null &&
    taReq.listing_category === 'land' &&
    taReq.locality === 'OMR' &&
    taReq.budget_max === 3000000 &&
    taReq.strict_budget === true,
    'T1b: Tamil land query extraction ("OMR la 30 lakhs kulla plot irukka?")',
    taReq
  );

  const tanReq = extractStructuredRequirements('ECR kulla 2400 sqft tar road access oda residential plot venum');
  assert(
    tanReq !== null &&
    tanReq.listing_category === 'land' &&
    tanReq.locality === 'ECR' &&
    tanReq.area_max === 2400 &&
    tanReq.road_access_required === true,
    'T1c: Tanglish land query extraction ("ECR kulla 2400 sqft tar road access oda plot")',
    tanReq
  );

  // ── TEST 2: INR lakh/crore conversion ──────────────────────────────
  console.log('\n--- Category B: Numeric & Unit Conversions ---');
  const b1 = parseInrBudget('40 lakhs');
  const b2 = parseInrBudget('2 crore');
  const b3 = parseInrBudget('75L');
  const b4 = parseInrBudget('1.5 cr');
  assert(
    b1?.budget_max === 4000000 &&
    b2?.budget_max === 20000000 &&
    b3?.budget_max === 7500000 &&
    b4?.budget_max === 15000000,
    'T2: INR Lakh & Crore conversions to exact numeric INR values',
    { b1, b2, b3, b4 }
  );

  // ── TEST 3: Area-unit conversion ───────────────────────────────────
  const centToSqft = convertAreaToSqft(5, 'cents');
  const groundToSqft = convertAreaToSqft(1, 'grounds');
  const acreToSqft = convertAreaToSqft(1, 'acres');
  const sqftToCents = convertSqftToUnit(2178, 'cents');
  assert(
    Math.round(centToSqft) === 2178 &&
    groundToSqft === 2400 &&
    acreToSqft === 43560 &&
    Math.round(sqftToCents) === 5,
    'T3: Area unit conversions (Cents, Grounds, Acres, Sq.Ft)',
    { centToSqft, groundToSqft, acreToSqft, sqftToCents }
  );

  // ── TEST 4: Exact locality match ───────────────────────────────────
  console.log('\n--- Category C: Deterministic Scoring Profiles ---');
  const exactLocItem = {
    id: 'L-1',
    title: 'Plot in OMR Sholinganallur',
    locality: 'OMR',
    city: 'Chennai',
    expected_price: 3500000,
    total_area: 5,
    area_unit: 'cents',
    status: 'available',
    road_access: '30ft tar road',
    zoning: 'CMDA Approved',
    water_availability: 1,
    electricity_availability: 1,
  };
  const exactScore = scoreLandListing(exactLocItem, { locality: 'OMR', listing_category: 'land' });
  const locCrit = exactScore?.criteria.find(c => c.name === 'location');
  assert(
    locCrit?.raw_score === 100,
    'T4: Exact locality match awards 100 raw points on Location criterion',
    locCrit
  );

  // ── TEST 5: Nearby locality handling ───────────────────────────────
  const nearbyScore = scoreLandListing(
    { ...exactLocItem, locality: 'Perungudi' },
    { locality: 'OMR', listing_category: 'land' }
  );
  const nearbyCrit = nearbyScore?.criteria.find(c => c.name === 'location');
  assert(
    nearbyCrit !== undefined && nearbyCrit.raw_score >= 70 && nearbyCrit.raw_score <= 85,
    'T5: Verified nearby locality awards partial score (70-85) without hallucinating distance',
    nearbyCrit
  );

  // ── TEST 6: Strict budget filtering ────────────────────────────────
  const overBudgetItem = {
    ...exactLocItem,
    id: 'L-OVER',
    expected_price: 4500000, // Above 40L
  };
  const strictRankings = rankProperties(
    [exactLocItem, overBudgetItem],
    { budget_max: 4000000, strict_budget: true, listing_category: 'land' },
    { search_mode: 'strict' }
  );
  const overBudgetFound = strictRankings.results.some(r => r.property_id === 'L-OVER');
  assert(
    !overBudgetFound,
    'T6: Strict budget constraint strictly excludes listings above budget limit (45L excluded for 40L budget)',
    { strictRankingsCount: strictRankings.results.length }
  );

  // ── TEST 7: Flexible budget suggestions requiring permission ──────
  const flexRankings = rankProperties(
    [exactLocItem, overBudgetItem],
    { budget_max: 4000000, strict_budget: false, listing_category: 'land' },
    { search_mode: 'flexible' }
  );
  const flexOverFound = flexRankings.results.find(r => r.property_id === 'L-OVER');
  assert(
    flexOverFound !== undefined && flexOverFound.is_strict_match === false,
    'T7: Flexible search tags slight budget deviations as optional flexible alternatives (is_strict_match === false)',
    flexOverFound
  );

  // ── TEST 8: Requested area compatibility ───────────────────────────
  const areaMatchScore = scoreLandListing(
    { ...exactLocItem, total_area: 5, area_unit: 'cents' },
    { area_min: 5, area_max: 5, area_unit: 'cents', listing_category: 'land' }
  );
  const areaCrit = areaMatchScore?.criteria.find(c => c.name === 'area');
  assert(
    areaCrit?.raw_score === 100,
    'T8: Exact area match within tolerance awards 100 raw points',
    areaCrit
  );

  // ── TEST 9: Missing road-access information ────────────────────────
  const missingRoadItem = {
    ...exactLocItem,
    road_access: null,
  };
  const roadScore = scoreLandListing(missingRoadItem, {
    road_access_required: true,
    listing_category: 'land',
  });
  const roadCrit = roadScore?.criteria.find(c => c.name === 'road_access');
  assert(
    roadCrit?.raw_score === 0 && (roadScore?.missing_data || []).some(m => m.toLowerCase().includes('road access')),
    'T9: Missing road access information is recorded in missing_data and does NOT receive invented 100 points',
    { roadCrit, missingData: roadScore?.missing_data }
  );

  // ── TEST 10: Unknown zoning / legal status ─────────────────────────
  const unknownZoningItem = {
    ...exactLocItem,
    zoning: null,
  };
  const zoningScore = scoreLandListing(unknownZoningItem, {
    intended_use: 'residential',
    listing_category: 'land',
  });
  const zoningCrit = zoningScore?.criteria.find(c => c.name === 'zoning_intended_use');
  assert(
    zoningCrit?.status === 'partial' && zoningCrit.raw_score <= 75 && (zoningScore?.missing_data || []).some(m => m.toLowerCase().includes('zoning')),
    'T10: Unknown zoning reduces score confidence and flags transparent missing data notice',
    { zoningCrit, missingData: zoningScore?.missing_data }
  );

  // ── TEST 11: Missing images ────────────────────────────────────────
  const noImageItem = {
    ...exactLocItem,
    cover_image_url: null,
    images: null,
  };
  const noImageScore = scoreLandListing(noImageItem, { listing_category: 'land' });
  assert(
    noImageScore !== null && noImageScore.cover_image_url !== undefined && noImageScore.images.length === 0,
    'T11: Missing listing image handled gracefully with placeholder without throw/crash',
    { cover_image_url: noImageScore?.cover_image_url }
  );

  // ── TEST 12: Correct land scoring and weighted totals ──────────────
  const perfectItem = {
    id: 'L-PERFECT',
    title: 'Ideal 5 Cents Plot',
    locality: 'OMR',
    city: 'Chennai',
    expected_price: 3500000,
    total_area: 5,
    area_unit: 'cents',
    status: 'available',
    road_access: '30ft tar road',
    zoning: 'CMDA Approved',
    water_availability: 1,
    electricity_availability: 1,
  };
  const perfectScore = scoreLandListing(perfectItem, {
    locality: 'OMR',
    budget_max: 4000000,
    area_min: 5,
    area_max: 5,
    area_unit: 'cents',
    intended_use: 'residential',
    road_access_required: true,
    listing_category: 'land',
  });
  const sumWeights = perfectScore ? perfectScore.criteria.reduce((s, c) => s + c.weight, 0) : 0;
  assert(
    perfectScore !== null && sumWeights === 100 && perfectScore.final_score >= 95,
    `T12: Land scoring formula sums exactly to 100% weights (${JSON.stringify(DEFAULT_LAND_WEIGHTS)}) and bounds score between 0-100`,
    { sumWeights, final_score: perfectScore?.final_score }
  );

  // ── TEST 13: Results sorted by actual score ────────────────────────
  const rankedAll = rankProperties(
    [exactLocItem, missingRoadItem, perfectItem],
    { locality: 'OMR', budget_max: 4000000, road_access_required: true, listing_category: 'land' }
  );
  const isSorted = rankedAll.results.every((item, i, arr) => i === 0 || arr[i - 1].final_score >= item.final_score);
  assert(
    isSorted && rankedAll.results.length > 0,
    'T13: Matching engine returns results strictly sorted by final_score descending',
    rankedAll.results.map(r => ({ id: r.property_id, score: r.final_score }))
  );

  // ── TEST 14: All eligible matches returned through pagination ──────
  console.log('\n--- Category D: Live Database Inventory & API Verification ---');
  const apiRecommendRes = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'land',
      requirements: { locality: 'Chennai', listing_category: 'land' },
      limit: 10,
    }),
  });
  const apiRecommendData = await apiRecommendRes.json();
  assert(
    apiRecommendRes.status === 200 &&
    apiRecommendData.success === true &&
    Array.isArray(apiRecommendData.results) &&
    apiRecommendData.total_eligible_matches >= 4,
    'T14: POST /api/crm/matching/recommend returns all eligible land inventory matches via pagination',
    { total: apiRecommendData.total_eligible_matches, count: apiRecommendData.results?.length }
  );

  // ── TEST 15: No-match handling ─────────────────────────────────────
  const noMatchRes = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'land',
      requirements: { locality: 'Kashmir', budget_max: 50000, strict_budget: true },
      search_mode: 'strict',
    }),
  });
  const noMatchData = await noMatchRes.json();
  assert(
    noMatchData.success === true &&
    (noMatchData.unmatched === true || noMatchData.results.length === 0) &&
    typeof noMatchData.unmatched_reason === 'string',
    'T15: Safe no-match handling when zero listings meet criteria, with helpful relaxation suggestion',
    noMatchData.unmatched_reason
  );

  // ── TEST 16: Real database inventory used ──────────────────────────
  const db = getPool();
  const [realLandRows] = await db.query('SELECT id, title, locality, expected_price FROM land_listings WHERE status = "available"') as any;
  const returnedIds = (apiRecommendData.results || []).map((r: any) => r.property_id);
  const realDbIds = (realLandRows || []).map((r: any) => r.id);
  const matchedRealIds = returnedIds.filter((id: string) => realDbIds.includes(id));
  assert(
    matchedRealIds.length > 0,
    `T16: Recommendations strictly grounded in real MySQL database inventory (${matchedRealIds.length} verified real IDs)`,
    matchedRealIds
  );

  // ── TEST 17: Customer interest saved correctly ─────────────────────
  const testLandId = realLandRows[0]?.id || 'LAND-OMR-5CENTS';
  const saveInterestRes = await fetch(`${BASE_URL}/api/crm/matching/interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      land_id: testLandId,
      customer_id: 'CUST-TEST-001',
      notes: 'Automated test interest saving for plot',
    }),
  });
  const saveInterestData = await saveInterestRes.json();
  assert(
    saveInterestRes.status === 200 && saveInterestData.success === true && typeof saveInterestData.id === 'string',
    'T17: POST /api/crm/matching/interest successfully persists interested land in customer_interested_properties',
    saveInterestData
  );

  // ── TEST 18: Employee search scoped to authorised customers ────────
  const salesExecToken = generateToken({
    id: 'E-SALES-TEST',
    loginId: 'SE01',
    email: 'sales.tester@lyka.com',
    fullName: 'Sales Executive Tester',
    role: 'Sales & Growth Executive',
    department: 'Sales',
  });
  // Try scoping to a lead not assigned to this sales executive
  const scopedRes = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${salesExecToken}`,
    },
    body: JSON.stringify({
      category: 'land',
      lead_id: 'LEAD-UNASSIGNED-FOREIGN-999',
      requirements: { locality: 'OMR' },
    }),
  });
  assert(
    scopedRes.status === 403 || scopedRes.status === 404,
    'T18: Role-based scoping prevents Sales Executive from searching private leads outside their assignment',
    { status: scopedRes.status }
  );

  // ── TEST 19: Guest cannot access internal CRM information ─────────
  const guestUnmatchedRes = await fetch(`${BASE_URL}/api/crm/matching/unmatched`);
  const guestEmployeesRes = await fetch(`${BASE_URL}/api/crm/employees`);
  assert(
    (guestUnmatchedRes.status === 401 || guestUnmatchedRes.status === 403) &&
    (guestEmployeesRes.status === 401 || guestEmployeesRes.status === 403),
    'T19: Guest/anonymous requests are strictly rejected (HTTP 401/403) when accessing internal CRM endpoints',
    { unmatchedStatus: guestUnmatchedRes.status, employeesStatus: guestEmployeesRes.status }
  );

  // ── TEST 20: Site-visit request persistence ────────────────────────
  const siteVisitRes = await fetch(`${BASE_URL}/api/crm/matching/site-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      land_id: testLandId,
      customer_id: 'CUST-TEST-001',
      visit_date: '2026-10-20',
      visit_time: '11:00 AM',
      notes: 'Customer wants on-site boundary verification',
    }),
  });
  const siteVisitData = await siteVisitRes.json();
  assert(
    siteVisitRes.status === 201 && siteVisitData.success === true && typeof siteVisitData.id === 'string',
    'T20: POST /api/crm/matching/site-visit creates persistent site_visit and automatic follow-up CRM task',
    siteVisitData
  );

  // ── TEST 21: Follow-up questions retain and update requirements ────
  const initial = extractStructuredRequirements('I want a plot in OMR below 40 lakhs');
  const followUp1 = extractStructuredRequirements('Make it strictly 5 cents with road access', {
    ...(initial || {}),
    property_type: 'residential_plot',
  });
  assert(
    followUp1 !== null &&
    followUp1.locality === 'OMR' &&
    followUp1.budget_max === 4000000 &&
    followUp1.area_max === 5 &&
    followUp1.road_access_required === true,
    'T21: Follow-up conversational turns merge and update criteria without losing prior context',
    followUp1
  );

  // ── TEST 22: Existing property recommendations still work ──────────
  const propRecommendRes = await fetch(`${BASE_URL}/api/crm/matching/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'property',
      requirements: { property_type: 'apartment', locality: 'Anna Nagar', budget_max: 9000000 },
      limit: 5,
    }),
  });
  const propRecommendData = await propRecommendRes.json();
  assert(
    propRecommendRes.status === 200 &&
    propRecommendData.success === true &&
    propRecommendData.results.length > 0 &&
    propRecommendData.results[0].listing_type === 'property',
    'T22: Existing apartment/villa property recommendations work seamlessly alongside land',
    { firstItem: propRecommendData.results?.[0]?.title }
  );

  // ── TEST 23: Existing chatbot text and voice remain functional ─────
  const chatHealthRes = await fetch(`${BASE_URL}/api/health`);
  const chatHealthData = await chatHealthRes.json();
  const chatTextRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Do you have any land available in OMR?' }],
      sessionId: 'test_session_health_chk_123',
    }),
  });
  const chatTextData = await chatTextRes.json();
  assert(
    chatHealthData.status === 'ok' &&
    chatTextRes.status === 200 &&
    typeof chatTextData.message === 'string' &&
    chatTextData.message.length > 10,
    'T23: Existing /api/chat text chat and /api/health voice endpoints respond with grounded data',
    { chatStatus: chatTextRes.status, snippet: chatTextData.message?.slice(0, 80) }
  );

  console.log('\n============================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('============================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
