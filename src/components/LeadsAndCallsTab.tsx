import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  PhoneCall,
  Search,
  Flame,
  SunMedium,
  Snowflake,
  Clock,
  MessageSquare,
  X,
  ShieldBan,
  PhoneOff,
  RefreshCcw,
  LogOut,
  Trash2,
  Eye,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Calendar,
} from 'lucide-react';
import { LeadRecord, CallRecord } from '../types/agent';
import type { LeadsOutcomeFilter, LeadsScopeFilter, LeadsSourceFilter } from '../types/navigation';
import {
  ACQUISITION_SOURCES,
  acquisitionSourceLabel,
  normalizeAcquisitionSource,
  type AcquisitionSourceKey,
} from '../utils/acquisitionSource';
import { renderHighlightedText } from '../utils/highlightKeywords';

const OUTCOME_FILTERS: LeadsOutcomeFilter[] = ['ALL', 'HOT', 'WARM', 'COLD', 'UNWANTED'];

const SCOPE_OPTIONS: Array<{ key: LeadsScopeFilter; label: string; hint: string }> = [
  { key: 'ALL', label: 'All records', hint: 'Every saved lead' },
  { key: 'ATTEMPTED', label: 'Attempted', hint: 'Leads with at least one call attempt' },
  { key: 'ANSWERED', label: 'Answered', hint: 'Leads with a connected conversation' },
  { key: 'QUALIFIED', label: 'Qualified', hint: 'HOT or WARM leads already contacted' },
];

const SCOPE_LABELS: Record<LeadsScopeFilter, string> = {
  ALL: 'All records',
  ATTEMPTED: 'Attempted calls',
  ANSWERED: 'Answered calls',
  QUALIFIED: 'Qualified leads',
};

const isAnsweredCall = (call: CallRecord): boolean =>
  call.duration >= 5 || (call.transcript || []).some((turn) => turn.role === 'user' || turn.speaker === 'customer');

const leadSourceKey = (lead: LeadRecord): AcquisitionSourceKey =>
  lead.acquisitionSource ?? normalizeAcquisitionSource(lead.lead_source ?? lead.source);

interface LeadsAndCallsTabProps {
  onStartCallWithLead?: (lead: LeadRecord) => void;
  outcomeFilter: LeadsOutcomeFilter;
  scopeFilter: LeadsScopeFilter;
  sourceFilter: LeadsSourceFilter;
  onOutcomeFilterChange: (filter: LeadsOutcomeFilter) => void;
  onScopeFilterChange: (filter: LeadsScopeFilter) => void;
  onSourceFilterChange: (filter: LeadsSourceFilter) => void;
  onClearFilters: () => void;
  focusLeadId?: string;
  focusCallId?: string;
  focusToken?: number;
  onFocusConsumed?: () => void;
}

