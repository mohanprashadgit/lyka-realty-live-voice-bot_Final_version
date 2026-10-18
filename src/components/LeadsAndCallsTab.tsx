import React, { useState, useEffect } from 'react';
import {
  Users,
  PhoneCall,
  Search,
  Flame,
  SunMedium,
  Snowflake,
  Filter,
  Clock,
  MapPin,
  Calendar,
  MessageSquare,
  X,
  User,
  CheckCircle2,
  Phone,
  DollarSign,
} from 'lucide-react';
import { LeadRecord, CallRecord, LeadOutcome } from '../types/agent';
import { renderHighlightedText } from '../utils/highlightKeywords';

interface LeadsAndCallsTabProps {
  onStartCallWithLead?: (lead: LeadRecord) => void;
}

export const LeadsAndCallsTab: React.FC<LeadsAndCallsTabProps> = ({ onStartCallWithLead }) => {
  const [viewMode, setViewMode] = useState<'leads' | 'calls'>('leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch leads and call history from existing API
    Promise.all([
      fetch('/api/leads').then((r) => r.json()).catch(() => []),
      fetch('/api/calls').then((r) => r.json()).catch(() => []),
    ])
      .then(([leadsData, callsData]) => {
        setLeads(Array.isArray(leadsData) ? leadsData : leadsData.leads || []);
        setCalls(Array.isArray(callsData) ? callsData : callsData.calls || []);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getOutcomeBadge = (outcome?: string) => {
    switch (outcome) {
      case 'HOT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <Flame className="w-3 h-3" />
            <span>HOT</span>
          </span>
        );
      case 'WARM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <SunMedium className="w-3 h-3" />
            <span>WARM</span>
          </span>
        );
      case 'COLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Snowflake className="w-3 h-3" />
            <span>COLD</span>
          </span>
        );
      default:
        return (
          <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {outcome || 'PENDING'}
          </span>
        );
    }
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
      (lead.outcome && lead.outcome === outcomeFilter);

    return matchesSearch && matchesOutcome;
  });

  const filteredCalls = calls.filter((call) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (call.leadName && call.leadName.toLowerCase().includes(q)) ||
      (call.leadPhone && call.leadPhone.includes(q)) ||
      (call.location && call.location.toLowerCase().includes(q)) ||
      (call.callId && call.callId.toLowerCase().includes(q));

    const matchesOutcome =
      outcomeFilter === 'ALL' ||
      (call.outcome && call.outcome === outcomeFilter);

    return matchesSearch && matchesOutcome;
  });

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & View Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/50 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Leads &amp; Call Records
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Extracted customer inquiries, qualification statuses, and verified call turn transcripts.
            </p>
          </div>

          {/* Toggle between Leads and Calls */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('leads')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'leads'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Prospect Leads ({leads.length})
            </button>
            <button
              onClick={() => setViewMode('calls')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'calls'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Call History ({calls.length})
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, phone, locality, or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1">Outcome:</span>
            {['ALL', 'HOT', 'WARM', 'COLD'].map((filter) => (
              <button
                key={filter}
                onClick={() => setOutcomeFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  outcomeFilter === filter
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading records...</div>
      ) : viewMode === 'leads' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Locality / Country</th>
                  <th className="py-3 px-4">Property Requirements</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Timeline</th>
                  <th className="py-3 px-4">Qualification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No prospect leads found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/60">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {lead.name || 'Unnamed Prospect'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {lead.phone || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {lead.location || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {lead.propertyType ? (
                          <span className="font-medium text-violet-700 dark:text-violet-400">
                            {lead.propertyType}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {lead.budget ? `${lead.currency || ''} ${lead.budget}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {lead.timeline || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {getOutcomeBadge(lead.outcome)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {onStartCallWithLead && (
                          <button
                            onClick={() => onStartCallWithLead(lead)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Call ID</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Qualification Outcome</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4 text-right">Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No call records found.
                    </td>
                  </tr>
                ) : (
                  filteredCalls.map((call) => (
                    <tr key={call.callId} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/60">
                      <td className="py-3 px-4 font-mono text-violet-600 dark:text-violet-400 font-medium">
                        {call.callId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{call.leadName}</div>
                        <div className="font-mono text-slate-400 text-[11px]">{call.leadPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {call.startedAt ? new Date(call.startedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {formatDuration(call.duration || 0)}
                      </td>
                      <td className="py-3 px-4">
                        {getOutcomeBadge(call.outcome)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {call.summary || 'Inquiry session'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCall(call)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Call Transcript</span>
                  <span className="font-mono text-xs text-violet-600 dark:text-violet-400">
                    {selectedCall.callId}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCall.leadName} ({selectedCall.leadPhone}) • Duration: {formatDuration(selectedCall.duration || 0)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Transcript Messages Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {(!selectedCall.transcript || selectedCall.transcript.length === 0) ? (
                <p className="text-slate-400 text-center py-6">No transcript turns recorded for this call.</p>
              ) : (
                selectedCall.transcript.map((turn, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border ${
                      turn.speaker === 'agent'
                        ? 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700/60 mr-8'
                        : 'bg-violet-50/50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/50 ml-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[11px] font-semibold">
                      <span className={turn.speaker === 'agent' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300'}>
                        {turn.speaker === 'agent' ? `${turn.agentName || 'Priya'} · Agent` : 'Customer'}
                      </span>
                      {turn.timestamp && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                      {turn.speaker === 'agent' ? renderHighlightedText(turn.text) : turn.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
