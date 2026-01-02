import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  TrendingUp,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Target,
  Car,
  Trash2,
  LayoutGrid,
  List,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';
import toast, { Toaster } from 'react-hot-toast';

interface Vehicle {
  id: string;
  vin: string;
  stock_number: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number;
  mileage: number | null;
  exterior_color: string | null;
  listing_url: string | null;
  image_urls: string[] | null;
  first_seen_at: string;
  last_seen_at: string;
  status: 'active' | 'sold';
  price_history: Array<{ date: string; price: number }>;
}

type StatusFilter = 'all' | 'active' | 'sold';
type SortBy = 'recent' | 'price_asc' | 'price_desc' | 'oldest' | 'newest' | 'year_desc' | 'year_asc';
type ViewMode = 'grid' | 'list';

export default function ManageInventoryPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    sold: 0,
    avgPrice: 0,
    totalValue: 0,
  });

  useEffect(() => {
    loadVehicles();
  }, [user?.tenant_id]);

  useEffect(() => {
    let filtered = [...vehicles];
    if (statusFilter !== 'all') {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.vin.toLowerCase().includes(query) ||
          (v.stock_number && v.stock_number.toLowerCase().includes(query)) ||
          v.make.toLowerCase().includes(query) ||
          v.model.toLowerCase().includes(query) ||
          `${v.year}`.includes(query)
      );
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'oldest': return getDaysInInventory(b.first_seen_at) - getDaysInInventory(a.first_seen_at);
        case 'newest': return getDaysInInventory(a.first_seen_at) - getDaysInInventory(b.first_seen_at);
        case 'year_desc': return b.year - a.year;
        case 'year_asc': return a.year - b.year;
        case 'recent':
        default: return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
      }
    });
    setFilteredVehicles(filtered);
  }, [vehicles, statusFilter, searchQuery, sortBy]);

  const loadVehicles = async () => {
    if (!user?.tenant_id) return;
    try {
      setLoading(true);
      const { data: sources } = await supabase
        .from('tenant_sources')
        .select('source_id')
        .eq('tenant_id', user.tenant_id)
        .eq('relationship_type', 'owner');

      const sourceIds = sources?.map(s => s.source_id) || [];
      let data: any[] = [];

      if (sourceIds.length > 0) {
        const { data: sourcedVehicles, error } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .in('source_id', sourceIds)
          .eq('tenant_id', user.tenant_id)
          .order('last_seen_at', { ascending: false });
        if (error) throw error;
        data = sourcedVehicles || [];
      } else {
        const { data: legacyVehicles, error } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .order('last_seen_at', { ascending: false });
        if (error) throw error;
        data = legacyVehicles || [];
      }

      const { data: overrides } = await supabase
        .from('tenant_vehicle_overrides')
        .select('*')
        .eq('tenant_id', user.tenant_id);

      const overrideMap = new Map((overrides || []).map(o => [o.vehicle_id, o]));

      if (data) {
        const mergedVehicles = data
          .map(v => {
            const override = overrideMap.get(v.id);
            if (override?.floor_plan_status === 'deleted') return null;
            return {
              ...v,
              price: override?.custom_price || v.price,
              notes: override?.notes
            };
          })
          .filter(Boolean) as Vehicle[];

        setVehicles(mergedVehicles);

        const active = mergedVehicles.filter((v: Vehicle) => v.status === 'active').length;
        const sold = mergedVehicles.filter((v: Vehicle) => v.status === 'sold').length;
        const totalValue = mergedVehicles
          .filter((v: Vehicle) => v.status === 'active')
          .reduce((sum: number, v: Vehicle) => sum + v.price, 0);
        const avgPrice = active > 0 ? totalValue / active : 0;

        setStats({
          total: mergedVehicles.length,
          active,
          sold,
          avgPrice,
          totalValue,
        });
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysInInventory = (firstSeen: string) => {
    return Math.floor((Date.now() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleSignOut = async () => {
    try { await signOut(); navigate('/signin'); } catch (e) { console.error(e); }
  };

  const handleRequestUpdate = async () => {
    if (!user?.tenant_id || !tenant) return;
    const updatePromise = new Promise(async (resolve, reject) => {
      try {
        const { data: sourceLink } = await supabase
          .from('tenant_sources')
          .select('source_id')
          .eq('tenant_id', user.tenant_id)
          .eq('relationship_type', 'owner')
          .single();
        if (!sourceLink) throw new Error('No linked website found.');
        const { error: rpcError } = await supabase.rpc('request_source_scan', { p_source_id: sourceLink.source_id });
        if (rpcError) throw rpcError;
        await supabase.from('tenants').update({ inventory_status: 'pending' }).eq('id', user.tenant_id);
        resolve('Update requested');
      } catch (error) { reject(error); }
    });
    toast.promise(updatePromise, {
      loading: 'Initiating global sync...',
      success: 'Deployment scheduled. Registry will refresh shortly.',
      error: (err) => `Sync failed: ${err.message}`,
    });
  };

  const handleDeleteVehicle = async (vehicleId: string, vehicleInfo: string) => {
    const deletePromise = new Promise(async (resolve, reject) => {
      try {
        const { error } = await supabase
          .from('tenant_vehicle_overrides')
          .upsert({
            tenant_id: user?.tenant_id,
            vehicle_id: vehicleId,
            floor_plan_status: 'deleted'
          }, { onConflict: 'tenant_id,vehicle_id' });
        if (error) throw error;
        await loadVehicles();
        resolve(vehicleInfo);
      } catch (error) { reject(error); }
    });
    toast.promise(deletePromise, {
      loading: `Purging ${vehicleInfo}...`,
      success: `${vehicleInfo} removed from registry`,
      error: (err) => `Purge failed: ${err.message}`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Toaster position="top-right" />
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={handleSignOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
              Fleet <span className="text-primary-500">Registry</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">
              Advanced inventory management & market delta tracking
            </p>
          </div>

          {tenant?.inventory_status === 'ready' && (
            <button
              onClick={handleRequestUpdate}
              className="px-6 py-4 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all flex items-center gap-3 shadow-lg shadow-primary-500/20"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              Recalibrate Full Registry
            </button>
          )}
        </div>

        {/* Processing State */}
        {(tenant?.inventory_status === 'pending' || tenant?.inventory_status === 'processing' || tenant?.inventory_status === 'pending_review') && (
          <div className="flex items-center justify-center py-20">
            <GlassCard className="max-w-xl w-full p-12 text-center">
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full" />
                <div className="relative bg-primary-500 p-5 rounded-3xl shadow-glow-primary">
                  <RefreshCw className="h-10 w-10 text-white animate-spin" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase italic">
                Delta <span className="text-primary-500">Processing</span>
              </h2>
              <p className="text-sm font-bold text-slate-500 leading-relaxed mb-10">
                Registry sync in progress. Automated extraction usually completes within minutes.
              </p>
              <button onClick={() => navigate('/dashboard')} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-glow-primary transition-all">
                Return to Control
              </button>
            </GlassCard>
          </div>
        )}

        {tenant?.inventory_status === 'ready' && (
          <>
            {/* Stats Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Active Fleet', value: stats.active, icon: Package, color: 'text-primary-500' },
                { label: 'Sold Delta', value: stats.sold, icon: TrendingUp, color: 'text-secondary-500' },
                { label: 'Avg Portfolio', value: formatCurrency(stats.avgPrice), icon: DollarSign, color: 'text-green-500' },
                { label: 'Asset Value', value: formatCurrency(stats.totalValue), icon: Calendar, color: 'text-purple-500' },
              ].map((stat, i) => (
                <GlassCard key={i} className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</div>
                </GlassCard>
              ))}
            </div>

            {/* Tactical Filters */}
            <GlassCard className="p-4 mb-8">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors w-4 h-4" />
                  <input
                    type="text"
                    placeholder="SCAN REGISTRY BY VIN, MAKE, MODEL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 text-slate-600 dark:text-slate-400"
                  >
                    <option value="all">Status: All</option>
                    <option value="active">Status: Active</option>
                    <option value="sold">Status: Sold</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 text-slate-600 dark:text-slate-400"
                  >
                    <option value="recent">Sort: Recently Scanned</option>
                    <option value="price_desc">Sort: Value High-Low</option>
                    <option value="price_asc">Sort: Value Low-High</option>
                    <option value="year_desc">Sort: Year High-Low</option>
                  </select>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 text-primary-500 shadow-sm' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-primary-500 shadow-sm' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Content Area */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
              </div>
            ) : filteredVehicles.length === 0 ? (
              <GlassCard className="p-20 text-center">
                <AlertCircle className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-4" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Registry Entry Undetected</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Try recalibrating your search parameters</p>
              </GlassCard>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVehicles.map((vehicle) => {
                  const firstImage = vehicle.image_urls && vehicle.image_urls.length > 0 ? vehicle.image_urls[0] : null;
                  const days = getDaysInInventory(vehicle.first_seen_at);
                  return (
                    <GlassCard key={vehicle.id} className="group overflow-hidden flex flex-col h-full border-slate-200/50 dark:border-white/5 hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all duration-300">
                      <div className="relative h-48 bg-slate-100 dark:bg-black/40 overflow-hidden">
                        {firstImage ? (
                          <img src={firstImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="flex items-center justify-center h-full opacity-20"><Car className="w-16 h-16" /></div>
                        )}
                        <div className="absolute top-4 right-4">
                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${vehicle.status === 'active' ? 'bg-primary-500 text-white shadow-glow-primary' : 'bg-secondary-500 text-white shadow-glow-secondary'}`}>
                            {vehicle.status}
                          </span>
                        </div>
                        <button onClick={() => handleDeleteVehicle(vehicle.id, `${vehicle.year} ${vehicle.make} ${vehicle.model}`)} className="absolute top-4 left-4 p-2.5 bg-white/90 dark:bg-black/50 hover:bg-red-500 dark:hover:bg-red-500 hover:text-white rounded-2xl shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <div className="mb-4">
                          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter uppercase italic line-clamp-1 leading-tight">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">VIN: {vehicle.vin}</div>
                        </div>

                        <div className="flex items-end justify-between mb-6 pb-6 border-b border-slate-100 dark:border-white/5">
                          <div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Market Position</div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(vehicle.price)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Distance</div>
                            <div className="text-sm font-black text-slate-600 dark:text-slate-400">{vehicle.mileage?.toLocaleString() || '---'} MI</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Entry Lock</div>
                            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{formatDate(vehicle.first_seen_at)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Inventory Age</div>
                            <div className="text-[10px] font-bold text-primary-500">{days} DAYS</div>
                          </div>
                        </div>

                        <div className="mt-auto pt-2">
                          {vehicle.listing_url && (
                            <a href={vehicle.listing_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-white/5 hover:bg-primary-500/10 hover:text-primary-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                              View Telemetry <ArrowUpRight size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            ) : (
              <GlassCard className="overflow-hidden border-slate-200/50 dark:border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unit</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">VIN Protocol</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financial</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mileage</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredVehicles.map((vehicle) => (
                        <tr key={vehicle.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="text-xs font-black text-slate-900 dark:text-white uppercase italic tracking-tight">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Lock: {formatDate(vehicle.first_seen_at)}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-mono text-slate-500 font-bold">{vehicle.vin}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase">{formatCurrency(vehicle.price)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">{vehicle.mileage?.toLocaleString() || '---'} MI</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${vehicle.status === 'active' ? 'bg-primary-500/10 text-primary-500' : 'bg-secondary-500/10 text-secondary-500'}`}>
                              {vehicle.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {vehicle.listing_url && (
                                <a href={vehicle.listing_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-primary-500 transition-colors">
                                  <ArrowUpRight size={14} />
                                </a>
                              )}
                              <button onClick={() => handleDeleteVehicle(vehicle.id, `${vehicle.year} ${vehicle.make} ${vehicle.model}`)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
