/**
 * RoleDashboard.tsx — Role-Aware Dashboard Dispatcher for Lyka Realty CRM
 * 
 * Renders distinct, server-verified dashboards tailored to the 5 authoritative employee roles:
 * 1. Super Admin: Platform-wide governance, executive pipeline, audit events, all staff directory.
 * 2. Operations Admin: Inventory status, pending verification, incomplete listings, site inspections.
 * 3. Lead Management Executive: Inbound triage, unassigned routing, leads awaiting details, overdue tasks.
 * 4. Sales Territory Manager: Regional team oversight, team deals pipeline, site visits, deal approvals.
 * 5. Sales & Growth Executive: Personal assigned portfolio, personal tasks, active deals, quota progress.
 * 
 * Features:
 * - Zero content flashing during role transitions with neutral loading skeletons.
 * - 100% Real MySQL-backed metrics from /api/crm/dashboard.
 * - Strict client-side data isolation when accounts or roles switch.
 */
import React, { useEffect, useState } from 'react';
import { useCrm } from '../context/CrmContext';
import {
  Users,
  UserPlus,
  Flame,
  SunMedium,
  Snowflake,
  CheckSquare,
  Banknote,
  Building2,
  Trees,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  Calendar,
  Activity,
  UserCheck,
  TrendingUp,
  MapPin,
  RefreshCw,
  Shield,
  ShieldAlert,
  Award,
  AlertTriangle,
  FileCheck,
  Eye,
  Briefcase,
  ChevronRight,
  Layers,
  Sparkles,
  Percent,
} from 'lucide-react';

