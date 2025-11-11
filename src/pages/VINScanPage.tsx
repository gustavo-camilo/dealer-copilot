import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Target, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function VINScanPage() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async () => {
    if (!vin || !user?.tenant_id) return;

    setLoading(true);

    try {
      const mockDecodedData = {
        year: 2020,
        make: 'Honda',
        model: 'Accord',
        trim: 'EX',
        body_type: 'Sedan',
        engine: '1.5L Turbo',
        transmission: 'CVT',
        mileage: 45280,
        title_status: 'clean' as const,
        owner_count: 1,
        accident_count: 0,
        service_records: 15,
      };

      const recommendation: 'buy' | 'caution' | 'pass' = 'buy';
      const confidenceScore = 92;
      const matchReasons = [
        { type: 'positive' as const, message: 'Matches your Honda Accord profile' },
        { type: 'positive' as const, message: 'Right year range (2019-2021 is your target)' },
        { type: 'positive' as const, message: 'Good mileage (45K fits your 30K-55K profile)' },
        { type: 'positive' as const, message: 'Clean history (1 owner, no accidents)' },
      ];

      const estimatedProfit = 3115;
      const maxBidSuggestion = 21500;

      const { data: scanData, error: scanError } = await supabase
        .from('vin_scans')
        .insert({
          tenant_id: user.tenant_id,
          user_id: user.id,
          vin: vin,
          decoded_data: mockDecodedData,
          recommendation,
          confidence_score: confidenceScore,
          match_reasoning: matchReasons,
          estimated_profit: estimatedProfit,
          max_bid_suggestion: maxBidSuggestion,
          saved_to_bid_list: false,
        })
        .select()
        .single();

      if (scanError) throw scanError;

      setResult({
        decoded_data: mockDecodedData,
        recommendation,
        confidence_score: confidenceScore,
        match_reasoning: matchReasons,
        estimated_profit: estimatedProfit,
        max_bid_suggestion: maxBidSuggestion,
      });
    } catch (error) {
      console.error('Error scanning VIN:', error);
      alert('Error scanning VIN. Please try again.');
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {result.decoded_data.year} {result.decoded_data.make} {result.decoded_data.model}
                </h2>
                <p className="text-gray-600">
                  {result.decoded_data.trim} • {result.decoded_data.body_type}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                result.recommendation === 'buy'
                  ? 'bg-green-100 text-green-800'
                  : result.recommendation === 'caution'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.recommendation.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Mileage</p>
                <p className="font-semibold">{result.decoded_data.mileage.toLocaleString()} mi</p>
              </div>
              <div>
                <p className="text-gray-600">Title Status</p>
                <p className="font-semibold capitalize">{result.decoded_data.title_status}</p>
              </div>
              <div>
                <p className="text-gray-600">Owners</p>
                <p className="font-semibold">{result.decoded_data.owner_count}</p>
              </div>
              <div>
                <p className="text-gray-600">Accidents</p>
                <p className="font-semibold">{result.decoded_data.accident_count}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg p-6 mb-6 ${
            result.recommendation === 'buy' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <h3 className="font-bold text-gray-900 mb-3">
              {result.recommendation === 'buy' ? 'STRONG MATCH FOR YOUR LOT' : 'OUTSIDE YOUR TYPICAL PROFILE'}
            </h3>
            <div className="space-y-2">
              {result.match_reasoning.map((reason: any, index: number) => (
                <div key={index} className="flex items-start">
                  {reason.type === 'positive' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-gray-700">{reason.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Profit Calculator</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Suggested Max Bid</span>
                <span className="font-semibold">${result.max_bid_suggestion.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">+ Auction Fees (2%)</span>
                <span>${(result.max_bid_suggestion * 0.02).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">+ Recon/Detail</span>
                <span>$800</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">+ Transport</span>
                <span>$150</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold">
                  <span>Total Investment</span>
                  <span>${(result.max_bid_suggestion + result.max_bid_suggestion * 0.02 + 800 + 150).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600 pt-2 border-t">
                <span>Expected Gross Profit</span>
                <span>${result.estimated_profit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setResult(null);
                setVin('');
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
              Enter a VIN to get instant buy/no-buy guidance
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-8">
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
            />
            <p className="text-xs text-gray-500 mb-4">
              Enter 17-character VIN number
            </p>

            <button
              onClick={handleScan}
              disabled={vin.length !== 17 || loading}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze Vehicle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
