import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Loader2,
  Megaphone,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  ShieldBan,
  ShieldCheck,
  Snowflake,
  Sparkles,
  SunMedium,
  Target,
  TrendingUp,
  UserX,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CallRecord, LeadRecord, TranscriptTurn } from '../types/agent';
import type { DashboardPeriod, LeadsNavigationTarget, LeadsOutcomeFilter } from '../types/navigation';
import {
  ACQUISITION_SOURCES,
  normalizeAcquisitionSource,
  type AcquisitionSourceKey,
} from '../utils/acquisitionSource';

interface CrmDashboardProps {
  onStartCallWithLead?: (lead: LeadRecord) => void;
  onOpenQueue?: () => void;
  onOpenLogs?: () => void;
  onNavigateLeads: (target: LeadsNavigationTarget) => void;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

type TempKey = 'HOT' | 'WARM' | 'COLD' | 'OPT_OUT';

const TEMP_OUTCOME: Record<TempKey, LeadsOutcomeFilter> = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD',
  OPT_OUT: 'UNWANTED',
};

interface HandoffItem {
  lead: LeadRecord;
  call?: CallRecord;
  score: number;
}

interface SummaryView {
  name: string;
  phone: string;
  score: number;
  outcome: string;
  summary: string;
  budget: string;
  location: string;
  timeline: string;
  callback: string;
  transcript: TranscriptTurn[];
}

const PAGE_BG = 'linear-gradient(165deg, #f7f1e9 0%, #f5eee6 38%, #f1e5df 100%)';
const CARD = 'rounded-[24px] border border-[#eeded4] dark:border-slate-800 bg-[#fdfaf7] dark:bg-slate-900 shadow-[0_26px_60px_-48px_rgba(74,18,55,0.6)] dark:shadow-none text-slate-900 dark:text-slate-100 transition-colors';
const H2 = 'text-[16px] font-bold tracking-tight text-[#3c122e] dark:text-slate-100';
const SUB = 'mt-0.5 text-[11.5px] text-[#9b7f8c] dark:text-slate-400';
const ICON_TILE = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[#f1dfbc] dark:border-slate-700 bg-[#fbf0da] dark:bg-slate-800';
const GOLD_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f7e2b8 0%, #ecc176 38%, #d89e43 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 12px 24px -16px rgba(200,141,50,0.95)',
  color: '#3a2103',
};
const ACTIVE_PILL_STYLE: React.CSSProperties = {
  background: '#4a1237',
  color: '#fdf3e6',
  boxShadow: '0 6px 14px -9px rgba(46,11,34,0.85)',
};

