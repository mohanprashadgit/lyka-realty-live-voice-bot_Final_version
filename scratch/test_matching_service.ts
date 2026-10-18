/**
 * test_matching_service.ts — Unit tests for Deterministic Property Matching Engine
 */
import {
  scoreListing,
  rankProperties,
  formatINR,
  DEFAULT_WEIGHTS,
  InventoryItem,
  StructuredRequirements,
} from '../backend/services/propertyMatchingService.js';

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

console.log('=== TEST SUITE: Deterministic Property Matching Service ===\n');

// 1. Currency Formatting
{
  console.log('1. Currency Formatter');
  assert(formatINR(6500000) === '₹65 Lakh', 'Formats 65,00,000 as ₹65 Lakh');
  assert(formatINR(15000000) === '₹1.50 Cr', 'Formats 1,50,00,000 as ₹1.50 Cr');
  assert(formatINR(70000) === '₹70,000', 'Formats 70,000 as ₹70,000');
}

// 2. Exact Property Type & Location Match
{
  console.log('\n2. Exact Property Type, Bedrooms & Locality Match');
  const item: InventoryItem = {
    id: 'P-101',
    title: 'Prestige Bella Vista 2 BHK',
    property_type: 'apartment',
    status: 'available',
    city: 'Chennai',
    locality: 'OMR',
    bedrooms: 2,
    price: 6500000,
    built_up_area: 950,
    area_unit: 'sqft',
    metro_distance_km: 0.8,
    locality_rating: 'Verified Prime',
    amenities: ['Gym', 'Lift', 'Security', 'Power Backup'],
  };

  const req: StructuredRequirements = {
    property_type: 'apartment',
    bedrooms: 2,
    location: 'Chennai',
    locality: 'OMR',
    budget_max: 7000000,
    area_min: 900,
    near_metro: true,
    locality_preference: 'good',
  };

  const scored = scoreListing(item, req);
  assert(scored !== null, 'Listing was eligible and scored');
  if (scored) {
    assert(scored.final_score >= 90, `Score is in Excellent category: ${scored.final_score}%`);
    assert(scored.match_category === 'Excellent Match', `Category is Excellent Match: ${scored.match_category}`);
    assert(scored.criteria.find(c => c.name === 'property_type')?.raw_score === 100, 'Property type raw score is 100');
    assert(scored.criteria.find(c => c.name === 'location')?.raw_score === 100, 'Location raw score is 100');
    assert(scored.criteria.find(c => c.name === 'budget')?.raw_score === 100, 'Budget raw score is 100');
    assert(scored.criteria.find(c => c.name === 'near_metro')?.raw_score === 100, 'Near metro raw score is 100');
    assert(scored.why_it_matches.some(r => r.includes('Exact 2 BHK')), 'Contains reason: Exact 2 BHK');
    assert(scored.why_it_matches.some(r => r.includes('Within your budget')), 'Contains reason: Within budget');
  }
}

// 3. Property Within vs Exceeding Strict Budget
{
  console.log('\n3. Strict Budget Exclusions vs Flexible Budget Tolerance');
  const itemOverBudget: InventoryItem = {
    id: 'P-102',
    title: 'Luxury Villa ECR',
    property_type: 'villa',
    status: 'available',
    city: 'Chennai',
    locality: 'ECR',
    bedrooms: 3,
    price: 7500000, // 75L > 70L (+7.1%)
  };

  // Strict budget
  const strictReq: StructuredRequirements = {
    budget_max: 7000000,
    strict_budget: true,
  };
  const strictScored = scoreListing(itemOverBudget, strictReq);
  assert(strictScored === null, 'Strict budget excludes property exceeding budget');

  // Flexible budget
  const flexReq: StructuredRequirements = {
    budget_max: 7000000,
    strict_budget: false,
    allow_flexible_options: true,
  };
  const flexScored = scoreListing(itemOverBudget, flexReq);
  assert(flexScored !== null, 'Flexible budget allows property up to 10% above budget');
  if (flexScored) {
    const budgetCrit = flexScored.criteria.find(c => c.name === 'budget');
    assert(budgetCrit?.raw_score === 70, `Flexible budget receives 70 points: ${budgetCrit?.raw_score}`);
  }
}

// 4. Incompatible Property Type (Insisting on Apartment vs Vacant Land)
{
  console.log('\n4. Incompatible Property Type Filter');
  const landItem: InventoryItem = {
    id: 'L-201',
    title: '10 Cents ECR Plot',
    listing_type: 'land',
    land_type: 'residential_plot',
    status: 'available',
    city: 'Chennai',
    locality: 'ECR',
    expected_price: 6000000,
  };

  const aptReq: StructuredRequirements = {
    property_type: 'apartment',
    bedrooms: 2,
  };
  const result = scoreListing(landItem, aptReq);
  assert(result === null, 'Vacant land is excluded when customer insists on apartment');
}

