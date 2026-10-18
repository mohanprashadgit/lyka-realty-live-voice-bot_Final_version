import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Building,
  ShieldCheck,
  Scale,
  HelpCircle,
  Search,
  ExternalLink,
  MapPin,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface KnowledgeListing {
  id: string;
  jurisdiction: 'India' | 'Dubai';
  title: string;
  location: string;
  propertyType: string;
  priceFormatted: string;
  approxInr?: string;
  bedrooms: string;
  area: string;
  amenities: string[];
  description: string;
  highlights: string[];
  regulatoryRef: string;
  roi?: string;
}

interface RegulatoryGuide {
  id: string;
  jurisdiction: 'India' | 'Dubai';
  title: string;
  authority: string;
  summary: string;
  keyPoints: string[];
  applicableFees: string;
  officialPortal: string;
  lastVerifiedDate: string;
}

interface MarketComparison {
  factor: string;
  indiaDetail: string;
  dubaiDetail: string;
  strategicTakeaway: string;
}

interface RealEstateFaq {
  id: string;
  category: string;
  questionTanglish: string;
  questionEnglish: string;
  answerTanglish: string;
  jurisdiction: 'India' | 'Dubai' | 'Both';
}

export const KnowledgeTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'listings' | 'regulations' | 'comparison' | 'faqs'>('listings');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<'all' | 'India' | 'Dubai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<KnowledgeListing[]>([]);
  const [guides, setGuides] = useState<RegulatoryGuide[]>([]);
  const [comparisons, setComparisons] = useState<MarketComparison[]>([]);
  const [faqs, setFaqs] = useState<RealEstateFaq[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/knowledge')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setListings(data.listings || []);
          setGuides(data.guides || []);
          setComparisons(data.comparisons || []);
          setFaqs(data.faqs || []);
        }
      })
      .catch((err) => console.error('Failed to load knowledge base:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredListings = listings.filter((item) => {
    const matchesJurisdiction = jurisdictionFilter === 'all' || item.jurisdiction === jurisdictionFilter;
    if (!matchesJurisdiction) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(query) ||
      (item.location || '').toLowerCase().includes(query) ||
      (item.propertyType || '').toLowerCase().includes(query) ||
      (item.description || '').toLowerCase().includes(query) ||
      (item.regulatoryRef || '').toLowerCase().includes(query)
    );
  });

  const filteredGuides = guides.filter((item) => {
    const matchesJurisdiction = jurisdictionFilter === 'all' || item.jurisdiction === jurisdictionFilter;
    if (!matchesJurisdiction) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(query) ||
      (item.authority || '').toLowerCase().includes(query) ||
      (item.summary || '').toLowerCase().includes(query) ||
      (item.applicableFees || '').toLowerCase().includes(query)
    );
  });

  const filteredFaqs = faqs.filter((item) => {
    const matchesJurisdiction = jurisdictionFilter === 'all' || item.jurisdiction === jurisdictionFilter || item.jurisdiction === 'Both';
    if (!matchesJurisdiction) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.questionTanglish || '').toLowerCase().includes(query) ||
      (item.questionEnglish || '').toLowerCase().includes(query) ||
      (item.answerTanglish || '').toLowerCase().includes(query) ||
      (item.category || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/50 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Real Estate Knowledge Base — India 🇮🇳 &amp; Dubai 🇦🇪
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verified inventory, official RERA &amp; DLD regulations, and approved market investment intelligence.
            </p>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveSubTab('listings')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'listings'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Listings ({listings.length})
            </button>
            <button
              onClick={() => setActiveSubTab('regulations')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'regulations'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Regulatory Guides ({guides.length})
            </button>
            <button
              onClick={() => setActiveSubTab('comparison')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'comparison'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              India vs Dubai
            </button>
            <button
              onClick={() => setActiveSubTab('faqs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'faqs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tanglish FAQs ({faqs.length})
            </button>
          </div>
        </div>

        {/* Filter & Search Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by locality, property type, regulation, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1">Jurisdiction:</span>
            {(['all', 'India', 'Dubai'] as const).map((jur) => (
              <button
                key={jur}
                onClick={() => setJurisdictionFilter(jur)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  jurisdictionFilter === jur
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                {jur === 'all' ? 'All Territories' : jur === 'India' ? '🇮🇳 India' : '🇦🇪 Dubai'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading knowledge base...</div>
      ) : activeSubTab === 'listings' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      item.jurisdiction === 'Dubai'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    }`}
                  >
                    {item.jurisdiction === 'Dubai' ? '🇦🇪 Dubai' : '🇮🇳 India'}
                  </span>
                  {item.roi && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                      <TrendingUp className="w-3 h-3" />
                      <span>{item.roi}</span>
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.title}</h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{item.location}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Price</span>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {item.priceFormatted}
                    </span>
                  </div>
                  {item.approxInr && (
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      ≈ {item.approxInr}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                  {item.description}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.amenities.slice(0, 3).map((a, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-mono text-violet-600 dark:text-violet-400 font-medium">
                  {item.regulatoryRef}
                </span>
                <span>{item.bedrooms} • {item.area}</span>
              </div>
            </div>
          ))}
        </div>
      ) : activeSubTab === 'regulations' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredGuides.map((guide) => (
            <div
              key={guide.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      guide.jurisdiction === 'Dubai'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    }`}
                  >
                    {guide.jurisdiction === 'Dubai' ? '🇦🇪 Dubai' : '🇮🇳 India'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {guide.authority}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>Verified: {guide.lastVerifiedDate}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{guide.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{guide.summary}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Mandatory Key Requirements
                </span>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {guide.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Transaction Fees: <strong className="text-slate-800 dark:text-slate-200">{guide.applicableFees}</strong></span>
                <a
                  href={guide.officialPortal}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                >
                  <span>Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : activeSubTab === 'comparison' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span>India vs Dubai Real Estate Investment Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Objective comparison of acquisition costs, rental returns, taxation, and legal protections.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-44">Investment Factor</th>
                  <th className="py-3 px-4 w-72">🇮🇳 India (Chennai / Metro)</th>
                  <th className="py-3 px-4 w-72">🇦🇪 Dubai (UAE)</th>
                  <th className="py-3 px-4">Advisor Strategic Takeaway</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {comparisons.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">{c.factor}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 leading-relaxed">{c.indiaDetail}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 leading-relaxed">{c.dubaiDetail}</td>
                    <td className="py-3.5 px-4 font-medium text-violet-700 dark:text-violet-300 leading-relaxed bg-violet-50/30 dark:bg-violet-950/20">
                      {c.strategicTakeaway}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFaqs.map((faq) => (
            <div
              key={faq.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700/50">
                  {faq.category}
                </span>
                <span className="text-xs text-slate-400 font-mono">{faq.jurisdiction}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-violet-500 shrink-0" />
                  <span>{faq.questionTanglish}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 pl-5.5 mt-0.5 italic">
                  EN: {faq.questionEnglish}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-4 border-l-4 border-l-violet-500">
                {faq.answerTanglish}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
