import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Mic,
  Volume2,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Database,
  Coins,
  Activity,
} from 'lucide-react';
import { ApiUsageData } from '../types/agent';

interface ApiUsageTabProps {
  usageData: ApiUsageData | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const ApiUsageTab: React.FC<ApiUsageTabProps> = ({
  usageData,
  onRefresh,
  isLoading,
}) => {
  // Live ticking countdown timer
  const [secondsUntilDaily, setSecondsUntilDaily] = useState<number>(
    usageData?.daily.secondsUntilRefill ?? 0
  );
  const [secondsUntilMinute, setSecondsUntilMinute] = useState<number>(
    usageData?.rateLimit.secondsUntilMinuteRefill ?? 60
  );

  useEffect(() => {
    if (usageData) {
      setSecondsUntilDaily(usageData.daily.secondsUntilRefill);
      setSecondsUntilMinute(usageData.rateLimit.secondsUntilMinuteRefill);
    }
  }, [usageData]);

  // Decrement seconds every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilDaily((prev) => (prev > 0 ? prev - 1 : 86400));
      setSecondsUntilMinute((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  const getStatusBadge = () => {
    const status = usageData?.quotaStatus;
    if (status === 'SPENDING_CAP_EXCEEDED') {
      return {
        label: 'SPENDING CAP EXCEEDED',
        cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    }
    if (status === 'EXHAUSTED') {
      return {
        label: 'QUOTA EXHAUSTED',
        cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    }
    if (status === 'WARNING') {
      return {
        label: 'CAPACITY WARNING',
        cls: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    }
    if (status === 'NO_API_KEY') {
      return {
        label: 'API KEY MISSING',
        cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    }
    return {
      label: 'HEALTHY & ACTIVE',
      cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    };
  };

  const statusBadge = getStatusBadge();
  const dailyRemaining = usageData?.daily.remaining ?? 1500;
  const dailyLimit = usageData?.daily.limit ?? 1500;
  const dailyUsed = usageData?.daily.used ?? 0;
  const percentUsed = usageData?.daily.percentUsed ?? 0;
  const minuteRemaining = usageData?.rateLimit.remainingThisMinute ?? 15;
  const minuteLimit = usageData?.rateLimit.minuteLimit ?? 15;

  const localResetTime = usageData?.daily.nextRefillIso
    ? new Date(usageData.daily.nextRefillIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '05:30 AM';

  const isSpendCapped = usageData?.quotaStatus === 'SPENDING_CAP_EXCEEDED';

  return (
    <div className="space-y-4">
      {/* Top Banner: Status & Live Refill Timer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Gemini API Usage &amp; Quota Refill
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Provider: <strong className="text-slate-800 dark:text-slate-200">Google AI Studio</strong></span>
              <span>•</span>
              <span>Model: <code className="text-amber-700 dark:text-amber-300 font-mono text-[11px]">{usageData?.model || 'gemini-3.8-live'}</code></span>
              <span>•</span>
              <span>Tier: {usageData?.tier || 'Developer API'}</span>
            </p>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
              <span>Timezone: <strong className="text-slate-600 dark:text-slate-400">{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong></span>
              <span>•</span>
              <span>Last updated: <strong className="text-slate-600 dark:text-slate-400">{usageData?.timestamp ? new Date(usageData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}</strong></span>
            </div>
          </div>
        </div>

        {/* Live Daily Refill Countdown & Refresh */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />
              <span>Daily Quota Refill In:</span>
            </div>
            <div className="text-sm font-bold font-mono text-cyan-700 dark:text-cyan-300">
              {formatCountdown(secondsUntilDaily)}
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh Quota Status from Google"
            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600 dark:text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prominent Spending Cap Alert when exceeded */}
      {isSpendCapped && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-rose-900 dark:text-rose-100">
                Google Gemini Project Monthly Spending Cap Reached
              </span>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                {usageData?.statusMessage || 'Your Google Cloud / AI Studio project has exceeded its monthly spending limit. Active voice calls and new chat prompts are temporarily blocked by Google.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://ai.studio/spend"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-xs transition-colors"
            >
              <span>Manage Spend Cap</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100 font-medium text-xs hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <span>New API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* 3 Accurate Metric Cards: Daily Quota, Minute Rate Limit, Voice Audio & Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Daily Requests (RPD) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Daily Requests (RPD)</span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {dailyRemaining.toLocaleString()} remaining
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {dailyUsed.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                used today of {dailyLimit.toLocaleString()} limit ({percentUsed}%)
              </span>
            </div>

            {/* Progress Bar showing percentage of daily limit used */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  percentUsed >= 95 ? 'bg-rose-500' : percentUsed >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(3, percentUsed))}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80">
            <span>Remaining: <strong className="text-slate-800 dark:text-slate-200">{dailyRemaining.toLocaleString()}</strong></span>
            <span>Resets at 00:00 UTC</span>
          </div>
        </div>

        {/* Card 2: Per-Minute Limit (RPM) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minute Limit (RPM)</span>
            <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {minuteRemaining} / {minuteLimit} RPM
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {minuteRemaining}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">requests available right now</span>
            </div>

            {/* Progress Bar showing available capacity */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, (minuteRemaining / minuteLimit) * 100))}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80">
            <span>Rolling 60s window</span>
            <span className="text-cyan-700 dark:text-cyan-400 font-mono">Refills in {secondsUntilMinute}s</span>
          </div>
        </div>

        {/* Card 3: Voice Audio & AI Tokens */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Audio &amp; Token Usage</span>
            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Gemini Live Native
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {usageData?.activity.totalAudioMinutesStreamed ?? '0.00'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">minutes voice audio streamed</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Mic className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />
                <span>In: {usageData?.activity.audioSecondsSent ?? 0}s</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Out: {usageData?.activity.audioSecondsReceived ?? 0}s</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Layers className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>{(((usageData?.totalTokens ?? 0)) / 1000).toFixed(1)}k tokens</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Coins className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>${usageData?.estimatedCostUsd?.toFixed(4) ?? '0.0000'}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80">
            <span>Sessions: <strong className="text-slate-800 dark:text-slate-200">{usageData?.activity.totalSessions ?? 0}</strong></span>
            <span>Turns: <strong className="text-slate-800 dark:text-slate-200">{usageData?.activity.totalTurns ?? 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Provider Exposure Note / Data Source Transparency Card */}
      <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Data Source Accounting:</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5">
              Sessions, turns, and CRM extractions are tracked directly from MySQL database tables.
            </span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
          Provider Live Credit Balance: <strong className="text-amber-700 dark:text-amber-400">Unavailable from provider</strong>
        </div>
      </div>

      {/* Quota Refill Policy & Details Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Gemini API Quota &amp; Refill Schedule Details</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Daily Quota (Requests Per Day)</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{dailyLimit.toLocaleString()} RPD</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Google Gemini automatically refills your daily requests to <strong>1,500 requests</strong> every midnight at <strong>00:00:00 UTC</strong> (Coordinated Universal Time).
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800/60 font-mono">
              <span className="text-slate-500 dark:text-slate-400">Next Daily Reset:</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-semibold">
                00:00 UTC ({localResetTime} your local time)
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Minute Rate Limit (RPM &amp; TPM)</span>
              <span className="font-mono text-cyan-700 dark:text-cyan-400 font-semibold">{minuteLimit} RPM</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Gemini operates on a rolling 60-second window. Every minute, your available request capacity resets up to <strong>15 requests per minute</strong> and up to <strong>1,000,000 tokens per minute</strong>.
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800/60 font-mono">
              <span className="text-slate-500 dark:text-slate-400">Minute Reset:</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-semibold">In {secondsUntilMinute} seconds</span>
            </div>
          </div>
        </div>

        {/* Verified Database Activity & Telephony Breakdown */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Database className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Real Database &amp; Telephony Metrics</span>
            </div>
            <span className="text-[10px] text-slate-400">Verified MySQL / TiDB Cluster Records</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Total API Requests</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {usageData?.activity.totalRequestsAllTime ?? 0}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Conversations Recorded</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {usageData?.activity.totalSessions ?? 0}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Turn-by-Turn Messages</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {usageData?.activity.totalTurns ?? 0}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">CRM Lead Extractions</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {usageData?.activity.totalToolCalls ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
