import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  TrendingUp,
  TrendingDown,
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
} from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';
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
  status: 'active' | 'sold' | 'price_changed'; // price_changed is legacy, being phased out
  price_history: Array<{ date: string; price: number }>;
}

type StatusFilter = 'all' | 'active' | 'sold' | 'recently_changed';
type SortBy = 'recent' | 'price_asc' | 'price_desc' | 'age';

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
    priceChanged: 0,
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
      if (statusFilter === 'recently_changed') {
        // Filter vehicles with price changes in last 7 days
        filtered = filtered.filter((v) => hasRecentPriceChange(v.price_history));
      } else {
        // Filter by status (active or sold)
        filtered = filtered.filter((v) => v.status === statusFilter);
      }
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
        case 'age':
          return new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime();
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

      const { data, error } = await supabase
        .from('vehicle_history')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setVehicles(data);

        // Calculate stats
        const active = data.filter((v) => v.status === 'active' || v.status === 'price_changed').length;
        const sold = data.filter((v) => v.status === 'sold').length;
        const priceChanged = data.filter((v) => hasRecentPriceChange(v.price_history)).length;
        const totalValue = data
          .filter((v) => v.status === 'active' || v.status === 'price_changed')
          .reduce((sum, v) => sum + v.price, 0);
        const avgPrice = active > 0 ? totalValue / active : 0;

        setStats({
          total: data.length,
          active,
          sold,
          priceChanged,
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

  const hasRecentPriceChange = (priceHistory: Array<{ date: string; price: number }>) => {
    if (!priceHistory || priceHistory.length < 2) return false;
    const lastChange = new Date(priceHistory[priceHistory.length - 1].date);
    const daysSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange <= 7; // Changed in last 7 days
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string, vehicleInfo: string) => {
    // Use toast.promise for a better user experience
    const deletePromise = new Promise(async (resolve, reject) => {
      if (!user?.tenant_id) {
        reject(new Error('No tenant ID found'));
        return;
      }

      try {
        const { error } = await supabase
          .from('vehicle_history')
          .delete()
          .eq('id', vehicleId)
          .eq('tenant_id', user.tenant_id);

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

  const getStatusBadge = (vehicle: Vehicle) => {
    // Check if vehicle has recent price change (within 7 days)
    const recentlyChanged = hasRecentPriceChange(vehicle.price_history);

    if (recentlyChanged) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Price Changed
        </span>
      );
    }

    const badges = {
      active: 'bg-green-100 text-green-800',
      sold: 'bg-blue-100 text-blue-800',
      price_changed: 'bg-yellow-100 text-yellow-800', // legacy support
    };

    const labels = {
      active: 'Active',
      sold: 'Sold',
      price_changed: 'Price Changed', // legacy support
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          badges[vehicle.status as keyof typeof badges]
        }`}
      >
        {labels[vehicle.status as keyof typeof labels]}
      </span>
    );
  };

  const getPriceChangeIndicator = (priceHistory: Array<{ date: string; price: number }>) => {
    if (!priceHistory || priceHistory.length < 2) return null;

    const current = priceHistory[priceHistory.length - 1].price;
    const previous = priceHistory[priceHistory.length - 2].price;
    const change = current - previous;
    const percentChange = (change / previous) * 100;

    if (change === 0) return null;

    return (
      <div
        className={`flex items-center gap-1 text-sm ${
          change > 0 ? 'text-red-600' : 'text-green-600'
        }`}
      >
        {change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span>
          {change > 0 ? '+' : ''}
          {formatCurrency(change)} ({percentChange.toFixed(1)}%)
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
            </Link>
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

                {/* Navigation Menu */}
                {menuOpen && (
                  <NavigationMenu
                    currentPath={location.pathname}
                    onClose={() => setMenuOpen(false)}
                    onSignOut={handleSignOut}
                    user={user}
                    tenantName={tenant?.name}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Inventory</h1>
          <p className="text-gray-600">
            Track your current inventory and sales from website scraping
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Total Vehicles</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Active</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Avg Price</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.avgPrice)}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <span className="text-sm text-gray-600">Total Value</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalValue)}
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by VIN, stock number, make, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="recently_changed">Recently Changed (7 days)</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="recent">Recently Updated</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="age">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredVehicles.length} of {vehicles.length} vehicles
        </div>

        {/* Vehicles Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No vehicles found' : 'No inventory yet'}
            </h3>
            <p className="text-gray-600">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start scraping your website to track inventory'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => {
              const firstImage = vehicle.image_urls && vehicle.image_urls.length > 0 ? vehicle.image_urls[0] : null;
              const daysInInventory = getDaysInInventory(vehicle.first_seen_at);

              return (
                <div
                  key={vehicle.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Vehicle Image */}
                  <div className="relative h-48 bg-gray-100">
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"%3E%3C/path%3E%3Cpath d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"%3E%3C/path%3E%3Cpath d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"%3E%3C/path%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Car className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(vehicle)}
                    </div>
                    <button
                      onClick={() => handleDeleteVehicle(vehicle.id, `${vehicle.year} ${vehicle.make} ${vehicle.model}`)}
                      className="absolute top-2 left-2 p-2 bg-white/90 hover:bg-red-50 rounded-full shadow-sm transition-colors group"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 group-hover:text-red-600" />
                    </button>
                  </div>

                  {/* Vehicle Info */}
                  <div className="p-4">
                    {/* Title */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    {vehicle.trim && (
                      <p className="text-sm text-gray-600 mb-3">{vehicle.trim}</p>
                    )}

                    {/* Price and Mileage */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(vehicle.price)}
                      </div>
                      {vehicle.mileage && (
                        <div className="text-sm text-gray-600">
                          {vehicle.mileage.toLocaleString()} mi
                        </div>
                      )}
                    </div>

                    {/* Price Change Indicator */}
                    {getPriceChangeIndicator(vehicle.price_history) && (
                      <div className="mb-3">
                        {getPriceChangeIndicator(vehicle.price_history)}
                      </div>
                    )}

                    {/* Listing Date and Days */}
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Listed:</span> {formatDate(vehicle.first_seen_at)}
                      </div>
                      <div>
                        <span className="font-medium">Days:</span> {daysInInventory}
                      </div>
                    </div>

                    {/* Additional Details (Collapsible) */}
                    <div className="text-xs text-gray-500 space-y-1 mb-3">
                      {vehicle.stock_number && (
                        <div>Stock #: {vehicle.stock_number}</div>
                      )}
                      {vehicle.exterior_color && (
                        <div>Color: {vehicle.exterior_color}</div>
                      )}
                      <div className="font-mono truncate" title={vehicle.vin}>
                        VIN: {vehicle.vin}
                      </div>
                    </div>

                    {/* View Listing Link */}
                    {vehicle.listing_url && (
                      <a
                        href={vehicle.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        View Listing →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
