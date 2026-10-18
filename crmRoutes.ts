/**
 * crmRoutes.ts — Dedicated modular CRM REST API Router
 * 
 * Provides database-backed CRM endpoints for dashboard metrics, leads, customers,
 * properties, land inventory, deals, appointments, tasks, employees, rewards, and audit logs.
 * Completely decoupled from existing chatbot routes.
 */
import { Router } from 'express';
import { getPool } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { verifyPassword, hashPassword, generateToken, verifyToken } from './authHelper.js';
import { rankProperties, scoreListing, type StructuredRequirements, type InventoryItem } from './backend/services/propertyMatchingService.js';

export const crmRouter = Router();

// Official 5 Roles
export const ALL_ROLES = [
  'Super Admin',
  'Operations Admin',
  'Lead Management Executive',
  'Sales Territory Manager',
  'Sales & Growth Executive',
];

/**
 * Authentication parser middleware
 * Extracts Bearer token, verifies session, and attaches req.user and req.userRole
 */
crmRouter.use((req: any, _res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      req.userRole = user.role;
      return next();
    }
  }

  // Strict Token Authentication: x-user-role and dev-preview are NEVER trusted for backend authorization
  req.userRole = 'Unauthenticated';
  req.user = null;
  next();
});

/**
 * Role-based authorization middleware
 * Returns HTTP 401 for unauthenticated requests and HTTP 403 for unauthorized roles.
 */
function requireRoles(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || req.userRole === 'Unauthenticated') {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in with a valid session token.',
      });
    }
    const role = req.userRole;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Role '${role}' is not authorized to access this resource. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

// ─── 0. Employee Authentication Endpoints ───────────────────────────
crmRouter.post('/auth/login', async (req, res) => {
  const db = getPool();
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ success: false, error: 'Employee ID or email and password are required.' });
    }

    const [rows] = await db.query(`
      SELECT id, login_id, full_name, email, role, department, password_hash, must_change_password
      FROM employees
      WHERE login_id = ? OR email = ? OR id = ?
      LIMIT 1
    `, [loginId.trim(), loginId.trim(), loginId.trim()]) as any;

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid Employee ID/email or password.' });
    }

    const employee = rows[0];
    const isValid = verifyPassword(password, employee.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid Employee ID/email or password.' });
    }

    // Update last_login
    await db.query('UPDATE employees SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [employee.id]);

    // Issue Token
    const token = generateToken({
      id: employee.id,
      loginId: employee.login_id || employee.id,
      fullName: employee.full_name,
      email: employee.email || '',
      role: employee.role,
      department: employee.department || 'Sales',
    });

    res.json({
      success: true,
      token,
      employee: {
        id: employee.id,
        loginId: employee.login_id || employee.id,
        name: employee.full_name,
        fullName: employee.full_name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        mustChangePassword: Boolean(employee.must_change_password),
      },
    });
  } catch (err: any) {
    console.error('[CRM Auth Login error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.get('/auth/me', async (req: any, res) => {
  if (!req.user || req.userRole === 'Unauthenticated') {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const db = getPool();
  try {
    const [rows] = await db.query(`
      SELECT id, login_id, full_name, email, phone, role, department, assigned_territory,
             monthly_target, points_balance, must_change_password, last_login
      FROM employees
      WHERE id = ? OR login_id = ?
      LIMIT 1
    `, [req.user.id, req.user.loginId]) as any;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const emp = rows[0];
    res.json({
      success: true,
      employee: emp,
      user: {
        id: emp.id,
        name: emp.full_name,
        email: emp.email,
        role: emp.role,
        department: emp.department,
        points_balance: emp.points_balance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/auth/change-password', async (req: any, res) => {
  if (!req.user || req.userRole === 'Unauthenticated') {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
  }
  const db = getPool();
  try {
    const newHash = hashPassword(newPassword);
    await db.query(`
      UPDATE employees
      SET password_hash = ?, must_change_password = false
      WHERE id = ?
    `, [newHash, req.user.id]);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/auth/logout', (_req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// ─── File Uploads (Listing Images) ──────────────────────────────────
crmRouter.post('/uploads', requireRoles(ALL_ROLES), async (req: any, res) => {
  try {
    const rawImage = req.body.imageBase64 || req.body.dataUrl || req.body.image;
    if (!rawImage) {
      return res.status(400).json({ success: false, error: 'imageBase64, dataUrl or image is required.' });
    }

    let mimeType = req.body.mimeType;
    if (!mimeType && typeof rawImage === 'string' && rawImage.startsWith('data:')) {
      const match = rawImage.match(/^data:([^;]+);base64,/);
      if (match) mimeType = match[1];
    }

    const allowedMimes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = allowedMimes[mimeType || 'image/jpeg'] || 'jpg';

    const base64Data = rawImage.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size exceeds 15MB limit.' });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'listings');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFilename = `listing_${uuidv4()}.${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/listings/${safeFilename}`;
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, url: publicUrl, filename: safeFilename });
  } catch (err: any) {
    console.error('[Upload error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Image upload processing error' });
  }
});

// ─── Customer Portal Authentication & Profile Endpoints ─────────────

/**
 * Customer Registration (Sign Up)
 * Creates or updates customer in customers table with password and preferences.
 */
crmRouter.post('/customer/register', async (req, res) => {
  const db = getPool();
  try {
    const rawName = (req.body.fullName || req.body.name || '').trim();
    const {
      phone,
      email,
      currentLocation,
      password,
      preferredContact,
      budgetRange,
      preferredPropertyType,
      notes,
    } = req.body;

    if (!rawName) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }
    if ((!phone || !phone.trim()) && (!email || !email.trim())) {
      return res.status(400).json({ success: false, error: 'Please provide either a phone number or an email address.' });
    }

    const cleanPhone = phone ? phone.trim() : '';
    const normPhone = cleanPhone.replace(/[^0-9]/g, '');
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const passwordHash = hashPassword(password);

    // Check if customer already exists by phone or email
    let existingQuery = 'SELECT id, full_name, phone, email, password_hash FROM customers WHERE ';
    const queryParams: any[] = [];
    if (normPhone && cleanEmail) {
      existingQuery += '(phone_normalized = ? OR phone = ? OR email = ?) LIMIT 1';
      queryParams.push(normPhone, cleanPhone, cleanEmail);
    } else if (normPhone) {
      existingQuery += '(phone_normalized = ? OR phone = ?) LIMIT 1';
      queryParams.push(normPhone, cleanPhone);
    } else {
      existingQuery += 'email = ? LIMIT 1';
      queryParams.push(cleanEmail);
    }

    const [existing] = await db.query(existingQuery, queryParams) as any;
    let customerId: string;

    if (existing && existing.length > 0) {
      const match = existing[0];
      if (match.password_hash) {
        return res.status(400).json({
          success: false,
          error: 'An account with this phone or email already exists. Please sign in.',
        });
      }
      // Upgrade existing lead/customer record to active customer portal account
      customerId = match.id;
      await db.query(`
        UPDATE customers
        SET full_name = ?, phone = COALESCE(?, phone), phone_normalized = COALESCE(?, phone_normalized),
            email = COALESCE(?, email), current_location = ?, preferred_contact = ?,
            budget_range = ?, preferred_property_type = ?, notes = ?, password_hash = ?
        WHERE id = ?
      `, [
        rawName,
        cleanPhone || null,
        normPhone || null,
        cleanEmail,
        currentLocation?.trim() || null,
        preferredContact || 'phone',
        budgetRange?.trim() || null,
        preferredPropertyType?.trim() || null,
        notes?.trim() || null,
        passwordHash,
        customerId,
      ]);
    } else {
      customerId = uuidv4();
      await db.query(`
        INSERT INTO customers (
          id, full_name, phone, phone_normalized, email, current_location,
          preferred_contact, budget_range, preferred_property_type, notes, password_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId,
        rawName,
        cleanPhone || null,
        normPhone || null,
        cleanEmail,
        currentLocation?.trim() || null,
        preferredContact || 'phone',
        budgetRange?.trim() || null,
        preferredPropertyType?.trim() || null,
        notes?.trim() || null,
        passwordHash,
      ]);
    }

    // Fetch fresh customer record
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [customerId]) as any;
    const customer = rows[0];
    delete customer.password_hash;

    const token = generateToken({
      id: customer.id,
      loginId: customer.phone || customer.email || customer.id,
      fullName: customer.full_name,
      email: customer.email || '',
      role: 'Customer',
      department: 'Customer',
    });

    res.json({
      success: true,
      message: 'Customer account created successfully!',
      token,
      customer,
    });
  } catch (err: any) {
    console.error('[Customer Register error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to register customer' });
  }
});

/**
 * Customer Sign In
 * Validates phone or email + password.
 */
crmRouter.post('/customer/login', async (req, res) => {
  const db = getPool();
  try {
    const loginId = req.body.loginId || req.body.email || req.body.phone;
    const { password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ success: false, error: 'Phone or email and password are required.' });
    }

    const cleanLogin = loginId.trim();
    const normPhone = cleanLogin.replace(/[^0-9]/g, '');

    const [rows] = await db.query(`
      SELECT * FROM customers
      WHERE phone_normalized = ? OR phone = ? OR email = ? OR id = ?
      LIMIT 1
    `, [normPhone || cleanLogin, cleanLogin, cleanLogin.toLowerCase(), cleanLogin]) as any;

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid phone/email or password.' });
    }

    const customer = rows[0];
    if (!customer.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'No password is set for this account. Please sign up to create your portal password.',
      });
    }

    const isValid = verifyPassword(password, customer.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid phone/email or password.' });
    }

    delete customer.password_hash;

    const token = generateToken({
      id: customer.id,
      loginId: customer.phone || customer.email || customer.id,
      fullName: customer.full_name,
      email: customer.email || '',
      role: 'Customer',
      department: 'Customer',
    });

    res.json({
      success: true,
      token,
      customer,
    });
  } catch (err: any) {
    console.error('[Customer Login error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Customer authentication error' });
  }
});

/**
 * Get Authenticated Customer Profile + Linked Inquiries & Visits
 */
crmRouter.get('/customer/me', async (req: any, res) => {
  const db = getPool();
  try {
    if (!req.user || req.user.role !== 'Customer') {
      return res.status(401).json({ success: false, error: 'Customer authentication required.' });
    }

    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [req.user.id]) as any;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }

    const customer = rows[0];
    delete customer.password_hash;

    // Fetch linked inquiries/leads
    const [inquiries] = await db.query(`
      SELECT id, intent, property_type, city, budget_min, budget_max, currency, temperature, pipeline_status, notes, created_at
      FROM leads
      WHERE customer_id = ? OR (phone IS NOT NULL AND phone = ?) OR (email IS NOT NULL AND email = ?)
      ORDER BY created_at DESC
      LIMIT 10
    `, [customer.id, customer.phone, customer.email]) as any;

    // Fetch scheduled site visits
    const [siteVisits] = await db.query(`
      SELECT sv.id, sv.visit_date, sv.visit_time, sv.status, sv.feedback,
             COALESCE(p.title, ll.title, sv.property_id, sv.land_id) as property_title,
             COALESCE(p.city, ll.city, 'Chennai') as property_city,
             COALESCE(p.price, ll.expected_price, 0) as property_price
      FROM site_visits sv
      LEFT JOIN properties p ON sv.property_id = p.id
      LEFT JOIN land_listings ll ON sv.land_id = ll.id
      WHERE sv.customer_id = ?
      ORDER BY sv.visit_date DESC
      LIMIT 10
    `, [customer.id]) as any;

    // Fetch interested properties
    const [interestedProps] = await db.query(`
      SELECT cip.id, cip.status, cip.notes, cip.created_at,
             COALESCE(p.id, ll.id) as property_id,
             COALESCE(p.title, ll.title) as title,
             COALESCE(p.price, ll.expected_price, 0) as price,
             COALESCE(p.locality, ll.locality, 'Chennai') as locality,
             COALESCE(p.cover_image_url, '/property_default.jpg') as cover_image_url
      FROM customer_interested_properties cip
      LEFT JOIN properties p ON cip.property_id = p.id
      LEFT JOIN land_listings ll ON cip.land_id = ll.id
      WHERE cip.customer_id = ?
      ORDER BY cip.created_at DESC
      LIMIT 20
    `, [customer.id]) as any;

    res.json({
      success: true,
      customer,
      inquiries: inquiries || [],
      siteVisits: siteVisits || [],
      interestedProperties: interestedProps || [],
    });
  } catch (err: any) {
    console.error('[Customer Me error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Customer Profile Details & Preferences
 */
crmRouter.patch('/customer/profile', async (req: any, res) => {
  const db = getPool();
  try {
    if (!req.user || req.user.role !== 'Customer') {
      return res.status(401).json({ success: false, error: 'Customer authentication required.' });
    }

    const rawFullName = req.body.full_name || req.body.fullName || req.body.name || null;
    const {
      phone,
      email,
      current_location,
      preferred_contact,
      budget_range,
      preferred_property_type,
      notes,
    } = req.body;

    const cleanPhone = phone ? phone.trim() : null;
    const normPhone = cleanPhone ? cleanPhone.replace(/[^0-9]/g, '') : null;

    await db.query(`
      UPDATE customers
      SET full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          phone_normalized = COALESCE(?, phone_normalized),
          email = COALESCE(?, email),
          current_location = COALESCE(?, current_location),
          preferred_contact = COALESCE(?, preferred_contact),
          budget_range = COALESCE(?, budget_range),
          preferred_property_type = COALESCE(?, preferred_property_type),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      rawFullName?.trim() || null,
      cleanPhone,
      normPhone,
      email?.trim()?.toLowerCase() || null,
      current_location?.trim() || null,
      preferred_contact || null,
      budget_range?.trim() || null,
      preferred_property_type?.trim() || null,
      notes?.trim() || null,
      req.user.id,
    ]);

    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [req.user.id]) as any;
    const customer = rows[0];
    delete customer.password_hash;

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      customer,
    });
  } catch (err: any) {
    console.error('[CRM API] Update customer profile error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update profile' });
  }
});