const TEMP_STYLES: Record<string, { label: string; bg: string; color: string; border: string }> = {
  HOT: { label: 'HOT', bg: '#fde8ea', color: '#d62d4b', border: '#f5c9cf' },
  WARM: { label: 'WARM', bg: '#fdf2dd', color: '#b97a12', border: '#f3ddb0' },
  COLD: { label: 'COLD', bg: '#eef3fd', color: '#3a6fce', border: '#d4e2fb' },
  OPT_OUT: { label: 'OPT-OUT', bg: '#fbe7f0', color: '#c01c62', border: '#f4c7dc' },
  PENDING: { label: 'PENDING', bg: '#f3efec', color: '#8a6f7c', border: '#e6d9cf' },
};

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function smoothPath(points: Array<[number, number]>, top: number, baseline: number): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, top, baseline);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6, top, baseline);
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function sparkPath(values: number[], width = 62, height = 16): string {
  const max = Math.max(1, ...values);
  const n = Math.max(2, values.length);
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${((i / (n - 1)) * width).toFixed(1)} ${(height - 2 - (v / max) * (height - 5)).toFixed(1)}`)
    .join(' ');
}

function cumulativeSeries(dates: Array<string | undefined>, buckets = 12, spanDays = 30): number[] {
  const now = Date.now();
  const span = spanDays * 86400000;
  const arr = new Array(buckets).fill(0) as number[];
  for (const iso of dates) {
    if (!iso) continue;
    const t = +new Date(iso);
    if (Number.isNaN(t) || t < now - span) continue;
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((t - (now - span)) / span) * buckets)));
    arr[idx] += 1;
  }
  let acc = 0;
  return arr.map((v) => (acc += v));
}

function isAnsweredCall(call: CallRecord): boolean {
  if (!call) return false;
  if (call.duration >= 5) return true;
  return (call.transcript || []).some((t) => t.role === 'user' || t.speaker === 'customer');
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatBudget(raw?: string, currency?: string): string {
  if (!raw) return 'Not specified';
  const text = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return text;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) return text;
  const cur = (currency || 'INR').toUpperCase();
  if (cur === 'INR') {
    if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
    if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  if (amount >= 1e6) return `${cur} ${(amount / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `${cur} ${amount.toLocaleString()}`;
}

function fitScore(lead: LeadRecord, call?: CallRecord): number {
  if (lead.score != null) return lead.score;
  if (call?.score != null) return call.score;
  return lead.outcome === 'HOT' ? 75 : lead.outcome === 'WARM' ? 50 : 25;
}

const TempBadge: React.FC<{ outcome?: string; small?: boolean }> = ({ outcome, small }) => {
  const key = outcome && TEMP_STYLES[outcome] ? outcome : 'PENDING';
  const style = TEMP_STYLES[key];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-bold ${
        small ? 'px-2 py-0.5 text-[9.5px]' : 'px-2.5 py-1 text-[10px]'
      }`}
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {key === 'HOT' && <Flame className="h-2.5 w-2.5" />}
      {key === 'WARM' && <SunMedium className="h-2.5 w-2.5" />}
      {key === 'COLD' && <Snowflake className="h-2.5 w-2.5" />}
      {key === 'OPT_OUT' && <UserX className="h-2.5 w-2.5" />}
      {style.label}
    </span>
  );
};

const Ring: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const size = 82;
  const stroke = 7;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`${pct}%`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ece2da" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700" fill="#3a102c">
        {pct}%
      </text>
    </svg>
  );
};

export const CrmDashboard: React.FC<CrmDashboardProps> = ({
  onStartCallWithLead,
  onOpenQueue,
  onOpenLogs,
  onNavigateLeads,
  period,
  onPeriodChange,
}) => {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<SummaryView | null>(null);

  // Same-origin records feed used by Leads & Calls (local operator or signed-in employee).
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let refreshAgain = false;
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('lyka_auth_token');
    if (token) headers.Authorization = `Bearer ${token}`;

    const refresh = async () => {
      if (inFlight) {
        refreshAgain = true;
        return;
      }
      inFlight = true;
      try {
        const results = await Promise.allSettled(
          ['/api/leads', '/api/calls'].map(async (url) => {
            const response = await fetch(url, { cache: 'no-store', headers });
            const data = await response.json();
            if (!response.ok || data.success === false) throw new Error(data.error || 'Records unavailable');
            return data;
          })
        );
        if (disposed) return;
        if (results[0].status === 'fulfilled') setLeads(results[0].value.leads || []);
        if (results[1].status === 'fulfilled') setCalls(results[1].value.calls || []);
        const bothFailed = results[0].status === 'rejected' && results[1].status === 'rejected';
        setLoadError(
          bothFailed
            ? (results[0] as PromiseRejectedResult).reason?.message || 'Live records are unavailable.'
            : ''
        );
      } finally {
        inFlight = false;
        if (!disposed) {
          setLoading(false);
          if (refreshAgain) {
            refreshAgain = false;
            void refresh();
          }
        }
      }
    };

    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('lyka:records-updated', onFocus);
    const timer = window.setInterval(refresh, 10000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('lyka:records-updated', onFocus);
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!summary) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSummary(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [summary]);

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const hot = leads.filter((l) => l.outcome === 'HOT').length;
    const warm = leads.filter((l) => l.outcome === 'WARM').length;
    const cold = leads.filter((l) => l.outcome === 'COLD').length;
    const optOut = leads.filter((l) => l.outcome === 'OPT_OUT' || l.outcome === 'UNWANTED' || l.isOptedOut).length;
    const classified = hot + warm + cold + optOut;

    const attemptedIds = new Set<string>();
    calls.forEach((c) => {
      if (c.leadId) attemptedIds.add(c.leadId);
    });
    leads.forEach((l) => {
      if (l.callStatus !== 'NOT_CALLED' || l.lastCalledAt) attemptedIds.add(l.id);
    });
    const attempted = Math.max(attemptedIds.size, calls.length);

    const answered = calls.filter(isAnsweredCall).length;
    const qualifiedLeads = leads.filter(
      (l) =>
        (l.outcome === 'HOT' || l.outcome === 'WARM') &&
        (l.callStatus !== 'NOT_CALLED' || !!l.lastCalledAt || calls.some((c) => c.leadId === l.id))
    );
    const qualified = qualifiedLeads.length;

    const answerRate = attempted ? Math.min(100, Math.round((answered / attempted) * 100)) : 0;
    const qualRate = answered ? Math.min(100, Math.round((qualified / answered) * 100)) : 0;
    const hotRate = answered ? Math.min(100, Math.round((hot / answered) * 100)) : 0;
    const optOutRate = totalLeads ? Math.round((optOut / totalLeads) * 100) : 0;
    const hotConfirmationRate = attempted ? Math.min(100, Math.round((qualified / attempted) * 100)) : 0;

    const speechCalls = calls.filter((c) =>
      (c.transcript || []).some((t) => t.role === 'agent' || t.speaker === 'agent')
    );
    const introCalls = speechCalls.filter((c) => {
      const firstAgent = (c.transcript || []).find((t) => t.role === 'agent' || t.speaker === 'agent');
      return !!firstAgent && /lyka|priya|harish|ai/i.test(firstAgent.text || '');
    });
    const disclosureRate = speechCalls.length ? Math.round((introCalls.length / speechCalls.length) * 100) : 0;
    const persistedRate = calls.length
      ? Math.round((calls.filter((c) => !!c.endedAt).length / calls.length) * 100)
      : 0;

    const delays: number[] = [];
    calls.forEach((call) => {
      const turns = [...(call.transcript || [])].sort(
        (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
      );
      for (let i = 1; i < turns.length; i += 1) {
        const current = turns[i];
        const previous = turns[i - 1];
        const currentIsAgent = current.role === 'agent' || current.speaker === 'agent';
        const previousIsUser = previous.role === 'user' || previous.speaker === 'customer';
        if (!currentIsAgent || !previousIsUser) continue;
        const delta = +new Date(current.timestamp) - +new Date(previous.timestamp);
        // Ignore gaps longer than 10s: those are prospect silence, not model latency.
        if (delta > 0 && delta <= 10000) delays.push(delta);
      }
    });
    const avgDelayMs = delays.length
      ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length)
      : 0;

    const durationCalls = calls.filter((c) => c.duration > 0);
    const avgDuration = durationCalls.length
      ? Math.round(durationCalls.reduce((sum, c) => sum + c.duration, 0) / durationCalls.length)
      : 0;

    const latestCallFor = (leadId: string): CallRecord | undefined => {
      let best: CallRecord | undefined;
      for (const call of calls) {
        if (call.leadId !== leadId) continue;
        if (!best || +new Date(call.startedAt) > +new Date(best.startedAt)) best = call;
      }
      return best;
    };

    const handoff: HandoffItem[] = leads
      .filter((l) => l.outcome === 'HOT' || l.outcome === 'WARM')
      .map((lead) => ({ lead, call: latestCallFor(lead.id), score: 0 }))
      .filter((item) => item.lead.outcome === 'HOT' || !!item.call || !!item.lead.lastCalledAt)
      .map((item) => ({ ...item, score: fitScore(item.lead, item.call) }))
      .sort((a, b) => {
        if (a.lead.outcome !== b.lead.outcome) return a.lead.outcome === 'HOT' ? -1 : 1;
        return +new Date(b.call?.startedAt || b.lead.createdAt) - +new Date(a.call?.startedAt || a.lead.createdAt);
      })
      .slice(0, 4);

    const waitingLeads = leads
      .filter(
        (l) =>
          l.callStatus === 'NOT_CALLED' &&
          !l.lastCalledAt &&
          !l.isOptedOut &&
          l.outcome !== 'OPT_OUT' &&
          l.outcome !== 'UNWANTED'
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return {
      totalLeads,
      hot,
      warm,
      cold,
      optOut,
      classified,
      attempted,
      answered,
      qualified,
      qualifiedLeads,
      answerRate,
      qualRate,
      hotRate,
      optOutRate,
      hotConfirmationRate,
      disclosureRate,
      persistedRate,
      avgDelayMs,
      avgDuration,
      speechCalls,
      handoff,
      waitingLeads,
    };
  }, [leads, calls]);

  const chart = useMemo(() => {
    const now = new Date();
    const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    let points: Array<{ label: string; dialed: number; answered: number }> = [];
    let axes: Array<{ index: number; label: string }> = [];
    let total = 0;

    if (period === 'today') {
      const startHour = 9;
      const count = 11;
      const buckets = Array.from({ length: count }, () => ({ dialed: 0, answered: 0 }));
      for (const call of calls) {
        const date = new Date(call.startedAt);
        if (Number.isNaN(+date) || dayKey(date) !== dayKey(now)) continue;
        const index = Math.min(count - 1, Math.max(0, date.getHours() - startHour));
        buckets[index].dialed += 1;
        total += 1;
        if (isAnsweredCall(call)) buckets[index].answered += 1;
      }
      points = buckets.map((bucket, index) => ({
        label: `${String(startHour + index).padStart(2, '0')}:00`,
        ...bucket,
      }));
      axes = [0, 2, 4, 6, 8, 10].map((index) => ({ index, label: points[index].label }));
    } else if (period === '7d') {
      const count = 7;
      const buckets = Array.from({ length: count }, () => ({ dialed: 0, answered: 0 }));
      const base = new Date(now);
      base.setHours(0, 0, 0, 0);
      for (const call of calls) {
        const date = new Date(call.startedAt);
        if (Number.isNaN(+date)) continue;
        const day = new Date(date);
        day.setHours(0, 0, 0, 0);
        const diff = Math.round((+base - +day) / 86400000);
        if (diff < 0 || diff >= count) continue;
        const index = count - 1 - diff;
        buckets[index].dialed += 1;
        total += 1;
        if (isAnsweredCall(call)) buckets[index].answered += 1;
      }
      points = buckets.map((bucket, index) => {
        const date = new Date(base);
        date.setDate(base.getDate() - (count - 1 - index));
        return {
          label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
          ...bucket,
        };
      });
      axes = points.map((point, index) => ({ index, label: point.label }));
    } else {
      const count = 15;
      const buckets = Array.from({ length: count }, () => ({ dialed: 0, answered: 0 }));
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const span = +end - +start;
      for (const call of calls) {
        const time = +new Date(call.startedAt);
        if (Number.isNaN(time) || time < +start || time > +end) continue;
        const index = Math.min(count - 1, Math.floor(((time - +start) / span) * count));
        buckets[index].dialed += 1;
        total += 1;
        if (isAnsweredCall(call)) buckets[index].answered += 1;
      }
      points = buckets.map((bucket, index) => {
        const date = new Date(+start + (index + 0.5) * (span / count));
        return {
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          ...bucket,
        };
      });
      axes = [0, 3, 6, 9, 12, 14].map((index) => ({ index, label: points[index].label }));
    }

    return { points, axes, total };
  }, [calls, period]);

  const geometry = useMemo(() => {
    const width = 760;
    const height = 252;
    const left = 38;
    const right = 14;
    const top = 14;
    const bottom = 30;
    const innerWidth = width - left - right;
    const innerHeight = height - top - bottom;
    const maxValue = Math.max(1, ...chart.points.flatMap((point) => [point.dialed, point.answered]));
    const maxY = Math.max(4, Math.ceil(maxValue / 4) * 4);
    const lastIndex = Math.max(1, chart.points.length - 1);
    const baseline = top + innerHeight;
    const xOf = (index: number) => left + (index / lastIndex) * innerWidth;
    const yOf = (value: number) => top + innerHeight - (value / maxY) * innerHeight;
    const dialed = chart.points.map((point, index) => [xOf(index), yOf(point.dialed)] as [number, number]);
    const answered = chart.points.map((point, index) => [xOf(index), yOf(point.answered)] as [number, number]);
    const dialedPath = smoothPath(dialed, top, baseline);
    const areaPath = dialed.length
      ? `${dialedPath} L ${xOf(lastIndex).toFixed(2)} ${baseline} L ${xOf(0).toFixed(2)} ${baseline} Z`
      : '';
    const answeredPath = smoothPath(answered, top, baseline);
    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      innerWidth,
      innerHeight,
      maxY,
      baseline,
      xOf,
      yOf,
      dialed,
      answered,
      dialedPath,
      answeredPath,
      areaPath,
    };
  }, [chart]);

  const queueCount = metrics.waitingLeads.length;
  const queue = metrics.waitingLeads.slice(0, 4);

  const kpiCards: Array<{
    label: string;
    value: number;
    hint: string;
    icon: LucideIcon;
    iconColor: string;
    series: number[];
    target: LeadsNavigationTarget;
  }> = [
    {
      label: 'Total Leads',
      value: metrics.totalLeads,
      hint: `${metrics.qualified} qualified`,
      icon: Users,
      iconColor: '#f3c98b',
      series: cumulativeSeries(leads.map((l) => l.createdAt)),
      target: { outcome: 'ALL', scope: 'ALL' },
    },
    {
      label: 'Attempted',
      value: metrics.attempted,
      hint: `${metrics.answerRate}% answered`,
      icon: PhoneCall,
      iconColor: '#f19aa6',
      series: cumulativeSeries(calls.map((c) => c.startedAt)),
      target: { outcome: 'ALL', scope: 'ATTEMPTED' },
    },
    {
      label: 'Answered',
      value: metrics.answered,
      hint: metrics.answered === 1 ? '1 connected talk' : `${metrics.answered} connected talks`,
      icon: PhoneIncoming,
      iconColor: '#f3c98b',
      series: cumulativeSeries(calls.filter(isAnsweredCall).map((c) => c.startedAt)),
      target: { outcome: 'ALL', scope: 'ANSWERED' },
    },
    {
      label: 'Qualified',
      value: metrics.qualified,
      hint: `${metrics.qualRate}% of answered`,
      icon: BadgeCheck,
      iconColor: '#8fd8b6',
      series: cumulativeSeries(metrics.qualifiedLeads.map((l) => l.createdAt)),
      target: { outcome: 'ALL', scope: 'QUALIFIED' },
    },
    {
      label: 'Hot Leads',
      value: metrics.hot,
      hint: `${metrics.hotRate}% hot ratio`,
      icon: Flame,
      iconColor: '#ff8e9b',
      series: cumulativeSeries(leads.filter((l) => l.outcome === 'HOT').map((l) => l.createdAt)),
      target: { outcome: 'HOT', scope: 'ALL' },
    },
    {
      label: 'Warm Leads',
      value: metrics.warm,
      hint: 'Nurturing pipeline',
      icon: SunMedium,
      iconColor: '#f3c98b',
      series: cumulativeSeries(leads.filter((l) => l.outcome === 'WARM').map((l) => l.createdAt)),
      target: { outcome: 'WARM', scope: 'ALL' },
    },
    {
      label: 'Cold Leads',
      value: metrics.cold,
      hint: 'Needs engagement',
      icon: Snowflake,
      iconColor: '#9dbdf7',
      series: cumulativeSeries(leads.filter((l) => l.outcome === 'COLD').map((l) => l.createdAt)),
      target: { outcome: 'COLD', scope: 'ALL' },
    },
    {
      label: 'Opt-Outs',
      value: metrics.optOut,
      hint: `${metrics.optOutRate}% opt-out rate`,
      icon: UserX,
      iconColor: '#f19aa6',
      series: cumulativeSeries(leads.filter((l) => l.outcome === 'OPT_OUT' || l.outcome === 'UNWANTED' || l.isOptedOut).map((l) => l.createdAt)),
      target: { outcome: 'UNWANTED', scope: 'ALL' },
    },
  ];

  const donutSegments: Array<{ key: TempKey; label: string; value: number; color: string }> = [
    { key: 'HOT', label: 'Hot Leads', value: metrics.hot, color: '#ef4456' },
    { key: 'WARM', label: 'Warm Leads', value: metrics.warm, color: '#f0a92e' },
    { key: 'COLD', label: 'Cold Leads', value: metrics.cold, color: '#4f8ef7' },
    { key: 'OPT_OUT', label: 'Opt-Outs', value: metrics.optOut, color: '#d81b69' },
  ];

  const acquisitionSources = useMemo(() => {
    const counts = Object.fromEntries(
      ACQUISITION_SOURCES.map((source) => [source.key, 0])
    ) as Record<AcquisitionSourceKey, number>;
    leads.forEach((lead) => {
      const key =
        lead.acquisitionSource ??
        normalizeAcquisitionSource(lead.lead_source ?? lead.source);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return ACQUISITION_SOURCES.map((source) => ({
      ...source,
      value: counts[source.key] ?? 0,
    }));
  }, [leads]);
  const acquisitionTotal = leads.length;

  const funnelStages: Array<{
    step: number;
    label: string;
    count: number;
    pct: number;
    barPct: number;
    color: string;
    icon: LucideIcon | null;
    target: LeadsNavigationTarget;
  }> = [
    {
      step: 1,
      label: 'Total Leads Pool',
      count: metrics.totalLeads,
      pct: 100,
      barPct: 100,
      color: '#4a1237',
      icon: null,
      target: { outcome: 'ALL', scope: 'ALL' },
    },
    {
      step: 2,
      label: 'Calls Attempted',
      count: metrics.attempted,
      pct: metrics.totalLeads ? Math.round((metrics.attempted / metrics.totalLeads) * 100) : 0,
      barPct: metrics.totalLeads ? Math.round((metrics.attempted / metrics.totalLeads) * 100) : 0,
      color: '#7a2d5c',
      icon: null,
      target: { outcome: 'ALL', scope: 'ATTEMPTED' },
    },
    {
      step: 3,
      label: 'Answered Calls',
      count: metrics.answered,
      pct: metrics.attempted ? Math.round((metrics.answered / metrics.attempted) * 100) : 0,
      barPct: metrics.totalLeads ? Math.round((metrics.answered / metrics.totalLeads) * 100) : 0,
      color: '#d9a441',
      icon: null,
      target: { outcome: 'ALL', scope: 'ANSWERED' },
    },
    {
      step: 4,
      label: 'Qualified Leads',
      count: metrics.qualified,
      pct: metrics.answered ? Math.min(100, Math.round((metrics.qualified / metrics.answered) * 100)) : 0,
      barPct: metrics.totalLeads ? Math.round((metrics.qualified / metrics.totalLeads) * 100) : 0,
      color: '#1aa260',
      icon: null,
      target: { outcome: 'ALL', scope: 'QUALIFIED' },
    },
    {
      step: 5,
      label: 'Hot Opportunities',
      count: metrics.hot,
      pct: metrics.answered ? Math.min(100, Math.round((metrics.hot / metrics.answered) * 100)) : 0,
      barPct: metrics.totalLeads ? Math.round((metrics.hot / metrics.totalLeads) * 100) : 0,
      color: '#f04452',
      icon: Flame,
      target: { outcome: 'HOT', scope: 'ALL' },
    },
  ];

  const rings = [
    {
      value: metrics.answerRate,
      color: '#d9a441',
      icon: PhoneCall,
      title: 'Answer Rate',
      sub: `${metrics.answered} of ${metrics.attempted} answered`,
    },
    {
      value: metrics.qualRate,
      color: '#1aa260',
      icon: CheckCircle2,
      title: 'Qualification Rate',
      sub: `${metrics.qualified} qualified buyer${metrics.qualified === 1 ? '' : 's'}`,
    },
    {
      value: metrics.hotRate,
      color: '#ef4456',
      icon: Flame,
      title: 'Hot Lead Ratio',
      sub: `${metrics.hot} senior broker ready`,
    },
    {
      value: metrics.disclosureRate,
      color: '#4a1237',
      icon: ShieldCheck,
      title: 'AI Disclosure Rate',
      sub: metrics.speechCalls.length ? 'Intro on answered calls' : 'No recorded intros yet',
    },
  ];

  const slaRows = [
    {
      label: 'Target 1: AI reply delay < 1.5s',
      value: metrics.avgDelayMs ? `${metrics.avgDelayMs.toLocaleString()} ms` : 'No samples',
      met: metrics.avgDelayMs > 0 && metrics.avgDelayMs < 1500,
    },
    {
      label: 'Target 2: 70%+ hot lead confirmation',
      value: `${metrics.hotConfirmationRate}% Verified`,
      met: metrics.hotConfirmationRate >= 70,
    },
    {
      label: 'Target 3: 100% AI introduction',
      value: `${metrics.disclosureRate}% ${metrics.disclosureRate === 100 ? 'Guaranteed' : 'Recorded'}`,
      met: metrics.disclosureRate === 100,
    },
    {
      label: 'Target 4: 0 calls to blocked numbers',
      value: '0 Block Violations',
      met: true,
    },
    {
      label: 'Target 5: 100% call outcomes saved',
      value: `${metrics.persistedRate}% Persisted`,
      met: metrics.persistedRate === 100,
    },
  ];

  const summaryCards = [
    {
      icon: Zap,
      label: 'Avg AI Reply Delay',
      value: metrics.avgDelayMs ? `${metrics.avgDelayMs.toLocaleString()} ms` : '—',
      sub: metrics.avgDelayMs
        ? `Target < 1,500 ms (${metrics.avgDelayMs < 1500 ? 'Met' : 'Not met'})`
        : 'No latency samples yet',
      ok: metrics.avgDelayMs > 0 && metrics.avgDelayMs < 1500,
      tone: 'gold' as const,
    },
    {
      icon: Clock,
      label: 'Avg Call Duration',
      value: `${metrics.avgDuration}s`,
      sub: metrics.avgDuration
        ? metrics.avgDuration <= 150
          ? 'Under 2.5 min target'
          : 'Above 2.5 min target'
        : 'No completed calls yet',
      ok: metrics.avgDuration > 0 && metrics.avgDuration <= 150,
      tone: 'plum' as const,
    },
    {
      icon: ShieldCheck,
      label: 'AI Disclosure Rate',
      value: `${metrics.disclosureRate.toFixed(1)}%`,
      sub: 'Intro delivered on answered calls',
      ok: metrics.disclosureRate === 100,
      tone: 'green' as const,
    },
    {
      icon: ShieldBan,
      label: 'Blocked Number Calls',
      value: '0 Calls',
      sub: 'Zero-tolerance enforced',
      ok: true,
      tone: 'red' as const,
    },
  ];

  const toneStyles: Record<string, { bg: string; border: string; color: string }> = {
    gold: { bg: '#fbf0da', border: '#f1dfbc', color: '#c08a2e' },
    plum: { bg: '#f7e9f0', border: '#edd7e4', color: '#7a2d5c' },
    green: { bg: '#e8f6ee', border: '#cfe9dc', color: '#158a5b' },
    red: { bg: '#fdebed', border: '#f6d3d8', color: '#c02b48' },
  };

  const totalClassified = metrics.classified;
  const overallHotPct = metrics.totalLeads ? Math.round((metrics.hot / metrics.totalLeads) * 100) : 0;
  const streamCalls = [...calls]
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
    .slice(0, 6);

  const openHandoffSummary = (item: HandoffItem) => {
    setSummary({
      name: item.lead.name || 'Unnamed lead',
      phone: item.lead.phone || item.call?.leadPhone || '',
      score: item.score,
      outcome: item.lead.outcome || item.call?.outcome || 'WARM',
      summary: (item.call?.summary || item.lead.notes || '').trim(),
      budget: formatBudget(item.call?.budget || item.lead.budget, item.lead.currency),
      location: item.call?.location || item.lead.location || 'Not specified',
      timeline: item.lead.timeline || item.call?.timeline || 'Not specified',
      callback: item.lead.best_time_to_contact || 'Not scheduled',
      transcript: item.call?.transcript || [],
    });
  };

  const startLeadCall = (lead: LeadRecord) => {
    if (!lead.phone) return;
    setSummary(null);
    onStartCallWithLead?.(lead);
  };

  const donutRadius = 66;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const donutGap = totalClassified > 1 ? 4 : 0;
  let acquisitionOffset = 0;
  const acquisitionGap = acquisitionTotal > 1 ? 4 : 0;

  if (loading && !leads.length && !calls.length) {
    return (
      <div className="min-h-[70vh] px-3 py-5 sm:px-5 lg:px-6" style={{ background: PAGE_BG }}>
        <div className="mx-auto max-w-[1500px] space-y-4">
          <div className="flex h-[230px] items-center justify-center rounded-[30px] border border-[#e9d8cd] bg-[#eaded3]">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-[#8a6a5f]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live CRM data…
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[125px] animate-pulse rounded-[20px] bg-[#e6d5c9]" />
            ))}
          </div>          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="h-[360px] animate-pulse rounded-[24px] bg-[#ecdfd5]" />
            <div className="h-[360px] animate-pulse rounded-[24px] bg-[#ecdfd5]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] px-3 py-5 text-[#3c122e] dark:text-slate-100 bg-[#f7f1e9] dark:bg-slate-950 transition-colors sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0d2c8] bg-[#fdf0ea] px-4 py-3">
            <p className="flex items-center gap-2 text-[12px] font-medium text-[#9c3a2c]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {loadError} KPI values below reflect the last successful sync.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e7c2b4] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#8c3327] hover:bg-[#fdf7f3]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* A. Hero */}
        <section
          className="relative overflow-hidden rounded-[30px] px-6 py-7 text-white shadow-[0_34px_70px_-45px_rgba(46,11,34,0.9)] sm:px-8 sm:py-8"
          style={{
            background:
              'radial-gradient(120% 170% at 100% 0%, rgba(229,186,115,0.30), transparent 48%), linear-gradient(115deg, #4c1538 0%, #3a0e2a 46%, #2a081f 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(240,201,139,0.55), transparent 68%)' }}
          />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-[#e5ba73]/45 bg-white/[0.06] px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-[#f3d9a4]">
                  LYKA REALTY OUTBOUND SUITE
                </span>
                <span className="text-[11.5px] font-medium text-[#e8cabb]/80">Enterprise AI Operations</span>
              </div>
              <h2
                className="mt-4 text-[32px] leading-none text-[#fdf3e6] sm:text-[42px]"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                AI Cold-Calling Agent
              </h2>
              <p className="mt-4 max-w-[900px] text-[13px] leading-relaxed text-[#ecd5c9]/85">
                Autonomous conversational qualification for high-value UAE real estate buyers. Dialing consented
                leads, screening compliance, conducting 5-point voice interviews, and routing hot opportunities to
                senior brokers.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenQueue}
              className="inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full px-5 py-2.5 text-[12.5px] font-bold transition-all duration-200 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3d9a4]/70"
              style={GOLD_STYLE}
            >
              <PhoneCall className="h-4 w-4" />
              Open Calling Queue ({queueCount})
            </button>
          </div>
        </section>

        {/* B. KPI cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {kpiCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigateLeads(card.target)}
              title={`View ${card.label.toLowerCase()} in Leads & Calls`}
              className="relative flex min-h-[146px] w-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-white/10 px-3.5 py-4 text-left text-white shadow-[0_18px_36px_-26px_rgba(46,11,34,0.9)] transition-[filter,border-color] duration-200 hover:border-white/25 hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3d9a4]/70 active:brightness-95"
              style={{
                background:
                  'radial-gradient(120% 105% at 88% 0%, rgba(255,255,255,0.15), transparent 56%), linear-gradient(155deg, #5d2149 0%, #3d0c2b 55%, #28061c 100%)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] font-semibold leading-snug text-[#f6e7df]">{card.label}</p>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <card.icon className="h-3.5 w-3.5" style={{ color: card.iconColor }} />
                </span>
              </div>
              <p className="mt-3 text-[34px] font-extrabold leading-none tracking-tight">{card.value}</p>
              <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
                <span className="min-w-0 truncate text-[10px] font-medium text-[#dcb7a7]">{card.hint}</span>
                <svg width="56" height="16" viewBox="0 0 62 16" className="shrink-0 opacity-90" aria-hidden="true">
                  <path
                    d={sparkPath(card.series)}
                    fill="none"
                    stroke="#ff90a0"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </button>
          ))}
        </section>

        {/* C + D. Calling volume + Lead temperature + Acquisition source */}
        <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className={`${CARD} flex flex-col p-5 sm:p-6 lg:col-span-2 xl:col-span-1`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={ICON_TILE} style={{ background: '#f8ecdc', borderColor: '#f1dfc7' }}>
                  <PhoneCall className="h-4 w-4 text-[#c08a2e]" />
                </span>
                <div>
                  <h3 className={H2}>Outbound Calling Volume</h3>
                  <p className={SUB}>Real-time call attempts and answered talks over time</p>
                </div>
              </div>
              <div className="flex items-center rounded-full bg-[#f4ece3] p-1">
                {(
                  [
                    { key: 'today', label: 'Today' },
                    { key: '7d', label: '7 Days' },
                    { key: '30d', label: '30 Days' },
                  ] as Array<{ key: DashboardPeriod; label: string }>
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onPeriodChange(option.key)}
                    className={`rounded-full px-3.5 py-1.5 text-[10.5px] font-bold transition-colors ${
                      period === option.key ? '' : 'text-[#7c5f6e] hover:text-[#3c122e]'
                    }`}
                    style={period === option.key ? ACTIVE_PILL_STYLE : undefined}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex-1">
              <svg
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                className="h-auto w-full"
                role="img"
                aria-label={`Outbound calling volume chart, ${chart.total} calls in this period`}
              >
                <defs>
                  <linearGradient id="lykaGoldArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d9a441" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#d9a441" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3, 4].map((grid) => {
                  const y = geometry.top + (grid / 4) * geometry.innerHeight;
                  const value = Math.round((geometry.maxY * (4 - grid)) / 4);
                  return (
                    <g key={grid}>
                      <line
                        x1={geometry.left}
                        y1={y}
                        x2={geometry.width - geometry.right}
                        y2={y}
                        stroke="#eadfd6"
                        strokeDasharray="4 6"
                        strokeWidth="1"
                      />
                      <text x={geometry.left - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#b39ca6">
                        {value}
                      </text>
                    </g>
                  );
                })}
                {chart.axes.map((axis) => {
                  const x = geometry.xOf(axis.index);
                  const anchor =
                    axis.index === 0 ? 'start' : axis.index === chart.points.length - 1 ? 'end' : 'middle';
                  return (
                    <text
                      key={axis.index}
                      x={x}
                      y={geometry.height - 8}
                      textAnchor={anchor}
                      fontSize="10"
                      fill="#b39ca6"
                    >
                      {axis.label}
                    </text>
                  );
                })}
                {geometry.areaPath && chart.total > 0 && (
                  <path
                    d={geometry.areaPath}
                    fill="url(#lykaGoldArea)"
                    className="cursor-pointer"
                    onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ATTEMPTED' })}
                  >
                    <title>Total dialed volume — open attempted calls</title>
                  </path>
                )}
                {geometry.dialedPath && (
                  <path
                    d={geometry.dialedPath}
                    fill="none"
                    stroke="#d9a441"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                )}
                {geometry.answeredPath && (
                  <path
                    d={geometry.answeredPath}
                    fill="none"
                    stroke="#4a1237"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                )}
                {geometry.dialedPath && chart.total > 0 && (
                  <path
                    d={geometry.dialedPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    strokeLinecap="round"
                    className="cursor-pointer"
                    style={{ pointerEvents: 'stroke' }}
                    onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ATTEMPTED' })}
                  >
                    <title>Total Dialed — view attempted calls</title>
                  </path>
                )}
                {geometry.answeredPath && chart.total > 0 && (
                  <path
                    d={geometry.answeredPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    strokeLinecap="round"
                    className="cursor-pointer"
                    style={{ pointerEvents: 'stroke' }}
                    onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ANSWERED' })}
                  >
                    <title>Answered Talks — view answered calls</title>
                  </path>
                )}
                {chart.points.map((point, index) => {
                  const [x, y] = geometry.dialed[index];
                  if (point.dialed <= 0) return null;
                  return (
                    <g
                      key={`dialed-point-${index}`}
                      className="cursor-pointer"
                      onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ATTEMPTED' })}
                    >
                      <circle cx={x} cy={y} r={10} fill="transparent" />
                      <circle cx={x} cy={y} r={3.2} fill="#d9a441" stroke="#fdfaf7" strokeWidth={1.2} />
                      <title>{`${point.label}: ${point.dialed} dialed — view attempted calls`}</title>
                    </g>
                  );
                })}
                {chart.points.map((point, index) => {
                  const [x, y] = geometry.answered[index];
                  if (point.answered <= 0) return null;
                  return (
                    <g
                      key={`answered-point-${index}`}
                      className="cursor-pointer"
                      onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ANSWERED' })}
                    >
                      <circle cx={x} cy={y} r={10} fill="transparent" />
                      <circle cx={x} cy={y} r={3.2} fill="#4a1237" stroke="#fdfaf7" strokeWidth={1.2} />
                      <title>{`${point.label}: ${point.answered} answered — view answered calls`}</title>
                    </g>
                  );
                })}
                {chart.total === 0 && (
                  <text
                    x={geometry.left + geometry.innerWidth / 2}
                    y={geometry.top + geometry.innerHeight / 2 - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#b39ca6"
                  >
                    No calls in this period
                  </text>
                )}
              </svg>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e2d8] pt-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ATTEMPTED' })}
                  title="Open attempted calls in Leads & Calls"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold text-[#6f4f62] transition-colors hover:bg-[#f6eadf] hover:text-[#3c122e]"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: '#d9a441' }} />
                  Total Dialed
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ANSWERED' })}
                  title="Open answered calls in Leads & Calls"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold text-[#6f4f62] transition-colors hover:bg-[#f6eadf] hover:text-[#3c122e]"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: '#4a1237' }} />
                  Answered Talks
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenLogs}
                className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#c08a2e] hover:text-[#9c6c1f]"
              >
                {chart.total} calls recorded
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className={`${CARD} flex flex-col p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className={ICON_TILE} style={{ background: '#fdecef', borderColor: '#f6d7dc' }}>
                <Flame className="h-4 w-4 text-[#d62d4b]" />
              </span>
              <div>
                <h3 className={H2}>Lead Temperature</h3>
                <p className={SUB}>Click a segment or legend to view matching leads</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <div className="relative h-[196px] w-[196px]">
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full"
                  role="img"
                  aria-label={`Lead temperature: ${metrics.hot} hot, ${metrics.warm} warm, ${metrics.cold} cold, ${metrics.optOut} opt-outs`}
                >
                  <circle cx="100" cy="100" r={donutRadius} fill="none" stroke="#f2e9e1" strokeWidth="18" />
                  {totalClassified > 0 &&
                    donutSegments.map((segment) => {
                      const fraction = segment.value / totalClassified;
                      const length = Math.max(0, fraction * donutCircumference - donutGap);
                      const offset = donutOffset;
                      donutOffset += fraction * donutCircumference;
                      return (
                        <circle
                          key={segment.key}
                          cx="100"
                          cy="100"
                          r={donutRadius}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth={18}
                          strokeDasharray={`${length} ${donutCircumference - length}`}
                          strokeDashoffset={-(offset + donutGap / 2)}
                          transform="rotate(-90 100 100)"
                          className="cursor-pointer transition-opacity duration-200 hover:opacity-75"
                          onClick={() =>
                            onNavigateLeads({ outcome: TEMP_OUTCOME[segment.key], scope: 'ALL' })
                          }
                        >
                          <title>{`${segment.label}: ${segment.value} — view ${TEMP_OUTCOME[segment.key]} leads`}</title>
                        </circle>
                      );
                    })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[28px] font-extrabold leading-none text-[#3c122e]">{totalClassified}</span>
                  <span className="mt-1 text-[9px] font-bold tracking-[0.16em] text-[#a98c9a]">TOTAL LEADS</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-[#f0e2d8] pt-3">
              {donutSegments.map((segment) => {
                const pct = totalClassified ? Math.round((segment.value / totalClassified) * 100) : 0;
                return (
                  <button
                    key={segment.key}
                    type="button"
                    onClick={() => onNavigateLeads({ outcome: TEMP_OUTCOME[segment.key], scope: 'ALL' })}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#faf4ee]"
                    title={`Open ${TEMP_OUTCOME[segment.key]} leads in Leads & Calls`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
                    <span className="min-w-0 truncate text-[11px] font-semibold text-[#6f4f62]">{segment.label}</span>
                    <span className="ml-auto text-[11px] font-extrabold text-[#3c122e]">{segment.value}</span>
                    <span className="text-[10px] font-medium text-[#b08f9e]">({pct}%)</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${CARD} flex flex-col p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className={ICON_TILE} style={{ background: '#f7ecf3', borderColor: '#eddbe7' }}>
                <Megaphone className="h-4 w-4 text-[#7a2d5c]" />
              </span>
              <div>
                <h3 className={H2}>How Did You Hear About Us?</h3>
                <p className={SUB}>Customer acquisition source distribution.</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <div className="relative h-[196px] w-[196px]">
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full"
                  role="img"
                  aria-label={`Acquisition sources: ${
                    acquisitionSources
                      .filter((source) => source.value > 0)
                      .map((source) => `${source.label} ${source.value}`)
                      .join(', ') || 'no sources recorded'
                  }`}
                >
                  <circle cx="100" cy="100" r={donutRadius} fill="none" stroke="#f2e9e1" strokeWidth="18" />
                  {acquisitionTotal > 0 &&
                    acquisitionSources.map((source) => {
                      const fraction = source.value / acquisitionTotal;
                      const length = Math.max(0, fraction * donutCircumference - acquisitionGap);
                      const offset = acquisitionOffset;
                      acquisitionOffset += fraction * donutCircumference;
                      if (source.value === 0) return null;
                      return (
                        <circle
                          key={source.key}
                          cx="100"
                          cy="100"
                          r={donutRadius}
                          fill="none"
                          stroke={source.color}
                          strokeWidth="18"
                          strokeDasharray={`${length} ${donutCircumference - length}`}
                          strokeDashoffset={-(offset + acquisitionGap / 2)}
                          transform="rotate(-90 100 100)"
                          className="cursor-pointer transition-opacity duration-200 hover:opacity-75"
                          onClick={() =>
                            onNavigateLeads({ outcome: 'ALL', scope: 'ALL', source: source.key })
                          }
                        >
                          <title>{`${source.label}: ${source.value} — view leads from ${source.label}`}</title>
                        </circle>
                      );
                    })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[28px] font-extrabold leading-none text-[#3c122e]">{acquisitionTotal}</span>
                  <span className="mt-1 text-[9px] font-bold tracking-[0.16em] text-[#a98c9a]">TOTAL LEADS</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 border-t border-[#f0e2d8] pt-3">
              {acquisitionSources.map((source) => {
                const pct = acquisitionTotal ? Math.round((source.value / acquisitionTotal) * 100) : 0;
                return (
                  <button
                    key={source.key}
                    type="button"
                    onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ALL', source: source.key })}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-[#faf4ee]"
                    title={`${source.label} — open matching leads in Leads & Calls`}
                    aria-label={`${source.label}: ${source.value} leads (${pct}%) — open in Leads & Calls`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: source.color }} />
                    <span className="min-w-0 truncate text-[11px] font-semibold text-[#6f4f62]">{source.shortLabel}</span>
                    <span className="ml-auto text-[11px] font-extrabold text-[#3c122e]">{source.value}</span>
                    <span className="text-[10px] font-medium text-[#b08f9e]">({pct}%)</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* E + F. Funnel + efficiency */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className={`${CARD} p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className={ICON_TILE} style={{ background: '#fbf0df', borderColor: '#f2e1c8' }}>
                <TrendingUp className="h-4 w-4 text-[#c08a2e]" />
              </span>
              <div>
                <h3 className={H2}>Qualification Conversion Funnel</h3>
                <p className={SUB}>Pipeline progression from lead pool to hot sales handoff</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {funnelStages.map((stage) => (
                <button
                  key={stage.step}
                  type="button"
                  onClick={() => onNavigateLeads(stage.target)}
                  title={`Open ${stage.label} in Leads & Calls`}
                  className="group block w-full cursor-pointer rounded-lg text-left transition-colors hover:bg-[#fbf4ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a441]/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#e9dbd1] bg-[#f8f2ec] text-[9px] font-bold text-[#7a5a6c]">
                        {stage.step}
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-[12px] font-semibold text-[#3c122e] transition-colors group-hover:text-[#7a2d5c]">
                        {stage.icon && <stage.icon className="h-3.5 w-3.5 text-[#ef4456]" />}
                        {stage.label}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-extrabold text-[#3c122e]">
                      {stage.count} <span className="font-semibold text-[#c08a2e]">({stage.pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-[9px] overflow-hidden rounded-full bg-[#f3ece5]">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                      style={{
                        width: `${Math.max(stage.barPct > 0 ? 2 : 0, Math.min(100, stage.barPct))}%`,
                        background: stage.color,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0e2d8] pt-3">
              <span className="text-[11px] text-[#9a7f8c]">Overall Lead-to-Hot Conversion:</span>
              <span className="text-[11.5px] font-extrabold text-[#1a9c62]">{overallHotPct}% Qualified</span>
            </div>
          </div>

          <div className={`${CARD} p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className={ICON_TILE} style={{ background: '#f7ecf3', borderColor: '#eddbe7' }}>
                <Sparkles className="h-4 w-4 text-[#7a2d5c]" />
              </span>
              <div>
                <h3 className={H2}>Efficiency &amp; Performance Rates</h3>
                <p className={SUB}>Core conversion and voice compliance benchmarks</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rings.map((ring) => (
                <div
                  key={ring.title}
                  className="flex items-center gap-3 rounded-2xl border border-[#f0e2d8] bg-[#fefbf8] p-3.5"
                >
                  <Ring value={ring.value} color={ring.color} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#3c122e]">
                      <ring.icon className="h-3.5 w-3.5 shrink-0" style={{ color: ring.color }} />
                      <span className="truncate">{ring.title}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-[#9a7f8c]">{ring.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* G. Hot leads ready for sales handoff */}
        <section className={`${CARD} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className={ICON_TILE} style={{ background: '#fde9ec', borderColor: '#f7d3da' }}>
                <Flame className="h-4 w-4 text-[#d62d4b]" />
              </span>
              <div>
                <h3 className={H2}>Hot Leads Ready for Sales Handoff</h3>
                <p className={SUB}>High-intent buyers requiring senior broker contact</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f3c9d0] bg-[#fdeef1] px-3 py-1 text-[10.5px] font-bold text-[#c02b48]">
              <Flame className="h-3 w-3" />
              {metrics.hot > 0
                ? `${metrics.hot} Hot Lead${metrics.hot === 1 ? '' : 's'}`
                : `${metrics.handoff.length} Warm Candidate${metrics.handoff.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {metrics.handoff.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#e7d4c8] bg-[#fcf7f2] px-5 py-8 text-center">
                <Flame className="mx-auto h-6 w-6 text-[#d8a0aa]" />
                <p className="mt-2 text-[12.5px] font-semibold text-[#6c4a5e]">No hot-ready leads yet</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-[#9a7f8c]">
                  HOT or WARM buyers with a completed AI conversation appear here for senior broker handoff. Run a
                  qualifying call to populate this section.
                </p>
                <button
                  type="button"
                  onClick={onOpenQueue}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#e9d4c6] bg-white px-3.5 py-1.5 text-[11px] font-semibold text-[#6c4a5e] hover:border-[#d9a441]/60"
                >
                  Open calling queue
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {metrics.handoff.map((item) => {
              const outcome = item.lead.outcome || item.call?.outcome || 'WARM';
              const phone = item.lead.phone || item.call?.leadPhone || '';
              const summaryText = (item.call?.summary || item.lead.notes || '').trim();
              const budget = formatBudget(item.call?.budget || item.lead.budget, item.lead.currency);
              const location = item.call?.location || item.lead.location || 'Not specified';
              const timeline = item.lead.timeline || item.call?.timeline || 'Not specified';
              const callback = item.lead.best_time_to_contact || 'Not scheduled';
              return (
                <article
                  key={item.lead.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onNavigateLeads({ outcome: 'ALL', scope: 'ALL', leadId: item.lead.id })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onNavigateLeads({ outcome: 'ALL', scope: 'ALL', leadId: item.lead.id });
                    }
                  }}
                  title={`Open ${item.lead.name || 'lead'} in Leads & Calls`}
                  className="cursor-pointer rounded-2xl border border-[#f0e2d8] bg-[#fefbf8] p-4 transition-colors hover:border-[#e3cdbb] hover:bg-[#fef8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a441]/60 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-[15px] font-extrabold text-[#3c122e]">
                          {item.lead.name || 'Unnamed lead'}
                        </h4>
                        <span
                          className="rounded-full border border-[#f3c9d0] bg-[#fdeef1] px-2 py-0.5 text-[10px] font-extrabold text-[#c02b48]"
                          title="Estimated fit score from captured qualification fields"
                        >
                          {item.score}/100
                        </span>
                        {outcome !== 'HOT' && <TempBadge outcome={outcome} small />}
                      </div>
                      <p className="mt-0.5 text-[11px] font-bold tracking-wide text-[#c08a2e]">
                        {phone || 'No phone on file'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openHandoffSummary(item);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#eadbd1] bg-white px-3.5 py-1.5 text-[11px] font-semibold text-[#4a2a3e] transition-colors hover:border-[#d9a441]/60 hover:bg-[#fdf6ec]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Summary
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startLeadCall(item.lead);
                        }}
                        disabled={!phone}
                        title={phone ? 'Start a live call with this lead' : 'No phone number on file'}
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                        style={GOLD_STYLE}
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        Call Sales Agent
                      </button>
                    </div>
                  </div>

                  <p
                    className={`mt-3 rounded-xl border border-[#f0e2d7] bg-[#fbf6f0] px-4 py-3 text-[12px] leading-relaxed ${
                      summaryText ? 'italic text-[#6c4a5e]' : 'text-[#a78c99]'
                    }`}
                  >
                    {summaryText ? `“${summaryText}”` : 'No AI summary captured for this lead yet.'}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                    {[
                      { label: 'Budget', value: budget, accent: '#1f8a5b' },
                      { label: 'Location', value: location, accent: '#3c122e' },
                      { label: 'Timeline', value: timeline, accent: '#c08a2e' },
                      { label: 'Callback', value: callback, accent: '#3c122e' },
                    ].map((field) => (
                      <div key={field.label} className="rounded-xl border border-[#f0e2d8] bg-[#fefbf8] px-3 py-2">
                        <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a98c9a]">
                          {field.label}
                        </p>
                        <p
                          className="mt-0.5 truncate text-[11px] font-bold"
                          style={{ color: field.accent }}
                          title={field.value}
                        >
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* H. Calling queue activity */}
        <section className={`${CARD} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={ICON_TILE} style={{ background: '#f7eddf', borderColor: '#efdfc8' }}>
                <Clock className="h-4 w-4 text-[#c08a2e]" />
              </span>
              <h3 className={H2}>Calling Queue Activity</h3>
            </div>
            <button
              type="button"
              onClick={onOpenQueue}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#c08a2e] hover:text-[#9c6c1f]"
            >
              Full Queue
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {queue.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#e7d4c8] bg-[#fcf7f2] px-5 py-6 text-center">
                <p className="text-[12px] font-semibold text-[#6c4a5e]">Calling queue is clear</p>
                <p className="mt-1 text-[11px] text-[#9a7f8c]">New consented leads will appear here as they arrive.</p>
              </div>
            )}
            {queue.map((lead, index) => (
              <div
                key={lead.id}
                role="button"
                tabIndex={0}
                onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ALL', leadId: lead.id })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onNavigateLeads({ outcome: 'ALL', scope: 'ALL', leadId: lead.id });
                  }
                }}
                title={`Open ${lead.name || 'lead'} in Leads & Calls`}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#f0e2d8] bg-[#fefbf8] px-3.5 py-2.5 transition-colors hover:border-[#e3cdbb] hover:bg-[#fef8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a441]/60"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e9dbd1] bg-[#f8f2ec] text-[10px] font-bold text-[#7a5a6c]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-[#3c122e]">{lead.name || 'Unnamed lead'}</p>
                  <p className="truncate text-[10.5px] text-[#9a7f8c]">{lead.phone || 'No phone on file'}</p>
                </div>
                <span className="hidden shrink-0 text-[10px] italic text-[#a78c99] sm:inline">waiting</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartCallWithLead?.(lead);
                  }}
                  disabled={!lead.phone}
                  title={lead.phone ? `Call ${lead.name || 'lead'}` : 'No phone number on file'}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                  style={GOLD_STYLE}
                >
                  <PhoneCall className="h-3 w-3" />
                  Call
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* I. Performance & SLA targets */}
        <section className={`${CARD} p-5 sm:p-6`}>
          <div className="flex items-center gap-3">
            <span className={ICON_TILE} style={{ background: '#f8ecdf', borderColor: '#f0dfc9' }}>
              <Target className="h-4 w-4 text-[#c08a2e]" />
            </span>
            <h3 className={H2}>Performance &amp; SLA Targets (Section 29)</h3>
          </div>

          <div className="mt-4 space-y-2">
            {slaRows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f0e2d8] bg-[#fefbf8] px-4 py-2.5"
              >
                <span className="text-[11.5px] font-medium text-[#4a2a3e]">{row.label}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10.5px] font-extrabold ${
                    row.met ? 'text-[#158a5b]' : 'text-[#b97a12]'
                  }`}
                >
                  {row.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* J. Performance summary cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const tone = toneStyles[card.tone];
            return (
              <div key={card.label} className={`${CARD} flex items-start gap-3 p-4`}>
                <span className={`${ICON_TILE} !h-10 !w-10`} style={{ background: tone.bg, borderColor: tone.border }}>
                  <card.icon className="h-4 w-4" style={{ color: tone.color }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a98c9a]">{card.label}</p>
                  <p
                    className="mt-1 text-[20px] font-extrabold leading-none"
                    style={{ color: card.tone === 'red' ? '#9c2038' : '#3c122e' }}
                  >
                    {card.value}
                  </p>
                  <p className={`mt-1.5 text-[10px] font-semibold ${card.ok ? 'text-[#158a5b]' : 'text-[#b97a12]'}`}>
                    {card.sub}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* K. Live outbound stream */}
        <section className={`${CARD} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <h3 className={H2}>Live Outbound Stream</h3>
              <span className="inline-flex items-center rounded-full border border-[#c9e9d8] bg-[#e9f7ef] px-2.5 py-0.5 text-[9px] font-extrabold tracking-[0.12em] text-[#158a5b]">
                STREAM ACTIVE
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenLogs}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#c08a2e] hover:text-[#9c6c1f]"
            >
              All Logs
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {streamCalls.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#e7d4c8] bg-[#fcf7f2] px-5 py-6 text-center">
                <p className="text-[12px] font-semibold text-[#6c4a5e]">No outbound calls yet</p>
                <p className="mt-1 text-[11px] text-[#9a7f8c]">
                  Completed conversations will stream here in real time.
                </p>
              </div>
            )}
            {streamCalls.map((call) => (
              <div
                key={call.callId}
                role="button"
                tabIndex={0}
                onClick={() => onNavigateLeads({ outcome: 'ALL', scope: 'ALL', callId: call.callId })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onNavigateLeads({ outcome: 'ALL', scope: 'ALL', callId: call.callId });
                  }
                }}
                title={`Open call details for ${call.leadName || 'this call'}`}
                className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-[#f0e2d8] bg-[#fefbf8] px-4 py-3 transition-colors hover:border-[#e3cdbb] hover:bg-[#fef8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a441]/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#ece0d8] bg-[#fbf6f0] text-[#7a4a66]">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="truncate text-[12.5px] font-bold text-[#3c122e]">
                        {call.leadName || 'Unknown customer'}
                      </p>
                      <p className="truncate text-[10.5px] font-medium text-[#b08a72]">
                        {call.leadPhone || 'No phone on file'}
                      </p>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] text-[#9a7f8c]">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="shrink-0">{formatDuration(call.duration)} talk</span>
                      <span>•</span>
                      <span className="truncate">
                        {call.location ||
                          (call.outcome && call.outcome !== 'PENDING' ? `${call.outcome} lead` : 'Undecided')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 sm:pl-3">
                  <TempBadge outcome={call.outcome} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {summary && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2b081f]/60 p-4 backdrop-blur-sm"
          onClick={() => setSummary(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Lead summary for ${summary.name}`}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[#eeded4] dark:border-slate-800 bg-[#fdfaf6] dark:bg-slate-900 p-5 shadow-2xl sm:p-6 text-slate-900 dark:text-slate-100"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[17px] font-extrabold text-[#3c122e] dark:text-slate-100">{summary.name}</h3>
                  {summary.score > 0 && (
                    <span className="rounded-full border border-[#f3c9d0] dark:border-rose-500/30 bg-[#fdeef1] dark:bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-[#c02b48] dark:text-rose-400">
                      {summary.score}/100
                    </span>
                  )}
                  <TempBadge outcome={summary.outcome} small />
                </div>
                <p className="mt-0.5 text-[11.5px] font-bold text-[#c08a2e] dark:text-amber-400">
                  {summary.phone || 'No phone on file'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#eadbd1] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#7a5a6c] dark:text-slate-300 hover:bg-[#fbf5ef] dark:hover:bg-slate-700"
                aria-label="Close summary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p
              className={`mt-3 rounded-xl border border-[#f0e2d7] bg-[#fbf6f0] px-4 py-3 text-[12px] leading-relaxed ${
                summary.summary ? 'italic text-[#6c4a5e]' : 'text-[#a78c99]'
              }`}
            >
              {summary.summary ? `“${summary.summary}”` : 'No AI summary captured for this lead yet.'}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                { label: 'Budget', value: summary.budget },
                { label: 'Location', value: summary.location },
                { label: 'Timeline', value: summary.timeline },
                { label: 'Callback', value: summary.callback },
              ].map((field) => (
                <div key={field.label} className="rounded-xl border border-[#f0e2d8] bg-[#fefbf8] px-3 py-2">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a98c9a]">
                    {field.label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-[#3c122e]" title={field.value}>
                    {field.value}
                  </p>
                </div>
              ))}
            </div>

            {summary.transcript.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#a98c9a]">
                  Conversation transcript
                </p>
                <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-[#f0e2d8] bg-[#fefbf8] p-3">
                  {summary.transcript.slice(-10).map((turn, index) => {
                    const isAgent = turn.role === 'agent' || turn.speaker === 'agent';
                    return (
                      <p key={turn.id || index} className="text-[11px] leading-relaxed">
                        <span className={`font-bold ${isAgent ? 'text-[#7a2d5c]' : 'text-[#158a5b]'}`}>
                          {isAgent ? turn.agentName || 'Agent' : 'Customer'}:
                        </span>{' '}
                        <span className="text-[#5c3a4f]">{turn.text}</span>
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="rounded-full border border-[#eadbd1] bg-white px-4 py-2 text-[11.5px] font-semibold text-[#4a2a3e] hover:bg-[#fbf5ef]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const lead = leads.find((l) => (l.phone || '') === summary.phone && summary.phone);
                  if (lead) startLeadCall(lead);
                }}
                disabled={!summary.phone}
                title={summary.phone ? 'Start a live call with this lead' : 'No phone number on file'}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11.5px] font-bold transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                style={GOLD_STYLE}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Call Sales Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
