import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Building,
  DollarSign,
  MapPin,
  Calendar,
  Flame,
  SunMedium,
  Snowflake,
  ShieldBan,
  Save,
  CheckCircle2,
  FileText,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { LeadRecord, LeadOutcome, LeadCallStatus } from '../types/agent';

interface EditLeadModalProps {
  isOpen: boolean;
  lead: LeadRecord | null;
  onClose: () => void;
  onSaveLead: (id: string, updates: Partial<LeadRecord>) => void;
}

export const EditLeadModal: React.FC<EditLeadModalProps> = ({
  isOpen,
  lead,
  onClose,
  onSaveLead,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Website');
  const [consent, setConsent] = useState(true);
  const [isOptedOut, setIsOptedOut] = useState(false);
  const [interest, setInterest] = useState('');
  const [buyerType, setBuyerType] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [timeline, setTimeline] = useState('');
  const [outcome, setOutcome] = useState<LeadOutcome>('PENDING');
  const [callStatus, setCallStatus] = useState<LeadCallStatus>('NOT_CALLED');
  const [notes, setNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (lead) {
      setName(lead.name || '');
      setPhone(lead.phone || '');
      setEmail(lead.email || '');
      setSource(lead.source || 'Website');
      setConsent(lead.consent ?? true);
      setIsOptedOut(Boolean(lead.isOptedOut || lead.outcome === 'OPT_OUT'));
      setInterest(lead.interest || '');
      setBuyerType(lead.buyerType || '');
      setPropertyType(lead.propertyType || '');
      setBudget(lead.budget || '');
      setLocation(lead.location || '');
      setTimeline(lead.timeline || '');
      setOutcome(lead.outcome || 'PENDING');
      setCallStatus(lead.callStatus || 'NOT_CALLED');
      setNotes(lead.notes || '');
      setSavedSuccess(false);
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert('Phone number cannot be empty.');
      return;
    }

    onSaveLead(lead.id, {
      name: name.trim() || 'Valued Lead',
      phone: phone.trim(),
      email: email.trim(),
      source: source.trim() || 'Direct',
      consent,
      isOptedOut,
      interest: interest.trim(),
      buyerType: buyerType.trim(),
      propertyType: propertyType.trim(),
      budget: budget.trim(),
      location: location.trim(),
      timeline: timeline.trim(),
      outcome: isOptedOut ? 'OPT_OUT' : outcome,
      callStatus,
      notes: notes.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Edit Lead Details: {lead.name}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Update prospect profile, qualification criteria, and CRM status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Section 1: Contact Information */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>Contact Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Full Name <span className="text-amber-500 dark:text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Phone Number (E.164) <span className="text-amber-500 dark:text-amber-400">*</span></span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">+CountryCode</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971500000001 or +919876543210"
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Lead Source */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Lead Acquisition Source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Website">Website Form</option>
                  <option value="Campaign">Marketing Campaign</option>
                  <option value="Roadshow">Property Roadshow / Expo</option>
                  <option value="Referral">Client Referral</option>
                  <option value="Property Finder">Property Finder / Portal</option>
                  <option value="Google Ads">Google Ads / Paid Search</option>
                  <option value="CSV Import">CSV Import</option>
                  <option value="Cold Outbound">Cold Outbound</option>
                </select>
              </div>
            </div>

            {/* Consent & DNC Toggles */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] text-slate-700 dark:text-slate-300">
                  Explicit Marketing Consent on file (✓ Opt-in)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-500/30">
                <input
                  type="checkbox"
                  checked={isOptedOut}
                  onChange={(e) => {
                    setIsOptedOut(e.target.checked);
                    if (e.target.checked) setOutcome('OPT_OUT');
                  }}
                  className="rounded text-rose-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1">
                  <ShieldBan className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                  <span>Mark as Opt-Out (Do Not Call)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Section 2: Property Requirements & Qualification Criteria */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Building className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span>Real Estate Qualification Requirements</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Interest */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Interest Intent
                </label>
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  placeholder="e.g. Looking to buy, Investor"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Buyer Type */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Buyer Profile
                </label>
                <input
                  type="text"
                  value={buyerType}
                  onChange={(e) => setBuyerType(e.target.value)}
                  placeholder="e.g. First-time, Upgrading, NRI"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Property Type
                </label>
                <input
                  type="text"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  placeholder="e.g. 2BHK Apartment, Villa"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Budget Range
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. AED 1.5M, ₹1.5 Cr"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-amber-600 dark:text-amber-400 font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Preferred Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Dubai Marina, OMR Chennai"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Purchase Timeline
                </label>
                <input
                  type="text"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  placeholder="e.g. 1-2 months, Immediate"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-cyan-600 dark:text-cyan-400 font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: CRM Status & Outcome */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              <span>CRM Classification &amp; Notes</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Call Status */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Call Status
                </label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value as LeadCallStatus)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="NOT_CALLED">Not Called</option>
                  <option value="CALLING">Calling...</option>
                  <option value="CONNECTED">Connected</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_ANSWER">No Answer</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              {/* Qualification Outcome */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Lead Classification Outcome
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as LeadOutcome)}
                  disabled={isOptedOut}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="PENDING">PENDING (Unclassified)</option>
                  <option value="HOT">HOT 🔥 (Immediate buyer &lt; 90 days + budget)</option>
                  <option value="WARM">WARM ☀️ (Interested, 3-6 mo or flexible)</option>
                  <option value="COLD">COLD ❄️ (Not ready / casual exploring)</option>
                  <option value="OPT_OUT">OPT-OUT 🛑 (Do Not Call)</option>
                  <option value="NO_ANSWER">NO ANSWER (Unreachable)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Internal Notes &amp; Agent Remarks
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special instructions, preferred callback time, or property requirements..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            {savedSuccess ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Changes saved successfully!</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                ID: {lead.id}
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/15"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Lead Details</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
