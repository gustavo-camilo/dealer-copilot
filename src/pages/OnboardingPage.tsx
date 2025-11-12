import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, Target, Clock, RefreshCw } from 'lucide-react';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { tenant, user } = useAuth();
  const [step, setStep] = useState<'input' | 'analyzing' | 'complete'>('input');
  const [websiteUrl, setWebsiteUrl] = useState(tenant?.website_url || '');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [lastScanDate, setLastScanDate] = useState<Date | null>(null);
  const [vehicleCount, setVehicleCount] = useState(0);

  useEffect(() => {
    loadScanInfo();
  }, [user]);

  const loadScanInfo = async () => {
    if (!user?.tenant_id) return;

    // Check if tenant has been scanned before
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('created_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (vehicles && vehicles.length > 0) {
      setLastScanDate(new Date(vehicles[0].created_at));

      // Get total vehicle count
      const { count } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id);

      setVehicleCount(count || 0);
    }
  };

  const handleAnalyze = async () => {
    if (!websiteUrl || !user?.tenant_id) return;

    setStep('analyzing');

    const progressSteps = [
      { progress: 20, message: 'Found dealership information' },
      { progress: 40, message: 'Scanning inventory pages...' },
      { progress: 60, message: 'Extracting vehicle data...' },
      { progress: 80, message: 'Analyzing pricing patterns...' },
      { progress: 100, message: 'Calculating portfolio metrics...' },
    ];

    for (const stepData of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setAnalysisProgress(stepData.progress);
    }

    await supabase
      .from('tenants')
      .update({ website_url: websiteUrl })
      .eq('id', user.tenant_id);

    const sampleVehicles = [
      { vin: '1HGCV1F30LA012345', year: 2020, make: 'Honda', model: 'Accord', trim: 'EX', mileage: 45280, price: 25995 },
      { vin: '4T1BF1FK5HU123456', year: 2019, make: 'Toyota', model: 'Camry', trim: 'SE', mileage: 38500, price: 24495 },
      { vin: '2HKRM4H75GH123456', year: 2020, make: 'Honda', model: 'CR-V', trim: 'LX', mileage: 32100, price: 27995 },
    ];

    for (const vehicle of sampleVehicles) {
      await supabase.from('vehicles').insert({
        tenant_id: user.tenant_id,
        ...vehicle,
        body_type: 'Sedan',
        status: 'available',
        title_status: 'clean',
      });
    }

    setStep('complete');
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-6">
            <Target className="h-12 w-12 text-blue-900 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">Analyzing Your Website</h2>
          </div>

          <div className="space-y-3 mb-6">
            {[
              'Found dealership information',
              'Scanning inventory pages...',
              'Extracting vehicle data...',
              'Analyzing pricing patterns...',
              'Calculating portfolio metrics...'
            ].map((message, index) => (
              <div key={index} className="flex items-center text-sm">
                <CheckCircle
                  className={`h-5 w-5 mr-2 ${
                    analysisProgress >= (index + 1) * 20 ? 'text-green-600' : 'text-gray-300'
                  }`}
                />
                <span className={analysisProgress >= (index + 1) * 20 ? 'text-gray-900' : 'text-gray-400'}>
                  {message}
                </span>
              </div>
            ))}
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-900 h-3 rounded-full transition-all duration-500"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-600 mt-2">{analysisProgress}%</p>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Analysis Complete!</h2>
            <p className="text-gray-600 mt-2">We've analyzed your inventory</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Your Inventory Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Vehicles</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Portfolio Value</p>
                <p className="text-2xl font-bold text-gray-900">$78,485</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Price</p>
                <p className="text-2xl font-bold text-gray-900">$26,162</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Top Make</p>
                <p className="text-2xl font-bold text-gray-900">Honda</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Target className="h-12 w-12 text-blue-900 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900">
            {lastScanDate ? 'Scan Website Again' : 'Welcome to Dealer Co-Pilot'}
          </h2>
          <p className="text-gray-600 mt-2">
            {lastScanDate
              ? 'Re-analyze your inventory to get the latest data'
              : "Let's analyze your inventory in real-time"}
          </p>
        </div>

        {lastScanDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center text-blue-900 mb-2">
              <Clock className="h-5 w-5 mr-2" />
              <span className="font-semibold">Last Scan</span>
            </div>
            <p className="text-sm text-blue-800">
              {lastScanDate.toLocaleDateString()} at {lastScanDate.toLocaleTimeString()}
            </p>
            <p className="text-sm text-blue-800 mt-1">
              Found {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''} in inventory
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {lastScanDate ? 'Dealership Website' : "What's your dealership website?"}
          </label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://www.yourdealership.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 mb-4"
          />

          <button
            onClick={handleAnalyze}
            disabled={!websiteUrl}
            className="w-full bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition disabled:opacity-50 mb-3 flex items-center justify-center"
          >
            {lastScanDate && <RefreshCw className="h-5 w-5 mr-2" />}
            {lastScanDate ? 'Re-Scan My Website' : 'Analyze My Inventory'} →
          </button>

          <button
            onClick={handleSkip}
            className="w-full text-gray-600 hover:text-gray-900 text-sm"
          >
            {lastScanDate ? 'Back to Dashboard' : 'Skip for now'}
          </button>

          {lastScanDate && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                <strong>Note:</strong> This is a simulated scan. In production, this would connect to your website's inventory feed or API to import real vehicle data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