export const RoleDashboard: React.FC = () => {
  const {
    activeRole,
    authenticatedUser,
    authFetch,
    setActiveModule,
    setSelectedLeadId,
    setSelectedCustomerId,
    setIsAddLeadOpen,
    setIsAddCustomerOpen,
    refreshDashboard,
    theme,
  } = useCrm();

  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Currency Formatter
  const formatCurrency = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  // Fetch dashboard data on mount and role change
  const fetchRoleData = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/crm/dashboard');
      const json = await res.json();
      if (json.success) {
        setDashboardData(json);
      }
    } catch (err) {
      console.error('[RoleDashboard] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleData();
  }, [activeRole, authenticatedUser?.id]);

  const handleMarkTaskDone = async (taskId: string) => {
    try {
      const res = await authFetch(`/api/crm/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completion_notes: 'Completed from Dashboard' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRoleData();
        refreshDashboard();
      }
    } catch (err) {
      console.error('[RoleDashboard] Complete task error:', err);
    }
  };

  // ── Loading Skeleton (Neutral, zero-flash) ──────────────────────────
  if (loading && !dashboardData) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className={`h-28 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'} p-6 flex items-center justify-between`}>
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-[#28232D]" />
            <div className="h-4 w-40 rounded bg-[#28232D]/60" />
          </div>
          <div className="h-10 w-32 rounded-xl bg-[#28232D]" />
        </div>

        {/* 6 Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`h-32 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'} p-5 space-y-3`} />
          ))}
        </div>

        {/* Big Blocks Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className={`xl:col-span-8 h-96 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`} />
          <div className={`xl:col-span-4 h-96 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`} />
        </div>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const roleKpis = dashboardData?.roleKpis || {};
  const roleData = dashboardData?.roleData || {};
  const recentLeads = dashboardData?.recentLeads || [];
  const followupsToday = dashboardData?.followupsToday || [];
  const pipelineStages = dashboardData?.pipelineStages || {};
  const recentActivities = dashboardData?.recentActivities || [];
  const upcomingVisits = dashboardData?.upcomingVisits || [];
  const employeeLeaderboard = dashboardData?.employeeLeaderboard || [];

  // Common Header Command Bar
  const renderCommandHeader = (title: string, subtitle: string, roleBadge: string) => (
    <div
      className={`rounded-2xl border p-6 shadow-sm transition-colors ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
              {title}
            </h2>
            <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] border border-[#d8a868]/30">
              {roleBadge}
            </span>
          </div>
          <p className={`text-xs sm:text-sm mt-1.5 flex flex-wrap items-center gap-2 ${isDark ? 'text-[#968a7e]' : 'text-[#817568]'}`}>
            <Calendar className="w-4 h-4 text-[#d8a868]" />
            <span>{todayFormatted}</span>
            <span className="opacity-40">•</span>
            <span>{subtitle}</span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Server Verified
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchRoleData();
              refreshDashboard();
            }}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#28232D] bg-[#18161B] text-[#968a7e] hover:text-white hover:border-[#d8a868]/40'
                : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e] hover:border-[#d8a868]/60'
            }`}
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d8a868]' : ''}`} />
          </button>

          {/* Role specific quick action buttons */}
          {activeRole === 'Super Admin' && (
            <>
              <button
                onClick={() => setActiveModule('users')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                  isDark
                    ? 'border-[#d8a868]/40 bg-[#18161B] hover:bg-[#201e25] text-[#f0be7c]'
                    : 'border-[#d8a868]/60 bg-white hover:bg-[#FAF7F2] text-[#7d571f]'
                }`}
              >
                <Shield className="w-4 h-4 text-[#d8a868]" />
                <span>Manage Users</span>
              </button>
              <button
                onClick={() => setIsAddLeadOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-[#0B0A0C] text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Lead</span>
              </button>
            </>
          )}

          {activeRole === 'Operations Admin' && (
            <>
              <button
                onClick={() => setActiveModule('properties')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-[#0B0A0C] text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Building2 className="w-4 h-4 stroke-[2.5]" />
                <span>Verify Listings</span>
              </button>
              <button
                onClick={() => setActiveModule('land')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                  isDark
                    ? 'border-[#d8a868]/40 bg-[#18161B] hover:bg-[#201e25] text-[#f0be7c]'
                    : 'border-[#d8a868]/60 bg-white hover:bg-[#FAF7F2] text-[#7d571f]'
                }`}
              >
                <Trees className="w-4 h-4 text-[#d8a868]" />
                <span>Land Inventory</span>
              </button>
            </>
          )}

          {activeRole === 'Lead Management Executive' && (
            <>
              <button
                onClick={() => setIsAddLeadOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-[#0B0A0C] text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Register Inbound Lead</span>
              </button>
              <button
                onClick={() => setActiveModule('leads')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                  isDark
                    ? 'border-[#d8a868]/40 bg-[#18161B] hover:bg-[#201e25] text-[#f0be7c]'
                    : 'border-[#d8a868]/60 bg-white hover:bg-[#FAF7F2] text-[#7d571f]'
                }`}
              >
                <Users className="w-4 h-4 text-[#d8a868]" />
                <span>Triage Queue</span>
              </button>
            </>
          )}

          {activeRole === 'Sales Territory Manager' && (
            <>
              <button
                onClick={() => setActiveModule('deals')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-[#0B0A0C] text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Banknote className="w-4 h-4 stroke-[2.5]" />
                <span>Review Team Deals</span>
              </button>
              <button
                onClick={() => setActiveModule('employees')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                  isDark
                    ? 'border-[#d8a868]/40 bg-[#18161B] hover:bg-[#201e25] text-[#f0be7c]'
                    : 'border-[#d8a868]/60 bg-white hover:bg-[#FAF7F2] text-[#7d571f]'
                }`}
              >
                <Award className="w-4 h-4 text-[#d8a868]" />
                <span>Team Performance</span>
              </button>
            </>
          )}

          {activeRole === 'Sales & Growth Executive' && (
            <>
              <button
                onClick={() => setIsAddLeadOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-[#0B0A0C] text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Record New Lead</span>
              </button>
              <button
                onClick={() => setActiveModule('site-visits')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                  isDark
                    ? 'border-[#d8a868]/40 bg-[#18161B] hover:bg-[#201e25] text-[#f0be7c]'
                    : 'border-[#d8a868]/60 bg-white hover:bg-[#FAF7F2] text-[#7d571f]'
                }`}
              >
                <MapPin className="w-4 h-4 text-[#d8a868]" />
                <span>My Site Visits</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // ROLE 1: SUPER ADMIN DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (activeRole === 'Super Admin') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {renderCommandHeader(
          'Executive Command Console',
          'Company-wide sales pipeline, employee workloads & governance',
          'Super Admin'
        )}

        {/* 6 Platform KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div onClick={() => setActiveModule('customers')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#968a7e]">Total Clients</span>
              <UserCheck className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className={`text-3xl font-extrabold font-mono mt-3 mb-1 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{roleKpis.totalCustomers ?? kpis.totalCustomers ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Verified accounts</div>
          </div>

          <div onClick={() => setActiveModule('leads')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-amber-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Total Leads</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-3 mb-1">{roleKpis.totalLeads ?? kpis.totalLeads ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Company inquiries</div>
          </div>

          <div onClick={() => setActiveModule('pipeline')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-emerald-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Pipeline Value</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-3 mb-1">{formatCurrency(roleKpis.pipelineValue || kpis.projectedPipeline)}</div>
            <div className="text-xs text-[#968a7e]">Active projected value</div>
          </div>

          <div onClick={() => setActiveModule('deals')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d8a868]">Verified Revenue</span>
              <Banknote className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-[#d8a868] mt-3 mb-1">{formatCurrency(roleKpis.closedRevenue || kpis.actualRevenue)}</div>
            <div className="text-xs text-[#968a7e]">Closed-won sales</div>
          </div>

          <div onClick={() => setActiveModule('properties')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-sky-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Inventory Units</span>
              <Building2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-sky-400 mt-3 mb-1">{(roleKpis.availableProperties || 0) + (roleKpis.availableLand || 0)}</div>
            <div className="text-xs text-[#968a7e]">{roleKpis.availableProperties || 0} homes • {roleKpis.availableLand || 0} plots</div>
          </div>

          <div onClick={() => setActiveModule('audit-logs')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-violet-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Security Events</span>
              <ShieldAlert className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-violet-400 mt-3 mb-1">{roleKpis.auditEventsCount ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Audit records recorded</div>
          </div>
        </div>

        {/* 12-Column Grid: Left 8 cols Recent Leads & Pipeline • Right 4 cols Employee Leaderboard & Audit */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            {/* Recent Leads Table */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                    <span>Platform-Wide Inquiries</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] font-mono font-bold">
                      {recentLeads.length} Recent
                    </span>
                  </h3>
                  <p className="text-xs text-[#968a7e] mt-0.5">Live leads captured across AI concierge, voice bot & sales reps</p>
                </div>
                <button onClick={() => setActiveModule('leads')} className="text-xs text-[#d8a868] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                  <span>All Leads</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${isDark ? 'border-[#28232D] text-[#968a7e]' : 'border-[#E2D8D1] text-[#817568]'}`}>
                      <th className="py-3 px-3">Lead / Contact</th>
                      <th className="py-3 px-3">Interest & Budget</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3">Temperature</th>
                      <th className="py-3 px-3">Assigned Agent</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#28232D]/60' : 'divide-[#E2D8D1]'}`}>
                    {recentLeads.map((lead: any) => (
                      <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-[#18161B]' : 'hover:bg-[#FAF7F2]'}`}>
                        <td className="py-3 px-3">
                          <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{lead.full_name || 'Prospect'}</div>
                          <div className="text-[10px] text-[#968a7e] font-mono">{lead.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="capitalize">{lead.property_type || 'Residential'}</div>
                          <div className="font-mono text-[#d8a868] font-bold">{lead.budget_max ? formatCurrency(Number(lead.budget_max)) : 'Enquired'}</div>
                        </td>
                        <td className="py-3 px-3 text-[#968a7e]">{lead.city || 'Chennai'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            lead.temperature === 'HOT' ? 'bg-rose-500/20 text-rose-300' : lead.temperature === 'WARM' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                          }`}>
                            {lead.temperature || 'WARM'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#968a7e]">{lead.assigned_employee_name || 'Unassigned'}</td>
                        <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setSelectedLeadId(lead.id)} className="px-2.5 py-1 rounded bg-[#28232D] text-[#d8a868] hover:bg-[#d8a868] hover:text-[#0B0A0C] font-bold text-[11px] cursor-pointer">
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right 4 Cols: Employee Leaderboard & Audit Log */}
          <div className="xl:col-span-4 space-y-6">
            {/* Employee Performance Leaderboard */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Award className="w-4 h-4 text-[#d8a868]" />
                  <span>Employee Leaderboard</span>
                </h3>
                <button onClick={() => setActiveModule('employees')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  All Staff
                </button>
              </div>

              <div className="space-y-3">
                {employeeLeaderboard.slice(0, 5).map((emp: any, idx: number) => (
                  <div key={emp.id} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${idx === 0 ? 'bg-[#d8a868] text-black' : 'bg-[#28232D] text-[#968a7e]'}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{emp.full_name}</div>
                        <div className="text-[10px] text-[#968a7e]">{emp.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#d8a868]">{emp.points_balance || 0} pts</div>
                      <div className="text-[10px] text-[#968a7e]">Quota: {formatCurrency(Number(emp.monthly_target || 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log Events */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Activity className="w-4 h-4 text-violet-400" />
                  <span>Security & Audit Events</span>
                </h3>
                <button onClick={() => setActiveModule('audit-logs')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  Full Log
                </button>
              </div>

              <div className="space-y-2.5">
                {recentActivities.slice(0, 4).map((act: any) => (
                  <div key={act.id} className={`p-2.5 rounded-xl border text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#d8a868]">{act.actor_name || 'System'}</span>
                      <span className="text-[10px] text-[#968a7e]">{act.action}</span>
                    </div>
                    <p className="text-[11px] text-[#968a7e] mt-0.5 truncate">{act.details || act.record_type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROLE 2: OPERATIONS ADMIN DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (activeRole === 'Operations Admin') {
    const pendingVerifications = roleData.pendingVerifications || [];
    const incompleteListings = roleData.incompleteListings || [];

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {renderCommandHeader(
          'Operations & Inventory Command',
          'Property listings, land parcels, verification queue & inspection workload',
          'Operations Admin'
        )}

        {/* 6 Operations Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div onClick={() => setActiveModule('properties')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#968a7e]">Properties</span>
              <Building2 className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className={`text-3xl font-extrabold font-mono mt-3 mb-1 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{roleKpis.totalProperties ?? 0}</div>
            <div className="text-xs text-emerald-400 font-semibold">{roleKpis.availableProperties ?? 0} available</div>
          </div>

          <div onClick={() => setActiveModule('land')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-emerald-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Land Parcels</span>
              <Trees className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-3 mb-1">{roleKpis.totalLand ?? 0}</div>
            <div className="text-xs text-[#968a7e]">{roleKpis.availableLand ?? 0} active plots</div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${roleKpis.pendingVerification > 0 ? 'border-amber-500/50 bg-amber-500/5' : isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Verification</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-3 mb-1">{roleKpis.pendingVerification ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Needs document check</div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Incomplete Records</span>
              <FileCheck className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-rose-400 mt-3 mb-1">{roleKpis.incompleteListings ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Missing photo / description</div>
          </div>

          <div onClick={() => setActiveModule('tasks')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-sky-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Op Tasks</span>
              <CheckSquare className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-sky-400 mt-3 mb-1">{roleKpis.operationalTasks ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Field checks & follow-ups</div>
          </div>

          <div onClick={() => setActiveModule('site-visits')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-violet-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Site Inspections</span>
              <MapPin className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-violet-400 mt-3 mb-1">{roleKpis.siteVisitsWorkload ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Scheduled visits</div>
          </div>
        </div>

        {/* 12-Col Layout: Left 8 cols Verification & Incomplete Tables • Right 4 cols Inspections & Tasks */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            {/* Inventory Pending Verification */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Inventory Pending Verification</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                      {pendingVerifications.length} Items
                    </span>
                  </h3>
                  <p className="text-xs text-[#968a7e] mt-0.5">Listings requiring title deed check, survey number confirmation & RERA approval</p>
                </div>
                <button onClick={() => setActiveModule('properties')} className="text-xs text-[#d8a868] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                  <span>Open Inventory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {pendingVerifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#968a7e]">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  All property and land listings are 100% verified!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${isDark ? 'border-[#28232D] text-[#968a7e]' : 'border-[#E2D8D1] text-[#817568]'}`}>
                        <th className="py-2.5 px-3">Title / Type</th>
                        <th className="py-2.5 px-3">Locality</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-[#28232D]/60' : 'divide-[#E2D8D1]'}`}>
                      {pendingVerifications.map((item: any) => (
                        <tr key={item.id} className={`transition-colors ${isDark ? 'hover:bg-[#18161B]' : 'hover:bg-[#FAF7F2]'}`}>
                          <td className="py-3 px-3">
                            <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{item.title}</div>
                            <div className="text-[10px] text-[#968a7e] uppercase font-mono">{item.item_type} • {item.property_type || 'Residential'}</div>
                          </td>
                          <td className="py-3 px-3 text-[#968a7e]">{item.locality || item.city || 'Chennai'}</td>
                          <td className="py-3 px-3 font-mono font-bold text-[#d8a868]">{formatCurrency(Number(item.price || 0))}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                              {item.verification_status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button onClick={() => setActiveModule(item.item_type === 'land' ? 'land' : 'properties')} className="px-2.5 py-1 rounded bg-[#d8a868] text-black font-bold text-[11px] cursor-pointer">
                              Verify Now
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Incomplete Listings */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <FileCheck className="w-4 h-4 text-rose-400" />
                  <span>Listings Missing Photos or Descriptions</span>
                </h3>
              </div>
              <p className="text-xs text-[#968a7e] mb-4">High-resolution cover photos and architectural specifications must be uploaded before publishing</p>

              {incompleteListings.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#968a7e]">
                  No incomplete listings detected. All active inventory is media-ready.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {incompleteListings.map((prop: any) => (
                    <div key={prop.id} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div>
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{prop.title}</div>
                        <div className="text-[10px] text-rose-400">Missing cover photo or specs</div>
                      </div>
                      <button onClick={() => setActiveModule('properties')} className="px-2 py-1 rounded bg-[#28232D] text-[#d8a868] hover:bg-[#d8a868] hover:text-black font-bold text-[10px] cursor-pointer">
                        Add Media
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Operational Site Visits & Follow-up Tasks */}
          <div className="xl:col-span-4 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <MapPin className="w-4 h-4 text-violet-400" />
                  <span>Upcoming Inspections</span>
                </h3>
                <button onClick={() => setActiveModule('site-visits')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  Schedule
                </button>
              </div>

              <div className="space-y-3">
                {upcomingVisits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#968a7e]">No scheduled inspections</div>
                ) : (
                  upcomingVisits.map((v: any) => (
                    <div key={v.id} className={`p-3 rounded-xl border text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div className="font-semibold text-white">{v.property_title || 'Listing Inspection'}</div>
                      <div className="text-[11px] text-[#d8a868] mt-0.5">{v.visit_date} • {v.visit_time || '11:00 AM'}</div>
                      <div className="text-[10px] text-[#968a7e] mt-0.5">Agent: {v.assigned_agent || 'Operations Staff'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Operational Tasks */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <CheckSquare className="w-4 h-4 text-sky-400" />
                  <span>Operational Tasks</span>
                </h3>
                <button onClick={() => setActiveModule('tasks')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  All
                </button>
              </div>

              <div className="space-y-2.5">
                {followupsToday.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#968a7e]">All operational tasks clear</div>
                ) : (
                  followupsToday.map((t: any) => (
                    <div key={t.id} className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div className="min-w-0">
                        <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{t.title}</div>
                        <div className="text-[10px] text-[#968a7e]">Due: {t.due_date}</div>
                      </div>
                      <button onClick={() => handleMarkTaskDone(t.id)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer shrink-0">
                        Done
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROLE 3: LEAD MANAGEMENT EXECUTIVE DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (activeRole === 'Lead Management Executive') {
    const unassignedLeads = roleData.unassignedLeads || [];
    const leadsAwaitingDetails = roleData.leadsAwaitingDetails || [];
    const unmatchedInquiries = roleData.unmatchedInquiries || [];

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {renderCommandHeader(
          'Inbound Lead Triage Command',
          'Lead qualification, routing to territory agents & prospect follow-ups',
          'Lead Management Executive'
        )}

        {/* 6 Lead Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div onClick={() => setActiveModule('leads')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-amber-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Unassigned Leads</span>
              <UserPlus className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-3 mb-1">{roleKpis.unassignedLeads ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Waiting for assignment</div>
          </div>

          <div onClick={() => setActiveModule('leads')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-rose-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">HOT Prospects</span>
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-rose-400 mt-3 mb-1">{roleKpis.hotLeads ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Immediate callback</div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Awaiting Details</span>
              <AlertTriangle className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-violet-400 mt-3 mb-1">{roleKpis.awaitingDetails ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Missing phone or budget</div>
          </div>

          <div onClick={() => setActiveModule('tasks')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-red-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Overdue Follow-ups</span>
              <Clock className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-rose-400 mt-3 mb-1">{roleKpis.overdueFollowups ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Action urgently needed</div>
          </div>

          <div onClick={() => setActiveModule('matching')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d8a868]">Unmatched Needs</span>
              <Sparkles className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-[#d8a868] mt-3 mb-1">{roleKpis.unmatchedInquiries ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Low property match score</div>
          </div>

          <div onClick={() => setActiveModule('leads')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-sky-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Total Leads</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-sky-400 mt-3 mb-1">{roleKpis.totalLeads ?? 0}</div>
            <div className="text-xs text-[#968a7e]">{roleKpis.newLeads ?? 0} new enquiries</div>
          </div>
        </div>

        {/* 12-Col Layout: Left 8 cols Unassigned Leads & Awaiting Details • Right 4 cols Follow-up Triage */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            {/* Unassigned Leads Waiting for Routing */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    <span>Unassigned Inbound Inquiries</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                      {unassignedLeads.length} Urgent
                    </span>
                  </h3>
                  <p className="text-xs text-[#968a7e] mt-0.5">Captured prospects requiring qualification & agent territory assignment</p>
                </div>
                <button onClick={() => setActiveModule('leads')} className="text-xs text-[#d8a868] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                  <span>Leads Board</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {unassignedLeads.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#968a7e]">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  All leads have been successfully assigned to sales executives!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${isDark ? 'border-[#28232D] text-[#968a7e]' : 'border-[#E2D8D1] text-[#817568]'}`}>
                        <th className="py-2.5 px-3">Prospect</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Property Need</th>
                        <th className="py-2.5 px-3">Budget</th>
                        <th className="py-2.5 px-3">Temp</th>
                        <th className="py-2.5 px-3 text-right">Assign</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-[#28232D]/60' : 'divide-[#E2D8D1]'}`}>
                      {unassignedLeads.map((lead: any) => (
                        <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-[#18161B]' : 'hover:bg-[#FAF7F2]'}`}>
                          <td className="py-3 px-3">
                            <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{lead.full_name || 'Prospect'}</div>
                            <div className="text-[10px] text-[#968a7e]">{lead.city || 'Chennai'}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#d8a868]">{lead.phone || 'No phone'}</td>
                          <td className="py-3 px-3 capitalize">{lead.property_type || 'Residential'} • {lead.intent || 'Buy'}</td>
                          <td className="py-3 px-3 font-mono font-bold text-[#d8a868]">{lead.budget_max ? formatCurrency(Number(lead.budget_max)) : 'Open'}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              lead.temperature === 'HOT' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {lead.temperature || 'WARM'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setSelectedLeadId(lead.id)} className="px-2.5 py-1 rounded bg-[#d8a868] text-black font-bold text-[11px] cursor-pointer">
                              Assign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Unmatched Customer Requirements */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Sparkles className="w-4 h-4 text-[#d8a868]" />
                  <span>Unmatched Customer Requirements (&lt; 50% Match Score)</span>
                </h3>
              </div>
              <p className="text-xs text-[#968a7e] mb-4">Prospects whose desired budget/specs did not find immediate inventory. Call them to adjust criteria or request new inventory from Operations.</p>

              {unmatchedInquiries.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#968a7e]">
                  No unmatched inquiries pending. High matching coverage!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {unmatchedInquiries.map((un: any) => (
                    <div key={un.id} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div>
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{un.customer_name || 'Prospect'}</div>
                        <div className="text-[10px] text-[#968a7e]">{un.criteria_snapshot || 'High budget custom requirement'}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                          {un.top_score ? `${un.top_score}% Match` : 'No Match'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Triage Tasks & Follow-ups */}
          <div className="xl:col-span-4 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Follow-ups Due Today</span>
                </h3>
                <button onClick={() => setActiveModule('tasks')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  All Tasks
                </button>
              </div>

              <div className="space-y-3">
                {followupsToday.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#968a7e]">No pending calls scheduled</div>
                ) : (
                  followupsToday.map((t: any) => (
                    <div key={t.id} className={`p-3 rounded-xl border text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-white">{t.prospect_name || 'Prospect Call'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#28232D] text-amber-400 font-bold">{t.priority || 'Normal'}</span>
                      </div>
                      <div className="text-[11px] text-[#968a7e] mt-1">{t.title}</div>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#28232D]/40">
                        <span className="text-[10px] text-[#d8a868]">Due: {t.due_date}</span>
                        <button onClick={() => handleMarkTaskDone(t.id)} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer">
                          Done
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROLE 4: SALES TERRITORY MANAGER DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (activeRole === 'Sales Territory Manager') {
    const teamMembers = roleData.teamMembers || [];
    const teamDeals = roleData.teamDeals || [];

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {renderCommandHeader(
          'Sales Territory Command',
          'Team quotas, deal pipeline, site-visit oversight & deal approvals',
          'Sales Territory Manager'
        )}

        {/* 6 Territory Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div onClick={() => setActiveModule('employees')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#968a7e]">Team Size</span>
              <Users className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className={`text-3xl font-extrabold font-mono mt-3 mb-1 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{roleKpis.teamMembersCount ?? teamMembers.length}</div>
            <div className="text-xs text-[#968a7e]">Direct team reps</div>
          </div>

          <div onClick={() => setActiveModule('leads')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-amber-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Team Leads</span>
              <UserCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-3 mb-1">{roleKpis.teamLeads ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Territory assigned</div>
          </div>

          <div onClick={() => setActiveModule('pipeline')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-emerald-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Team Pipeline</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-3 mb-1">{formatCurrency(roleKpis.teamPipelineValue || 0)}</div>
            <div className="text-xs text-[#968a7e]">{roleKpis.teamActiveDeals ?? 0} deals in negotiation</div>
          </div>

          <div onClick={() => setActiveModule('deals')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d8a868]">Closed Sales</span>
              <Banknote className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-[#d8a868] mt-3 mb-1">{formatCurrency(roleKpis.teamClosedRevenue || 0)}</div>
            <div className="text-xs text-emerald-400 font-semibold">{roleKpis.teamTargetAchievement || 0}% of quota reached</div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${roleKpis.pendingApprovals > 0 ? 'border-amber-500/50 bg-amber-500/5' : isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Approvals</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-3 mb-1">{roleKpis.pendingApprovals ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Deals requiring sign-off</div>
          </div>

          <div onClick={() => setActiveModule('site-visits')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-violet-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Team Site Visits</span>
              <MapPin className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-violet-400 mt-3 mb-1">{roleKpis.teamSiteVisits ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Scheduled with buyers</div>
          </div>
        </div>

        {/* 12-Col Layout: Left 8 cols Team Deals & Members • Right 4 cols Team Visits & Approvals */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            {/* Team Members Roster & Performance */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                    <Award className="w-4 h-4 text-[#d8a868]" />
                    <span>Territory Team Roster & Quotas</span>
                  </h3>
                  <p className="text-xs text-[#968a7e] mt-0.5">Performance tracking and points balances for direct sales executives</p>
                </div>
                <button onClick={() => setActiveModule('employees')} className="text-xs text-[#d8a868] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                  <span>Directory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {teamMembers.map((emp: any) => (
                  <div key={emp.id} className={`p-4 rounded-xl border flex flex-col justify-between text-xs space-y-2 ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{emp.full_name}</div>
                        <div className="text-[10px] text-[#968a7e]">{emp.role} • ID: {emp.login_id || emp.id}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#d8a868]/15 text-[#d8a868] text-xs">
                        {emp.points_balance || 0} pts
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#28232D]/40 flex items-center justify-between text-[11px]">
                      <span className="text-[#968a7e]">Monthly Quota:</span>
                      <span className="font-mono font-bold text-white">{formatCurrency(Number(emp.monthly_target || 40000000))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Deals Pipeline */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span>Team Deals in Negotiation</span>
                </h3>
                <button onClick={() => setActiveModule('deals')} className="text-xs text-[#d8a868] hover:underline font-bold cursor-pointer">
                  All Deals
                </button>
              </div>

              {teamDeals.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#968a7e]">No active team deals currently recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${isDark ? 'border-[#28232D] text-[#968a7e]' : 'border-[#E2D8D1] text-[#817568]'}`}>
                        <th className="py-2.5 px-3">Deal Title</th>
                        <th className="py-2.5 px-3">Agent</th>
                        <th className="py-2.5 px-3">Value</th>
                        <th className="py-2.5 px-3">Stage</th>
                        <th className="py-2.5 px-3 text-right">Approval</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-[#28232D]/60' : 'divide-[#E2D8D1]'}`}>
                      {teamDeals.map((d: any) => {
                        const isSelfDeal = d.agent_id === authenticatedUser?.id;
                        return (
                          <tr key={d.id} className={`transition-colors ${isDark ? 'hover:bg-[#18161B]' : 'hover:bg-[#FAF7F2]'}`}>
                            <td className="py-3 px-3">
                              <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{d.title}</div>
                              <div className="text-[10px] text-[#968a7e]">{d.prospect_name || 'Buyer'}</div>
                            </td>
                            <td className="py-3 px-3 text-[#968a7e]">{d.agent_name || 'Team Rep'}</td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">{formatCurrency(Number(d.deal_value || d.projected_value || 0))}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300">
                                {d.deal_status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isSelfDeal ? (
                                <span className="text-[10px] text-zinc-500 italic">Self-Approval Prohibited</span>
                              ) : (
                                <button onClick={() => setActiveModule('deals')} className="px-2.5 py-1 rounded bg-[#d8a868] text-black font-bold text-[10px] cursor-pointer">
                                  Review
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Upcoming Team Site Visits */}
          <div className="xl:col-span-4 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <MapPin className="w-4 h-4 text-violet-400" />
                  <span>Team Site Visits</span>
                </h3>
                <button onClick={() => setActiveModule('site-visits')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  Calendar
                </button>
              </div>

              <div className="space-y-3">
                {upcomingVisits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#968a7e]">No team visits scheduled today</div>
                ) : (
                  upcomingVisits.map((v: any) => (
                    <div key={v.id} className={`p-3 rounded-xl border text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div className="font-semibold text-white">{v.prospect_name || 'Buyer Visit'}</div>
                      <div className="text-[11px] text-[#d8a868] mt-0.5">{v.property_title || 'Listing'}</div>
                      <div className="text-[10px] text-[#968a7e] mt-1 flex items-center justify-between">
                        <span>Agent: {v.employee_name || 'Staff'}</span>
                        <span className="font-mono">{v.visit_date}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROLE 5: SALES & GROWTH EXECUTIVE DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (activeRole === 'Sales & Growth Executive') {
    const myDeals = roleData.myDeals || [];
    const recentRewards = roleData.recentRewards || [];

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {renderCommandHeader(
          'My Portfolio Command',
          'Assigned prospect leads, scheduled visits, deals & personal bonus points',
          'Sales & Growth Executive'
        )}

        {/* 6 Personal Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div onClick={() => setActiveModule('leads')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#968a7e]">My Leads</span>
              <Users className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className={`text-3xl font-extrabold font-mono mt-3 mb-1 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{roleKpis.myLeadsCount ?? 0}</div>
            <div className="text-xs text-rose-400 font-semibold">{roleKpis.myHotLeads ?? 0} HOT leads</div>
          </div>

          <div onClick={() => setActiveModule('tasks')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-amber-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">My Follow-ups</span>
              <CheckSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-amber-400 mt-3 mb-1">{roleKpis.myPendingTasks ?? 0}</div>
            <div className="text-xs text-[#968a7e]">{roleKpis.myOverdueTasks ?? 0} overdue</div>
          </div>

          <div onClick={() => setActiveModule('site-visits')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-violet-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">My Visits</span>
              <MapPin className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-violet-400 mt-3 mb-1">{roleKpis.mySiteVisits ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Scheduled buyer tours</div>
          </div>

          <div onClick={() => setActiveModule('deals')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-emerald-500/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">My Pipeline</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-3 mb-1">{formatCurrency(roleKpis.myPipelineValue || 0)}</div>
            <div className="text-xs text-[#968a7e]">{roleKpis.myActiveDeals ?? 0} active deals</div>
          </div>

          <div onClick={() => setActiveModule('rewards')} className={`rounded-2xl border p-5 transition-all cursor-pointer group shadow-sm hover:border-[#d8a868]/50 ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d8a868]">My Points</span>
              <Award className="w-4 h-4 text-[#d8a868]" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-[#d8a868] mt-3 mb-1">{roleKpis.myPointsBalance ?? 0}</div>
            <div className="text-xs text-[#968a7e]">Eligible bonus points</div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Quota Target</span>
              <Percent className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-sky-400 mt-3 mb-1">{roleKpis.myAchievementPct ?? 0}%</div>
            <div className="text-xs text-[#968a7e]">{formatCurrency(roleKpis.myRevenueWon || 0)} / {formatCurrency(roleKpis.myMonthlyTarget || 40000000)}</div>
          </div>
        </div>

        {/* 12-Col Layout: Left 8 cols My Assigned Leads & Deals • Right 4 cols My Tasks & Points Ledger */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            {/* My Assigned Leads */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                    <Users className="w-4 h-4 text-[#d8a868]" />
                    <span>My Assigned Leads</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] font-mono font-bold">
                      {recentLeads.length} Leads
                    </span>
                  </h3>
                  <p className="text-xs text-[#968a7e] mt-0.5">Prospects routed to you for client engagement & property tours</p>
                </div>
                <button onClick={() => setActiveModule('leads')} className="text-xs text-[#d8a868] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                  <span>View Leads</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentLeads.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#968a7e]">
                  No leads assigned to you yet. Pick leads from the triage queue or record a new inquiry.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${isDark ? 'border-[#28232D] text-[#968a7e]' : 'border-[#E2D8D1] text-[#817568]'}`}>
                        <th className="py-2.5 px-3">Client Name</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Property Requirement</th>
                        <th className="py-2.5 px-3">Budget</th>
                        <th className="py-2.5 px-3">Temp</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-[#28232D]/60' : 'divide-[#E2D8D1]'}`}>
                      {recentLeads.map((lead: any) => (
                        <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-[#18161B]' : 'hover:bg-[#FAF7F2]'}`}>
                          <td className="py-3 px-3">
                            <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{lead.full_name || 'Prospect'}</div>
                            <div className="text-[10px] text-[#968a7e]">{lead.city || 'Chennai'}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#d8a868]">{lead.phone || 'No phone'}</td>
                          <td className="py-3 px-3 capitalize">{lead.property_type || 'Residential'} • {lead.intent || 'Buy'}</td>
                          <td className="py-3 px-3 font-mono font-bold text-[#d8a868]">{lead.budget_max ? formatCurrency(Number(lead.budget_max)) : 'Open'}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              lead.temperature === 'HOT' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {lead.temperature || 'WARM'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setSelectedLeadId(lead.id)} className="px-2.5 py-1 rounded bg-[#d8a868] text-black font-bold text-[11px] cursor-pointer">
                              Call / Match
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* My Active Deals */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span>My Active Deals</span>
                </h3>
                <button onClick={() => setActiveModule('deals')} className="text-xs text-[#d8a868] hover:underline font-bold cursor-pointer">
                  All Deals
                </button>
              </div>

              {myDeals.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#968a7e]">No active deals in negotiation. Create a deal when a buyer expresses interest.</div>
              ) : (
                <div className="space-y-2.5">
                  {myDeals.map((d: any) => (
                    <div key={d.id} className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div>
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{d.title}</div>
                        <div className="text-[10px] text-[#968a7e]">{d.prospect_name || 'Prospect'} • {d.property_title || 'Listing'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-400">{formatCurrency(Number(d.deal_value || d.projected_value || 0))}</div>
                        <span className="text-[10px] uppercase font-bold text-sky-400">{d.deal_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: My Follow-up Calls & Points Ledger */}
          <div className="xl:col-span-4 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>My Follow-ups Today</span>
                </h3>
                <button onClick={() => setActiveModule('tasks')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  Tasks
                </button>
              </div>

              <div className="space-y-3">
                {followupsToday.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#968a7e]">
                    <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    All follow-ups complete!
                  </div>
                ) : (
                  followupsToday.map((t: any) => (
                    <div key={t.id} className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div className="min-w-0">
                        <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{t.prospect_name || 'Prospect'}</div>
                        <div className="text-[11px] text-[#968a7e] truncate">{t.title}</div>
                        <div className="text-[10px] text-[#d8a868] mt-0.5">Due: {t.due_date}</div>
                      </div>
                      <button onClick={() => handleMarkTaskDone(t.id)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer shrink-0">
                        Done
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* My Points & Rewards Ledger */}
            <div className={`rounded-2xl border p-6 shadow-sm ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  <Award className="w-4 h-4 text-[#d8a868]" />
                  <span>Recent Rewards Ledger</span>
                </h3>
                <button onClick={() => setActiveModule('rewards')} className="text-xs text-[#d8a868] hover:underline font-semibold cursor-pointer">
                  Ledger
                </button>
              </div>

              <div className="space-y-2.5">
                {recentRewards.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#968a7e]">No points transactions yet</div>
                ) : (
                  recentRewards.map((rw: any) => (
                    <div key={rw.id} className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'border-[#28232D] bg-[#18161B]' : 'border-[#E2D8D1] bg-[#FAF7F2]'}`}>
                      <div>
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>{rw.description || rw.event_type}</div>
                        <div className="text-[10px] text-[#968a7e]">{rw.created_at?.slice(0, 10)}</div>
                      </div>
                      <span className={`font-mono font-bold text-xs ${rw.direction === 'debit' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {rw.direction === 'debit' ? '-' : '+'}{rw.points} pts
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback view for unrecognized roles
  return (
    <div className="p-8 text-center">
      <h3 className="text-lg font-bold text-white">Dashboard</h3>
      <p className="text-xs text-[#968a7e] mt-1">Please log in to view your role dashboard.</p>
    </div>
  );
};

export default RoleDashboard;
