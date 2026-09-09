import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle,
  ThumbsUp,
  Search,
  DollarSign,
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

const STATUS_TABS: Array<{ value: PurchaseStatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'not_purchased', label: 'Not Purchased' },
  { value: 'all', label: 'All Vehicles' },
];

// Builds the server-side search filter for PostgREST's .or().
//
// SECURITY: .or() takes a comma-separated list of filters as a raw string, so an
// unescaped search term could terminate its own filter and inject additional
// conditions. Wrapping the value in double quotes neutralises PostgREST's
// reserved characters ( , . : ( ) ), and backslashes and quotes inside the term
// are escaped so it cannot close its own quoting. The term is never concatenated
// into SQL — PostgREST parses it as a value and parameterises the query itself.
const buildSearchFilter = (term: string) => {
  const value = `"%${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`;
  return [
    `vin.ilike.${value}`,
    `decoded_data->>make.ilike.${value}`,
    `decoded_data->>model.ilike.${value}`,
    `decoded_data->>year.ilike.${value}`,
    `decoded_data->>trim.ilike.${value}`,
  ].join(',');
};

export default function RecommendationsPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>('pending');
  const [tabCounts, setTabCounts] = useState<Record<PurchaseStatusFilter, number | null>>({
    pending: null,
    purchased: null,
    not_purchased: null,
    all: null,
  });
  // Bumped after a delete or a status change so the tab counts are refetched
  const [countsVersion, setCountsVersion] = useState(0);
  // Total rows matching the active tab + search, returned by the list query
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    buy: 0,
    maybe: 0,
    pass: 0,
    totalInvestment: 0,
    potentialProfit: 0,
  });

  // Debounce the search box so typing doesn't fire a query per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load recommendations with pagination. The status filter and the search are
  // applied server-side so they cover every row in the table, not just the pages
  // already loaded by the infinite scroll.
  const loadRecommendations = useCallback(
    async (pageNum: number, append = false) => {
      if (!user?.tenant_id) return;

      setLoading(true); // re-arm the in-flight guard checked by the scroll observer
      try {
        const fromRow = pageNum * PAGE_SIZE;
        const toRow = fromRow + PAGE_SIZE - 1;

        // count: 'exact' returns the total number of matching rows alongside this
        // page, so the results count reflects the whole table rather than the pages
        // loaded so far.
        let query = supabase
          .from('vin_scans')
          .select('*', { count: 'exact' })
          .eq('tenant_id', user.tenant_id)
          .not('recommendation', 'is', null);

        if (statusFilter !== 'all') {
          query = query.eq('purchase_status', statusFilter);
        }
        if (debouncedSearch) {
          query = query.or(buildSearchFilter(debouncedSearch));
        }

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(fromRow, toRow);

        if (error) throw error;

        setTotalCount(count ?? null);

        if (data) {
          if (append) {
            setRecommendations((prev) => [...prev, ...data]);
          } else {
            setRecommendations(data);
          }
          setHasMore(data.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error('Error loading recommendations:', error);
      } finally {
        setLoading(false);
      }
    },
    [user?.tenant_id, statusFilter, debouncedSearch]
  );

  // Load the first page, and start over whenever the tab or the search changes
  // (loadRecommendations is re-created when either does).
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    loadRecommendations(0);
  }, [loadRecommendations]);

  // Tab counts are totals for the whole tenant, independent of the search and of
  // how many pages have been scrolled. head:true fetches the count without rows.
  useEffect(() => {
    if (!user?.tenant_id) return;
    let cancelled = false;

    const countFor = async (status: PurchaseStatusFilter) => {
      let query = supabase
        .from('vin_scans')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id)
        .not('recommendation', 'is', null);

      if (status !== 'all') {
        query = query.eq('purchase_status', status);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    };

    (async () => {
      try {
        const [pending, purchased, not_purchased, all] = await Promise.all([
          countFor('pending'),
          countFor('purchased'),
          countFor('not_purchased'),
          countFor('all'),
        ]);
        if (!cancelled) setTabCounts({ pending, purchased, not_purchased, all });
      } catch (error) {
        console.error('Error loading tab counts:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.tenant_id, countsVersion]);

  // Calculate stats from the loaded recommendations
  useEffect(() => {
    const buy = recommendations.filter((r) => r.recommendation === 'buy').length;
    const maybe = recommendations.filter((r) => r.recommendation === 'maybe').length;
    const pass = recommendations.filter((r) => r.recommendation === 'pass').length;
    const totalInvestment = recommendations.reduce((sum, r) => sum + (r.max_bid_suggestion || 0), 0);
    const potentialProfit = recommendations.reduce((sum, r) => sum + (r.estimated_profit || 0), 0);

    setStats({
      buy,
      maybe,
      pass,
      totalInvestment,
      potentialProfit,
    });
  }, [recommendations]);

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
    // The sentinel <div ref={observerTarget}> only mounts once recommendations is
    // non-empty, so the effect must re-run on that too — otherwise observe() is
    // never called on the real element.
  }, [hasMore, loading, page, loadRecommendations, recommendations]);

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

                // Remove from local state (functional updates: the toast closure may be stale
                // by the time Delete is clicked, once more pages have been appended)
                setRecommendations(prev => prev.filter(s => s.id !== scanId));
                setCountsVersion(v => v + 1);
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

      // Update local state. The list is now filtered server-side, so a scan that no
      // longer matches the active tab has to drop out of it rather than linger.
      setRecommendations(prev =>
        statusFilter !== 'all' && status !== statusFilter
          ? prev.filter(rec => rec.id !== scanId)
          : prev.map(rec => (rec.id === scanId ? { ...rec, ...updateData } : rec))
      );
      setCountsVersion(v => v + 1);

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">VIN Scans</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View all your scanned VINs with AI-powered buying recommendations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Investment</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.totalInvestment)}
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Potential Profit</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.potentialProfit)}
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="mb-4 border-b border-gray-200 dark:border-brand-border-dark">
          <nav className="-mb-px flex gap-1 sm:gap-2 overflow-x-auto" aria-label="Filter by purchase status">
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.value;
              const count = tabCounts[tab.value];
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${isActive
                    ? 'border-blue-900 dark:border-blue-400 text-blue-900 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-navy-600'
                    }`}
                >
                  {tab.label}
                  {count !== null && (
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${isActive
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by VIN, make, model, year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Results Count */}
        {debouncedSearch && totalCount !== null && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Found {totalCount} result{totalCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Recommendations List */}
        {loading && recommendations.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {debouncedSearch
                ? 'No results found'
                : statusFilter === 'all'
                  ? 'No VIN scans yet'
                  : `No ${STATUS_TABS.find(t => t.value === statusFilter)?.label.toLowerCase()} vehicles`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {debouncedSearch
                ? 'Try adjusting your search terms'
                : statusFilter === 'all'
                  ? 'Start scanning VINs to see recommendations here'
                  : 'Try another tab to see your other vehicles'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                onClick={() => navigate(`/recommendations/${rec.id}`)}
                className={`bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-4 hover:shadow-md dark:hover:shadow-lg transition cursor-pointer ${
                  rec.purchase_status === 'purchased' ? 'opacity-75' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  {/* Left: Vehicle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 sm:mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {rec.decoded_data.year} {formatVehicleName(rec.decoded_data.make)} {formatVehicleName(rec.decoded_data.model)}
                      </h3>
                      {/* Desktop Badges */}
                      <span className={`hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-semibold ${getRecommendationBadge(rec.recommendation)} flex-shrink-0`}>
                        {rec.recommendation.toUpperCase()}
                      </span>
                      {rec.purchase_status === 'purchased' && (
                        <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 flex-shrink-0">
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

                  {/* Right: Actions + Mobile Badges */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                    {/* Mobile Badges */}
                    <div className="flex sm:hidden items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRecommendationBadge(rec.recommendation)} flex-shrink-0`}>
                        {rec.recommendation.toUpperCase()}
                      </span>
                      {rec.purchase_status === 'purchased' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 flex-shrink-0">
                          PURCHASED
                        </span>
                      )}
                    </div>

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

            {/* Infinite Scroll Trigger — search is applied server-side now, so
                results keep paginating instead of stopping at the loaded pages */}
            {hasMore && (
              <div ref={observerTarget} className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading more...</p>
              </div>
            )}

            {/* End of Results */}
            {!hasMore && recommendations.length > 0 && (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {debouncedSearch ? "You've reached the end of the results" : "You've reached the end of your scan history"}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
