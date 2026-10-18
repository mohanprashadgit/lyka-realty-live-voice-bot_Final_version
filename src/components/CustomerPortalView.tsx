/**
 * CustomerPortalView.tsx — Customer Self-Service Profile & Inquiry Portal
 * Lyka Realty CRM Design System
 * 
 * Allows authenticated customers to view & edit their personal profile,
 * location, property preferences, and budget in the customer database,
 * as well as view their linked property inquiries and site visits.
 */
import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  DollarSign,
  MessageSquare,
  Mic,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Save,
  LogOut,
  ArrowLeft,
  Sparkles,
  Clock,
  Home,
  Tag,
  Heart,
} from 'lucide-react';

export interface CustomerProfile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  current_location: string | null;
  preferred_contact: string;
  budget_range: string | null;
  preferred_property_type: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

interface CustomerPortalViewProps {
  token: string;
  initialCustomer: CustomerProfile;
  onLogout: () => void;
  onOpenChat: (withVoice?: boolean) => void;
  onBackToHome: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  token,
  initialCustomer,
  onLogout,
  onOpenChat,
  onBackToHome,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'inquiries'>('profile');
  const [customer, setCustomer] = useState<CustomerProfile>(initialCustomer);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [siteVisits, setSiteVisits] = useState<any[]>([]);
  const [interestedProps, setInterestedProps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for profile editing
  const [fullName, setFullName] = useState(customer.full_name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [email, setEmail] = useState(customer.email || '');
  const [location, setLocation] = useState(customer.current_location || '');
  const [budgetRange, setBudgetRange] = useState(customer.budget_range || '');
  const [propType, setPropType] = useState(customer.preferred_property_type || 'villa');
  const [contactPref, setContactPref] = useState(customer.preferred_contact || 'phone');
  const [notes, setNotes] = useState(customer.notes || '');

  // Fetch fresh profile data & inquiries on mount
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/crm/customer/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.customer) {
          setCustomer(data.customer);
          setFullName(data.customer.full_name || '');
          setPhone(data.customer.phone || '');
          setEmail(data.customer.email || '');
          setLocation(data.customer.current_location || '');
          setBudgetRange(data.customer.budget_range || '');
          setPropType(data.customer.preferred_property_type || 'villa');
          setContactPref(data.customer.preferred_contact || 'phone');
          setNotes(data.customer.notes || '');
          setInquiries(data.inquiries || []);
          setSiteVisits(data.siteVisits || []);
          setInterestedProps(data.interestedProperties || []);
        }
      })
      .catch(err => {
        console.error('[CustomerPortal] Fetch error:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/crm/customer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim().toLowerCase() || null,
          current_location: location.trim() || null,
          budget_range: budgetRange.trim() || null,
          preferred_property_type: propType,
          preferred_contact: contactPref,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setCustomer(data.customer);
      localStorage.setItem('lyka_customer', JSON.stringify(data.customer));
      setSuccessMsg('Profile details successfully updated in customer database!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A0C] text-[#e6e1e5] p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      {/* Top Navbar */}
      <div className="w-full max-w-4xl flex items-center justify-between pb-6 border-b border-[#28232D]">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs sm:text-sm text-[#968a7e] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Concierge</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenChat(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#d8a868] to-[#b88c4c] text-[#0B0A0C] hover:opacity-95 shadow-md shadow-[#d8a868]/15 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Talk to AI</span>
          </button>
          <button
            onClick={() => onOpenChat(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1a1820] border border-[#28232D] text-white hover:border-[#d8a868]/60 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#d8a868]" />
            <span>Chat AI</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-[#968a7e] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl mt-6 space-y-6">
        {/* Welcome Header Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#141217] via-[#1a1820] to-[#141217] border border-[#28232D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d8a868] to-[#936c34] flex items-center justify-center text-[#0B0A0C] text-2xl font-bold shadow-lg shadow-[#d8a868]/20">
              {customer.full_name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Welcome, {customer.full_name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Verified Client
                </span>
              </div>
              <p className="text-xs text-[#968a7e] mt-1 flex items-center gap-3">
                <span>📍 {customer.current_location || 'Location not set'}</span>
                <span>•</span>
                <span>📞 {customer.phone || 'No phone'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-3 rounded-xl bg-[#0B0A0C]/60 border border-[#28232D] text-right">
              <div className="text-[10px] uppercase tracking-wider text-[#968a7e] font-semibold">Active Enquiries</div>
              <div className="text-lg font-bold text-[#d8a868]">{inquiries.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#0B0A0C]/60 border border-[#28232D] text-right">
              <div className="text-[10px] uppercase tracking-wider text-[#968a7e] font-semibold">Site Visits</div>
              <div className="text-lg font-bold text-white">{siteVisits.length}</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-[#28232D] pb-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-[#d8a868]/15 text-[#d8a868] border border-[#d8a868]/40'
                : 'text-[#968a7e] hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Profile & Preferences</span>
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'inquiries'
                ? 'bg-[#d8a868]/15 text-[#d8a868] border border-[#d8a868]/40'
                : 'text-[#968a7e] hover:text-white'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>My Inquiries & Site Visits ({inquiries.length + siteVisits.length})</span>
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: Profile & Preferences */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-[#141217] border border-[#28232D] rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-[#28232D] pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Customer Database Profile</h2>
                <p className="text-xs text-[#968a7e]">
                  Update your contact information, location, and property preferences. Your AI Assistant uses these details automatically.
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#d8a868]/80 bg-[#1a1820] px-2.5 py-1 rounded-lg border border-[#28232D]">
                ID: {customer.id.slice(0, 12)}...
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Anand Sundaram"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Mobile Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. +91 98400 12345"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. anand@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Current Location */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Current City / Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Anna Nagar, Chennai or Dubai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Budget Range */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Budget Range
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={budgetRange}
                    onChange={e => setBudgetRange(e.target.value)}
                    placeholder="e.g. ₹1.5 Cr - ₹2.5 Cr or 2M AED"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Preferred Property Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Preferred Property Type
                </label>
                <select
                  value={propType}
                  onChange={e => setPropType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                >
                  <option value="apartment">Apartment / Flat (2BHK / 3BHK)</option>
                  <option value="villa">Independent Villa / Gated Villa</option>
                  <option value="residential_land">Residential Plot / Land (Cents/Grounds)</option>
                  <option value="agricultural_land">Agricultural Land / Farm House</option>
                  <option value="commercial">Commercial Building / Office / Shop</option>
                  <option value="penthouse">Luxury Penthouse</option>
                </select>
              </div>

              {/* Preferred Contact Method */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Preferred Contact Method
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'phone', label: '📞 Phone Call' },
                    { id: 'whatsapp', label: '💬 WhatsApp' },
                    { id: 'email', label: '📧 Email' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setContactPref(m.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        contactPref === m.id
                          ? 'bg-[#d8a868]/20 border-[#d8a868] text-white'
                          : 'bg-[#1a1820] border-[#28232D] text-[#968a7e] hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special Requirements / Notes */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#d8a868] mb-1.5">
                  Specific Requirements or Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Looking for a sea-facing 3BHK on ECR with private garden, ready to move within 2 months..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t border-[#28232D] flex items-center justify-between">
              <span className="text-xs text-[#968a7e]">
                Updates will be immediately saved to your database record.
              </span>
              <button
                type="submit"
                disabled={isSaving}
                className="py-2.5 px-6 rounded-xl font-bold text-xs bg-gradient-to-r from-[#d8a868] to-[#b88c4c] text-[#0B0A0C] hover:opacity-95 active:scale-[0.99] transition-all flex items-center gap-2 shadow-lg shadow-[#d8a868]/15 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0B0A0C] border-t-transparent rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Inquiries & Site Visits */}
        {activeTab === 'inquiries' && (
          <div className="space-y-6">
            {/* Saved Interested Properties */}
            <div className="bg-[#141217] border border-[#28232D] rounded-2xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                  <span>Saved Interested Properties</span>
                </span>
                <span className="text-xs text-[#968a7e] font-normal">{interestedProps.length} saved</span>
              </h2>

              {interestedProps.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#1a1820] border border-[#28232D] text-center text-xs text-[#968a7e]">
                  No properties saved to favorites yet. Click the heart icon on any property recommendation in chat to save it!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {interestedProps.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-[#1a1820] border border-[#28232D] flex items-center gap-3"
                    >
                      <img
                        src={item.cover_image_url || '/logo.png'}
                        alt={item.title}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                        <div className="text-xs font-bold text-[#d8a868] mt-0.5">
                          {Number(item.price) >= 10000000
                            ? `₹${(Number(item.price) / 10000000).toFixed(2)} Cr`
                            : Number(item.price) >= 100000
                            ? `₹${(Number(item.price) / 100000).toFixed(0)} Lakh`
                            : `₹${Number(item.price).toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-[#968a7e] truncate">📍 {item.locality}</div>
                      </div>
                      <button
                        onClick={() => onOpenChat()}
                        className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/25 transition-colors shrink-0"
                      >
                        Inquire
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scheduled Site Visits */}
            <div className="bg-[#141217] border border-[#28232D] rounded-2xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#d8a868]" />
                <span>My Scheduled Site Visits</span>
              </h2>

              {siteVisits.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#1a1820] border border-[#28232D] text-center text-xs text-[#968a7e]">
                  No site visits currently scheduled. Ask our AI Assistant to book a private site inspection for you!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {siteVisits.map((v, idx) => (
                    <div
                      key={v.id || idx}
                      className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {v.property_title || 'Exclusive Property Visit'}
                        </div>
                        <div className="text-xs text-[#968a7e] flex items-center gap-2 mt-1">
                          <span>📍 {v.property_city || 'Chennai'}</span>
                          <span>•</span>
                          <span>💰 ₹{Number(v.property_price || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#d8a868]/15 text-[#d8a868] border border-[#d8a868]/30">
                          {v.status?.toUpperCase() || 'SCHEDULED'}
                        </span>
                        <div className="text-[11px] text-[#968a7e] mt-1 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          <span>{v.scheduled_at ? new Date(v.scheduled_at).toLocaleDateString() : 'Upcoming'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recorded Inquiries */}
            <div className="bg-[#141217] border border-[#28232D] rounded-2xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Home className="w-4 h-4 text-[#d8a868]" />
                <span>Recorded Property Enquiries & Leads</span>
              </h2>

              {inquiries.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#1a1820] border border-[#28232D] text-center text-xs text-[#968a7e]">
                  No past inquiries recorded yet. Start a conversation with our AI assistant to register your requirements!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {inquiries.map((inq, idx) => (
                    <div
                      key={inq.id || idx}
                      className="p-3.5 rounded-xl bg-[#1a1820] border border-[#28232D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">
                          Looking for {inq.property_type || 'Property'} in {inq.city || 'Chennai'}
                        </div>
                        <div className="text-[#968a7e] mt-1">
                          {inq.notes || 'Inquiry registered through concierge'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          inq.temperature === 'HOT'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {inq.temperature || 'WARM'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          {inq.pipeline_status || 'In Progress'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerPortalView;