export const LeadsAndCallsTab: React.FC<LeadsAndCallsTabProps> = ({
  onStartCallWithLead,
  outcomeFilter,
  scopeFilter,
  sourceFilter,
  onOutcomeFilterChange,
  onScopeFilterChange,
  onSourceFilterChange,
  onClearFilters,
  focusLeadId,
  focusCallId,
  focusToken,
  onFocusConsumed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [highlightLeadId, setHighlightLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [viewLoading, setViewLoading] = useState(false);
  const viewRequest = useRef(0);
  const handledLeadFocus = useRef('');
  const handledCallFocus = useRef('');
  const highlightTimer = useRef<number | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [deletion, setDeletion] = useState<{ kind: 'leads' | 'calls'; ids: string[] } | null>(null);
  const [includeCalls, setIncludeCalls] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM'>('ALL');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateError, setDateError] = useState('');

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('lyka_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const openConversation = async (id: string) => {
    // Instant UI response: use cached call if present while fetching freshest transcript
    const cached = calls.find((c) => c.callId === id);
    if (cached) {
      setSelectedCall(cached);
    }
    const request = ++viewRequest.current;
    setViewLoading(true);
    setActionError('');
    try {
      const response = await fetch(`/api/calls/${encodeURIComponent(id)}`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Conversation could not be loaded.');
      }
      if (request === viewRequest.current) {
        setSelectedCall(data.call);
      }
    } catch (error) {
      if (request === viewRequest.current && !cached) {
        setActionError(error instanceof Error ? error.message : 'Conversation could not be loaded.');
      }
    } finally {
      if (request === viewRequest.current) {
        setViewLoading(false);
      }
    }
  };

  useEffect(() => {
    setSelection([]);
  }, [outcomeFilter, scopeFilter, sourceFilter, searchTerm]);

  useEffect(
    () => () => {
      viewRequest.current++;
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    },
    []
  );

  // Prevent background page scrolling when modal is active & support ESC key to close
  useEffect(() => {
    if (selectedCall || deletion) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [selectedCall, deletion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedCall) setSelectedCall(null);
        else if (deletion) setDeletion(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCall, deletion]);

  const toggleSelected = (id: string) =>
    setSelection((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const requestDelete = (ids: string[], kind: 'leads' | 'calls') => {
    setIncludeCalls(false);
    setActionError('');
    setDeletion({ kind, ids });
  };

  const confirmDelete = async () => {
    if (!deletion || deleting) return;
    setDeleting(true);
    setActionError('');
    try {
      const response = await fetch('/api/records/delete', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deletion, confirmed: true, includeCalls }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Deletion failed.');
      if (deletion.kind === 'leads') {
        setLeads((prev) => prev.filter((l) => !deletion.ids.includes(l.id)));
      } else {
        setCalls((prev) => prev.filter((c) => !deletion.ids.includes(c.callId)));
      }
      setSelectedCall(null);
      setSelection([]);
      setDeletion(null);
      window.dispatchEvent(new Event('lyka:records-updated'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let refreshAgain = false;
    const refresh = async () => {
      if (inFlight) {
        refreshAgain = true;
        return;
      }
      inFlight = true;
      try {
        const results = await Promise.allSettled(
          ['/api/leads', '/api/calls'].map(async (url) => {
            const response = await fetch(url, { cache: 'no-store', headers: authHeaders() });
            const data = await response.json();
            if (!response.ok || data.success === false)
              throw new Error(data.error || 'Records unavailable');
            return data;
          })
        );
        if (disposed) return;
        if (results[0].status === 'fulfilled') setLeads(results[0].value.leads || []);
        if (results[1].status === 'fulfilled') setCalls(results[1].value.calls || []);
        const hasError = results[0].status === 'rejected' && results[1].status === 'rejected';
        setLoadError(hasError ? (results[0] as PromiseRejectedResult).reason.message : '');
      } finally {
        inFlight = false;
        if (!disposed) {
          setIsLoading(false);
          if (refreshAgain) {
            refreshAgain = false;
            void refresh();
          }
        }
      }
    };
    void refresh();
    window.addEventListener('lyka:records-updated', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('lyka:records-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const getOutcomeBadge = (outcome?: string) => {
    switch (outcome) {
      case 'HOT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30">
            <Flame className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
            HOT
          </span>
        );
      case 'WARM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
            <SunMedium className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
            WARM
          </span>
        );
      case 'COLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            <Snowflake className="w-2.5 h-2.5" />
            COLD
          </span>
        );
      case 'UNWANTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30">
            <ShieldBan className="w-2.5 h-2.5" />
            UNWANTED
          </span>
        );
      case 'OPT_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30">
            <LogOut className="w-2.5 h-2.5" />
            OPT-OUT
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/60">
            <PhoneOff className="w-2.5 h-2.5" />
            NO ANSWER
          </span>
        );
      case 'REACH_AGAIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30">
            <RefreshCcw className="w-2.5 h-2.5" />
            REACH AGAIN
          </span>
        );
      default:
        return (
          <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/60">
            {outcome || 'PENDING'}
          </span>
        );
    }
  };

  const getLeadCalls = (lead: LeadRecord) => {
    const normPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
    return calls.filter(
      (c) =>
        (c.leadId && c.leadId === lead.id) ||
        (c.leadPhone && normPhone && c.leadPhone.replace(/\D/g, '') === normPhone) ||
        (c.leadPhone && lead.phone && c.leadPhone === lead.phone) ||
        (lead.name && c.leadName && c.leadName.toLowerCase() === lead.name.toLowerCase())
    );
  };

  const leadHasAttempt = (lead: LeadRecord) =>
    (!!lead.callStatus && lead.callStatus !== 'NOT_CALLED') ||
    !!lead.lastCalledAt ||
    getLeadCalls(lead).length > 0;

  const leadHasAnsweredCall = (lead: LeadRecord) => getLeadCalls(lead).some(isAnsweredCall);

  const leadIsQualified = (lead: LeadRecord) =>
    (lead.outcome === 'HOT' || lead.outcome === 'WARM') && leadHasAttempt(lead);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateTime = (ts?: string) => {
    if (!ts) return '—';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isCallInDateRange = (ts?: string): boolean => {
    if (!ts) return false;
    const callDate = new Date(ts);
    if (isNaN(callDate.getTime())) return false;

    if (dateFilter === 'ALL') return true;

    const now = new Date();
    if (dateFilter === 'TODAY') {
      return (
        callDate.getFullYear() === now.getFullYear() &&
        callDate.getMonth() === now.getMonth() &&
        callDate.getDate() === now.getDate()
      );
    }

    if (dateFilter === 'LAST_7_DAYS') {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return callDate >= start;
    }

    if (dateFilter === 'LAST_30_DAYS') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return callDate >= start;
    }

    if (dateFilter === 'CUSTOM') {
      if (customFrom && customTo && customFrom > customTo) return false;
      if (customFrom) {
        const fromDate = new Date(customFrom + 'T00:00:00');
        if (callDate < fromDate) return false;
      }
      if (customTo) {
        const toDate = new Date(customTo + 'T23:59:59.999');
        if (callDate > toDate) return false;
      }
      return true;
    }

    return true;
  };

  const filteredLeads = leads.filter((lead) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (lead.name && lead.name.toLowerCase().includes(q)) ||
      (lead.phone && lead.phone.includes(q)) ||
      (lead.location && lead.location.toLowerCase().includes(q)) ||
      (lead.propertyType && lead.propertyType.toLowerCase().includes(q));
    const matchesOutcome =
      outcomeFilter === 'ALL' ||
      (lead.outcome && lead.outcome === outcomeFilter) ||
      (outcomeFilter === 'UNWANTED' && (lead.outcome === 'OPT_OUT' || !!lead.isOptedOut));
    const matchesScope =
      scopeFilter === 'ALL' ||
      (scopeFilter === 'ATTEMPTED' && leadHasAttempt(lead)) ||
      (scopeFilter === 'ANSWERED' && leadHasAnsweredCall(lead)) ||
      (scopeFilter === 'QUALIFIED' && leadIsQualified(lead));
    const matchesSource = sourceFilter === 'ALL' || leadSourceKey(lead) === sourceFilter;
    const leadCalls = getLeadCalls(lead);
    const matchesDate =
      dateFilter === 'ALL' ||
      leadCalls.some((c) => c.startedAt && isCallInDateRange(c.startedAt)) ||
      (lead.lastCalledAt && isCallInDateRange(lead.lastCalledAt));
    return matchesSearch && matchesOutcome && matchesScope && matchesSource && matchesDate;
  });

  const activeSourceLabel = sourceFilter === 'ALL' ? '' : acquisitionSourceLabel(sourceFilter);

  const allVisibleSelected =
    filteredLeads.length > 0 && filteredLeads.every((l) => selection.includes(l.id));

  useEffect(() => {
    if (!focusCallId) return;
    const key = `call:${focusCallId}:${focusToken ?? 0}`;
    if (handledCallFocus.current === key) return;
    handledCallFocus.current = key;
    void openConversation(focusCallId);
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCallId, focusToken]);

  useEffect(() => {
    if (!focusLeadId) return;
    const key = `lead:${focusLeadId}:${focusToken ?? 0}`;
    if (handledLeadFocus.current === key) return;
    const lead = leads.find((item) => item.id === focusLeadId);
    if (!lead) return;
    handledLeadFocus.current = key;
    setHighlightLeadId(lead.id);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightLeadId(null), 4500);
    const latestCall = getLeadCalls(lead)[0];
    if (latestCall) void openConversation(latestCall.callId);
    window.requestAnimationFrame(() => {
      document.getElementById(`lead-row-${lead.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLeadId, focusToken, leads]);

  // Find all calls belonging to the currently inspected customer in the modal
  const selectedCustomerCalls = selectedCall
    ? calls.filter(
        (c) =>
          (selectedCall.leadId && c.leadId === selectedCall.leadId) ||
          (selectedCall.leadPhone && c.leadPhone === selectedCall.leadPhone) ||
          (selectedCall.leadName && c.leadName && c.leadName.toLowerCase() === selectedCall.leadName.toLowerCase())
      )
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* ── Top Header Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm transition-colors duration-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Leads &amp; Call Records
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Extracted customer inquiries, qualification statuses, and verified call turn transcripts.
              </p>
            </div>
          </div>

          {/* Counts & CRM Quick Link */}
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 shrink-0">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <strong className="text-slate-900 dark:text-slate-200">{leads.length}</strong> leads
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <strong className="text-slate-900 dark:text-slate-200">{calls.length}</strong> calls
            </span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, locality…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Acquisition Source Filter */}
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Source:</span>
            <select
              aria-label="Filter leads by acquisition source"
              value={sourceFilter}
              onChange={(event) => onSourceFilterChange(event.target.value as LeadsSourceFilter)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 ${
                sourceFilter === 'ALL'
                  ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  : 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold'
              }`}
            >
              <option value="ALL">All sources</option>
              {ACQUISITION_SOURCES.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>

          {/* Outcome Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Outcome:</span>
            {OUTCOME_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => onOutcomeFilterChange(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  outcomeFilter === f
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Call Scope Pills (Attempted / Answered / Qualified from Dashboard) */}
          <div className="flex w-full items-center gap-1 flex-wrap">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Call scope:</span>
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => onScopeFilterChange(option.key)}
                title={option.hint}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  scopeFilter === option.key
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                {option.label}
              </button>
            ))}
            {(outcomeFilter !== 'ALL' || scopeFilter !== 'ALL' || sourceFilter !== 'ALL' || dateFilter !== 'ALL') && (
              <button
                onClick={() => {
                  onClearFilters();
                  setDateFilter('ALL');
                  setCustomFrom('');
                  setCustomTo('');
                  setDateError('');
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                title="Clear all lead filters"
              >
                <X className="w-3 h-3" />
                Clear filters
              </button>
            )}
            {(scopeFilter !== 'ALL' || sourceFilter !== 'ALL' || dateFilter !== 'ALL') && (
              <span className="ml-auto text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                {scopeFilter === 'ATTEMPTED' &&
                  `${calls.length} call attempt${calls.length === 1 ? '' : 's'}`}
                {scopeFilter === 'ANSWERED' &&
                  `${calls.filter(isAnsweredCall).length} answered call${
                    calls.filter(isAnsweredCall).length === 1 ? '' : 's'
                  }`}
                {scopeFilter === 'QUALIFIED' && 'Qualified leads'}
                {sourceFilter !== 'ALL' && `${activeSourceLabel} leads`}
                {dateFilter !== 'ALL' && `Call date: ${dateFilter}`}
                <span className="text-slate-400 dark:text-slate-500">
                  {' '}
                  · {filteredLeads.length} lead{filteredLeads.length === 1 ? '' : 's'} matched
                </span>
              </span>
            )}
          </div>

          {/* Call Date Filter Pills (Today, Last 7 Days, Last 30 Days, Custom Range) */}
          <div className="flex w-full items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Call date:</span>
            </span>
            {(['ALL', 'TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'CUSTOM'] as const).map((df) => (
              <button
                key={df}
                onClick={() => {
                  setDateFilter(df);
                  setDateError('');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  dateFilter === df
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                {df === 'ALL' ? 'All calls' : df === 'TODAY' ? 'Today' : df === 'LAST_7_DAYS' ? 'Last 7 Days' : df === 'LAST_30_DAYS' ? 'Last 30 Days' : 'Custom date range'}
              </button>
            ))}

            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-2 text-xs ml-1 flex-wrap">
                <label className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>From:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      if (customTo && e.target.value > customTo) {
                        setDateError('"From" date cannot be after "To" date.');
                      } else {
                        setDateError('');
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>To:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      if (customFrom && customFrom > e.target.value) {
                        setDateError('"From" date cannot be after "To" date.');
                      } else {
                        setDateError('');
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </label>
              </div>
            )}

            {dateFilter !== 'ALL' && (
              <button
                onClick={() => {
                  setDateFilter('ALL');
                  setCustomFrom('');
                  setCustomTo('');
                  setDateError('');
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                title="Reset call date filter"
              >
                <X className="w-3 h-3" />
                Reset call date
              </button>
            )}

            {dateError && (
              <span role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {dateError}
              </span>
            )}
          </div>

          {/* Bulk Delete Button */}
          {selection.length > 0 && (
            <button
              onClick={() => requestDelete(selection, 'leads')}
              className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-semibold border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete selected ({selection.length})
            </button>
          )}
        </div>
      </div>

      {/* Action / View Status Feedback */}
      {actionError && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 px-1 font-medium">
          {actionError}
        </p>
      )}
      {viewLoading && (
        <p role="status" className="text-xs text-amber-600 dark:text-amber-400 px-1 font-medium">
          Loading conversation details…
        </p>
      )}

      {/* ── Main Leads & Calls Table ── */}
      {loadError ? (
        <div role="alert" className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          {loadError}
        </div>
      ) : isLoading ? (
        <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          Loading leads &amp; call records…
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wide border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all visible leads"
                      checked={allVisibleSelected}
                      onChange={(e) =>
                        setSelection(
                          e.target.checked ? filteredLeads.map((l) => l.id).slice(0, 100) : []
                        )
                      }
                    />
                  </th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Requirements</th>
                  <th className="py-2.5 px-3">Budget</th>
                  <th className="py-2.5 px-3">Call &amp; Summary</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      {dateFilter !== 'ALL'
                        ? 'No prospect leads with calls found in the selected date range.'
                        : 'No prospect leads found matching criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const leadCalls = getLeadCalls(lead);
                    const latestCall = leadCalls[0];
                    const callCount = leadCalls.length;
                    const summaryText = latestCall?.summary || lead.notes || '';

                    return (
                      <tr
                        key={lead.id}
                        id={`lead-row-${lead.id}`}
                        className={`transition-colors group align-middle ${
                          highlightLeadId === lead.id
                            ? 'bg-amber-50/80 dark:bg-amber-500/10 ring-1 ring-inset ring-amber-300 dark:ring-amber-500/40'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-850/60'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${lead.name}`}
                            checked={selection.includes(lead.id)}
                            onChange={() => toggleSelected(lead.id)}
                          />
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {lead.name || 'Unnamed Prospect'}
                          </div>
                          <div
                            className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5"
                            title={lead.lead_source || undefined}
                          >
                            Source: {acquisitionSourceLabel(leadSourceKey(lead))}
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-3">
                          <div className="font-mono text-slate-700 dark:text-slate-300">
                            {lead.phone || '—'}
                          </div>
                          {(lead.preferred_contact_method || lead.best_time_to_contact) && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {[lead.preferred_contact_method, lead.best_time_to_contact]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>

                        {/* Location */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {lead.location || '—'}
                        </td>

                        {/* Requirements */}
                        <td className="py-3 px-3">
                          {lead.propertyType ? (
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              {lead.propertyType}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">—</span>
                          )}
                          {lead.intent && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{lead.intent}</div>
                          )}
                        </td>

                        {/* Budget */}
                        <td className="py-3 px-3 font-mono font-medium text-emerald-700 dark:text-emerald-400">
                          {lead.budget ? `${lead.currency || ''} ${lead.budget}` : '—'}
                        </td>

                        {/* Call & Summary snippet */}
                        <td className="py-3 px-3 max-w-[240px]">
                          {callCount > 0 ? (
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                                  {latestCall?.startedAt ? formatDateTime(latestCall.startedAt) : '—'}
                                </span>
                                {callCount > 1 && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 text-[9px] font-bold">
                                    {callCount} calls
                                  </span>
                                )}
                              </div>
                              {summaryText && (
                                <p
                                  className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                                  title={summaryText}
                                >
                                  {summaryText}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">No calls yet</span>
                          )}
                        </td>

                        {/* Outcome & Numerical Score */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col items-start gap-1">
                            {getOutcomeBadge(lead.outcome)}
                            {lead.score != null && (
                              <span
                                className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                                title="Lead Qualification Score"
                              >
                                Score: {lead.score}/100
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions: View, Summary, Delete aligned neatly */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {/* Start Call Button (if callable) */}
                            {onStartCallWithLead && (
                              <button
                                onClick={() => onStartCallWithLead(lead)}
                                title={`Start call with ${lead.name}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 h-7 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 dark:hover:bg-emerald-500/25 transition-colors cursor-pointer"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Call</span>
                              </button>
                            )}

                            {/* View Button: 1 Click immediately opens conversation modal */}
                            <button
                              onClick={() => {
                                if (latestCall) {
                                  openConversation(latestCall.callId);
                                }
                              }}
                              disabled={callCount === 0}
                              title={
                                callCount > 0
                                  ? `View full conversation (${callCount} call${callCount > 1 ? 's' : ''})`
                                  : 'No call records yet'
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                callCount > 0
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 dark:hover:bg-amber-500/25 shadow-xs'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-600 dark:border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>

                            {/* Summary Button: Opens modal to view automated call summary */}
                            <button
                              onClick={() => {
                                if (latestCall) {
                                  openConversation(latestCall.callId);
                                }
                              }}
                              disabled={!summaryText}
                              title={summaryText || 'No summary recorded'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                summaryText
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-600 dark:border-slate-800 cursor-not-allowed'
                              }`}
                            >
                              <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Summary</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => requestDelete([lead.id], 'leads')}
                              title="Delete lead record"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 dark:hover:text-rose-400 dark:hover:bg-rose-500/15 dark:border-slate-800 dark:hover:border-rose-500/30 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{filteredLeads.length}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{leads.length}</strong> leads
              {scopeFilter !== 'ALL' && (
                <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">
                  · {SCOPE_LABELS[scopeFilter]}
                </span>
              )}
              {outcomeFilter !== 'ALL' && (
                <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">· {outcomeFilter}</span>
              )}
              {sourceFilter !== 'ALL' && (
                <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">
                  · Source: {activeSourceLabel}
                </span>
              )}
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              {calls.length} verified call record{calls.length !== 1 ? 's' : ''} linked
            </span>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletion && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeletion(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 transition-colors duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="delete-modal-title"
                  className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>
                    Delete {deletion.ids.length}{' '}
                    {deletion.kind === 'leads'
                      ? deletion.ids.length === 1
                        ? 'lead'
                        : 'leads'
                      : deletion.ids.length === 1
                      ? 'call'
                      : 'calls'}
                    ?
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  These records will be removed from this list. Stored data is retained safely for audit recovery.
                </p>
              </div>
              <button
                onClick={() => setDeletion(null)}
                disabled={deleting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Include Calls Checkbox */}
            {deletion.kind === 'leads' && (
              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={includeCalls}
                  onChange={(e) => setIncludeCalls(e.target.checked)}
                  disabled={deleting}
                  className="mt-0.5 accent-amber-500"
                />
                <span>
                  Also remove associated calls and transcripts.{' '}
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px] mt-0.5">
                    Leave unchecked to keep call history intact.
                  </span>
                </span>
              </label>
            )}

            {/* Error Message */}
            {actionError && (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                {actionError}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                disabled={deleting}
                onClick={() => setDeletion(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Conversation Modal (Centered, Theme-Responsive, High-Capacity Transcript) ── */}
      {selectedCall && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 pt-16 sm:pt-20 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCall(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-4 sm:p-5 shadow-2xl flex flex-col h-[85vh] sm:h-[88vh] max-h-[850px] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedCall.leadName}
                  </h3>
                  {getOutcomeBadge(selectedCall.outcome)}
                  {(() => {
                    const matchedLead = leads.find(
                      (l) =>
                        (selectedCall.leadId && l.id === selectedCall.leadId) ||
                        (selectedCall.leadPhone && l.phone && l.phone.replace(/\D/g, '') === selectedCall.leadPhone.replace(/\D/g, ''))
                    );
                    const score = matchedLead?.score ?? selectedCall.score;
                    if (score != null) {
                      return (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
                          title="Deterministic Persisted Lead Score"
                        >
                          Score: {score}/100
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {selectedCall.leadPhone || 'No phone'} • Call ID: {selectedCall.callId.slice(-8)}
                  {selectedCall.startedAt && ` • ${formatDateTime(selectedCall.startedAt)}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If the customer has multiple calls, allow switching directly inside the modal */}
            {selectedCustomerCalls.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 shrink-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">
                  Calls for this customer ({selectedCustomerCalls.length}):
                </span>
                {selectedCustomerCalls.map((c, idx) => (
                  <button
                    key={c.callId}
                    onClick={() => openConversation(c.callId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 ${
                      selectedCall.callId === c.callId
                        ? 'bg-amber-500/15 text-amber-800 border border-amber-300 font-semibold dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 dark:text-slate-400 dark:border-slate-800'
                    }`}
                  >
                    Call #{selectedCustomerCalls.length - idx} ({c.startedAt ? new Date(c.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : c.callId.slice(-4)})
                  </button>
                ))}
              </div>
            )}

            {/* Compact Header Intelligence Section (Meta Pills + Qualification Data) */}
            <div className="shrink-0 space-y-2 mt-3">
              {/* Call Meta & Extracted Slot Highlights in 1 Compact Row */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Duration */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Duration:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatDuration(selectedCall.duration || 0)}
                  </span>
                </div>

                {/* Call Time */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Time:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedCall.startedAt
                      ? new Date(selectedCall.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Status:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {selectedCall.callStatus || 'COMPLETED'}
                  </span>
                </div>

                {/* Sentiment */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {selectedCall.sentiment === 'positive' && <ThumbsUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                  {selectedCall.sentiment === 'negative' && <ThumbsDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Sentiment:</span>
                  <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                    {selectedCall.sentiment || 'Neutral'}
                  </span>
                </div>

                {/* Property Type */}
                {selectedCall.propertyType && (
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Property:</span>
                    <span className="font-semibold">{selectedCall.propertyType}</span>
                  </div>
                )}

                {/* Budget */}
                {selectedCall.budget && (
                  <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Budget:</span>
                    <span className="font-semibold">{selectedCall.budget}</span>
                  </div>
                )}

                {/* Location */}
                {selectedCall.location && (
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Loc:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedCall.location}</span>
                  </div>
                )}
              </div>

              {/* Compact Automated Call Summary */}
              {selectedCall.summary && (
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 text-xs">
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200/60 dark:border-slate-800/80">
                    <h4 className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Automated Call Summary</span>
                    </h4>
                    {selectedCall.nextAction && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Next action: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{selectedCall.nextAction}</strong>
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-medium whitespace-pre-wrap max-h-16 overflow-y-auto">
                    {selectedCall.summary}
                  </p>
                </div>
              )}
            </div>

            {/* ── High-Capacity Conversation Transcript (Flex-1 Max Space) ── */}
            <div className="flex-1 min-h-0 flex flex-col mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100 shrink-0 px-0.5">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Full Call Transcript ({selectedCall.transcript?.length || 0} turns)</span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Chronological dialogue
                </span>
              </div>

              {/* Transcript Scroll Container */}
              <div className="flex-1 min-h-0 bg-slate-50/80 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 overflow-y-auto overscroll-contain space-y-3 text-xs transition-colors duration-200">
                {!selectedCall.transcript || selectedCall.transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                    <p className="italic">No transcript dialogue recorded for this call.</p>
                  </div>
                ) : (
                  selectedCall.transcript.map((t, idx) => {
                    const isUser = t.role === 'user' || t.speaker === 'customer';
                    const speakerName = isUser
                      ? selectedCall.leadName || 'Customer'
                      : t.agentName || 'Executive';

                    return (
                      <div
                        key={t.id || idx}
                        className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs leading-relaxed transition-colors duration-150 ${
                            isUser
                              ? 'bg-amber-50 dark:bg-amber-500/20 text-slate-900 dark:text-amber-100 border border-amber-200 dark:border-amber-500/30 rounded-tr-xs shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 rounded-tl-xs shadow-xs'
                          }`}
                        >
                          {/* Bubble Speaker Header */}
                          <div className="flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-wider mb-1.5 pb-1 border-b border-black/5 dark:border-white/5">
                            <span className={isUser ? 'text-amber-800 dark:text-amber-300 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                              {speakerName}
                            </span>
                            <span className="text-slate-400 dark:text-slate-400 font-mono text-[9px] lowercase">
                              {formatTime(t.timestamp)}
                            </span>
                          </div>

                          {/* Turn Content with Break-Words & Highlights */}
                          <div className="leading-relaxed font-medium whitespace-pre-wrap break-words text-slate-900 dark:text-slate-100">
                            {!isUser ? renderHighlightedText(t.text) : t.text}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer / Close Button (Always Visible at Bottom) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
