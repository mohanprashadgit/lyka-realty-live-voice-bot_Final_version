/**
 * crm.ts — Centralized types, roles, permissions, and module definitions for Lyka CRM
 */

export type CrmRole =
  | 'Super Admin'
  | 'Operations Admin'
  | 'Lead Management Executive'
  | 'Sales Territory Manager'
  | 'Sales & Growth Executive';

export interface DevRoleInfo {
  role: CrmRole;
  title: string;
  badgeColor: string;
  description: string;
  canEdit: boolean;
}

export const DEV_ROLES: DevRoleInfo[] = [
  {
    role: 'Super Admin',
    title: 'Super Admin',
    badgeColor: '#d8a868',
    description: 'Full unconstrained platform control, financial audits, user management & system settings.',
    canEdit: true,
  },
  {
    role: 'Operations Admin',
    title: 'Operations Admin',
    badgeColor: '#3b6185',
    description: 'Property/land inventory, employee directory, audit logs & operational verification.',
    canEdit: true,
  },
  {
    role: 'Lead Management Executive',
    title: 'Lead Management Executive',
    badgeColor: '#904474',
    description: 'AI qualification triage, lead routing, status overrides & prospect follow-ups.',
    canEdit: true,
  },
  {
    role: 'Sales Territory Manager',
    title: 'Sales Territory Manager',
    badgeColor: '#2e7d32',
    description: 'Authorised team oversight, deal approvals, visit management & team performance.',
    canEdit: true,
  },
  {
    role: 'Sales & Growth Executive',
    title: 'Sales & Growth Executive',
    badgeColor: '#e65100',
    description: 'Assigned leads, customer engagement, property matching, site visits & sales activities.',
    canEdit: false,
  },
];

export type CrmModuleId =
  | 'overview'
  | 'leads'
  | 'customers'
  | 'properties'
  | 'land'
  | 'ai-listing'
  | 'matching'
  | 'pipeline'
  | 'site-visits'
  | 'tasks'
  | 'deals'
  | 'employees'
  | 'teams'
  | 'performance'
  | 'rewards'
  | 'commissions'
  | 'campaigns'
  | 'communications'
  | 'reports'
  | 'notifications'
  | 'users'
  | 'settings'
  | 'audit-logs';

export interface CrmModuleMeta {
  id: CrmModuleId;
  name: string;
  category: 'core' | 'inventory' | 'sales' | 'team' | 'growth' | 'admin';
  icon: string;
  description: string;
  allowedRoles: CrmRole[];
}

