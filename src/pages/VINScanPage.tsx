import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Target, Menu, X, Loader2 } from 'lucide-react';
import { decodeVIN, enrichDecodedData } from '../services/vinDecoder';
import { getMarketPricing, calculateMaxBid } from '../services/marketPricing';
import { generateRecommendation } from '../services/recommendationEngine';
import VINScanResult from '../components/VINScanResult';
import NavigationMenu from '../components/NavigationMenu';
import { SalesRecord, TenantCostSettings } from '../types/database';

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
  const location = useLocation();
  const { user, tenant, signOut } = useAuth();
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const costSettings = tenant?.cost_settings || DEFAULT_COST_SETTINGS;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };



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
      // Enforce tenant zip code
      if (!tenant?.zip_code) {
        setError(
          <span>
            Missing ZIP Code. Please configure your location in{' '}
            <Link to="/settings" className="underline font-bold hover:text-red-900">
              Settings
            </Link>{' '}
            to get accurate market data.
          </span> as any
        );
        setLoading(false);
        return;
      }

      const marketData = await getMarketPricing(enrichedData, tenant.zip_code);

      // If no market data, stop here and show report UI
      if (!marketData) {
        setResult({
          decoded_data: enrichedData,
          market_data: null,
          recommendation: 'caution', // Default to caution if no data
          confidence_score: 0,
          match_reasoning: [],
          estimated_profit: 0,
          max_bid_suggestion: 0,
          estimated_days_to_sale: 0,
        });
        setLoading(false);
        return;
      }

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
          market_data: marketData, // Save market data for history
          saved_to_bid_list: false,
          // Initialize custom costs as null - will be set if user edits
          custom_auction_fee_percent: null,
          custom_recon_cost: null,
          custom_transport_cost: null,
          custom_max_bid: null,
          custom_market_price: null,
          costs_edited: false,
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
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-blue-900" />
                <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
              </div>
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

        <VINScanResult
          scanData={{
            id: result.scan_id,
            decoded_data: result.decoded_data,
            market_data: result.market_data,
            recommendation: result.recommendation,
            confidence_score: result.confidence_score,
            match_reasoning: result.match_reasoning,
            estimated_profit: result.estimated_profit,
            max_bid_suggestion: result.max_bid_suggestion,
            estimated_days_to_sale: result.estimated_days_to_sale,
          }}
          costSettings={costSettings}
          onScanAnother={() => {
            setResult(null);
            setVin('');
            setMileage('');
            setError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
            </div>
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