// 5. Missing Area & Metro Data Handling
{
  console.log('\n5. Missing Area & Metro Data Policy (No Fake Data)');
  const itemMissingInfo: InventoryItem = {
    id: 'P-103',
    title: 'Standard Flat',
    property_type: 'apartment',
    status: 'available',
    city: 'Chennai',
    locality: 'Velachery',
    price: 5000000,
    // area missing
    // metro distance missing
  };

  const reqWithMetroAndArea: StructuredRequirements = {
    property_type: 'apartment',
    budget_max: 6000000,
    area_min: 1000,
    near_metro: true,
  };

  const scored = scoreListing(itemMissingInfo, reqWithMetroAndArea);
  assert(scored !== null, 'Item is scored despite missing fields');
  if (scored) {
    const metroCrit = scored.criteria.find(c => c.name === 'near_metro');
    const areaCrit = scored.criteria.find(c => c.name === 'area');
    assert(metroCrit?.raw_score === 0, 'Missing metro data does NOT receive fake score (raw score 0)');
    assert(metroCrit?.status === 'unknown', 'Metro status is unknown');
    assert(areaCrit?.raw_score === 0, 'Missing area data does NOT receive fake score (raw score 0)');
    assert(scored.missing_data.length >= 2, `Missing data tracked honestly: ${scored.missing_data.join(', ')}`);
  }
}

// 6. Unknown Locality Rating
{
  console.log('\n6. Unknown Locality Quality');
  const itemNoAudit: InventoryItem = {
    id: 'P-104',
    title: 'Suburban Villa',
    property_type: 'villa',
    status: 'available',
    city: 'Chennai',
    locality: 'Guduvanchery',
    price: 4500000,
    locality_rating: null,
  };

  const reqLocality: StructuredRequirements = {
    locality_preference: 'prime',
  };

  const scored = scoreListing(itemNoAudit, reqLocality);
  assert(scored !== null, 'Scored with unknown locality');
  if (scored) {
    const amenityCrit = scored.criteria.find(c => c.name === 'amenities');
    assert(Boolean(amenityCrit?.reason?.includes('Not verified')), `Displays "Not verified": ${amenityCrit?.reason}`);
  }
}

// 7. Sold / Unavailable Status Exclusion
{
  console.log('\n7. Unavailable Inventory Exclusion');
  const soldItem: InventoryItem = {
    id: 'P-105',
    title: 'Sold Penthouse',
    property_type: 'penthouse',
    status: 'sold',
    price: 9000000,
  };

  assert(scoreListing(soldItem, {}) === null, 'Sold inventory is strictly excluded from scoring');
}

// 8. Empty Inventory & No-Match Handling
{
  console.log('\n8. Empty Inventory & No-Match Handling');
  const rankedEmpty = rankProperties([], { location: 'Chennai' });
  assert(rankedEmpty.results.length === 0, 'Empty inventory returns 0 results');
  assert(rankedEmpty.unmatched === true, 'Empty inventory marked as unmatched');
  assert(typeof rankedEmpty.unmatched_reason === 'string', 'Provides explanation for no-match');
}

// 9. Ranking Order and Tie-breaking
{
  console.log('\n9. Ranking Order and Tie-Breaking');
  const inv: InventoryItem[] = [
    {
      id: 'P-A',
      title: 'Listing A (Good Match - 3 BHK)',
      property_type: 'apartment',
      bedrooms: 3,
      status: 'available',
      locality: 'OMR',
      price: 6800000,
      metro_distance_km: 2.5,
    },
    {
      id: 'P-B',
      title: 'Listing B (Excellent Match - 2 BHK Exact)',
      property_type: 'apartment',
      bedrooms: 2,
      status: 'available',
      locality: 'OMR',
      price: 6500000,
      metro_distance_km: 0.7,
    },
    {
      id: 'P-C',
      title: 'Listing C (Low Match - Wrong Location)',
      property_type: 'apartment',
      bedrooms: 2,
      status: 'available',
      locality: 'Tambaram',
      price: 6000000,
      metro_distance_km: 6.0,
    },
  ];

  const req: StructuredRequirements = {
    property_type: 'apartment',
    bedrooms: 2,
    locality: 'OMR',
    budget_max: 7000000,
    near_metro: true,
  };

  const ranked = rankProperties(inv, req);
  assert(ranked.results.length === 3, 'All 3 eligible properties returned');
  assert(ranked.results[0].property_id === 'P-B', `Top result is P-B (${ranked.results[0].final_score}%)`);
  assert(ranked.results[0].final_score > ranked.results[1].final_score, 'Score B > Score A');
  assert(ranked.results[1].final_score > ranked.results[2].final_score, 'Score A > Score C');
}

// 10. Bounds [0, 100] Guarantee
{
  console.log('\n10. Score Bounds 0 to 100 Guarantee');
  const item: InventoryItem = {
    id: 'P-BOUNDS',
    title: 'Test Bounds',
    status: 'available',
    price: 1000000,
  };
  const scored = scoreListing(item, { budget_max: 2000000 });
  assert(scored !== null, 'Scored test item');
  if (scored) {
    assert(scored.final_score >= 0 && scored.final_score <= 100, `Final score within [0, 100]: ${scored.final_score}`);
    for (const c of scored.criteria) {
      assert(c.raw_score >= 0 && c.raw_score <= 100, `Criterion ${c.name} raw score in [0, 100]: ${c.raw_score}`);
    }
  }
}

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
