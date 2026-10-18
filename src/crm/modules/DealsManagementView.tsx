/**
 * DealsManagementView.tsx — Commercial Deals Pipeline & Transaction History
 * Real MySQL deals • Financial totals (Closed Revenue, Pipeline Value, Commission)
 * Aura Privé styling • Responsive horizontal table scroll
 */
import React, { useEffect, useState } from 'react';
import { useCrm } from '../context/CrmContext';
import {
  Banknote,
  Search,
  RefreshCw,
  Building2,
  TrendingUp,
  Percent,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export const DealsManagementView: React.FC = () => {
  const { activeRole, theme, authFetch, authenticatedUser } = useCrm();
  const isDark = theme === 'dark';

  const canVerify = ['Super Admin', 'Sales Territory Manager', 'Operations Admin'].includes(activeRole);

  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<{ id: string; msg: string; isError: boolean } | null>(null);

  const fetchDeals = () => {
    setLoading(true);
    setForbiddenError(null);
    authFetch('/api/crm/deals')
      .then(res => {
        if (res.status === 403) {
          return res.json().then(d => {
            setForbiddenError(d.error || 'Access Denied');
            setDeals([]);
          });
        }
        return res.json().then(d => {
          if (d.success) setDeals(d.data || []);
        });
      })
      .catch(err => console.error('[DealsView] Fetch error:', err))
      .finally(() => setLoading(false));
  };

  const handleVerifyPurchase = async (dealId: string) => {
    setVerifyingId(dealId);
    setVerifyMsg(null);
    try {
      const res = await authFetch(`/api/crm/deals/${dealId}/verify-purchase`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerifyMsg({ id: dealId, msg: data.error || 'Verification failed.', isError: true });
      } else {
        setVerifyMsg({ id: dealId, msg: `✓ Verified! +${data.pointsAwarded || 500} pts attributed.`, isError: false });
        fetchDeals();
      }
    } catch (err: any) {
      setVerifyMsg({ id: dealId, msg: err.message || 'Verification request error.', isError: true });
    } finally {
      setVerifyingId(null);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [activeRole]);

  const filtered = deals.filter(d => {
    const matchesSearch =
      !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.prospect_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.property_title?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || d.deal_status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const formatPrice = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const totalClosedRevenue = deals
    .filter(d => d.deal_status === 'closed_won')
    .reduce((sum, d) => sum + Number(d.deal_value || 0), 0);

  const totalPipeline = deals
    .filter(d => !['closed_won', 'closed_lost'].includes(d.deal_status))
    .reduce((sum, d) => sum + Number(d.projected_value || d.deal_value || 0), 0);

  const totalCommission = deals
    .filter(d => d.deal_status === 'closed_won')
    .reduce((sum, d) => sum + Number(d.commission_amount || 0), 0);

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
            <span>Deals & Sales History</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] font-mono font-bold border border-[#d8a868]/30">
              {deals.length} Total Deals
            </span>
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-[#968a7e]' : 'text-[#817568]'}`}>
            Commercial contract tracking, negotiated transaction values, and closed brokerage revenue
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDeals}
            disabled={loading}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#28232D] bg-[#18161B] text-[#968a7e] hover:text-white'
                : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e]'
            }`}
            title="Refresh Deals"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d8a868]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Financial Summaries ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-5 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#968a7e]">
            <span>Closed Revenue</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-emerald-400">
            {formatPrice(totalClosedRevenue)}
          </div>
          <p className="text-xs text-[#968a7e] mt-1">Verified actual closed deals</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#968a7e]">
            <span>Active Pipeline Value</span>
            <TrendingUp className="w-4 h-4 text-[#d8a868]" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-[#d8a868]">
            {formatPrice(totalPipeline)}
          </div>
          <p className="text-xs text-[#968a7e] mt-1">Projected across active negotiations</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#968a7e]">
            <span>Earned Commission</span>
            <Percent className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono mt-3 text-violet-400">
            {formatPrice(totalCommission)}
          </div>
          <p className="text-xs text-[#968a7e] mt-1">Total brokerage payout realized</p>
        </div>
      </div>

      {/* ─── Filter Bar ──────────────────────────────────────────────── */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search deals by title, prospect, agent, or property..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-[#d8a868]/60 ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-white placeholder-[#968a7e]/60' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
            }`}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none ${
            isDark ? 'border-[#28232D] bg-[#18161B] text-white' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
          }`}
        >
          <option value="ALL">All Deal Statuses</option>
          <option value="in_negotiation">In Negotiation</option>
          <option value="under_contract">Under Contract</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
        </select>
      </div>

      {/* ─── Deals Table ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        {loading ? (
          <div className="py-20 text-center text-sm text-[#968a7e] animate-pulse">
            Loading deal records from database...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center p-6">
            <Banknote className="w-10 h-10 text-[#968a7e]/40 mx-auto mb-3" />
            <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>No deals match your filter</h4>
            <p className="text-xs text-[#968a7e] mt-1">Adjust search parameters or clear filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[950px]">
              <thead>
                <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'border-[#28232D] text-[#968a7e] bg-[#18161B]/60' : 'border-[#E2D8D1] text-[#817568] bg-[#FAF7F2]'
                }`}>
                  <th className="py-3.5 px-4 min-w-[220px]">Deal Title & Property</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Client / Prospect</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Deal Value</th>
                  <th className="py-3.5 px-4 min-w-[110px]">Commission</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Managing Agent</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Status</th>
                  <th className="py-3.5 px-4 min-w-[180px] text-right">Purchase Verification</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs ${isDark ? 'divide-[#28232D]/70' : 'divide-[#E2D8D1]'}`}>
                {filtered.map(deal => {
                  const isVerified = deal.purchase_verified === 1 || deal.purchase_verified === true;
                  const isVerifying = verifyingId === deal.id;
                  const feedback = verifyMsg && verifyMsg.id === deal.id ? verifyMsg : null;

                  return (
                    <tr key={deal.id} className={`transition-colors ${isDark ? 'hover:bg-[#1f1d26]/60' : 'hover:bg-[#FAF7F2]'}`}>
                      <td className="py-4 px-4">
                        <div className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                          {deal.title}
                        </div>
                        <div className="text-xs text-[#968a7e] mt-0.5">
                          {deal.property_title || 'General Property Inquest'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-[#c9c0b5]">
                        {deal.prospect_name || 'Verified Client'}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-sm text-[#d8a868]">
                        {formatPrice(deal.deal_value || deal.projected_value)}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-violet-400">
                        {deal.commission_amount ? formatPrice(deal.commission_amount) : `${deal.commission_rate || 2.0}%`}
                      </td>
                      <td className="py-4 px-4 text-[#c9c0b5]">
                        {deal.agent_name || 'Assigned Consultant'}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          deal.deal_status === 'closed_won'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : deal.deal_status === 'closed_lost'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span className="capitalize">{String(deal.deal_status || 'In Negotiation').replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified (+500 pts)</span>
                          </span>
                        ) : canVerify ? (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => handleVerifyPurchase(deal.id)}
                              disabled={isVerifying}
                              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#d8a868] to-[#b88c4c] text-[#0B0A0C] hover:opacity-95 shadow-sm shadow-[#d8a868]/15 cursor-pointer disabled:opacity-50"
                            >
                              {isVerifying ? 'Verifying...' : 'Verify Purchase'}
                            </button>
                            {feedback && (
                              <span className={`text-[10px] ${feedback.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {feedback.msg}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#968a7e]">
                            Awaiting Manager Approval
                          </span>
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
  );
};

export default DealsManagementView;
