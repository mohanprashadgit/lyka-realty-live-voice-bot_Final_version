/**
 * PropertiesView.tsx — Luxury Residential Property Inventory & Image Management
 * Aura Privé design system • Responsive image cards & data table • Multi-image upload
 */
import React, { useEffect, useState, useRef } from 'react';
import { useCrm } from '../context/CrmContext';
import { hasActionPermission } from '../permissions';
import {
  Building2,
  Search,
  RefreshCw,
  Plus,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  LayoutGrid,
  Table as TableIcon,
  X,
  Upload,
  Trash2,
  ChevronRight,
  Eye,
  Info,
  Edit,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

const FALLBACK_PROPERTY_IMG = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

export const PropertiesView: React.FC = () => {
  const { activeRole, theme, authFetch } = useCrm();
  const isDark = theme === 'dark';

  const canManage = hasActionPermission(activeRole, 'properties', 'update') || ['Super Admin', 'Operations Admin'].includes(activeRole);

  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('apartment');
  const [formPrice, setFormPrice] = useState('');
  const [formBuiltUp, setFormBuiltUp] = useState('');
  const [formLandArea, setFormLandArea] = useState('');
  const [formBedrooms, setFormBedrooms] = useState('3');
  const [formBathrooms, setFormBathrooms] = useState('3');
  const [formLocality, setFormLocality] = useState('');
  const [formCity, setFormCity] = useState('Chennai');
  const [formAddress, setFormAddress] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('available');
  const [formAmenities, setFormAmenities] = useState('Clubhouse, Swimming Pool, 24/7 Security, Power Backup');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProperties = () => {
    setLoading(true);
    setForbiddenError(null);
    authFetch('/api/crm/properties')
      .then(res => {
        if (res.status === 403) {
          return res.json().then(d => {
            setForbiddenError(d.error || 'Access Denied');
            setProperties([]);
          });
        }
        return res.json().then(d => {
          if (d.success) setProperties(d.data || []);
        });
      })
      .catch(err => console.error('[PropertiesView] Fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProperties();
  }, [activeRole]);

  const filtered = properties.filter(p => {
    const matchesSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.locality?.toLowerCase().includes(search.toLowerCase()) ||
      p.id?.toLowerCase().includes(search.toLowerCase()) ||
      p.building_name?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'ALL' || p.property_type?.toLowerCase() === typeFilter.toLowerCase();
    const matchesStatus = statusFilter === 'ALL' || p.status?.toLowerCase() === statusFilter.toLowerCase();

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
    setFormType('apartment');
    setFormPrice('');
    setFormBuiltUp('');
    setFormLandArea('');
    setFormBedrooms('3');
    setFormBathrooms('3');
    setFormLocality('Anna Nagar');
    setFormCity('Chennai');
    setFormAddress('');
    setFormDescription('');
    setFormStatus('available');
    setFormAmenities('Clubhouse, Swimming Pool, 24/7 Security, Power Backup');
    setFormImages([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (prop: any) => {
    setIsEditing(true);
    setEditingId(prop.id);
    setFormTitle(prop.title || '');
    setFormType(prop.property_type || 'apartment');
    setFormPrice(String(prop.price || ''));
    setFormBuiltUp(String(prop.built_up_area || ''));
    setFormLandArea(String(prop.land_area || ''));
    setFormBedrooms(String(prop.bedrooms || '3'));
    setFormBathrooms(String(prop.bathrooms || '3'));
    setFormLocality(prop.locality || '');
    setFormCity(prop.city || 'Chennai');
    setFormAddress(prop.full_address || prop.address || '');
    setFormDescription(prop.description || '');
    setFormStatus(prop.status || 'available');
    setFormAmenities(Array.isArray(prop.amenities) ? prop.amenities.join(', ') : (prop.amenities || ''));
    
    let parsedImgs: string[] = [];
    if (Array.isArray(prop.images)) {
      parsedImgs = prop.images;
    } else if (typeof prop.images === 'string') {
      try { parsedImgs = JSON.parse(prop.images); } catch { parsedImgs = prop.images ? [prop.images] : []; }
    }
    setFormImages(parsedImgs);
    setFormError('');
    setIsFormOpen(true);
  };

  // Secure Image File Upload to /api/crm/uploads
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

        // Post to upload endpoint
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
      setFormError('Please specify a valid asking price.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    const payload = {
      title: formTitle.trim(),
      property_type: formType,
      price: Number(formPrice),
      built_up_area: formBuiltUp ? Number(formBuiltUp) : null,
      land_area: formLandArea ? Number(formLandArea) : null,
      bedrooms: formBedrooms ? Number(formBedrooms) : null,
      bathrooms: formBathrooms ? Number(formBathrooms) : null,
      locality: formLocality.trim(),
      city: formCity.trim(),
      full_address: formAddress.trim(),
      description: formDescription.trim(),
      status: formStatus,
      amenities: formAmenities.split(',').map(s => s.trim()).filter(Boolean),
      images: formImages,
    };

    try {
      const url = isEditing && editingId ? `/api/crm/properties/${editingId}` : '/api/crm/properties';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to save property listing.');
        setFormSubmitting(false);
        return;
      }

      setIsFormOpen(false);
      fetchProperties();
    } catch (err: any) {
      setFormError(err.message || 'Error communicating with server.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const parsePropertyImages = (prop: any): string[] => {
    if (Array.isArray(prop.images) && prop.images.length > 0) return prop.images;
    if (typeof prop.images === 'string' && prop.images.trim()) {
      try {
        const parsed = JSON.parse(prop.images);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        return [prop.images];
      }
    }
    return [FALLBACK_PROPERTY_IMG];
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
            <span>Property Inventory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d8a868]/15 text-[#d8a868] font-mono font-bold border border-[#d8a868]/30">
              {properties.length} Listings
            </span>
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-[#968a7e]' : 'text-[#817568]'}`}>
            Luxury residential apartments, penthouses, and gated villa developments
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
            onClick={fetchProperties}
            disabled={loading}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'border-[#28232D] bg-[#18161B] text-[#968a7e] hover:text-white'
                : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e]'
            }`}
            title="Refresh Listings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d8a868]' : ''}`} />
          </button>

          {canManage && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#d8a868] to-[#b88c4c] text-[#0B0A0C] hover:opacity-95 shadow-md shadow-[#d8a868]/15 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Property</span>
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
            placeholder="Search by title, location, building name, or ID..."
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
            <option value="apartment">Apartment</option>
            <option value="villa">Villa</option>
            <option value="penthouse">Penthouse</option>
            <option value="townhouse">Townhouse</option>
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

      {/* ─── Inventory Content: Cards vs Table ────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center text-sm text-[#968a7e] animate-pulse">
          Loading property inventory from database...
        </div>
      ) : filtered.length === 0 ? (
        <div className={`py-20 text-center p-8 rounded-2xl border ${isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'}`}>
          <Building2 className="w-12 h-12 text-[#968a7e]/40 mx-auto mb-3" />
          <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>No properties found</h4>
          <p className="text-xs text-[#968a7e] mt-1">Try adjusting your filters or adding a new property listing.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Image-Led Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(prop => {
            const images = parsePropertyImages(prop);
            const coverImage = images[0] || FALLBACK_PROPERTY_IMG;

            return (
              <div
                key={prop.id}
                className={`rounded-2xl border overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:border-[#d8a868]/40 ${
                  isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
                }`}
              >
                {/* Image Container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#1e1c24]">
                  <img
                    src={coverImage}
                    alt={prop.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_PROPERTY_IMG; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Status & Type Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-[#d8a868] border border-[#d8a868]/30">
                      {prop.property_type || 'Apartment'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider backdrop-blur-md ${
                      prop.status === 'available'
                        ? 'bg-emerald-500/80 text-white'
                        : prop.status === 'sold'
                        ? 'bg-rose-500/80 text-white'
                        : prop.status === 'reserved'
                        ? 'bg-amber-500/80 text-white'
                        : 'bg-zinc-600/80 text-white'
                    }`}>
                      {prop.status || 'Available'}
                    </span>
                  </div>

                  {/* Images Count Indicator */}
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
                        {formatPrice(prop.price)}
                      </div>
                    </div>
                    {prop.id && (
                      <span className="text-[10px] font-mono text-[#968a7e] bg-black/50 px-2 py-0.5 rounded">
                        {prop.id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className={`font-bold text-base truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                      {prop.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#968a7e] mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#d8a868] shrink-0" />
                      <span className="truncate">{prop.locality ? `${prop.locality}, ` : ''}{prop.city || 'Chennai'}</span>
                    </div>

                    {/* Key Specs */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#28232D] text-xs text-[#c9c0b5]">
                      {prop.bedrooms && (
                        <div className="flex items-center gap-1.5">
                          <Bed className="w-3.5 h-3.5 text-[#d8a868]" />
                          <span>{prop.bedrooms} BHK</span>
                        </div>
                      )}
                      {prop.bathrooms && (
                        <div className="flex items-center gap-1.5">
                          <Bath className="w-3.5 h-3.5 text-[#d8a868]" />
                          <span>{prop.bathrooms} Baths</span>
                        </div>
                      )}
                      {prop.built_up_area && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Maximize2 className="w-3.5 h-3.5 text-[#d8a868]" />
                          <span>{prop.built_up_area} {prop.area_unit || 'sqft'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-[#28232D] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedProperty(prop)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border border-[#d8a868]/30 bg-[#d8a868]/10 hover:bg-[#d8a868]/20 text-[#f0be7c] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                    {canManage && (
                      <button
                        onClick={() => openEditModal(prop)}
                        className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                          isDark
                            ? 'border-[#28232D] hover:bg-[#25222c] text-[#968a7e] hover:text-white'
                            : 'border-[#E2D8D1] hover:bg-[#FAF7F2] text-[#817568] hover:text-[#1c1b1e]'
                        }`}
                        title="Edit Listing"
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
                  <th className="py-3.5 px-4 min-w-[260px]">Property Title & Location</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Type</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Specifications</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Price</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs ${isDark ? 'divide-[#28232D]/70' : 'divide-[#E2D8D1]'}`}>
                {filtered.map(prop => (
                  <tr key={prop.id} className={`transition-colors ${isDark ? 'hover:bg-[#1f1d26]/60' : 'hover:bg-[#FAF7F2]'}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={parsePropertyImages(prop)[0] || FALLBACK_PROPERTY_IMG}
                          alt=""
                          className="w-12 h-10 rounded-lg object-cover bg-[#1e1c24] shrink-0"
                          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_PROPERTY_IMG; }}
                        />
                        <div className="min-w-0">
                          <div className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                            {prop.title}
                          </div>
                          <div className="text-xs text-[#968a7e] flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#d8a868] shrink-0" />
                            <span className="truncate">{prop.locality ? `${prop.locality}, ` : ''}{prop.city || 'Chennai'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="capitalize px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#d8a868]/10 text-[#d8a868] border border-[#d8a868]/20">
                        {prop.property_type || 'Apartment'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3 text-xs text-[#968a7e]">
                        {prop.bedrooms && <span>{prop.bedrooms} BHK</span>}
                        {prop.built_up_area && <span>{prop.built_up_area} {prop.area_unit || 'sqft'}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sm text-[#d8a868]">
                      {formatPrice(prop.price)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        prop.status === 'available'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : prop.status === 'sold'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="capitalize">{prop.status || 'Available'}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedProperty(prop)}
                          className="px-2.5 py-1 rounded-lg border border-[#28232D] text-xs hover:text-white transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        {canManage && (
                          <button
                            onClick={() => openEditModal(prop)}
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
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 ${
            isDark ? 'bg-[#141217] border-[#28232D]' : 'bg-white border-[#E2D8D1]'
          }`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-xs uppercase font-mono text-[#d8a868] font-bold">
                  {selectedProperty.id} • {selectedProperty.property_type}
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedProperty.title}</h2>
                <div className="flex items-center gap-1.5 text-xs text-[#968a7e] mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#d8a868]" />
                  <span>{selectedProperty.full_address || `${selectedProperty.locality}, ${selectedProperty.city}`}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="p-1.5 rounded-lg text-[#968a7e] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gallery Images */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {parsePropertyImages(selectedProperty).map((imgUrl, idx) => (
                <div key={idx} className="aspect-[4/3] rounded-xl overflow-hidden bg-[#1e1c24] border border-[#28232D]">
                  <img
                    src={imgUrl}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_PROPERTY_IMG; }}
                  />
                </div>
              ))}
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#1a1820] border border-[#28232D] mb-6">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Asking Price</div>
                <div className="text-base font-extrabold font-mono text-[#d8a868] mt-0.5">
                  {formatPrice(selectedProperty.price)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Built-up Area</div>
                <div className="text-sm font-semibold text-white mt-0.5 font-mono">
                  {selectedProperty.built_up_area || '—'} {selectedProperty.area_unit || 'sqft'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Bedrooms / Baths</div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {selectedProperty.bedrooms || '—'} BHK / {selectedProperty.bathrooms || '—'} Baths
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#968a7e]">Status</div>
                <div className="text-sm font-semibold text-emerald-400 capitalize mt-0.5">
                  {selectedProperty.status || 'Available'}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedProperty.description && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#d8a868] mb-2">Description</h4>
                <p className="text-xs sm:text-sm text-[#c9c0b5] leading-relaxed">
                  {selectedProperty.description}
                </p>
              </div>
            )}

            {/* Amenities Tags */}
            {selectedProperty.amenities && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#d8a868] mb-2">Features & Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(selectedProperty.amenities)
                    ? selectedProperty.amenities
                    : String(selectedProperty.amenities).split(',')
                  ).map((amenity: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1a1820] border border-[#28232D] text-[#c9c0b5]"
                    >
                      ✓ {amenity.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-[#28232D]">
              <button
                onClick={() => setSelectedProperty(null)}
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
                <Building2 className="w-5 h-5 text-[#d8a868]" />
                <span>{isEditing ? 'Edit Property Listing' : 'Add Luxury Property Listing'}</span>
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
                    placeholder="e.g. Signature 3BHK Penthouse with Skyline Terrace"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Property Type
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  >
                    <option value="apartment">Apartment</option>
                    <option value="villa">Villa</option>
                    <option value="penthouse">Penthouse</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>

              {/* Price, Built-up Area, Bedrooms, Bathrooms */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Asking Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    placeholder="e.g. 28500000"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Built-up Area (sqft)
                  </label>
                  <input
                    type="number"
                    value={formBuiltUp}
                    onChange={e => setFormBuiltUp(e.target.value)}
                    placeholder="e.g. 2400"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Bedrooms
                  </label>
                  <input
                    type="number"
                    value={formBedrooms}
                    onChange={e => setFormBedrooms(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    value={formBathrooms}
                    onChange={e => setFormBathrooms(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                  />
                </div>
              </div>

              {/* Locality, City, Full Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                    Locality / Area
                  </label>
                  <input
                    type="text"
                    value={formLocality}
                    onChange={e => setFormLocality(e.target.value)}
                    placeholder="e.g. Boat Club Road"
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
                <span>Note: Listing availability changes to "Sold" only via verified deal purchase workflow.</span>
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                  Full Address
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="e.g. 14, 2nd Avenue, Boat Club Road, R.A. Puram, Chennai - 600028"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                  Amenities (comma separated)
                </label>
                <input
                  type="text"
                  value={formAmenities}
                  onChange={e => setFormAmenities(e.target.value)}
                  placeholder="Clubhouse, Swimming Pool, 24/7 Security, Power Backup, Gym"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868] mb-1">
                  Listing Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Detailed property highlights, architectural specifications, and view orientation..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#28232D] bg-[#1a1820] text-white text-sm focus:outline-none focus:border-[#d8a868]/70 resize-none"
                />
              </div>

              {/* Multi-Image File Upload with Previews */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#d8a868]">
                    Listing Images ({formImages.length})
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
                  {formSubmitting ? 'Saving Property...' : isEditing ? 'Update Listing' : 'Publish Property Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesView;
