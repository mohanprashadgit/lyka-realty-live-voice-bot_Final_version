import assert from 'node:assert/strict';
import fs from 'node:fs';
import WebSocket from 'ws';

const ids = JSON.parse(fs.readFileSync('scratch/call-records-test-ids.json', 'utf8'));
const target = await (await fetch('http://127.0.0.1:9227/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.once('open', resolve));
let sequence = 0;
const pending = new Map();
ws.on('message', raw => { const message = JSON.parse(raw); if (message.id) { const callbacks = pending.get(message.id); pending.delete(message.id); message.error ? callbacks.reject(message.error) : callbacks.resolve(message.result); } });
ws.on('message', raw => { const message = JSON.parse(raw); if (message.method === 'Runtime.exceptionThrown') console.error('Browser exception:', JSON.stringify(message.params.exceptionDetails)); });
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
}
const clickText = text => evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Button not found'); button.click(); })()`);
const callRow = id => `[...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes(${JSON.stringify(id)}))`;
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:3000' });
  await until(`document.body.innerText.includes('Leads & calls')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('nav button')].some(b => /Call History/i.test(b.textContent))`), false);
  await clickText('Leads & calls');
  await until(`document.body.innerText.includes('Prospect Leads')`);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Call History')).click()`);
  await until(`Boolean(${callRow(ids.a.id)})`);
  await evaluate(`${callRow(ids.a.id)}.querySelector('button').click()`);
  await until(`document.body.innerText.includes('Call Transcript')`);
  const body = await evaluate('document.body.innerText');
  assert.ok(body.includes('TEST: customer requests an OMR apartment.'));
  assert.ok(body.indexOf('I want an OMR apartment.') < body.indexOf('What is your budget?'));
  assert.ok(body.indexOf('What is your budget?') < body.indexOf('75 lakh.'));
  assert.ok(!body.includes('Invalid Date'));
  await clickText('Close');
  await clickText('UNWANTED');
  await until(`Boolean(${callRow(ids.b.id)}) && !(${callRow(ids.a.id)})`);
  await evaluate(`${callRow(ids.b.id)}.querySelector('button').click()`);
  await until(`document.body.innerText.includes('Call Transcript')`);
  assert.ok((await evaluate('document.body.innerText')).includes('I can help with property enquiries.'));
  await clickText('Close');
  await evaluate(`[...${callRow(ids.b.id)}.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete').click()`);
  await until(`Boolean(document.querySelector('[role="dialog"]'))`);
  await clickText('Cancel');
  assert.ok(await evaluate(`Boolean(${callRow(ids.b.id)})`), 'Cancel preserves call');
  // Exercise bulk confirmation/cancel; the integration suite tests committed bulk deletion.
  await clickText('ALL');
  await until(`Boolean(${callRow(ids.a.id)})`);
  await evaluate(`document.querySelector('input[aria-label="Select call ${ids.a.id}"]').click()`);
  await evaluate(`document.querySelector('input[aria-label="Select call ${ids.b.id}"]').click()`);
  await clickText('Delete selected (2)');
  await until(`document.querySelector('[role="dialog"]').textContent.includes('Delete 2 call(s)')`);
  await clickText('Cancel');
  assert.equal((await (await fetch(`http://127.0.0.1:3000/api/calls/${ids.a.id}`)).json()).call.transcript.length, 3);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Prospect Leads')).click()`);
  await until(`document.body.innerText.includes('TEST Records Customer B')`);
  await evaluate(`[...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes('TEST Records Customer B')).querySelector('button').click()`);
  await until(`Boolean(document.querySelector('[role="dialog"]'))`);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] input[type="checkbox"]').checked`), false, 'lead deletion defaults to keeping calls');
  await clickText('Cancel');
  const reloaded = new Promise(resolve => {
    const listener = raw => { if (JSON.parse(raw).method === 'Page.loadEventFired') { ws.off('message', listener); resolve(); } };
    ws.on('message', listener);
  });
  await send('Page.reload');
  await reloaded;
  await until(`document.body.innerText.includes('Leads & calls')`);
  await clickText('Leads & calls');
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Call History')).click()`);
  await until(`Boolean(${callRow(ids.a.id)})`);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/records-browser-verification.png', Buffer.from(screenshot.data, 'base64'));
  console.log('PASS: real browser navigation, correct View/transcript/summary, UNWANTED filter, single/bulk confirmation cancel, lead-call protection default, and refresh persistence');
} finally { await send('Page.close').catch(() => {}); ws.close(); }
