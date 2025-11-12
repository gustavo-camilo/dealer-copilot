import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Target, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { decodeVIN, enrichDecodedData } from '../services/vinDecoder';
import { getMarketPricing, calculateMaxBid } from '../services/marketPricing';
import { generateRecommendation } from '../services/recommendationEngine';
import ProfitCalculator from '../components/ProfitCalculator';
import { DecodedVehicleData, SalesRecord, TenantCostSettings } from '../types/database';

// Default cost settings if tenant hasn't configured them
const DEFAULT_COST_SETTINGS: TenantCostSettings = {
  auction_fee_percent: 2,
  reconditioning_cost: 800,
  transport_cost: 150,
  floor_plan_rate: 0.08,
  target_margin_percent: 15,
  target_days_to_sale: 30,
};

export default function VINScanPage() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const costSettings = tenant?.cost_settings || DEFAULT_COST_SETTINGS;

  const handleScan = async () => {
    if (!vin || !user?.tenant_id) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Decode VIN
      const decodedResult = await decodeVIN(vin);

      if (!decodedResult.success || !decodedResult.data) {
        setError(decodedResult.error || 'Failed to decode VIN');
        setLoading(false);
        return;
      }

      // Enrich with user-provided mileage
      const enrichedData = enrichDecodedData(decodedResult.data, {
        mileage: mileage ? parseInt(mileage) : undefined,
      });

      // Step 2: Get market pricing
      const marketData = await getMarketPricing(enrichedData);

      // Step 3: Get dealer's sales history for this vehicle type
      const { data: salesHistory, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('sale_date', { ascending: false })
        .limit(100);

      if (salesError) {
        console.error('Error fetching sales history:', salesError);
      }

      const salesRecords: SalesRecord[] = salesHistory || [];

      // Step 4: Calculate max bid
      const maxBid = calculateMaxBid(
        marketData.averagePrice,
        costSettings.target_margin_percent,
        costSettings.auction_fee_percent,
        costSettings.reconditioning_cost,
        costSettings.transport_cost
      );

      // Step 5: Generate recommendation
      const recommendation = await generateRecommendation(
        enrichedData,
        marketData,
        salesRecords,
        maxBid,
        costSettings.target_margin_percent
      );

      // Step 6: Save scan to database
      const { data: scanData, error: scanError } = await supabase
        .from('vin_scans')
        .insert({
          tenant_id: user.tenant_id,
          user_id: user.id,
          vin: vin,
          decoded_data: enrichedData,
          recommendation: recommendation.recommendation,
          confidence_score: recommendation.confidenceScore,
          match_reasoning: recommendation.matchReasons,
          estimated_profit: recommendation.estimatedProfit,
          max_bid_suggestion: recommendation.maxBidSuggestion,
          saved_to_bid_list: false,
        })
        .select()
        .single();

      if (scanError) {
        console.error('Error saving scan:', scanError);
        // Don't fail the whole process if save fails
      }

      // Display results
      setResult({
        decoded_data: enrichedData,
        recommendation: recommendation.recommendation,
        confidence_score: recommendation.confidenceScore,
        match_reasoning: recommendation.matchReasons,
        estimated_profit: recommendation.estimatedProfit,
        max_bid_suggestion: recommendation.maxBidSuggestion,
        estimated_days_to_sale: recommendation.estimatedDaysToSale,
        market_data: marketData,
        scan_id: scanData?.id,
      });
    } catch (error) {
      console.error('Error scanning VIN:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Dashboard
              </Link>
              <div className="flex items-center">
                <Target className="h-6 w-6 text-blue-900" />
                <span className="ml-2 font-bold text-gray-900">{tenant?.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Vehicle Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {result.decoded_data.year} {result.decoded_data.make} {result.decoded_data.model}
                </h2>
                <p className="text-gray-600">
                  {result.decoded_data.trim && `${result.decoded_data.trim} • `}
                  {result.decoded_data.body_type}
                </p>
                <p className="text-sm text-gray-500 mt-1">VIN: {vin}</p>
              </div>
              <div
                className={`px-4 py-2 rounded-lg font-semibold ${
                  result.recommendation === 'buy'
                    ? 'bg-green-100 text-green-800'
                    : result.recommendation === 'caution'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {result.recommendation === 'buy' && '🟢 STRONG BUY'}
                {result.recommendation === 'caution' && '🟡 PROCEED WITH CAUTION'}
                {result.recommendation === 'pass' && '🔴 PASS'}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {result.decoded_data.mileage && (
                <div>
                  <p className="text-gray-600">Mileage</p>
                  <p className="font-semibold">{result.decoded_data.mileage.toLocaleString()} mi</p>
                </div>
              )}
              <div>
                <p className="text-gray-600">Title Status</p>
                <p className="font-semibold capitalize">{result.decoded_data.title_status}</p>
              </div>
              {result.decoded_data.owner_count !== undefined && (
                <div>
                  <p className="text-gray-600">Owners</p>
                  <p className="font-semibold">{result.decoded_data.owner_count}</p>
                </div>
              )}
              {result.decoded_data.accident_count !== undefined && (
                <div>
                  <p className="text-gray-600">Accidents</p>
                  <p className="font-semibold">{result.decoded_data.accident_count}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600">Confidence Score</p>
                <p className="font-semibold">{result.confidence_score}%</p>
              </div>
              <div>
                <p className="text-gray-600">Est. Days to Sale</p>
                <p className="font-semibold">{result.estimated_days_to_sale} days</p>
              </div>
            </div>
          </div>

          {/* Match Reasoning */}
          <div
            className={`rounded-lg p-6 mb-6 ${
              result.recommendation === 'buy'
                ? 'bg-green-50 border border-green-200'
                : result.recommendation === 'caution'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <h3 className="font-bold text-gray-900 mb-3">
              {result.recommendation === 'buy' && '✅ Why This is a Strong Match'}
              {result.recommendation === 'caution' && '⚠️ Proceed Carefully - Here\'s Why'}
              {result.recommendation === 'pass' && '❌ Why You Should Pass'}
            </h3>
            <div className="space-y-2">
              {result.match_reasoning.map((reason: any, index: number) => (
                <div key={index} className="flex items-start">
                  {reason.type === 'positive' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  ) : reason.type === 'negative' ? (
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-gray-700">{reason.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profit Calculator */}
          <ProfitCalculator
            maxBidSuggestion={result.max_bid_suggestion}
            marketPrice={result.market_data.averagePrice}
            defaultAuctionFee={costSettings.auction_fee_percent}
            defaultRecon={costSettings.reconditioning_cost}
            defaultTransport={costSettings.transport_cost}
          />

          {/* Market Context */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h4 className="font-semibold text-blue-900 mb-2">📊 Market Context</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                • Average Market Price: ${result.market_data.averagePrice.toLocaleString()} (
                {result.market_data.dataSource === 'estimated' ? 'estimated' : 'from real listings'})
              </p>
              <p>
                • Price Range: ${result.market_data.minPrice.toLocaleString()} - $
                {result.market_data.maxPrice.toLocaleString()}
              </p>
              <p>• Data Confidence: {result.market_data.confidence}%</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => {
                setResult(null);
                setVin('');
                setMileage('');
                setError(null);
              }}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Scan Another VIN
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Dashboard
            </Link>
            <div className="flex items-center">
              <Target className="h-6 w-6 text-blue-900" />
              <span className="ml-2 font-bold text-gray-900">{tenant?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-blue-900" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Scan VIN</h2>
            <p className="text-gray-600 mt-2">
              Enter a VIN to get instant AI-powered buy/no-buy guidance
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Identification Number (VIN)
            </label>
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="1HGCV1F30LA012345"
              maxLength={17}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 mb-4 font-mono"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mb-4">Enter 17-character VIN number</p>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mileage (optional)
            </label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g., 45000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 mb-4"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mb-6">
              Providing mileage improves accuracy of recommendations
            </p>

            <button
              onClick={handleScan}
              disabled={vin.length !== 17 || loading}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Analyzing Vehicle...' : 'Analyze Vehicle'}
            </button>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="font-semibold mb-2">What you'll get:</p>
              <ul className="space-y-1">
                <li>✓ Complete vehicle decode and specifications</li>
                <li>✓ Market pricing analysis</li>
                <li>✓ Buy/Caution/Pass recommendation</li>
                <li>✓ Profit calculator with your costs</li>
                <li>✓ AI-powered confidence score</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
