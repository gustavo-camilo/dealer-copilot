import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  Trash2,
  RefreshCw,
  Target,
  Menu,
  X,
  DollarSign,
  Gauge,
  BarChart3,
  AlertCircle,
  Loader2,
  Car,
} from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';
import toast, { Toaster } from 'react-hot-toast';
import { normalizeDomain, ensureHttps } from '../utils/url';

interface CompetitorSnapshot {
  id: string;
  competitor_url: string;
  competitor_name: string | null;
  scanned_at: string;
  vehicle_count: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  avg_mileage: number | null;
  min_mileage: number | null;
  max_mileage: number | null;
  total_inventory_value: number | null;
  top_makes: Record<string, number>;
  scraping_duration_ms: number | null;
  status: 'success' | 'partial' | 'failed';
  error_message: string | null;
}

interface CompetitorHistory {
  id: string;
  scanned_at: string;
  vehicle_count: number;
  avg_price: number | null;
}

export default function CompetitorAnalysisPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [competitors, setCompetitors] = useState<CompetitorSnapshot[]>([]);
  const [historyData, setHistoryData] = useState<Record<string, CompetitorHistory[]>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('starter');
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [refreshPendingUrls, setRefreshPendingUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      await loadSubscriptionTier();
      await loadCompetitors();
      await loadPendingRequests();
    };
    loadData();
  }, []);

  const loadSubscriptionTier = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('subscription_tier')
        .eq('id', tenant?.id)
        .single();

      if (error) throw error;
      setSubscriptionTier(data?.subscription_tier || 'starter');
    } catch (error) {
      console.error('Error loading subscription tier:', error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      if (!tenant?.id) return;

      // Query source_registry for competitor sources that haven't been scraped yet
      // A source is pending if:
      // 1. It's a competitor source
      // 2. It hasn't been scraped yet (last_scraped_at is null)
      // 3. OR there's no snapshot for it yet in inventory_snapshots_unified

      const { data: allCompetitorSources, error: sourcesError } = await supabase
        .from('source_registry')
        .select('*')
        .eq('source_type', 'competitor')
        .eq('scraping_enabled', true)
        .order('created_at', { ascending: false });

      if (sourcesError) throw sourcesError;

      // Get all competitor snapshots to check which sources have data
      const { data: snapshots } = await supabase
        .from('inventory_snapshots_unified')
        .select('source_url')
        .eq('source_type', 'competitor');

      const scrapedUrls = new Set((snapshots || []).map(s => s.source_url));

      // Build refresh pending URLs set for UI state
      const refreshPendingSet = new Set<string>();

      // Track refresh pending URLs (for showing alert on existing cards)
      (allCompetitorSources || []).forEach(source => {
        if (source.is_refresh_pending === true) {
          refreshPendingSet.add(source.source_url);
        }
      });

      // Filter to show ONLY sources that have never been scraped yet (initial requests)
      // Do NOT show refresh requests as pending items (they appear as alerts on existing cards)
      const pending = (allCompetitorSources || [])
        .filter(source => {
          const hasSnapshot = scrapedUrls.has(source.source_url);
          const isPendingRefresh = source.is_refresh_pending === true;

          // Only show in pending list if: never scraped AND not a refresh request
          return !hasSnapshot && !isPendingRefresh;
        })
        .map(source => ({
          id: source.id,
          competitor_url: source.source_url,
          competitor_name: source.source_name,
          created_at: source.created_at,
          status: 'pending',
          refresh_requested_at: source.refresh_requested_at
        }));

      setPendingRequests(pending);
      setRefreshPendingUrls(refreshPendingSet);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const loadCompetitors = async () => {
    try {
      setLoading(true);

      if (!tenant?.id) {
        setCompetitors([]);
        return;
      }

      // Load snapshots from inventory_snapshots_unified for competitor sources
      // We need to find competitors that this tenant has requested
      // First, get the source_urls from source_registry that are competitors
      const { data: competitorSources, error: sourcesError } = await supabase
        .from('source_registry')
        .select('source_url, source_name')
        .eq('source_type', 'competitor');

      if (sourcesError) throw sourcesError;

      if (!competitorSources || competitorSources.length === 0) {
        setCompetitors([]);
        setLoading(false);
        return;
      }

      const competitorUrls = competitorSources.map(s => s.source_url);

      // Create a map of source_url to source_name for quick lookup
      const sourceNameMap = new Map<string, string>();
      competitorSources.forEach(source => {
        if (source.source_name) {
          sourceNameMap.set(source.source_url, source.source_name);
        }
      });

      // Now get the latest snapshots for these competitors
      const { data, error } = await supabase
        .from('inventory_snapshots_unified')
        .select('*')
        .eq('source_type', 'competitor')
        .in('source_url', competitorUrls)
        .order('scanned_at', { ascending: false });

      if (error) throw error;

      // Transform to match the expected CompetitorSnapshot interface
      // Use source_name from source_registry (freshly edited) instead of snapshot (old data)
      const transformed = (data || []).map(snapshot => ({
        id: snapshot.id,
        competitor_url: snapshot.source_url,
        competitor_name: sourceNameMap.get(snapshot.source_url) || snapshot.source_name,
        scanned_at: snapshot.scanned_at,
        vehicle_count: snapshot.vehicle_count,
        avg_price: snapshot.avg_price,
        min_price: snapshot.min_price,
        max_price: snapshot.max_price,
        avg_mileage: snapshot.avg_mileage,
        min_mileage: snapshot.min_mileage,
        max_mileage: snapshot.max_mileage,
        total_inventory_value: snapshot.total_inventory_value,
        top_makes: snapshot.make_distribution || {},
        scraping_duration_ms: null,
        status: snapshot.status as 'success' | 'partial' | 'failed',
        error_message: null
      }));

      // Group by source_url and keep only the latest snapshot for each
      // Since data is already sorted by scanned_at DESC, the first occurrence is the latest
      const latestSnapshots = new Map<string, any>();
      transformed.forEach(snapshot => {
        if (!latestSnapshots.has(snapshot.competitor_url)) {
          // Only set if we haven't seen this URL yet (first = latest due to DESC order)
          latestSnapshots.set(snapshot.competitor_url, snapshot);
        }
      });

      setCompetitors(Array.from(latestSnapshots.values()));
    } catch (error) {
      console.error('Error loading competitors:', error);
      setError('Failed to load competitors');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (competitorUrl: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory_snapshots_unified')
        .select('id, scanned_at, vehicle_count, avg_price')
        .eq('source_url', competitorUrl)
        .eq('source_type', 'competitor')
        .order('scanned_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setHistoryData((prev) => ({
        ...prev,
        [competitorUrl]: data || [],
      }));
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleAddToWaitingList = async () => {
    if (!newCompetitorUrl.trim()) {
      setError('Please enter a competitor URL');
      return;
    }

    if (!tenant?.id) {
      setError('No tenant ID found');
      return;
    }

    try {
      setAddingToQueue(true);
      setError(null);

      const cleanDomain = normalizeDomain(newCompetitorUrl);

      // Check if source already exists
      const { data: existingSource } = await supabase
        .from('source_registry')
        .select('*')
        .eq('source_url', cleanDomain)
        .maybeSingle();

      if (existingSource) {
        setError('This competitor is already in the system');
        toast.error('This competitor is already in the system');
        setAddingToQueue(false);
        return;
      }

      // Add to source_registry as a competitor
      const { error: insertError } = await supabase
        .from('source_registry')
        .insert({
          source_url: cleanDomain,
          source_type: 'competitor',
          tenant_id: null, // Competitors are global
          source_name: cleanDomain,
          scraping_enabled: true,
        });

      if (insertError) throw insertError;

      setSubmissionSuccess(true);
      loadPendingRequests(); // Reload pending requests

      // Clear form
      setNewCompetitorUrl('');
      toast.success('Competitor added to analysis queue');
    } catch (error) {
      console.error('Error adding to queue:', error);
      setError(error instanceof Error ? error.message : 'Failed to add competitor request');
      toast.error('Failed to add competitor request');
    } finally {
      setAddingToQueue(false);
    }
  };

  const handleScanCompetitor = async (url?: string, name?: string) => {
    const competitorUrl = url || newCompetitorUrl;
    const competitorName = name;

    if (!competitorUrl.trim()) {
      setError('Please enter a competitor URL');
      return;
    }

    try {
      setScanning(true);
      setError(null);

      const cleanDomain = normalizeDomain(competitorUrl);

      // Check if source exists in source_registry
      const { data: existingSource, error: checkError } = await supabase
        .from('source_registry')
        .select('*')
        .eq('source_url', cleanDomain)
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingSource) {
        // This shouldn't happen for refresh - user probably meant to add new competitor
        setError('Competitor not found. Please add it first using "Request Analysis".');
        return;
      }

      // Update existing source to mark refresh as pending
      const { error: updateError } = await supabase
        .from('source_registry')
        .update({
          is_refresh_pending: true,
          refresh_requested_at: new Date().toISOString(),
          refresh_requested_by: user?.id,
          status: 'pending', // Set as pending to show in admin queue
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSource.id);

      if (updateError) throw updateError;

      toast.success('Refresh requested! You\'ll be notified when the update is ready.');

      // Reload data to show pending state
      await loadCompetitors();
      await loadPendingRequests();
    } catch (error) {
      console.error('Error requesting refresh:', error);
      setError(error instanceof Error ? error.message : 'Failed to request refresh');
      toast.error('Failed to request refresh');
    } finally {
      setScanning(false);
    }
  };

  const handleDeleteCompetitor = async (id: string) => {
    const deletePromise = new Promise(async (resolve, reject) => {
      if (!tenant?.id) {
        reject(new Error('No tenant ID found'));
        return;
      }

      try {
        // Delete from inventory_snapshots_unified
        const { error } = await supabase
          .from('inventory_snapshots_unified')
          .delete()
          .eq('id', id);

        if (error) throw error;

        await loadCompetitors();
        resolve('Competitor snapshot');
      } catch (error) {
        console.error('Error deleting competitor:', error);
        reject(error);
      }
    });

    toast.promise(
      deletePromise,
      {
        loading: 'Deleting competitor snapshot...',
        success: 'Competitor snapshot deleted successfully',
        error: (err) => `Failed to delete: ${err.message || 'Unknown error'}`,
      }
    );
  };

  const toggleHistory = (competitorUrl: string) => {
    if (subscriptionTier !== 'enterprise') {
      // Redirect to upgrade page
      navigate('/upgrade');
      return;
    }

    if (expandedHistory === competitorUrl) {
      setExpandedHistory(null);
    } else {
      setExpandedHistory(competitorUrl);
      if (!historyData[competitorUrl]) {
        loadHistory(competitorUrl);
      }
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null) return 'N/A';
    return value.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Combine pending requests and completed snapshots
  const combinedList = [
    ...pendingRequests.map(req => ({
      type: 'pending' as const,
      id: req.id,
      url: req.competitor_url,
      name: req.competitor_name,
      date: req.created_at,
      status: req.status,
      data: null as CompetitorSnapshot | null
    })),
    ...competitors.map(comp => ({
      type: 'completed' as const,
      id: comp.id,
      url: comp.competitor_url,
      name: comp.competitor_name,
      date: comp.scanned_at,
      status: 'completed',
      data: comp
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center">
              <Target className="h-8 w-8 text-blue-900 dark:text-blue-400" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Dealer Co-Pilot</span>
            </Link>
            <div className="flex items-center space-x-4 relative">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline">{tenant?.name}</span>
              <Link
                to="/scan"
                className="bg-orange-600 dark:bg-orange-700 text-white px-4 py-2 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 transition hidden md:inline-block"
              >
                Scan VIN
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Competitor Intelligence</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze competitor inventory to stay competitive
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Processing State */}
        {submissionSuccess ? (
          <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200 mb-2">
                Competitor Analysis Requested
              </h2>
              <p className="text-blue-800 dark:text-blue-300 mb-4 max-w-lg mx-auto">
                Your request has been added to the queue. There are other dealerships in front.
                You will receive a notification as soon as the competitor has been analyzed and it's available for you to check.
              </p>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-left">While you wait, you can:</h3>
                <ul className="text-left space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-center">
                    <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                    <span><Link to="/scan" className="text-blue-600 dark:text-blue-400 hover:underline">Scan VINs</Link> for purchase recommendations</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                    <span>Check your <Link to="/inventory" className="text-blue-600 dark:text-blue-400 hover:underline">current inventory</Link> performance</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                    <span>Explore the <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">dashboard</Link></span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setSubmissionSuccess(false)}
                className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
              >
                Analyze Another Competitor
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Scan Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Competitor</h2>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="url"
                      placeholder="Competitor website URL (e.g., https://competitor.com)"
                      value={newCompetitorUrl}
                      onChange={(e) => setNewCompetitorUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={scanning || addingToQueue}
                    />
                  </div>
                  <button
                    onClick={handleAddToWaitingList}
                    disabled={addingToQueue || scanning || !newCompetitorUrl.trim()}
                    className="px-6 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {addingToQueue ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-5 h-5" />
                        Request Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Unified Competitors List */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
              </div>
            ) : combinedList.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No competitors scanned yet</h3>
                <p className="text-gray-600 dark:text-gray-400">Enter a competitor URL above to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {combinedList.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${item.type === 'pending' ? 'opacity-75' : ''
                      }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {item.name || (() => {
                            try {
                              return item.url ? new URL(item.url).hostname : 'Unknown Competitor';
                            } catch {
                              return item.url || 'Unknown Competitor';
                            }
                          })()}
                        </h3>
                        {item.url && (
                          <a
                            href={ensureHttps(item.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {item.url}
                          </a>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {item.type === 'pending' ? 'Requested' : 'Scanned'} {formatDate(item.date)}
                        </p>

                        {/* Show pending refresh alert if applicable */}
                        {item.type === 'completed' && refreshPendingUrls.has(item.url) && (
                          <div className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-800 dark:text-yellow-200">
                              Update requested. It'll be processed soon.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {item.type === 'pending' ? (
                          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded-full uppercase flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {item.status.replace('_', ' ')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleScanCompetitor(item.url, item.name || undefined)}
                            disabled={scanning || refreshPendingUrls.has(item.url)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title={refreshPendingUrls.has(item.url) ? "Update pending" : "Request update"}
                          >
                            <RefreshCw className={`w-5 h-5 ${refreshPendingUrls.has(item.url) ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    {item.type === 'pending' ? (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center border border-dashed border-gray-300 dark:border-gray-600">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          Analysis in progress...
                          <br />
                          We'll notify you when it's ready.
                        </p>
                      </div>
                    ) : item.data && (
                      <div className="space-y-3">
                        {/* Vehicle Count & Total Value */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Car className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs text-gray-600 dark:text-gray-300">Total Vehicles</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatNumber(item.data.vehicle_count)}
                            </div>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-xs text-gray-600 dark:text-gray-300">Total Value</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatCurrency(item.data.total_inventory_value)}
                            </div>
                          </div>
                        </div>

                        {/* Price Range */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Price Range</span>
                          </div>

                          {/* Average Price - Prominent */}
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Average</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatCurrency(item.data.avg_price)}
                            </div>
                          </div>

                          {/* Min/Max - Smaller Below */}
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Min: </span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {formatCurrency(item.data.min_price)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Max: </span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {formatCurrency(item.data.max_price)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mileage Range */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Gauge className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Mileage Range</span>
                          </div>

                          {/* Average Mileage - Prominent */}
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Average</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatNumber(item.data.avg_mileage)} mi
                            </div>
                          </div>

                          {/* Min/Max - Smaller Below */}
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Min: </span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {formatNumber(item.data.min_mileage)} mi
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Max: </span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {formatNumber(item.data.max_mileage)} mi
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Top Makes */}
                        {Object.keys(item.data.top_makes).length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Top Brands</div>
                            <div className="space-y-1">
                              {Object.entries(item.data.top_makes)
                                .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                                .slice(0, 5)
                                .map(([make, count]) => (
                                  <div key={make} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 dark:text-gray-300">{make}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">({count})</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* History Section */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                          {subscriptionTier === 'enterprise' ? (
                            <button
                              onClick={() => toggleHistory(item.url)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg transition text-sm font-medium text-blue-700 dark:text-blue-300"
                            >
                              <span>View Scan History</span>
                              <TrendingUp className="w-4 h-4" />
                            </button>
                          ) : (
                            <Link
                              to="/upgrade"
                              className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition text-sm font-medium text-gray-600 dark:text-gray-300"
                            >
                              <span>Scan History (Enterprise Feature)</span>
                              <AlertCircle className="w-4 h-4" />
                            </Link>
                          )}

                          {/* History Data (Enterprise only) */}
                          {subscriptionTier === 'enterprise' && expandedHistory === item.url && (
                            <div className="mt-3 space-y-2">
                              {historyData[item.url]?.length > 0 ? (
                                <>
                                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Recent Scans</div>
                                  {historyData[item.url].map((history) => (
                                    <div
                                      key={history.id}
                                      className="flex items-center justify-between text-xs bg-white dark:bg-gray-700 rounded p-2 border border-gray-200 dark:border-gray-600"
                                    >
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {formatDate(history.scanned_at)}
                                      </span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-700 dark:text-gray-300">
                                          {history.vehicle_count} vehicles
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                          {formatCurrency(history.avg_price)} avg
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => navigate(`/competitor-history/${item.id}`)}
                                    className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-2"
                                  >
                                    View Detailed History →
                                  </button>
                                </>
                              ) : (
                                <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                                  No history available yet
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
