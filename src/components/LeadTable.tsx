import React, { useState, useMemo } from 'react';
import {
  PhoneCall,
  Search,
  Check,
  X,
  Flame,
  SunMedium,
  Snowflake,
  ShieldBan,
  Clock,
  Trash2,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Filter,
  Pencil,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { LeadRecord, LeadOutcome, LeadCallStatus } from '../types/agent';

interface LeadTableProps {
  leads: LeadRecord[];
  onStartCall: (lead: LeadRecord, mode?: 'browser' | 'twilio') => void;
  onEditLead: (lead: LeadRecord) => void;
  onDeleteLead: (id: string) => void;
  onOpenImport: () => void;
  onExportCsv: () => void;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  onStartCall,
  onEditLead,
  onDeleteLead,
  onOpenImport,
  onExportCsv,
  activeFilter = 'ALL',
  onFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState(activeFilter);

  const handleFilterSelect = (newFilter: string) => {
    setFilter(newFilter);
    if (onFilterChange) onFilterChange(newFilter);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        lead.name.toLowerCase().includes(term) ||
        lead.phone.includes(term) ||
        (lead.email && lead.email.toLowerCase().includes(term)) ||
        lead.source.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Status/Outcome filter
      switch (filter) {
        case 'HOT':
          return lead.outcome === 'HOT';
        case 'WARM':
          return lead.outcome === 'WARM';
        case 'REACH_AGAIN':
          return (
            lead.outcome === 'REACH_AGAIN' ||
            lead.callStatus === 'REACH_AGAIN' ||
            Boolean(
              lead.notes &&
                (lead.notes.toLowerCase().includes('call back') ||
                  lead.notes.toLowerCase().includes('reach again') ||
                  lead.notes.toLowerCase().includes('unavailable') ||
                  lead.notes.toLowerCase().includes('brother') ||
                  lead.notes.toLowerCase().includes('கால் திரும்ப'))
            )
          );
        case 'COLD':
          return lead.outcome === 'COLD';
        case 'OPT_OUT':
          return lead.isOptedOut || lead.outcome === 'OPT_OUT';
        case 'NO_ANSWER':
          return lead.callStatus === 'NO_ANSWER';
        case 'NOT_CALLED':
          return lead.callStatus === 'NOT_CALLED';
        case 'CONNECTED':
          return lead.callStatus === 'CONNECTED' || lead.callStatus === 'COMPLETED';
        case 'INTERESTED':
          return lead.outcome === 'HOT' || lead.outcome === 'WARM';
        case 'NOT_INTERESTED':
          return lead.outcome === 'COLD' || lead.outcome === 'OPT_OUT';
        default:
          return true;
      }
    });
  }, [leads, searchTerm, filter]);

  const getOutcomeBadge = (outcome?: LeadOutcome, isOptedOut?: boolean) => {
    if (isOptedOut || outcome === 'OPT_OUT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <ShieldBan className="w-2.5 h-2.5" />
          <span>OPT-OUT</span>
        </span>
      );
    }

    switch (outcome) {
      case 'HOT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Flame className="w-2.5 h-2.5 animate-pulse" />
            <span>HOT</span>
          </span>
        );
      case 'WARM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <SunMedium className="w-2.5 h-2.5" />
            <span>WARM</span>
          </span>
        );
      case 'REACH_AGAIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Clock className="w-2.5 h-2.5 animate-pulse" />
            <span>REACH AGAIN</span>
          </span>
        );
      case 'COLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Snowflake className="w-2.5 h-2.5" />
            <span>COLD</span>
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
            <span>NO ANSWER</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] text-slate-500 font-mono">
            —
          </span>
        );
    }
  };

  const getCallStatusBadge = (status: LeadCallStatus) => {
    switch (status) {
      case 'NOT_CALLED':
        return (
          <span className="text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60">
            Not Called
          </span>
        );
      case 'CALLING':
        return (
          <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
            Calling...
          </span>
        );
      case 'CONNECTED':
        return (
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            Connected
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="text-[11px] font-medium text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
            Completed
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            No Answer
          </span>
        );
      case 'REACH_AGAIN':
        return (
          <span className="text-[11px] font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
            Reach Again / Callback
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-3">
      {/* Controls Bar */}
      <div className="p-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, email, or source..."
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center flex-wrap gap-1 text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'HOT', label: 'Hot 🔥' },
            { id: 'WARM', label: 'Warm ☀️' },
            { id: 'REACH_AGAIN', label: 'Reach Again 📞' },
            { id: 'COLD', label: 'Cold ❄️' },
            { id: 'OPT_OUT', label: 'Opt-Out 🛑' },
            { id: 'NOT_CALLED', label: 'Not Called' },
            { id: 'NO_ANSWER', label: 'No Answer' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterSelect(tab.id)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px] font-medium ${
                filter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Phone</th>
              <th className="py-2.5 px-3">Source</th>
              <th className="py-2.5 px-3 text-center">Consent</th>
              <th className="py-2.5 px-3">Call Status</th>
              <th className="py-2.5 px-3">Interest / Slots</th>
              <th className="py-2.5 px-3">Outcome</th>
              <th className="py-2.5 px-3">Last Call</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No leads found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const isOptedOut = lead.isOptedOut || lead.outcome === 'OPT_OUT';

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-850/60 transition-colors group"
                  >
                    {/* Name & Email */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>{lead.name}</span>
                        {isOptedOut && (
                          <span title="Opted out / Do Not Call">
                            <ShieldBan className="w-3 h-3 text-rose-400" />
                          </span>
                        )}
                      </div>
                      {lead.email && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {lead.email}
                        </div>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="py-2.5 px-3 font-mono text-slate-200">
                      {lead.phone}
                    </td>

                    {/* Source */}
                    <td className="py-2.5 px-3 text-slate-300">
                      <span className="bg-slate-800/70 px-1.5 py-0.5 rounded text-[11px]">
                        {lead.source}
                      </span>
                    </td>

                    {/* Consent */}
                    <td className="py-2.5 px-3 text-center">
                      {lead.consent ? (
                        <span
                          title="Lead provided marketing consent"
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span
                          title="No explicit consent on file"
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-500"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </td>

                    {/* Call Status */}
                    <td className="py-2.5 px-3">
                      {getCallStatusBadge(lead.callStatus)}
                    </td>

                    {/* Interest / Slots & Notes */}
                    <td className="py-2.5 px-3">
                      <div className="text-[11px] text-slate-300 truncate max-w-[200px]" title={lead.notes || ''}>
                        {lead.propertyType || lead.interest ? (
                          <span>
                            {lead.interest ? `${lead.interest}: ` : ''}
                            {lead.propertyType || ''}
                            {lead.budget ? ` (${lead.budget})` : ''}
                          </span>
                        ) : lead.notes ? (
                          <span className="text-cyan-300 font-medium">{lead.notes}</span>
                        ) : (
                          <span className="text-slate-500 italic">Not gathered</span>
                        )}
                      </div>
                      {lead.notes && (lead.propertyType || lead.interest) && (
                        <div className="text-[10px] text-cyan-400 truncate max-w-[200px]" title={lead.notes}>
                          📝 {lead.notes}
                        </div>
                      )}
                    </td>

                    {/* Outcome */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        {getOutcomeBadge(lead.outcome, lead.isOptedOut)}
                        {lead.score != null && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                            title="Lead Qualification Score"
                          >
                            Score: {lead.score}/100
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Call */}
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                      {lead.lastCalledAt ? (
                        new Date(lead.lastCalledAt).toLocaleTimeString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        {/* Edit Lead */}
                        <button
                          onClick={() => onEditLead(lead)}
                          title="Edit lead details"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* 1. Browser Test Call with Vivo Mobile Full-Screen UI */}
                        <button
                          onClick={() => onStartCall(lead, 'browser')}
                          disabled={isOptedOut}
                          title={
                            isOptedOut
                              ? 'This contact has opted out (Do Not Call)'
                              : `Start Browser Test (Vivo mobile phone screen) with ${lead.name}`
                          }
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                            isOptedOut
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-600/20'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>Browser Test</span>
                        </button>

                        {/* 2. Real Twilio Outbound Phone Call */}
                        <button
                          onClick={() => onStartCall(lead, 'twilio')}
                          disabled={isOptedOut}
                          title={
                            isOptedOut
                              ? 'This contact has opted out (Do Not Call)'
                              : `Dial Real Mobile via Twilio: ${lead.phone}`
                          }
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                            isOptedOut
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                              : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95 shadow-rose-600/20'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>Twilio Real</span>
                        </button>

                        {/* Delete Lead */}
                        <button
                          onClick={() => onDeleteLead(lead.id)}
                          title="Delete lead record"
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* Footer count */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Showing <strong>{filteredLeads.length}</strong> of <strong>{leads.length}</strong> leads
        </span>
        <span className="text-slate-500">
          Simulated Outbound Calling Environment (Browser Voice API)
        </span>
      </div>
    </div>
  );
};
