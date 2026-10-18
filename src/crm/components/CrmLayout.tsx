/**
 * CrmLayout.tsx — Main Shell for Lyka CRM Platform
 * Hosts Sidebar, CrmHeader, ModuleDispatcher, LeadDetailDrawer, CustomerDetailModal, and Add Modals
 */
import React from 'react';
import { Sidebar } from './Sidebar';
import { CrmHeader } from './CrmHeader';
import { ModuleDispatcher } from '../modules/ModuleDispatcher';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { CustomerDetailModal } from './CustomerDetailModal';
import { AddLeadModal } from './AddLeadModal';
import { AddCustomerModal } from './AddCustomerModal';
import { GlobalAIAssistant } from './GlobalAIAssistant';
import { useCrm } from '../context/CrmContext';

export const CrmLayout: React.FC = () => {
  const {
    theme,
    selectedLeadId,
    setSelectedLeadId,
    selectedCustomerId,
    setSelectedCustomerId,
    refreshDashboard,
  } = useCrm();

  const isDark = theme === 'dark';

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex font-sans ${
        isDark ? 'dark bg-[#0B0A0C] text-[#e6e1e5]' : 'bg-[#FAF7F2] text-[#1c1b1e]'
      }`}
    >
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden ${isDark ? 'bg-[#0B0A0C]' : 'bg-[#FAF7F2]'}`}>
        <CrmHeader />

        <main className="flex-1 overflow-y-auto min-h-0 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          <div className="w-full max-w-[1600px] mx-auto space-y-6">
            <ModuleDispatcher />
          </div>
        </main>

        <footer
          className={`h-10 shrink-0 border-t px-6 flex items-center justify-between text-[11px] ${
            isDark
              ? 'border-[#28232D] text-[#968a7e] bg-[#0B0A0C]'
              : 'border-[#E2D8D1] text-[#817568] bg-[#FAF7F2]'
          }`}
        >
          <span>Lyka Realty Aura Privé CRM</span>
          <span className="font-mono text-[#d8a868]">MySQL Database Connected • Port 3000</span>
        </footer>
      </div>

      {/* Global Slide-in Drawers & Modals */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={refreshDashboard}
      />

      <CustomerDetailModal
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />

      <AddLeadModal />
      <AddCustomerModal />

      {/* Global Floating AI CRM Assistant */}
      <GlobalAIAssistant />
    </div>
  );
};

export default CrmLayout;
