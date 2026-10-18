/**
 * PerformanceRewardsView.tsx — Employee Performance Tracking & Verified Rewards Points Ledger
 * Real MySQL database metrics • Auditable point changes • Purchase-verified points attribution
 */
import React, { useEffect, useState } from 'react';
import { useCrm } from '../context/CrmContext';
import {
  Award,
  Trophy,
  RefreshCw,
  Search,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  CheckSquare,
  CalendarCheck2,
  DollarSign,
  TrendingUp,
  UserCheck,
} from 'lucide-react';

export const PerformanceRewardsView: React.FC = () => {
  const { activeRole, theme, authenticatedUser, authFetch } = useCrm();
  const isDark = theme === 'dark';

  const [rewards, setRewards] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [empPerformance, setEmpPerformance] = useState<any | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setForbiddenError(null);
    Promise.all([
      authFetch('/api/crm/rewards').then(r => r.json()),
      authFetch('/api/crm/employees').then(r => r.json()),
    ])
      .then(([rewRes, empRes]) => {
        if (rewRes.success) setRewards(rewRes.data || []);
        if (empRes.success && Array.isArray(empRes.data)) {
          setEmployees(empRes.data);
          // Default to authenticated user if employee, or first employee in list
          if (!selectedEmpId) {
            if (authenticatedUser?.id) {
              setSelectedEmpId(authenticatedUser.id);
            } else if (empRes.data.length > 0) {
              setSelectedEmpId(empRes.data[0].id);
            }
          }
        }
      })
      .catch(err => console.error('[PerformanceView] Fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [activeRole]);

  // Fetch detailed performance metrics whenever selectedEmpId changes
  useEffect(() => {
    if (!selectedEmpId) return;
    setPerfLoading(true);
    authFetch(`/api/crm/employees/${selectedEmpId}/performance`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.performance) {
          setEmpPerformance(data.performance);
        }
      })
      .catch(err => console.error('[PerformanceView] Performance fetch error:', err))
      .finally(() => setPerfLoading(false));
  }, [selectedEmpId]);

  const filteredRewards = rewards.filter(r => {
    return (
      !search ||
      r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase()) ||
      r.event_type?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const sortedLeaderboard = [...employees].sort((a, b) => (b.points_balance || 0) - (a.points_balance || 0));

  const formatCurrency = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  if (forbiddenError) {
    return (
      <div className="py-20 text-center rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 max-w-xl mx-auto">
        <ShieldCheck className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white">Access Denied</h3>
        <p className="text-xs text-[#968a7e] mt-2">{forbiddenError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-200">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
            <span>Performance & Rewards</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] font-mono font-bold border border-[#d8a868]/30">
              Live Database Ledger
            </span>
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-[#968a7e]' : 'text-[#817568]'}`}>
            Real employee activity metrics, idempotent purchase verification points, and auditable ledger
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Employee Selector for Manager Inspection */}
          <select
            value={selectedEmpId}
            onChange={e => setSelectedEmpId(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-white' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
            }`}
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name || emp.name} ({emp.role})
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#28232D] bg-[#18161B] text-[#968a7e] hover:text-white'
                : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e]'
            }`}
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d8a868]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Section E: Real Employee Activity & Verified Metrics ─────── */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-5 pb-4 border-b border-[#28232D]">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8a868]">
              Verified Employee Performance Scorecard
            </div>
            <h3 className={`text-lg font-bold mt-0.5 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
              {empPerformance ? empPerformance.employee_name : 'Staff Member'}{' '}
              <span className="text-xs font-normal text-[#968a7e]">
                ({empPerformance ? empPerformance.employee_role : ''} • ID: {selectedEmpId})
              </span>
            </h3>
          </div>
          {empPerformance && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#d8a868]/15 border border-[#d8a868]/30">
              <Award className="w-4 h-4 text-[#d8a868]" />
              <span className="text-xs font-bold text-[#d8a868]">
                {empPerformance.points_balance || 0} Points Balance
              </span>
            </div>
          )}
        </div>

        {perfLoading ? (
          <div className="py-12 text-center text-xs text-[#968a7e] animate-pulse">
            Loading real performance records from MySQL...
          </div>
        ) : empPerformance ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Assigned Leads */}
            <div className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D]">
              <div className="flex items-center justify-between text-[#968a7e] mb-1">
                <span className="text-[10px] font-bold uppercase">Assigned Leads</span>
                <Users className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-xl font-extrabold font-mono text-white">
                {empPerformance.assigned_leads || 0}
              </div>
              <div className="text-[10px] text-[#968a7e] mt-0.5">Active prospects</div>
            </div>

            {/* 2. Follow-ups Completed */}
            <div className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D]">
              <div className="flex items-center justify-between text-[#968a7e] mb-1">
                <span className="text-[10px] font-bold uppercase">Follow-ups Done</span>
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-extrabold font-mono text-white">
                {empPerformance.followups_completed || 0}
              </div>
              <div className="text-[10px] text-[#968a7e] mt-0.5">Completed tasks</div>
            </div>

            {/* 3. Site Visits Completed */}
            <div className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D]">
              <div className="flex items-center justify-between text-[#968a7e] mb-1">
                <span className="text-[10px] font-bold uppercase">Site Visits Done</span>
                <CalendarCheck2 className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-xl font-extrabold font-mono text-white">
                {empPerformance.site_visits_completed || 0}
              </div>
              <div className="text-[10px] text-[#968a7e] mt-0.5">Client tours hosted</div>
            </div>

            {/* 4. Verified Purchases */}
            <div className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D]">
              <div className="flex items-center justify-between text-[#968a7e] mb-1">
                <span className="text-[10px] font-bold uppercase">Verified Deals</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#d8a868]" />
              </div>
              <div className="text-xl font-extrabold font-mono text-[#d8a868]">
                {empPerformance.verified_purchases || 0}
              </div>
              <div className="text-[10px] text-[#968a7e] mt-0.5">Closed & verified</div>
            </div>

            {/* 5. Attributed Deal Value */}
            <div className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D]">
              <div className="flex items-center justify-between text-[#968a7e] mb-1">
                <span className="text-[10px] font-bold uppercase">Attributed Value</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-base font-extrabold font-mono text-emerald-400 mt-0.5">
                {formatCurrency(empPerformance.attributed_revenue)}
              </div>
              <div className="text-[10px] text-[#968a7e] mt-0.5">From verified sales</div>
            </div>

            {/* 6. Current Points */}
            <div className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D]">
              <div className="flex items-center justify-between text-[#968a7e] mb-1">
                <span className="text-[10px] font-bold uppercase">Current Points</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-extrabold font-mono text-white">
                {empPerformance.points_balance || 0}
              </div>
              <div className="text-[10px] text-[#968a7e] mt-0.5">+500 pts per verified deal</div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#968a7e]">
            Select an employee above to inspect real activity metrics.
          </div>
        )}
      </div>

      {/* ─── Leaderboard Highlights ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedLeaderboard.slice(0, 3).map((emp, idx) => (
          <div
            key={emp.id}
            className={`p-5 rounded-2xl border relative overflow-hidden ${
              isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                idx === 0 ? 'text-[#d8a868]' : idx === 1 ? 'text-zinc-400' : 'text-amber-700'
              }`}>
                Rank #{idx + 1} • {idx === 0 ? 'Gold' : idx === 1 ? 'Silver' : 'Bronze'}
              </span>
              <Trophy className={`w-5 h-5 ${idx === 0 ? 'text-[#d8a868]' : 'text-[#968a7e]'}`} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#d8a868]/20 border border-[#d8a868]/40 flex items-center justify-center font-bold text-sm text-[#d8a868]">
                {emp.full_name?.charAt(0) || emp.name?.charAt(0) || 'E'}
              </div>
              <div>
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                  {emp.full_name || emp.name}
                </h4>
                <p className="text-xs text-[#968a7e]">{emp.role}</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#28232D] flex items-center justify-between">
              <span className="text-xs text-[#968a7e]">Total Points</span>
              <span className="text-lg font-extrabold font-mono text-[#d8a868]">
                {emp.points_balance || 0} pts
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Search & Transaction Ledger ─────────────────────────────── */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search point ledger by employee, reason, or event type..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-[#d8a868]/60 ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-white placeholder-[#968a7e]/60' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
            }`}
          />
        </div>
      </div>

      {/* ─── Ledger Table ────────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        {loading ? (
          <div className="py-20 text-center text-sm text-[#968a7e] animate-pulse">
            Loading transaction ledger from database...
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="py-20 text-center p-6">
            <Award className="w-10 h-10 text-[#968a7e]/40 mx-auto mb-3" />
            <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
              No reward ledger entries recorded yet
            </h4>
            <p className="text-xs text-[#968a7e] mt-1">
              Points are awarded upon idempotent deal purchase verification.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[850px]">
              <thead>
                <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'border-[#28232D] text-[#968a7e] bg-[#18161B]/60' : 'border-[#E2D8D1] text-[#817568] bg-[#FAF7F2]'
                }`}>
                  <th className="py-3.5 px-4 min-w-[180px]">Employee</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Event Type</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Reason / Details</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Points Awarded</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Timestamp</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs ${isDark ? 'divide-[#28232D]/70' : 'divide-[#E2D8D1]'}`}>
                {filteredRewards.map((item, idx) => (
                  <tr key={item.id || idx} className={`transition-colors ${isDark ? 'hover:bg-[#1f1d26]/60' : 'hover:bg-[#FAF7F2]'}`}>
                    <td className="py-4 px-4">
                      <div className={`font-semibold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                        {item.employee_name || 'Staff Member'}
                      </div>
                      <div className="text-[11px] text-[#968a7e] font-mono">
                        {item.employee_id}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="capitalize px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#d8a868]/10 text-[#d8a868] border border-[#d8a868]/20">
                        {item.event_type?.replace(/_/g, ' ') || 'Points Award'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className={`text-xs ${isDark ? 'text-[#c9c0b5]' : 'text-[#4f4539]'}`}>
                        {item.reason}
                      </div>
                      {item.source_event_id && (
                        <div className="text-[10px] text-[#968a7e] font-mono mt-0.5">
                          Ref: {item.source_event_id}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sm text-emerald-400">
                      +{item.points} pts
                    </td>
                    <td className="py-4 px-4 text-xs text-[#968a7e]">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceRewardsView;
