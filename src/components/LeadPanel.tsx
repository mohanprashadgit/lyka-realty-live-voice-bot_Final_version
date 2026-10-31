import React, { useState } from 'react';
import {
  Flame,
  SunMedium,
  Snowflake,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  MapPin,
  DollarSign,
  Home,
  UserCheck,
  Calendar,
  FileSpreadsheet,
  Phone,
  MessageCircle,
  Mail,
  Clock,
  Target,
  FileText,
  User,
} from 'lucide-react';
import { LeadData, LeadQualificationStatus } from '../types/agent';

interface LeadPanelProps {
  lead: LeadData;
  onResetLead: () => void;
  onApplyPreset: (preset: Partial<LeadData>) => void;
}

export const LeadPanel: React.FC<LeadPanelProps> = ({
  lead,
  onResetLead,
  onApplyPreset,
}) => {
  const [copied, setCopied] = useState(false);

  const getStatusBadge = (status: LeadQualificationStatus) => {
    switch (status) {
      case 'HOT':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Flame className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <div className="text-xs font-bold tracking-wider uppercase">HOT LEAD</div>
              <div className="text-[10px] text-emerald-300/80">Ready to buy &lt; 90 days</div>
            </div>
          </div>
        );
      case 'WARM':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10">
            <SunMedium className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-xs font-bold tracking-wider uppercase">WARM LEAD</div>
              <div className="text-[10px] text-amber-300/80">Interested, 3-6 mo timeline</div>
            </div>
          </div>
        );
      case 'COLD':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
            <Snowflake className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-xs font-bold tracking-wider uppercase">COLD LEAD</div>
              <div className="text-[10px] text-slate-400">Casual exploring or long term</div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
            <Sparkles className="w-4 h-4 text-slate-500" />
            <div>
              <div className="text-xs font-bold tracking-wider uppercase">QUALIFYING...</div>
              <div className="text-[10px] text-slate-400">Awaiting user criteria</div>
            </div>
          </div>
        );
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(lead, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(lead, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lyka-realty-lead-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Helper: get contact method icon
  const getContactIcon = (method?: string) => {
    if (!method) return <MessageCircle className="w-3.5 h-3.5 text-blue-400" />;
    const m = method.toLowerCase();
    if (m.includes('whatsapp')) return <MessageCircle className="w-3.5 h-3.5 text-green-400" />;
    if (m.includes('phone') || m.includes('call')) return <Phone className="w-3.5 h-3.5 text-blue-400" />;
    if (m.includes('email')) return <Mail className="w-3.5 h-3.5 text-amber-400" />;
    return <MessageCircle className="w-3.5 h-3.5 text-blue-400" />;
  };

  const fieldRow = (
    icon: React.ReactNode,
    label: string,
    value: string | undefined,
    placeholder: string,
    valueClass?: string
  ) => (
    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </div>
        <div className={`text-xs mt-0.5 font-medium break-words ${value ? (valueClass || 'text-slate-900 dark:text-slate-100') : 'text-slate-400 dark:text-slate-500 italic'}`}>
          {value || placeholder}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>Extracted Prospect Profile</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Live-captured from conversation · All 7 qualification fields
          </p>
        </div>
        <div>{getStatusBadge(lead.qualification_status)}</div>
      </div>

      {/* Scrollable field list */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">

        {/* 1. Customer Name */}
        {fieldRow(
          <User className="w-3.5 h-3.5 text-violet-400" />,
          '1. Customer Name',
          (lead as any).customer_name_raw || lead.name,
          'Not captured yet'
        )}

        {/* 2. Phone Number */}
        {fieldRow(
          <Phone className="w-3.5 h-3.5 text-blue-400" />,
          '2. Phone Number',
          lead.phone,
          'Not captured yet'
        )}

        {/* 3. Current Location (ALL locations mentioned) */}
        {fieldRow(
          <MapPin className="w-3.5 h-3.5 text-rose-400" />,
          '3. Location(s) Mentioned',
          (lead as any).all_locations_mentioned || lead.location || lead.city,
          'Not captured yet (city & country)'
        )}

        {/* 4. How Heard / Lead Source */}
        {fieldRow(
          <Target className="w-3.5 h-3.5 text-orange-400" />,
          '4. Lead Source / How Heard',
          (lead as any).lead_source,
          'Not captured yet (social, referral, ads...)'
        )}

        {/* 5. Purpose / Intent */}
        {fieldRow(
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
          '5. Purpose of Enquiry',
          lead.intent || (lead as any).interest,
          'Not captured yet (buy, invest, rent...)'
        )}

        {/* 6. Preferred Contact Method */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5">
            {getContactIcon((lead as any).preferred_contact_method)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              6. Preferred Contact Method
            </div>
            <div className={`text-xs mt-0.5 font-medium ${(lead as any).preferred_contact_method ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 italic'}`}>
              {(lead as any).preferred_contact_method || 'Not captured yet (Phone, WhatsApp, Email)'}
            </div>
          </div>
        </div>

        {/* 7. Best Time to Contact */}
        {fieldRow(
          <Clock className="w-3.5 h-3.5 text-cyan-400" />,
          '7. Best Time to Contact',
          (lead as any).best_time_to_contact,
          'Not captured yet (morning, evening, weekends)'
        )}

        {/* Property Specs divider */}
        <div className="pt-1 pb-0.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Home className="w-3 h-3" />
            <span>Property Specs</span>
          </div>
        </div>

        {/* Property Type */}
        {fieldRow(
          <Home className="w-3.5 h-3.5 text-indigo-400" />,
          'Property Type',
          lead.property_type,
          'Not captured yet (apartment, villa, plot...)'
        )}

        {/* Budget */}
        {fieldRow(
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />,
          'Budget Range',
          lead.budget,
          'Not captured yet (₹80L, $800k, 2.5M AED)',
          'text-emerald-700 dark:text-emerald-400 font-semibold'
        )}

        {/* Timeline */}
        {fieldRow(
          <Calendar className="w-3.5 h-3.5 text-violet-400" />,
          'Decision Timeline',
          lead.timeline,
          'Not captured yet (immediate, 3 months...)'
        )}

        {/* Special Notes & Full Conversation Summary */}
        {lead.notes && (
          <div
            data-notes-box="true"
            className="notes-container p-3 rounded-xl bg-amber-50/90 border border-amber-300 text-xs shadow-sm space-y-1.5 dark:bg-slate-950/80 dark:border-amber-500/30 transition-colors"
          >
            <div className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
              <FileText className="w-3.5 h-3.5" />
              <span>📋 Special Notes & Conversation Summary</span>
            </div>
            <p className="leading-relaxed font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-800 mt-3 flex items-center justify-between gap-2">
        <button
          onClick={handleCopyJson}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy JSON'}</span>
        </button>

        <button
          onClick={handleExportJson}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
          <span>Export</span>
        </button>

        <button
          onClick={onResetLead}
          title="Reset Lead Details"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
