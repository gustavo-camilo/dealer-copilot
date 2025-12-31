import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VINScan } from '../types/database';
import { BarChart3, Car, TrendingUp, Clock, Target, Scan, Globe, ChevronRight, Package, Eye, RefreshCw, X } from 'lucide-react';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import ConfirmationDialog from '../components/ConfirmationDialog';

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
      buy: 'bg-green-100 text-green-800',
      caution: 'bg-yellow-100 text-yellow-800',
      pass: 'bg-red-100 text-red-800',
    };
    return badges[recommendation as keyof typeof badges];
  };

  const formatVehicleName = (name: string) => {
    if (!name) return '';
    // Special case for BMW
    if (name.toUpperCase() === 'BMW') return 'BMW';

    // Capitalize first letter of each word
    return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.tenant_id) return;

    try {
      // Load vehicles: First get sources, then get vehicles (Centralized Model)
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
          .eq('status', 'active');

        vehicles = sourcedVehicles || [];
      } else {
        // Fallback for legacy/unmigrated data (Empty sources but might have direct tenant_id rows)
        const { data: legacyVehicles } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'active');

        vehicles = legacyVehicles || [];
      }

      // Load recent sales
      const { data: recentSales } = await supabase
        .from('sales_records')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .gte('sale_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('sale_date', { ascending: false });

      // Load recent VIN scans (limit 5)
      const { data: scans } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Load recommendations (vehicles with "buy" recommendation)
      const { data: recs } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('recommendation', 'buy')
        .gte('confidence_score', 70)
        .order('confidence_score', { ascending: false })
        .limit(5);

      // Check if inventory has been requested/submitted (any status means they've submitted)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        user={user}
        tenant={tenant}
        signOut={handleSignOut}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message - Only show if inventory hasn't been requested yet */}
        {!hasRequestedInventory && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-2">
              Welcome to Dealer Co-Pilot!
            </h3>
            <p className="text-blue-800 mb-4">
              Get started by analyzing your website inventory or manually adding vehicles.
            </p>
            <Link
              to="/onboarding"
              className="inline-block bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition"
            >
              Analyze My Website
            </Link>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">{tenant?.location}</p>
        </div>

        {/* Quick Actions - Button Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              to="/scan"
              className="bg-white p-4 rounded-lg shadow-sm border-2 border-gray-200 hover:border-orange-600 hover:shadow-md transition text-center"
            >
              <Scan className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 text-sm">Scan VIN</h3>
            </Link>

            <Link
              to="/inventory"
              className="bg-white p-4 rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-900 hover:shadow-md transition text-center"
            >
              <Car className="h-8 w-8 text-blue-900 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 text-sm">Inventory</h3>
            </Link>

            <Link
              to="/competitors"
              className="bg-white p-4 rounded-lg shadow-sm border-2 border-gray-200 hover:border-purple-600 hover:shadow-md transition text-center"
            >
              <Eye className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 text-sm">Competitor Intel</h3>
            </Link>

            <Link
              to="/recommendations"
              className="bg-white p-4 rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-900 hover:shadow-md transition text-center"
            >
              <Target className="h-8 w-8 text-blue-900 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 text-sm">Recommendations</h3>
            </Link>

            <Link
              to="/onboarding"
              className="bg-white p-4 rounded-lg shadow-sm border-2 border-gray-200 hover:border-blue-900 hover:shadow-md transition text-center"
            >
              <Globe className="h-8 w-8 text-blue-900 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 text-sm">Scan Website</h3>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Vehicles</h3>
              <Car className="h-5 w-5 text-blue-900" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalVehicles}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Portfolio Value</h3>
              <BarChart3 className="h-5 w-5 text-blue-900" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${stats.portfolioValue.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Avg Days on Lot</h3>
              <Clock className="h-5 w-5 text-blue-900" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgDaysInInventory}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">This Week's Sales</h3>
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.weekSales}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buy Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Recommended to Buy</h2>
                <Link
                  to="/recommendations"
                  className="text-sm text-blue-900 hover:text-blue-800 font-semibold flex items-center"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </div>
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="p-3 border border-green-200 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-900">
                            {rec.decoded_data.year} {rec.decoded_data.make} {rec.decoded_data.model}
                          </span>
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                            BUY
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Max Bid: ${rec.max_bid_suggestion?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-700">
                          {rec.confidence_score}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent VIN Scans */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Recent VIN Scans</h2>
              {recentScans.length > 0 && (
                <Link
                  to="/recommendations"
                  className="text-sm text-blue-900 hover:text-blue-800 font-semibold flex items-center"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              )}
            </div>
            {recentScans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Scan className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No scans yet</p>
                <Link
                  to="/scan"
                  className="text-blue-900 hover:text-blue-800 font-semibold text-sm mt-2 inline-block"
                >
                  Scan your first VIN
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => setSelectedScan(scan)}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {scan.decoded_data.year} {formatVehicleName(scan.decoded_data.make)} {formatVehicleName(scan.decoded_data.model)}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRecommendationBadge(scan.recommendation)} flex-shrink-0`}>
                            {scan.recommendation.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Max Bid: {scan.max_bid_suggestion ? formatCurrency(scan.max_bid_suggestion) : 'N/A'}</span>
                          <span className={`font-medium ${scan.estimated_profit && scan.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            Profit: {scan.estimated_profit ? formatCurrency(scan.estimated_profit) : 'N/A'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScan(scan);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                        title="View Details"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Analysis Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Inventory Analysis</h2>
              <Link
                to="/inventory"
                className="text-sm text-blue-900 hover:text-blue-800 font-semibold flex items-center"
              >
                View Inventory
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>

            {tenant?.inventory_status === 'pending' || tenant?.inventory_status === 'processing' || tenant?.inventory_status === 'pending_review' ? (
              <div className="text-center py-6">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Your inventory is being processed</h3>
                <p className="text-sm text-gray-600 mb-3">
                  We're currently scanning your website. This usually takes a few minutes, but can take up to 2-4 hours.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-center">
                  <p className="text-xs text-blue-800 font-medium">You'll be notified via email when ready.</p>
                </div>
              </div>
            ) : tenant?.inventory_status === 'ready' && stats.totalVehicles > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">Total Vehicles</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalVehicles}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">Portfolio Value</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(stats.portfolioValue)}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Avg Days on Lot</span>
                    <Clock className="w-4 h-4 text-gray-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{stats.avgDaysInInventory} days</p>
                </div>
                {tenant?.inventory_ready_at && (
                  <p className="text-xs text-gray-500 text-center">
                    Last updated: {new Date(tenant.inventory_ready_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="mb-2">No inventory analyzed yet</p>
                <Link
                  to="/onboarding"
                  className="text-blue-900 hover:text-blue-800 font-semibold text-sm inline-block"
                >
                  Analyze Your Inventory
                </Link>
              </div>
            )}
          </div>
        </div >

        {/* Details Modal */}
        {
          selectedScan && (
            <div
              className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
              onClick={handleCloseModal}
            >
              <div
                className="bg-white w-full md:max-w-4xl md:rounded-lg shadow-xl max-h-screen overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between z-10">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">Scan Details</h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

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
            </div>
          )
        }

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
      </div >
    </div >
  );
}
