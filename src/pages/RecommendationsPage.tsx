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
  ChevronRight,
  Trash2,
  AlertCircle,
  TrendingDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Header';

interface Recommendation {
  id: string;
  vin: string;
  decoded_data: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  created_at: string;
  recommendation: 'buy' | 'maybe' | 'pass';
  confidence_score: number;
  estimated_profit: number | null;
  max_bid_suggestion: number | null;
  market_data: any;
  match_reasoning: Array<{
    type: 'positive' | 'negative' | 'neutral';
    message: string;
  }>;
  custom_recon_cost: number | null;
  custom_transport_cost: number | null;
  custom_max_bid: number | null;
  custom_market_price: number | null;
  auction_url: string | null;
  purchase_status: 'purchased' | 'not_purchased' | 'pending';
  purchase_price: number | null;
  purchase_date: string | null;
}

type PurchaseStatusFilter = 'all' | 'pending' | 'purchased' | 'not_purchased';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>('pending');

  const observerTarget = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    buy: 0,
    maybe: 0,
    pass: 0,
    avgConfidence: 0,
    potentialProfit: 0,
  });

  // Load recommendations with pagination
  const loadRecommendations = useCallback(
    async (pageNum: number, append = false) => {
      if (!user?.tenant_id) return;

      try {
        const fromRow = pageNum * PAGE_SIZE;
        const toRow = fromRow + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('vin_scans')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .not('recommendation', 'is', null)
          .order('created_at', { ascending: false })
          .range(fromRow, toRow);

        if (error) throw error;

        if (data) {
          if (append) {
            setRecommendations((prev) => [...prev, ...data]);
          } else {
            setRecommendations(data);
          }
          setHasMore(data.length === PAGE_SIZE);

          // Calculate stats (only on initial load)
          if (!append) {
            const buy = data.filter((r) => r.recommendation === 'buy').length;
            const maybe = data.filter((r) => r.recommendation === 'maybe').length;
            const pass = data.filter((r) => r.recommendation === 'pass').length;
            const avgConfidence =
              data.reduce((sum, r) => sum + r.confidence_score, 0) / (data.length || 1);
            const potentialProfit = data
              .filter((r) => r.recommendation === 'buy' && r.confidence_score >= 70)
              .reduce((sum, r) => sum + (r.estimated_profit || 0), 0);

            setStats({
              buy,
              maybe,
              pass,
              avgConfidence,
              potentialProfit,
            });
          }
        }
      } catch (error) {
        console.error('Error loading recommendations:', error);
      } finally {
        setLoading(false);
      }
    },
    [user?.tenant_id]
  );

  // Initial load
  useEffect(() => {
    loadRecommendations(0);
  }, [loadRecommendations]);

  // Filter recommendations
  useEffect(() => {
    let filtered = [...recommendations];

    // Apply purchase status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.purchase_status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.vin.toLowerCase().includes(query) ||
          r.decoded_data.make.toLowerCase().includes(query) ||
          r.decoded_data.model.toLowerCase().includes(query) ||
          `${r.decoded_data.year}`.includes(query) ||
          (r.decoded_data.trim && r.decoded_data.trim.toLowerCase().includes(query))
      );
    }

    setFilteredRecommendations(filtered);
  }, [searchQuery, recommendations, statusFilter]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadRecommendations(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, page, loadRecommendations]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };


  const formatVehicleName = (name: string) => {
    if (!name) return '';
    // Special case for BMW
    if (name.toUpperCase() === 'BMW') return 'BMW';

    // Capitalize first letter of each word
    return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const handleDeleteScan = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation(); // Prevent opening the modal

    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-navy-900 shadow-lg dark:shadow-2xl rounded-lg pointer-events-auto flex ring-1 ring-black dark:ring-navy-700 ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Delete Scan?
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Are you sure you want to delete this scan? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200 dark:border-navy-700">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const { error } = await supabase
                  .from('vin_scans')
                  .delete()
                  .eq('id', scanId);

                if (error) throw error;

                // Remove from local state
                setRecommendations(recommendations.filter(s => s.id !== scanId));
                setFilteredRecommendations(filteredRecommendations.filter(s => s.id !== scanId));
                toast.success('Scan deleted successfully');
              } catch (error) {
                console.error('Error deleting scan:', error);
                toast.error('Failed to delete scan');
              }
            }}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
        <div className="flex border-l border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
    });
  };

  const handleMarkAsPurchased = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    await savePurchaseStatus(scanId, 'purchased');
  };

  const handleMarkAsNotPurchased = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    await savePurchaseStatus(scanId, 'not_purchased');
  };

  const savePurchaseStatus = async (scanId: string, status: 'purchased' | 'not_purchased' | 'pending') => {
    try {
      const updateData: any = {
        purchase_status: status,
        purchase_date: status !== 'pending' ? new Date().toISOString() : null,
        purchase_price: null,
      };

      const { error } = await supabase
        .from('vin_scans')
        .update(updateData)
        .eq('id', scanId);

      if (error) throw error;

      // Update local state
      setRecommendations(prev => prev.map(rec =>
        rec.id === scanId
          ? { ...rec, ...updateData }
          : rec
      ));
      setFilteredRecommendations(prev => prev.map(rec =>
        rec.id === scanId
          ? { ...rec, ...updateData }
          : rec
      ));

      const messages = {
        purchased: 'Marked as purchased',
        not_purchased: 'Marked as not purchased',
        pending: 'Marked as pending'
      };
      toast.success(messages[status]);
    } catch (error) {
      console.error('Error updating purchase status:', error);
      toast.error('Failed to update purchase status');
    }
  };

  const getRecommendationBadge = (recommendation: string) => {
    const badges = {
      buy: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      maybe: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      pass: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    };

    return badges[recommendation as keyof typeof badges];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark">
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">VIN Scan Recommendations</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View all your scanned VINs with AI-powered buying recommendations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-6">
            <div className="flex items-center gap-3 mb-2">
              <ThumbsUp className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Buy</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.buy}</div>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Maybe</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.maybe}</div>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Pass</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pass}</div>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-6">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.avgConfidence.toFixed(0)}%
            </div>
          </div>

          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Potential Profit</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.potentialProfit)}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by VIN, make, model, year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PurchaseStatusFilter)}
            className="px-4 py-3 pr-10 border border-gray-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="pending">Pending ({recommendations.filter(r => r.purchase_status === 'pending').length})</option>
            <option value="purchased">Purchased ({recommendations.filter(r => r.purchase_status === 'purchased').length})</option>
            <option value="not_purchased">Not Purchased ({recommendations.filter(r => r.purchase_status === 'not_purchased').length})</option>
            <option value="all">All Vehicles</option>
          </select>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Found {filteredRecommendations.length} result{filteredRecommendations.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Recommendations List */}
        {loading && recommendations.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No results found' : 'No VIN scans yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Start scanning VINs to see recommendations here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecommendations.map((rec) => (
              <div
                key={rec.id}
                onClick={() => navigate(`/recommendations/${rec.id}`)}
                className={`bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-4 hover:shadow-md dark:hover:shadow-lg transition cursor-pointer ${
                  rec.purchase_status === 'purchased' ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Vehicle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {rec.decoded_data.year} {formatVehicleName(rec.decoded_data.make)} {formatVehicleName(rec.decoded_data.model)}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRecommendationBadge(rec.recommendation)} flex-shrink-0`}>
                        {rec.recommendation.toUpperCase()}
                      </span>
                      {rec.purchase_status === 'purchased' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 flex-shrink-0">
                          PURCHASED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="hidden sm:inline">Max Bid: {rec.max_bid_suggestion ? formatCurrency(rec.max_bid_suggestion) : 'N/A'}</span>
                      <span className={`hidden sm:inline font-medium ${rec.estimated_profit && rec.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}`}>
                        Profit: {rec.estimated_profit ? formatCurrency(rec.estimated_profit) : 'N/A'}
                      </span>
                      {rec.purchase_status === 'purchased' && rec.purchase_price && (
                        <span className="hidden sm:inline font-medium text-green-600 dark:text-green-400">
                          Paid: {formatCurrency(rec.purchase_price)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    {/* View Details */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/recommendations/${rec.id}`);
                      }}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
                      title="View Details"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Mark as Purchased */}
                    <button
                      onClick={(e) => handleMarkAsPurchased(e, rec.id)}
                      className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition flex-shrink-0"
                      title="Mark as Purchased"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>

                    {/* Mark as Not Purchased */}
                    <button
                      onClick={(e) => handleMarkAsNotPurchased(e, rec.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition flex-shrink-0"
                      title="Mark as Not Purchased"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDeleteScan(e, rec.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
                      title="Delete Scan"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mobile: Show financial info */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-4 text-sm sm:hidden">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Max Bid:</span>
                    <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
                      {rec.max_bid_suggestion ? formatCurrency(rec.max_bid_suggestion) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Profit:</span>
                    <span className={`ml-1 font-semibold ${rec.estimated_profit && rec.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}`}>
                      {rec.estimated_profit ? formatCurrency(rec.estimated_profit) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Infinite Scroll Trigger */}
            {hasMore && !searchQuery && (
              <div ref={observerTarget} className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading more...</p>
              </div>
            )}

            {/* End of Results */}
            {!hasMore && recommendations.length > 0 && !searchQuery && (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                You've reached the end of your scan history
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
