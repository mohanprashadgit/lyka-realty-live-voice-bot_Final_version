/**
 * permissions.ts — Centralized Role-Based Access Control (RBAC) Configuration
 * 
 * Defines the 5 simplified employee roles, module permissions, action capabilities,
 * and record-level access rules for Lyka Realty CRM.
 */

export type CrmRole =
  | 'Super Admin'
  | 'Operations Admin'
  | 'Lead Management Executive'
  | 'Sales Territory Manager'
  | 'Sales & Growth Executive';

export const ALL_ROLES: CrmRole[] = [
  'Super Admin',
  'Operations Admin',
  'Lead Management Executive',
  'Sales Territory Manager',
  'Sales & Growth Executive',
];

export type Resource =
  | 'dashboard'
  | 'leads'
  | 'customers'
  | 'properties'
  | 'land'
  | 'pipeline'
  | 'site_visits'
  | 'deals'
  | 'tasks'
  | 'employees'
  | 'teams'
  | 'rewards'
  | 'campaigns'
  | 'settings'
  | 'audit_logs'
  | 'users';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'verify_purchase' | 'assign';

export type RecordScope = 'all' | 'team' | 'own' | 'none';

export interface RoleConfig {
  role: CrmRole;
  title: string;
  badgeColor: string;
  department: string;
  description: string;
  scope: RecordScope;
  canEdit: boolean;
  allowedModules: string[];
}

export const ROLE_CONFIGS: Record<CrmRole, RoleConfig> = {
  'Super Admin': {
    role: 'Super Admin',
    title: 'Super Admin',
    badgeColor: '#d8a868', // Luxury Gold
    department: 'Executive Administration',
    description: 'All authorised system administration, user accounts, and CRM operations.',
    scope: 'all',
    canEdit: true,
    allowedModules: [
      'overview', 'leads', 'customers', 'properties', 'land', 'ai-listing',
      'matching', 'pipeline', 'site-visits', 'tasks', 'deals', 'employees',
      'teams', 'performance', 'rewards', 'campaigns', 'notifications',
      'users', 'settings', 'audit-logs'
    ],
  },
  'Operations Admin': {
    role: 'Operations Admin',
    title: 'Operations Admin',
    badgeColor: '#3b6185', // Operations Blue
    department: 'Property & Operations',
    description: 'Property/land inventory, employee directory, and operational verification.',
    scope: 'all',
    canEdit: true,
    allowedModules: [
      'overview', 'leads', 'customers', 'properties', 'land', 'ai-listing',
      'matching', 'site-visits', 'tasks', 'employees', 'teams', 'performance',
      'rewards', 'campaigns', 'notifications', 'audit-logs'
    ],
  },
  'Lead Management Executive': {
    role: 'Lead Management Executive',
    title: 'Lead Management Executive',
    badgeColor: '#904474', // Triage Purple
    department: 'Inbound Lead Management',
    description: 'Lead registration, qualification triage, lead routing, and prospect follow-ups.',
    scope: 'all',
    canEdit: true,
    allowedModules: [
      'overview', 'leads', 'customers', 'properties', 'land', 'matching',
      'tasks', 'notifications', 'rewards'
    ],
  },
  'Sales Territory Manager': {
    role: 'Sales Territory Manager',
    title: 'Sales Territory Manager',
    badgeColor: '#2e7d32', // Emerald Green
    department: 'Sales & Portfolio Management',
    description: 'Authorised team oversight, deal approvals, visit management, and performance.',
    scope: 'team',
    canEdit: true,
    allowedModules: [
      'overview', 'leads', 'customers', 'properties', 'land', 'matching',
      'pipeline', 'site-visits', 'tasks', 'deals', 'employees', 'teams',
      'performance', 'rewards', 'notifications'
    ],
  },
  'Sales & Growth Executive': {
    role: 'Sales & Growth Executive',
    title: 'Sales & Growth Executive',
    badgeColor: '#e65100', // Amber Bronze
    department: 'Client Engagement & Growth',
    description: 'Assigned leads, customer engagement, property matching, site visits, and sales activities.',
    scope: 'own',
    canEdit: false,
    allowedModules: [
      'overview', 'leads', 'customers', 'properties', 'land', 'matching',
      'pipeline', 'site-visits', 'tasks', 'deals', 'performance', 'rewards',
      'campaigns', 'notifications'
    ],
  },
};

/**
 * Check if a role is permitted to access a specific module
 */
export function hasModuleAccess(role: CrmRole, moduleId: string): boolean {
  const config = ROLE_CONFIGS[role];
  if (!config) return false;
  return config.allowedModules.includes(moduleId);
}

/**
 * Check action permissions on a resource
 */
export function hasActionPermission(role: CrmRole, resource: Resource, action: Action): boolean {
  if (role === 'Super Admin') return true;

  switch (resource) {
    case 'users':
    case 'settings':
      return false; // Super Admin only

    case 'audit_logs':
      return role === 'Operations Admin' && action === 'read';

    case 'employees':
    case 'teams':
      if (role === 'Operations Admin') return ['read', 'create', 'update'].includes(action);
      if (role === 'Sales Territory Manager') return action === 'read';
      return false;

    case 'properties':
    case 'land':
      if (role === 'Operations Admin') return ['read', 'create', 'update', 'approve'].includes(action);
      if (role === 'Sales Territory Manager' || role === 'Sales & Growth Executive') return action === 'read';
      return false;

    case 'deals':
      if (role === 'Sales Territory Manager') return ['read', 'approve', 'verify_purchase', 'update'].includes(action);
      if (role === 'Sales & Growth Executive') return ['read', 'create', 'update'].includes(action);
      return role === 'Operations Admin' && action === 'read';

    case 'site_visits':
      if (role === 'Operations Admin' || role === 'Sales Territory Manager') return ['read', 'create', 'update', 'approve'].includes(action);
      if (role === 'Sales & Growth Executive') return ['read', 'create', 'update'].includes(action);
      return false;

    case 'leads':
      if (role === 'Lead Management Executive') return ['read', 'create', 'update', 'assign'].includes(action);
      if (role === 'Sales Territory Manager') return ['read', 'assign', 'update'].includes(action);
      if (role === 'Sales & Growth Executive') return ['read', 'create', 'update'].includes(action);
      if (role === 'Operations Admin') return action === 'read';
      return false;

    case 'customers':
      return ['read', 'create', 'update'].includes(action);

    case 'tasks':
      return ['read', 'create', 'update'].includes(action);

    case 'campaigns':
      return ['read', 'create'].includes(action);

    case 'rewards':
      return action === 'read';

    default:
      return false;
  }
}
