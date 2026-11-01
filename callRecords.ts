import { Router, type RequestHandler } from 'express';
import { getPool } from './db.js';
import { verifyToken } from './authHelper.js';
import { saveMessage } from './leadService.js';

let schemaReady: Promise<void> | undefined;
export function ensureCallRecords(): Promise<void> {
  return schemaReady ||= (async () => {
    await getPool().query(`CREATE TABLE IF NOT EXISTS voice_call_details (
      call_id VARCHAR(36) PRIMARY KEY, snapshot JSON, summary TEXT,
      outcome VARCHAR(20), end_reason VARCHAR(60), deleted_at TIMESTAMP NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await getPool().query(`CREATE TABLE IF NOT EXISTS voice_record_deletions (
      lead_id VARCHAR(36) PRIMARY KEY, deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actor VARCHAR(100) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  })().catch(error => { schemaReady = undefined; throw error; });
}

const outcomes = new Set(['HOT', 'WARM', 'COLD', 'PENDING', 'REACH_AGAIN', 'OPT_OUT', 'UNWANTED']);
/** Only an explicit server termination reason can classify a call as unwanted. */
export function callOutcome(reason?: string, qualification?: string): string {
  if (['unwanted_speech', 'out_of_scope', 'customer_declined', 'do_not_call'].includes(reason || '')) return 'UNWANTED';
  return qualification && outcomes.has(qualification) && qualification !== 'UNWANTED' ? qualification : 'PENDING';
}

export async function saveCallDetails(callId: string, snapshot: Record<string, any>, reason?: string) {
  await ensureCallRecords();
  const summary = typeof snapshot.notes === 'string' ? snapshot.notes : null;
  const outcome = reason ? callOutcome(reason, snapshot.qualification_status) :
    snapshot.qualification_status ? callOutcome(undefined, snapshot.qualification_status) : null;
  await getPool().query(`INSERT INTO voice_call_details (call_id, snapshot, summary, outcome, end_reason)
    VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
    snapshot = JSON_MERGE_PATCH(COALESCE(snapshot, JSON_OBJECT()), VALUES(snapshot)),
    summary = COALESCE(VALUES(summary), summary),
    outcome = IF(outcome = 'UNWANTED', outcome, COALESCE(VALUES(outcome), outcome)),
    end_reason = COALESCE(VALUES(end_reason), end_reason)`,
    [callId, JSON.stringify(snapshot), summary, outcome, reason || null]);
}

/** One writer per call keeps partials/finals ordered and retries transient database failures. */
export class CallJournal {
  private tail = Promise.resolve();
  private sequence = new Map<string, number>();
  private turns = new Map<string, { role: string; text: string }>();
  private hasSummary = false;
  constructor(readonly callId: string, private report: (error: unknown) => void) {}
  enqueue(work: () => Promise<unknown>) {
    this.tail = this.tail.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await work(); return; } catch (error) {
          if (attempt === 2) { this.report(error); return; }
          await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
    });
  }
  turn(role: string, text: string, id: string) {
    if (!text || !id) return;
    this.turns.set(id, { role, text });
    if (!this.sequence.has(id)) this.sequence.set(id, this.sequence.size + 1);
    const type = `voice:${String(this.sequence.get(id)).padStart(9, '0')}`;
    this.enqueue(async () => {
      if (!await saveMessage(this.callId, role, text, type, id)) throw new Error('Transcript save failed');
    });
  }
  details(snapshot: Record<string, any>, reason?: string) {
    if (snapshot.notes) this.hasSummary = true;
    this.enqueue(() => saveCallDetails(this.callId, snapshot, reason));
  }
  finish(reason?: string, facts: Record<string, any> = {}) {
    if (!this.hasSummary || reason) {
      const statements = [...this.turns.values()].filter(t => t.role === 'user').map(t => t.text.trim()).filter(Boolean);
      const notes = facts.notes || (statements.length ? `Customer statements: ${statements.slice(0, 3).join(' ').slice(0, 2000)}` : 'No customer speech was transcribed.');
      this.details({ ...facts, notes }, reason);
    }
  }
  drain() { return this.tail; }
}

