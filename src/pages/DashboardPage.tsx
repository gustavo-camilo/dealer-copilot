import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VINScan } from '../types/database';
import { BarChart3, Car, TrendingUp, Clock, Target, Scan, Globe, ChevronRight, Package, Eye, RefreshCw, X } from 'lucide-react';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import ConfirmationDialog from '../components/ConfirmationDialog';
import GlassCard from '../components/ui/GlassCard';

export default function DashboardPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalVehicles: 0,
    portfolioValue: 0,
    avgDaysInInventory: 0,
    weekSales: 0,
  });
  const [recentScans, setRecentScans] = useState<VINScan[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<VINScan | null>(null);
  const [hasRequestedInventory, setHasRequestedInventory] = useState(false);
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const scanResultRef = useRef<{ saveCosts: () => void }>(null);

  const handleCloseModal = () => {
    if (isEditingCosts) {
      setShowConfirmDialog(true);
    } else {
      setSelectedScan(null);
      setIsEditingCosts(false);
    }
  };

  const confirmCloseModal = () => {
    setSelectedScan(null);
    setIsEditingCosts(false);
    setShowConfirmDialog(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
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

  const getRecommendationBadge = (recommendation: string) => {
    const badges = {
      buy: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      caution: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      pass: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    };
    return badges[recommendation as keyof typeof badges];
  };

  const formatVehicleName = (name: string) => {
    if (!name) return '';
    if (name.toUpperCase() === 'BMW') return 'BMW';
    return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.tenant_id) return;

    try {
      const { data: sources } = await supabase
        .from('tenant_sources')
        .select('source_id')
        .eq('tenant_id', user.tenant_id)
        .eq('relationship_type', 'owner');

      const sourceIds = sources?.map(s => s.source_id) || [];

      let vehicles: any[] = [];

      if (sourceIds.length > 0) {
        const { data: sourcedVehicles } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .in('source_id', sourceIds)
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'active');

        vehicles = sourcedVehicles || [];
      } else {
        const { data: legacyVehicles } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'active');

        vehicles = legacyVehicles || [];
      }

      const { data: recentSales } = await supabase
        .from('sales_records')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .gte('sale_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('sale_date', { ascending: false });

      const { data: scans } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recs } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('recommendation', 'buy')
        .gte('confidence_score', 70)
        .order('confidence_score', { ascending: false })
        .limit(5);

      const hasInventoryBeenRequested = tenant?.inventory_status !== null && tenant?.inventory_status !== undefined;
      setHasRequestedInventory(hasInventoryBeenRequested);

      if (vehicles) {
        const totalValue = vehicles.reduce((sum, v) => sum + Number(v.price), 0);
        const avgDays = vehicles.length > 0
          ? vehicles.reduce((sum, v) => sum + v.days_in_inventory, 0) / vehicles.length
          : 0;

        setStats({
          totalVehicles: vehicles.length,
          portfolioValue: totalValue,
          avgDaysInInventory: Math.round(avgDays),
          weekSales: recentSales?.length || 0,
        });
      }

      if (scans) {
        setRecentScans(scans);
      }

      if (recs) {
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Header
        user={user}
        tenant={tenant}
        signOut={handleSignOut}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!hasRequestedInventory && (
          <GlassCard className="mb-10 p-8 border-primary-500/20 bg-primary-500/5">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Welcome to Dealer Co-Pilot!
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl">
              Get started by analyzing your website inventory or manually adding vehicles to get real-time market insights.
            </p>
            <Link
              to="/onboarding"
              className="inline-flex items-center bg-primary-500 text-white px-8 py-3 rounded-xl hover:bg-primary-600 transition shadow-lg shadow-primary-500/25 font-bold"
            >
              Analyze My Website
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </GlassCard>
        )}

        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium flex items-center">
              <span className="w-2 h-2 bg-secondary-500 rounded-full mr-2 shadow-glow-secondary animate-pulse" />
              {tenant?.location}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Today's Refresh</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { to: '/scan', icon: Scan, label: 'Scan VIN', color: 'text-primary-500', shadow: 'shadow-primary-500/10' },
              { to: '/inventory', icon: Car, label: 'Inventory', color: 'text-primary-500', shadow: 'shadow-primary-500/10' },
              { to: '/competitors', icon: Eye, label: 'Competitor Intel', color: 'text-secondary-500', shadow: 'shadow-secondary-500/10' },
              { to: '/recommendations', icon: Target, label: 'VIN Scans', color: 'text-primary-400', shadow: 'shadow-primary-400/10' },
              { to: '/onboarding', icon: Globe, label: 'Scan Website', color: 'text-primary-500', shadow: 'shadow-primary-500/10' },
            ].map((action, idx) => (
              <Link
                key={idx}
                to={action.to}
                className={`group relative p-6 bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center overflow-hidden`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-slate-100 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity`} />
                <action.icon className={`h-10 w-10 ${action.color} mx-auto mb-4 group-hover:scale-110 transition-transform`} />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm relative z-10">{action.label}</h3>
              </Link>
            ))}
          </div>
        </div>

        {/* Hero Section - Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Vehicles', value: stats.totalVehicles, icon: Car, trend: '+2 this week' },
            { label: 'Portfolio Value', value: stats.portfolioValue, icon: BarChart3, isCurrency: true },
            { label: 'Avg Days on Lot', value: stats.avgDaysInInventory, icon: Clock, suffix: ' days' },
            { label: 'This Week Sales', value: stats.weekSales, icon: TrendingUp, color: 'text-secondary-500' },
          ].map((stat, idx) => (
            <GlassCard key={idx} className="p-6 group relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">{stat.label}</span>
                <stat.icon className={`h-5 w-5 ${stat.color || 'text-primary-500'}`} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  {stat.isCurrency ? `$${stat.value.toLocaleString()}` : stat.value}{stat.suffix}
                </p>
              </div>
              {stat.trend && (
                <p className="mt-2 text-xs font-semibold text-secondary-500 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {stat.trend}
                </p>
              )}
            </GlassCard>
          ))}
        </div>

        {/* Main Content Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Recent Scans */}
          <GlassCard className="p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recent Scans</h2>
              <Link to="/recommendations" className="text-sm font-bold text-primary-500 hover:text-primary-600 flex items-center group">
                View All Scans
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            {recentScans.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scan className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No recent activity detected.</p>
                <Link to="/scan" className="mt-4 inline-block text-primary-500 font-bold hover:underline">Scan your first VIN</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => setSelectedScan(scan)}
                    className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">
                          {scan.decoded_data.year} {formatVehicleName(scan.decoded_data.make)} {formatVehicleName(scan.decoded_data.model)}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter uppercase ${getRecommendationBadge(scan.recommendation)}`}>
                          {scan.recommendation}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center">
                          <Target className="h-3 w-3 mr-1" />
                          Bid: {scan.max_bid_suggestion ? formatCurrency(scan.max_bid_suggestion) : 'N/A'}
                        </span>
                        <span className={`font-bold ${scan.estimated_profit && scan.estimated_profit > 0 ? 'text-secondary-500' : ''}`}>
                          Profit: {scan.estimated_profit ? formatCurrency(scan.estimated_profit) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary-500 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Inventory Analysis */}
          <GlassCard className="p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory Health</h2>
              <Link to="/inventory" className="text-sm font-bold text-primary-500 hover:text-primary-600 flex items-center group">
                Manage Stock
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {tenant?.inventory_status === 'pending' || tenant?.inventory_status === 'processing' ? (
              <div className="py-10 text-center">
                <RefreshCw className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-6" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Refreshing Inventory</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">
                  We're currently syncing with your website to update market values.
                </p>
              </div>
            ) : stats.totalVehicles > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Stock Level</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalVehicles}</p>
                    <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary-500 h-full w-[70%]" />
                    </div>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Age Avg</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.avgDaysInInventory}d</p>
                    <p className="mt-2 text-[10px] text-secondary-500 font-bold">Optimized Range</p>
                  </div>
                </div>

                <div className="p-5 border border-slate-100 dark:border-white/5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary-500" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Active Recommendations</span>
                    </div>
                    <span className="text-xs font-bold text-secondary-500">2 Actions Required</span>
                  </div>
                  {recommendations.slice(0, 2).map((rec, i) => (
                    <div key={i} className="flex items-center justify-between text-xs mb-3 last:mb-0">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        {rec.decoded_data.year} {rec.decoded_data.make}
                      </span>
                      <span className="text-slate-900 dark:text-white font-black">Buy Suggestion</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                <Package className="h-10 w-10 mx-auto mb-4 opacity-50" />
                <p className="text-sm font-medium">Your inventory data will appear here.</p>
                <Link to="/onboarding" className="mt-4 inline-block text-primary-500 font-bold text-sm">Analyze Inventory Now</Link>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Modal for Details */}
        {selectedScan && (
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCloseModal}
          >
            <GlassCard
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-white/10 p-6 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Scan Analysis</h2>
                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition text-slate-500">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <VINScanResult
                  scanData={{
                    id: selectedScan.id,
                    decoded_data: selectedScan.decoded_data,
                    market_data: selectedScan.market_data,
                    recommendation: selectedScan.recommendation,
                    confidence_score: selectedScan.confidence_score,
                    match_reasoning: selectedScan.match_reasoning,
                    estimated_profit: selectedScan.estimated_profit,
                    max_bid_suggestion: selectedScan.max_bid_suggestion,
                    custom_recon_cost: selectedScan.custom_recon_cost,
                    custom_transport_cost: selectedScan.custom_transport_cost,
                    custom_max_bid: selectedScan.custom_max_bid,
                    custom_market_price: selectedScan.custom_market_price,
                  }}
                  isModal={true}
                  tenantZipCode={tenant?.zip_code}
                  onClose={handleCloseModal}
                  onEditStatusChange={setIsEditingCosts}
                  onOutsideClick={() => setShowConfirmDialog(true)}
                  ref={scanResultRef}
                  isEditing={isEditingCosts}
                />
              </div>
            </GlassCard>
          </div>
        )}

        <ConfirmationDialog
          isOpen={showConfirmDialog}
          onConfirm={confirmCloseModal}
          onCancel={() => {
            scanResultRef.current?.saveCosts();
            setIsEditingCosts(false);
            setShowConfirmDialog(false);
          }}
          confirmLabel="Discard & Leave"
          cancelLabel="Save and Stay"
          message="You have unsaved changes in the profit calculator. How would you like to proceed?"
        />
      </div>
    </div>
  );
}
