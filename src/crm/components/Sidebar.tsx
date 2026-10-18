/**
 * Sidebar.tsx — Clean, Compact Real Estate CRM Navigation
 * Uses official Lyka Realty logo from /logo.png
 * Primary destinations always visible: Dashboard, Leads, Customers, Properties, Land, Property Matching
 * Secondary modules in compact collapsible accordions (Sales, Team, Marketing, Administration)
 */
import React, { useState, useEffect } from 'react';
import { useCrm } from '../context/CrmContext';
import { CRM_MODULES, CrmModuleId } from '../types/crm';
import { hasModuleAccess } from '../permissions';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Trees,
  GitCompare,
  KanbanSquare,
  CheckSquare,
  CalendarClock,
  Banknote,
  Briefcase,
  Network,
  Award,
  Megaphone,
  BarChart3,
  Bell,
  Settings,
  FileText,
  ShieldCheck,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  LogOut,
} from 'lucide-react';

interface NavItem {
  id: CrmModuleId;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

// 1. Primary Navigation — Always visible, instant 1-click access
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'customers', label: 'Customers', icon: UserCheck },
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'land', label: 'Land', icon: Trees },
  { id: 'matching', label: 'Property Matching', icon: GitCompare },
];

// 2. Secondary Navigation — Grouped into compact collapsible accordions
const SECONDARY_GROUPS: NavGroup[] = [
  {
    key: 'sales',
    label: 'SALES',
    items: [
      { id: 'pipeline', label: 'Sales Pipeline', icon: KanbanSquare },
      { id: 'deals', label: 'Deals & History', icon: Banknote },
      { id: 'site-visits', label: 'Site Visits', icon: CalendarClock },
      { id: 'tasks', label: 'Follow-ups & Tasks', icon: CheckSquare },
    ],
  },
  {
    key: 'team',
    label: 'TEAM',
    items: [
      { id: 'employees', label: 'Employees', icon: Briefcase },
      { id: 'teams', label: 'Teams & Hierarchy', icon: Network },
      { id: 'performance', label: 'Performance & Rewards', icon: Award },
    ],
  },
  {
    key: 'marketing',
    label: 'MARKETING & REPORTS',
    items: [
      { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
      { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    ],
  },
  {
    key: 'admin',
    label: 'ADMINISTRATION',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'users', label: 'User Administration', icon: ShieldCheck },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    activeRole,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    onOpenChatbot,
    kpis,
    notificationCount,
    theme,
    authenticatedUser,
    logout,
  } = useCrm();

  const isDark = theme === 'dark';

  // Accordion state: secondary groups default to closed unless containing active module
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    sales: false,
    team: false,
    marketing: false,
    admin: false,
  });

  // Automatically expand group containing active module
  useEffect(() => {
    const activeGroup = SECONDARY_GROUPS.find(g => g.items.some(item => item.id === activeModule));
    if (activeGroup && !openGroups[activeGroup.key]) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.key]: true }));
    }
  }, [activeModule]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectModule = (id: CrmModuleId) => {
    setActiveModule(id);
    setIsMobileSidebarOpen(false);
  };

  const renderNavButton = (item: NavItem, isCollapsed: boolean) => {
    const Icon = item.icon;
    const isActive = activeModule === item.id;

    // Badges
    let badgeText: string | number | null = null;
    if (item.id === 'leads' && kpis?.newLeads) {
      badgeText = `${kpis.newLeads} new`;
    } else if (item.id === 'notifications' && notificationCount > 0) {
      badgeText = notificationCount;
    } else if (item.id === 'tasks' && kpis?.pendingTasks) {
      badgeText = kpis.pendingTasks;
    }

    return (
      <button
        key={item.id}
        onClick={() => handleSelectModule(item.id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
          isActive
            ? isDark
              ? 'bg-[#d8a868]/15 text-[#f0be7c] border border-[#d8a868]/30 font-semibold shadow-sm'
              : 'bg-[#d8a868]/20 text-[#5e3c04] border border-[#d8a868]/40 font-semibold'
            : isDark
            ? 'text-[#c9c0b5] hover:bg-[#18161B] hover:text-white border border-transparent'
            : 'text-[#4f4539] hover:bg-white hover:text-[#1c1b1e] border border-transparent'
        } ${isCollapsed ? 'justify-center px-2' : ''}`}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive
              ? 'text-[#d8a868]'
              : isDark
              ? 'text-[#968a7e] group-hover:text-white'
              : 'text-[#817568] group-hover:text-[#1c1b1e]'
          }`}
        />

        {!isCollapsed && (
          <span className="truncate flex-1 text-left text-xs sm:text-sm">{item.label}</span>
        )}

        {!isCollapsed && badgeText !== null && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
              item.id === 'leads'
                ? 'bg-[#d8a868]/20 text-[#d8a868] border border-[#d8a868]/30'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {badgeText}
          </span>
        )}
      </button>
    );
  };

  const isCollapsed = isSidebarCollapsed && !isMobileSidebarOpen;

  const isItemAllowed = (itemId: CrmModuleId) => {
    return hasModuleAccess(activeRole, itemId);
  };

  const visiblePrimaryItems = PRIMARY_NAV_ITEMS.filter(item => isItemAllowed(item.id));

  const visibleSecondaryGroups = SECONDARY_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => isItemAllowed(item.id)),
  })).filter(group => group.items.length > 0);

  const sidebarContent = (
    <div
      className={`flex flex-col h-full min-h-0 select-none transition-colors ${
        isDark ? 'bg-[#0B0A0C] text-[#e6e1e5]' : 'bg-[#FAF7F2] text-[#1c1b1e]'
      }`}
    >
      {/* ── Brand Header with Official Logo ───────────────────────────── */}
      <div
        className={`flex h-16 items-center justify-between px-4 border-b shrink-0 ${
          isDark ? 'border-[#28232D]' : 'border-[#E2D8D1]'
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/logo.png"
            alt="Lyka Realty"
            className={`${
              isCollapsed
                ? 'h-7 w-7 object-contain mx-auto'
                : 'h-8 w-auto max-w-[130px] object-contain'
            }`}
          />
          {!isCollapsed && (
            <span className="text-[10px] tracking-wider text-[#d8a868] font-bold uppercase px-1.5 py-0.5 rounded bg-[#d8a868]/10 border border-[#d8a868]/20">
              CRM
            </span>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className={`hidden md:flex p-1.5 rounded-lg border transition-colors cursor-pointer ${
            isDark
              ? 'border-[#28232D] bg-[#141217] text-[#968a7e] hover:text-white hover:border-[#d8a868]/40'
              : 'border-[#E2D8D1] bg-white text-[#817568] hover:text-[#1c1b1e] hover:border-[#d8a868]/60'
          }`}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-[#968a7e] hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── AI Assistant Quick Switcher ──────────────────────────────── */}
      <div
        className={`p-2.5 border-b shrink-0 ${
          isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-[#f5efe8]'
        }`}
      >
        <button
          onClick={() => {
            setIsMobileSidebarOpen(false);
            onOpenChatbot();
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#d8a868]/40 bg-[#d8a868]/15 hover:bg-[#d8a868]/25 text-[#f0be7c] font-medium transition-all group cursor-pointer ${
            isCollapsed ? 'justify-center px-2' : ''
          }`}
          title="Return to Client AI Assistant & Voice Bot"
        >
          <Bot className="w-4 h-4 text-[#d8a868] shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 text-left min-w-0">
              <div
                className={`text-xs font-semibold flex items-center justify-between ${
                  isDark ? 'text-white' : 'text-[#2a241e]'
                }`}
              >
                <span className="truncate">AI Assistant</span>
                <ExternalLink className="w-3 h-3 text-[#d8a868] opacity-70 group-hover:opacity-100 shrink-0" />
              </div>
              <div className="text-[10px] text-[#968a7e] truncate">Voice & Chat Concierge</div>
            </div>
          )}
        </button>
      </div>

      {/* ── Navigation Items ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3.5 scrollbar-thin">
        {/* 1. Primary Navigation (Role Filtered) */}
        {visiblePrimaryItems.length > 0 && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#968a7e]">
                Core Management
              </div>
            )}
            <div className="space-y-0.5">
              {visiblePrimaryItems.map(item => renderNavButton(item, isCollapsed))}
            </div>
          </div>
        )}

        {/* 2. Secondary Collapsible Accordion Sections (Role Filtered) */}
        {visibleSecondaryGroups.map(group => {
          const isOpen = openGroups[group.key];
          const hasActiveChild = group.items.some(item => item.id === activeModule);

          return (
            <div key={group.key} className="space-y-1">
              {!isCollapsed ? (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    hasActiveChild
                      ? 'text-[#d8a868]'
                      : isDark
                      ? 'text-[#968a7e] hover:text-white'
                      : 'text-[#817568] hover:text-[#1c1b1e]'
                  }`}
                >
                  <span className="truncate">{group.label}</span>
                  {isOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 shrink-0 ml-1 opacity-70" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1 opacity-70" />
                  )}
                </button>
              ) : (
                <div className="h-1.5 border-t border-[#28232D]/40 my-1" />
              )}

              {/* Group items (open or collapsed mode) */}
              {(isOpen || isCollapsed) && (
                <div className="space-y-0.5">
                  {group.items.map(item => renderNavButton(item, isCollapsed))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer Session Info ──────────────────────────────────────── */}
      <div
        className={`p-3 border-t shrink-0 ${
          isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-[#f5efe8]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {(() => {
            const displayName = authenticatedUser?.name || (authenticatedUser as any)?.fullName || 'Staff User';
            const displayRole = authenticatedUser?.role || activeRole || 'Super Admin';
            const avatarInitial = (displayName.charAt(0) || displayRole.charAt(0) || 'S').toUpperCase();
            return (
              <>
                <div className="w-8 h-8 rounded-full bg-[#d8a868]/20 border border-[#d8a868]/40 flex items-center justify-center text-xs font-bold text-[#d8a868] shrink-0">
                  {avatarInitial}
                </div>
                {!isCollapsed && (
                  <div className="truncate flex-1 min-w-0">
                    <div
                      className={`text-xs font-semibold truncate ${
                        isDark ? 'text-white' : 'text-[#1c1b1e]'
                      }`}
                    >
                      {displayName}
                    </div>
                    <div className="text-[10px] text-[#d8a868] truncate font-medium">
                      {authenticatedUser ? `${displayRole} • ${authenticatedUser.id || 'Staff'}` : displayRole}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          {!isCollapsed && authenticatedUser && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-[#968a7e] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r transition-all duration-300 z-30 shrink-0 h-full ${
          isDark ? 'border-[#28232D] bg-[#0B0A0C]' : 'border-[#E2D8D1] bg-[#FAF7F2]'
        } ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl border-r border-[#28232D]">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
