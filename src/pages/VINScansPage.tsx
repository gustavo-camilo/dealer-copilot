import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Target, Menu, X, Trash2, AlertCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationMenu from '../components/NavigationMenu';
import VINScanResult from '../components/VINScanResult';

interface VINScan {
  id: string;
  vin: string;
  decoded_data: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  recommendation: 'buy' | 'caution' | 'pass';
  confidence_score: number;
  market_data: any;
  match_reasoning: any[];
  estimated_profit: number | null;
  max_bid_suggestion: number | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export default function VINScansPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scans, setScans] = useState<VINScan[]>([]);
  const [filteredScans, setFilteredScans] = useState<VINScan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedScan, setSelectedScan] = useState<VINScan | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Load initial scans
  const loadScans = useCallback(
    async (pageNum: number, append = false) => {
      if (!user?.tenant_id) return;

      try {
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('vin_scans')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (data) {
          if (append) {
            setScans((prev) => [...prev, ...data]);
          } else {
            setScans(data);
          }
          setHasMore(data.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error('Error loading VIN scans:', error);
      } finally {
        setLoading(false);
      }
    },
    [user?.tenant_id]
  );

  // Initial load
  useEffect(() => {
    loadScans(0);
  }, [loadScans]);

  // Filter scans based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredScans(scans);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = scans.filter(
      (scan) =>
        scan.vin.toLowerCase().includes(query) ||
        scan.decoded_data.make.toLowerCase().includes(query) ||
        scan.decoded_data.model.toLowerCase().includes(query) ||
        `${scan.decoded_data.year}`.includes(query) ||
        (scan.decoded_data.trim && scan.decoded_data.trim.toLowerCase().includes(query))
    );
    setFilteredScans(filtered);
  }, [searchQuery, scans]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadScans(nextPage, true);
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
  }, [hasMore, loading, page, loadScans]);

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
                setScans(scans.filter(s => s.id !== scanId));
                setFilteredScans(filteredScans.filter(s => s.id !== scanId));
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">VIN Scan History</h1>
          <p className="text-gray-600">
            View all your VIN scans with AI-powered recommendations
          </p>
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
            Found {filteredScans.length} result{filteredScans.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Scans List */}
        {loading && scans.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredScans.length === 0 ? (
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
            {filteredScans.map((scan) => (
              <div
                key={scan.id}
                onClick={() => setSelectedScan(scan)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Vehicle Info */}
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
                      <span className="hidden sm:inline">Max Bid: {scan.max_bid_suggestion ? formatCurrency(scan.max_bid_suggestion) : 'N/A'}</span>
                      <span className={`hidden sm:inline font-medium ${scan.estimated_profit && scan.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        Profit: {scan.estimated_profit ? formatCurrency(scan.estimated_profit) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={(e) => handleDeleteScan(e, scan.id)}
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
                      {scan.max_bid_suggestion ? formatCurrency(scan.max_bid_suggestion) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Profit:</span>
                    <span className={`ml-1 font-semibold ${scan.estimated_profit && scan.estimated_profit > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {scan.estimated_profit ? formatCurrency(scan.estimated_profit) : 'N/A'}
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
            {!hasMore && scans.length > 0 && !searchQuery && (
              <div className="py-8 text-center text-sm text-gray-500">
                You've reached the end of your scan history
              </div>
            )}
          </div>
        )}

        {/* Details Modal */}
        {selectedScan && (
          <div
            className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
            onClick={() => setSelectedScan(null)}
          >
            <div
              className="bg-white w-full md:max-w-4xl md:rounded-lg shadow-xl max-h-screen overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex items-center justify-between z-10">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Scan Details</h2>
                <button
                  onClick={() => setSelectedScan(null)}
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
                  // estimated_days_to_sale is not currently in VINScan interface, might need to add it or it will be undefined
                }}
                isModal={true}
                tenantZipCode={tenant?.zip_code}
                onClose={() => setSelectedScan(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
