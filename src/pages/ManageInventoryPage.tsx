import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  LogOut,
  Settings,
  Scan,
  Globe,
} from 'lucide-react';

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
  first_seen_at: string;
  last_seen_at: string;
  status: 'active' | 'sold' | 'price_changed';
  price_history: Array<{ date: string; price: number }>;
}

type StatusFilter = 'all' | 'active' | 'sold' | 'price_changed';
type SortBy = 'recent' | 'price_asc' | 'price_desc' | 'age';

export default function ManageInventoryPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
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
        const active = data.filter((v) => v.status === 'active').length;
        const sold = data.filter((v) => v.status === 'sold').length;
        const priceChanged = data.filter((v) => v.status === 'price_changed').length;
        const totalValue = data
          .filter((v) => v.status === 'active')
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

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      sold: 'bg-blue-100 text-blue-800',
      price_changed: 'bg-yellow-100 text-yellow-800',
    };

    const labels = {
      active: 'Active',
      sold: 'Sold',
      price_changed: 'Price Changed',
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          badges[status as keyof typeof badges]
        }`}
      >
        {labels[status as keyof typeof labels]}
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
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
                          to="/dashboard"
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Target className="h-6 md:h-4 w-6 md:w-4 mr-4 md:mr-3" />
                          Dashboard
                        </Link>
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
                          className="flex items-center px-6 md:px-4 py-4 md:py-2 text-base md:text-sm text-gray-700 hover:bg-gray-50 bg-gray-50"
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
                <option value="price_changed">Price Changed</option>
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

        {/* Vehicles List */}
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
          <div className="space-y-4">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Vehicle Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                            {vehicle.trim && (
                              <span className="text-gray-600 font-normal"> {vehicle.trim}</span>
                            )}
                          </h3>
                          {getStatusBadge(vehicle.status)}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p className="font-mono">VIN: {vehicle.vin}</p>
                          {vehicle.stock_number && <p>Stock #: {vehicle.stock_number}</p>}
                          {vehicle.mileage && (
                            <p>{vehicle.mileage.toLocaleString()} miles</p>
                          )}
                          {vehicle.exterior_color && <p>Color: {vehicle.exterior_color}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div>
                        <span className="font-medium">First seen:</span> {formatDate(vehicle.first_seen_at)}
                      </div>
                      <div>
                        <span className="font-medium">Last seen:</span> {formatDate(vehicle.last_seen_at)}
                      </div>
                      <div>
                        <span className="font-medium">Days in inventory:</span>{' '}
                        {getDaysInInventory(vehicle.first_seen_at)}
                      </div>
                    </div>
                  </div>

                  {/* Price Info */}
                  <div className="lg:min-w-[200px] text-right">
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {formatCurrency(vehicle.price)}
                    </div>
                    {getPriceChangeIndicator(vehicle.price_history)}
                    {vehicle.listing_url && (
                      <a
                        href={vehicle.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View Listing →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
