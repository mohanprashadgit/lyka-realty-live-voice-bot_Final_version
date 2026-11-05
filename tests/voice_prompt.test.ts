// Focused checks for the live voice agent's conversational prompt (server.ts getSystemInstruction).
// The prompt builder is read from server.ts source, so the test does not start the server.
// Run: node --import tsx --test tests/voice_prompt.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const from = serverSource.indexOf('function getAgentPersona(');
const to = serverSource.indexOf('// Real-time API usage and live quota tracking');
assert.ok(from > 0 && to > from, 'prompt builder not found in server.ts');

const js = stripTypeScriptTypes(serverSource.slice(from, to));
const getSystemInstruction = new Function(`${js}\nreturn getSystemInstruction;`)() as (
  language?: string,
  gender?: 'female' | 'male',
  customName?: string,
  leadName?: string,
  voiceName?: string,
) => string;

const tamilPrompt = getSystemInstruction('bilingual', 'female');

test('opening greeting is short, warm and asks for time, not the name', () => {
  assert.ok(
    tamilPrompt.includes('"Hello! Eppadi irukkeenga? Naan Priya, Lyka Realty-la irundhu pesuren. Ungalukku ippo konjam time irukka?"'),
    'greeting line missing',
  );
  assert.ok(!tamilPrompt.includes('Hello sir!'), 'old "Hello sir!" greeting still present');
  assert.ok(!tamilPrompt.includes('Ask at the opening'), 'name must not be asked at the opening');
  assert.ok(tamilPrompt.includes('Step 2b - Name, Only Later'), 'name must be deferred to a later step');
});

test('no placeholder leaks into the prompt when the lead name is missing', () => {
  // Regression: the prompt used to render "Hello undefined!" when no lead name was passed.
  assert.ok(!tamilPrompt.includes('undefined'), 'prompt contains the literal word "undefined"');
  const named = getSystemInstruction('bilingual', 'female', undefined, 'Ramesh Kumar');
  assert.ok(!named.includes('undefined'), 'named prompt contains "undefined"');
  assert.ok(named.includes('Use only a name you were actually given.'), 'known-name rule missing');
});

test('no example name is baked into the prompt', () => {
  assert.ok(!tamilPrompt.includes('Ramesh sir'), 'an example name is still baked into the prompt');
  assert.ok(!tamilPrompt.includes('Neenga Ramesh'), 'an example name is still baked into the prompt');
});

test('gender is not assumed from the voice, and sir/madam is rationed', () => {
  assert.ok(!tamilPrompt.includes('If a woman is on the line'), 'gender inferred from the caller');
  assert.ok(tamilPrompt.includes('Never guess gender from the voice'), 'gender guard missing');
  const honorifics = tamilPrompt.match(/\bsir\b/gi) ?? [];
  assert.ok(honorifics.length <= 15, `too many "sir" honorifics in the prompt: ${honorifics.length}`);
});

test('language adapts turn by turn in Tamil/Tanglish mode', () => {
  assert.ok(tamilPrompt.includes('LANGUAGE ADAPTS TURN BY TURN'), 'adaptive language rule missing');
  assert.ok(tamilPrompt.includes('Full English sentences in'), 'English-in / English-out rule missing');
  assert.ok(!tamilPrompt.includes('never switch to full English mid-call'), 'old no-English rule still present');
  assert.ok(tamilPrompt.includes('Never Tamil Unicode script'), 'Latin transcript rule should be kept');
});

test('English and Hindi/Arabic locks override the Tanglish sections', () => {
  const english = getSystemInstruction('english', 'female');
  assert.ok(english.includes('STRICT LANGUAGE LOCK: ENGLISH ONLY!'), 'English lock missing');
  assert.ok(english.includes('This lock overrides every Tanglish, Tamil or language rule'), 'English override missing');
  const hindi = getSystemInstruction('hindi', 'male', undefined, undefined, 'Zubenelgenubi');
  assert.ok(hindi.includes('STRICT LANGUAGE LOCK: HINDI'), 'Hindi lock missing');
  assert.ok(hindi.includes('Stay in Hindi for the whole call.'), 'Hindi override missing');
  const arabic = getSystemInstruction('arabic', 'male');
  assert.ok(arabic.includes('Stay in Arabic for the whole call.'), 'Arabic override missing');
});

test('male persona name is used when the agent is male', () => {
  const male = getSystemInstruction('bilingual', 'male');
  assert.ok(male.includes('You are Harish, Lyka Realty'), 'male persona name missing');
});

test('lead-qualification and safety rules are kept, not weakened', () => {
  assert.ok(tamilPrompt.includes('OBJECTION HANDLING - EXACTLY THREE LEVELS'), 'three-level objection rule removed');
  assert.ok(tamilPrompt.includes('"OPT_OUT"'), 'do-not-call status instruction removed');
  assert.ok(tamilPrompt.includes("'update_lead_info'"), 'CRM tool instruction removed');
  assert.ok(tamilPrompt.includes('Answer truthfully without making excuses'), 'AI-disclosure answer rule removed');
  assert.ok(tamilPrompt.includes('UNWANTED / ROMANTIC SPEECH'), 'unwanted-speech rule removed');
  assert.ok(tamilPrompt.includes('https://lykarealty.com'), 'verified website reference removed');
  assert.ok(tamilPrompt.includes('CUSTOMER NAME INTEGRITY'), 'name integrity rule removed');
});

test('lead source extraction rules are kept', () => {
  assert.ok(tamilPrompt.includes('Canonical categories: WhatsApp, Email, YouTube'), 'lead_source categories removed');
  assert.ok(tamilPrompt.includes('Unknown / Not Mentioned. Never guess based on their city'), 'lead_source guard removed');
});

test('invented or unverified claims are gone from the prompt', () => {
  for (const claim of [
    '80% varai possible',
    'six to eight percent',
    'payment plan-la adjust',
    'this weekend site visit',
    'Saturday evening',
    'net rental yields',
    'Premier real estate',
  ]) {
    assert.ok(!tamilPrompt.includes(claim), `unverified claim still present: "${claim}"`);
  }
  assert.ok(tamilPrompt.includes('Never claim an enquiry that is not in the call context'), 'enquiry guard missing');
});

test('harsh-customer, trust and site-visit guidance is present', () => {
  assert.ok(tamilPrompt.includes('HARSH, ANGRY OR IRRITATED CUSTOMERS'), 'harsh-customer section missing');
  assert.ok(tamilPrompt.includes('Apologize once, briefly'), 'single-apology rule missing');
  assert.ok(tamilPrompt.includes('TRUST, PROJECT QUESTIONS AND SITE VISITS'), 'trust section missing');
  assert.ok(tamilPrompt.includes('you have no live inventory in this call'), 'inventory guard missing');
  assert.ok(tamilPrompt.includes('never as a booked slot'), 'site-visit booking guard missing');
});

test('the default system prompt does not contain the old single-script "Sir, Sir" pattern', () => {
  assert.ok(!/Sir, Sir|sir, sir|madam, madam/i.test(tamilPrompt), 'repeated honorific pattern found');
});

test('live call openers in server.ts no longer ask for the name or use "Hello sir!" at the start', () => {
  assert.ok(!serverSource.includes('May I know who I have the pleasure of speaking with today?'),
    'English opener still asks for the name immediately');
  assert.ok(!serverSource.includes('Is this a good time to speak for a moment?'),
    'Twilio opener still uses the old time question');
  assert.ok(serverSource.includes('Ungalukku ippo konjam time irukka?'), 'new time-check greeting missing from openers');
});
