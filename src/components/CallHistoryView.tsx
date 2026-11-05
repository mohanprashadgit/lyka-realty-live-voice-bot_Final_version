import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  User,
  Phone,
  Flame,
  SunMedium,
  Snowflake,
  ShieldBan,
  CheckCircle2,
  Calendar,
  FileText,
  ChevronRight,
  X,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  PhoneOff,
} from 'lucide-react';
import { CallRecord, LeadOutcome } from '../types/agent';

interface CallHistoryViewProps {
  calls: CallRecord[];
  onClearHistory: () => void;
}

export const CallHistoryView: React.FC<CallHistoryViewProps> = ({
  calls,
  onClearHistory,
}) => {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const getOutcomeBadge = (outcome: LeadOutcome) => {
    switch (outcome) {
      case 'HOT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Flame className="w-3 h-3" />
            <span>HOT</span>
          </span>
        );
      case 'WARM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <SunMedium className="w-3 h-3" />
            <span>WARM</span>
          </span>
        );
      case 'COLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Snowflake className="w-3 h-3" />
            <span>COLD</span>
          </span>
        );
      case 'OPT_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldBan className="w-3 h-3" />
            <span>OPT-OUT</span>
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
            <PhoneOff className="w-3 h-3" />
            <span>NO ANSWER</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{outcome}</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-3 transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>Simulated Outbound Call History</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Detailed transcripts, extracted qualification slots, and generated sales actions
          </p>
        </div>

        {calls.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500/30 transition-colors cursor-pointer"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Table / List */}
      {calls.length === 0 ? (
        <div className="p-12 text-center text-slate-500 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
          <p className="text-xs">No calls recorded yet.</p>
          <p className="text-[11px] text-slate-600">
            Go to the Leads table and click [ CALL ] to start your first simulated AI sales call.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Lead</th>
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Summary</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {calls.map((call) => (
                <tr
                  key={call.callId}
                  onClick={() => setSelectedCall(call)}
                  className="hover:bg-slate-850/60 transition-colors cursor-pointer group"
                >
                  {/* Lead */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{call.leadName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono pl-5">
                      {call.leadPhone}
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                    {new Date(call.startedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  {/* Duration */}
                  <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                    {formatDuration(call.duration)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-medium text-slate-300">
                      {call.callStatus}
                    </span>
                  </td>

                  {/* Outcome */}
                  <td className="py-3 px-3">
                    {getOutcomeBadge(call.outcome)}
                  </td>

                  {/* Summary */}
                  <td className="py-3 px-3">
                    <div className="text-[11px] text-slate-300 truncate max-w-[280px]">
                      {call.summary}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCall(call);
                      }}
                      className="p-1 rounded-lg text-slate-400 group-hover:text-amber-400 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Call Drawer / Modal */}
      {selectedCall &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 dark:bg-black/85 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCall(null);
            }}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[850px] p-4 sm:p-6 shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 space-y-3.5 overflow-hidden transition-colors duration-200"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {selectedCall.leadName}
                  </h3>
                  {getOutcomeBadge(selectedCall.outcome)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {selectedCall.leadPhone} • Call ID: {selectedCall.callId.slice(-8)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Call Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
              <div className="bg-slate-50 dark:bg-slate-950/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Duration</span>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatDuration(selectedCall.duration)}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Call Time</span>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {new Date(selectedCall.startedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Sentiment</span>
                <div className="font-semibold capitalize text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                  {selectedCall.sentiment === 'positive' && <ThumbsUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                  {selectedCall.sentiment === 'negative' && <ThumbsDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                  <span>{selectedCall.sentiment || 'Neutral'}</span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Call Status</span>
                <div className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {selectedCall.callStatus}
                </div>
              </div>
            </div>

            {/* Extracted Slots Summary */}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shrink-0">
              <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Extracted Qualification Data
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Interest:</span>
                  <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {selectedCall.interest || 'Not captured'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Buyer Type:</span>
                  <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {selectedCall.buyerType || 'Not captured'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Property Type:</span>
                  <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {selectedCall.propertyType || 'Not captured'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Budget:</span>
                  <div className="text-amber-700 dark:text-amber-400 font-semibold truncate">
                    {selectedCall.budget || 'Not captured'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Location:</span>
                  <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                    {selectedCall.location || 'Not captured'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Timeline:</span>
                  <div className="text-cyan-700 dark:text-cyan-400 font-semibold truncate">
                    {selectedCall.timeline || 'Not captured'}
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Summary & Next Action */}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5 text-xs shrink-0">
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-300">
                Automated Call Summary
              </h4>
              <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80 font-medium max-h-16 overflow-y-auto">
                {selectedCall.summary}
              </p>
              {selectedCall.nextAction && (
                <div className="text-[10px] pt-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Recommended Next Action: </span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{selectedCall.nextAction}</strong>
                </div>
              )}
            </div>

            {/* Conversation Transcript (High Capacity Flex-1) */}
            <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Full Call Transcript ({selectedCall.transcript.length} turns)</span>
              </h4>

              <div className="bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2.5 text-xs">
                {selectedCall.transcript.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-500 italic text-center py-4">
                    No transcript dialogue recorded for this call.
                  </p>
                ) : (
                  selectedCall.transcript.map((t) => (
                    <div
                      key={t.id}
                      className={`flex gap-2.5 ${
                        t.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                          t.role === 'user'
                            ? 'bg-amber-50 text-slate-900 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/30'
                            : 'bg-white text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 shadow-xs'
                        }`}
                      >
                        <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                          {t.role === 'user' ? selectedCall.leadName : 'Executive'} • {t.timestamp}
                        </div>
                        <p className="leading-relaxed font-medium break-words">{t.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-2 flex justify-end shrink-0 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700 cursor-pointer transition-colors shadow-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
