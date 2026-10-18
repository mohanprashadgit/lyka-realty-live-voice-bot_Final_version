/**
 * leadService.ts — Single shared lead service for both /api/chat and /api/live-ws.
 * 
 * Both text and voice call the same functions here. This prevents duplicate
 * leads, inconsistent field saves, or divergent validation.
 */
import { v4 as uuidv4 } from 'uuid';
import { getPool } from './db.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface LeadPayload {
  // Identity
  name?: string;
  customer_name_raw?: string;
  customer_preferred_name?: string;
  phone?: string;
  email?: string;
  current_city?: string;
  country?: string;
  lead_source?: string;
  // Intent
  intent?: string;
  // Property
  property_type?: string;
  state_province?: string;
  city?: string;
  locality?: string;
  location?: string;          // raw location string from AI
  budget?: string;
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  rental_period?: string;
  property_size?: string;
  area_unit?: string;
  bedrooms?: string;
  bathrooms?: string;
  amenities?: string;
  timeline?: string;
  // Qualification
  qualification_status?: string;
  stage_reached?: number;
  notes?: string;
  // Buyer type (legacy compat)
  buyer_type?: string;
}

export interface SaveResult {
  success: boolean;
  leadId: string;
  isNew: boolean;
  error?: string;
}

// ─── Normalize phone ─────────────────────────────────────────────────

function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  // Strip everything except digits and leading +
  return raw.replace(/[^\d+]/g, '') || null;
}

// ─── Parse budget string into min/max ─────────────────────────────────

function parseBudget(raw?: string): { min: number | null; max: number | null; currency: string | null } {
  if (!raw) return { min: null, max: null, currency: null };

  let currency: string | null = null;
  const currencyPatterns: [RegExp, string][] = [
    [/₹|INR|(?:lakh|crore|cr)/i, 'INR'],
    [/AED|dirham/i, 'AED'],
    [/\$|USD/i, 'USD'],
    [/£|GBP/i, 'GBP'],
    [/€|EUR/i, 'EUR'],
    [/SGD/i, 'SGD'],
  ];
  for (const [pat, code] of currencyPatterns) {
    if (pat.test(raw)) { currency = code; break; }
  }

  // Try to extract numeric range like "1M - 2M" or single value
  const nums = raw.match(/[\d.]+/g);
  if (!nums) return { min: null, max: null, currency };

  const multiplierMatch = raw.match(/(crore|cr|lakh|million|m|k|billion|b)/i);
  let multiplier = 1;
  if (multiplierMatch) {
    const m = multiplierMatch[1].toLowerCase();
    if (m === 'k') multiplier = 1_000;
    else if (m === 'lakh') multiplier = 100_000;
    else if (m === 'm' || m === 'million') multiplier = 1_000_000;
    else if (m === 'crore' || m === 'cr') multiplier = 10_000_000;
    else if (m === 'b' || m === 'billion') multiplier = 1_000_000_000;
  }

  const min = parseFloat(nums[0]) * multiplier;
  const max = nums.length > 1 ? parseFloat(nums[1]) * multiplier : min;

  return { min, max, currency };
}

// ─── Validate & sanitize payload ─────────────────────────────────────

function sanitize(payload: LeadPayload): LeadPayload {
  const clean = { ...payload };
  // Trim strings
  for (const key of Object.keys(clean) as (keyof LeadPayload)[]) {
    const val = clean[key];
    if (typeof val === 'string') {
      (clean as any)[key] = val.trim().substring(0, 1000); // cap length
    }
  }
  // Validate qualification status
  const validTemps = ['HOT', 'WARM', 'COLD', 'PENDING', 'REACH_AGAIN', 'OPT_OUT'];
  if (clean.qualification_status && !validTemps.includes(clean.qualification_status.toUpperCase())) {
    clean.qualification_status = 'WARM';
  }
  return clean;
}

// ─── Parse location string into structured parts ─────────────────────

function parseLocation(raw?: string): { city?: string; state_province?: string; country?: string } {
  if (!raw) return {};
  // Simple heuristic: split by comma, last part is country/state
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], state_province: parts[1], country: parts[parts.length - 1] };
  if (parts.length === 2) return { city: parts[0], country: parts[1] };
  return { city: parts[0] };
}

// ─── Find or create lead ─────────────────────────────────────────────

/**
 * The ONE function both /api/chat and /api/live-ws call.
 * 
 * - If a lead already exists for this session → update it
 * - Otherwise → create a new one
 * - Never creates duplicates within the same session
 * - Validates payload before DB write
 * - Returns actual DB result (not an assumption)
 */
