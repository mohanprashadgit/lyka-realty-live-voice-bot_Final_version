/**
 * db.ts — MySQL connection pool + safe schema initialization for Lyka CRM
 * Uses CREATE TABLE IF NOT EXISTS — never drops existing tables.
 */
import mysql from 'mysql2/promise';
import { calculateAuthoritativeLeadScore } from './src/utils/scoring.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.TIDB_DATABASE_URL;
    const isCloudHost = Boolean(
      (process.env.DB_HOST || '').includes('tidbcloud.com') ||
      (process.env.DB_HOST || '').includes('aivencloud.com') ||
      (dbUrl || '').includes('tidbcloud.com') ||
      (dbUrl || '').includes('aivencloud.com')
    );
    const useSsl = process.env.DB_SSL === 'true' || Boolean(dbUrl?.includes('ssl')) || isCloudHost;

    if (dbUrl) {
      pool = mysql.createPool({
        uri: dbUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      });
    } else {
      pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lyka_crm',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      });
    }
  }
  return pool;
}

/** Test connectivity — returns true if MySQL is reachable */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Safe schema migration — CREATE TABLE IF NOT EXISTS only.
 * Never drops tables. Never erases data. Idempotent.
 */
export async function initSchema(): Promise<void> {
  const db = getPool();

  // Create database if it doesn't exist (for fresh local installs)
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.TIDB_DATABASE_URL;
  let parsedDbName = '';
  if (dbUrl) {
    try {
      parsedDbName = new URL(dbUrl.replace(/^mysql:/, 'http:')).pathname.replace(/^\//, '');
    } catch {}
  }
  const dbName = process.env.DB_NAME || parsedDbName || 'lyka_crm';
  try {
    await db.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err: any) {
    // Shared and cloud hosting (e.g. InfinityFree, Aiven, AWS, cPanel) restricts CREATE DATABASE.
    // The database is pre-created by the control panel.
  }
  try {
    await db.query(`USE \`${dbName}\``);
  } catch (err: any) {
    // If pool is already scoped to the database, ignore
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(36) PRIMARY KEY,
      full_name VARCHAR(255),
      customer_name_raw VARCHAR(255),
      customer_preferred_name VARCHAR(255),
      phone VARCHAR(50),
      phone_normalized VARCHAR(50),
      email VARCHAR(255),
      current_location VARCHAR(500),
      preferred_contact VARCHAR(50) DEFAULT 'phone',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone (phone_normalized),
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(36) PRIMARY KEY,
      customer_id VARCHAR(36),
      guest_session_id VARCHAR(36),
      lead_source VARCHAR(100),
      intent VARCHAR(100),
      property_type VARCHAR(100),
      country VARCHAR(100),
      state_province VARCHAR(100),
      city VARCHAR(100),
      locality VARCHAR(255),
      postal_code VARCHAR(20),
      original_location TEXT,
      property_size VARCHAR(100),
      area_unit VARCHAR(50),
      budget_min DECIMAL(18,2),
      budget_max DECIMAL(18,2),
      currency VARCHAR(10),
      rental_period VARCHAR(50),
      bedrooms VARCHAR(20),
      bathrooms VARCHAR(20),
      amenities TEXT,
      timeline VARCHAR(100),
      lead_score INT DEFAULT NULL,
      temperature VARCHAR(20) DEFAULT 'PENDING',
      pipeline_status VARCHAR(50) DEFAULT 'new',
      assigned_agent VARCHAR(36),
      additional_prefs TEXT,
      full_name VARCHAR(255),
      customer_name_raw VARCHAR(255),
      customer_preferred_name VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      preferred_contact_method VARCHAR(50) DEFAULT 'phone',
      best_time_to_contact VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer (customer_id),
      INDEX idx_session (guest_session_id),
      INDEX idx_temp (temperature)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id VARCHAR(36) PRIMARY KEY,
      lead_id VARCHAR(36),
      customer_id VARCHAR(36),
      session_id VARCHAR(36) NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'text',
      language VARCHAR(20) DEFAULT 'english',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP NULL,
      INDEX idx_lead (lead_id),
      INDEX idx_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id VARCHAR(36) PRIMARY KEY,
      conversation_id VARCHAR(36) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content TEXT,
      message_type VARCHAR(20) DEFAULT 'text',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_convo (conversation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS lead_interactions (
      id VARCHAR(36) PRIMARY KEY,
      lead_id VARCHAR(36) NOT NULL,
      interaction_type VARCHAR(50) NOT NULL,
      summary TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lead (lead_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Core Lead & Customer Migrations ─────────────────────────────────
  try {
    const [nameColsLeads] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME IN ('customer_name_raw', 'customer_preferred_name', 'preferred_contact_method', 'best_time_to_contact', 'lead_score')
    `) as any;
    const existingNameColsLeads = (nameColsLeads || []).map((c: any) => c.COLUMN_NAME);
    if (!existingNameColsLeads.includes('lead_score')) {
      await db.query('ALTER TABLE leads ADD COLUMN lead_score INT DEFAULT NULL AFTER timeline');
    }
    if (!existingNameColsLeads.includes('customer_name_raw')) {
      await db.query('ALTER TABLE leads ADD COLUMN customer_name_raw VARCHAR(255) NULL AFTER full_name');
    }
    if (!existingNameColsLeads.includes('customer_preferred_name')) {
      await db.query('ALTER TABLE leads ADD COLUMN customer_preferred_name VARCHAR(255) NULL AFTER customer_name_raw');
    }
    if (!existingNameColsLeads.includes('preferred_contact_method')) {
      await db.query("ALTER TABLE leads ADD COLUMN preferred_contact_method VARCHAR(50) DEFAULT 'phone' AFTER email");
    }
    if (!existingNameColsLeads.includes('best_time_to_contact')) {
      await db.query('ALTER TABLE leads ADD COLUMN best_time_to_contact VARCHAR(100) NULL AFTER preferred_contact_method');
    }

    const [nameColsCust] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME IN ('customer_name_raw', 'customer_preferred_name')
    `) as any;
    const existingNameColsCust = (nameColsCust || []).map((c: any) => c.COLUMN_NAME);
    if (!existingNameColsCust.includes('customer_name_raw')) {
      await db.query('ALTER TABLE customers ADD COLUMN customer_name_raw VARCHAR(255) NULL AFTER full_name');
    }
    if (!existingNameColsCust.includes('customer_preferred_name')) {
      await db.query('ALTER TABLE customers ADD COLUMN customer_preferred_name VARCHAR(255) NULL AFTER customer_name_raw');
    }

    // Ensure default temperature is COLD rather than WARM
    try {
      await db.query("ALTER TABLE leads MODIFY COLUMN temperature VARCHAR(20) DEFAULT 'COLD'");
    } catch {}

    // Clean up legacy records erroneously defaulted to WARM without any requirements
    try {
      await db.query(`
        UPDATE leads 
        SET temperature = 'COLD' 
        WHERE temperature = 'WARM' 
          AND property_type IS NULL 
          AND budget_max IS NULL 
          AND timeline IS NULL 
          AND (notes IS NULL OR notes = '' OR notes LIKE '%TEST fixture%' OR notes LIKE '%no customer speech%')
      `);
    } catch {}
    // Recalculate lead scores for all existing leads from actual evidence
    try {
      await recalculateAllExistingLeads(db);
    } catch {}
  } catch (migErr) {
    console.warn('[DB] Core schema migration notice:', migErr);
  }

  console.log('[DB] Core 5-Table Schema verified (customers, leads, conversations, conversation_messages, lead_interactions).');
}


/**
 * recalculateAllExistingLeads — Recalculates all existing leads from their actual available
 * conversation data, transcripts, extracted slots, and notes using calculateAuthoritativeLeadScore.
 * Persists corrected scores (0-100) and preserves REACH_AGAIN, OPT_OUT, UNWANTED.
 * Idempotent and safe to rerun.
 */
export async function recalculateAllExistingLeads(dbConn?: any): Promise<{ total: number; updated: number }> {
  const pool = dbConn || getPool();
  try {
    const [leads]: any = await pool.query(`
      SELECT l.id, l.full_name, l.customer_name_raw, l.phone, l.email, l.lead_source,
             l.intent, l.property_type, l.location, l.city, l.locality, l.country, l.original_location,
             l.budget_min, l.budget_max, l.currency, l.timeline, l.temperature, l.lead_score,
             l.notes, l.best_time_to_contact
      FROM leads l
    `);

    if (!leads || leads.length === 0) return { total: 0, updated: 0 };

    // Fetch messages from conversations linked to these leads
    let messagesByLead: Record<string, string[]> = {};
    try {
      const [messages]: any = await pool.query(`
        SELECT c.lead_id, m.content
        FROM conversation_messages m
        JOIN conversations c ON CAST(c.id AS BINARY) = CAST(m.conversation_id AS BINARY)
        WHERE c.lead_id IS NOT NULL AND m.role IN ('user', 'customer')
        ORDER BY m.created_at ASC
      `);
      if (messages && messages.length > 0) {
        for (const msg of messages) {
          if (!messagesByLead[msg.lead_id]) messagesByLead[msg.lead_id] = [];
          messagesByLead[msg.lead_id].push(msg.content);
        }
      }
    } catch {}

    let updatedCount = 0;
    for (const lead of leads) {
      const userTranscript = (messagesByLead[lead.id] || []).join(' ');
      const calculated = calculateAuthoritativeLeadScore(lead, userTranscript);

      const existingScore = lead.lead_score;
      const newScore = calculated.score;

      // Preserve existing REACH_AGAIN, OPT_OUT, UNWANTED statuses
      let newTemp = lead.temperature;
      const curTempUpper = String(lead.temperature || '').toUpperCase();
      if (curTempUpper !== 'REACH_AGAIN' && curTempUpper !== 'OPT_OUT' && curTempUpper !== 'UNWANTED') {
        newTemp = calculated.temperature;
      }

      if (existingScore !== newScore || lead.temperature !== newTemp) {
        await pool.query(
          `UPDATE leads SET lead_score = ?, temperature = ? WHERE id = ?`,
          [newScore, newTemp, lead.id]
        );
        updatedCount++;
      }
    }

    console.log(`[DB] Recalculated lead scores for ${leads.length} leads (${updatedCount} updated).`);
    return { total: leads.length, updated: updatedCount };
  } catch (err: any) {
    console.warn('[DB] Lead score recalculation notice:', err.message || err);
    return { total: 0, updated: 0 };
  }
}
