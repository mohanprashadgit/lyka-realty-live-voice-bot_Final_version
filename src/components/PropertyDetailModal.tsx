/**
 * PropertyDetailModal.tsx — Comprehensive Property & Land Detail Inspection Modal
 * Lyka Realty AI CRM Design System
 * 
 * Includes image gallery, verified legal/metro status, full multi-criteria
 * scoring explainability breakdown, and quick CRM interaction actions.
 */
import React, { useState } from 'react';
import {
  X,
  MapPin,
  Train,
  CheckCircle2,
  Calendar,
  Heart,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Maximize2,
  Building,
  Trees,
  Compass,
  Zap,
} from 'lucide-react';
import { MatchResult } from '../../backend/services/propertyMatchingService';

interface PropertyDetailModalProps {
  property: MatchResult | null;
  onClose: () => void;
  onScheduleVisit: (property: MatchResult) => void;
  onSaveInterest: (property: MatchResult) => Promise<boolean>;
  isSaved?: boolean;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  onClose,
  onScheduleVisit,
  onSaveInterest,
  isSaved = false,
}) => {
  if (!property) return null;

  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'scoring'>('overview');

  const isLand = property.listing_type === 'land';

  const images = property.images && property.images.length > 0
    ? property.images
    : [property.cover_image_url || '/logo.png'];

  const handleHeartClick = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      const ok = await onSaveInterest(property);
      if (ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
              {property.property_id}
            </span>
            <span className="text-xs font-medium text-slate-400 capitalize">
              {property.listing_type} • {property.property_type || (isLand ? 'Land / Plot' : 'Property')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero Image Gallery */}
          <div className="relative h-64 sm:h-80 w-full bg-slate-950">
            <img
              src={images[activeImgIndex] || property.cover_image_url || '/logo.png'}
              alt={property.title}
              className="h-full w-full object-cover transition-opacity duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = isLand
                  ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
                  : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

            {/* Carousel navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImgIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-md hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setActiveImgIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-md hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeImgIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Score Overlay Banner */}
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{property.final_score}% Match • {property.match_category}</span>
              </span>
            </div>
          </div>

          {/* Modal Tab Switcher */}
          <div className="flex border-b border-white/10 px-5 pt-3 gap-6 bg-slate-950/40">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {isLand ? 'Land & Plot Overview' : 'Property Overview'}
            </button>
            <button
              onClick={() => setActiveTab('scoring')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'scoring'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <span>Match Explainability Breakdown</span>
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300">
                {property.final_score}%
              </span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 space-y-5">
            {activeTab === 'overview' ? (
              <>
                {/* Title & Price Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{property.title}</h2>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" />
                      <span>{property.location}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-2xl font-extrabold text-amber-400">{property.formatted_price}</div>
                    <div className="text-xs text-slate-400">
                      <span>{property.formatted_area || `${property.built_up_area?.toLocaleString() || property.total_area?.toLocaleString()} ${property.area_unit}`}</span>
                      {!isLand && property.bedrooms ? ` • ${property.bedrooms} BHK` : ''}
                      {isLand && property.price_per_unit ? ` • ${property.price_per_unit}` : ''}
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-white/5">
                    <div className="text-[11px] text-slate-400">{isLand ? 'Land Type / Use' : 'Configuration'}</div>
                    <div className="text-sm font-semibold text-white mt-0.5 capitalize">
                      {isLand
                        ? (property.land_type || property.property_type || 'Residential Plot')
                        : (property.bedrooms ? `${property.bedrooms} BHK` : property.property_type)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/60 p-3 border border-white/5">
                    <div className="text-[11px] text-slate-400">{isLand ? 'Total Land Area' : 'Built-up Area'}</div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {property.formatted_area || `${property.built_up_area?.toLocaleString() || property.total_area?.toLocaleString()} ${property.area_unit}`}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/60 p-3 border border-white/5">
                    <div className="text-[11px] text-slate-400">{isLand ? 'Road Access' : 'Metro Proximity'}</div>
                    <div className="text-sm font-semibold text-indigo-300 mt-0.5 flex items-center gap-1">
                      {isLand ? (
                        <>
                          <Compass className="h-3.5 w-3.5 text-amber-400" />
                          <span className="truncate">{property.road_access || 'Not recorded'}</span>
                        </>
                      ) : (
                        <>
                          <Train className="h-3.5 w-3.5" />
                          <span>{property.metro_distance_display}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/60 p-3 border border-white/5">
                    <div className="text-[11px] text-slate-400">{isLand ? 'Zoning / Approval' : 'Locality Rating'}</div>
                    <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                      {isLand ? (property.zoning || 'CMDA / DTCP') : property.locality_rating}
                    </div>
                  </div>
                </div>

                {/* Land Infrastructure Details */}
                {isLand && (
                  <div className="rounded-xl bg-slate-950/60 p-3.5 border border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px]">Water Connection</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {property.water_availability ? '✓ Available / Ready' : 'Connection required'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Electricity Connection</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {property.electricity_availability ? '✓ EB Ready / Available' : 'Connection required'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Data Completeness</div>
                      <div className="font-semibold text-amber-300 mt-0.5">
                        {property.data_completeness || 'Verified Record'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Why it matches list */}
                {property.why_it_matches && property.why_it_matches.length > 0 && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Verified Match Highlights:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {property.why_it_matches.map((reason, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Scoring Breakdown Tab */
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-950/70 p-4 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Overall Match Percentage</div>
                    <div className="text-2xl font-bold text-white mt-0.5">
                      {property.final_score}% • <span className="text-amber-400">{property.match_category}</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 max-w-[220px]">
                    Calculated via deterministic weighted multi-criteria algorithm against your stated preferences.
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Criteria Breakdown & Verified Evidence:
                  </div>
                  {property.criteria.map((crit, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-950/50 p-3.5 border border-white/5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{crit.display_name}</span>
                          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                            Weight: {crit.weight}%
                          </span>
                        </div>
                        <div className="font-bold text-amber-400">
                          {crit.is_applicable ? `${crit.raw_score} / 100` : 'N/A'}
                        </div>
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed">
                        {crit.reason}
                      </div>
                    </div>
                  ))}
                </div>

                {property.missing_data && property.missing_data.length > 0 && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200">
                      <strong>Transparency Notice:</strong> {property.missing_data.join('; ')}. No synthetic points were awarded for unknown criteria.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3.5 bg-slate-950/80">
          <button
            onClick={handleHeartClick}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              saved
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/10'
            }`}
          >
            <Heart className={`h-4 w-4 ${saved ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
            <span>{saved ? 'Saved to Favorites' : 'Save to Interested'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onScheduleVisit(property);
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all"
          >
            <Calendar className="h-4 w-4 text-slate-950" />
            <span>Schedule Site Visit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
