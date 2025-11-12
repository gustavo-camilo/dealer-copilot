import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ThumbsUp,
  Search,
  Filter,
  DollarSign,
  Target,
  Clock,
} from 'lucide-react';

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
  match_reasoning: Array<{
    type: 'positive' | 'negative' | 'neutral';
    message: string;
  }>;
}

type RecommendationFilter = 'all' | 'buy' | 'caution' | 'pass';
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

export default function RecommendationsPage() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendationFilter, setRecommendationFilter] =
    useState<RecommendationFilter>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [stats, setStats] = useState({
    buy: 0,
    caution: 0,
    pass: 0,
    avgConfidence: 0,
    potentialProfit: 0,
  });

  // Load recommendations
  useEffect(() => {
    loadRecommendations();
  }, [user?.tenant_id]);

  // Filter recommendations
  useEffect(() => {
    let filtered = [...recommendations];

    // Apply recommendation filter
    if (recommendationFilter !== 'all') {
      filtered = filtered.filter((r) => r.recommendation === recommendationFilter);
    }

    // Apply confidence filter
    if (confidenceFilter !== 'all') {
      filtered = filtered.filter((r) => {
        if (confidenceFilter === 'high') return r.confidence_score >= 70;
        if (confidenceFilter === 'medium')
          return r.confidence_score >= 50 && r.confidence_score < 70;
        if (confidenceFilter === 'low') return r.confidence_score < 50;
        return true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.vin.toLowerCase().includes(query) ||
          r.decoded_data.make.toLowerCase().includes(query) ||
          r.decoded_data.model.toLowerCase().includes(query) ||
          `${r.decoded_data.year}`.includes(query)
      );
    }

    // Sort by confidence score (highest first)
    filtered.sort((a, b) => b.confidence_score - a.confidence_score);

    setFilteredRecommendations(filtered);
  }, [recommendations, recommendationFilter, confidenceFilter, searchQuery]);

  const loadRecommendations = async () => {
    if (!user?.tenant_id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .not('recommendation', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setRecommendations(data);

        // Calculate stats
        const buy = data.filter((r) => r.recommendation === 'buy').length;
        const caution = data.filter((r) => r.recommendation === 'caution').length;
        const pass = data.filter((r) => r.recommendation === 'pass').length;
        const avgConfidence =
          data.reduce((sum, r) => sum + r.confidence_score, 0) / (data.length || 1);
        const potentialProfit = data
          .filter((r) => r.recommendation === 'buy' && r.confidence_score >= 70)
          .reduce((sum, r) => sum + r.estimated_profit, 0);

        setStats({
          buy,
          caution,
          pass,
          avgConfidence,
          potentialProfit,
        });
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationConfig = (recommendation: string) => {
    const configs = {
      buy: {
        icon: <TrendingUp className="w-6 h-6" />,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800',
        label: 'Recommended to Buy',
      },
      caution: {
        icon: <Minus className="w-6 h-6" />,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800',
        label: 'Proceed with Caution',
      },
      pass: {
        icon: <TrendingDown className="w-6 h-6" />,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        badgeColor: 'bg-red-100 text-red-800',
        label: 'Not Recommended',
      },
    };

    return configs[recommendation as keyof typeof configs];
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 70) {
      return <span className="text-green-600 font-medium">High Confidence</span>;
    } else if (score >= 50) {
      return <span className="text-yellow-600 font-medium">Medium Confidence</span>;
    } else {
      return <span className="text-red-600 font-medium">Low Confidence</span>;
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
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Recommendations</h1>
          <p className="text-gray-600">
            Smart buying recommendations powered by your sales history and market data
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

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by VIN, make, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Recommendation Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={recommendationFilter}
                onChange={(e) => setRecommendationFilter(e.target.value as RecommendationFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Recommendations</option>
                <option value="buy">Buy</option>
                <option value="caution">Caution</option>
                <option value="pass">Pass</option>
              </select>
            </div>

            {/* Confidence Filter */}
            <div>
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Confidence</option>
                <option value="high">High (70%+)</option>
                <option value="medium">Medium (50-69%)</option>
                <option value="low">Low (&lt;50%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredRecommendations.length} of {recommendations.length} recommendations
        </div>

        {/* Recommendations List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No recommendations found
            </h3>
            <p className="text-gray-600">
              {searchQuery || recommendationFilter !== 'all' || confidenceFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start scanning VINs to get AI-powered recommendations'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecommendations.map((rec) => {
              const config = getRecommendationConfig(rec.recommendation);
              return (
                <div
                  key={rec.id}
                  className={`rounded-lg shadow-sm border ${config.borderColor} ${config.bgColor} p-6`}
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Recommendation Badge */}
                    <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:min-w-[180px]">
                      <div className={`${config.textColor}`}>{config.icon}</div>
                      <div>
                        <div className={`font-bold text-lg ${config.textColor} mb-1`}>
                          {config.label}
                        </div>
                        <div className="text-sm">
                          {getConfidenceBadge(rec.confidence_score)}
                        </div>
                        <div className="text-2xl font-bold mt-2">{rec.confidence_score}%</div>
                      </div>
                    </div>

                    {/* Middle: Vehicle Info */}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {rec.decoded_data.year} {rec.decoded_data.make} {rec.decoded_data.model}
                        {rec.decoded_data.trim && (
                          <span className="text-gray-600 font-normal"> {rec.decoded_data.trim}</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 font-mono mb-4">{rec.vin}</p>

                      {/* Positive Reasons */}
                      {rec.match_reasoning && rec.match_reasoning.filter(r => r.type === 'positive').length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            Why this recommendation:
                          </div>
                          <ul className="space-y-1">
                            {rec.match_reasoning.filter(r => r.type === 'positive').map((reason, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-green-600 mt-0.5">✓</span>
                                <span>{reason.message}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risk Factors */}
                      {rec.match_reasoning && rec.match_reasoning.filter(r => r.type === 'negative').length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            Risk factors to consider:
                          </div>
                          <ul className="space-y-1">
                            {rec.match_reasoning.filter(r => r.type === 'negative').map((risk, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-red-600 mt-0.5">⚠</span>
                                <span>{risk.message}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>Scanned {formatDate(rec.created_at)}</span>
                      </div>
                    </div>

                    {/* Right: Financial Info */}
                    <div className="lg:min-w-[250px] lg:text-right">
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Max Bid</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {rec.max_bid_suggestion ? formatCurrency(rec.max_bid_suggestion) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Est. Profit</div>
                          <div
                            className={`text-lg font-semibold ${
                              rec.estimated_profit && rec.estimated_profit > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {rec.estimated_profit ? formatCurrency(rec.estimated_profit) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
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
