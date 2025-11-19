import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, Target, Clock, RefreshCw, AlertCircle, ExternalLink, Menu, X } from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';

interface ScrapingResult {
  tenant_id: string;
  tenant_name: string;
  website_url: string;
  vehicles_found: number;
  new_vehicles: number;
  updated_vehicles: number;
  sold_vehicles: number;
  status: 'success' | 'partial' | 'failed';
  error?: string;
  duration_ms: number;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant, user, signOut } = useAuth();
  const [step, setStep] = useState<'input' | 'analyzing' | 'complete' | 'error'>('input');
  const [websiteUrl, setWebsiteUrl] = useState(tenant?.website_url || '');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [lastScanDate, setLastScanDate] = useState<Date | null>(null);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [scrapingResult, setScrapingResult] = useState<ScrapingResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    loadScanInfo();
  }, [user]);

  const loadScanInfo = async () => {
    if (!user?.tenant_id) return;

    // Check if tenant has been scanned before (check inventory_snapshots)
    const { data: snapshots } = await supabase
      .from('inventory_snapshots')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1);

    if (snapshots && snapshots.length > 0) {
      setLastScanDate(new Date(snapshots[0].created_at));
      setVehicleCount(snapshots[0].vehicles_found || 0);
    }
  };

  const handleAnalyze = async () => {
    if (!websiteUrl || !user?.tenant_id) return;

    setStep('analyzing');
    setAnalysisProgress(0);
    setErrorMessage('');

    try {
      // Normalize URL: ensure it has https:// protocol
      let normalizedUrl = websiteUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Update tenant website URL and set inventory status to 'pending'
      await supabase
        .from('tenants')
        .update({
          website_url: normalizedUrl,
          inventory_status: 'pending'
        })
        .eq('id', user.tenant_id);

      setAnalysisProgress(50);

      // Add to waiting list (trigger will handle Slack notification)
      const { error: waitingListError } = await supabase
        .from('scraping_waiting_list')
        .insert({
          tenant_id: user.tenant_id,
          website_url: normalizedUrl,
          status: 'pending',
          priority: 1,
        });

      if (waitingListError && !waitingListError.message.includes('duplicate')) {
        throw waitingListError;
      }

      setAnalysisProgress(100);

      // Set to complete with waiting message
      setStep('complete');
      setScrapingResult({
        tenant_id: user.tenant_id,
        tenant_name: tenant?.name || '',
        website_url: normalizedUrl,
        vehicles_found: 0,
        new_vehicles: 0,
        updated_vehicles: 0,
        sold_vehicles: 0,
        status: 'success',
        duration_ms: 0,
      });

    } catch (error: any) {
      console.error('Error adding to waiting list:', error);
      setStep('error');
      setErrorMessage(error.message || 'An unexpected error occurred');
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    setStep('input');
    setErrorMessage('');
    setScrapingResult(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderHeader = () => (
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
  );

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeader()}
        <div className="flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-6">
            <Target className="h-12 w-12 text-blue-900 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-900">Scanning Your Website</h2>
            <p className="text-gray-600 mt-2">This may take up to 30 seconds...</p>
          </div>

          <div className="space-y-3 mb-6">
            {[
              { progress: 20, message: 'Connecting to your website' },
              { progress: 40, message: 'Fetching inventory pages' },
              { progress: 60, message: 'Extracting vehicle data' },
              { progress: 80, message: 'Processing vehicle information' },
              { progress: 100, message: 'Updating your inventory' },
            ].map((stepData, index) => (
              <div key={index} className="flex items-center text-sm">
                <CheckCircle
                  className={`h-5 w-5 mr-2 flex-shrink-0 ${
                    analysisProgress >= stepData.progress ? 'text-green-600' : 'text-gray-300'
                  }`}
                />
                <span
                  className={
                    analysisProgress >= stepData.progress ? 'text-gray-900' : 'text-gray-400'
                  }
                >
                  {stepData.message}
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
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeader()}
        <div className="flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Scraping Failed</h2>
            <p className="text-gray-600 mt-2">We couldn't scan your website</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition"
            >
              Try Again
            </button>
            <button
              onClick={handleSkip}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Common Issues:
            </h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Website URL is incorrect or inaccessible</li>
              <li>Website requires authentication</li>
              <li>Inventory page structure is not recognized</li>
              <li>Website is blocking automated requests</li>
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Contact support if you continue to experience issues.
            </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderHeader()}
        <div className="flex items-center justify-center px-4 py-8">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Your Inventory is Being Processed!</h2>
            <p className="text-gray-600 mt-2">We've added your dealership to our scraping queue</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-blue-900 mb-3">What happens next?</h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <p>Our team has been notified and will manually scrape your website within the next few hours</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <p>You'll receive an email notification when your inventory data is ready</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <p>This typically takes 2-4 hours during business hours</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3">While you wait, you can:</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Scan VINs to get instant purchase recommendations
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Set up your default cost settings in Settings
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Explore the dashboard and familiarize yourself with the features
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/inventory')}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Inventory
            </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      <div className="flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Target className="h-12 w-12 text-blue-900 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900">
            {lastScanDate ? 'Scan Website Again' : 'Welcome to Dealer Co-Pilot'}
          </h2>
          <p className="text-gray-600 mt-2">
            {lastScanDate
              ? 'Re-scan your inventory to get the latest data'
              : "Let's scan your inventory in real-time"}
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
            className="w-full bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed mb-3 flex items-center justify-center"
          >
            {lastScanDate && <RefreshCw className="h-5 w-5 mr-2" />}
            {lastScanDate ? 'Re-Scan My Website' : 'Scan My Inventory'} →
          </button>

          <button
            onClick={handleSkip}
            className="w-full text-gray-600 hover:text-gray-900 text-sm"
          >
            {lastScanDate ? 'Back to Dashboard' : 'Skip for now'}
          </button>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">How it works:</h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>We scan your dealership website for vehicle listings</li>
              <li>Extract detailed information about each vehicle</li>
              <li>Track inventory changes and identify sold vehicles</li>
              <li>Build historical data for AI-powered recommendations</li>
            </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
