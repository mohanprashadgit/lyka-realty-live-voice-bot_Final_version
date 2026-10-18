/**
 * CrmContext.tsx — Shared state provider for Lyka Real Estate CRM
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CrmRole, CrmModuleId, DashboardKpis, DEV_ROLES, DevRoleInfo } from '../types/crm';

import { hasModuleAccess } from '../permissions';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: CrmRole;
  team_name?: string;
  must_change_password?: boolean;
}

interface CrmContextType {
  activeModule: CrmModuleId;
  setActiveModule: (m: CrmModuleId) => void;
  activeRole: CrmRole;
  setActiveRole: (r: CrmRole) => void;
  activeRoleInfo: DevRoleInfo;
  authenticatedUser: AuthenticatedUser | null;
  authToken: string | null;
  logout: () => void;
  kpis: DashboardKpis | null;
  isLoadingKpis: boolean;
  refreshDashboard: () => Promise<void>;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (o: boolean) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onOpenChatbot: () => void;
  notificationCount: number;
  // Modal & Drawer State
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  isAddLeadOpen: boolean;
  setIsAddLeadOpen: (o: boolean) => void;
  isAddCustomerOpen: boolean;
  setIsAddCustomerOpen: (o: boolean) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  employees: any[];
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

function getModuleFromHash(): CrmModuleId {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.toLowerCase();
  if (!hash.startsWith('#crm')) return 'overview';

  // Support #crm/module-name
  const parts = hash.split('?')[0].split('/');
  if (parts.length > 1 && parts[1]) {
    const candidate = parts[1] as CrmModuleId;
    const validModuleIds = [
      'overview', 'leads', 'customers', 'properties', 'land', 'ai-listing',
      'matching', 'pipeline', 'site-visits', 'tasks', 'deals', 'employees',
      'teams', 'performance', 'rewards', 'commissions', 'campaigns',
      'communications', 'reports', 'notifications', 'users', 'settings', 'audit-logs'
    ];
    if (validModuleIds.includes(candidate)) {
      return candidate;
    }
  }

  // Support #crm?module=module-name
  const match = hash.match(/[?&]module=([a-z0-9-]+)/i);
  if (match && match[1]) {
    return match[1].toLowerCase() as CrmModuleId;
  }

  return 'overview';
}

export function CrmProvider({
  children,
  onOpenChatbot,
  onLogout,
  initialTheme = 'dark',
}: {
  children: React.ReactNode;
  onOpenChatbot: () => void;
  onLogout?: () => void;
  initialTheme?: 'dark' | 'light';
}) {
  const [activeModule, setActiveModuleState] = useState<CrmModuleId>(getModuleFromHash);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('lyka_auth_token') : null;
  });
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lyka_employee');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const safeRole = DEV_ROLES.some(r => r.role === parsed.role) ? parsed.role : 'Super Admin';
          return {
            id: parsed.id || '',
            name: parsed.name || parsed.fullName || parsed.full_name || 'Staff User',
            email: parsed.email || '',
            role: safeRole as CrmRole,
            team_name: parsed.team_name || parsed.department,
            must_change_password: Boolean(parsed.must_change_password),
          };
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const [activeRole, setActiveRoleState] = useState<CrmRole>(() => {
    if (authenticatedUser?.role && DEV_ROLES.some(r => r.role === authenticatedUser.role)) {
      return authenticatedUser.role as CrmRole;
    }
    return 'Super Admin';
  });

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);
  const [notificationCount, setNotificationCount] = useState(3);

  // Drawers and Modals
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  const activeRoleInfo = DEV_ROLES.find(r => r.role === activeRole) || DEV_ROLES[0];

  // Role switching with strict module access revalidation
  const setActiveRole = useCallback((newRole: CrmRole) => {
    setActiveRoleState(newRole);
    // Revalidate current module access for the new role
    setActiveModuleState(prevModule => {
      if (!hasModuleAccess(newRole, prevModule)) {
        if (typeof window !== 'undefined') window.location.hash = '#crm';
        return 'overview';
      }
      return prevModule;
    });
    // Immediately clear previous role's KPI caches
    setKpis(null);
  }, []);

  // Helper fetch with auth
  const authFetch = useCallback((url: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers || {});
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    headers.set('x-user-role', activeRole);
    return fetch(url, { ...init, headers });
  }, [authToken, activeRole]);

  const logout = useCallback(() => {
    if (authToken) {
      fetch('/api/crm/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      }).catch(() => {});
    }
    // Remove authentication records
    localStorage.removeItem('lyka_auth_token');
    localStorage.removeItem('lyka_employee');

    // Wipe any per-user private assistant conversations in sessionStorage
    if (typeof window !== 'undefined') {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith('lyka_ai_chat_') || key.startsWith('lyka_crm_'))) {
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {}
    }

    // Reset protected CRM state immediately
    setAuthToken(null);
    setAuthenticatedUser(null);
    setActiveRoleState('Super Admin');
    setKpis(null);
    setEmployees([]);
    setSelectedLeadId(null);
    setSelectedCustomerId(null);
    setGlobalSearch('');
    setActiveModuleState('overview');
    if (typeof window !== 'undefined') window.location.hash = '';
    onLogout?.();
  }, [authToken, onLogout]);

  // Verify and refresh session on mount
  useEffect(() => {
    if (authToken) {
      fetch('/api/crm/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            const u = data.user;
            const safeRole = DEV_ROLES.some(r => r.role === u.role) ? u.role : 'Super Admin';
            const normalized: AuthenticatedUser = {
              id: u.id,
              name: u.name || u.fullName || u.full_name || 'Staff User',
              email: u.email || '',
              role: safeRole as CrmRole,
              team_name: u.team_name,
              must_change_password: Boolean(u.must_change_password),
            };
            setAuthenticatedUser(normalized);
            setActiveRoleState(normalized.role);
            localStorage.setItem('lyka_employee', JSON.stringify(normalized));

            // Check if current activeModule is allowed for the authenticated role
            setActiveModuleState(prevModule => {
              if (!hasModuleAccess(safeRole as CrmRole, prevModule)) {
                if (typeof window !== 'undefined') window.location.hash = '#crm';
                return 'overview';
              }
              return prevModule;
            });
          } else {
            // Token expired or invalid
            logout();
          }
        })
        .catch(() => {});
    }
  }, [authToken, logout]);

  const setActiveModule = useCallback((m: CrmModuleId) => {
    setActiveModuleState(m);
    if (typeof window !== 'undefined') {
      const targetHash = m === 'overview' ? '#crm' : `#crm/${m}`;
      if (window.location.hash.toLowerCase() !== targetHash.toLowerCase()) {
        window.location.hash = targetHash;
      }
    }
  }, []);

  // Listen to external hash changes (e.g. browser back/forward or manual URL edit)
  useEffect(() => {
    const handleHashSync = () => {
      const mod = getModuleFromHash();
      setActiveModuleState(prev => (prev !== mod ? mod : prev));
    };
    window.addEventListener('hashchange', handleHashSync);
    window.addEventListener('popstate', handleHashSync);
    return () => {
      window.removeEventListener('hashchange', handleHashSync);
      window.removeEventListener('popstate', handleHashSync);
    };
  }, []);

  const refreshDashboard = useCallback(async () => {
    setIsLoadingKpis(true);
    try {
      const res = await authFetch('/api/crm/dashboard');
      const data = await res.json();
      if (data.success && data.kpis) {
        setKpis(data.kpis);
      }
    } catch (err) {
      console.error('[CRM Context] Failed to fetch dashboard metrics:', err);
    } finally {
      setIsLoadingKpis(false);
    }
  }, [authFetch]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await authFetch('/api/crm/employees');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEmployees(data.data);
      }
    } catch (err) {
      console.error('[CRM Context] Failed to fetch employees:', err);
    }
  }, [authFetch]);

  useEffect(() => {
    refreshDashboard();
    fetchEmployees();
  }, [refreshDashboard, fetchEmployees]);

  const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <CrmContext.Provider
      value={{
        activeModule,
        setActiveModule,
        activeRole,
        setActiveRole,
        activeRoleInfo,
        authenticatedUser,
        authToken,
        logout,
        kpis,
        isLoadingKpis,
        refreshDashboard,
        isSidebarCollapsed,
        toggleSidebar,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        theme,
        toggleTheme,
        onOpenChatbot,
        notificationCount,
        selectedLeadId,
        setSelectedLeadId,
        selectedCustomerId,
        setSelectedCustomerId,
        isAddLeadOpen,
        setIsAddLeadOpen,
        isAddCustomerOpen,
        setIsAddCustomerOpen,
        globalSearch,
        setGlobalSearch,
        employees,
        authFetch,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return ctx;
}
