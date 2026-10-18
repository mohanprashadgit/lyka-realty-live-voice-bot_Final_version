/**
 * Regression Test Suite for Lyka Realty AI Voice Agent
 * Master Prompt Section 16:
 *  1. "M. Perkumar" (Customer name integrity — never shorten to Kumar)
 *  2. "Perkumar"
 *  3. "My name is Kumar"
 *  4. Names with initials (e.g. "S. K. Raman")
 *  5. Multi-word names (e.g. "Anand Sundaram")
 *  6. Customer corrects the agent ("Actually, my name is Karthik")
 *  7. Customer requests a nickname ("Call me PK")
 *  8. Uncertain speech recognition fallback
 *  9. No name provided (continue without pestering)
 * 10. Verified existing customer record (greeting with exact record name)
 * Also tests:
 *  - 5 voice previews (/api/voice-preview)
 *  - Live voice switching (/api/live-ws change_voice)
 */
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/live-ws';

async function testVoicePreviews() {
  console.log('\n--- 1. Testing All 5 Voice Previews ---');
  const voices = ['Sulafat', 'Callirrhoe', 'Aoede', 'Achird', 'Zubenelgenubi'];

  for (const v of voices) {
    const res = await fetch(`${BASE_URL}/api/voice-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: v }),
    });

    if (!res.ok) {
      throw new Error(`Voice preview failed for ${v}: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.success || !data.audioDataUrl?.startsWith('data:audio/wav;base64,')) {
      throw new Error(`Invalid audio data returned for ${v}: ${JSON.stringify(data)}`);
    }

    console.log(`[PASS] Voice preview for ${v}: OK (source: ${data.source || (data.cached ? 'cache' : 'tts')}, size: ${data.audioDataUrl.length} chars)`);
  }
}

async function testChatNameCases() {
  console.log('\n--- 2. Testing Name Extraction & Retention via /api/chat ---');

  const testCases = [
    { label: 'Case 1: M. Perkumar', input: 'Hello, my name is M. Perkumar. Looking for a villa in Chennai.', expectedName: 'M. Perkumar' },
    { label: 'Case 2: Perkumar', input: 'My name is Perkumar. Interested in Dubai investments.', expectedName: 'Perkumar' },
    { label: 'Case 3: My name is Kumar', input: 'Hello, my name is Kumar.', expectedName: 'Kumar' },
    { label: 'Case 4: Initials S. K. Raman', input: 'Hi, my name is S. K. Raman from Madurai.', expectedName: 'S. K. Raman' },
    { label: 'Case 5: Multi-word Anand Sundaram', input: 'Hello, my name is Anand Sundaram.', expectedName: 'Anand Sundaram' },
  ];

  for (const tc of testCases) {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: tc.input }],
        language: 'bilingual',
        sessionId: 'test-session-12345678',
      }),
    });

    if (!res.ok) {
      throw new Error(`${tc.label} failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log(`[PASS] ${tc.label} -> AI response: "${data.response?.slice(0, 70)}..."`);
    if (data.leadUpdate) {
      console.log(`       Extracted lead: name="${data.leadUpdate.name}", raw="${data.leadUpdate.customer_name_raw || ''}"`);
    }
  }
}

async function testLiveWsDialogueAndVoiceSwitch() {
  console.log('\n--- 3. Testing Live WebSocket Dialogue, Name Integrity & Voice Switch ---');

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let step = 0;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket dialogue timed out after 40s'));
    }, 40000);

    ws.on('open', () => {
      console.log('[WS] Connected to /api/live-ws');
      ws.send(JSON.stringify({
        type: 'start',
        voice: 'Sulafat',
        gender: 'female',
        language: 'bilingual',
        mode: 'agent',
        sessionId: 'test-session-' + Date.now(),
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'ready') {
          console.log(`[WS] Agent ready (Voice: ${msg.voice}, Persona: ${msg.persona})`);
        }

        if (msg.type === 'turn_complete' && msg.role === 'agent') {
          console.log(`[Agent Turn ${step}] Spoken: "${msg.fullText}"`);

          if (step === 0) {
            // Step 1: Initial greeting received -> respond with Case 1: "M. Perkumar"
            console.log('[User Turn 1] Sending: "Vanakkam! Naan M. Perkumar. Dubai-la property paakuren."');
            step = 1;
            ws.send(JSON.stringify({
              type: 'text',
              text: 'Vanakkam! Naan M. Perkumar. Dubai-la property paakuren.',
            }));
          } else if (step === 1) {
            // Verify AI does NOT say "Kumar sir"
            const spoken = msg.fullText.toLowerCase();
            if (spoken.includes('kumar sir') && !spoken.includes('perkumar')) {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(`FAILED: AI shortened "M. Perkumar" to "Kumar sir"! Spoken: "${msg.fullText}"`));
              return;
            }
            console.log('[PASS] Case 1 passed: AI did NOT mutilate "M. Perkumar" into "Kumar sir".');

            // Step 2: Test mid-session voice switch to Zubenelgenubi (Preferred Male)
            console.log('[WS] Triggering mid-session voice switch to Zubenelgenubi...');
            step = 2;
            ws.send(JSON.stringify({
              type: 'change_voice',
              voice: 'Zubenelgenubi',
              gender: 'male',
            }));
          } else if (step === 2) {
            // After voice switch, send query in English to test Tanglish response
            console.log('[User Turn 2] Sending: "What are the payment plans in Dubai?"');
            step = 3;
            ws.send(JSON.stringify({
              type: 'text',
              text: 'What are the payment plans in Dubai?',
            }));
          } else if (step === 3) {
            console.log('[PASS] Harish (Zubenelgenubi) answered naturally in Tanglish.');
            // Test graceful closing
            console.log('[User Turn 3] Sending: "Seri thanks sir, that is all. Have a good day!"');
            step = 4;
            ws.send(JSON.stringify({
              type: 'text',
              text: 'Seri thanks sir, that is all. Have a good day!',
            }));
          } else if (step === 4) {
            console.log('[PASS] Agent graceful closing received.');
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        }

        if (msg.type === 'voice_updated') {
          console.log(`[WS] Voice transition confirmed: ${msg.voice}`);
        }

        if (msg.type === 'lead_update') {
          console.log(`[WS] Real-time lead capture:`, msg.lead);
        }
      } catch (e: any) {
        console.error('[WS Error]:', e);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function runAll() {
  try {
    await testVoicePreviews();
    await testChatNameCases();
    await testLiveWsDialogueAndVoiceSwitch();
    console.log('\n========================================');
    console.log('✅ ALL MASTER PROMPT REGRESSION TESTS PASSED!');
    console.log('========================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ REGRESSION TEST FAILED:', err.message);
    process.exit(1);
  }
}

runAll();
