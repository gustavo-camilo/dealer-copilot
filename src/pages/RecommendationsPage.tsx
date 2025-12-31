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
  X,
  ChevronRight,
  Trash2,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import ConfirmationDialog from '../components/ConfirmationDialog';

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
  recommendation: 'buy' | 'caution' | 'pass';
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
}

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
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const scanResultRef = useRef<{ saveCosts: () => void }>(null);

  const handleCloseModal = () => {
    if (isEditingCosts) {
      setShowConfirmDialog(true);
    } else {
      setSelectedRec(null);
      setIsEditingCosts(false);
    }
  };

  const confirmCloseModal = () => {
    setSelectedRec(null);
    setIsEditingCosts(false);
    setShowConfirmDialog(false);
  };

  const observerTarget = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    buy: 0,
    caution: 0,
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
            const caution = data.filter((r) => r.recommendation === 'caution').length;
            const pass = data.filter((r) => r.recommendation === 'pass').length;
            const avgConfidence =
              data.reduce((sum, r) => sum + r.confidence_score, 0) / (data.length || 1);
            const potentialProfit = data
              .filter((r) => r.recommendation === 'buy' && r.confidence_score >= 70)
              .reduce((sum, r) => sum + (r.estimated_profit || 0), 0);

            setStats({
              buy,
              caution,
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
    if (!searchQuery.trim()) {
      setFilteredRecommendations(recommendations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = recommendations.filter(
      (r) =>
        r.vin.toLowerCase().includes(query) ||
        r.decoded_data.make.toLowerCase().includes(query) ||
        r.decoded_data.model.toLowerCase().includes(query) ||
        `${r.decoded_data.year}`.includes(query) ||
        (r.decoded_data.trim && r.decoded_data.trim.toLowerCase().includes(query))
    );
    setFilteredRecommendations(filtered);
  }, [searchQuery, recommendations]);

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
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                Delete Scan?
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Are you sure you want to delete this scan? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
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
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
        <div className="flex border-l border-gray-200">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
    });
  };

  const getRecommendationBadge = (recommendation: string) => {
    const badges = {
      buy: 'bg-green-100 text-green-800',
      caution: 'bg-yellow-100 text-yellow-800',
      pass: 'bg-red-100 text-red-800',
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">VIN Scan Recommendations</h1>
          <p className="text-gray-600">
            View all your scanned VINs with AI-powered buying recommendations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <ThumbsUp className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Buy</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.buy}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-gray-600">Caution</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.caution}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-sm text-gray-600">Pass</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.pass}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Avg Confidence</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.avgConfidence.toFixed(0)}%
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Potential Profit</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.potentialProfit)}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by VIN, make, model, year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="mb-4 text-sm text-gray-600">
            Found {filteredRecommendations.length} result{filteredRecommendations.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Recommendations List */}
        {loading && recommendations.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No results found' : 'No VIN scans yet'}
            </h3>
            <p className="text-gray-600">
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
                onClick={() => setSelectedRec(rec)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Vehicle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {rec.decoded_data.year} {formatVehicleName(rec.decoded_data.make)} {formatVehicleName(rec.decoded_data.model)}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRecommendationBadge(rec.recommendation)} flex-shrink-0`}>
                        {rec.recommendation.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="hidden sm:inline">Max Bid: {rec.max_bid_suggestion ? formatCurrency(rec.max_bid_suggestion) : 'N/A'}</span>
                      <span className={`hidden sm:inline font-medium ${rec.estimated_profit && rec.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        Profit: {rec.estimated_profit ? formatCurrency(rec.estimated_profit) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRec(rec);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                      title="View Details"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteScan(e, rec.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                      title="Delete Scan"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mobile: Show financial info */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-sm sm:hidden">
                  <div>
                    <span className="text-gray-500">Max Bid:</span>
                    <span className="ml-1 font-semibold text-blue-600">
                      {rec.max_bid_suggestion ? formatCurrency(rec.max_bid_suggestion) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Profit:</span>
                    <span className={`ml-1 font-semibold ${rec.estimated_profit && rec.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600'}`}>
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
                <p className="text-sm text-gray-500 mt-2">Loading more...</p>
              </div>
            )}

            {/* End of Results */}
            {!hasMore && recommendations.length > 0 && !searchQuery && (
              <div className="py-8 text-center text-sm text-gray-500">
                You've reached the end of your scan history
              </div>
            )}
          </div>
        )}

        {/* Details Modal */}
        {selectedRec && (
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
                  id: selectedRec.id,
                  decoded_data: selectedRec.decoded_data,
                  market_data: selectedRec.market_data,
                  recommendation: selectedRec.recommendation,
                  confidence_score: selectedRec.confidence_score,
                  match_reasoning: selectedRec.match_reasoning,
                  estimated_profit: selectedRec.estimated_profit,
                  max_bid_suggestion: selectedRec.max_bid_suggestion,
                  custom_recon_cost: selectedRec.custom_recon_cost,
                  custom_transport_cost: selectedRec.custom_transport_cost,
                  custom_max_bid: selectedRec.custom_max_bid,
                  custom_market_price: selectedRec.custom_market_price,
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
