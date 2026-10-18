/**
 * PropertyRecommendationCard.tsx — Image-led Property Result Card inside Chat
 * Lyka Realty AI CRM Design System
 * 
 * Displays match percentage, explainable breakdown, verified metro proximity,
 * and quick actions: View Details, Save to Interested, and Schedule Site Visit.
 */
import React, { useState } from 'react';
import {
  MapPin,
  CheckCircle2,
  Calendar,
  Heart,
  Eye,
  Train,
  Home,
  Check,
  AlertCircle,
  Share2,
  Trees,
  Compass,
  Zap,
  Scale,
} from 'lucide-react';
import { MatchResult } from '../../backend/services/propertyMatchingService';

interface PropertyRecommendationCardProps {
  property: MatchResult;
  onViewDetails: (property: MatchResult) => void;
  onScheduleVisit: (property: MatchResult) => void;
  onSaveInterest: (property: MatchResult) => Promise<boolean>;
  onCompare?: (property: MatchResult) => void;
  isSaved?: boolean;
}

export const PropertyRecommendationCard: React.FC<PropertyRecommendationCardProps> = ({
  property,
  onViewDetails,
  onScheduleVisit,
  onSaveInterest,
  onCompare,
  isSaved = false,
}) => {
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);

  const handleHeartClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      const ok = await onSaveInterest(property);
      if (ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const isLand = property.listing_type === 'land';

  const scoreColor =
    property.final_score >= 90
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : property.final_score >= 70
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : property.final_score >= 50
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-amber-400/40 hover:shadow-2xl hover:shadow-amber-500/10">
      {/* Listing Cover Image & Badges */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-800">
        <img
          src={property.cover_image_url || '/logo.png'}
          alt={property.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = isLand
              ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
              : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md shadow-sm ${scoreColor}`}
          >
            <span>{property.final_score}% Match</span>
            <span className="text-[10px] opacity-80">• {property.match_category}</span>
          </span>
          <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur-md border border-white/10">
            {property.property_id}
          </span>
          {isLand && (
            <span className="rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-md flex items-center gap-1">
              <Trees className="h-3 w-3" />
              <span>Plot / Land</span>
            </span>
          )}
        </div>

        {/* Favorite Save Button */}
        <button
          onClick={handleHeartClick}
          disabled={saving}
          title={saved ? 'Saved to Interested Properties' : 'Save to Interested'}
          className={`absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all shadow-md ${
            saved
              ? 'bg-rose-500 text-white shadow-rose-500/30'
              : 'bg-slate-900/70 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 border border-white/10'
          }`}
        >
          <Heart className={`h-4 w-4 ${saved ? 'fill-white' : ''}`} />
        </button>

        {/* Price & Area Overlay */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight text-white drop-shadow">
              {property.formatted_price}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5">
              <span>{property.formatted_area || `${property.built_up_area || property.total_area || ''} ${property.area_unit}`}</span>
              {!isLand && property.bedrooms && <span>• {property.bedrooms} BHK</span>}
              {isLand && property.price_per_unit && (
                <span className="text-amber-300 font-medium">({property.price_per_unit})</span>
              )}
            </div>
          </div>
          <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300 capitalize">
            {property.status}
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-3.5 space-y-3">
        {/* Title & Location */}
        <div>
          <h4 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
            {property.title}
          </h4>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            <span className="truncate">{property.location}</span>
          </div>
        </div>

        {/* Land-specific Badges (Road Access & Zoning) */}
        {isLand && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {property.road_access && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                <Compass className="h-3 w-3" />
                <span>Road: {property.road_access}</span>
              </span>
            )}
            {property.zoning && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                <span>🏛️ {property.zoning}</span>
              </span>
            )}
            {(property.water_availability || property.electricity_availability) && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <Zap className="h-3 w-3" />
                <span>Utilities Ready</span>
              </span>
            )}
          </div>
        )}

        {/* Metro Distance Pill for built properties */}
        {!isLand && property.metro_distance_display && property.metro_distance_display !== 'Not verified' && (
          <div className="flex items-center gap-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
            <Train className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span>Verified metro: <strong className="font-semibold text-white">{property.metro_distance_display}</strong></span>
          </div>
        )}

        {/* Why it Matches Checklist */}
        {property.why_it_matches && property.why_it_matches.length > 0 && (
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-2.5 space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Why it matches:</span>
              {property.data_completeness && (
                <span className="text-[10px] text-slate-500 lowercase">({property.data_completeness})</span>
              )}
            </div>
            {property.why_it_matches.slice(0, 3).map((reason, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                <span className="line-clamp-1">{reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className={`grid ${onCompare ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 pt-1 border-t border-white/5`}>
          <button
            onClick={() => onViewDetails(property)}
            className="flex items-center justify-center gap-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 px-2 py-2 text-xs font-medium text-slate-200 border border-white/10 transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span>Details</span>
          </button>

          <button
            onClick={handleHeartClick}
            disabled={saving}
            className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-all ${
              saved
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/10'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${saved ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>

          {onCompare && (
            <button
              onClick={() => onCompare(property)}
              className="flex items-center justify-center gap-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 px-2 py-2 text-xs font-medium text-slate-200 border border-white/10 transition-colors"
              title="Compare with other matches"
            >
              <Scale className="h-3.5 w-3.5 text-slate-400" />
              <span>Compare</span>
            </button>
          )}

          <button
            onClick={() => onScheduleVisit(property)}
            className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-2 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/20 transition-all"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-950" />
            <span>Visit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
