import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle,
  ThumbsUp,
  Search,
  DollarSign,
  Target,
  X,
  ChevronRight,
  Trash2,
  AlertCircle,
  TrendingDown,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';
import ConfirmationDialog from '../components/ConfirmationDialog';

interface Recommendation {
  id: string;
  vin: string;
  decoded_data: { year: number; make: string; model: string; trim?: string; };
  created_at: string;
  recommendation: 'buy' | 'caution' | 'pass';
  confidence_score: number;
  estimated_profit: number | null;
  max_bid_suggestion: number | null;
  market_data: any;
  match_reasoning: Array<{ type: 'positive' | 'negative' | 'neutral'; message: string; }>;
  custom_recon_cost: number | null;
  custom_transport_cost: number | null;
  custom_max_bid: number | null;
  custom_market_price: number | null;
}

const PAGE_SIZE = 25;

export default function RecommendationsPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const scanResultRef = useRef<{ saveCosts: () => void }>(null);
  const [stats, setStats] = useState({ buy: 0, caution: 0, pass: 0, avgConfidence: 0, potentialProfit: 0 });

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadRecommendations = useCallback(async (pageNum: number, append = false) => {
    if (!user?.tenant_id) return;
    try {
      const fromRow = pageNum * PAGE_SIZE;
      const toRow = fromRow + PAGE_SIZE - 1;
      const { data, error } = await supabase.from('vin_scans').select('*').eq('tenant_id', user.tenant_id).not('recommendation', 'is', null).order('created_at', { ascending: false }).range(fromRow, toRow);
      if (error) throw error;
      if (data) {
        if (append) setRecommendations(prev => [...prev, ...data]);
        else {
          setRecommendations(data);
          const buy = data.filter(r => r.recommendation === 'buy').length;
          const caution = data.filter(r => r.recommendation === 'caution').length;
          const pass = data.filter(r => r.recommendation === 'pass').length;
          const avgConfidence = data.reduce((sum, r) => sum + r.confidence_score, 0) / (data.length || 1);
          const potentialProfit = data.filter(r => r.recommendation === 'buy' && r.confidence_score >= 70).reduce((sum, r) => sum + (r.estimated_profit || 0), 0);
          setStats({ buy, caution, pass, avgConfidence, potentialProfit });
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [user?.tenant_id]);

  useEffect(() => { loadRecommendations(0); }, [loadRecommendations]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    setFilteredRecommendations(searchQuery.trim() ? recommendations.filter(r => r.vin.toLowerCase().includes(query) || r.decoded_data.make.toLowerCase().includes(query) || r.decoded_data.model.toLowerCase().includes(query) || `${r.decoded_data.year}`.includes(query)) : recommendations);
  }, [searchQuery, recommendations]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadRecommendations(nextPage, true);
      }
    }, { threshold: 0.1 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadRecommendations]);

  const handleCloseModal = () => isEditingCosts ? setShowConfirmDialog(true) : setSelectedRec(null);

  const handleDeleteScan = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    if (!confirm('Purge this analysis record from the registry?')) return;
    try {
      const { error } = await supabase.from('vin_scans').delete().eq('id', scanId);
      if (error) throw error;
      setRecommendations(recommendations.filter(s => s.id !== scanId));
      toast.success('Record purged');
    } catch (e) { toast.error('Purge failed'); }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Toaster position="top-right" />
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={signOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
            Acquisition <span className="text-primary-500">Registry</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">
            Historical analysis & AI-driven buy/pass intelligence archives
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: 'Green Locked', value: stats.buy, icon: ThumbsUp, color: 'text-primary-500' },
            { label: 'Warning Phase', value: stats.caution, icon: AlertTriangle, color: 'text-secondary-500' },
            { label: 'Rejected Protocol', value: stats.pass, icon: TrendingDown, color: 'text-red-500' },
            { label: 'Confidence Index', value: `${stats.avgConfidence.toFixed(0)}%`, icon: Target, color: 'text-blue-500' },
            { label: 'Portfolio Alpha', value: formatCurrency(stats.potentialProfit), icon: DollarSign, color: 'text-purple-500' },
          ].map((stat, i) => (
            <GlassCard key={i} className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <stat.icon size={12} className={stat.color} />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</div>
            </GlassCard>
          ))}
        </div>

        {/* Action Filters */}
        <GlassCard className="p-4 mb-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder="SCAN REGISTRY BY VIN OR ASSET NAME..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
            />
          </div>
        </GlassCard>

        {/* Registry Feed */}
        {loading && recommendations.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <GlassCard className="p-20 text-center">
            <AlertCircle className="w-16 h-16 text-slate-200 dark:text-white/10 mx-auto mb-6" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Registry Null Phase</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Injection required to build historical dataset</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRecommendations.map((rec) => (
              <GlassCard
                key={rec.id}
                onClick={() => setSelectedRec(rec)}
                className="group border-slate-200/50 dark:border-white/5 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-300 cursor-pointer p-6"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter uppercase italic line-clamp-1">{rec.decoded_data.year} {rec.decoded_data.make} {rec.decoded_data.model}</h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">VIN: {rec.vin}</div>
                  </div>
                  <button onClick={(e) => handleDeleteScan(e, rec.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-white/5">
                  <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg ${rec.recommendation === 'buy' ? 'bg-primary-500 text-white shadow-primary-500/20' :
                      rec.recommendation === 'caution' ? 'bg-secondary-500 text-white shadow-secondary-500/20' :
                        'bg-red-500 text-white shadow-red-500/20'
                    }`}>
                    {rec.recommendation} protocol
                  </span>
                  <div className="text-right">
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Confidence Score</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{rec.confidence_score}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                      <Target size={10} className="text-primary-500" /> Max Entry
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(rec.max_bid_suggestion || 0)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                      <Sparkles size={10} className="text-secondary-500" /> Est. Profit
                    </div>
                    <div className="text-sm font-black text-primary-500">{formatCurrency(rec.estimated_profit || 0)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary-500 transition-colors">
                  <span className="flex items-center gap-2"><Calendar size={12} /> {new Date(rec.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1">Open Protocol <ChevronRight size={14} /></span>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Intersection Trigger */}
        {hasMore && !searchQuery && <div ref={observerTarget} className="h-20" />}

        {/* Modal Protocol */}
        {selectedRec && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={handleCloseModal}>
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" />
            <GlassCard className="w-full max-w-5xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-300 shadow-2xl p-0" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Scan Protocol <span className="text-primary-500">Analysis</span></h2>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Registry Record: {selectedRec.id}</div>
                </div>
                <button onClick={handleCloseModal} className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <VINScanResult
                scanData={{
                  id: selectedRec.id, decoded_data: selectedRec.decoded_data, market_data: selectedRec.market_data,
                  recommendation: selectedRec.recommendation, confidence_score: selectedRec.confidence_score, match_reasoning: selectedRec.match_reasoning,
                  estimated_profit: selectedRec.estimated_profit, max_bid_suggestion: selectedRec.max_bid_suggestion,
                  custom_recon_cost: selectedRec.custom_recon_cost, custom_transport_cost: selectedRec.custom_transport_cost,
                  custom_max_bid: selectedRec.custom_max_bid, custom_market_price: selectedRec.custom_market_price,
                }}
                isModal={true} tenantZipCode={tenant?.zip_code} onClose={handleCloseModal} onEditStatusChange={setIsEditingCosts} onOutsideClick={() => setShowConfirmDialog(true)} ref={scanResultRef} isEditing={isEditingCosts}
              />
            </GlassCard>
          </div>
        )}

        <ConfirmationDialog
          isOpen={showConfirmDialog} onConfirm={() => { setSelectedRec(null); setIsEditingCosts(false); setShowConfirmDialog(false); }}
          onCancel={() => { scanResultRef.current?.saveCosts(); setIsEditingCosts(false); setShowConfirmDialog(false); }}
          confirmLabel="Discard Matrix Updates" cancelLabel="Commit Protocols" message="Unsaved cost telemetry calibration detected. Terminate protocol session?"
        />
      </div>
    </div>
  );
}
