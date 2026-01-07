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
  Menu,
  X,
  Car,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';
import Header from '../components/Header';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    sold: 0,
    avgPrice: 0,
    totalValue: 0,
  });

  // Load vehicles
  useEffect(() => {
    loadVehicles();
  }, [user?.tenant_id]);

  // Filter and sort vehicles
  useEffect(() => {
    let filtered = [...vehicles];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    // Apply search filter
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

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'oldest':
          // Days in lot: highest first (oldest)
          return getDaysInInventory(b.first_seen_at) - getDaysInInventory(a.first_seen_at);
        case 'newest':
          // Days in lot: lowest first (newest)
          return getDaysInInventory(a.first_seen_at) - getDaysInInventory(b.first_seen_at);
        case 'year_desc':
          return b.year - a.year;
        case 'year_asc':
          return a.year - b.year;
        case 'recent':
        default:
          return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
      }
    });

    setFilteredVehicles(filtered);
  }, [vehicles, statusFilter, searchQuery, sortBy]);

  const loadVehicles = async () => {
    if (!user?.tenant_id) return;

    try {
      setLoading(true);

      // Load vehicles: First get sources, then get vehicles (Centralized Model)
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
        // Fallback for legacy/unmigrated data
        const { data: legacyVehicles, error } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .order('last_seen_at', { ascending: false });

        if (error) throw error;
        data = legacyVehicles || [];
      }

      // 2. Fetch Overrides (Private Data)
      const { data: overrides } = await supabase
        .from('tenant_vehicle_overrides')
        .select('*')
        .eq('tenant_id', user.tenant_id);

      // Map overrides by vehicle_id for easy lookup
      const overrideMap = new Map((overrides || []).map(o => [o.vehicle_id, o]));

      if (data) {
        // Merge overrides and filter out deleted/hidden vehicles
        const mergedVehicles = data
          .map(v => {
            const override = overrideMap.get(v.id);
            if (override?.floor_plan_status === 'deleted') return null; // Filter out

            return {
              ...v,
              // Check if we need to apply overrides (e.g. custom price)
              price: override?.custom_price || v.price,
              // Add other override fields if needed
              notes: override?.notes
            };
          })
          .filter(Boolean) as Vehicle[]; // Remove nulls

        setVehicles(mergedVehicles);

        // Calculate stats
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
    const days = Math.floor(
      (Date.now() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleRequestUpdate = async () => {
    if (!user?.tenant_id || !tenant) return;

    const updatePromise = new Promise(async (resolve, reject) => {
      try {
        // Get or create source from tenant's website_url
        if (!tenant.website_url) {
          throw new Error('No website URL configured. Please set up your website in Settings.');
        }

        // 1. Get or create source registry entry
        const { data: sourceData, error: sourceError } = await supabase
          .from('source_registry')
          .upsert({
            source_url: tenant.website_url,
            source_type: 'dealer',
            source_name: tenant.name || tenant.website_url,
            scraping_enabled: true
          }, {
            onConflict: 'source_url'
          })
          .select('id')
          .single();

        if (sourceError) throw sourceError;

        // 2. Ensure tenant-source link exists
        await supabase
          .from('tenant_sources')
          .upsert({
            tenant_id: user.tenant_id,
            source_id: sourceData.id,
            relationship_type: 'owner'
          }, {
            onConflict: 'tenant_id,source_id'
          });

        // 3. Trigger Scrape via RPC (Secure)
        const { error: rpcError } = await supabase
          .rpc('request_source_scan', { p_source_id: sourceData.id });

        if (rpcError) throw rpcError;

        // 4. Update tenant status for UI feedback
        await supabase
          .from('tenants')
          .update({ inventory_status: 'pending' })
          .eq('id', user.tenant_id);

        resolve('Update requested');
      } catch (error) {
        console.error('Error requesting update:', error);
        reject(error);
      }
    });

    toast.promise(
      updatePromise,
      {
        loading: 'Requesting inventory update...',
        success: 'Inventory update requested! Your inventory will be refreshed shortly.',
        error: (err) => `Failed to request update: ${err.message || 'Unknown error'}`,
      }
    );
  };

  const handleDeleteVehicle = async (vehicleId: string, vehicleInfo: string) => {
    // Use toast.promise for a better user experience
    const deletePromise = new Promise(async (resolve, reject) => {
      if (!user?.tenant_id) {
        reject(new Error('No tenant ID found'));
        return;
      }

      try {
        // Soft Delete via Overrides (Centralized Model)
        const { error } = await supabase
          .from('tenant_vehicle_overrides')
          .upsert({
            tenant_id: user.tenant_id,
            vehicle_id: vehicleId,
            floor_plan_status: 'deleted' // Using this field as a hide flag for now
          }, {
            onConflict: 'tenant_id,vehicle_id'
          });

        if (error) throw error;

        // Reload vehicles
        await loadVehicles();
        resolve(vehicleInfo);
      } catch (error) {
        console.error('Error deleting vehicle:', error);
        reject(error);
      }
    });

    // Show toast confirmation with promise
    toast.promise(
      deletePromise,
      {
        loading: `Deleting ${vehicleInfo}...`,
        success: `${vehicleInfo} deleted successfully`,
        error: (err) => `Failed to delete vehicle: ${err.message || 'Unknown error'}`,
      }
    );
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      sold: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    };

    const labels = {
      active: 'Active',
      sold: 'Sold',
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]
          }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark">
      <Toaster position="top-right" />
      {/* Header */}
      <Header
        user={user}
        tenant={tenant}
        signOut={handleSignOut}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Manage Inventory</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track your current inventory and sales from website scraping
            </p>
          </div>
          {tenant?.inventory_status === 'ready' && (
            <button
              onClick={handleRequestUpdate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap self-start sm:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Request Update
            </button>
          )}
        </div>

        {/* Processing Status Message */}
        {(tenant?.inventory_status === 'pending' || tenant?.inventory_status === 'processing' || tenant?.inventory_status === 'pending_review') && (
          <div className="flex items-center justify-center px-4 py-8">
            <div className="max-w-2xl w-full bg-white dark:bg-navy-900 rounded-lg shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="bg-blue-100 dark:bg-blue-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Your inventory is being processed</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">This usually takes a few minutes, but it can take up to 2-4 hours. We appreciate your patience.</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6 text-center">
                <p className="text-blue-800 dark:text-blue-200 font-medium">You'll be notified via email when it is ready for you to review.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
                >
                  Go to Dashboard
                </button>
              </div>

              {tenant?.inventory_ready_at && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-6 text-center">
                  Last updated: {new Date(tenant.inventory_ready_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Only show stats and vehicles if inventory is ready */}
        {tenant?.inventory_status === 'ready' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Vehicles</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              </div>

              <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</div>
              </div>

              <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Price</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.avgPrice)}</div>
              </div>

              <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Value</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.totalValue)}
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-4 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by VIN, stock number, make, model..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-navy-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-navy-800 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="px-4 py-2 border border-gray-300 dark:border-navy-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-navy-800 text-gray-900 dark:text-white"
                  >
                    <option value="recent">Recently Updated</option>
                    <option value="oldest">Oldest First</option>
                    <option value="newest">Newest First</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="year_desc">Year: High to Low</option>
                    <option value="year_asc">Year: Low to High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredVehicles.length} of {vehicles.length} vehicles
            </div>

            {/* Vehicles List */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-orange-500"></div>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {searchQuery || statusFilter !== 'all' ? 'No vehicles found' : 'No inventory yet'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Start scraping your website to track inventory'}
                </p>
              </div>
            ) : (
              /* List View */
              <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 divide-y divide-gray-200 dark:divide-navy-700">
                {filteredVehicles.map((vehicle) => {
                  return (
                    <div
                      key={vehicle.id}
                      className="flex items-center gap-3 md:gap-4 p-3 md:p-4 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
                    >
                      {/* Vehicle Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </h3>
                            <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(vehicle.price)}</span>
                              {vehicle.mileage && (
                                <span className="hidden md:inline">{vehicle.mileage.toLocaleString()} mi</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getStatusBadge(vehicle.status)}
                            <button
                              onClick={() => handleDeleteVehicle(vehicle.id, `${vehicle.year} ${vehicle.make} ${vehicle.model}`)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-full transition-colors group"
                              title="Delete vehicle"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-red-600 dark:group-hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
