import React, { memo, useRef } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Clock,
  DollarSign,
  Home,
  MapPin,
  Phone,
  Target,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { nextSalesAction } from '../utils/salesConversation';
import { knownCustomerName } from '../utils/salesIntelligence';
import { usableContactPhone } from '../utils/leadFields';
import { customerFacts } from '../utils/customerIntelligence';

const groups: [string, [string, string][]][] = [
  ['Customer profile', [['name', 'Customer name'], ['phone', 'Phone'], ['hometown', 'Hometown'], ['current_location', 'Current location'], ['profession', 'Profession']]],
  ['Family and lifestyle', [['family_size', 'Family members'], ['children_dependants', 'Children or dependants'], ['family_relocation', 'Relocation plan'], ['investment_purpose', 'Purchase purpose'], ['lifestyle_requirements', 'Schools, beach and community priorities']]],
  ['Property requirements', [['bedrooms', 'Preferred bedrooms'], ['property_type', 'Property type'], ['location', 'Preferred property location'], ['timeline', 'Purchase timeline'], ['extra_bedroom_needs', 'Additional space needs']]],
  ['Budget and payment', [['budget', 'Stated budget'], ['payment_preference', 'Payment preference'], ['down_payment_comfort', 'Initial payment comfort'], ['monthly_payment_comfort', 'Monthly payment comfort'], ['financing_interest', 'Financing interest'], ['approximate_income_range', 'Voluntary income range']]],
  ['Previous call memory', [['previous_call_memory', 'Recent completed calls'], ['declined_fields', 'Previously declined questions']]],
  ['Competitor comparison', [['competitor_name', 'Customer-reported realtor'], ['competitor_project', 'Project'], ['competitor_location', 'Community'], ['competitor_quote', 'Unverified quotation'], ['competitor_size', 'Size and measurement basis'], ['competitor_verification', 'Verification status'], ['comparison_result', 'Comparison result']]],
  ['Legal and trust concerns', [['legal_concern', 'Customer question'], ['customer_objections', 'Outstanding concerns']]],
  ['Sales and next step', [['qualification_status', 'Qualification'], ['buying_readiness', 'Stated readiness'], ['customer_mood', 'Reported mood'], ['customer_objections', 'Customer objections'], ['competitor_details', 'Competitor mentions'], ['follow_up_permission', 'Follow up consent'], ['agreed_next_action', 'Agreed next action'], ['best_time_to_contact', 'Contact timing'], ['declined_fields', 'Declined questions']]],
];

const overviewFields: [string, string, React.ElementType][] = [
  ['name', 'Customer name', UserRound],
  ['phone', 'Phone number', Phone],
  ['current_location', 'Location', MapPin],
  ['investment_purpose', 'Purpose of enquiry', Target],
  ['property_type', 'Property type', Home],
  ['location', 'Preferred property location', MapPin],
  ['budget', 'Budget', DollarSign],
  ['timeline', 'Purchase timeline', CalendarDays],
  ['qualification_status', 'Lead status', BadgeCheck],
  ['follow_up_permission', 'Follow-up preference', Clock],
];

const offers: [string, string][] = [
  ['flight', 'Flight ticket booking'],
  ['golden_visa', 'Golden Visa assistance'],
  ['purchase_support', 'Dedicated purchase support'],
];

const NOT_PROVIDED = 'Not provided';

