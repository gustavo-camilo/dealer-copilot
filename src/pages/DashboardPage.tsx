import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Vehicle, SalesRecord, VINScan } from '../types/database';
import { BarChart3, Car, TrendingUp, Clock, Target, Scan, Menu, X, LogOut, Settings, Globe, ChevronRight, Package } from 'lucide-react';

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

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.tenant_id) return;

    try {
      // Load vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('status', 'available');

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
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
            </div>
            <div className="flex items-center space-x-4 relative">
              <span className="text-sm text-gray-600 hidden md:inline">{tenant?.name}</span>
              <Link
                to="/scan"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition hidden md:inline-block"
              >
                Scan VIN
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>

                {/* Full-Page Mobile Menu / Dropdown for Desktop */}
                {menuOpen && (
                  <>
                    {/* Full-page overlay on mobile, backdrop on desktop */}
                    <div
                      className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 md:hidden"
                      onClick={() => setMenuOpen(false)}
                    />

                    {/* Mobile: Full-page menu, Desktop: Dropdown */}
                    <div className="fixed inset-0 bg-white z-50 md:absolute md:inset-auto md:right-0 md:mt-2 md:w-64 md:rounded-lg md:shadow-lg md:border md:border-gray-200">
                      {/* Mobile Header */}
                      <div className="flex justify-between items-center p-4 border-b border-gray-200 md:hidden">
                        <div className="flex items-center">
                          <Target className="h-6 w-6 text-blue-900" />
                          <span className="ml-2 text-lg font-bold text-gray-900">Menu</span>
                        </div>
                        <button
                          onClick={() => setMenuOpen(false)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>

                      {/* User Info */}
                      <div className="p-6 md:p-4 border-b border-gray-200">
                        <p className="text-base md:text-sm font-semibold text-gray-900">{user?.full_name}</p>
                        <p className="text-sm md:text-xs text-gray-500">{user?.email}</p>
                        <p className="text-sm md:text-xs text-gray-500 mt-1">{tenant?.name}</p>
                      </div>

                      {/* Menu Items */}
                      <div className="py-4 md:py-2">
                        <Link
                          to="/scan"
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50 md:hidden"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Scan className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3 text-orange-600" />
                          Scan VIN
                        </Link>
                        <Link
                          to="/inventory"
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Car className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                          Manage Inventory
                        </Link>
                        <Link
                          to="/recommendations"
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Target className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                          View Recommendations
                        </Link>
                        <Link
                          to="/vin-scans"
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Package className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                          VIN Scan History
                        </Link>
                        <Link
                          to="/onboarding"
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Globe className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                          Scan Website
                        </Link>
                        {user?.role === 'super_admin' && (
                          <Link
                            to="/admin"
                            className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setMenuOpen(false)}
                          >
                            <Settings className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                            Admin Panel
                          </Link>
                        )}
                      </div>

                      {/* Sign Out */}
                      <div className="border-t border-gray-200 py-4 md:py-2 mt-auto">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">{tenant?.location}</p>
        </div>

        {/* Quick Actions - Button Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  to="/vin-scans"
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
                  <div key={scan.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="font-semibold text-gray-900">
                          {scan.decoded_data.year} {scan.decoded_data.make} {scan.decoded_data.model}
                        </span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                          scan.recommendation === 'buy'
                            ? 'bg-green-100 text-green-800'
                            : scan.recommendation === 'caution'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {scan.recommendation.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(scan.created_at).toLocaleDateString()} at {new Date(scan.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {scan.confidence_score}% confidence
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Welcome Message */}
        {stats.totalVehicles === 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
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
      </div>
    </div>
  );
}
