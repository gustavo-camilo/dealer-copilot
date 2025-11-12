import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Search, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface VINScan {
  id: string;
  vin: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_trim: string | null;
  scanned_at: string;
  recommendation: 'buy' | 'caution' | 'pass';
  confidence_score: number;
  estimated_market_value: number;
  max_bid: number;
  estimated_profit: number;
}

const PAGE_SIZE = 25;

export default function VINScansPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<VINScan[]>([]);
  const [filteredScans, setFilteredScans] = useState<VINScan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
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
          .order('scanned_at', { ascending: false })
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
        scan.vehicle_make.toLowerCase().includes(query) ||
        scan.vehicle_model.toLowerCase().includes(query) ||
        `${scan.vehicle_year}`.includes(query) ||
        (scan.vehicle_trim && scan.vehicle_trim.toLowerCase().includes(query))
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

  const getRecommendationBadge = (recommendation: string, confidence: number) => {
    const badges = {
      buy: 'bg-green-100 text-green-800',
      caution: 'bg-yellow-100 text-yellow-800',
      pass: 'bg-red-100 text-red-800',
    };

    const icons = {
      buy: <TrendingUp className="w-4 h-4" />,
      caution: <Minus className="w-4 h-4" />,
      pass: <TrendingDown className="w-4 h-4" />,
    };

    return (
      <div className="flex items-center gap-2">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
            badges[recommendation as keyof typeof badges]
          }`}
        >
          {icons[recommendation as keyof typeof icons]}
          {recommendation.charAt(0).toUpperCase() + recommendation.slice(1)}
        </span>
        <span className="text-sm text-gray-600">{confidence}% confidence</span>
      </div>
    );
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
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">VIN Scan History</h1>
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
          <div className="space-y-4">
            {filteredScans.map((scan) => (
              <div
                key={scan.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Vehicle Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          {scan.vehicle_year} {scan.vehicle_make} {scan.vehicle_model}
                          {scan.vehicle_trim && (
                            <span className="text-gray-600 font-normal"> {scan.vehicle_trim}</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 font-mono">{scan.vin}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Scanned {formatDate(scan.scanned_at)}
                    </div>
                  </div>

                  {/* Recommendation Badge */}
                  <div className="lg:mx-6">
                    {getRecommendationBadge(scan.recommendation, scan.confidence_score)}
                  </div>

                  {/* Financial Info */}
                  <div className="grid grid-cols-3 gap-4 lg:min-w-[400px]">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Market Value</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(scan.estimated_market_value)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Max Bid</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatCurrency(scan.max_bid)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Est. Profit</div>
                      <div
                        className={`text-lg font-semibold ${
                          scan.estimated_profit > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(scan.estimated_profit)}
                      </div>
                    </div>
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
      </div>
    </div>
  );
}
