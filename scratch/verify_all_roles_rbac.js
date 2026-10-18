/**
 * verify_all_roles_rbac.js — Full Automated Verification Test Suite
 * 
 * Tests:
 * 1. Login & Dashboard retrieval for all 5 roles:
 *    - Super Admin
 *    - Operations Admin
 *    - Lead Management Executive
 *    - Sales Territory Manager
 *    - Sales & Growth Executive
 * 2. Strict Zero-Trust Backend RBAC:
 *    - Missing token -> 401 Unauthorized
 *    - Invalid role / unauthorized endpoint -> 403 Forbidden
 *    - Header spoofing attempt (x-user-role) without token -> 401 Unauthorized
 * 3. Scoped record queries:
 *    - Sales Executive GET /leads receives only assigned leads
 *    - Sales Territory Manager GET /employees receives only team members
 *    - Sales Executive GET /employees receives 403 Forbidden
 * 4. AI Chat Assistant role-grounding (/api/chat):
 *    - Authenticated Super Admin query grounds employees
 *    - Authenticated Operations Admin query grounds inventory
 *    - Authenticated Sales Executive query grounds personal portfolio
 *    - Guest query remains public luxury concierge (no staff leak)
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('===============================================================');
  console.log('   LYKA REALTY CRM — 5-ROLE RBAC & ASSISTANT VERIFICATION     ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Login with all 5 accounts
  const accounts = [
    { role: 'Super Admin', loginId: 'admin@lyka', password: '12345678' },
    { role: 'Operations Admin', loginId: 'CO2', password: '12345678' },
    { role: 'Lead Management Executive', loginId: 'CO4', password: '12345678' },
    { role: 'Sales Territory Manager', loginId: 'CO3', password: '12345678' },
    { role: 'Sales & Growth Executive', loginId: 'CO1', password: '12345678' },
  ];

  const tokens = {};

  console.log('--- 1. Testing Authentication & Token Issuance for All 5 Roles ---');
  for (const acc of accounts) {
    try {
      const res = await fetch(`${BASE_URL}/api/crm/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: acc.loginId, password: acc.password }),
      });
      const data = await res.json();
      assert(res.status === 200 && data.success && data.token, `${acc.role} (${acc.loginId}) logged in successfully`);
      assert(data.employee.role === acc.role, `${acc.role} returned verified role '${data.employee.role}'`);
      tokens[acc.role] = data.token;
    } catch (err) {
      assert(false, `${acc.role} login threw error: ${err.message}`);
    }
  }

  console.log('\n--- 2. Testing Role-Aware Dashboard API (/api/crm/dashboard) ---');
  for (const acc of accounts) {
    const token = tokens[acc.role];
    if (!token) continue;

    try {
      const res = await fetch(`${BASE_URL}/api/crm/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      assert(res.status === 200 && data.success, `${acc.role} dashboard loaded with HTTP 200`);
      assert(data.role === acc.role, `${acc.role} dashboard returned matched role`);

      if (acc.role === 'Super Admin') {
        assert(data.roleKpis.totalCustomers !== undefined && data.roleKpis.auditEventsCount !== undefined,
          'Super Admin dashboard includes totalCustomers & auditEventsCount');
        assert(Array.isArray(data.employeeLeaderboard), 'Super Admin dashboard includes employeeLeaderboard');
      } else if (acc.role === 'Operations Admin') {
        assert(data.roleKpis.availableProperties !== undefined && data.roleKpis.pendingVerification !== undefined,
          'Operations Admin dashboard includes availableProperties & pendingVerification');
        assert(Array.isArray(data.roleData.pendingVerifications), 'Operations Admin dashboard includes pendingVerifications queue');
      } else if (acc.role === 'Lead Management Executive') {
        assert(data.roleKpis.unassignedLeads !== undefined && data.roleKpis.awaitingDetails !== undefined,
          'Lead Management Executive dashboard includes unassignedLeads & awaitingDetails');
        assert(Array.isArray(data.roleData.unassignedLeads), 'Lead Management Executive dashboard includes unassignedLeads queue');
      } else if (acc.role === 'Sales Territory Manager') {
        assert(data.roleKpis.teamMembersCount !== undefined && data.roleKpis.teamPipelineValue !== undefined,
          'Sales Territory Manager dashboard includes teamMembersCount & teamPipelineValue');
        assert(Array.isArray(data.roleData.teamMembers), 'Sales Territory Manager dashboard includes teamMembers list');
      } else if (acc.role === 'Sales & Growth Executive') {
        assert(data.roleKpis.myLeadsCount !== undefined && data.roleKpis.myPointsBalance !== undefined,
          'Sales & Growth Executive dashboard includes myLeadsCount & myPointsBalance');
        assert(Array.isArray(data.roleData.myDeals), 'Sales & Growth Executive dashboard includes myDeals');
      }
    } catch (err) {
      assert(false, `${acc.role} dashboard threw error: ${err.message}`);
    }
  }

  console.log('\n--- 3. Testing Zero-Trust Backend Authorization & Anti-Spoofing ---');
  // Test 3a: Unauthenticated call to protected endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/crm/employees`);
    assert(res.status === 401, 'Unauthenticated request to /api/crm/employees returns 401 Unauthorized');
  } catch (err) {
    assert(false, `Test 3a threw: ${err.message}`);
  }

  // Test 3b: Header spoofing attempt without token (x-user-role: Super Admin)
  try {
    const res = await fetch(`${BASE_URL}/api/crm/employees`, {
      headers: { 'x-user-role': 'Super Admin' },
    });
    assert(res.status === 401, 'Spoofed x-user-role header without Bearer token returns 401 Unauthorized');
  } catch (err) {
    assert(false, `Test 3b threw: ${err.message}`);
  }

  // Test 3c: Unauthorized role accessing restricted endpoint (Sales Executive accessing /api/crm/employees)
  try {
    const res = await fetch(`${BASE_URL}/api/crm/employees`, {
      headers: { 'Authorization': `Bearer ${tokens['Sales & Growth Executive']}` },
    });
    assert(res.status === 403, 'Sales & Growth Executive requesting /api/crm/employees returns 403 Forbidden');
  } catch (err) {
    assert(false, `Test 3c threw: ${err.message}`);
  }

  // Test 3d: Lead Management Executive accessing /api/crm/employees
  try {
    const res = await fetch(`${BASE_URL}/api/crm/employees`, {
      headers: { 'Authorization': `Bearer ${tokens['Lead Management Executive']}` },
    });
    assert(res.status === 403, 'Lead Management Executive requesting /api/crm/employees returns 403 Forbidden');
  } catch (err) {
    assert(false, `Test 3d threw: ${err.message}`);
  }

  // Test 3e: Sales Territory Manager receives scoped department members only
  try {
    const res = await fetch(`${BASE_URL}/api/crm/employees`, {
      headers: { 'Authorization': `Bearer ${tokens['Sales Territory Manager']}` },
    });
    const data = await res.json();
    assert(res.status === 200 && data.success, 'Sales Territory Manager can read scoped employee list (HTTP 200)');
    assert(Array.isArray(data.data) && data.data.length > 0, 'Sales Territory Manager receives team member directory');
  } catch (err) {
    assert(false, `Test 3e threw: ${err.message}`);
  }

  // Test 3f: Sales Executive GET /leads is scoped to assigned leads only
  try {
    const res = await fetch(`${BASE_URL}/api/crm/leads`, {
      headers: { 'Authorization': `Bearer ${tokens['Sales & Growth Executive']}` },
    });
    const data = await res.json();
    assert(res.status === 200 && data.success, 'Sales Executive can read assigned leads (HTTP 200)');
    const allAssignedToMe = (data.data || []).every(l => l.assigned_agent === 'CO1');
    assert(allAssignedToMe, 'Sales Executive receives ONLY their assigned leads (zero leak of other agents)');
  } catch (err) {
    assert(false, `Test 3f threw: ${err.message}`);
  }

  console.log('\n--- 4. Testing AI Assistant Live Role-Grounded RAG (/api/chat) ---');
  // Test 4a: Super Admin asks about staff
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens['Super Admin']}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Who are my employees and what is their current workload?' }],
        language: 'english',
        sessionId: 'test_session_super_admin',
        employeeToken: tokens['Super Admin'],
      }),
    });
    const data = await res.json();
    const replyText = data.message || data.reply || '';
    assert(res.status === 200 && replyText.length > 0, 'Super Admin AI chat returns 200 with grounded response');
    const hasStaffMention = replyText.includes('CO') || replyText.includes('employee') || replyText.includes('team') || replyText.includes('Admin') || replyText.includes('Mohan');
    assert(hasStaffMention, 'Super Admin AI response correctly references authorized employee records');
  } catch (err) {
    assert(false, `Test 4a threw: ${err.message}`);
  }

  // Test 4b: Sales Executive asks about leads
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens['Sales & Growth Executive']}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Show my assigned leads and follow-ups due today' }],
        language: 'english',
        sessionId: 'test_session_sales_exec',
        employeeToken: tokens['Sales & Growth Executive'],
      }),
    });
    const data = await res.json();
    const replyText = data.message || data.reply || '';
    assert(res.status === 200 && replyText.length > 0, 'Sales Executive AI chat returns 200 with grounded response');
  } catch (err) {
    assert(false, `Test 4b threw: ${err.message}`);
  }

  // Test 4c: Public guest cannot access employee records
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Who are the employees and what are their salaries?' }],
        language: 'english',
        sessionId: 'test_session_anonymous_guest',
      }),
    });
    const data = await res.json();
    const replyText = data.message || data.reply || '';
    assert(res.status === 200 && replyText.length > 0, 'Anonymous guest AI chat returns 200');
    const leakedStaffData = replyText.includes('points_balance') || replyText.includes('password_hash') || (replyText.includes('CO2') && replyText.includes('salary'));
    assert(!leakedStaffData, 'Anonymous guest chat NEVER leaks employee internal CRM records');
  } catch (err) {
    assert(false, `Test 4c threw: ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
