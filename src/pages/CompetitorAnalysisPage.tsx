import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  Trash2,
  RefreshCw,
  Target,
  DollarSign,
  Gauge,
  BarChart3,
  AlertCircle,
  Loader2,
  Car,
  ChevronRight,
  ArrowUpRight,
  Globe,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';
import toast, { Toaster } from 'react-hot-toast';
import { normalizeDomain, ensureHttps } from '../utils/url';

interface CompetitorSnapshot {
  id: string;
  competitor_url: string;
  competitor_name: string | null;
  scanned_at: string;
  vehicle_count: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  avg_mileage: number | null;
  min_mileage: number | null;
  max_mileage: number | null;
  total_inventory_value: number | null;
  top_makes: Record<string, number>;
  status: 'success' | 'partial' | 'failed';
}

interface CompetitorHistory {
  id: string;
  scanned_at: string;
  vehicle_count: number;
  avg_price: number | null;
}

export default function CompetitorAnalysisPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [competitors, setCompetitors] = useState<CompetitorSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('starter');
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [refreshPendingUrls, setRefreshPendingUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      await loadSubscriptionTier();
      await loadCompetitors();
      await loadPendingRequests();
    };
    loadData();
  }, []);

  const loadSubscriptionTier = async () => {
    try {
      const { data } = await supabase.from('tenants').select('subscription_tier').eq('id', tenant?.id).single();
      setSubscriptionTier(data?.subscription_tier || 'starter');
    } catch (e) { console.error(e); }
  };

  const loadPendingRequests = async () => {
    try {
      if (!tenant?.id) return;
      const { data: allCompetitorSources } = await supabase.from('source_registry').select('*').eq('source_type', 'competitor').eq('scraping_enabled', true).order('created_at', { ascending: false });
      const { data: snapshots } = await supabase.from('inventory_snapshots_unified').select('source_url').eq('source_type', 'competitor');
      const scrapedUrls = new Set((snapshots || []).map(s => s.source_url));
      const refreshPendingSet = new Set<string>();
      (allCompetitorSources || []).forEach(source => { if (source.is_refresh_pending === true) refreshPendingSet.add(source.source_url); });
      const pending = (allCompetitorSources || []).filter(source => !scrapedUrls.has(source.source_url) && source.is_refresh_pending !== true).map(source => ({ id: source.id, competitor_url: source.source_url, competitor_name: source.source_name, created_at: source.created_at, status: 'pending' }));
      setPendingRequests(pending);
      setRefreshPendingUrls(refreshPendingSet);
    } catch (e) { console.error(e); }
  };

  const loadCompetitors = async () => {
    try {
      setLoading(true);
      if (!tenant?.id) return;
      const { data: competitorSources } = await supabase.from('source_registry').select('source_url, source_name').eq('source_type', 'competitor');
      if (!competitorSources || competitorSources.length === 0) { setCompetitors([]); return; }
      const sourceNameMap = new Map(competitorSources.map(s => [s.source_url, s.source_name]));
      const { data, error } = await supabase.from('inventory_snapshots_unified').select('*').eq('source_type', 'competitor').in('source_url', competitorSources.map(s => s.source_url)).order('scanned_at', { ascending: false });
      if (error) throw error;
      const latestSnapshots = new Map();
      (data || []).forEach(snapshot => {
        if (!latestSnapshots.has(snapshot.source_url)) {
          latestSnapshots.set(snapshot.source_url, {
            id: snapshot.id, competitor_url: snapshot.source_url, competitor_name: sourceNameMap.get(snapshot.source_url) || snapshot.source_name,
            scanned_at: snapshot.scanned_at, vehicle_count: snapshot.vehicle_count, avg_price: snapshot.avg_price, min_price: snapshot.min_price, max_price: snapshot.max_price,
            avg_mileage: snapshot.avg_mileage, min_mileage: snapshot.min_mileage, max_mileage: snapshot.max_mileage, total_inventory_value: snapshot.total_inventory_value,
            top_makes: snapshot.make_distribution || {}, status: snapshot.status
          });
        }
      });
      setCompetitors(Array.from(latestSnapshots.values()));
    } catch (e) { console.error(e); setError('Failed to load intel data'); } finally { setLoading(false); }
  };

  const handleAddToWaitingList = async () => {
    if (!newCompetitorUrl.trim() || !tenant?.id) return;
    try {
      setAddingToQueue(true); setError(null);
      const cleanDomain = normalizeDomain(newCompetitorUrl);
      const { data: existingSource } = await supabase.from('source_registry').select('*').eq('source_url', cleanDomain).maybeSingle();
      if (existingSource) { toast.error('This sector is already being monitored'); setAddingToQueue(false); return; }
      const { error: insertError } = await supabase.from('source_registry').insert({ source_url: cleanDomain, source_type: 'competitor', source_name: cleanDomain, scraping_enabled: true });
      if (insertError) throw insertError;
      setSubmissionSuccess(true);
      await loadPendingRequests();
      setNewCompetitorUrl('');
      toast.success('Competitor locked into analysis queue');
    } catch (e: any) { toast.error(e.message); } finally { setAddingToQueue(false); }
  };

  const handleScanCompetitor = async (url: string) => {
    try {
      setScanning(true);
      const cleanDomain = normalizeDomain(url);
      const { data: existingSource } = await supabase.from('source_registry').select('*').eq('source_url', cleanDomain).maybeSingle();
      if (!existingSource) return;
      await supabase.from('source_registry').update({ is_refresh_pending: true, refresh_requested_at: new Date().toISOString(), refresh_requested_by: user?.id, status: 'pending' }).eq('id', existingSource.id);
      toast.success('Telemetry refresh initiated');
      await loadPendingRequests();
    } catch (e) { console.error(e); } finally { setScanning(false); }
  };

  const formatCurrency = (v: number | null) => v === null ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  const formatNumber = (v: number | null) => v === null ? 'N/A' : v.toLocaleString();
  const formatDate = (s: string) => {
    const d = new Date(s);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const combinedList = [
    ...pendingRequests.map(req => ({ type: 'pending' as const, id: req.id, url: req.competitor_url, name: req.competitor_name, date: req.created_at, data: null })),
    ...competitors.map(comp => ({ type: 'completed' as const, id: comp.id, url: comp.competitor_url, name: comp.competitor_name, date: comp.scanned_at, data: comp }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
            Competitor <span className="text-primary-500">Intelligence</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">
            Real-time market delta & inventory positioning matrix
          </p>
        </div>

        {submissionSuccess ? (
          <div className="flex items-center justify-center py-10">
            <GlassCard className="max-w-xl w-full p-12 text-center">
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full" />
                <div className="relative bg-primary-500 p-5 rounded-3xl shadow-glow-primary">
                  <Clock className="h-10 w-10 text-white animate-pulse" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase italic">
                Analysis <span className="text-primary-500">Scheduled</span>
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-relaxed mb-10">
                Domain locked into scraping protocol. Telemetry will be available shortly.
              </p>
              <button onClick={() => setSubmissionSuccess(false)} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-glow-primary transition-all">
                Monitor Another Surface
              </button>
            </GlassCard>
          </div>
        ) : (
          <>
            {/* Intel Grid Input */}
            <GlassCard className="p-8 mb-12">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                  <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors w-5 h-5" />
                  <input
                    type="url"
                    placeholder="ENTER TARGET DOMAIN (E.G. TARGETMOTOR.COM)..."
                    value={newCompetitorUrl}
                    onChange={(e) => setNewCompetitorUrl(e.target.value)}
                    className="w-full pl-14 pr-4 py-5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleAddToWaitingList}
                  disabled={addingToQueue || !newCompetitorUrl.trim()}
                  className="px-10 py-5 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20"
                >
                  {addingToQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Request Analysis
                </button>
              </div>
            </GlassCard>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
              </div>
            ) : combinedList.length === 0 ? (
              <GlassCard className="p-20 text-center">
                <Target className="w-16 h-16 text-slate-200 dark:text-white/10 mx-auto mb-6" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Intelligence Matrix Empty</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Deploy target domains to begin baseline tracking</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {combinedList.map((item) => (
                  <GlassCard key={`${item.type}-${item.id}`} className={`p-8 group ${item.type === 'pending' ? 'border-primary-500/30' : 'border-slate-200/50 dark:border-white/5'}`}>
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">{item.name || item.url}</h3>
                          {item.type === 'pending' && <span className="px-2 py-1 bg-primary-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">Pending</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <Globe size={12} className="text-primary-500" />
                          <a href={ensureHttps(item.url)} target="_blank" className="hover:text-primary-500 transition-colors truncate">{item.url}</a>
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                          <Clock size={10} /> {item.type === 'pending' ? 'Requested' : 'Last Scanned'} {formatDate(item.date)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {item.type === 'completed' && (
                          <button onClick={() => handleScanCompetitor(item.url)} className="p-3 bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 rounded-2xl transition-all">
                            <RefreshCw size={18} className={refreshPendingUrls.has(item.url) ? 'animate-spin' : ''} />
                          </button>
                        )}
                        <button className="p-3 bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 rounded-2xl transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>

                    {item.type === 'pending' ? (
                      <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-8 text-center border border-dashed border-slate-200 dark:border-white/10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initial Sector Verification in Progress...</p>
                      </div>
                    ) : item.data && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-primary-500/5 dark:bg-primary-500/10 rounded-2xl p-5 border border-primary-500/10">
                            <div className="text-[8px] font-black uppercase tracking-widest text-primary-500 mb-1">Active Fleet</div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatNumber(item.data.vehicle_count)}</div>
                          </div>
                          <div className="bg-secondary-500/5 dark:bg-secondary-500/10 rounded-2xl p-5 border border-secondary-500/10">
                            <div className="text-[8px] font-black uppercase tracking-widest text-secondary-500 mb-1">Portfolio Value</div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(item.data.total_inventory_value)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <BarChart3 className="w-3 h-3 text-primary-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pricing Delta</span>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Mean</div>
                                <div className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(item.data.avg_price)}</div>
                              </div>
                              <div className="flex justify-between">
                                <div>
                                  <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Floor</div>
                                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatCurrency(item.data.min_price)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Ceiling</div>
                                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatCurrency(item.data.max_price)}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-l border-slate-200 dark:border-white/10 pl-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Gauge className="w-3 h-3 text-primary-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mileage Index</span>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Mean</div>
                                <div className="text-sm font-black text-slate-900 dark:text-white">{formatNumber(item.data.avg_mileage)} <span className="text-[8px] opacity-40">MI</span></div>
                              </div>
                              <div className="flex justify-between">
                                <div>
                                  <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Min</div>
                                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatNumber(item.data.min_mileage)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[8px] font-bold text-slate-400 uppercase mb-1">Max</div>
                                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatNumber(item.data.max_mileage)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
