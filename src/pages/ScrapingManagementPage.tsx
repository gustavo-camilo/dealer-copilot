import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import WaitingListCard from '../components/WaitingListCard';

interface WaitingListEntry {
  id: string;
  tenant_id: string;
  website_url: string;
  requested_at: string;
  status: string;
  assigned_to: string | null;
  priority: number;
  notes: string | null;
  tenant: {
    name: string;
    contact_email: string;
    contact_phone: string | null;
    location: string | null;
  };
}

interface UploadHistory {
  id: string;
  tenant_id: string;
  uploaded_by: string;
  filename: string;
  upload_date: string;
  status: string;
  vehicles_processed: number;
  vehicles_new: number;
  vehicles_updated: number;
  vehicles_sold: number;
  tenants: { name: string };
  users: { full_name: string };
}

interface PendingReview {
  id: string;
  tenant_id: string;
  snapshot_date: string;
  vehicles_found: number;
  status: string;
  tenants: { name: string };
}

export default function ScrapingManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'waiting' | 'uploads' | 'reviews'>('waiting');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Waiting List
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);

  // Upload History
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);

  // Pending Reviews
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [selectedTenantForScrape, setSelectedTenantForScrape] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [scraping, setScraping] = useState(false);

  // Export
  const [exportingTenant, setExportingTenant] = useState('');
  const [exporting, setExporting] = useState(false);

  // Check permission
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userData || userData.role !== 'super_admin') {
        navigate('/dashboard');
        return;
      }
    };

    checkPermission();
  }, [user, navigate]);

  // Load data
  useEffect(() => {
    loadData();
    loadTenants();
  }, [activeTab]);

  const loadTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, website_url')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (err: any) {
      console.error('Error loading tenants:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'waiting') {
        await loadWaitingList();
      } else if (activeTab === 'uploads') {
        await loadUploadHistory();
      } else if (activeTab === 'reviews') {
        await loadPendingReviews();
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadWaitingList = async () => {
    const { data, error } = await supabase.functions.invoke('get-waiting-list', {
      body: { include_completed: false },
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    setWaitingList(data.waiting_list || []);
  };

  const loadUploadHistory = async () => {
    const { data, error } = await supabase
      .from('manual_scraping_uploads')
      .select(`
        *,
        tenants!inner (name),
        users!inner (full_name)
      `)
      .order('upload_date', { ascending: false })
      .limit(50);

    if (error) throw error;
    setUploadHistory(data || []);
  };

  const loadPendingReviews = async () => {
    const { data, error } = await supabase
      .from('inventory_snapshots')
      .select(`
        id,
        tenant_id,
        snapshot_date,
        vehicles_found,
        status,
        tenants!inner (name)
      `)
      .eq('status', 'pending_review')
      .order('snapshot_date', { ascending: false });

    if (error) throw error;
    // Map data to match PendingReview interface (tenants comes as array from Supabase join)
    const mapped = (data || []).map((item: any) => ({
      ...item,
      tenants: Array.isArray(item.tenants) && item.tenants.length > 0 ? item.tenants[0] : { name: 'Unknown' }
    }));
    setPendingReviews(mapped);
  };

  const handleUpdateWaitingListStatus = async (entryId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('scraping_waiting_list')
        .update({ status })
        .eq('id', entryId);

      if (error) throw error;

      setMessage(`Status updated to ${status}`);
      setTimeout(() => setMessage(''), 3000);
      loadWaitingList();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdatePriority = async (entryId: string, priority: number) => {
    try {
      const { error } = await supabase
        .from('scraping_waiting_list')
        .update({ priority })
        .eq('id', entryId);

      if (error) throw error;
      loadWaitingList();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUploadForTenant = (tenantId: string) => {
    navigate(`/admin/upload?tenant_id=${tenantId}`);
  };

  const handleTestScrape = async () => {
    if (!selectedTenantForScrape) {
      setError('Please select a tenant');
      return;
    }

    setScraping(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('scrape-dealer-inventory', {
        body: {
          tenant_id: selectedTenantForScrape,
          review_mode: true,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setMessage('Scraping completed! Results saved for review.');
      loadPendingReviews();
      setActiveTab('reviews');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScraping(false);
    }
  };

  const handleApproveReview = async (snapshotId: string, action: 'approve' | 'reject') => {
    try {
      const { data, error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setMessage(`Successfully ${action}d scraping results`);
      setTimeout(() => setMessage(''), 3000);
      loadPendingReviews();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    if (!exportingTenant) {
      setError('Please select a tenant to export');
      return;
    }

    setExporting(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('export-tenant-inventory', {
        body: {},
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage('Export downloaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Scraping Management</h1>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              activeTab === 'waiting'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Waiting List ({waitingList.length})
          </button>
          <button
            onClick={() => setActiveTab('uploads')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              activeTab === 'uploads'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Upload History
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              activeTab === 'reviews'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Pending Reviews ({pendingReviews.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
            <p className="mt-4 text-gray-400">Loading...</p>
          </div>
        ) : (
          <>
            {/* Waiting List Tab */}
            {activeTab === 'waiting' && (
              <div className="space-y-6">
                {waitingList.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 text-center">
                    <p className="text-gray-400">No dealerships in waiting list</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {waitingList.map((entry) => (
                      <WaitingListCard
                        key={entry.id}
                        entry={entry}
                        onUpload={handleUploadForTenant}
                        onUpdateStatus={handleUpdateWaitingListStatus}
                        onUpdatePriority={handleUpdatePriority}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload History Tab */}
            {activeTab === 'uploads' && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden">
                {uploadHistory.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-gray-400">No upload history</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="text-left p-4">Tenant</th>
                        <th className="text-left p-4">Uploaded By</th>
                        <th className="text-left p-4">Date</th>
                        <th className="text-left p-4">Vehicles</th>
                        <th className="text-left p-4">New</th>
                        <th className="text-left p-4">Updated</th>
                        <th className="text-left p-4">Sold</th>
                        <th className="text-left p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadHistory.map((upload) => (
                        <tr key={upload.id} className="border-t border-white/10">
                          <td className="p-4">{upload.tenants.name}</td>
                          <td className="p-4">{upload.users.full_name}</td>
                          <td className="p-4 text-sm text-gray-400">
                            {new Date(upload.upload_date).toLocaleString()}
                          </td>
                          <td className="p-4">{upload.vehicles_processed}</td>
                          <td className="p-4 text-green-400">{upload.vehicles_new}</td>
                          <td className="p-4 text-yellow-400">{upload.vehicles_updated}</td>
                          <td className="p-4 text-purple-400">{upload.vehicles_sold}</td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                upload.status === 'completed'
                                  ? 'bg-green-500/20 text-green-300'
                                  : upload.status === 'failed'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-yellow-500/20 text-yellow-300'
                              }`}
                            >
                              {upload.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Pending Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Test Scrape Controls */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-4">Test Automated Scrape</h2>
                  <div className="flex gap-4">
                    <select
                      value={selectedTenantForScrape}
                      onChange={(e) => setSelectedTenantForScrape(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select tenant to scrape...</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} ({tenant.website_url})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleTestScrape}
                      disabled={!selectedTenantForScrape || scraping}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scraping ? 'Scraping...' : 'Test Scrape (Review Mode)'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Results will be saved for review and won't update the database until approved
                  </p>
                </div>

                {/* Pending Reviews List */}
                {pendingReviews.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 text-center">
                    <p className="text-gray-400">No pending reviews</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingReviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-white/10 backdrop-blur-md rounded-xl p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{review.tenants.name}</h3>
                            <p className="text-sm text-gray-400">
                              {new Date(review.snapshot_date).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-400">
                              {review.vehicles_found}
                            </p>
                            <p className="text-sm text-gray-400">Vehicles Found</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApproveReview(review.id, 'approve')}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition"
                          >
                            Approve & Apply Changes
                          </button>
                          <button
                            onClick={() => handleApproveReview(review.id, 'reject')}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Export Tools */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-4">Export Inventory</h2>
                  <div className="flex gap-4">
                    <select
                      value={exportingTenant}
                      onChange={(e) => setExportingTenant(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select tenant to export...</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleExport}
                      disabled={!exportingTenant || exporting}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exporting ? 'Exporting...' : 'Export as CSV'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
