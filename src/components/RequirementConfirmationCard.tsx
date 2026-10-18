/**
 * RequirementConfirmationCard.tsx — Requirement Confirmation Panel in Chat
 * Lyka Realty AI CRM Design System
 * 
 * Shows what the AI assistant understood, with options to Confirm & Search,
 * Edit specific fields, or Continue with preferences.
 */
import React, { useState } from 'react';
import {
  Check,
  Edit2,
  Search,
  Sparkles,
  MapPin,
  Home,
  IndianRupee,
  Train,
  ShieldCheck,
  ChevronRight,
  Trees,
  Compass,
  Zap,
} from 'lucide-react';
import { StructuredRequirements, formatINR } from '../../backend/services/propertyMatchingService';

interface RequirementConfirmationCardProps {
  requirements: StructuredRequirements;
  onConfirm: (req: StructuredRequirements) => void;
  onEdit: (updatedReq: StructuredRequirements) => void;
  onContinue: (req: StructuredRequirements) => void;
  isLoading?: boolean;
}

export const RequirementConfirmationCard: React.FC<RequirementConfirmationCardProps> = ({
  requirements,
  onConfirm,
  onEdit,
  onContinue,
  isLoading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReq, setEditedReq] = useState<StructuredRequirements>({ ...requirements });

  const isLand =
    editedReq.listing_category === 'land' ||
    editedReq.property_type === 'residential_plot' ||
    editedReq.property_type === 'plot' ||
    editedReq.property_type === 'land';

  const formatSummaryItems = () => {
    const items: Array<{ icon: any; label: string; value: string }> = [];

    // Category / Configuration
    if (isLand) {
      items.push({
        icon: Trees,
        label: 'Category',
        value: editedReq.intended_use
          ? `${editedReq.intended_use.charAt(0).toUpperCase() + editedReq.intended_use.slice(1)} Land / Plot`
          : 'Residential Land / Plot',
      });

      if (editedReq.area_min || editedReq.area_max) {
        const areaStr = editedReq.area_min && editedReq.area_max
          ? `${editedReq.area_min} - ${editedReq.area_max} ${editedReq.area_unit || 'cents'}`
          : `${editedReq.area_min || editedReq.area_max} ${editedReq.area_unit || 'cents'}`;
        items.push({
          icon: Compass,
          label: 'Plot Area',
          value: areaStr,
        });
      }

      if (editedReq.road_access_required) {
        items.push({
          icon: Compass,
          label: 'Road Access',
          value: editedReq.min_road_width_ft
            ? `Required (${editedReq.min_road_width_ft} ft wide road)`
            : 'Required / Preferred',
        });
      }

      if (editedReq.zoning) {
        items.push({
          icon: ShieldCheck,
          label: 'Zoning / Approval',
          value: editedReq.zoning,
        });
      }
    } else {
      const propVal = [
        editedReq.bedrooms ? `${editedReq.bedrooms} BHK` : null,
        editedReq.property_type ? editedReq.property_type : 'Property',
      ].filter(Boolean).join(' ');
      items.push({ icon: Home, label: 'Property', value: propVal || 'Residential Property' });

      if (editedReq.near_metro !== undefined && editedReq.near_metro !== null) {
        items.push({
          icon: Train,
          label: 'Near Metro',
          value: editedReq.near_metro ? 'Yes (within walking/corridor distance)' : 'No specific requirement',
        });
      }
    }

    // Location
    items.push({
      icon: MapPin,
      label: 'Location',
      value: editedReq.locality ? `${editedReq.locality}, ${editedReq.city || 'Chennai'}` : (editedReq.location || 'Chennai'),
    });

    // Budget
    if (editedReq.budget_max) {
      items.push({
        icon: IndianRupee,
        label: 'Budget',
        value: `Up to ${formatINR(editedReq.budget_max)}${editedReq.strict_budget ? ' (Strict Limit)' : ''}`,
      });
    }

    // Locality preference
    if (editedReq.locality_preference) {
      items.push({
        icon: ShieldCheck,
        label: 'Locality',
        value: editedReq.locality_preference.charAt(0).toUpperCase() + editedReq.locality_preference.slice(1) + ' locality',
      });
    }

    return items;
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    onEdit(editedReq);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/90 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-slate-900 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Requirement Confirmation</div>
            <div className="text-[11px] text-slate-400">
              {isLand ? 'Understood requirements for Land / Plot discovery:' : 'Here is what I understood from your preferences:'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-1 rounded-lg bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
        >
          <Edit2 className="h-3 w-3" />
          <span>{isEditing ? 'Cancel' : 'Edit'}</span>
        </button>
      </div>

      {/* Body: Read-only summary or Edit Form */}
      <div className="p-4">
        {!isEditing ? (
          <div className="space-y-2.5">
            {formatSummaryItems().map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-start justify-between rounded-xl bg-slate-950/50 px-3 py-2 border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Icon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>{item.label}:</span>
                  </div>
                  <div className="text-xs font-medium text-white text-right">{item.value}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Listing Category</label>
                <select
                  value={editedReq.listing_category || (isLand ? 'land' : 'property')}
                  onChange={(e) => {
                    const cat = e.target.value as 'property' | 'land' | 'any';
                    setEditedReq({
                      ...editedReq,
                      listing_category: cat,
                      property_type: cat === 'land' ? 'residential_plot' : 'apartment',
                    });
                  }}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                >
                  <option value="property">Built Property (House/Flat)</option>
                  <option value="land">Land / Plot / Site</option>
                  <option value="any">Any (Land or Property)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Type / Intended Use</label>
                {editedReq.listing_category === 'land' ? (
                  <select
                    value={editedReq.intended_use || 'residential'}
                    onChange={(e) => setEditedReq({ ...editedReq, intended_use: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                  >
                    <option value="residential">Residential Land</option>
                    <option value="commercial">Commercial Plot</option>
                    <option value="agricultural">Agricultural Land</option>
                    <option value="investment">Investment Land</option>
                  </select>
                ) : (
                  <select
                    value={editedReq.property_type || 'apartment'}
                    onChange={(e) => setEditedReq({ ...editedReq, property_type: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                  >
                    <option value="apartment">Apartment</option>
                    <option value="villa">Villa / House</option>
                    <option value="penthouse">Penthouse</option>
                  </select>
                )}
              </div>
            </div>

            {/* Land Area vs Bedroom Selector */}
            {editedReq.listing_category === 'land' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Land Area</label>
                  <input
                    type="number"
                    value={editedReq.area_max || editedReq.area_min || ''}
                    placeholder="e.g. 5, 2400"
                    onChange={(e) => setEditedReq({ ...editedReq, area_max: e.target.value ? Number(e.target.value) : null })}
                    className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Unit</label>
                  <select
                    value={editedReq.area_unit || 'cents'}
                    onChange={(e) => setEditedReq({ ...editedReq, area_unit: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                  >
                    <option value="cents">Cents</option>
                    <option value="sqft">Sq. Ft.</option>
                    <option value="grounds">Grounds (2,400 sq.ft)</option>
                    <option value="acres">Acres</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[11px] text-slate-400">Bedrooms</label>
                <select
                  value={editedReq.bedrooms || ''}
                  onChange={(e) => setEditedReq({ ...editedReq, bedrooms: e.target.value ? parseInt(e.target.value, 10) : null })}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                >
                  <option value="">Any BHK</option>
                  <option value="1">1 BHK</option>
                  <option value="2">2 BHK</option>
                  <option value="3">3 BHK</option>
                  <option value="4">4 BHK</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Locality (Chennai / Suburbs)</label>
                <input
                  type="text"
                  value={editedReq.locality || ''}
                  placeholder="e.g. OMR, ECR, Tambaram"
                  onChange={(e) => setEditedReq({ ...editedReq, locality: e.target.value, location: `${e.target.value}, Chennai` })}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Max Budget (₹)</label>
                <input
                  type="number"
                  value={editedReq.budget_max || ''}
                  placeholder="e.g. 4000000"
                  onChange={(e) => setEditedReq({ ...editedReq, budget_max: e.target.value ? Number(e.target.value) : null })}
                  className="w-full mt-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {editedReq.listing_category === 'land' ? (
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editedReq.road_access_required}
                    onChange={(e) => setEditedReq({ ...editedReq, road_access_required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-white/10 accent-amber-400"
                  />
                  <span>Must have verified Road Access</span>
                </label>
              ) : (
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editedReq.near_metro}
                    onChange={(e) => setEditedReq({ ...editedReq, near_metro: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-white/10 accent-amber-400"
                  />
                  <span>Must be near Metro</span>
                </label>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editedReq.strict_budget}
                  onChange={(e) => setEditedReq({ ...editedReq, strict_budget: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-white/10 accent-amber-400"
                />
                <span>Strict Budget Limit</span>
              </label>

              <button
                onClick={handleSaveEdit}
                className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Apply Changes
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isEditing && (
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={() => onConfirm(editedReq)}
              disabled={isLoading}
              className="w-full sm:flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-2.5 px-3 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{isLoading ? 'Searching Inventory...' : (isLand ? 'Confirm & Search Land Inventory' : 'Confirm & Search Inventory')}</span>
            </button>

            <button
              onClick={() => onContinue(editedReq)}
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 px-3 text-xs font-medium text-slate-300 transition-colors"
            >
              <span>Continue with preferences</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