export const CustomerIntelligence = memo(function CustomerIntelligence({ data, saveState }: { data: Record<string, any>; saveState?: string }) {
  const f = customerFacts(data);
  const action = nextSalesAction({ ...f, conversation_disposition: f.conversation_disposition || 'engaged' });
  const value = (key: string) => {
    const v = key === 'name' ? knownCustomerName(f.customer_name_raw) || knownCustomerName(f.full_name) || knownCustomerName(f.name) : f[key];
    if (v == null || v === '' || /^(unknown|n\/a|not provided)$/i.test(String(v))) return NOT_PROVIDED;
    if (key === 'budget' && f.currency && /^\d+(?:\.\d+)?$/.test(String(v))) return `${f.currency} ${Number(v).toLocaleString(f.currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}`;
    if (key === 'budget') return f.currency && !String(v).includes(f.currency) ? `${f.currency} ${v}` : String(v);
    if (key === 'bedrooms') return `${v} BHK`;
    if (key === 'comparison_result') {
      try { const r=JSON.parse(String(v)); return r.status==='historical_comparison' ? `${r.currency} ${Number(r.median).toLocaleString()} / sqft median; ${r.sampleSize} registered sales (${r.dateRange?.join(' to ')}). Historical, not a current valuation. ${r.limitations}` : `${String(r.status||'Awaiting verification').replaceAll('_',' ')}${r.missing?.length ? ': need '+r.missing.join(', ') : ''}. Customer quotation remains unverified.`; } catch { return 'Comparison requires verification'; }
    }
    const labels: Record<string, string> = { within_3_months: 'Within 3 months', within_1_month: 'Within 1 month', own_use: 'Own use', installment: 'Installments', installments: 'Installments', buying: 'Buying', renting: 'Renting', selling: 'Selling', investing: 'Investing', granted: 'Granted', declined: 'Declined', presented: 'Introduced (model reported)', understood: 'Acknowledged by customer', attempted: 'Attempted; hearing unconfirmed', interrupted: 'Interrupted' };
    return labels[String(v)] || String(v).replaceAll('_', ' ');
  };

  // One canonical formatter so the overview and the section cards stay consistent.
  const displayValue = value;
  const isProvided = (key: string) => displayValue(key) !== NOT_PROVIDED;

  const overviewValue = (key: string) => {
    if (key === 'current_location' && !isProvided(key)) return value('hometown');
    if (key === 'investment_purpose' && !isProvided(key)) return value('intent');
    if (key === 'phone' && !usableContactPhone(f.phone)) return NOT_PROVIDED;
    if (key === 'property_type' && isProvided(key)) {
      const type = value(key);
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
    if (key === 'follow_up_permission') {
      if (f.qualification_status === 'OPT_OUT' || f.follow_up_permission === 'declined') return 'Do not contact';
      return ['preferred_contact_method', 'best_time_to_contact'].filter(isProvided).map(value).join(', ') || NOT_PROVIDED;
    }
    return value(key);
  };

  const statusKey = String(f.qualification_status || '').toUpperCase();
  const statusTone = statusKey === 'HOT' ? 'is-hot'
    : statusKey === 'WARM' ? 'is-warm'
    : statusKey === 'COLD' ? 'is-cold'
    : statusKey === 'REACH_AGAIN' ? 'is-reach'
    : (statusKey === 'OPT_OUT' || statusKey === 'UNWANTED') ? 'is-opt-out'
    : 'is-neutral';

  // Same offer presentation rules as before, now shown inside consistent field tiles.
  const offerValue = (key: string) => {
    if (f[key + '_offer_status']) return value(key + '_offer_status');
    if (f[key + '_offer_delivery']) return value(key + '_offer_delivery');
    return action.stage === 'closing' ? 'Not applicable while call is ending' : 'Not introduced';
  };
  const offerProvided = (key: string) => Boolean(f[key + '_offer_status'] || f[key + '_offer_delivery']);
  const offersProvidedCount = offers.filter(([key]) => offerProvided(key)).length + (isProvided('engagement_indicator') ? 1 : 0);

  return <section className="customer-intelligence" aria-label="Customer intelligence">
    <header className="ci-header">
      <div><h2 className="heading-6">Customer intelligence</h2><p className="caption-2">Disclosed requirements and recorded sales progress</p></div>
      <span className="ci-save caption-1" role="status">{saveState || 'Saved CRM record'}</span>
    </header>

    {!Object.keys(f).some(k => f[k] && k !== 'notes') && <p className="body-6 ci-empty">Customer details will appear here as they are shared. Missing information stays marked as not provided.</p>}

    <div className="ci-card ci-overview">
      <div className="ci-card-head">
        <div className="ci-card-head-main">
          <span className="ci-icon-badge"><UserCheck aria-hidden="true" /></span>
          <div className="ci-card-head-text">
            <h3 className="title-3">Customer Intelligence Overview</h3>
            <p className="caption-2">Live-captured from conversation · Overview of current requirements</p>
          </div>
        </div>
        <span className={`ci-status-chip ${statusTone}`}>{displayValue('qualification_status')}</span>
      </div>
      <dl className="ci-fields ci-overview-fields">
        {overviewFields.map(([key, label, Icon]) => <div key={key} className={`ci-field${overviewValue(key) !== NOT_PROVIDED ? '' : ' is-missing'}`}>
          <dt className="ci-field-label"><Icon className="ci-field-icon" aria-hidden="true" /><span>{label}</span></dt>
          <dd className="ci-field-value" data-field={key}>{overviewValue(key)}</dd>
        </div>)}
      </dl>
    </div>

    <div className="ci-card ci-next">
      <div className="ci-card-head">
        <div className="ci-card-head-main">
          <span className="ci-icon-badge"><ClipboardList aria-hidden="true" /></span>
          <div className="ci-card-head-text">
            <h3 className="title-3">{action.stage === 'closing' ? 'Next step' : 'Details still to collect'}</h3>
            <p className="caption-2">{action.field ? action.field.replaceAll('_', ' ') : action.stage.replaceAll('_', ' ')}</p>
          </div>
        </div>
      </div>
      <p className="body-6 ci-next-action">{f.agreed_next_action || 'No next step agreed yet'}</p>
    </div>

    <div className="ci-grid">
      {f.knowledge_sources && <details className="ci-card ci-card--wide ci-accordion">
        <summary className="ci-card-summary"><span className="ci-chevron" aria-hidden="true" /><span className="ci-card-title title-3">Knowledge evidence</span></summary>
        <div className="ci-card-body"><KnowledgeSources value={f.knowledge_sources} /></div>
      </details>}
      {groups.map(([title, fields]) => <details key={title} className="ci-card ci-accordion">
        <summary className="ci-card-summary">
          <span className="ci-chevron" aria-hidden="true" />
          <span className="ci-card-title title-3">{title}</span>
          <span className="caption-2 ci-count">{fields.filter(([key]) => isProvided(key)).length}/{fields.length} provided</span>
        </summary>
        <div className="ci-card-body">
          <dl className="ci-fields">{fields.map(([key, label]) => <div key={key} className={`ci-field${isProvided(key) ? '' : ' is-missing'}`}>
            <dt className="ci-field-label">{label}</dt>
            <dd className="ci-field-value" data-field={key}>{displayValue(key)}</dd>
          </div>)}</dl>
        </div>
      </details>)}
      <details className="ci-card ci-card--offers ci-accordion">
        <summary className="ci-card-summary">
          <span className="ci-chevron" aria-hidden="true" />
          <span className="ci-card-title title-3">Offers and engagement</span>
          <span className="caption-2 ci-count">{offersProvidedCount}/4 provided</span>
        </summary>
        <div className="ci-card-body">
          <dl className="ci-fields">
            {offers.map(([key, label]) => <div key={key} className={`ci-field${offerProvided(key) ? '' : ' is-missing'}`}>
              <dt className="ci-field-label">{label}</dt>
              <dd className="ci-field-value" data-field={key + '_offer_status'}>{offerValue(key)}</dd>
            </div>)}
            <div className={`ci-field${isProvided('engagement_indicator') ? '' : ' is-missing'}`}>
              <dt className="ci-field-label">Contextual engagement</dt>
              <dd className="ci-field-value" data-field="engagement_indicator">{value('engagement_indicator')}</dd>
              {isProvided('engagement_evidence') && <p className="caption-2 ci-field-evidence">{value('engagement_evidence')}</p>}
            </div>
          </dl>
          <p className="caption-2 ci-note">Attempted speech does not confirm playback or understanding.</p>
          <p className="caption-2 ci-note">Based on conversation, not a proven emotional state.</p>
        </div>
      </details>
    </div>
  </section>;
});

function KnowledgeSources({value}:{value:string}) {
  let rows:any[]=[];
  try { const parsed=JSON.parse(value); if(Array.isArray(parsed)) rows=parsed; } catch {}
  return <ul className="body-6 ci-knowledge-list">{rows.filter(r=>/^https:\/\//.test(r.source||'')).map((r,i)=><li key={i}><a href={r.source} target="_blank" rel="noopener noreferrer">{r.publisher||r.id}</a> — checked {r.verifiedAt}. Scope and freshness still apply.</li>)}{!rows.length&&<li>No retrieved evidence recorded.</li>}</ul>;
}

export function CustomerProfileButton({ data }: { data: Record<string, any> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button
      type="button"
      className="inline-flex h-7 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500 bg-amber-500 px-2 text-xs font-semibold text-slate-950 shadow-xs transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
      onClick={e => { e.stopPropagation(); dialog.current?.showModal(); }}
      title="View customer details"
    >
      <UserRound className="h-3 w-3" aria-hidden="true" />
      <span>Details</span>
    </button>
    <dialog ref={dialog} className="ci-dialog" aria-label="Customer details" onClick={e => e.stopPropagation()}>
      <form method="dialog" className="ci-dialog-toolbar"><button className="ci-button button-sm" autoFocus>Close details</button></form>
      <CustomerIntelligence data={data} />
    </dialog>
  </>
}
