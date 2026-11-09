import React from 'react';
import { CheckCircle2, Circle, Target } from 'lucide-react';
import { LeadData } from '../types/agent';

interface StageTrackerProps {
  lead: LeadData;
}

const STAGES = [
  {
    num: 1,
    id: 'greeting',
    title: 'Greeting & Intro',
    titleTa: 'வணக்கம்',
    question: 'Opening & Permission',
    field: (l: LeadData) => (l.conversation_disposition === 'engaged' ? 'Engaged' : l.conversation_disposition),
  },
  {
    num: 2,
    id: 'name',
    title: 'Customer Name',
    titleTa: 'பெயர்',
    question: 'How to address customer?',
    field: (l: LeadData) => l.customer_name_raw || l.name,
  },
  {
    num: 3,
    id: 'location_profession',
    title: 'Location & Job',
    titleTa: 'இடம் & தொழில்',
    question: 'City & profession',
    field: (l: LeadData) => [l.current_location || l.hometown, (l as any).profession].filter(Boolean).join(' • '),
  },
  {
    num: 4,
    id: 'buying_interest',
    title: 'Buying Interest',
    titleTa: 'ஆர்வம்',
    question: 'Own use or Investment?',
    field: (l: LeadData) => (l as any).investment_purpose || l.intent || l.interest,
  },
  {
    num: 5,
    id: 'offers',
    title: '3 Key Offers',
    titleTa: '3 சலுகைகள்',
    question: 'Flight, Visa, Guidance',
    field: (l: LeadData) => {
      const f = (l as any).flight_offer_status || (l as any).flight_offer_delivery;
      const g = (l as any).golden_visa_offer_status || (l as any).golden_visa_offer_delivery;
      const p = (l as any).purchase_support_offer_status || (l as any).purchase_support_offer_delivery;
      if (f && g && p) return 'All 3 Delivered';
      if (f || g || p) return 'In Progress';
      return (l as any).offers_permission === 'granted' ? 'Permission Ok' : undefined;
    },
  },
  {
    num: 6,
    id: 'family_lifestyle',
    title: 'Family & Lifestyle',
    titleTa: 'குடும்பம்',
    question: 'Family size & lifestyle needs',
    field: (l: LeadData) => ((l as any).family_size ? `${(l as any).family_size} members` : (l as any).family_relocation || (l as any).family_lifestyle_checked),
  },
  {
    num: 7,
    id: 'preferred_location',
    title: 'Preferred Area',
    titleTa: 'விருப்ப இடம்',
    question: 'Dubai Downtown, Marina, etc.?',
    field: (l: LeadData) => l.location,
  },
  {
    num: 8,
    id: 'property_type',
    title: 'Property Type',
    titleTa: 'சொத்து வகை',
    question: 'Apartment, Villa, 1-3 BHK?',
    field: (l: LeadData) => [l.property_type, (l as any).bedrooms ? `${(l as any).bedrooms} BHK` : ''].filter(Boolean).join(' • '),
  },
  {
    num: 9,
    id: 'budget_payment',
    title: 'Budget & Pay',
    titleTa: 'பட்ஜெட்',
    question: 'Price range & installments?',
    field: (l: LeadData) => [l.budget, (l as any).payment_preference].filter(Boolean).join(' • '),
  },
  {
    num: 10,
    id: 'timeline',
    title: 'Timeline',
    titleTa: 'கால அவகாசம்',
    question: 'Immediate, 1-3 mo, exploring?',
    field: (l: LeadData) => l.timeline,
  },
  {
    num: 11,
    id: 'contact_preference',
    title: 'Contact & Phone',
    titleTa: 'தொடர்பு எண்',
    question: 'WhatsApp / Phone consent',
    field: (l: LeadData) => (l.preferred_contact_method ? `${l.preferred_contact_method} (${l.phone || 'ok'})` : l.phone),
  },
  {
    num: 12,
    id: 'trust_credibility',
    title: 'Trust & Credibility',
    titleTa: 'நம்பிக்கை',
    question: 'DLD, Escrow & Compliance',
    field: (l: LeadData) => ((l as any).trust_building_completed === 'true' || (l as any).trust_building_completed === 'completed' ? 'Verified' : undefined),
  },
  {
    num: 13,
    id: 'property_presentation',
    title: 'Presentation',
    titleTa: 'பரிந்துரை',
    question: 'Verified inventory & ROI',
    field: (l: LeadData) => ((l as any).recommendation_status || l.notes?.includes('recommend') ? 'Presented' : undefined),
  },
  {
    num: 14,
    id: 'closing',
    title: 'Closing & Next Step',
    titleTa: 'நிறைவு',
    question: 'Agreed next step & Goodbye',
    field: (l: LeadData) => ((l as any).agreed_next_action || (l.qualification_status === 'HOT' || l.qualification_status === 'WARM' ? 'Completed' : undefined)),
  },
];

export const StageTracker: React.FC<StageTrackerProps> = ({ lead }) => {
  // Count how many stages have data
  const completedCount = STAGES.filter((s) => Boolean(s.field(lead))).length;
  const progressPct = Math.round((completedCount / STAGES.length) * 100);

  // Determine current active stage (first incomplete stage, or 14 if all done)
  let currentStageIndex = STAGES.findIndex((s) => !s.field(lead));
  if (currentStageIndex === -1) currentStageIndex = STAGES.length - 1;
  const currentStageNum = currentStageIndex + 1;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            14-Stage Call Structure &amp; Qualification
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Stage <strong className="text-amber-400">{completedCount === STAGES.length ? '14/14 (Completed)' : `${currentStageNum}/14`}</strong>
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4">
        <div
          className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full transition-all duration-500 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 14 Stages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {STAGES.map((s, idx) => {
          const val = s.field(lead);
          const isDone = Boolean(val);
          const isCurrent = idx === currentStageIndex && !isDone;

          return (
            <div
              key={s.id}
              className={`p-2 rounded-lg border transition-all ${
                isDone
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : isCurrent
                  ? 'bg-amber-950/25 border-amber-500/40 ring-1 ring-amber-500/20 shadow-md'
                  : 'bg-slate-950/40 border-slate-800/80 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Stage {s.num}</span>
                </span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                ) : (
                  <Circle className="w-3 h-3 text-slate-600" />
                )}
              </div>

              <div className="text-[11px] font-medium text-slate-200 truncate flex items-center justify-between">
                <span className="truncate">{s.title}</span>
                <span className="text-[9px] text-slate-400 font-normal shrink-0 ml-1">{s.titleTa}</span>
              </div>

              {isDone ? (
                <div className="text-[10px] text-emerald-400 font-medium truncate mt-1 bg-emerald-500/10 px-1 py-0.5 rounded">
                  {val}
                </div>
              ) : (
                <div className="text-[9px] text-slate-400 truncate mt-1">
                  {s.question}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
