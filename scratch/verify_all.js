/**
 * verify_all.js — Comprehensive Test Suite for Lyka Realty CRM MVP
 * Tests all 5 roles, login, auth tokens, employee-aware chatbot, property & land CRUD + images,
 * and idempotent purchase verification points ledger.
 */
import http from 'http';

const BASE_URL = 'http://localhost:3000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== LYKA REALTY CRM MVP VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // ── TEST 1: All 5 Roles Sign-In ──────────────────────────────────────
  console.log('1. Testing Sign-In for all 5 Seed Accounts:');
  const accounts = [
    { id: 'admin@lyka', role: 'Super Admin', name: 'Super Admin' },
    { id: 'CO1', role: 'Sales & Growth Executive', name: 'Mohan' },
    { id: 'CO2', role: 'Operations Admin', name: 'Kavitha' },
    { id: 'CO3', role: 'Sales Territory Manager', name: 'Arunachalam' },
    { id: 'CO4', role: 'Lead Management Executive', name: 'Deepa' },
  ];

  const tokens = {};

  for (const acc of accounts) {
    const res = await request('/api/crm/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { loginId: acc.id, password: '12345678' },
    });

    assert(res.status === 200 && res.body.success === true, `Account ${acc.id} successfully authenticated`);
    assert(res.body.employee?.role === acc.role, `Account ${acc.id} mapped to real role '${acc.role}'`);
    assert(typeof res.body.token === 'string', `Account ${acc.id} received HMAC-signed session token`);
    tokens[acc.id] = res.body.token;
  }

  // ── TEST 2: Server-side Session Verification via GET /auth/me ─────────
  console.log('\n2. Testing /api/crm/auth/me Server Verification:');
  const meRes = await request('/api/crm/auth/me', {
    headers: { 'Authorization': `Bearer ${tokens['CO1']}` },
  });
  assert(meRes.status === 200 && meRes.body.user?.id === 'CO1', 'Verified CO1 session matches Mohan');
  assert(meRes.body.user?.name === 'Mohan', 'Verified display name is Mohan');
  assert(meRes.body.user?.role === 'Sales & Growth Executive', 'Verified role is Sales & Growth Executive');

  // Invalid token check
  const badMeRes = await request('/api/crm/auth/me', {
    headers: { 'Authorization': 'Bearer bad.token.here' },
  });
  assert(badMeRes.status === 401, 'Unauthorized request correctly returns HTTP 401');

  // ── TEST 3: Backend Permissions & Least-Privilege Access ──────────────
  console.log('\n3. Testing Backend Role Permissions & RBAC Isolation:');
  // Operations Admin (CO2) can access inventory
  const propListRes = await request('/api/crm/properties', {
    headers: { 'Authorization': `Bearer ${tokens['CO2']}` },
  });
  assert(propListRes.status === 200 && propListRes.body.success, 'Operations Admin has access to property inventory');

  // Sales Executive (CO1) cannot verify deals or access admin-only users
  const adminUsersRes = await request('/api/crm/users', {
    headers: { 'Authorization': `Bearer ${tokens['CO1']}` },
  });
  assert(adminUsersRes.status === 403 || adminUsersRes.body.success === false, 'Sales Executive blocked from admin users endpoint');

  // ── TEST 4: Employee-Aware AI Chatbot Integration ────────────────────
  console.log('\n4. Testing Employee-Aware AI Chatbot (/api/chat):');
  const chatGreetingRes = await request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['CO1']}`,
    },
    body: {
      messages: [{ role: 'user', content: 'Hello assistant' }],
      language: 'english',
      sessionId: 'test-session-mohan',
      employeeToken: tokens['CO1'],
    },
  });

  assert(chatGreetingRes.status === 200 && chatGreetingRes.body.message, 'Chatbot replied to Mohan');
  console.log(`    Chatbot Response: "${chatGreetingRes.body.message.substring(0, 80)}..."`);

  // Test Lead Registration Attribution
  const chatLeadRes = await request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['CO1']}`,
    },
    body: {
      messages: [
        { role: 'user', content: 'Register a new lead for Suresh Kumar, phone 9876543210, address 15 Anna Salai Chennai, interested in a 3BHK villa' },
      ],
      language: 'english',
      sessionId: 'test-session-mohan-lead',
      employeeToken: tokens['CO1'],
    },
  });

  assert(chatLeadRes.status === 200, 'Lead registration prompt processed by chatbot');
  if (chatLeadRes.body.leadUpdate) {
    assert(chatLeadRes.body.leadUpdate.name?.includes('Suresh') || chatLeadRes.body.leadUpdate.phone?.includes('9876543210'), 'Lead fields extracted correctly');
  }

  // ── TEST 5: Image Upload & Property / Land Inventory CRUD ────────────
  console.log('\n5. Testing Multi-Image Upload & Property / Land CRUD:');
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const uploadRes = await request('/api/crm/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['CO2']}`,
    },
    body: {
      dataUrl: sampleBase64,
      filename: 'luxury_villa_facade.png',
      folder: 'listings',
    },
  });

  assert(uploadRes.status === 200 && uploadRes.body.success, 'Listing image successfully uploaded');
  assert(uploadRes.body.url?.startsWith('/uploads/listings/'), `Returned static image URL: ${uploadRes.body.url}`);
  const uploadedImageUrl = uploadRes.body.url;

  // Create Property Listing
  const newPropertyRes = await request('/api/crm/properties', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['CO2']}`,
    },
    body: {
      title: 'Aura Waterfront Presidential Penthouse',
      property_type: 'penthouse',
      price: 38500000,
      built_up_area: 3200,
      bedrooms: 4,
      bathrooms: 4,
      locality: 'Boat Club Road',
      city: 'Chennai',
      full_address: 'No 8, Boat Club Road, R.A. Puram, Chennai',
      description: 'Panoramic Adyar river views with infinity terrace pool.',
      status: 'available',
      amenities: ['River View', 'Private Elevator', '24/7 Concierge', 'Italian Marble'],
      images: [uploadedImageUrl],
    },
  });

  assert((newPropertyRes.status === 201 || newPropertyRes.status === 200) && newPropertyRes.body.success, 'Property listing created in MySQL');
  const createdPropertyId = newPropertyRes.body.id;

  // Retrieve Property and verify image
  const getPropRes = await request(`/api/crm/properties/${createdPropertyId}`, {
    headers: { 'Authorization': `Bearer ${tokens['CO2']}` },
  });
  assert(getPropRes.status === 200 && getPropRes.body.data?.id === createdPropertyId, 'Retrieved created property from database');
  assert(Number(getPropRes.body.data?.price) === 38500000, 'Property price accurately saved to database');

  // Create Land Listing
  const newLandRes = await request('/api/crm/land', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['CO2']}`,
    },
    body: {
      title: '15 Cents Premium Coastal Villa Parcel',
      land_type: 'residential_plot',
      expected_price: 22500000,
      total_area: 15,
      area_unit: 'cents',
      survey_number: '204/1B',
      locality: 'Kovalam, ECR',
      city: 'Chennai',
      road_access: '40 ft Blacktop Tar Road',
      utilities: 'EB Three-Phase Power, Potable Sweet Water',
      zoning_details: 'DTCP & RERA Approved Layout',
      verification_status: 'Clear Title, Patta Available',
      description: 'East-facing beachfront residential land ideal for luxury villa.',
      status: 'available',
      images: [uploadedImageUrl],
    },
  });

  assert((newLandRes.status === 201 || newLandRes.status === 200) && newLandRes.body.success, 'Land listing created in MySQL');
  const createdLandId = newLandRes.body.id;

  // Retrieve Land and verify
  const getLandRes = await request(`/api/crm/land/${createdLandId}`, {
    headers: { 'Authorization': `Bearer ${tokens['CO2']}` },
  });
  assert(getLandRes.status === 200 && getLandRes.body.data?.id === createdLandId, 'Retrieved created land parcel from database');
  assert(getLandRes.body.data?.survey_number === '204/1B', 'Survey number accurately saved');

  // ── TEST 6: Idempotent Deal Purchase Verification & Points Ledger ────
  console.log('\n6. Testing Idempotent Purchase Verification & Points Ledger:');
  // First ensure there is a deal assigned to Mohan (CO1)
  const dealsListRes = await request('/api/crm/deals', {
    headers: { 'Authorization': `Bearer ${tokens['admin@lyka']}` },
  });
  let dealIdToVerify;
  if (dealsListRes.body.data && dealsListRes.body.data.length > 0) {
    dealIdToVerify = dealsListRes.body.data[0].id;
  } else {
    const createDealRes = await request('/api/crm/deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens['admin@lyka']}`,
      },
      body: {
        title: 'Mohan Signature Villa Purchase Deal',
        agent_id: 'CO1',
        deal_value: 38500000,
        deal_status: 'in_negotiation',
        property_id: createdPropertyId,
      },
    });
    dealIdToVerify = createDealRes.body.id;
  }

  // Super Admin verifies purchase for deal
  const verifyRes1 = await request(`/api/crm/deals/${dealIdToVerify}/verify-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['admin@lyka']}`,
    },
  });

  assert(verifyRes1.status === 200 && verifyRes1.body.success, `Verified deal purchase for ${dealIdToVerify}`);
  console.log(`    First verification result: ${verifyRes1.body.message || 'Points awarded'}`);

  // Test IDEMPOTENCY: Try verifying the EXACT SAME DEAL again
  const verifyRes2 = await request(`/api/crm/deals/${dealIdToVerify}/verify-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['admin@lyka']}`,
    },
  });

  assert(verifyRes2.status === 200 && (verifyRes2.body.alreadyVerified === true || verifyRes2.body.alreadyAwarded === true), 'Idempotency test: Second verification call detected already-verified deal');
  assert(verifyRes2.body.pointsAwarded === 0, 'Idempotency test: Zero duplicate points awarded on retry');

  // ── TEST 7: Employee Performance Endpoint ────────────────────────────
  console.log('\n7. Testing Employee Performance Metrics:');
  const perfRes = await request('/api/crm/employees/CO1/performance', {
    headers: { 'Authorization': `Bearer ${tokens['CO1']}` },
  });

  assert(perfRes.status === 200 && perfRes.body.success, 'Employee performance loaded successfully');
  assert(typeof perfRes.body.performance?.points_balance === 'number', `Current points balance: ${perfRes.body.performance?.points_balance}`);
  assert(typeof perfRes.body.performance?.assigned_leads === 'number', `Assigned leads count: ${perfRes.body.performance?.assigned_leads}`);

  console.log('\n======================================================');
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