/** Standalone local operator access; remote access requires a signed employee session.
 * Never trust forwarded IP/role headers. Cross-site requests cannot use local access. */
export const recordsAccess: RequestHandler = async (req, res, next) => {
  try {
    const host = new URL(`http://${req.headers.host || ''}`).hostname;
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(host) && !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-host'];
    const origin = req.headers.origin;
    if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== req.headers.host)) {
      res.status(403).json({ success: false, error: 'Cross-origin records access denied.' }); return;
    }
    if (local) { res.locals.recordActor = 'local-operator'; await ensureCallRecords(); next(); return; }
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const user = process.env.AUTH_SECRET && token ? verifyToken(token) : null;
    if (!user) { res.status(401).json({ success: false, error: 'Employee sign-in required.' }); return; }
    const [rows]: any = await getPool().query('SELECT role FROM employees WHERE id = ?', [user.id]);
    const allowed = ['Super Admin', 'Operations Admin', 'Lead Management Executive'];
    if (!allowed.includes(rows[0]?.role)) { res.status(403).json({ success: false, error: 'Records access denied.' }); return; }
    res.locals.recordActor = user.id;
    await ensureCallRecords(); next();
  } catch { res.status(503).json({ success: false, error: 'Records storage unavailable. Please retry.' }); }
};

function parseJSON(value: any) {
  try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; }
}
export async function readCalls(id?: string) {
  await ensureCallRecords();
  const [rows]: any = await getPool().query(`SELECT c.*, d.snapshot, d.summary, d.outcome, d.end_reason,
      l.full_name, l.customer_name_raw, l.phone
    FROM conversations c LEFT JOIN voice_call_details d ON CAST(d.call_id AS BINARY) = CAST(c.id AS BINARY)
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.channel = 'voice' AND d.deleted_at IS NULL ${id ? 'AND c.id = ?' : ''}
    ORDER BY c.started_at DESC, c.id DESC`, id ? [id] : []);
  if (!rows.length) return [];
  const [messages]: any = await getPool().query(`SELECT id, conversation_id, role, content, message_type, created_at
    FROM conversation_messages WHERE conversation_id IN (?) ORDER BY created_at, message_type, id`, [rows.map((r: any) => r.id)]);
  return rows.map((r: any) => {
    const snapshot = parseJSON(r.snapshot);
    const all = messages.filter((m: any) => m.conversation_id === r.id);
    // Ordinal metadata is authoritative for newly recorded turns, including subsecond ties.
    const speech = all.filter((m: any) => m.message_type !== 'call_metadata');
    if (speech.length && speech.every((m: any) => /^voice:\d+$/.test(m.message_type))) {
      speech.sort((a: any, b: any) => Number(a.message_type.slice(6)) - Number(b.message_type.slice(6)));
    }
    const phoneMeta = parseJSON(all.find((m: any) => m.message_type === 'call_metadata')?.content);
    const agentName = snapshot.agent_name || snapshot.agentName || 'Priya';
    return {
      callId: r.id, leadId: r.lead_id || '', leadName: snapshot.customer_name_raw || snapshot.name || r.customer_name_raw || r.full_name || 'Unknown customer',
      leadPhone: snapshot.phone || r.phone || '', startedAt: r.started_at, endedAt: r.ended_at || '',
      duration: r.ended_at ? Math.max(0, Math.round((+new Date(r.ended_at) - +new Date(r.started_at)) / 1000)) : 0,
      callStatus: ['failed', 'busy', 'canceled'].includes(phoneMeta.status) ? 'FAILED' : phoneMeta.status === 'no-answer' ? 'NO_ANSWER' : r.ended_at ? 'COMPLETED' : 'CONNECTED',
      outcome: r.outcome || 'PENDING', summary: r.summary || '', endReason: r.end_reason || '',
      location: snapshot.location || snapshot.city || '', propertyType: snapshot.property_type || '',
      interest: snapshot.intent || snapshot.property_type || '',
      buyerType: snapshot.buyer_type || '',
      budget: snapshot.budget || (snapshot.budget_max != null ? String(snapshot.budget_max) : ''),
      timeline: snapshot.timeline || '',
      nextAction: snapshot.next_action || '',
      transcript: speech.map((m: any) => { const isAgent = ['assistant', 'agent'].includes(m.role); return { id: m.id,
        role: isAgent ? 'agent' : m.role === 'system' ? 'system' : 'user',
        speaker: isAgent ? 'agent' : 'customer',
        agentName: isAgent ? agentName : undefined,
        text: m.content, timestamp: m.created_at ? new Date(m.created_at).toISOString() : '' }; }),
    };
  });
}

