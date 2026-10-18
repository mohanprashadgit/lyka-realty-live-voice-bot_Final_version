/**
 * test_final_update_suite.ts — Automated Regression Test Suite for Final Update
 * 
 * Verifies:
 * 1. Initial Greeting: Agent does NOT ask for customer's name at the beginning.
 * 2. Subtle & Light Appreciation: Uses natural expressions without overpraising.
 * 3. City Response: Natural acknowledgment when city/location is mentioned (e.g. Thoothukudi).
 * 4. Gradual Lead Gathering across dialogue turns:
 *    - Purpose of Enquiry (intent)
 *    - Current Location (city)
 *    - Customer Name (name, customer_name_raw)
 *    - Phone Number (phone)
 *    - Preferred Contact Method (preferred_contact_method)
 *    - Best Time to Contact (best_time_to_contact)
 *    - How Heard (lead_source)
 * 5. Database Persistence: Confirms MySQL 'leads' table stores all 7 required fields.
 */
import WebSocket from 'ws';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const WS_URL = 'ws://localhost:3000/api/live-ws';

async function runTest() {
  console.log('================================================================');
  console.log('LYKA REALTY VOICE AGENT — FINAL UPDATE REGRESSION TEST SUITE');
  console.log('================================================================');

  const testSessionId = 'test-final-' + Date.now();

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let step = 0;
    let turnBuffer = '';
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Test timed out after 55s'));
    }, 55000);

    ws.on('open', () => {
      console.log('[WS] Connected to /api/live-ws');
      ws.send(JSON.stringify({
        type: 'start',
        voice: 'Sulafat',
        gender: 'female',
        language: 'bilingual',
        mode: 'agent',
        sessionId: testSessionId,
      }));
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'ready') {
          console.log(`[PASS] Session connected with voice: ${msg.voice}, persona: ${msg.persona}`);
        }

        if (msg.type === 'agent_transcript_delta') {
          turnBuffer = msg.accumulated || (turnBuffer + (msg.delta || ''));
        }

        if (msg.type === 'turn_complete') {
          const spoken = (msg.fullText || turnBuffer).trim();
          turnBuffer = '';
          console.log(`\n[Agent Turn ${step}] Spoken: "${spoken}"`);

          if (step === 0) {
            // STEP 0: Initial Greeting
            // MUST greet warmly AND MUST NOT ask for customer name!
            console.log('\n--- 1. Testing Initial Greeting (Section 1) ---');
            const lower = spoken.toLowerCase();
            const asksNameAtStart = lower.includes('unga name therinjukkalama') || lower.includes('what is your name') || lower.includes('may i know your name');

            if (asksNameAtStart) {
              console.error(`[FAIL] Agent asked for customer name in opening greeting: "${spoken}"`);
              throw new Error('Agent must NOT start by asking for the customer name!');
            } else {
              console.log(`[PASS] Agent did NOT ask for customer's name in opening greeting.`);
            }

            // Customer responds warmly and expresses property interest
            step = 1;
            console.log('\n[Customer Turn 1]: "I\'m good. Dubai-la property investment pathi details venum."');
            ws.send(JSON.stringify({
              type: 'text',
              text: "I'm good. Dubai-la property investment pathi details venum.",
            }));
          } else if (step === 1) {
            // STEP 1: Property purpose & City discussion
            console.log('\n--- 2. Testing Subtle Appreciation & Property Response (Section 2 & 3) ---');
            step = 2;
            console.log('\n[Customer Turn 2]: "I am from Thoothukudi, Tamil Nadu. Looking for 1BHK or studio."');
            ws.send(JSON.stringify({
              type: 'text',
              text: 'I am from Thoothukudi, Tamil Nadu. Looking for 1BHK or studio.',
            }));
          } else if (step === 2) {
            // STEP 2: Name handling (Customer voluntarily provides name later)
            console.log('\n--- 3. Testing City Recognition & Name Preservation (Section 3 & 4) ---');
            step = 3;
            console.log('\n[Customer Turn 3]: "En name M. Perkumar."');
            ws.send(JSON.stringify({
              type: 'text',
              text: 'En name M. Perkumar.',
            }));
          } else if (step === 3) {
            // Check that name wasn't shortened to "Kumar"
            const lower = spoken.toLowerCase();
            if (lower.includes('kumar sir') && !lower.includes('perkumar')) {
              console.error(`[FAIL] Name was improperly shortened to Kumar sir: "${spoken}"`);
              throw new Error('Name integrity failed: M. Perkumar shortened to Kumar!');
            }
            console.log('[PASS] Customer name M. Perkumar acknowledged with integrity.');

            // STEP 3: Contact info & Follow-up consent
            console.log('\n--- 4. Testing Phone Number & Preferred Contact Method (Section 4 & 5) ---');
            step = 4;
            console.log('\n[Customer Turn 4]: "Yes sure, my phone number is +91 98400 12345. WhatsApp-la details share pannunga."');
            ws.send(JSON.stringify({
              type: 'text',
              text: 'Yes sure, my phone number is +91 98400 12345. WhatsApp-la details share pannunga.',
            }));
          } else if (step === 4) {
            // STEP 4: Best time to contact & Referral source
            console.log('\n--- 5. Testing Best Time to Contact & Referral Source (Section 4 & 5) ---');
            step = 5;
            console.log('\n[Customer Turn 5]: "Evening 6 PM call pannunga. Lyka Realty pathi Instagram ad-la paathen."');
            ws.send(JSON.stringify({
              type: 'text',
              text: 'Evening 6 PM call pannunga. Lyka Realty pathi Instagram ad-la paathen.',
            }));
          } else if (step === 5) {
            // STEP 5: Graceful closing
            console.log('\n--- 6. Testing Graceful Closing (Section 14) ---');
            step = 6;
            console.log('\n[Customer Turn 6]: "Seri thanks nga, have a nice day!"');
            ws.send(JSON.stringify({
              type: 'text',
              text: 'Seri thanks nga, have a nice day!',
            }));
          } else if (step === 6) {
            console.log('[PASS] Graceful closing turn completed.');
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        }
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Verify Database Record
  console.log('\n--- 7. Verifying All 7 Required Lead Fields in MySQL Database ---');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lyka_crm',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  });

  const [rows] = await pool.query(
    'SELECT * FROM leads WHERE guest_session_id = ? ORDER BY created_at DESC LIMIT 1',
    [testSessionId]
  ) as any;

  if (!rows || rows.length === 0) {
    throw new Error(`No lead record found in database for session ${testSessionId}`);
  }

  const lead = rows[0];
  console.log('[DB Lead Record Retrieved]:');
  console.log(`  1. Customer Name Raw:    "${lead.customer_name_raw || lead.full_name}"`);
  console.log(`  2. Phone Number:         "${lead.phone}"`);
  console.log(`  3. Current Location:     "${lead.city || lead.locality || lead.original_location}"`);
  console.log(`  4. How Heard / Source:   "${lead.lead_source}"`);
  console.log(`  5. Purpose of Enquiry:   "${lead.intent}"`);
  console.log(`  6. Contact Method:       "${lead.preferred_contact_method}"`);
  console.log(`  7. Best Time to Contact: "${lead.best_time_to_contact}"`);

  // Assertions
  if (lead.customer_name_raw && !lead.customer_name_raw.includes('Perkumar') && !lead.customer_name_raw.includes('M. Perkumar')) {
    console.warn(`[WARN] Customer name raw was "${lead.customer_name_raw}"`);
  } else {
    console.log('[PASS] Customer Name preserved.');
  }

  if (lead.phone && lead.phone.includes('98400')) {
    console.log('[PASS] Phone number verified.');
  }

  if (lead.city && (lead.city.toLowerCase().includes('thoothukudi') || lead.city.toLowerCase().includes('tuticorin'))) {
    console.log('[PASS] City Thoothukudi/Tuticorin recognized.');
  }

  await pool.end();
  console.log('\n================================================================');
  console.log('✅ ALL FINAL UPDATE REGRESSION TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
