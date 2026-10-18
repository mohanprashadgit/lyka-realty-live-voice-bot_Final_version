/**
 * ScheduleSiteVisitModal.tsx — Site Visit Appointment Booking Modal
 * Lyka Realty AI CRM Design System
 * 
 * Allows customers to select preferred inspection dates, verified time slots,
 * and provide callback contact details. Persists to the real CRM database.
 */
import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Building,
} from 'lucide-react';
import { MatchResult } from '../../backend/services/propertyMatchingService';

interface ScheduleSiteVisitModalProps {
  property: MatchResult | null;
  customerId?: string | null;
  leadId?: string | null;
  initialName?: string;
  initialPhone?: string;
  onClose: () => void;
  onSuccess: (bookingId: string, details: any) => void;
}

const AVAILABLE_SLOTS = [
  '10:00 AM - 11:30 AM',
  '11:30 AM - 01:00 PM',
  '02:30 PM - 04:00 PM',
  '04:30 PM - 06:00 PM',
];

export const ScheduleSiteVisitModal: React.FC<ScheduleSiteVisitModalProps> = ({
  property,
  customerId,
  leadId,
  initialName = '',
  initialPhone = '',
  onClose,
  onSuccess,
}) => {
  if (!property) return null;

  // Next day default date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const [visitDate, setVisitDate] = useState(minDate);
  const [visitTime, setVisitTime] = useState(AVAILABLE_SLOTS[0]);
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!visitDate || !visitTime) {
      setErrorMsg('Please select both a date and time slot.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/crm/matching/site-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.listing_type === 'property' ? property.property_id : undefined,
          land_id: property.listing_type === 'land' ? property.property_id : undefined,
          customer_id: customerId || undefined,
          lead_id: leadId || undefined,
          visit_date: visitDate,
          visit_time: visitTime,
          notes: [
            notes ? `Client notes: ${notes}` : null,
            fullName ? `Contact name: ${fullName}` : null,
            phone ? `Contact phone: ${phone}` : null,
          ].filter(Boolean).join(' | '),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to book site visit.');
      }

      onSuccess(data.id, {
        propertyTitle: property.title,
        propertyLocation: property.location,
        visitDate,
        visitTime,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while booking site visit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Schedule Private Site Visit</h3>
              <p className="text-[11px] text-slate-400">Accompanied tour with a Lyka Property Specialist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selected Property Banner */}
        <div className="flex items-center gap-3 border-b border-white/5 bg-slate-950/40 p-4">
          <img
            src={property.cover_image_url || '/logo.png'}
            alt={property.title}
            className="h-12 w-12 rounded-xl object-cover shrink-0 border border-white/10"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-white truncate">{property.title}</h4>
            <div className="text-[11px] text-amber-400 font-bold">{property.formatted_price}</div>
            <div className="text-[10px] text-slate-400 truncate">{property.location}</div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>Select Date</span>
            </label>
            <input
              type="date"
              min={minDate}
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Time Slot Picker */}
          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>Preferred Slot</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SLOTS.map((slot) => (
                <button
                  type="button"
                  key={slot}
                  onClick={() => setVisitTime(slot)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                    visitTime === slot
                      ? 'border-amber-400 bg-amber-500/20 text-white font-semibold'
                      : 'border-white/5 bg-slate-950/60 text-slate-300 hover:border-white/20'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Information (if guest) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Your Name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Special Requests (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g., Interested in checking car parking clearance or vaastu"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Confirming Booking...' : 'Confirm Site Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