// ─── 1. Dashboard Overview Metrics (Role-Aware) ──────────────────────
crmRouter.get('/dashboard', requireRoles(ALL_ROLES), async (req: any, res) => {
  const db = getPool();
  const role = req.userRole;
  const user = req.user;

  try {
    // 1. Platform-wide baseline counts
    const [leadsCount] = await db.query('SELECT COUNT(*) as total FROM leads') as any;
    const [newLeadsCount] = await db.query("SELECT COUNT(*) as total FROM leads WHERE LOWER(pipeline_status) = 'new'") as any;
    const [hotCount] = await db.query("SELECT COUNT(*) as total FROM leads WHERE temperature = 'HOT'") as any;
    const [warmCount] = await db.query("SELECT COUNT(*) as total FROM leads WHERE temperature = 'WARM'") as any;
    const [coldCount] = await db.query("SELECT COUNT(*) as total FROM leads WHERE temperature = 'COLD'") as any;
    const [customersCount] = await db.query('SELECT COUNT(*) as total FROM customers') as any;
    const [propertiesCount] = await db.query("SELECT COUNT(*) as total FROM properties WHERE status = 'available'") as any;
    const [landCount] = await db.query("SELECT COUNT(*) as total FROM land_listings WHERE status = 'available'") as any;
    const [visitsCount] = await db.query("SELECT COUNT(*) as total FROM site_visits WHERE status = 'scheduled'") as any;
    const [tasksCount] = await db.query("SELECT COUNT(*) as total FROM tasks WHERE status = 'pending'") as any;
    const [activeDealsCount] = await db.query("SELECT COUNT(*) as total FROM deals WHERE deal_status NOT IN ('closed_won', 'closed_lost')") as any;
    const [closedDealsCount] = await db.query("SELECT COUNT(*) as total FROM deals WHERE deal_status = 'closed_won'") as any;

    const [revenueRes] = await db.query("SELECT COALESCE(SUM(deal_value), 0) as total FROM deals WHERE deal_status = 'closed_won'") as any;
    const [pipelineRes] = await db.query("SELECT COALESCE(SUM(projected_value), 0) as total FROM deals WHERE deal_status NOT IN ('closed_won', 'closed_lost')") as any;

    // 8-stage pipeline distribution
    const [pipelineStageCounts] = await db.query(`
      SELECT LOWER(COALESCE(pipeline_status, 'new')) as stage, COUNT(*) as count
      FROM leads
      GROUP BY stage
    `) as any;

    const stageMap: Record<string, number> = {
      new: 0, contacted: 0, qualified: 0, matching: 0, site_visit: 0, negotiation: 0, won: 0, lost: 0,
    };
    for (const row of pipelineStageCounts || []) {
      const s = String(row.stage).toLowerCase().replace(/[\s-]/g, '_');
      if (s.includes('won')) stageMap.won = (stageMap.won || 0) + Number(row.count);
      else if (s.includes('lost')) stageMap.lost = (stageMap.lost || 0) + Number(row.count);
      else if (s.includes('contact')) stageMap.contacted = (stageMap.contacted || 0) + Number(row.count);
      else if (s.includes('qualif')) stageMap.qualified = (stageMap.qualified || 0) + Number(row.count);
      else if (s.includes('match')) stageMap.matching = (stageMap.matching || 0) + Number(row.count);
      else if (s.includes('visit')) stageMap.site_visit = (stageMap.site_visit || 0) + Number(row.count);
      else if (s.includes('negot')) stageMap.negotiation = (stageMap.negotiation || 0) + Number(row.count);
      else stageMap.new = (stageMap.new || 0) + Number(row.count);
    }

    // Role-specific payload holders
    let roleKpis: Record<string, any> = {};
    let roleData: Record<string, any> = {};
    let recentLeads: any[] = [];
    let followupsToday: any[] = [];
    let recentActivities: any[] = [];
    let upcomingVisits: any[] = [];
    let employeeLeaderboard: any[] = [];

    if (role === 'Super Admin') {
      // ── Super Admin: Platform-wide executive governance ─────────────────
      const [auditLogsCount] = await db.query('SELECT COUNT(*) as total FROM audit_logs') as any;

      const [rLeads] = await db.query(`
        SELECT l.id, l.full_name, l.phone, l.email, l.intent, l.property_type, l.city,
               l.budget_min, l.budget_max, l.currency, l.temperature, l.pipeline_status,
               l.created_at, l.notes, l.assigned_agent,
               e.full_name as assigned_employee_name,
               (SELECT MIN(due_date) FROM tasks WHERE lead_id = l.id AND status = 'pending') as next_followup
        FROM leads l
        LEFT JOIN employees e ON l.assigned_agent = e.id
        ORDER BY l.created_at DESC
        LIMIT 8
      `) as any;
      recentLeads = rLeads || [];

      const [fToday] = await db.query(`
        SELECT t.id, t.title, t.description, t.due_date, t.priority, t.status,
               e.full_name as assigned_employee,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name,
               l.id as lead_id, c.id as customer_id
        FROM tasks t
        LEFT JOIN employees e ON t.assigned_to = e.id
        LEFT JOIN leads l ON t.lead_id = l.id
        LEFT JOIN customers c ON t.customer_id = c.id
        WHERE t.status = 'pending'
        ORDER BY t.due_date ASC
        LIMIT 6
      `) as any;
      followupsToday = fToday || [];

      const [rAct] = await db.query(`
        SELECT id, actor_name, actor_role, action, record_type, details, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 6
      `) as any;
      recentActivities = rAct || [];

      const [uVisits] = await db.query(`
        SELECT sv.id, sv.visit_date, sv.visit_time, sv.status,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name,
               p.title as property_title
        FROM site_visits sv
        LEFT JOIN leads l ON sv.lead_id = l.id
        LEFT JOIN customers c ON sv.customer_id = c.id
        LEFT JOIN properties p ON sv.property_id = p.id
        ORDER BY sv.visit_date ASC
        LIMIT 5
      `) as any;
      upcomingVisits = uVisits || [];

      const [emps] = await db.query(`
        SELECT id, full_name, role, department, points_balance, monthly_target
        FROM employees
        ORDER BY points_balance DESC
        LIMIT 8
      `) as any;
      employeeLeaderboard = emps || [];

      roleKpis = {
        totalCustomers: Number(customersCount?.[0]?.total || 0),
        totalLeads: Number(leadsCount?.[0]?.total || 0),
        availableProperties: Number(propertiesCount?.[0]?.total || 0),
        availableLand: Number(landCount?.[0]?.total || 0),
        pipelineValue: Number(pipelineRes?.[0]?.total || 0),
        closedRevenue: Number(revenueRes?.[0]?.total || 0),
        activeDeals: Number(activeDealsCount?.[0]?.total || 0),
        auditEventsCount: Number(auditLogsCount?.[0]?.total || 0),
      };

    } else if (role === 'Operations Admin') {
      // ── Operations Admin: Inventory, verification workload, inspection tasks ─
      const [propStatusCounts] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
          SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
          SUM(CASE WHEN verification_status != 'verified' OR verification_status IS NULL THEN 1 ELSE 0 END) as pending_verify,
          SUM(CASE WHEN cover_image_url IS NULL OR cover_image_url = '' OR description IS NULL THEN 1 ELSE 0 END) as incomplete
        FROM properties
      `) as any;
      const propStats = propStatusCounts?.[0] || {};

      const [landStatusCounts] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
          SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
          SUM(CASE WHEN verification_status != 'verified' OR verification_status IS NULL THEN 1 ELSE 0 END) as pending_verify
        FROM land_listings
      `) as any;
      const landStats = landStatusCounts?.[0] || {};

      // Inventory pending verification
      const [pendingProps] = await db.query(`
        SELECT id, title, property_type, city, locality, price, verification_status, created_at, 'property' as item_type
        FROM properties
        WHERE verification_status != 'verified' OR verification_status IS NULL
        ORDER BY created_at DESC
        LIMIT 5
      `) as any;

      const [pendingLand] = await db.query(`
        SELECT id, title, land_type as property_type, city, locality, expected_price as price, verification_status, created_at, 'land' as item_type
        FROM land_listings
        WHERE verification_status != 'verified' OR verification_status IS NULL
        ORDER BY created_at DESC
        LIMIT 5
      `) as any;

      // Incomplete listings missing photos or descriptions
      const [incompleteItems] = await db.query(`
        SELECT id, title, property_type, city, locality, price, 'property' as item_type
        FROM properties
        WHERE cover_image_url IS NULL OR cover_image_url = '' OR description IS NULL
        LIMIT 6
      `) as any;

      // Operational tasks
      const [opTasks] = await db.query(`
        SELECT t.id, t.title, t.description, t.due_date, t.priority, t.status,
               e.full_name as assigned_employee
        FROM tasks t
        LEFT JOIN employees e ON t.assigned_to = e.id
        WHERE t.status = 'pending'
        ORDER BY t.due_date ASC
        LIMIT 6
      `) as any;
      followupsToday = opTasks || [];

      // Operational site visits / inspections
      const [opVisits] = await db.query(`
        SELECT sv.id, sv.visit_date, sv.visit_time, sv.status,
               COALESCE(p.title, ll.title, 'Property Inspection') as property_title,
               COALESCE(p.locality, ll.locality, 'Chennai') as locality,
               e.full_name as assigned_agent
        FROM site_visits sv
        LEFT JOIN properties p ON sv.property_id = p.id
        LEFT JOIN land_listings ll ON sv.land_id = ll.id
        LEFT JOIN employees e ON sv.employee_id = e.id
        ORDER BY sv.visit_date ASC
        LIMIT 6
      `) as any;
      upcomingVisits = opVisits || [];

      const [opAudit] = await db.query(`
        SELECT id, actor_name, action, record_type, details, created_at
        FROM audit_logs
        WHERE record_type IN ('property', 'land', 'inventory', 'upload')
        ORDER BY created_at DESC
        LIMIT 6
      `) as any;
      recentActivities = opAudit || [];

      roleKpis = {
        totalProperties: Number(propStats.total || 0),
        availableProperties: Number(propStats.available || 0),
        reservedProperties: Number(propStats.reserved || 0),
        soldProperties: Number(propStats.sold || 0),
        totalLand: Number(landStats.total || 0),
        availableLand: Number(landStats.available || 0),
        pendingVerification: Number(propStats.pending_verify || 0) + Number(landStats.pending_verify || 0),
        incompleteListings: Number(propStats.incomplete || 0),
        operationalTasks: followupsToday.length,
        siteVisitsWorkload: upcomingVisits.length,
      };

      roleData = {
        pendingVerifications: [...(pendingProps || []), ...(pendingLand || [])],
        incompleteListings: incompleteItems || [],
      };

    } else if (role === 'Lead Management Executive') {
      // ── Lead Management Executive: Inbound triage, unassigned routing, follow-ups ─
      const [unassignedCountRes] = await db.query(`
        SELECT COUNT(*) as total FROM leads
        WHERE assigned_agent IS NULL OR assigned_agent = '' OR assigned_agent = 'unassigned'
      `) as any;
      const unassignedTotal = Number(unassignedCountRes?.[0]?.total || 0);

      const [awaitingDetailsRes] = await db.query(`
        SELECT COUNT(*) as total FROM leads
        WHERE (phone IS NULL OR phone = '') OR (budget_max IS NULL OR budget_max = 0)
      `) as any;
      const awaitingDetailsTotal = Number(awaitingDetailsRes?.[0]?.total || 0);

      const [overdueTasksRes] = await db.query(`
        SELECT COUNT(*) as total FROM tasks
        WHERE status = 'pending' AND due_date < CURDATE()
      `) as any;
      const overdueTotal = Number(overdueTasksRes?.[0]?.total || 0);

      const [unmatchedRecsRes] = await db.query(`
        SELECT COUNT(*) as total FROM property_recommendations
        WHERE top_score < 50
      `) as any;
      const unmatchedTotal = Number(unmatchedRecsRes?.[0]?.total || 0);

      // Unassigned leads waiting for qualification/triage
      const [unassignedList] = await db.query(`
        SELECT l.id, l.full_name, l.phone, l.email, l.intent, l.property_type, l.city,
               l.budget_min, l.budget_max, l.currency, l.temperature, l.pipeline_status, l.created_at
        FROM leads l
        WHERE l.assigned_agent IS NULL OR l.assigned_agent = '' OR l.assigned_agent = 'unassigned'
        ORDER BY l.created_at DESC
        LIMIT 8
      `) as any;

      // Leads awaiting required details
      const [awaitingDetailsList] = await db.query(`
        SELECT l.id, l.full_name, l.phone, l.intent, l.property_type, l.temperature, l.created_at
        FROM leads l
        WHERE (l.phone IS NULL OR l.phone = '') OR (l.budget_max IS NULL OR l.budget_max = 0)
        ORDER BY l.created_at DESC
        LIMIT 6
      `) as any;

      // Follow-ups due today or overdue
      const [triageTasks] = await db.query(`
        SELECT t.id, t.title, t.due_date, t.priority, t.status,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name,
               l.id as lead_id, e.full_name as assigned_employee
        FROM tasks t
        LEFT JOIN leads l ON t.lead_id = l.id
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN employees e ON t.assigned_to = e.id
        WHERE t.status = 'pending'
        ORDER BY t.due_date ASC
        LIMIT 8
      `) as any;
      followupsToday = triageTasks || [];

      // Unmatched customer requirements
      const [unmatchedList] = await db.query(`
        SELECT pr.id, pr.structured_requirements as criteria_snapshot, pr.top_score, pr.matched_count as match_count, pr.created_at,
               COALESCE(l.full_name, 'Prospect') as customer_name
        FROM property_recommendations pr
        LEFT JOIN leads l ON pr.lead_id = l.id
        WHERE pr.top_score < 50
        ORDER BY pr.created_at DESC
        LIMIT 6
      `) as any;

      roleKpis = {
        totalLeads: Number(leadsCount?.[0]?.total || 0),
        newLeads: Number(newLeadsCount?.[0]?.total || 0),
        unassignedLeads: unassignedTotal,
        awaitingDetails: awaitingDetailsTotal,
        overdueFollowups: overdueTotal,
        hotLeads: Number(hotCount?.[0]?.total || 0),
        warmLeads: Number(warmCount?.[0]?.total || 0),
        unmatchedInquiries: unmatchedTotal,
      };

      roleData = {
        unassignedLeads: unassignedList || [],
        leadsAwaitingDetails: awaitingDetailsList || [],
        unmatchedInquiries: unmatchedList || [],
      };

    } else if (role === 'Sales Territory Manager') {
      // ── Sales Territory Manager: Regional team oversight, pipeline & deals ─
      const userDept = user?.department || 'Sales';

      // Team members in same department or assigned
      const [teamMembersRes] = await db.query(`
        SELECT id, login_id, full_name, email, role, department, points_balance, monthly_target
        FROM employees
        WHERE department = ? OR id = ?
        ORDER BY points_balance DESC
      `, [userDept, user?.id]) as any;
      const teamEmps = teamMembersRes || [];
      const teamEmpIds = teamEmps.map((e: any) => e.id);
      if (!teamEmpIds.includes(user?.id)) teamEmpIds.push(user?.id);

      const [teamLeadsRes] = await db.query(`
        SELECT COUNT(*) as total FROM leads WHERE assigned_agent IN (?)
      `, [teamEmpIds.length > 0 ? teamEmpIds : ['none']]) as any;

      const [teamDealsRes] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN deal_status = 'closed_won' THEN deal_value ELSE 0 END) as revenue,
          SUM(CASE WHEN deal_status NOT IN ('closed_won', 'closed_lost') THEN projected_value ELSE 0 END) as pipeline,
          SUM(CASE WHEN deal_status = 'closed_won' THEN 1 ELSE 0 END) as won_count,
          SUM(CASE WHEN deal_status = 'in_negotiation' AND agent_id != ? THEN 1 ELSE 0 END) as pending_approvals
        FROM deals
        WHERE agent_id IN (?)
      `, [user?.id, teamEmpIds.length > 0 ? teamEmpIds : ['none']]) as any;
      const dealStats = teamDealsRes?.[0] || {};

      const [teamVisitsRes] = await db.query(`
        SELECT COUNT(*) as total FROM site_visits WHERE employee_id IN (?) AND status = 'scheduled'
      `, [teamEmpIds.length > 0 ? teamEmpIds : ['none']]) as any;

      // Active deals for team
      const [teamDeals] = await db.query(`
        SELECT d.id, d.title, d.deal_value, d.projected_value, d.deal_status, d.agent_id,
               e.full_name as agent_name, l.full_name as prospect_name
        FROM deals d
        LEFT JOIN employees e ON d.agent_id = e.id
        LEFT JOIN leads l ON d.lead_id = l.id
        WHERE d.agent_id IN (?)
        ORDER BY d.created_at DESC
        LIMIT 8
      `, [teamEmpIds.length > 0 ? teamEmpIds : ['none']]) as any;

      // Team tasks
      const [teamTasks] = await db.query(`
        SELECT t.id, t.title, t.due_date, t.priority, t.status,
               e.full_name as assigned_employee,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name
        FROM tasks t
        LEFT JOIN employees e ON t.assigned_to = e.id
        LEFT JOIN leads l ON t.lead_id = l.id
        LEFT JOIN customers c ON t.customer_id = c.id
        WHERE t.assigned_to IN (?) AND t.status = 'pending'
        ORDER BY t.due_date ASC
        LIMIT 6
      `, [teamEmpIds.length > 0 ? teamEmpIds : ['none']]) as any;
      followupsToday = teamTasks || [];

      // Team site visits
      const [teamVisits] = await db.query(`
        SELECT sv.id, sv.visit_date, sv.visit_time, sv.status,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name,
               p.title as property_title, e.full_name as employee_name
        FROM site_visits sv
        LEFT JOIN leads l ON sv.lead_id = l.id
        LEFT JOIN customers c ON sv.customer_id = c.id
        LEFT JOIN properties p ON sv.property_id = p.id
        LEFT JOIN employees e ON sv.employee_id = e.id
        WHERE sv.employee_id IN (?)
        ORDER BY sv.visit_date ASC
        LIMIT 6
      `, [teamEmpIds.length > 0 ? teamEmpIds : ['none']]) as any;
      upcomingVisits = teamVisits || [];

      const targetSum = teamEmps.reduce((acc: number, curr: any) => acc + Number(curr.monthly_target || 0), 0);

      roleKpis = {
        teamMembersCount: teamEmps.length,
        teamLeads: Number(teamLeadsRes?.[0]?.total || 0),
        teamActiveDeals: Number(dealStats.total || 0),
        teamPipelineValue: Number(dealStats.pipeline || 0),
        teamClosedRevenue: Number(dealStats.revenue || 0),
        teamTargetTotal: targetSum,
        teamTargetAchievement: targetSum > 0 ? Math.round((Number(dealStats.revenue || 0) / targetSum) * 100) : 0,
        pendingApprovals: Number(dealStats.pending_approvals || 0),
        teamSiteVisits: Number(teamVisitsRes?.[0]?.total || 0),
      };

      roleData = {
        teamMembers: teamEmps,
        teamDeals: teamDeals || [],
      };

    } else if (role === 'Sales & Growth Executive') {
      // ── Sales & Growth Executive: Personal portfolio, assigned leads, personal rewards ─
      const empId = user?.id;
      const empLogin = user?.loginId || empId;

      const [myLeadsCounts] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN temperature = 'HOT' THEN 1 ELSE 0 END) as hot,
          SUM(CASE WHEN temperature = 'WARM' THEN 1 ELSE 0 END) as warm,
          SUM(CASE WHEN LOWER(pipeline_status) = 'new' THEN 1 ELSE 0 END) as new_leads
        FROM leads
        WHERE assigned_agent = ? OR assigned_agent = ?
      `, [empId, empLogin]) as any;
      const lStats = myLeadsCounts?.[0] || {};

      const [myDealsCounts] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN deal_status = 'closed_won' THEN 1 ELSE 0 END) as won_count,
          SUM(CASE WHEN deal_status = 'closed_won' THEN deal_value ELSE 0 END) as revenue_won,
          SUM(CASE WHEN deal_status NOT IN ('closed_won', 'closed_lost') THEN projected_value ELSE 0 END) as pipeline
        FROM deals
        WHERE agent_id = ? OR agent_id = ?
      `, [empId, empLogin]) as any;
      const dStats = myDealsCounts?.[0] || {};

      const [myTasksCounts] = await db.query(`
        SELECT 
          COUNT(*) as pending,
          SUM(CASE WHEN due_date < CURDATE() THEN 1 ELSE 0 END) as overdue
        FROM tasks
        WHERE (assigned_to = ? OR assigned_to = ?) AND status = 'pending'
      `, [empId, empLogin]) as any;
      const tStats = myTasksCounts?.[0] || {};

      const [myVisitsCount] = await db.query(`
        SELECT COUNT(*) as total FROM site_visits WHERE employee_id = ? OR employee_id = ?
      `, [empId, empLogin]) as any;

      const [empProfile] = await db.query(`
        SELECT points_balance, monthly_target, assigned_territory FROM employees WHERE id = ? OR login_id = ?
      `, [empId, empLogin]) as any;
      const profile = empProfile?.[0] || {};

      // My assigned leads list
      const [myLeads] = await db.query(`
        SELECT l.id, l.full_name, l.phone, l.email, l.intent, l.property_type, l.city,
               l.budget_min, l.budget_max, l.currency, l.temperature, l.pipeline_status, l.created_at,
               (SELECT MIN(due_date) FROM tasks WHERE lead_id = l.id AND status = 'pending') as next_followup
        FROM leads l
        WHERE l.assigned_agent = ? OR l.assigned_agent = ?
        ORDER BY l.created_at DESC
        LIMIT 8
      `, [empId, empLogin]) as any;
      recentLeads = myLeads || [];

      // My tasks
      const [myTasks] = await db.query(`
        SELECT t.id, t.title, t.due_date, t.priority, t.status,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name,
               l.id as lead_id
        FROM tasks t
        LEFT JOIN leads l ON t.lead_id = l.id
        LEFT JOIN customers c ON t.customer_id = c.id
        WHERE (t.assigned_to = ? OR t.assigned_to = ?) AND t.status = 'pending'
        ORDER BY t.due_date ASC
        LIMIT 6
      `, [empId, empLogin]) as any;
      followupsToday = myTasks || [];

      // My site visits
      const [myVisits] = await db.query(`
        SELECT sv.id, sv.visit_date, sv.visit_time, sv.status,
               COALESCE(l.full_name, c.full_name, 'Prospect') as prospect_name,
               p.title as property_title
        FROM site_visits sv
        LEFT JOIN leads l ON sv.lead_id = l.id
        LEFT JOIN customers c ON sv.customer_id = c.id
        LEFT JOIN properties p ON sv.property_id = p.id
        WHERE sv.employee_id = ? OR sv.employee_id = ?
        ORDER BY sv.visit_date ASC
        LIMIT 5
      `, [empId, empLogin]) as any;
      upcomingVisits = myVisits || [];

      // My active deals
      const [myDeals] = await db.query(`
        SELECT d.id, d.title, d.deal_value, d.projected_value, d.deal_status,
               l.full_name as prospect_name, p.title as property_title
        FROM deals d
        LEFT JOIN leads l ON d.lead_id = l.id
        LEFT JOIN properties p ON d.property_id = p.id
        WHERE (d.agent_id = ? OR d.agent_id = ?) AND d.deal_status NOT IN ('closed_won', 'closed_lost')
        ORDER BY d.created_at DESC
        LIMIT 5
      `, [empId, empLogin]) as any;

      // My points ledger transactions
      const [myRewards] = await db.query(`
        SELECT id, points, direction, event_type, reason as description, created_at
        FROM reward_ledger
        WHERE employee_id = ? OR employee_id = ?
        ORDER BY created_at DESC
        LIMIT 6
      `, [empId, empLogin]) as any;

      const monthlyTarget = Number(profile.monthly_target || 40000000);
      const revWon = Number(dStats.revenue_won || 0);

      roleKpis = {
        myLeadsCount: Number(lStats.total || 0),
        myHotLeads: Number(lStats.hot || 0),
        myPendingTasks: Number(tStats.pending || 0),
        myOverdueTasks: Number(tStats.overdue || 0),
        mySiteVisits: Number(myVisitsCount?.[0]?.total || 0),
        myActiveDeals: Number(dStats.total || 0),
        myClosedWonDeals: Number(dStats.won_count || 0),
        myRevenueWon: revWon,
        myPipelineValue: Number(dStats.pipeline || 0),
        myPointsBalance: Number(profile.points_balance || 0),
        myMonthlyTarget: monthlyTarget,
        myAchievementPct: monthlyTarget > 0 ? Math.round((revWon / monthlyTarget) * 100) : 0,
        myTerritory: profile.assigned_territory || 'Chennai OMR / Coastal',
      };

      roleData = {
        myDeals: myDeals || [],
        recentRewards: myRewards || [],
      };
    }

    res.json({
      success: true,
      role,
      user,
      kpis: {
        totalLeads: Number(leadsCount?.[0]?.total || 0),
        newLeads: Number(newLeadsCount?.[0]?.total || 0),
        hotLeads: Number(hotCount?.[0]?.total || 0),
        warmLeads: Number(warmCount?.[0]?.total || 0),
        coldLeads: Number(coldCount?.[0]?.total || 0),
        totalCustomers: Number(customersCount?.[0]?.total || 0),
        availableProperties: Number(propertiesCount?.[0]?.total || 0),
        availableLand: Number(landCount?.[0]?.total || 0),
        upcomingVisits: Number(visitsCount?.[0]?.total || 0),
        pendingTasks: Number(tasksCount?.[0]?.total || 0),
        activeDeals: Number(activeDealsCount?.[0]?.total || 0),
        closedDeals: Number(closedDealsCount?.[0]?.total || 0),
        actualRevenue: Number(revenueRes?.[0]?.total || 0),
        projectedPipeline: Number(pipelineRes?.[0]?.total || 0),
        ...roleKpis,
      },
      roleKpis,
      roleData,
      recentLeads,
      followupsToday,
      pipelineStages: stageMap,
      recentActivities,
      upcomingVisits,
      employeeLeaderboard,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRM API] Dashboard fetch error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to load dashboard data' });
  }
});

// ─── 2. Leads Management ────────────────────────────────────────────
crmRouter.get('/leads', requireRoles(ALL_ROLES), async (req: any, res) => {
  const db = getPool();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const offset = (page - 1) * limit;
    const tempFilter = req.query.temperature as string;
    const statusFilter = req.query.status as string;
    const intentFilter = req.query.intent as string;
    const filterType = req.query.filter as string;
    const search = req.query.search as string;

    const conditions: string[] = [];
    const params: any[] = [];

    // Record scoping: Sales & Growth Executive only sees their assigned leads
    if (req.userRole === 'Sales & Growth Executive' && req.user) {
      conditions.push('(l.assigned_agent = ? OR l.assigned_agent = ?)');
      params.push(req.user.id, req.user.loginId || req.user.id);
    }

    if (tempFilter && tempFilter !== 'ALL') {
      conditions.push('l.temperature = ?');
      params.push(tempFilter.toUpperCase());
    }

    if (statusFilter && statusFilter !== 'ALL') {
      conditions.push('LOWER(l.pipeline_status) = ?');
      params.push(statusFilter.toLowerCase());
    }

    if (intentFilter && intentFilter !== 'ALL') {
      conditions.push('LOWER(l.intent) = ?');
      params.push(intentFilter.toLowerCase());
    }

    // Specific filters: unassigned, followup_due, won, lost
    if (filterType === 'unassigned') {
      conditions.push('(l.assigned_agent IS NULL OR l.assigned_agent = "")');
    } else if (filterType === 'followup_due') {
      conditions.push('EXISTS (SELECT 1 FROM tasks WHERE lead_id = l.id AND status = "pending" AND due_date <= CURDATE())');
    } else if (filterType === 'won') {
      conditions.push('LOWER(l.pipeline_status) LIKE "%won%"');
    } else if (filterType === 'lost') {
      conditions.push('LOWER(l.pipeline_status) LIKE "%lost%"');
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(l.full_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.city LIKE ? OR l.id LIKE ? OR l.notes LIKE ?)');
      params.push(q, q, q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes] = await db.query(`SELECT COUNT(*) as total FROM leads l ${whereClause}`, params) as any;
    const total = Number(countRes?.[0]?.total || 0);

    const [leads] = await db.query(`
      SELECT l.*,
             e.full_name as assigned_employee_name,
             (SELECT MIN(due_date) FROM tasks WHERE lead_id = l.id AND status = 'pending') as next_followup,
             (SELECT MAX(created_at) FROM lead_interactions WHERE lead_id = l.id) as last_interaction_date
      FROM leads l
      LEFT JOIN employees e ON l.assigned_agent = e.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]) as any;

    res.json({
      success: true,
      data: leads || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    console.error('[CRM API] Leads fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new lead
crmRouter.post('/leads', async (req, res) => {
  const db = getPool();
  try {
    const {
      full_name,
      phone,
      email,
      intent,
      property_type,
      city,
      locality,
      budget_min,
      budget_max,
      currency,
      temperature,
      pipeline_status,
      assigned_agent,
      notes,
    } = req.body;

    const id = uuidv4();
    await db.query(`
      INSERT INTO leads (
        id, full_name, phone, email, intent, property_type,
        city, locality, budget_min, budget_max, currency,
        temperature, pipeline_status, assigned_agent, notes, lead_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      full_name || 'Prospect',
      phone || null,
      email || null,
      intent || 'buy',
      property_type || 'residential',
      city || 'Chennai',
      locality || null,
      budget_min ? Number(budget_min) : null,
      budget_max ? Number(budget_max) : null,
      currency || 'INR',
      temperature || 'WARM',
      pipeline_status || 'new',
      assigned_agent || null,
      notes || null,
      'CRM Manual Entry',
    ]);

    // Record audit log
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), 'Employee', 'CRM Staff', 'create', 'lead', id, `Lead created for ${full_name || 'Prospect'}`]);

    // Record interaction
    await db.query(`
      INSERT INTO lead_interactions (id, lead_id, interaction_type, summary)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), id, 'creation', `Lead record created via CRM interface.`]);

    res.json({ success: true, id, message: 'Lead created successfully' });
  } catch (err: any) {
    console.error('[CRM API] Create lead error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single lead with conversations, notes, customer & tasks
crmRouter.get('/leads/:id', async (req, res) => {
  const db = getPool();
  try {
    const leadId = req.params.id;
    const [leadRows] = await db.query(`
      SELECT l.*,
             e.full_name as assigned_employee_name,
             c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
             (SELECT MIN(due_date) FROM tasks WHERE lead_id = l.id AND status = 'pending') as next_followup
      FROM leads l
      LEFT JOIN employees e ON l.assigned_agent = e.id
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.id = ?
    `, [leadId]) as any;

    if (!leadRows || leadRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const lead = leadRows[0];

    // Fetch linked conversations & messages
    const [convos] = await db.query(`
      SELECT c.id, c.channel, c.language, c.started_at, c.ended_at
      FROM conversations c
      WHERE c.lead_id = ? OR (c.session_id = ? AND ? != '')
      ORDER BY c.started_at DESC
    `, [leadId, lead.guest_session_id || '', lead.guest_session_id || '']) as any;

    const conversationsWithMessages = [];
    for (const c of convos || []) {
      const [msgs] = await db.query(`
        SELECT id, role, content, message_type, created_at
        FROM conversation_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `, [c.id]) as any;
      conversationsWithMessages.push({ ...c, messages: msgs || [] });
    }

    // Fetch interactions / notes
    const [interactions] = await db.query(`
      SELECT * FROM lead_interactions WHERE lead_id = ? ORDER BY created_at DESC
    `, [leadId]) as any;

    // Fetch tasks / follow-ups
    const [tasks] = await db.query(`
      SELECT t.*, e.full_name as assignee_name
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to = e.id
      WHERE t.lead_id = ?
      ORDER BY t.due_date ASC
    `, [leadId]) as any;

    res.json({
      success: true,
      data: {
        ...lead,
        conversations: conversationsWithMessages,
        interactions: interactions || [],
        tasks: tasks || [],
      },
    });
  } catch (err: any) {
    console.error('[CRM API] Get lead by id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update lead (status, temp, assigned agent, notes, etc.)
crmRouter.patch('/leads/:id', async (req, res) => {
  const db = getPool();
  try {
    const leadId = req.params.id;
    const allowedFields = [
      'full_name', 'phone', 'email', 'intent', 'property_type',
      'city', 'locality', 'budget_min', 'budget_max', 'currency',
      'temperature', 'pipeline_status', 'assigned_agent', 'notes'
    ];

    const updates: string[] = [];
    const params: any[] = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    params.push(leadId);
    await db.query(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, params);

    // Record interaction
    const summary = req.body.pipeline_status
      ? `Pipeline status updated to ${req.body.pipeline_status}`
      : req.body.temperature
      ? `Temperature updated to ${req.body.temperature}`
      : req.body.assigned_agent
      ? `Lead assigned to agent`
      : `Lead details updated`;

    await db.query(`
      INSERT INTO lead_interactions (id, lead_id, interaction_type, summary)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), leadId, 'update', summary]);

    res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err: any) {
    console.error('[CRM API] Update lead error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add note to lead
crmRouter.post('/leads/:id/notes', async (req, res) => {
  const db = getPool();
  try {
    const leadId = req.params.id;
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'Note text is required' });
    }

    const noteId = uuidv4();
    await db.query(`
      INSERT INTO lead_interactions (id, lead_id, interaction_type, summary)
      VALUES (?, ?, ?, ?)
    `, [noteId, leadId, 'employee_note', note.trim()]);

    res.json({ success: true, id: noteId, message: 'Note added successfully' });
  } catch (err: any) {
    console.error('[CRM API] Add note error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Schedule follow-up task for lead
crmRouter.post('/leads/:id/tasks', async (req, res) => {
  const db = getPool();
  try {
    const leadId = req.params.id;
    const { title, description, due_date, priority, assigned_to } = req.body;
    if (!due_date) {
      return res.status(400).json({ success: false, error: 'Due date is required' });
    }

    const taskId = uuidv4();
    await db.query(`
      INSERT INTO tasks (id, title, description, due_date, priority, status, lead_id, assigned_to)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [
      taskId,
      title || 'Follow up with lead',
      description || null,
      due_date,
      priority || 'medium',
      leadId,
      assigned_to || null,
    ]);

    res.json({ success: true, id: taskId, message: 'Follow-up scheduled successfully' });
  } catch (err: any) {
    console.error('[CRM API] Schedule follow-up error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 3. Customer Management ─────────────────────────────────────────

function validateEmail(email?: string): boolean {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePhone(phone?: string): boolean {
  if (!phone || !phone.trim()) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

crmRouter.get('/customers', async (req, res) => {
  const db = getPool();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const hasLeads = req.query.has_leads as string;
    const preferredContact = req.query.preferred_contact as string;
    const sortBy = req.query.sort as string;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search && search.trim()) {
      conditions.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.current_location LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }

    if (hasLeads === 'yes') {
      conditions.push('EXISTS (SELECT 1 FROM leads WHERE customer_id = c.id)');
    } else if (hasLeads === 'no') {
      conditions.push('NOT EXISTS (SELECT 1 FROM leads WHERE customer_id = c.id)');
    }

    if (preferredContact && preferredContact !== 'ALL') {
      conditions.push('LOWER(c.preferred_contact) = ?');
      params.push(preferredContact.toLowerCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes] = await db.query(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, params) as any;
    const total = Number(countRes?.[0]?.total || 0);

    let orderClause = 'ORDER BY c.created_at DESC';
    if (sortBy === 'name') {
      orderClause = 'ORDER BY c.full_name ASC';
    } else if (sortBy === 'leads') {
      orderClause = 'ORDER BY linked_leads_count DESC, c.created_at DESC';
    }

    const [customers] = await db.query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM leads WHERE customer_id = c.id) as linked_leads_count,
             (SELECT MAX(created_at) FROM leads WHERE customer_id = c.id) as last_enquiry_date
      FROM customers c
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]) as any;

    res.json({
      success: true,
      data: customers || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err: any) {
    console.error('[CRM API] Customers fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Customer with Server-side Validation
crmRouter.post('/customers', async (req, res) => {
  const db = getPool();
  try {
    const { full_name, phone, email, current_location, preferred_contact } = req.body;
    
    // Server-side validation
    if (!full_name || !full_name.trim() || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Customer full name must be at least 2 characters.' });
    }

    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({ success: false, error: 'Valid phone number is required (7 to 15 digits).' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

    const normalizedPhone = phone.replace(/[^\d+]/g, '');

    // Duplicate check on phone
    const [existing] = await db.query('SELECT id, full_name FROM customers WHERE phone_normalized = ? LIMIT 1', [normalizedPhone]) as any;
    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Customer profile already exists for ${existing[0].full_name} with phone ${phone}.`,
        existingId: existing[0].id,
      });
    }

    const id = uuidv4();
    await db.query(`
      INSERT INTO customers (id, full_name, phone, phone_normalized, email, current_location, preferred_contact)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      full_name.trim(),
      phone.trim(),
      normalizedPhone,
      email && email.trim() ? email.trim() : null,
      current_location && current_location.trim() ? current_location.trim() : 'Chennai, India',
      preferred_contact || 'phone',
    ]);

    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      (req.headers['x-user-role'] as string) || 'Admin',
      'Operations',
      'create',
      'customer',
      id,
      `Customer profile created for ${full_name.trim()} (${phone.trim()})`,
    ]);

    res.json({ success: true, id, message: 'Customer created successfully' });
  } catch (err: any) {
    console.error('[CRM API] Create customer error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Customer with Server-side Validation
crmRouter.patch('/customers/:id', async (req, res) => {
  const db = getPool();
  try {
    const customerId = req.params.id;
    const { full_name, phone, email, current_location, preferred_contact } = req.body;

    const [existing] = await db.query('SELECT * FROM customers WHERE id = ?', [customerId]) as any;
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }
    const current = existing[0];

    // Server-side validation
    const updatedName = full_name !== undefined ? String(full_name).trim() : current.full_name;
    if (!updatedName || updatedName.length < 2) {
      return res.status(400).json({ success: false, error: 'Customer full name must be at least 2 characters.' });
    }

    let updatedPhone = current.phone;
    let updatedNormPhone = current.phone_normalized;
    if (phone !== undefined) {
      if (!validatePhone(phone)) {
        return res.status(400).json({ success: false, error: 'Valid phone number is required (7 to 15 digits).' });
      }
      updatedPhone = String(phone).trim();
      updatedNormPhone = updatedPhone.replace(/[^\d+]/g, '');

      // Check collision with another customer
      const [duplicate] = await db.query('SELECT id, full_name FROM customers WHERE phone_normalized = ? AND id != ? LIMIT 1', [updatedNormPhone, customerId]) as any;
      if (duplicate && duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Another customer profile (${duplicate[0].full_name}) already has phone ${updatedPhone}.`,
        });
      }
    }

    let updatedEmail = current.email;
    if (email !== undefined) {
      if (email && !validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email address format.' });
      }
      updatedEmail = email && email.trim() ? email.trim() : null;
    }

    const updatedLocation = current_location !== undefined ? String(current_location).trim() : current.current_location;
    const updatedContact = preferred_contact !== undefined ? String(preferred_contact) : current.preferred_contact;

    await db.query(`
      UPDATE customers
      SET full_name = ?, phone = ?, phone_normalized = ?, email = ?, current_location = ?, preferred_contact = ?
      WHERE id = ?
    `, [updatedName, updatedPhone, updatedNormPhone, updatedEmail, updatedLocation, updatedContact, customerId]);

    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      (req.headers['x-user-role'] as string) || 'Admin',
      'Operations',
      'update',
      'customer',
      customerId,
      `Customer profile updated for ${updatedName}`,
    ]);

    res.json({
      success: true,
      message: 'Customer profile updated successfully',
      data: {
        id: customerId,
        full_name: updatedName,
        phone: updatedPhone,
        phone_normalized: updatedNormPhone,
        email: updatedEmail,
        current_location: updatedLocation,
        preferred_contact: updatedContact,
      },
    });
  } catch (err: any) {
    console.error('[CRM API] Update customer error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Customer Detail View (7 tabs support)
crmRouter.get('/customers/:id', async (req, res) => {
  const db = getPool();
  try {
    const customerId = req.params.id;
    const [custRows] = await db.query('SELECT * FROM customers WHERE id = ?', [customerId]) as any;
    if (!custRows || custRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    const customer = custRows[0];

    // Linked leads
    const [leads] = await db.query('SELECT * FROM leads WHERE customer_id = ? ORDER BY created_at DESC', [customerId]) as any;

    // Linked conversations & messages
    const [convos] = await db.query(`
      SELECT * FROM conversations WHERE customer_id = ? ORDER BY started_at DESC
    `, [customerId]) as any;

    const convosWithMessages = [];
    for (const c of convos || []) {
      const [msgs] = await db.query(`
        SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC
      `, [c.id]) as any;
      convosWithMessages.push({ ...c, messages: msgs || [] });
    }

    // Follow-ups & tasks
    const [tasks] = await db.query(`
      SELECT t.*, e.full_name as assignee_name
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to = e.id
      WHERE t.customer_id = ?
      ORDER BY t.due_date ASC
    `, [customerId]) as any;

    // Site visits
    const [visits] = await db.query(`
      SELECT sv.*, p.title as property_title, e.full_name as employee_name
      FROM site_visits sv
      LEFT JOIN properties p ON sv.property_id = p.id
      LEFT JOIN employees e ON sv.employee_id = e.id
      WHERE sv.customer_id = ?
      ORDER BY sv.visit_date DESC
    `, [customerId]) as any;

    // Deals
    const [deals] = await db.query(`
      SELECT d.*, p.title as property_title, e.full_name as agent_name
      FROM deals d
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN employees e ON d.agent_id = e.id
      WHERE d.customer_id = ?
      ORDER BY d.created_at DESC
    `, [customerId]) as any;

    res.json({
      success: true,
      data: {
        ...customer,
        interactions: tasks || [],
        tasks: tasks || [],
        site_visits: visits,
        deals,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4. Property Management ─────────────────────────────────────────
crmRouter.get('/properties', async (req, res) => {
  const db = getPool();
  try {
    const { search, property_type, status, price_min, price_max, bedrooms } = req.query;
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (title LIKE ? OR locality LIKE ? OR city LIKE ? OR id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (property_type && property_type !== 'all') {
      query += ' AND property_type = ?';
      params.push(property_type);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (price_min) {
      query += ' AND price >= ?';
      params.push(Number(price_min));
    }
    if (price_max) {
      query += ' AND price <= ?';
      params.push(Number(price_max));
    }
    if (bedrooms && bedrooms !== 'all') {
      query += ' AND bedrooms = ?';
      params.push(bedrooms);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    const [properties] = await db.query(query, params) as any;
    res.json({ success: true, data: properties || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.get('/properties/:id', async (req, res) => {
  const db = getPool();
  try {
    const [rows] = await db.query('SELECT * FROM properties WHERE id = ?', [req.params.id]) as any;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }
    const prop = rows[0];
    if (typeof prop.amenities === 'string') {
      try { prop.amenities = JSON.parse(prop.amenities); } catch { prop.amenities = []; }
    }
    if (typeof prop.images === 'string') {
      try { prop.images = JSON.parse(prop.images); } catch { prop.images = []; }
    }
    res.json({ success: true, data: prop });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/properties', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  try {
    const {
      title, description, purpose, property_type, status,
      country, state_province, city, locality, address, postal_code,
      building_name, price, currency, rental_frequency,
      bedrooms, bathrooms, built_up_area, plot_area, area_unit,
      furnishing, parking, amenities, cover_image_url, images,
      assigned_agent_id, verification_status,
    } = req.body;

    if (!title || !property_type || price === undefined) {
      return res.status(400).json({ success: false, error: 'Title, property type, and price are required.' });
    }

    const initialStatus = status === 'sold' ? 'available' : (status || 'available');
    const id = `PROP-${Date.now().toString().slice(-6)}`;

    await db.query(`
      INSERT INTO properties (
        id, title, description, purpose, property_type, status,
        country, state_province, city, locality, address, postal_code,
        building_name, price, currency, rental_frequency,
        bedrooms, bathrooms, built_up_area, plot_area, area_unit,
        furnishing, parking, amenities, cover_image_url, images,
        assigned_agent_id, verification_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `, [
      id, title, description || null, purpose || 'sale', property_type, initialStatus,
      country || 'India', state_province || null, city || 'Chennai', locality || null, address || null, postal_code || null,
      building_name || null, Number(price) || 0, currency || 'INR', rental_frequency || null,
      bedrooms || null, bathrooms || null, built_up_area ? Number(built_up_area) : null, plot_area ? Number(plot_area) : null, area_unit || 'sqft',
      furnishing || null, parking || null, JSON.stringify(amenities || []), cover_image_url || null, JSON.stringify(images || []),
      assigned_agent_id || null, verification_status || 'verified'
    ]);

    // Audit log
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, 'CREATE_PROPERTY', 'property', ?, ?)
    `, [uuidv4(), req.user?.fullName || 'Admin', req.userRole, id, `Created listing: ${title}`]);

    res.status(201).json({ success: true, id, message: 'Property listing created successfully.' });
  } catch (err: any) {
    console.error('[Create property error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.patch('/properties/:id', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  try {
    const propertyId = req.params.id;
    const updates = req.body;

    // Safety check: Cannot mark property as sold directly from listing edit
    if (updates.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Status cannot be set to "Sold" manually. Sold status is automatically assigned only after authorized purchase verification on deals.',
      });
    }

    const allowedFields = [
      'title', 'description', 'purpose', 'property_type', 'status',
      'country', 'state_province', 'city', 'locality', 'address', 'postal_code',
      'building_name', 'price', 'currency', 'rental_frequency',
      'bedrooms', 'bathrooms', 'built_up_area', 'plot_area', 'area_unit',
      'furnishing', 'parking', 'cover_image_url', 'assigned_agent_id', 'verification_status'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(val);
      } else if (key === 'amenities' || key === 'images') {
        setClauses.push(`${key} = ?`);
        values.push(JSON.stringify(val));
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided for update.' });
    }

    values.push(propertyId);
    await db.query(`UPDATE properties SET ${setClauses.join(', ')} WHERE id = ?`, values);

    // Audit log
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, 'UPDATE_PROPERTY', 'property', ?, ?)
    `, [uuidv4(), req.user?.fullName || 'Admin', req.userRole, propertyId, `Updated fields: ${Object.keys(updates).join(', ')}`]);

    res.json({ success: true, message: 'Property updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.delete('/properties/:id', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  try {
    const propertyId = req.params.id;
    await db.query("UPDATE properties SET status = 'archived' WHERE id = ?", [propertyId]);
    res.json({ success: true, message: 'Property listing archived.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 5. Land Management ─────────────────────────────────────────────
crmRouter.get('/land', async (req, res) => {
  const db = getPool();
  try {
    const { search, land_type, status, price_min, price_max } = req.query;
    let query = 'SELECT * FROM land_listings WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (title LIKE ? OR locality LIKE ? OR city LIKE ? OR survey_number LIKE ? OR id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (land_type && land_type !== 'all') {
      query += ' AND land_type = ?';
      params.push(land_type);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (price_min) {
      query += ' AND expected_price >= ?';
      params.push(Number(price_min));
    }
    if (price_max) {
      query += ' AND expected_price <= ?';
      params.push(Number(price_max));
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    const [land] = await db.query(query, params) as any;
    res.json({ success: true, data: land || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.get('/land/:id', async (req, res) => {
  const db = getPool();
  try {
    const [rows] = await db.query('SELECT * FROM land_listings WHERE id = ?', [req.params.id]) as any;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Land listing not found' });
    }
    const land = rows[0];
    if (typeof land.images === 'string') {
      try { land.images = JSON.parse(land.images); } catch { land.images = []; }
    }
    res.json({ success: true, data: land });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/land', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  try {
    const {
      title, description, land_type, status,
      country, state_province, district, city, village, locality,
      survey_number, total_area, area_unit, expected_price, price, currency, price_basis,
      road_access, frontage, zoning, water_availability, electricity_availability,
      ownership_status, verification_status, assigned_agent_id, images, notes
    } = req.body;

    const finalPrice = expected_price !== undefined ? expected_price : price;

    if (!title || !land_type || finalPrice === undefined || !total_area) {
      return res.status(400).json({ success: false, error: 'Title, land type, area, and expected price are required.' });
    }

    const initialStatus = status === 'sold' ? 'available' : (status || 'available');
    const id = `LAND-${Date.now().toString().slice(-6)}`;

    await db.query(`
      INSERT INTO land_listings (
        id, title, description, land_type, status,
        country, state_province, district, city, village, locality,
        survey_number, total_area, area_unit, expected_price, currency, price_basis,
        road_access, frontage, zoning, water_availability, electricity_availability,
        ownership_status, verification_status, assigned_agent_id, images, notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `, [
      id, title, description || null, land_type, initialStatus,
      country || 'India', state_province || null, district || null, city || 'Chennai', village || null, locality || null,
      survey_number || null, Number(total_area) || 0, area_unit || 'cents', Number(finalPrice) || 0, currency || 'INR', price_basis || 'total',
      road_access || null, frontage || null, zoning || null, water_availability !== false, electricity_availability !== false,
      ownership_status || 'Freehold', verification_status || 'verified', assigned_agent_id || null, JSON.stringify(images || []), notes || null
    ]);

    // Audit log
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, 'CREATE_LAND', 'land', ?, ?)
    `, [uuidv4(), req.user?.fullName || 'Admin', req.userRole, id, `Created land listing: ${title}`]);

    res.status(201).json({ success: true, id, message: 'Land listing created successfully.' });
  } catch (err: any) {
    console.error('[Create land error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.patch('/land/:id', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  try {
    const landId = req.params.id;
    const updates = req.body;

    if (updates.status === 'sold') {
      return res.status(400).json({
        success: false,
        error: 'Status cannot be set to "Sold" manually. Sold status is automatically assigned only after authorized purchase verification on deals.',
      });
    }

    const allowedFields = [
      'title', 'description', 'land_type', 'status',
      'country', 'state_province', 'district', 'city', 'village', 'locality',
      'survey_number', 'total_area', 'area_unit', 'expected_price', 'currency', 'price_basis',
      'road_access', 'frontage', 'zoning', 'water_availability', 'electricity_availability',
      'ownership_status', 'verification_status', 'assigned_agent_id', 'notes'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(val);
      } else if (key === 'images') {
        setClauses.push(`${key} = ?`);
        values.push(JSON.stringify(val));
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided for update.' });
    }

    values.push(landId);
    await db.query(`UPDATE land_listings SET ${setClauses.join(', ')} WHERE id = ?`, values);

    // Audit log
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, 'UPDATE_LAND', 'land', ?, ?)
    `, [uuidv4(), req.user?.fullName || 'Admin', req.userRole, landId, `Updated fields: ${Object.keys(updates).join(', ')}`]);

    res.json({ success: true, message: 'Land listing updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.delete('/land/:id', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  try {
    const landId = req.params.id;
    await db.query("UPDATE land_listings SET status = 'archived' WHERE id = ?", [landId]);
    res.json({ success: true, message: 'Land listing archived.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 6. Deals & Pipeline ────────────────────────────────────────────
crmRouter.get('/deals', async (_req, res) => {
  const db = getPool();
  try {
    const [deals] = await db.query(`
      SELECT d.*, l.full_name as prospect_name, p.title as property_title, e.full_name as agent_name
      FROM deals d
      LEFT JOIN leads l ON d.lead_id = l.id
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN employees e ON d.agent_id = e.id
      ORDER BY d.created_at DESC
      LIMIT 50
    `) as any;
    res.json({ success: true, data: deals || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/deals', requireRoles(['Super Admin', 'Sales Territory Manager', 'Sales & Growth Executive']), async (req: any, res) => {
  const db = getPool();
  try {
    const {
      title, lead_id, customer_id, property_id, land_id, agent_id, manager_id,
      transaction_type, deal_status, deal_value, projected_value, currency, notes
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Deal title is required.' });
    }

    const id = `DEAL-${Date.now().toString().slice(-6)}`;
    await db.query(`
      INSERT INTO deals (
        id, title, lead_id, customer_id, property_id, land_id,
        agent_id, manager_id, transaction_type, deal_status, deal_value,
        projected_value, currency, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, title, lead_id || null, customer_id || null, property_id || null, land_id || null,
      agent_id || req.user?.id || 'CO1', manager_id || null, transaction_type || 'buy',
      deal_status || 'in_negotiation', Number(deal_value) || 0,
      Number(projected_value || deal_value) || 0, currency || 'INR', notes || null
    ]);

    res.status(201).json({ success: true, id, message: 'Deal created successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Verified Deal Purchase Workflow (Strictly Idempotent) ───────────
crmRouter.post('/deals/:id/verify-purchase', requireRoles(['Super Admin', 'Sales Territory Manager']), async (req: any, res) => {
  const db = getPool();
  const dealId = req.params.id;
  try {
    const [deals] = await db.query('SELECT * FROM deals WHERE id = ?', [dealId]) as any;
    if (!deals || deals.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found.' });
    }
    const deal = deals[0];

    // Self-approval prohibition
    if (req.user && req.userRole === 'Sales Territory Manager' && deal.agent_id === req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Self-approval prohibited: Sales Territory Managers cannot verify purchases where they are the assigned agent. Super Admin approval required.',
      });
    }

    // IDEMPOTENCY CHECK: Was this deal already verified?
    const [existingAwards] = await db.query(
      "SELECT id FROM reward_ledger WHERE source_event_id = ? AND event_type = 'purchase_verified'",
      [dealId]
    ) as any;

    if (existingAwards && existingAwards.length > 0) {
      return res.json({
        success: true,
        message: 'Deal was already verified and conversion points were previously awarded.',
        alreadyVerified: true,
        alreadyAwarded: true,
        pointsAwarded: 0,
        dealId,
      });
    }

    const pointsToAward = 500; // Conversion points award

    // 1. Record immutable ledger entry
    const ledgerId = uuidv4();
    await db.query(`
      INSERT INTO reward_ledger (id, employee_id, event_type, points, direction, source_event_id, reason, actor_id)
      VALUES (?, ?, 'purchase_verified', ?, 'credit', ?, ?, ?)
    `, [ledgerId, deal.agent_id, pointsToAward, dealId, `Verified successful purchase: ${deal.title}`, req.user?.id || 'system']);

    // 2. Increment employee points balance
    if (deal.agent_id) {
      await db.query('UPDATE employees SET points_balance = points_balance + ? WHERE id = ?', [pointsToAward, deal.agent_id]);
    }

    // 3. Mark deal as closed_won and verified
    await db.query(`
      UPDATE deals
      SET deal_status = 'closed_won', payment_status = 'verified', actual_close_date = CURDATE()
      WHERE id = ?
    `, [dealId]);

    // 4. Update linked inventory status to 'sold'
    if (deal.property_id) {
      await db.query("UPDATE properties SET status = 'sold' WHERE id = ?", [deal.property_id]);
    }
    if (deal.land_id) {
      await db.query("UPDATE land_listings SET status = 'sold' WHERE id = ?", [deal.land_id]);
    }

    // 5. Audit log
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, 'VERIFY_PURCHASE', 'deal', ?, ?)
    `, [uuidv4(), req.user?.fullName || 'Manager', req.userRole, dealId, `Verified purchase for deal ${deal.title}. Awarded ${pointsToAward} pts.`]);

    res.json({
      success: true,
      message: `Purchase successfully verified. ${pointsToAward} points awarded to employee.`,
      pointsAwarded: pointsToAward,
      dealId,
    });
  } catch (err: any) {
    console.error('[Verify purchase error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 7. Appointments & Site Visits ──────────────────────────────────
crmRouter.get('/site-visits', async (_req, res) => {
  const db = getPool();
  try {
    const [visits] = await db.query(`
      SELECT sv.*,
             COALESCE(c.full_name, l.full_name, 'Direct Client') as prospect_name,
             COALESCE(c.phone, l.phone) as prospect_phone,
             COALESCE(p.title, ll.title, sv.property_id, sv.land_id, 'Property Tour') as property_title,
             e.full_name as employee_name
      FROM site_visits sv
      LEFT JOIN customers c ON sv.customer_id = c.id
      LEFT JOIN leads l ON sv.lead_id = l.id
      LEFT JOIN properties p ON sv.property_id = p.id
      LEFT JOIN land_listings ll ON sv.land_id = ll.id
      LEFT JOIN employees e ON sv.employee_id = e.id
      ORDER BY sv.visit_date DESC
      LIMIT 100
    `) as any;
    res.json({ success: true, data: visits || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 8. Tasks & Follow-ups ──────────────────────────────────────────
crmRouter.get('/tasks', async (_req, res) => {
  const db = getPool();
  try {
    const [tasks] = await db.query(`
      SELECT t.*, e.full_name as assignee_name, l.full_name as lead_name
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to = e.id
      LEFT JOIN leads l ON t.lead_id = l.id
      ORDER BY t.due_date ASC
      LIMIT 50
    `) as any;
    res.json({ success: true, data: tasks || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.patch('/tasks/:id/complete', async (req, res) => {
  const db = getPool();
  try {
    const taskId = req.params.id;
    const { completion_notes } = req.body;
    await db.query(`
      UPDATE tasks SET status = 'completed', completion_notes = ? WHERE id = ?
    `, [completion_notes || 'Marked completed by employee', taskId]);
    res.json({ success: true, message: 'Task marked as completed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/tasks', async (req, res) => {
  const db = getPool();
  try {
    const { title, description, due_date, priority, lead_id, customer_id, assigned_to } = req.body;
    if (!title || !due_date) {
      return res.status(400).json({ success: false, error: 'Title and due date are required' });
    }
    const id = uuidv4();
    await db.query(`
      INSERT INTO tasks (id, title, description, due_date, priority, status, lead_id, customer_id, assigned_to)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [id, title, description || null, due_date, priority || 'medium', lead_id || null, customer_id || null, assigned_to || null]);
    res.json({ success: true, id, message: 'Task created successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 9. Employees & Teams ───────────────────────────────────────────
crmRouter.get('/employees', requireRoles(['Super Admin', 'Operations Admin', 'Sales Territory Manager']), async (req: any, res) => {
  const db = getPool();
  try {
    let query = `
      SELECT e.id, e.login_id, e.full_name, e.email, e.phone, e.department, e.role,
             e.employment_status, e.assigned_territory, e.monthly_target, e.points_balance,
             e.created_at, e.last_login, t.name as team_name
      FROM employees e
      LEFT JOIN teams t ON e.team_id = t.id
    `;
    const params: any[] = [];
    if (req.userRole === 'Sales Territory Manager') {
      const dept = req.user?.department || 'Sales';
      query += ` WHERE e.department = ? OR e.id = ?`;
      params.push(dept, req.user?.id);
    }
    query += ` ORDER BY e.created_at ASC`;
    const [employees] = await db.query(query, params) as any;
    res.json({ success: true, data: employees || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Employee Performance Analytics
crmRouter.get('/employees/:id/performance', async (req, res) => {
  const db = getPool();
  const empId = req.params.id;
  try {
    const [empRows] = await db.query('SELECT * FROM employees WHERE id = ? OR login_id = ?', [empId, empId]) as any;
    if (!empRows || empRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    const emp = empRows[0];

    const [leadCount] = await db.query('SELECT COUNT(*) as c FROM leads WHERE assigned_agent = ?', [emp.id]) as any;
    const [taskCount] = await db.query("SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status = 'completed'", [emp.id]) as any;
    const [visitCount] = await db.query("SELECT COUNT(*) as c FROM site_visits WHERE employee_id = ? AND status = 'completed'", [emp.id]) as any;
    const [dealCount] = await db.query("SELECT COUNT(*) as c, COALESCE(SUM(deal_value), 0) as rev FROM deals WHERE agent_id = ? AND deal_status = 'closed_won'", [emp.id]) as any;
    const [recentRewards] = await db.query('SELECT * FROM reward_ledger WHERE employee_id = ? ORDER BY created_at DESC LIMIT 10', [emp.id]) as any;

    res.json({
      success: true,
      performance: {
        employeeId: emp.id,
        fullName: emp.full_name,
        role: emp.role,
        assignedLeads: leadCount?.[0]?.c || 0,
        assigned_leads: leadCount?.[0]?.c || 0,
        followupsCompleted: taskCount?.[0]?.c || 0,
        followups_completed: taskCount?.[0]?.c || 0,
        siteVisitsCompleted: visitCount?.[0]?.c || 0,
        site_visits_completed: visitCount?.[0]?.c || 0,
        verifiedPurchases: dealCount?.[0]?.c || 0,
        verified_purchases: dealCount?.[0]?.c || 0,
        attributedRevenue: Number(dealCount?.[0]?.rev) || 0,
        attributed_revenue: Number(dealCount?.[0]?.rev) || 0,
        currentPoints: emp.points_balance || 0,
        points_balance: emp.points_balance || 0,
        monthlyTarget: Number(emp.monthly_target) || 0,
        monthly_target: Number(emp.monthly_target) || 0,
        recentPointsLedger: recentRewards || [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.get('/teams', requireRoles(['Super Admin', 'Operations Admin', 'Sales Territory Manager']), async (_req, res) => {
  const db = getPool();
  try {
    const [teams] = await db.query('SELECT * FROM teams ORDER BY name ASC') as any;
    res.json({ success: true, data: teams || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 10. Rewards Ledger & Points ────────────────────────────────────
crmRouter.get('/rewards', async (_req, res) => {
  const db = getPool();
  try {
    const [rewards] = await db.query(`
      SELECT r.*, e.full_name as employee_name
      FROM reward_ledger r
      JOIN employees e ON r.employee_id = e.id
      ORDER BY r.created_at DESC
      LIMIT 50
    `) as any;
    res.json({ success: true, data: rewards || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 11. Marketing Campaigns ────────────────────────────────────────
crmRouter.get('/campaigns', requireRoles(['Super Admin', 'Operations Admin', 'Sales & Growth Executive']), async (_req, res) => {
  const db = getPool();
  try {
    const [campaigns] = await db.query('SELECT * FROM campaigns ORDER BY created_at DESC') as any;
    res.json({ success: true, data: campaigns || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 12. In-App Notifications ───────────────────────────────────────
crmRouter.get('/notifications', async (_req, res) => {
  const db = getPool();
  try {
    const [notifs] = await db.query('SELECT * FROM crm_notifications ORDER BY created_at DESC LIMIT 20') as any;
    res.json({ success: true, data: notifs || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 13. Audit Logs (Restricted to Super Admin & Operations Admin) ──
crmRouter.get('/audit-logs', requireRoles(['Super Admin', 'Operations Admin']), async (_req, res) => {
  const db = getPool();
  try {
    const [logs] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50') as any;
    res.json({ success: true, data: logs || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.post('/audit-logs', requireRoles(['Super Admin', 'Operations Admin']), async (req: any, res) => {
  const db = getPool();
  const { actor_name, actor_role, action, record_type, record_id, details } = req.body;
  try {
    const id = uuidv4();
    await db.query(`
      INSERT INTO audit_logs (id, actor_name, actor_role, action, record_type, record_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, actor_name || req.user?.fullName || 'System User', actor_role || req.userRole || 'Developer', action || 'action', record_type || 'general', record_id || null, details || '']);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 14. CRM Settings (Restricted to Super Admin Only) ───────────────
crmRouter.get('/settings', requireRoles(['Super Admin']), async (_req, res) => {
  const db = getPool();
  try {
    const [rows] = await db.query('SELECT * FROM crm_settings') as any;
    const settings: Record<string, any> = {};
    for (const r of rows || []) {
      settings[r.setting_key] = typeof r.setting_value === 'string' ? JSON.parse(r.setting_value) : r.setting_value;
    }
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

crmRouter.patch('/settings', requireRoles(['Super Admin']), async (req, res) => {
  const db = getPool();
  try {
    const { setting_key, setting_value } = req.body;
    if (!setting_key || setting_value === undefined) {
      return res.status(400).json({ success: false, error: 'setting_key and setting_value are required' });
    }
    await db.query(`
      INSERT INTO crm_settings (setting_key, setting_value)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = ?
    `, [setting_key, JSON.stringify(setting_value), JSON.stringify(setting_value)]);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 15. User Management & Security Matrix (Super Admin Only) ───────
crmRouter.get('/users', requireRoles(['Super Admin']), async (_req, res) => {
  const db = getPool();
  try {
    const [users] = await db.query(`
      SELECT e.id, e.login_id, e.full_name, e.email, e.phone, e.department, e.role, e.employment_status,
             e.assigned_territory, e.monthly_target, e.points_balance, e.created_at, e.last_login,
             t.name as team_name
      FROM employees e
      LEFT JOIN teams t ON e.team_id = t.id
      ORDER BY e.created_at ASC
    `) as any;
    res.json({
      success: true,
      data: users || [],
      scope: 'Global Executive Access',
      totalUsers: (users || []).length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 16. AI Property Matching & Recommendation Engine Endpoints ────

/**
 * POST /api/crm/matching/recommend
 * Core deterministic property search & ranking endpoint based on structured requirements.
 * Excludes sold/archived inventory, calculates multi-criteria scores (0-100),
 * provides detailed explainability reasons, and persists recommendation logs.
 */
crmRouter.post('/matching/recommend', async (req: any, res) => {
  const db = getPool();
  try {
    const {
      customer_id,
      lead_id,
      conversation_id,
      session_id,
      requirements,
      original_message,
      limit = 10,
      page = 1,
      persist = true,
      strict_budget,
      allow_flexible_options,
      search_mode,
      category, // 'land' | 'property' | 'any'
    } = req.body;

    if (!requirements || typeof requirements !== 'object') {
      return res.status(400).json({ success: false, error: 'A requirements object is required.' });
    }

    const structuredReq: StructuredRequirements = {
      ...requirements,
      listing_category: category || requirements.listing_category || 'any',
      strict_budget: strict_budget !== undefined ? strict_budget : requirements.strict_budget,
      allow_flexible_options: allow_flexible_options !== undefined ? allow_flexible_options : requirements.allow_flexible_options,
      search_mode: search_mode || requirements.search_mode || 'strict',
    };

    // Employee authorization & scope check if customer_id or lead_id specified
    const authEmployee = req.user && req.userRole !== 'Unauthenticated' && req.userRole !== 'Customer' ? req.user : null;
    if (authEmployee && authEmployee.role === 'Sales & Growth Executive' && lead_id) {
      const [leadCheck] = await db.query('SELECT assigned_agent FROM leads WHERE id = ?', [lead_id]) as any;
      if (!leadCheck || leadCheck.length === 0) {
        return res.status(404).json({ success: false, error: 'Specified lead not found.' });
      }
      if (leadCheck[0].assigned_agent !== authEmployee.id && leadCheck[0].assigned_agent !== authEmployee.loginId) {
        return res.status(403).json({ success: false, error: 'Access denied: You can only query leads assigned to your portfolio.' });
      }
    }

    const reqType = (structuredReq.property_type || '').toLowerCase();
    const wantsOnlyLand = structuredReq.listing_category === 'land' || reqType.includes('land') || reqType.includes('plot') || reqType.includes('site');
    const wantsOnlyBuilt = structuredReq.listing_category === 'property' || reqType.includes('apartment') || reqType.includes('flat') || reqType.includes('villa') || reqType.includes('penthouse');

    let propertiesListings: any[] = [];
    if (!wantsOnlyLand) {
      const [properties] = await db.query(`
        SELECT id, title, description, purpose, property_type, status,
               country, state_province, city, locality, address, postal_code,
               building_name, price, currency, bedrooms, bathrooms,
               built_up_area, plot_area, area_unit, furnishing, parking,
               amenities, cover_image_url, images, verification_status,
               quality_score, metro_distance_km, locality_rating, created_at
        FROM properties
        WHERE status = 'available'
        ORDER BY created_at DESC
        LIMIT 200
      `) as any;
      propertiesListings = (properties || []).map((p: any) => ({
        ...p,
        listing_type: 'property' as const,
      }));
    }

    let landListings: any[] = [];
    if (!wantsOnlyBuilt) {
      const [landRows] = await db.query(`
        SELECT id, title, description, land_type, status,
               country, state_province, district, city, locality,
               survey_number, total_area, area_unit, expected_price as price,
               expected_price, currency, price_basis, road_access, frontage, zoning,
               water_availability, electricity_availability, ownership_status,
               verification_status, images, metro_distance_km, locality_rating, created_at
        FROM land_listings
        WHERE status = 'available'
        ORDER BY created_at DESC
        LIMIT 200
      `) as any;
      landListings = (landRows || []).map((l: any) => ({
        ...l,
        listing_type: 'land' as const,
        price: Number(l.price || l.expected_price || 0),
        expected_price: Number(l.price || l.expected_price || 0),
        water_availability: Boolean(l.water_availability),
        electricity_availability: Boolean(l.electricity_availability),
      }));
    }

    const combinedInventory: InventoryItem[] = [
      ...propertiesListings,
      ...landListings,
    ];

    // Compute deterministic ranking with tie-breaking
    const ranking = rankProperties(combinedInventory, structuredReq, {
      limit: Number(limit) || 10,
      search_mode: structuredReq.search_mode,
    });

    const recId = `REC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const employeeId = authEmployee ? authEmployee.id : null;

    if (persist) {
      const topScore = ranking.results.length > 0 ? ranking.results[0].final_score : 0;
      await db.query(`
        INSERT INTO property_recommendations (
          id, customer_id, lead_id, conversation_id, session_id, employee_id,
          original_message, structured_requirements, algorithm_version,
          recommended_properties, matched_count, top_score, is_unmatched, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        recId,
        customer_id || null,
        lead_id || null,
        conversation_id || null,
        session_id || null,
        employeeId,
        original_message || null,
        JSON.stringify(structuredReq),
        'v2.0-unified-land-property',
        JSON.stringify(ranking.results),
        ranking.results.length,
        topScore,
        ranking.unmatched,
        ranking.unmatched ? 'unmatched' : 'recommended'
      ]);

      // If unmatched, notify sales territory manager
      if (ranking.unmatched) {
        await db.query(`
          INSERT INTO crm_notifications (id, recipient_role, title, message, type, link_module)
          VALUES (?, 'Sales Territory Manager', ?, ?, 'warning', 'leads')
        `, [
          uuidv4(),
          'Unmatched Land & Property Search Request',
          `Customer search could not find exact inventory: ${structuredReq.property_type || structuredReq.land_type || 'land/property'} in ${structuredReq.location || 'Chennai'}. Follow-up required.`
        ]);
      }
    }

    res.json({
      success: true,
      recommendation_id: recId,
      algorithm_version: 'v2.0-unified-land-property',
      total_eligible: ranking.total_eligible,
      total_eligible_matches: ranking.total_eligible,
      unmatched: ranking.unmatched,
      unmatched_reason: ranking.unmatched_reason || null,
      results: ranking.results,
      strict_matches: ranking.strict_matches,
      flexible_matches: ranking.flexible_matches,
      saved: persist,
    });
  } catch (err: any) {
    console.error('[Recommendation API error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/crm/matching/interest
 * Save property to customer's interested properties and link to lead
 */
crmRouter.post('/matching/interest', async (req: any, res) => {
  const db = getPool();
  try {
    const { property_id, land_id, recommendation_id, customer_id, lead_id, notes } = req.body;
    if (!property_id && !land_id) {
      return res.status(400).json({ success: false, error: 'Property ID or Land ID is required.' });
    }

    const id = `INT-${Date.now().toString().slice(-6)}`;
    await db.query(`
      INSERT INTO customer_interested_properties (id, customer_id, lead_id, property_id, land_id, recommendation_id, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'saved', ?)
    `, [id, customer_id || null, lead_id || null, property_id || null, land_id || null, recommendation_id || null, notes || null]);

    if (recommendation_id) {
      await db.query(`
        UPDATE property_recommendations
        SET status = 'interested', selected_property_id = ?, customer_feedback = 'interested'
        WHERE id = ?
      `, [property_id || land_id, recommendation_id]);
    }

    if (lead_id) {
      await db.query(`
        INSERT INTO lead_interactions (id, lead_id, interaction_type, summary, metadata)
        VALUES (?, ?, 'PROPERTY_INTEREST', ?, ?)
      `, [uuidv4(), lead_id, `Customer saved interested property: ${property_id || land_id}`, JSON.stringify({ property_id, land_id, notes })]);
    }

    res.json({ success: true, id, message: 'Property saved to interested properties successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/crm/matching/site-visit
 * Schedules a site visit directly from recommendation card
 */
crmRouter.post('/matching/site-visit', async (req: any, res) => {
  const db = getPool();
  try {
    const { property_id, land_id, customer_id, lead_id, employee_id, visit_date, visit_time, notes } = req.body;
    if (!visit_date || !visit_time) {
      return res.status(400).json({ success: false, error: 'Visit date and time are required.' });
    }

    const id = `VISIT-${Date.now().toString().slice(-6)}`;
    let assignedEmp = employee_id || (req.user?.id && req.userRole !== 'Customer' ? req.user.id : null);
    if (!assignedEmp) {
      const [empRows] = await db.query("SELECT id FROM employees WHERE role = 'Sales & Growth Executive' LIMIT 1") as any;
      assignedEmp = empRows?.[0]?.id || 'CO1';
    }

    await db.query(`
      INSERT INTO site_visits (id, customer_id, lead_id, property_id, land_id, employee_id, visit_date, visit_time, status, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
    `, [id, customer_id || null, lead_id || null, property_id || null, land_id || null, assignedEmp, visit_date, visit_time, notes || 'Requested via AI Chat Property Recommendation']);

    // Create follow-up task for the assigned sales agent
    await db.query(`
      INSERT INTO tasks (id, title, description, assigned_to, lead_id, customer_id, due_date, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'high', 'pending')
    `, [
      uuidv4(),
      `Site Visit: ${property_id || land_id} on ${visit_date} at ${visit_time}`,
      `Conduct property walkthrough and client consultation. Notes: ${notes || 'No extra notes'}`,
      assignedEmp,
      lead_id || null,
      customer_id || null,
      visit_date
    ]);

    if (lead_id) {
      await db.query("UPDATE leads SET pipeline_status = 'site_visit' WHERE id = ?", [lead_id]);
      await db.query(`
        INSERT INTO lead_interactions (id, lead_id, interaction_type, summary, metadata)
        VALUES (?, ?, 'SITE_VISIT_SCHEDULED', ?, ?)
      `, [uuidv4(), lead_id, `Site visit booked for ${visit_date} at ${visit_time}`, JSON.stringify({ visit_id: id, property_id, land_id, visit_date, visit_time })]);
    }

    res.status(201).json({ success: true, id, message: 'Site visit scheduled successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/crm/matching/feedback
 * Records customer feedback on recommendation (e.g. view more, change req, schedule visit)
 */
crmRouter.post('/matching/feedback', async (req: any, res) => {
  const db = getPool();
  try {
    const { recommendation_id, feedback, notes, selected_property_id } = req.body;
    if (!recommendation_id || !feedback) {
      return res.status(400).json({ success: false, error: 'recommendation_id and feedback are required.' });
    }

    await db.query(`
      UPDATE property_recommendations
      SET customer_feedback = ?, feedback_notes = ?, selected_property_id = COALESCE(?, selected_property_id)
      WHERE id = ?
    `, [feedback, notes || null, selected_property_id || null, recommendation_id]);

    res.json({ success: true, message: 'Feedback recorded successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/crm/matching/history
 * Fetch recommendation history for a customer/lead/session
 */
crmRouter.get('/matching/history', async (req: any, res) => {
  const db = getPool();
  try {
    const { customer_id, lead_id, session_id } = req.query;
    let query = 'SELECT * FROM property_recommendations WHERE 1=1';
    const params: any[] = [];

    if (customer_id) {
      query += ' AND customer_id = ?';
      params.push(customer_id);
    }
    if (lead_id) {
      query += ' AND lead_id = ?';
      params.push(lead_id);
    }
    if (session_id) {
      query += ' AND session_id = ?';
      params.push(session_id);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';
    const [rows] = await db.query(query, params) as any;
    res.json({ success: true, data: rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/crm/matching/unmatched
 * Sales review queue for unmatched requests
 */
crmRouter.get('/matching/unmatched', requireRoles(ALL_ROLES), async (_req, res) => {
  const db = getPool();
  try {
    const [rows] = await db.query(`
      SELECT r.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
             l.full_name as lead_name, l.phone as lead_phone
      FROM property_recommendations r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN leads l ON r.lead_id = l.id
      WHERE r.is_unmatched = true OR r.status = 'unmatched'
      ORDER BY r.created_at DESC
      LIMIT 100
    `) as any;
    res.json({ success: true, data: rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

