import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  Search,
  Trash2,
  RefreshCw,
  Target,
  Menu,
  X,
  DollarSign,
  Gauge,
  BarChart3,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';

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
  scraping_duration_ms: number | null;
  status: 'success' | 'partial' | 'failed';
  error_message: string | null;
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
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = () => {
    try {
      setLoading(true);
      // Load from localStorage
      const stored = localStorage.getItem('competitor_snapshots');
      if (stored) {
        setCompetitors(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading competitors:', error);
      setError('Failed to load competitors');
    } finally {
      setLoading(false);
    }
  };

  const handleScanCompetitor = async (url?: string, name?: string) => {
    const competitorUrl = url || newCompetitorUrl;
    const competitorName = name || newCompetitorName;

    if (!competitorUrl.trim()) {
      setError('Please enter a competitor URL');
      return;
    }

    try {
      setScanning(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-competitor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: competitorUrl,
            name: competitorName || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to scan competitor');
      }

      // Add to local storage
      const newSnapshot: CompetitorSnapshot = {
        id: crypto.randomUUID(),
        competitor_url: result.data.competitor_url,
        competitor_name: result.data.competitor_name,
        scanned_at: result.data.scanned_at,
        vehicle_count: result.data.vehicle_count,
        avg_price: result.data.avg_price,
        min_price: result.data.min_price,
        max_price: result.data.max_price,
        avg_mileage: result.data.avg_mileage,
        min_mileage: result.data.min_mileage,
        max_mileage: result.data.max_mileage,
        total_inventory_value: result.data.total_inventory_value,
        top_makes: result.data.top_makes,
        scraping_duration_ms: result.data.scraping_duration_ms,
        status: 'success',
        error_message: null,
      };

      const stored = localStorage.getItem('competitor_snapshots');
      const existing = stored ? JSON.parse(stored) : [];

      // Replace if same URL exists, otherwise add
      const index = existing.findIndex((c: CompetitorSnapshot) => c.competitor_url === newSnapshot.competitor_url);
      if (index >= 0) {
        existing[index] = newSnapshot;
      } else {
        existing.unshift(newSnapshot);
      }

      localStorage.setItem('competitor_snapshots', JSON.stringify(existing));

      // Clear form
      setNewCompetitorUrl('');
      setNewCompetitorName('');

      // Reload competitors list
      loadCompetitors();
    } catch (error) {
      console.error('Error scanning competitor:', error);
      setError(error instanceof Error ? error.message : 'Failed to scan competitor');
    } finally {
      setScanning(false);
    }
  };

  const handleDeleteCompetitor = (id: string) => {
    if (!confirm('Are you sure you want to delete this competitor snapshot?')) {
      return;
    }

    try {
      const stored = localStorage.getItem('competitor_snapshots');
      if (stored) {
        const existing = JSON.parse(stored);
        const filtered = existing.filter((c: CompetitorSnapshot) => c.id !== id);
        localStorage.setItem('competitor_snapshots', JSON.stringify(filtered));
        loadCompetitors();
      }
    } catch (error) {
      console.error('Error deleting competitor:', error);
      setError('Failed to delete competitor');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null) return 'N/A';
    return value.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Competitor Intelligence</h1>
          <p className="text-gray-600">
            Analyze competitor inventory to stay competitive
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scan Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan New Competitor</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="url"
                placeholder="Competitor website URL (e.g., https://competitor.com)"
                value={newCompetitorUrl}
                onChange={(e) => setNewCompetitorUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={scanning}
              />
            </div>
            <div className="sm:w-64">
              <input
                type="text"
                placeholder="Competitor name (optional)"
                value={newCompetitorName}
                onChange={(e) => setNewCompetitorName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={scanning}
              />
            </div>
            <button
              onClick={() => handleScanCompetitor()}
              disabled={scanning || !newCompetitorUrl.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Quick Scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Competitors List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : competitors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No competitors scanned yet</h3>
            <p className="text-gray-600">Enter a competitor URL above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {competitors.map((competitor) => (
              <div
                key={competitor.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {competitor.competitor_name || new URL(competitor.competitor_url).hostname}
                    </h3>
                    <a
                      href={competitor.competitor_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {competitor.competitor_url}
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      Scanned {formatDate(competitor.scanned_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleScanCompetitor(competitor.competitor_url, competitor.competitor_name || undefined)}
                      disabled={scanning}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                      title="Rescan"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCompetitor(competitor.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="space-y-3">
                  {/* Vehicle Count & Total Value */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Car className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-gray-600">Total Vehicles</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatNumber(competitor.vehicle_count)}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-gray-600">Total Value</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(competitor.total_inventory_value)}
                      </div>
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-medium text-gray-600">Price Range</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-600">Min:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(competitor.min_price)}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-sm text-gray-600">Avg:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(competitor.avg_price)}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-sm text-gray-600">Max:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(competitor.max_price)}
                      </span>
                    </div>
                  </div>

                  {/* Mileage Range */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-medium text-gray-600">Mileage Range</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-600">Min:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatNumber(competitor.min_mileage)} mi
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-sm text-gray-600">Avg:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatNumber(competitor.avg_mileage)} mi
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-sm text-gray-600">Max:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatNumber(competitor.max_mileage)} mi
                      </span>
                    </div>
                  </div>

                  {/* Top Makes */}
                  {Object.keys(competitor.top_makes).length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-600 mb-2">Top Brands</div>
                      <div className="space-y-1">
                        {Object.entries(competitor.top_makes)
                          .slice(0, 5)
                          .map(([make, count]) => (
                            <div key={make} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{make}</span>
                              <span className="font-semibold text-gray-900">({count})</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