export const callRecordsRouter = Router();
callRecordsRouter.use(['/calls', '/records'], recordsAccess);
callRecordsRouter.get('/calls', async (_req, res) => {
  try { res.json({ success: true, calls: await readCalls() }); }
  catch { res.status(503).json({ success: false, error: 'Call history unavailable. Please retry.' }); }
});
callRecordsRouter.get('/calls/:id', async (req, res) => {
  if (!/^[a-zA-Z0-9_-]{1,36}$/.test(req.params.id)) { res.status(400).json({ success: false, error: 'Invalid call ID.' }); return; }
  try {
    const call = (await readCalls(req.params.id))[0];
    res.status(call ? 200 : 404).json(call ? { success: true, call } : { success: false, error: 'Call not found.' });
  } catch { res.status(503).json({ success: false, error: 'Conversation unavailable. Please retry.' }); }
});

callRecordsRouter.post('/records/delete', async (req, res) => {
  const { kind, ids, confirmed, includeCalls } = req.body || {};
  if (!['leads', 'calls'].includes(kind) || confirmed !== true || !Array.isArray(ids) || !ids.length || ids.length > 100 ||
      ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,36}$/.test(id)) || (includeCalls !== undefined && typeof includeCalls !== 'boolean')) {
    res.status(400).json({ success: false, error: 'Confirm a selection of 1–100 valid records.' }); return;
  }
  const unique = [...new Set(ids)];
  let db;
  try {
    db = await getPool().getConnection(); await db.beginTransaction();
    // Deletion is reversible hiding. Calls/transcripts are never physically erased.
    if (kind === 'leads') {
      const [leads]: any = await db.query('SELECT id FROM leads WHERE id IN (?) FOR UPDATE', [unique]);
      if (leads.length !== unique.length) { await db.rollback(); res.status(404).json({ success: false, error: 'One or more leads were not found.' }); return; }
      for (const id of unique) await db.query('INSERT IGNORE INTO voice_record_deletions (lead_id, actor) VALUES (?, ?)', [id, res.locals.recordActor]);
    }
    if (kind === 'calls' || includeCalls === true) {
      const [calls]: any = await db.query(`SELECT id, ended_at FROM conversations WHERE ${kind === 'calls' ? 'id' : 'lead_id'} IN (?) AND channel = 'voice' FOR UPDATE`, [unique]);
      if (kind === 'calls' && calls.length !== unique.length) { await db.rollback(); res.status(404).json({ success: false, error: 'One or more calls were not found.' }); return; }
      // Allow deletion of stale/orphaned CONNECTED sessions (no ended_at and started more than 30 min ago).
      // Only block deletion of calls that appear genuinely in-progress (started within 30 minutes and no ended_at).
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const activeCalls = calls.filter((c: any) => !c.ended_at && c.started_at && new Date(c.started_at) > thirtyMinAgo);
      if (activeCalls.length > 0) { await db.rollback(); res.status(409).json({ success: false, error: 'One or more calls appear to be in progress. End active calls before deleting them.' }); return; }
      for (const c of calls) await db.query(`INSERT INTO voice_call_details (call_id, deleted_at) VALUES (?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)`, [c.id]);
    }
    await db.commit(); res.json({ success: true, deleted: unique.length });
  } catch { if (db) await db.rollback(); res.status(503).json({ success: false, error: 'Deletion was not saved. Please retry.' }); }
  finally { db?.release(); }
});