export async function upsertLead(
  sessionId: string,
  payload: LeadPayload,
  conversationId?: string,
): Promise<SaveResult> {
  const db = getPool();
  const clean = sanitize(payload);

  try {
    // Look for existing lead in this session
    const [rows] = await db.query(
      'SELECT id FROM leads WHERE guest_session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    ) as any;

    const existingId = rows?.[0]?.id;
    const budgetInfo = parseBudget(clean.budget);
    const locationInfo = parseLocation(clean.location);

    if (existingId) {
      // UPDATE existing lead — only set non-null fields
      const updates: string[] = [];
      const params: any[] = [];

      const rawName = clean.customer_name_raw || clean.name;
      const preferredName = clean.customer_preferred_name;

      const fieldMap: Record<string, any> = {
        lead_source: clean.lead_source,
        intent: clean.intent || clean.buyer_type,
        property_type: clean.property_type,
        country: clean.country || locationInfo.country,
        state_province: clean.state_province || locationInfo.state_province,
        city: clean.city || clean.current_city || locationInfo.city,
        locality: clean.locality,
        original_location: clean.location,
        property_size: clean.property_size,
        area_unit: clean.area_unit,
        budget_min: clean.budget_min ?? budgetInfo.min,
        budget_max: clean.budget_max ?? budgetInfo.max,
        currency: clean.currency || budgetInfo.currency,
        rental_period: clean.rental_period,
        bedrooms: clean.bedrooms,
        bathrooms: clean.bathrooms,
        amenities: clean.amenities,
        timeline: clean.timeline,
        temperature: clean.qualification_status?.toUpperCase(),
        full_name: rawName,
        customer_name_raw: rawName,
        customer_preferred_name: preferredName,
        phone: clean.phone,
        email: clean.email,
        notes: clean.notes,
      };

      for (const [col, val] of Object.entries(fieldMap)) {
        if (val !== undefined && val !== null && val !== '') {
          updates.push(`${col} = ?`);
          params.push(val);
        }
      }

      if (updates.length > 0) {
        params.push(existingId);
        await db.query(
          `UPDATE leads SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      // Record interaction
      await db.query(
        'INSERT INTO lead_interactions (id, lead_id, interaction_type, summary, metadata) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), existingId, 'ai_extraction', clean.notes || 'Lead updated via AI', JSON.stringify(clean)]
      );

      return { success: true, leadId: existingId, isNew: false };

    } else {
      // CREATE new lead
      const leadId = uuidv4();
      const phoneNorm = normalizePhone(clean.phone);
      const rawName = clean.customer_name_raw || clean.name;
      const preferredName = clean.customer_preferred_name;

      await db.query(
        `INSERT INTO leads (
          id, guest_session_id, lead_source, intent, property_type,
          country, state_province, city, locality, original_location,
          property_size, area_unit, budget_min, budget_max, currency,
          rental_period, bedrooms, bathrooms, amenities, timeline,
          temperature, full_name, customer_name_raw, customer_preferred_name, phone, email, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId, sessionId, clean.lead_source || null,
          clean.intent || clean.buyer_type || null,
          clean.property_type || null,
          clean.country || locationInfo.country || null,
          clean.state_province || locationInfo.state_province || null,
          clean.city || clean.current_city || locationInfo.city || null,
          clean.locality || null,
          clean.location || null,
          clean.property_size || null,
          clean.area_unit || null,
          clean.budget_min ?? budgetInfo.min ?? null,
          clean.budget_max ?? budgetInfo.max ?? null,
          clean.currency || budgetInfo.currency || null,
          clean.rental_period || null,
          clean.bedrooms || null,
          clean.bathrooms || null,
          clean.amenities || null,
          clean.timeline || null,
          clean.qualification_status?.toUpperCase() || 'WARM',
          rawName || null,
          rawName || null,
          preferredName || null,
          clean.phone || null,
          clean.email || null,
          clean.notes || null,
        ]
      );

      // Link conversation if provided
      if (conversationId) {
        await db.query(
          'UPDATE conversations SET lead_id = ? WHERE id = ?',
          [leadId, conversationId]
        );
      }

      return { success: true, leadId, isNew: true };
    }
  } catch (err: any) {
    console.error('[LeadService] upsertLead error:', err);
    return { success: false, leadId: '', isNew: false, error: err.message || 'Database write failed' };
  }
}

// ─── Create conversation ─────────────────────────────────────────────

export async function createConversation(
  sessionId: string,
  channel: 'text' | 'voice',
  language: string,
  leadId?: string,
): Promise<string | null> {
  const db = getPool();
  const id = uuidv4();
  try {
    await db.query(
      'INSERT INTO conversations (id, lead_id, session_id, channel, language) VALUES (?, ?, ?, ?, ?)',
      [id, leadId || null, sessionId, channel, language]
    );
    return id;
  } catch (err: any) {
    console.error('[LeadService] createConversation error:', err);
    return null;
  }
}

// ─── Save message ────────────────────────────────────────────────────

export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  messageType: string = 'text',
): Promise<boolean> {
  const db = getPool();
  try {
    await db.query(
      'INSERT INTO conversation_messages (id, conversation_id, role, content, message_type) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), conversationId, role, content, messageType]
    );
    return true;
  } catch (err: any) {
    console.error('[LeadService] saveMessage error:', err);
    return false;
  }
}

// ─── Get lead by session ─────────────────────────────────────────────

export async function getLeadBySession(sessionId: string): Promise<any | null> {
  const db = getPool();
  try {
    const [rows] = await db.query(
      'SELECT * FROM leads WHERE guest_session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    ) as any;
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

// ─── Get lead by ID (with session validation) ────────────────────────

export async function getLeadById(leadId: string, sessionId: string): Promise<any | null> {
  const db = getPool();
  try {
    const [rows] = await db.query(
      'SELECT * FROM leads WHERE id = ? AND guest_session_id = ?',
      [leadId, sessionId]
    ) as any;
    return rows?.[0] || null;
  } catch {
    return null;
  }
}