export const CRM_MODULES: CrmModuleMeta[] = [
  // ── Core CRM
  {
    id: 'overview',
    name: 'Overview Dashboard',
    category: 'core',
    icon: 'LayoutDashboard',
    description: 'Executive KPIs, lead velocity, active deals, closed revenue and team performance.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'leads',
    name: 'Lead Management',
    category: 'core',
    icon: 'Users',
    description: 'Chatbot & voice qualification stream, HOT/WARM triage, scoring & assignment.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'customers',
    name: 'Customer Management',
    category: 'core',
    icon: 'UserCheck',
    description: 'Client profiles, lifetime requirements, linked conversations & verified contacts.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },

  // ── Inventory & AI
  {
    id: 'properties',
    name: 'Property Management',
    category: 'inventory',
    icon: 'Building2',
    description: 'Luxury villas, penthouses, apartments, gallery uploads & verification status.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'land',
    name: 'Land Management',
    category: 'inventory',
    icon: 'Trees',
    description: 'Plots, agricultural, commercial & coastal land with cents, acres & grounds units.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'ai-listing',
    name: 'AI Listing Assistant',
    category: 'inventory',
    icon: 'Sparkles',
    description: 'Raw text to structured property listing extraction with human validation workflow.',
    allowedRoles: ['Super Admin', 'Operations Admin'],
  },
  {
    id: 'matching',
    name: 'Property Matching',
    category: 'inventory',
    icon: 'GitCompare',
    description: 'Database-backed requirement-to-inventory matching with transparent scoring.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },

  // ── Sales Operations
  {
    id: 'pipeline',
    name: 'Sales Pipeline',
    category: 'sales',
    icon: 'KanbanSquare',
    description: 'Visual stage progression: New → Contacted → Qualified → Site Visit → Won/Lost.',
    allowedRoles: ['Super Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'site-visits',
    name: 'Site Visits & Appointments',
    category: 'sales',
    icon: 'CalendarClock',
    description: 'Customer property inspection scheduling, agent assignment & visit feedback.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'tasks',
    name: 'Tasks & Follow-ups',
    category: 'sales',
    icon: 'CheckSquare',
    description: 'Assigned employee follow-ups, overdue alerts, priorities & completion records.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'deals',
    name: 'Deals & Sales History',
    category: 'sales',
    icon: 'Banknote',
    description: 'Negotiation tracking, agreed deal values, actual closed revenue & payment status.',
    allowedRoles: ['Super Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },

  // ── Team & Performance
  {
    id: 'employees',
    name: 'Employee Management',
    category: 'team',
    icon: 'Briefcase',
    description: 'Staff directory, territory allocation, reporting hierarchies & employment status.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager'],
  },
  {
    id: 'teams',
    name: 'Teams & Departments',
    category: 'team',
    icon: 'Network',
    description: 'Departmental groupings, manager hierarchies & team workload distributions.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager'],
  },
  {
    id: 'performance',
    name: 'Employee Performance',
    category: 'team',
    icon: 'Award',
    description: 'Conversion rates, target vs actual revenue, site visit metrics & leaderboards.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'rewards',
    name: 'Rewards & Points',
    category: 'team',
    icon: 'Trophy',
    description: 'Immutable points transaction ledger, qualification bonuses & leaderboard.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'commissions',
    name: 'Commission & Incentives',
    category: 'team',
    icon: 'Percent',
    description: 'Deterministic commission calculations, tier rates & verified sales payouts.',
    allowedRoles: ['Super Admin', 'Sales Territory Manager'],
  },

  // ── Growth & Insights
  {
    id: 'campaigns',
    name: 'Marketing Campaigns',
    category: 'growth',
    icon: 'Megaphone',
    description: 'Source channels (Meta, Google, Portals), spend, leads generated & ROI.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales & Growth Executive'],
  },
  {
    id: 'communications',
    name: 'Communication History',
    category: 'growth',
    icon: 'MessageSquareText',
    description: 'Unified omnichannel audit: AI chatbot turns, voice transcripts & agent logs.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    category: 'growth',
    icon: 'BarChart3',
    description: 'Revenue trends, property demand breakdowns, lost reason analysis & CSV exports.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Sales Territory Manager'],
  },

  // ── Governance & Settings
  {
    id: 'notifications',
    name: 'Notifications',
    category: 'admin',
    icon: 'Bell',
    description: 'HOT lead alerts, upcoming site visits, assignment notices & task reminders.',
    allowedRoles: ['Super Admin', 'Operations Admin', 'Lead Management Executive', 'Sales Territory Manager', 'Sales & Growth Executive'],
  },
  {
    id: 'users',
    name: 'User Management',
    category: 'admin',
    icon: 'ShieldCheck',
    description: 'Role-based access matrix, security permissions & credential management.',
    allowedRoles: ['Super Admin'],
  },
  {
    id: 'settings',
    name: 'System Settings',
    category: 'admin',
    icon: 'Settings',
    description: 'Currencies, measurement units, lead scoring rules, organization configuration.',
    allowedRoles: ['Super Admin'],
  },
  {
    id: 'audit-logs',
    name: 'Audit Logs',
    category: 'admin',
    icon: 'FileText',
    description: 'Security log of database record creation, modifications, assignments & exports.',
    allowedRoles: ['Super Admin', 'Operations Admin'],
  },
];

export interface DashboardKpis {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalCustomers: number;
  availableProperties: number;
  availableLand: number;
  upcomingVisits: number;
  pendingTasks: number;
  activeDeals: number;
  closedDeals: number;
  actualRevenue: number;
  projectedPipeline: number;
}
