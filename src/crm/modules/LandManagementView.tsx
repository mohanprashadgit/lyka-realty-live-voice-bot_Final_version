/**
 * LandManagementView.tsx — Luxury Land Parcels & Agricultural / Residential Plots
 * Aura Privé design system • Responsive image cards & data table • Multi-image upload
 */
import React, { useEffect, useState, useRef } from 'react';
import { useCrm } from '../context/CrmContext';
import { hasActionPermission } from '../permissions';
import {
  Trees,
  Search,
  RefreshCw,
  Plus,
  MapPin,
  FileCheck2,
  Maximize2,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
  X,
  Upload,
  Trash2,
  Eye,
  Edit,
  AlertTriangle,
  Compass,
  Droplet,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';

const FALLBACK_LAND_IMG = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80';

export const LandManagementView: React.FC = () => {
  const { activeRole, theme, authFetch } = useCrm();
  const isDark = theme === 'dark';

  const canManage = hasActionPermission(activeRole, 'land', 'update') || ['Super Admin', 'Operations Admin'].includes(activeRole);

  const [landListings, setLandListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedLand, setSelectedLand] = useState<any | null>(null);

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('residential_plot');
  const [formPrice, setFormPrice] = useState('');
  const [formPricePerUnit, setFormPricePerUnit] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formAreaUnit, setFormAreaUnit] = useState('cents');
  const [formSurveyNo, setFormSurveyNo] = useState('');
  const [formPlotNo, setFormPlotNo] = useState('');
  const [formLocality, setFormLocality] = useState('');
  const [formCity, setFormCity] = useState('Chennai');
  const [formAddress, setFormAddress] = useState('');
  const [formRoadAccess, setFormRoadAccess] = useState('40 ft Blacktop Tar Road');
  const [formUtilities, setFormUtilities] = useState('EB Three-Phase Power, Borewell Water');
  const [formZoning, setFormZoning] = useState('CMDA & RERA Approved');
  const [formDocStatus, setFormDocStatus] = useState('Clear Parent Document Title, Patta Available');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('available');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLand = () => {
    setLoading(true);
    setForbiddenError(null);
    authFetch('/api/crm/land')
      .then(res => {
        if (res.status === 403) {
          return res.json().then(d => {
            setForbiddenError(d.error || 'Access Denied');
            setLandListings([]);
          });
        }
        return res.json().then(d => {
          if (d.success) setLandListings(d.data || []);
        });
      })
      .catch(err => console.error('[LandManagementView] Fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLand();
  }, [activeRole]);

  const filtered = landListings.filter(l => {
    const matchesSearch =
      !search ||
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.city?.toLowerCase().includes(search.toLowerCase()) ||
      l.survey_number?.toLowerCase().includes(search.toLowerCase()) ||
      l.plot_number?.toLowerCase().includes(search.toLowerCase()) ||
      l.id?.toLowerCase().includes(search.toLowerCase()) ||
      l.locality?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'ALL' || l.land_type?.toLowerCase() === typeFilter.toLowerCase();
    const matchesStatus = statusFilter === 'ALL' || l.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesType && matchesStatus;
  });

  const formatPrice = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormTitle('');
    setFormType('residential_plot');
    setFormPrice('');
    setFormPricePerUnit('');
    setFormArea('');
    setFormAreaUnit('cents');
    setFormSurveyNo('');
    setFormPlotNo('');
    setFormLocality('ECR');
    setFormCity('Chennai');
    setFormAddress('');
    setFormRoadAccess('40 ft Blacktop Tar Road');
    setFormUtilities('EB Three-Phase Power, Borewell Water');
    setFormZoning('CMDA & RERA Approved');
    setFormDocStatus('Clear Parent Document Title, Patta Available');
    setFormDescription('');
    setFormStatus('available');
    setFormImages([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (land: any) => {
    setIsEditing(true);
    setEditingId(land.id);
    setFormTitle(land.title || '');
    setFormType(land.land_type || 'residential_plot');
    setFormPrice(String(land.price || ''));
    setFormPricePerUnit(String(land.price_per_unit || ''));
    setFormArea(String(land.total_area || ''));
    setFormAreaUnit(land.area_unit || 'cents');
    setFormSurveyNo(land.survey_number || '');
    setFormPlotNo(land.plot_number || '');
    setFormLocality(land.locality || '');
    setFormCity(land.city || 'Chennai');
    setFormAddress(land.full_address || land.address || '');
    setFormRoadAccess(land.road_access || '40 ft Blacktop Tar Road');
    setFormUtilities(land.utilities || 'EB Three-Phase Power, Borewell Water');
    setFormZoning(land.zoning_details || 'CMDA Approved');
    setFormDocStatus(land.verification_status || 'Verified Title');
    setFormDescription(land.description || '');
    setFormStatus(land.status || 'available');

    let parsedImgs: string[] = [];
    if (Array.isArray(land.images)) {
      parsedImgs = land.images;
    } else if (typeof land.images === 'string') {
      try { parsedImgs = JSON.parse(land.images); } catch { parsedImgs = land.images ? [land.images] : []; }
    }
    setFormImages(parsedImgs);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setFormError('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
          setFormError('Invalid image format. Please select JPEG, PNG, or WebP images.');
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          setFormError('Image size exceeds 8MB limit.');
          continue;
        }

        // Downscale image if large using client canvas for fast upload and zero crash
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const maxDim = 1920;
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.88));
              } else {
                resolve(e.target?.result as string);
              }
            };
            img.onerror = () => resolve(e.target?.result as string);
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await authFetch('/api/crm/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            filename: file.name.replace(/\.[^.]+$/, '.jpg'),
            folder: 'listings',
          }),
        });

        const resText = await res.text();
        let uploadData: any = null;
        try {
          uploadData = resText ? JSON.parse(resText) : null;
        } catch {
          throw new Error(`Upload server error (${res.status}: ${res.statusText || 'Non-JSON response'})`);
        }

        if (!res.ok || !uploadData?.success || !uploadData?.url) {
          setFormError(uploadData?.error || `Upload failed with status ${res.status}`);
        } else {
          setFormImages(prev => [...prev, uploadData.url]);
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Image upload error.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setFormImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a listing title.');
      return;
    }
    if (!formPrice || isNaN(Number(formPrice))) {
      setFormError('Please enter a valid asking price.');
      return;
    }
    if (!formArea || isNaN(Number(formArea))) {
      setFormError('Please enter total area.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    const payload = {
      title: formTitle.trim(),
      land_type: formType,
      price: Number(formPrice),
      price_per_unit: formPricePerUnit ? Number(formPricePerUnit) : null,
      total_area: Number(formArea),
      area_unit: formAreaUnit,
      survey_number: formSurveyNo.trim(),
      plot_number: formPlotNo.trim(),
      locality: formLocality.trim(),
      city: formCity.trim(),
      full_address: formAddress.trim(),
      road_access: formRoadAccess.trim(),
      utilities: formUtilities.trim(),
      zoning_details: formZoning.trim(),
      verification_status: formDocStatus.trim(),
      description: formDescription.trim(),
      status: formStatus,
      images: formImages,
    };

    try {
      const url = isEditing && editingId ? `/api/crm/land/${editingId}` : '/api/crm/land';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to save land listing.');
        setFormSubmitting(false);
        return;
      }

      setIsFormOpen(false);
      fetchLand();
    } catch (err: any) {
      setFormError(err.message || 'Error communicating with server.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const parseLandImages = (land: any): string[] => {
    if (Array.isArray(land.images) && land.images.length > 0) return land.images;
    if (typeof land.images === 'string' && land.images.trim()) {
      try {
        const parsed = JSON.parse(land.images);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        return [land.images];
      }
    }
    return [FALLBACK_LAND_IMG];
  };

  if (forbiddenError) {
    return (
      <div className="py-20 text-center rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 max-w-xl mx-auto">
        <ShieldCheck className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white">Access Denied</h3>
        <p className="text-xs text-[#968a7e] mt-2">{forbiddenError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-200">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
            <span>Land Inventory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] font-mono font-bold border border-[#d8a868]/30">
              {landListings.length} Parcels
            </span>
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-[#968a7e]' : 'text-[#817568]'}`}>
            Plots, agricultural parcels, commercial acreage, and coastal development tracts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Card / Table View Toggle */}
          <div className={`p-1 rounded-xl border flex items-center ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#d8a868]/20 text-[#d8a868] font-bold'
                  : 'text-[#968a7e] hover:text-white'
              }`}
              title="Image Cards Grid"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#d8a868]/20 text-[#d8a868] font-bold'
                  : 'text-[#968a7e] hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={fetchLand}
            disabled={loading}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#28232D] bg-[#18161B] text-[#968a7e] hover:text-white'
                : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e]'
            }`}
            title="Refresh Land Listings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d8a868]' : ''}`} />
          </button>

          {canManage && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#d8a868] to-[#b88c4c] text-[#0B0A0C] hover:opacity-95 shadow-md shadow-[#d8a868]/15 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Land Listing</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Search & Filters ────────────────────────────────────────── */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
        isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
      }`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#968a7e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, survey number, plot number, or locality..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-[#d8a868]/60 ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-white placeholder-[#968a7e]/60' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-white' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
            }`}
          >
            <option value="ALL">All Types</option>
            <option value="residential_plot">Residential Plot</option>
            <option value="agricultural">Agricultural / Farm</option>
            <option value="commercial">Commercial Land</option>
            <option value="industrial">Industrial Plot</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-white' : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e]'
            }`}
          >
            <option value="ALL">All Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold (Verified Deals)</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* ─── Listings Content: Cards vs Table ─────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center text-sm text-[#968a7e] animate-pulse">
          Loading land inventory from database...
        </div>
      ) : filtered.length === 0 ? (
        <div className={`py-20 text-center p-8 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
          <Trees className="w-12 h-12 text-[#968a7e]/40 mx-auto mb-3" />
          <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>No land parcels found</h4>
          <p className="text-xs text-[#968a7e] mt-1">Try adjusting your filters or adding a new land listing.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Image Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(land => {
            const images = parseLandImages(land);
            const coverImage = images[0] || FALLBACK_LAND_IMG;

            return (
              <div
                key={land.id}
                className={`rounded-2xl border overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:border-[#d8a868]/40 ${
                  isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
                }`}
              >
                {/* Image Container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#1e1c24]">
                  <img
                    src={coverImage}
                    alt={land.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_LAND_IMG; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-[#d8a868] border border-[#d8a868]/30">
                      {land.land_type?.replace(/_/g, ' ') || 'Plot'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider backdrop-blur-md ${
                      land.status === 'available'
                        ? 'bg-emerald-500/80 text-white'
                        : land.status === 'sold'
                        ? 'bg-rose-500/80 text-white'
                        : 'bg-amber-500/80 text-white'
                    }`}>
                      {land.status || 'Available'}
                    </span>
                  </div>

                  {images.length > 1 && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 font-mono">
                      <ImageIcon className="w-3 h-3 text-[#d8a868]" />
                      <span>{images.length}</span>
                    </div>
                  )}

                  {/* Price Tag Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-semibold tracking-wider text-[#d8a868]/90">Asking Price</div>
                      <div className="text-xl font-mono font-extrabold text-white drop-shadow-md">
                        {formatPrice(land.price)}
                      </div>
                    </div>
                    {land.survey_number && (
                      <span className="text-[10px] font-mono text-[#d8a868] bg-black/60 border border-[#d8a868]/30 px-2 py-0.5 rounded">
                        Sy. {land.survey_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className={`font-bold text-base truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                      {land.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#968a7e] mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#d8a868] shrink-0" />
                      <span className="truncate">{land.locality ? `${land.locality}, ` : ''}{land.city || 'Chennai'}</span>
                    </div>

                    {/* Key Land Specs */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#28232D] text-xs text-[#c9c0b5]">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Maximize2 className="w-3.5 h-3.5 text-[#d8a868]" />
                        <span className="font-bold text-white">{land.total_area}</span>
                        <span>{land.area_unit || 'cents'}</span>
                      </div>
                      {land.road_access && (
                        <div className="truncate max-w-[140px] text-[11px] text-[#968a7e]" title={land.road_access}>
                          🛣️ {land.road_access}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-[#28232D] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedLand(land)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border border-[#d8a868]/30 bg-[#d8a868]/10 hover:bg-[#d8a868]/20 text-[#f0be7c] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Parcel</span>
                    </button>
                    {canManage && (
                      <button
                        onClick={() => openEditModal(land)}
                        className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                          isDark
                            ? 'border-[#28232D] hover:bg-[#25222c] text-[#968a7e] hover:text-white'
                            : 'border-[#E2D8D1] hover:bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e]'
                        }`}
                        title="Edit Land Parcel"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${
          isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[950px]">
              <thead>
                <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                  isDark ? 'border-[#28232D] text-[#968a7e] bg-[#18161B]/60' : 'border-[#E2D8D1] text-[#817568] bg-[#FAF7F2]'
                }`}>
                  <th className="py-3.5 px-4 min-w-[260px]">Parcel Title & Location</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Survey / Plot</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Total Area</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Asking Price</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs ${isDark ? 'divide-[#28232D]/70' : 'divide-[#E2D8D1]'}`}>
                {filtered.map(land => (
                  <tr key={land.id} className={`transition-colors ${isDark ? 'hover:bg-[#1f1d26]/60' : 'hover:bg-[#FAF7F2]'}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={parseLandImages(land)[0] || FALLBACK_LAND_IMG}
                          alt=""
                          className="w-12 h-10 rounded-lg object-cover bg-[#1e1c24] shrink-0"
                          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_LAND_IMG; }}
                        />
                        <div className="min-w-0">
                          <div className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                            {land.title}
                          </div>
                          <div className="text-xs text-[#968a7e] flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#d8a868] shrink-0" />
                            <span className="truncate">{land.locality ? `${land.locality}, ` : ''}{land.city || 'Chennai'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono">
                      <div className="text-white font-medium">Sy: {land.survey_number || '—'}</div>
                      {land.plot_number && <div className="text-[11px] text-[#968a7e]">Plot: {land.plot_number}</div>}
                    </td>
                    <td className="py-4 px-4 font-mono">
                      <span className="font-bold text-white">{land.total_area}</span> {land.area_unit || 'cents'}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sm text-[#d8a868]">
                      {formatPrice(land.price)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        land.status === 'available'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : land.status === 'sold'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="capitalize">{land.status || 'Available'}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedLand(land)}
                          className="px-2.5 py-1 rounded-lg border border-[#28232D] text-xs hover:text-white transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        {canManage && (
                          <button
                            onClick={() => openEditModal(land)}
                            className="px-2.5 py-1 rounded-lg border border-[#d8a868]/30 text-xs text-[#d8a868] hover:bg-[#d8a868]/15 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ────────────────────────────────────────────── */}
      {selectedLand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 ${
            isDark ? 'bg-[#141217] border-[#28232D]' : 'bg-white border-[#E2D8D1]'
          }`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-xs uppercase font-mono text-[#d8a868] font-bold">
                  {selectedLand.id} • {selectedLand.land_type?.replace(/_/g, ' ')}
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedLand.title}</h2>
                <div className="flex items-center gap-1.5 text-xs text-[#968a7e] mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#d8a868]" />
                  <span>{selectedLand.full_address || `${selectedLand.locality}, ${selectedLand.city}`}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLand(null)}
                className="p-1.5 rounded-lg text-[#968a7e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gallery Images */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {parseLandImages(selectedLand).map((imgUrl, idx) => (
                <div key={idx} className="aspect-[4/3] rounded-xl overflow-hidden bg-[#1e1c24] border border-[#28232D]">
                  <img
                    src={imgUrl}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_LAND_IMG; }}
                  />
                </div>
              ))}
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#1a1820] border border-[#28232D] mb-6">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Asking Price</div>
                <div className="text-base font-extrabold font-mono text-[#d8a868] mt-0.5">
                  {formatPrice(selectedLand.price)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Total Area</div>
                <div className="text-sm font-semibold text-white mt-0.5 font-mono">
                  {selectedLand.total_area} {selectedLand.area_unit || 'cents'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Survey Number</div>
                <div className="text-sm font-semibold text-white mt-0.5 font-mono">
                  {selectedLand.survey_number || '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Status</div>
                <div className="text-sm font-semibold text-emerald-400 capitalize mt-0.5">
                  {selectedLand.status || 'Available'}
                </div>
              </div>
            </div>

            {/* Additional Land Verification Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#1a1820]/70 border border-[#28232D] mb-6 text-xs">
              <div>
                <span className="text-[#968a7e] block">Road Access:</span>
                <span className="text-white font-medium">{selectedLand.road_access || 'Blacktop road access'}</span>
              </div>
              <div>
                <span className="text-[#968a7e] block">Utilities:</span>
                <span className="text-white font-medium">{selectedLand.utilities || 'EB Power & Borewell water'}</span>
              </div>
              <div>
                <span className="text-[#968a7e] block">Zoning & Approvals:</span>
                <span className="text-emerald-400 font-medium">✓ {selectedLand.zoning_details || 'Verified Zoning Approval'}</span>
              </div>
              <div>
                <span className="text-[#968a7e] block">Document Title Status:</span>
                <span className="text-[#d8a868] font-medium">✓ {selectedLand.verification_status || 'Verified Clear Parent Title'}</span>
              </div>
            </div>

            {/* Description */}
            {selectedLand.description && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#d8a868] mb-2">Description</h4>
                <p className="text-xs sm:text-sm text-[#c9c0b5] leading-relaxed">
                  {selectedLand.description}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-[#28232D]">
              <button
                onClick={() => setSelectedLand(null)}
                className="px-5 py-2 rounded-xl bg-[#28232D] hover:bg-[#322c39] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add / Edit Modal ────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`border rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 ${
            isDark ? 'bg-[#141217] border-[#28232D]' : 'bg-white border-[#E2D8D1]'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trees className="w-5 h-5 text-[#d8a868]" />
                <span>{isEditing ? 'Edit Land Parcel' : 'Add Luxury Land Parcel'}</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-[#968a7e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Listing Title *
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. 12 Cents Prime Coastal Villa Plot"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Land Type
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  >
                    <option value="residential_plot">Residential Plot</option>
                    <option value="agricultural">Agricultural / Farm</option>
                    <option value="commercial">Commercial Land</option>
                    <option value="industrial">Industrial Plot</option>
                  </select>
                </div>
              </div>

              {/* Price, Area, Unit, Survey No */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Asking Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    placeholder="e.g. 18000000"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Total Area *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formArea}
                    onChange={e => setFormArea(e.target.value)}
                    placeholder="e.g. 12"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Area Unit
                  </label>
                  <select
                    value={formAreaUnit}
                    onChange={e => setFormAreaUnit(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  >
                    <option value="cents">Cents</option>
                    <option value="grounds">Grounds</option>
                    <option value="acres">Acres</option>
                    <option value="sqft">Sq Ft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Survey Number
                  </label>
                  <input
                    type="text"
                    value={formSurveyNo}
                    onChange={e => setFormSurveyNo(e.target.value)}
                    placeholder="e.g. 142/3A"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 font-mono"
                  />
                </div>
              </div>

              {/* Locality, City, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Locality / Area
                  </label>
                  <input
                    type="text"
                    value={formLocality}
                    onChange={e => setFormLocality(e.target.value)}
                    placeholder="e.g. Uthandi, ECR"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    placeholder="e.g. Chennai"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                    <option value="sold" disabled>Sold (Workflow only)</option>
                  </select>
                </div>
              </div>

              {/* Notice regarding Sold status */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[11px] text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Note: Land listing status transitions to "Sold" only upon Deal Purchase Verification.</span>
              </div>

              {/* Road Access & Utilities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Road Access
                  </label>
                  <input
                    type="text"
                    value={formRoadAccess}
                    onChange={e => setFormRoadAccess(e.target.value)}
                    placeholder="e.g. 40 ft Blacktop Tar Road"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Utilities & Infrastructure
                  </label>
                  <input
                    type="text"
                    value={formUtilities}
                    onChange={e => setFormUtilities(e.target.value)}
                    placeholder="e.g. EB Three-Phase Power, Borewell Water"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Zoning & Verification Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Zoning & Approvals
                  </label>
                  <input
                    type="text"
                    value={formZoning}
                    onChange={e => setFormZoning(e.target.value)}
                    placeholder="e.g. CMDA & RERA Approved"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Title & Document Verification
                  </label>
                  <input
                    type="text"
                    value={formDocStatus}
                    onChange={e => setFormDocStatus(e.target.value)}
                    placeholder="e.g. Clear Parent Document Title, Patta Available"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                  Parcel Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Orientation, soil condition, frontage, boundary fencing, and neighborhood..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 resize-none"
                />
              </div>

              {/* Multi-Image File Upload with Previews */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868]">
                    Land Images ({formImages.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="text-xs text-[#d8a868] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Images</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {isUploadingImage && (
                  <div className="text-xs text-[#d8a868] animate-pulse py-2 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#d8a868] border-t-transparent rounded-full animate-spin" />
                    <span>Uploading and saving images to server...</span>
                  </div>
                )}

                {/* Previews Thumbnails */}
                {formImages.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                    {formImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#28232D] group bg-[#1e1c24]">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity cursor-pointer"
                          title="Remove image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#28232D] hover:border-[#d8a868]/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#1a1820]/50"
                  >
                    <ImageIcon className="w-6 h-6 text-[#968a7e] mx-auto mb-1" />
                    <p className="text-xs text-[#968a7e]">Click or drag images to upload (JPG, PNG, WebP)</p>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-[#28232D] hover:bg-[#322c39] text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-2/3 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#d8a868] to-[#b88c4c] text-[#0B0A0C] hover:opacity-95 shadow-lg shadow-[#d8a868]/15 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving Parcel...' : isEditing ? 'Update Listing' : 'Publish Land Parcel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandManagementView;
