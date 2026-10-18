/**
 * ModuleDispatcher.tsx — Renders the active module view with full Aura Privé styling & Access Control
 * Enforces role-based module routing and dispatches to RoleDashboard for overview.
 */
import React from 'react';
import { useCrm } from '../context/CrmContext';
import { hasModuleAccess } from '../permissions';
import { RoleDashboard } from './RoleDashboard';
import { LeadManagementView } from './LeadManagementView';
import { CustomerManagementView } from './CustomerManagementView';
import { SalesPipelineView } from './SalesPipelineView';
import { PropertiesView } from './PropertiesView';
import { LandManagementView } from './LandManagementView';
import { DealsManagementView } from './DealsManagementView';
import { SiteVisitsView } from './SiteVisitsView';
import { TasksManagementView } from './TasksManagementView';
import { EmployeeManagementView } from './EmployeeManagementView';
import { TeamsManagementView } from './TeamsManagementView';
import { PerformanceRewardsView } from './PerformanceRewardsView';
import { CampaignsManagementView } from './CampaignsManagementView';
import { NotificationsView } from './NotificationsView';
import { SettingsView } from './SettingsView';
import { AuditLogsView } from './AuditLogsView';
import { UserManagementView } from './UserManagementView';
import { RoadmapModuleView } from './RoadmapModuleView';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export const ModuleDispatcher: React.FC = () => {
  const { activeModule, activeRole, setActiveModule, theme } = useCrm();
  const isDark = theme === 'dark';

  // Strict Client Route Guard: Check module permission against central matrix
  const isAllowed = hasModuleAccess(activeRole, activeModule);

  if (!isAllowed) {
    return (
      <div className={`p-8 sm:p-12 rounded-2xl border text-center max-w-2xl mx-auto my-12 animate-in fade-in duration-200 ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
          <Lock className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/30 mb-3">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Access Restricted</span>
        </div>
        <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
          Module Restricted for {activeRole}
        </h2>
        <p className={`text-xs sm:text-sm mt-2 max-w-md mx-auto ${isDark ? 'text-[#968a7e]' : 'text-[#817568]'}`}>
          You do not have administrative privileges to view the <span className="font-mono text-[#d8a868] font-bold">"{activeModule}"</span> module. This attempt has been logged for security.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setActiveModule('overview')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-[#0B0A0C] font-bold text-xs transition-all shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Authorised Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  switch (activeModule) {
    case 'overview':
      return <RoleDashboard />;
    case 'leads':
      return <LeadManagementView />;
    case 'customers':
      return <CustomerManagementView />;
    case 'properties':
      return <PropertiesView />;
    case 'land':
      return <LandManagementView />;
    case 'pipeline':
      return <SalesPipelineView />;
    case 'deals':
      return <DealsManagementView />;
    case 'site-visits':
      return <SiteVisitsView />;
    case 'tasks':
      return <TasksManagementView />;
    case 'employees':
      return <EmployeeManagementView />;
    case 'teams':
      return <TeamsManagementView />;
    case 'performance':
    case 'rewards':
      return <PerformanceRewardsView />;
    case 'campaigns':
      return <CampaignsManagementView />;
    case 'notifications':
      return <NotificationsView />;
    case 'settings':
      return <SettingsView />;
    case 'audit-logs':
      return <AuditLogsView />;
    case 'users':
      return <UserManagementView />;
    case 'matching':
    case 'ai-listing':
    case 'reports':
    case 'communications':
    case 'commissions':
    default:
      return <RoadmapModuleView moduleId={activeModule} />;
  }
};

export default ModuleDispatcher;
