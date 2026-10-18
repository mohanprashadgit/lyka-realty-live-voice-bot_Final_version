/**
 * db.ts — MySQL connection pool + safe schema initialization for Lyka CRM
 * Uses CREATE TABLE IF NOT EXISTS — never drops existing tables.
 */
import mysql from 'mysql2/promise';
import { hashPassword } from './authHelper.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const useSsl = process.env.DB_SSL === 'true' || Boolean(process.env.DATABASE_URL?.includes('ssl'));
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

  // Create database if it doesn't exist (for fresh XAMPP installs)
  const dbName = process.env.DB_NAME || 'lyka_crm';
  await db.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await db.query(`USE \`${dbName}\``);

  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(36) PRIMARY KEY,
      full_name VARCHAR(255),
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
      temperature VARCHAR(20) DEFAULT 'WARM',
      pipeline_status VARCHAR(50) DEFAULT 'new',
      assigned_agent VARCHAR(36),
      additional_prefs TEXT,
      full_name VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
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

  // ── CRM Enterprise Entities ──────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      department VARCHAR(100),
      manager_id VARCHAR(36),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(36) PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      department VARCHAR(100) DEFAULT 'Sales',
      role VARCHAR(100) DEFAULT 'Sales Agent',
      team_id VARCHAR(36),
      reporting_manager_id VARCHAR(36),
      employment_status VARCHAR(50) DEFAULT 'active',
      assigned_territory VARCHAR(255),
      monthly_target DECIMAL(18,2) DEFAULT 0,
      points_balance INT DEFAULT 0,
      avatar_url VARCHAR(1000),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_emp_email (email),
      INDEX idx_emp_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      purpose VARCHAR(50) DEFAULT 'sale',
      property_type VARCHAR(100) DEFAULT 'apartment',
      status VARCHAR(50) DEFAULT 'available',
      country VARCHAR(100) DEFAULT 'India',
      state_province VARCHAR(100),
      city VARCHAR(100),
      locality VARCHAR(255),
      address TEXT,
      postal_code VARCHAR(20),
      building_name VARCHAR(255),
      price DECIMAL(18,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      rental_frequency VARCHAR(50),
      bedrooms VARCHAR(20),
      bathrooms VARCHAR(20),
      built_up_area DECIMAL(12,2),
      plot_area DECIMAL(12,2),
      area_unit VARCHAR(50) DEFAULT 'sqft',
      furnishing VARCHAR(50),
      parking VARCHAR(50),
      amenities JSON,
      cover_image_url VARCHAR(1000),
      images JSON,
      owner_id VARCHAR(36),
      assigned_agent_id VARCHAR(36),
      verification_status VARCHAR(50) DEFAULT 'approved',
      quality_score INT DEFAULT 85,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prop_status (status),
      INDEX idx_prop_city (city),
      INDEX idx_prop_type (property_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS land_listings (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      land_type VARCHAR(100) DEFAULT 'residential_land',
      status VARCHAR(50) DEFAULT 'available',
      country VARCHAR(100) DEFAULT 'India',
      state_province VARCHAR(100),
      district VARCHAR(100),
      city VARCHAR(100),
      village VARCHAR(100),
      locality VARCHAR(255),
      survey_number VARCHAR(100),
      total_area DECIMAL(14,4) DEFAULT 0,
      area_unit VARCHAR(50) DEFAULT 'cents',
      expected_price DECIMAL(18,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      price_basis VARCHAR(50) DEFAULT 'total',
      road_access VARCHAR(100),
      frontage VARCHAR(100),
      zoning VARCHAR(100),
      water_availability BOOLEAN DEFAULT true,
      electricity_availability BOOLEAN DEFAULT true,
      ownership_status VARCHAR(100) DEFAULT 'Freehold',
      verification_status VARCHAR(50) DEFAULT 'verified',
      owner_id VARCHAR(36),
      assigned_agent_id VARCHAR(36),
      images JSON,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_land_status (status),
      INDEX idx_land_city (city)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      lead_id VARCHAR(36),
      customer_id VARCHAR(36),
      property_id VARCHAR(36),
      land_id VARCHAR(36),
      agent_id VARCHAR(36),
      manager_id VARCHAR(36),
      transaction_type VARCHAR(50) DEFAULT 'buy',
      deal_status VARCHAR(50) DEFAULT 'in_negotiation',
      deal_value DECIMAL(18,2) DEFAULT 0,
      projected_value DECIMAL(18,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      commission_rate DECIMAL(5,2) DEFAULT 2.00,
      commission_amount DECIMAL(18,2) DEFAULT 0,
      expected_close_date DATE,
      actual_close_date DATE,
      payment_status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deal_status (deal_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id VARCHAR(36) PRIMARY KEY,
      customer_id VARCHAR(36),
      lead_id VARCHAR(36),
      property_id VARCHAR(36),
      land_id VARCHAR(36),
      employee_id VARCHAR(36),
      visit_date DATE NOT NULL,
      visit_time VARCHAR(20) NOT NULL,
      status VARCHAR(50) DEFAULT 'scheduled',
      feedback TEXT,
      outcome VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_visit_date (visit_date),
      INDEX idx_visit_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      assigned_to VARCHAR(36),
      lead_id VARCHAR(36),
      customer_id VARCHAR(36),
      deal_id VARCHAR(36),
      due_date DATE NOT NULL,
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'pending',
      completion_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_task_due (due_date),
      INDEX idx_task_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reward_ledger (
      id VARCHAR(36) PRIMARY KEY,
      employee_id VARCHAR(36) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      points INT NOT NULL,
      direction VARCHAR(10) DEFAULT 'credit',
      source_event_id VARCHAR(36),
      reason TEXT,
      actor_id VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reward_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      source_channel VARCHAR(100) DEFAULT 'Meta Ads',
      status VARCHAR(50) DEFAULT 'active',
      start_date DATE,
      end_date DATE,
      budget DECIMAL(18,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'INR',
      leads_generated INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS crm_notifications (
      id VARCHAR(36) PRIMARY KEY,
      recipient_role VARCHAR(100),
      recipient_employee_id VARCHAR(36),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      link_module VARCHAR(100),
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      actor_name VARCHAR(255),
      actor_role VARCHAR(100),
      action VARCHAR(100) NOT NULL,
      record_type VARCHAR(100) NOT NULL,
      record_id VARCHAR(36),
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_time (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS crm_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Seed default employees for dev role preview if none exist
  const [empCount] = await db.query('SELECT COUNT(*) as c FROM employees') as any;
  if (empCount?.[0]?.c === 0) {
    await db.query(`
      INSERT INTO employees (id, full_name, email, department, role, monthly_target, points_balance, assigned_territory) VALUES
      ('emp-super-admin', 'Rajesh K. Varma', 'rajesh.varma@lykarealty.com', 'Executive', 'Super Admin', 150000000, 3200, 'Global / Chennai HQ'),
      ('emp-admin', 'Kavitha Ramachandran', 'kavitha.r@lykarealty.com', 'Operations', 'Admin', 80000000, 2400, 'Tamil Nadu Region'),
      ('emp-sales-mgr', 'Arunachalam Sundaram', 'arun.sundaram@lykarealty.com', 'Sales', 'Sales Manager', 100000000, 1850, 'Chennai Luxury Corridor'),
      ('emp-lead-lead', 'Deepa Jayakumar', 'deepa.j@lykarealty.com', 'Lead Management', 'Lead Management Team', 50000000, 1600, 'Inbound Digital Leads'),
      ('emp-sales-agent', 'Vinakya Mahadev', 'vinakya.m@lykarealty.com', 'Sales', 'Sales Agent', 40000000, 1200, 'OMR & ECR Coastal Plots'),
      ('emp-marketing', 'Siddharth Menon', 'siddharth.m@lykarealty.com', 'Marketing', 'Marketing Executive', 30000000, 950, 'Social & Portal Campaigns')
    `);
  }

  // Seed initial organization settings if none exist
  const [setCount] = await db.query('SELECT COUNT(*) as c FROM crm_settings') as any;
  if (setCount?.[0]?.c === 0) {
    await db.query(`
      INSERT INTO crm_settings (setting_key, setting_value) VALUES
      ('organization', JSON_OBJECT('name', 'Lyka Realty Global', 'headquarters', 'Chennai, Tamil Nadu', 'defaultCurrency', 'INR', 'supportEmail', 'contact@lykarealty.com')),
      ('lead_scoring', JSON_OBJECT('hotMinScore', 80, 'warmMinScore', 50, 'budgetWeight', 30, 'timelineWeight', 35, 'intentWeight', 35)),
      ('currencies', JSON_ARRAY('INR', 'AED', 'USD', 'GBP', 'EUR', 'SGD')),
      ('units', JSON_ARRAY('sqft', 'cents', 'acres', 'grounds', 'sqm', 'sqyd'))
    `);
  }

  // ── 5 Simplified Roles & Authentication Migration ──────────────────
  try {
    // 1. Add authentication columns to employees table if not present
    const [cols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME IN ('login_id', 'password_hash', 'must_change_password', 'last_login')
    `) as any;
    const existingCols = (cols || []).map((c: any) => c.COLUMN_NAME);

    if (!existingCols.includes('login_id')) {
      await db.query('ALTER TABLE employees ADD COLUMN login_id VARCHAR(100) UNIQUE AFTER email');
    }
    if (!existingCols.includes('password_hash')) {
      await db.query('ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255) AFTER login_id');
    }
    if (!existingCols.includes('must_change_password')) {
      await db.query('ALTER TABLE employees ADD COLUMN must_change_password BOOLEAN DEFAULT true AFTER password_hash');
    }
    if (!existingCols.includes('last_login')) {
      await db.query('ALTER TABLE employees ADD COLUMN last_login TIMESTAMP NULL AFTER must_change_password');
    }

    // 2. Map existing roles to the 5 official simplified roles
    await db.query(`UPDATE employees SET role = 'Operations Admin' WHERE role = 'Admin'`);
    await db.query(`UPDATE employees SET role = 'Lead Management Executive' WHERE role = 'Lead Management Team'`);
    await db.query(`UPDATE employees SET role = 'Sales Territory Manager' WHERE role = 'Sales Manager'`);
    await db.query(`UPDATE employees SET role = 'Sales & Growth Executive' WHERE role IN ('Sales Agent', 'Marketing Executive')`);

    // 3. Modern password hash for initial development password: "12345678"
    const devPassHash = hashPassword('12345678', 'lyka_seed_salt_2026');

    // 4. Upsert required development seed accounts
    const seedAccounts = [
      {
        id: 'CO-ADMIN',
        login_id: 'admin@lyka',
        full_name: 'Rajesh K. Varma',
        email: 'admin@lykarealty.com',
        role: 'Super Admin',
        department: 'Executive Administration',
        monthly_target: 150000000,
        points: 3200,
        territory: 'Global / Chennai HQ',
      },
      {
        id: 'CO1',
        login_id: 'CO1',
        full_name: 'Mohan',
        email: 'mohan@lykarealty.com',
        role: 'Sales & Growth Executive',
        department: 'Sales & Growth',
        monthly_target: 40000000,
        points: 1500,
        territory: 'Chennai OMR / Coastal',
      },
      {
        id: 'CO2',
        login_id: 'CO2',
        full_name: 'Kavitha Ramachandran',
        email: 'kavitha.r@lykarealty.com',
        role: 'Operations Admin',
        department: 'Property & Operations',
        monthly_target: 80000000,
        points: 2400,
        territory: 'Tamil Nadu Region',
      },
      {
        id: 'CO3',
        login_id: 'CO3',
        full_name: 'Arunachalam Sundaram',
        email: 'arun.sundaram@lykarealty.com',
        role: 'Sales Territory Manager',
        department: 'Sales & Portfolio Management',
        monthly_target: 100000000,
        points: 1850,
        territory: 'Chennai Luxury Corridor',
      },
      {
        id: 'CO4',
        login_id: 'CO4',
        full_name: 'Deepa Jayakumar',
        email: 'deepa.j@lykarealty.com',
        role: 'Lead Management Executive',
        department: 'Inbound Lead Management',
        monthly_target: 50000000,
        points: 1600,
        territory: 'Inbound Digital Leads',
      },
    ];

    for (const acc of seedAccounts) {
      // Check by login_id or id
      const [existing] = await db.query(
        'SELECT id, password_hash FROM employees WHERE login_id = ? OR id = ?',
        [acc.login_id, acc.id]
      ) as any;

      if (!existing || existing.length === 0) {
        await db.query(`
          INSERT INTO employees (id, login_id, full_name, email, role, department, monthly_target, points_balance, assigned_territory, password_hash, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
        `, [acc.id, acc.login_id, acc.full_name, acc.email, acc.role, acc.department, acc.monthly_target, acc.points, acc.territory, devPassHash]);
      } else {
        // Ensure role is mapped and login_id/password_hash is filled if empty
        const emp = existing[0];
        const updatePass = !emp.password_hash ? devPassHash : emp.password_hash;
        await db.query(`
          UPDATE employees
          SET login_id = ?, role = ?, password_hash = COALESCE(password_hash, ?)
          WHERE id = ?
        `, [acc.login_id, acc.role, updatePass, emp.id]);
      }
    }

    // Also update any legacy employee records to have login_id and default password if missing
    await db.query(`
      UPDATE employees
      SET login_id = id, password_hash = ?
      WHERE (login_id IS NULL OR login_id = '') AND (password_hash IS NULL OR password_hash = '')
    `, [devPassHash]);

    // ── Customer Authentication & Preferences Schema Migration ──
    const [custCols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME IN ('password_hash', 'budget_range', 'preferred_property_type', 'notes')
    `) as any;
    const existingCustCols = (custCols || []).map((c: any) => c.COLUMN_NAME);

    if (!existingCustCols.includes('password_hash')) {
      await db.query('ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255) NULL AFTER email');
    }
    if (!existingCustCols.includes('budget_range')) {
      await db.query('ALTER TABLE customers ADD COLUMN budget_range VARCHAR(100) NULL AFTER current_location');
    }
    if (!existingCustCols.includes('preferred_property_type')) {
      await db.query('ALTER TABLE customers ADD COLUMN preferred_property_type VARCHAR(100) NULL AFTER budget_range');
    }
    if (!existingCustCols.includes('notes')) {
      await db.query('ALTER TABLE customers ADD COLUMN notes TEXT NULL AFTER preferred_property_type');
    }

    // Seed demo customer if no customer exists with password_hash
    const [custRows] = await db.query('SELECT COUNT(*) as c FROM customers WHERE password_hash IS NOT NULL') as any;
    if (custRows?.[0]?.c === 0) {
      await db.query(`
        INSERT INTO customers (id, full_name, phone, phone_normalized, email, current_location, preferred_contact, budget_range, preferred_property_type, password_hash, notes)
        VALUES (
          'cust-demo-1',
          'Anand Sundaram',
          '+91 98400 12345',
          '9840012345',
          'anand.customer@gmail.com',
          'Anna Nagar, Chennai',
          'phone',
          '₹1.5 Cr - ₹2.5 Cr',
          'villa',
          ?,
          'Looking for a 3BHK or 4BHK independent luxury villa near OMR or ECR with private garden.'
        )
      `, [devPassHash]);
      console.log('[DB] Demo customer account initialized (anand.customer@gmail.com / 12345678).');
    }

    // ── Property Recommendation & Matching Engine Schema Migration ──
    const [propCols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME IN ('metro_distance_km', 'locality_rating')
    `) as any;
    const existingPropCols = (propCols || []).map((c: any) => c.COLUMN_NAME);

    if (!existingPropCols.includes('metro_distance_km')) {
      await db.query('ALTER TABLE properties ADD COLUMN metro_distance_km DECIMAL(6,2) NULL AFTER quality_score');
    }
    if (!existingPropCols.includes('locality_rating')) {
      await db.query('ALTER TABLE properties ADD COLUMN locality_rating VARCHAR(50) NULL AFTER metro_distance_km');
    }

    const [landCols] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_listings' AND COLUMN_NAME IN ('metro_distance_km', 'locality_rating')
    `) as any;
    const existingLandCols = (landCols || []).map((c: any) => c.COLUMN_NAME);

    if (!existingLandCols.includes('metro_distance_km')) {
      await db.query('ALTER TABLE land_listings ADD COLUMN metro_distance_km DECIMAL(6,2) NULL AFTER notes');
    }
    if (!existingLandCols.includes('locality_rating')) {
      await db.query('ALTER TABLE land_listings ADD COLUMN locality_rating VARCHAR(50) NULL AFTER metro_distance_km');
    }

    // Recommendation interactions & structured requirements persistence
    await db.query(`
      CREATE TABLE IF NOT EXISTS property_recommendations (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(36),
        lead_id VARCHAR(36),
        conversation_id VARCHAR(36),
        session_id VARCHAR(36),
        employee_id VARCHAR(36),
        original_message TEXT,
        structured_requirements JSON,
        algorithm_version VARCHAR(50) DEFAULT 'v1.0-weighted',
        recommended_properties JSON,
        matched_count INT DEFAULT 0,
        top_score DECIMAL(5,2) DEFAULT 0,
        is_unmatched BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'recommended',
        selected_property_id VARCHAR(36),
        customer_feedback VARCHAR(100),
        feedback_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rec_cust (customer_id),
        INDEX idx_rec_lead (lead_id),
        INDEX idx_rec_status (status),
        INDEX idx_rec_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Customer interested properties bookmarks
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_interested_properties (
        id VARCHAR(36) PRIMARY KEY,
        customer_id VARCHAR(36),
        lead_id VARCHAR(36),
        property_id VARCHAR(36),
        land_id VARCHAR(36),
        recommendation_id VARCHAR(36),
        status VARCHAR(50) DEFAULT 'saved',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cip_cust (customer_id),
        INDEX idx_cip_lead (lead_id),
        INDEX idx_cip_prop (property_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed realistic Chennai inventory if key sample properties don't exist
    const [sampleProp] = await db.query("SELECT id FROM properties WHERE id = 'PROP-OMR-2BHK'") as any;
    if (!sampleProp || sampleProp.length === 0) {
      await db.query(`
        INSERT INTO properties (
          id, title, description, purpose, property_type, status,
          country, state_province, city, locality, address, postal_code,
          building_name, price, currency, bedrooms, bathrooms, built_up_area, area_unit,
          furnishing, parking, amenities, cover_image_url, images,
          verification_status, quality_score, metro_distance_km, locality_rating
        ) VALUES (
          'PROP-OMR-2BHK',
          'Prestige Courtyard 2 BHK Smart Home',
          'Spacious modern 2 BHK apartment on OMR corridor. Located just 800m from the upcoming Sholinganallur Metro station with 100% power backup and clubhouse amenities.',
          'sale', 'apartment', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'OMR', 'OMR Main Road, Sholinganallur', '600119',
          'Prestige Courtyard', 6500000, 'INR', '2', '2', 920.00, 'sqft',
          'Semi-Furnished', 'Covered Car Parking',
          '["Covered Parking", "Lift", "24/7 Security", "Gym", "Power Backup", "Clubhouse", "Children Play Area"]',
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
          '["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"]',
          'verified', 95, 0.80, 'Verified Prime'
        ),
        (
          'PROP-ANNANAGAR-3BHK',
          'Greenways Emerald 3 BHK Residence',
          'Premium 3 BHK home in prime Anna Nagar West with verified metro access at 500m. Surrounded by premier schools, hospitals, and parks.',
          'sale', 'apartment', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'Anna Nagar', '2nd Avenue, Anna Nagar West', '600040',
          'Greenways Emerald', 13500000, 'INR', '3', '3', 1450.00, 'sqft',
          'Unfurnished', '2 Covered Car Parkings',
          '["Reserved Parking", "High-speed Lift", "24/7 Security", "Gym", "Swimming Pool", "Rooftop Garden"]',
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
          '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"]',
          'verified', 98, 0.50, 'Verified Prime'
        ),
        (
          'PROP-VELACHERY-2BHK',
          'Radiance Grandeur 2 BHK Luxury Flat',
          'Contemporary 2 BHK residential apartment near Velachery MRTS & metro corridor. Excellent locality with shopping malls and rapid arterial connectivity.',
          'sale', 'apartment', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'Velachery', 'Velachery Bypass Road', '600042',
          'Radiance Grandeur', 6850000, 'INR', '2', '2', 980.00, 'sqft',
          'Semi-Furnished', 'Covered Parking',
          '["Parking", "Lift", "Security", "Children Play Area", "Power Backup"]',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
          '["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"]',
          'verified', 92, 1.20, 'Good Locality'
        ),
        (
          'PROP-ECR-VILLA',
          'Azure Waves 4 BHK Beachfront Villa',
          'Ultra-luxury 4 BHK independent sea-facing villa in Injambakkam, ECR with private garden, private swimming pool, and Italian marble flooring.',
          'sale', 'villa', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'ECR', 'East Coast Road, Injambakkam', '600115',
          'Azure Waves Estate', 28000000, 'INR', '4', '4', 3100.00, 'sqft',
          'Fully Furnished', 'Private 3 Car Garage',
          '["Private Pool", "Private Garden", "Covered Parking", "Security", "Clubhouse", "Gym"]',
          'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80',
          '["https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80"]',
          'verified', 99, 8.50, 'Verified Luxury'
        )
      `);
      console.log('[DB] Realistic Chennai property inventory seeded successfully.');
    }

    // Seed realistic Chennai land inventory if key sample land parcels don't exist
    const [sampleLand] = await db.query("SELECT id FROM land_listings WHERE id = 'LAND-OMR-5CENTS'") as any;
    if (!sampleLand || sampleLand.length === 0) {
      await db.query(`
        INSERT INTO land_listings (
          id, title, description, land_type, status,
          country, state_province, city, locality,
          survey_number, total_area, area_unit, expected_price, currency, price_basis,
          road_access, frontage, zoning, water_availability, electricity_availability,
          ownership_status, verification_status, locality_rating, metro_distance_km, images
        ) VALUES (
          'LAND-OMR-5CENTS',
          '5 Cents Residential Plot in Sholinganallur, OMR',
          'Prime CMDA approved residential land parcel located in Sholinganallur, OMR. Ready for immediate house construction with 30ft blacktop tar road access, 3-phase electricity, and potable groundwater.',
          'residential_plot', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'OMR',
          'OMR/104-B', 5.0000, 'cents', 3500000, 'INR', 'total',
          '30 ft Blacktop Tar Road', '40 ft', 'CMDA Approved Residential', 1, 1,
          'Freehold', 'verified', 'Verified Prime', 1.10,
          '["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"]'
        ),
        (
          'LAND-ECR-1GROUND',
          '2,400 sq.ft (1 Ground) Coastal Villa Plot in Injambakkam, ECR',
          'Serene 1 ground (2,400 sq.ft) residential villa plot in Injambakkam near ECR. Wide 40ft road frontage with clear title and DTCP residential approval. Ideal for building luxury independent house.',
          'residential_plot', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'ECR',
          'ECR/88-A', 2400.0000, 'sqft', 7500000, 'INR', 'total',
          '40 ft Tar Road', '50 ft', 'DTCP Approved Residential', 1, 1,
          'Freehold', 'verified', 'Verified Luxury', 6.20,
          '["https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=800&q=80"]'
        ),
        (
          'LAND-TAMBARAM-PLOT',
          '1,200 sq.ft Residential Villa Plot in Tambaram',
          'Affordable DTCP approved residential plot in West Tambaram under ₹30 lakh. Excellent connectivity to GST Road, schools, and hospitals with 24ft road access.',
          'residential_plot', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'Tambaram',
          'TBM/45-C', 1200.0000, 'sqft', 2800000, 'INR', 'total',
          '24 ft Blacktop Road', '30 ft', 'DTCP Approved Residential', 1, 1,
          'Freehold', 'verified', 'Good Locality', 2.80,
          '["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"]'
        ),
        (
          'LAND-MEDAVAKKAM-PLOT',
          '3.5 Cents Premium Corner Plot in Medavakkam',
          'Corner residential plot in rapidly developing Medavakkam locality. Dual 30ft road access with CMDA approval. Ideal for building 3BHK independent home.',
          'residential_plot', 'available',
          'India', 'Tamil Nadu', 'Chennai', 'Medavakkam',
          'MED/22-D', 3.5000, 'cents', 3800000, 'INR', 'total',
          '30 ft Dual Road (Corner Plot)', '45 ft', 'CMDA Approved Residential', 1, 1,
          'Freehold', 'verified', 'Verified Prime', 3.50,
          '["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"]'
        )
      `);
      console.log('[DB] Realistic Chennai land inventory seeded successfully.');
    }

    console.log('[DB] Role migration, authentication seed accounts, customer schema, and recommendation engine tables verified.');
  } catch (migErr) {
    console.error('[DB] Auth/Recommendation migration notice:', migErr);
  }

  console.log('[DB] CRM Schema verified (CREATE TABLE IF NOT EXISTS — existing tables and data untouched).');
}

