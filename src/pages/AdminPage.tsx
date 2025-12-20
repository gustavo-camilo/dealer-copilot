import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Tenant } from '../types/database';
import { Target, Users, Building2, CreditCard, LogOut, LayoutDashboard, Upload, Database, FileText, Clock, Edit, Edit2, Download, MessageSquare, Search, Play, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import CSVUploader from '../components/CSVUploader';
import EditTenantModal from '../components/EditTenantModal';
import EditCompetitorSourceModal from '../components/EditCompetitorSourceModal';
import SupportTicketCard from '../components/SupportTicketCard';
import toast from 'react-hot-toast';

interface UploadHistory {
  id: string;
  filename: string;
  status: string;
  upload_date: string;
  vehicles_processed: number;
  vehicles_new: number;
  vehicles_updated: number;
  vehicles_sold: number;
  scraping_source: string;
  error_log: any;
  users?: { full_name: string };
}

interface PendingReview {
  id: string;
  tenant_id: string;
  snapshot_date: string;
  vehicle_count: number | null;
  status: string;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  scanned_at: string | null;
  scraping_duration_ms: number | null;
  tenants?: { name: string };
}


interface ScrapeMonitorRow {
  id: string;
  source_type: string;
  tenant_id: string | null;
  source_name: string | null;
  source_url: string | null;
  vehicle_count: number | null;
  last_scraped_at: string | null;
  tenants?: { name: string };
}


interface SupportTicket {
  id: string;
  type: 'missing_market_data' | 'bug' | 'feature_request' | 'other';
  subject: string;
  details: any;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  tenant: {
    name: string;
    contact_email: string;
  };
  user: {
    full_name: string;
    email: string;
  };
}

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tenants' | 'scraping-queue' | 'upload' | 'history' | 'reviews' | 'support'>('tenants');

  // Check if user has access (super_admin or va_uploader)
  const isVAUploader = user?.role === 'va_uploader';
  const isSuperAdmin = user?.role === 'super_admin';
  const hasAccess = isSuperAdmin || isVAUploader;

  // State management
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scrapingQueue, setScrapingQueue] = useState<any[]>([]);
  const [queueFilter, setQueueFilter] = useState({ status: 'all', type: 'all', assignee: 'all' });
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [selectedTenantForScrape, setSelectedTenantForScrape] = useState('');
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTenantForEdit, setSelectedTenantForEdit] = useState<Tenant | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSourceModalOpen, setEditSourceModalOpen] = useState(false);
  const [selectedSourceForEdit, setSelectedSourceForEdit] = useState<any>(null);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportStatusFilter, setSupportStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [scrapeMonitorRows, setScrapeMonitorRows] = useState<ScrapeMonitorRow[]>([]);
  const [scrapeMonitorQuery, setScrapeMonitorQuery] = useState('');
  const [scrapeMonitorLoading, setScrapeMonitorLoading] = useState(false);


  const confirmAction = (message: string, confirmLabel = 'Confirm') =>
    new Promise<boolean>((resolve) => {
      let resolved = false;
      const finish = (result: boolean) => {
        if (resolved) return;
        resolved = true;
        resolve(result);
      };

      toast.custom(
        (t) => (
          <div className="max-w-sm w-full bg-white shadow-lg rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-800">{message}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  finish(false);
                }}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  finish(true);
                }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        ),
        { duration: Infinity }
      );
    });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    loadAdminData();
    if (isVAUploader && activeTab === 'tenants') {
      setActiveTab('scraping-queue');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'scraping-queue') loadScrapingQueue();
    else if (activeTab === 'history') loadUploadHistory();
    else if (activeTab === 'reviews') {
      loadPendingReviews();
      loadScrapeMonitor();
    }
    else if (activeTab === 'support') loadSupportTickets();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'support') loadSupportTickets();
  }, [supportStatusFilter]);

  useEffect(() => {
    if (activeTab === 'scraping-queue') {
      loadScrapingQueue();
    }
  }, [queueFilter]);

  const loadAdminData = async () => {
    try {
      const { data: tenantsData } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      const { data: usersData } = await supabase.from('users').select('id');

      if (tenantsData) {
        setTenants(tenantsData);
        setStats({
          totalTenants: tenantsData.length,
          activeTenants: tenantsData.filter(t => t.status === 'active').length,
          totalUsers: usersData?.length || 0,
        });
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScrapingQueue = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-scraping-queue', {
        body: {
          status: queueFilter.status,
          type: queueFilter.type,
          assignee: queueFilter.assignee,
        }
      });

      if (error) throw error;
      setScrapingQueue(data.queue || []);
    } catch (error) {
      console.error('Error loading scraping queue:', error);
    }
  };

  const loadUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('manual_scraping_uploads')
        .select('id, filename, upload_date, status, vehicles_processed, vehicles_new, vehicles_updated, vehicles_sold, scraping_source, users (full_name)')
        .eq('status', 'completed') // Only show successful scrapes
        .order('upload_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        scraping_source: item.scraping_source || 'dealer_inventory',
        users: Array.isArray(item.users) && item.users.length > 0 ? item.users[0] : item.users || { full_name: 'Unknown' }
      }));
      setUploadHistory(mapped);
    } catch (error) {
      console.error('Error loading upload history:', error);
    }
  };

  const loadPendingReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_snapshots_unified')
        .select('id, tenant_id, snapshot_date, vehicle_count, status, source_name, source_url, created_at, scanned_at, scraping_duration_ms, tenants (name)')
        .eq('status', 'pending_review')
        .order('snapshot_date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((item: any) => {
        const tenantName = Array.isArray(item.tenants)
          ? item.tenants[0]?.name
          : item.tenants?.name;

        return {
          ...item,
          tenants: { name: tenantName || 'Unknown' },
        };
      });
      setPendingReviews(mapped);
    } catch (error) {
      console.error('Error loading pending reviews:', error);
    }
  };


  const loadScrapeMonitor = async () => {
    setScrapeMonitorLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_snapshots_unified')
        .select('id, tenant_id, source_type, source_name, source_url, vehicle_count, created_at, scanned_at, snapshot_date, tenants (name)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const snapshots = data || [];
      const timestampFor = (item: any) => {
        if (item.scanned_at) return new Date(item.scanned_at).getTime();
        if (item.created_at) return new Date(item.created_at).getTime();
        if (item.snapshot_date) return new Date(`${item.snapshot_date}T00:00:00`).getTime();
        return 0;
      };

      snapshots.sort((a: any, b: any) => timestampFor(b) - timestampFor(a));

      const seen = new Set();
      const rows: ScrapeMonitorRow[] = [];

      for (const item of snapshots) {
        const key = item.tenant_id ? `dealer:${item.tenant_id}` : `competitor:${item.source_url}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const tenantName = Array.isArray(item.tenants)
          ? item.tenants[0]?.name
          : item.tenants?.name;

        rows.push({
          id: item.id,
          source_type: item.source_type,
          tenant_id: item.tenant_id,
          source_name: item.source_name,
          source_url: item.source_url,
          vehicle_count: item.vehicle_count,
          last_scraped_at: item.scanned_at || item.created_at || null,
          tenants: { name: tenantName || 'Unknown' },
        });
      }

      setScrapeMonitorRows(rows);
    } catch (error) {
      console.error('Error loading scrape monitor:', error);
    } finally {
      setScrapeMonitorLoading(false);
    }
  };

  const handleUpdateSource = async (updatedSource: { id: string; source_name: string; notes?: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-scraping-queue', {
        body: {
          action: 'update_source_info',
          id: updatedSource.id,
          source_name: updatedSource.source_name,
          notes: updatedSource.notes
        }
      });

      if (error) throw error;

      // Check if the function returned an error in the response data
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update source');
      }

      toast.success('Competitor source updated successfully');
      setEditSourceModalOpen(false);
      setSelectedSourceForEdit(null);
      await loadScrapingQueue();
    } catch (error) {
      console.error('Error updating source:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update competitor source');
    }
  };

  const loadSupportTickets = async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          id,
          type,
          subject,
          details,
          status,
          priority,
          created_at,
          tenants!inner (name, contact_email),
          users!inner (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (supportStatusFilter !== 'all') {
        query = query.eq('status', supportStatusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        tenant: Array.isArray(item.tenants) ? item.tenants[0] : item.tenants,
        user: Array.isArray(item.users) ? item.users[0] : item.users
      }));
      setSupportTickets(mapped);
    } catch (error) {
      console.error('Error loading support tickets:', error);
    }
  };

  const handleFileSelect = (file: File, _content: string) => {
    setCsvFile(file);
    setUploadError('');
    setUploadMessage('');
  };

  const handleClearFile = () => {
    setCsvFile(null);
    setUploadError('');
    setUploadMessage('');
  };

  // Clear messages and modal when switching away from upload tab
  useEffect(() => {
    if (activeTab !== 'upload') {
      setUploadError('');
      setUploadMessage('');
      setShowSuccessModal(false);
    }
  }, [activeTab]);

  const handleUpload = async () => {
    if (!csvFile || !user) return;

    setUploading(true);
    setUploadError('');
    setUploadMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;

        try {
          console.log('Invoking upload-universal-csv...');
          console.log('Request payload:', {
            filename: csvFile.name,
            tenant_id: user.tenant_id,
            csv_size: text.length
          });

          const { data, error } = await supabase.functions.invoke('upload-universal-csv', {
            body: {
              csv_content: text,
              filename: csvFile.name,
              tenant_id: user.tenant_id // Pass user's tenant_id for logging purposes
            }
          });

          console.log('Response received:', { data, error });

          if (error) {
            console.error('Supabase function error:', error);
            // Try to extract more detailed error information
            const errorMessage = error.message || 'Unknown error occurred';
            const errorContext = error.context || '';
            throw new Error(`${errorMessage}${errorContext ? ': ' + JSON.stringify(errorContext) : ''}`);
          }

          // Check if response indicates an error (even if error object wasn't set)
          if (data && !data.success && data.error) {
            const errorMsg = data.error;
            const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
            console.error('Function returned error:', errorMsg, errorDetails);
            throw new Error(errorMsg + errorDetails);
          }

          if (data && data.success) {
            // Handle both dealer and competitor uploads
            let message = `Successfully processed ${data.vehicles_processed} vehicles!`;

            // Dealer upload has vehicles_new, vehicles_updated, vehicles_sold
            if (data.vehicles_new !== undefined) {
              const details = [];
              if (data.vehicles_new > 0) details.push(`${data.vehicles_new} new`);
              if (data.vehicles_updated > 0) details.push(`${data.vehicles_updated} updated`);
              if (data.vehicles_sold > 0) details.push(`${data.vehicles_sold} sold`);
              if (details.length > 0) message += ` (${details.join(', ')})`;
            }

            // Competitor upload has competitor_url
            if (data.competitor_url) {
              message += ` for competitor: ${data.competitor_name || data.competitor_url}`;
            }

            // Show success modal
            setUploadMessage(message);
            setShowSuccessModal(true);

            // Clear file to unlock upload button
            setCsvFile(null);

            // Refresh all data
            loadAdminData();
            loadScrapingQueue();
            loadUploadHistory();
          } else {
            const errorMsg = data?.error || 'Upload failed';
            const errorDetails = data?.details ? `\n\nDetails: ${data.details}` : '';
            console.error('Function returned error:', errorMsg, errorDetails);
            throw new Error(errorMsg + errorDetails);
          }
        } catch (err: any) {
          console.error('Upload error:', err);
          const displayError = err.message || 'Failed to upload CSV';
          console.error('Displaying error to user:', displayError);
          setUploadError(displayError);
          toast.error(displayError, { duration: 6000 }); // Show error toast with longer duration
        } finally {
          setUploading(false);
        }
      };
      reader.readAsText(csvFile);
    } catch (err: any) {
      console.error('File reading error:', err);
      setUploadError('Failed to read file');
      toast.error('Failed to read file', { duration: 6000 }); // Show error toast with longer duration
      setUploading(false);
    }
  };

  const handleTestScrape = async () => {
    if (!selectedTenantForScrape) {
      toast.error('Please select a tenant');
      return;
    }

    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-dealer-inventory', {
        body: { tenant_id: selectedTenantForScrape, review_mode: true },
      });

      if (error) throw error;

      // The function returns results array and summary object
      const vehiclesFound = data.summary?.total_vehicles || data.results?.[0]?.vehicles_found || 0;
      const status = data.results?.[0]?.status || 'unknown';

      if (status === 'success') {
        toast.success(`Scraping complete! Found ${vehiclesFound} vehicles. Review pending.`);
        loadPendingReviews();
        loadScrapeMonitor();
      } else if (status === 'failed') {
        const errorMsg = data.results?.[0]?.error || 'Unknown error';
        toast.error(`Scraping failed: ${errorMsg}`);
      } else {
        toast.success(`Scraping complete! Found ${vehiclesFound} vehicles. Review pending.`);
        loadPendingReviews();
        loadScrapeMonitor();
      }
    } catch (error: any) {
      console.error('Scraping error:', error);
      toast.error(`Scraping failed: ${error.message}`);
    } finally {
      setScraping(false);
    }
  };

  const handleApproveReview = async (snapshotId: string) => {
    const confirmed = await confirmAction('Approve this scraping result and apply changes?', 'Approve');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action: 'approve' },
      });

      if (error) throw error;

      toast.success(`Approved! ${data.vehicles_new} new, ${data.vehicles_updated} updated, ${data.vehicles_sold} sold`);
      loadPendingReviews();
      loadScrapeMonitor();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(`Failed to approve: ${error.message}`);
    }
  };

  const handleRejectReview = async (snapshotId: string) => {
    const confirmed = await confirmAction('Reject this scraping result?', 'Reject');
    if (!confirmed) return;

    try {
      const { error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action: 'reject' },
      });

      if (error) throw error;

      toast.success('Review rejected');
      loadPendingReviews();
      loadScrapeMonitor();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(`Failed to reject: ${error.message}`);
    }
  };

  const handleQueueAction = async (action: string, id: string, payload: any = {}) => {
    try {
      const { error } = await supabase.functions.invoke('manage-scraping-queue', {
        body: { action, id, ...payload }
      });

      if (error) throw error;

      toast.success('Queue updated successfully');
      loadScrapingQueue();
    } catch (error: any) {
      console.error('Error updating queue:', error);
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId);

      if (error) throw error;

      toast.success('Ticket status updated');
      loadSupportTickets();
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenantForEdit(tenant);
    setEditModalOpen(true);
  };

  const handleUpdateTenant = async (updatedTenant: Partial<Tenant>) => {
    if (!selectedTenantForEdit) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update(updatedTenant)
        .eq('id', selectedTenantForEdit.id);

      if (error) throw error;

      toast.success('Dealership updated successfully!');
      loadAdminData();
      setEditModalOpen(false);
      setSelectedTenantForEdit(null);
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      toast.error(`Failed to update: ${error.message}`);
      throw error;
    }
  };

  if (!hasAccess) {
    return <Navigate to="/dashboard" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                {isVAUploader ? 'Dealer Co-Pilot - Upload Portal' : 'Dealer Co-Pilot Admin'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <button onClick={handleSignOut} className="flex items-center text-red-600 hover:text-red-700">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isVAUploader ? 'Scraping Upload Portal' : 'Super Admin Panel'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isVAUploader ? 'Upload CSV files for dealership inventories' : 'Manage all dealerships and scraping operations'}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Tenants</h3>
                <Building2 className="h-5 w-5 text-blue-900" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTenants}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Active Tenants</h3>
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.activeTenants}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                <Users className="h-5 w-5 text-blue-900" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('tenants')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'tenants'
                    ? 'border-blue-900 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Building2 className="inline-block h-4 w-4 mr-2" />
                  All Tenants
                </button>
              )}

              <button
                onClick={() => setActiveTab('scraping-queue')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'scraping-queue'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Clock className="inline-block h-4 w-4 mr-2" />
                Scraping Queue
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'upload'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Upload className="inline-block h-4 w-4 mr-2" />
                Upload CSV
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'history'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <FileText className="inline-block h-4 w-4 mr-2" />
                Upload History
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'reviews'
                    ? 'border-blue-900 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Database className="inline-block h-4 w-4 mr-2" />
                  Pending Reviews
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('support')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'support'
                    ? 'border-blue-900 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <MessageSquare className="inline-block h-4 w-4 mr-2" />
                  Support Tickets
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'tenants' && isSuperAdmin && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dealership</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inventory</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900">{tenant.name}</div>
                            <div className="text-sm text-gray-500">{tenant.location || 'N/A'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{tenant.contact_email}</div>
                          <div className="text-sm text-gray-500">{tenant.contact_phone || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 uppercase">
                            {tenant.plan_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${tenant.status === 'active' ? 'bg-green-100 text-green-800' :
                            tenant.status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                            {tenant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${tenant.inventory_status === 'ready' ? 'bg-green-100 text-green-800' :
                            tenant.inventory_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              tenant.inventory_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                            }`}>
                            {tenant.inventory_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEditTenant(tenant)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            title="Edit dealership"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'scraping-queue' && (
              <div>
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="text"
                        placeholder="Search queue..."
                        className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={queueFilter.type}
                      onChange={(e) => setQueueFilter({ ...queueFilter, type: e.target.value })}
                    >
                      <option value="all">All Types</option>
                      <option value="dealer">Dealers</option>
                      <option value="competitor">Competitors</option>
                    </select>
                    <select
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={queueFilter.status}
                      onChange={(e) => setQueueFilter({ ...queueFilter, status: e.target.value })}
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="active">Active</option>
                      <option value="failed">Failed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {scrapingQueue.length === 0 ? (
                      <li className="px-6 py-4 text-center text-gray-500">
                        No requests found matching your filters.
                      </li>
                    ) : (
                      scrapingQueue.map((item) => (
                        <li key={item.id} className="px-6 py-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center mb-1">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full mr-2 ${item.source_type === 'dealer' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                  {item.source_type === 'dealer' ? 'DEALER' : 'COMPETITOR'}
                                </span>
                                <h4 className="text-lg font-medium text-blue-600 truncate">
                                  <a href={item.source_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {item.source_name || (() => {
                                      try {
                                        return new URL(item.source_url).hostname;
                                      } catch {
                                        return item.source_url || 'Unknown';
                                      }
                                    })()}
                                  </a>
                                </h4>
                              </div>
                              <div className="mt-1 flex items-center text-sm text-gray-500">
                                <span className="truncate mr-4">
                                  Requested by: {item.tenant_name || 'System'}
                                </span>
                                <span>
                                  {new Date(item.requested_at).toLocaleDateString()}
                                </span>
                              </div>
                              {item.notes && (
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  Note: {item.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-end">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                    item.status === 'active' ? 'bg-green-100 text-green-800' :
                                      item.status === 'failed' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                  }`}>
                                  {item.status.replace('_', ' ').toUpperCase()}
                                </span>
                                {item.assigned_user_name && (
                                  <span className="text-xs text-gray-500 mt-1">
                                    Assigned to: {item.assigned_user_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {item.status === 'pending' && (
                                  <button
                                    onClick={() => handleQueueAction('update_status', item.id, { status: 'in_progress' })}
                                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Start processing"
                                  >
                                    <Play className="w-5 h-5" />
                                  </button>
                                )}
                                {item.status === 'in_progress' && (
                                  <button
                                    onClick={() => handleQueueAction('update_status', item.id, { status: 'active' })}
                                    className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Mark as complete"
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                )}
                                {/* Edit Button (for competitor sources) */}
                                {item.source_type === 'competitor' && (
                                  <button
                                    onClick={() => {
                                      setSelectedSourceForEdit(item);
                                      setEditSourceModalOpen(true);
                                    }}
                                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit source name"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    const confirmed = await confirmAction('Are you sure you want to delete this request?', 'Delete');
                                    if (confirmed) {
                                      handleQueueAction('delete', item.id);
                                    }
                                  }}
                                  className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete request"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Status:</label>
                    <select
                      value={supportStatusFilter}
                      onChange={(e) => setSupportStatusFilter(e.target.value as any)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    >
                      <option value="all">All Tickets</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="text-sm text-gray-600">
                    Total: {supportTickets.length} tickets
                  </div>
                </div>

                {supportTickets.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No support tickets found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supportTickets.map((ticket) => (
                      <SupportTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onUpdateStatus={handleUpdateTicketStatus}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}


            {activeTab === 'upload' && (
              <div className="max-w-3xl mx-auto">
                {uploadError && (
                  <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">!</div>
                      <p className="text-red-800 font-medium flex-1">{uploadError}</p>
                    </div>
                  </div>
                )}

                <div className="mb-6 flex justify-end">
                  <a
                    href="/templates/inventory_upload_template.csv"
                    download="inventory_upload_template.csv"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV Template
                  </a>
                </div>

                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">Smart Upload</h3>
                    <p className="text-sm text-blue-800">
                      Upload any inventory CSV (Dealer or Competitor). The system will automatically detect the website URL
                      and route the data to the correct inventory or competitor database.
                    </p>
                  </div>
                  <CSVUploader onFileSelect={handleFileSelect} onClear={handleClearFile} />
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!csvFile || uploading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {uploading ? 'Processing CSV...' : 'Upload CSV'}
                </button>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="overflow-x-auto">
                {uploadHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No upload history</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadHistory.map((upload) => (
                        <tr key={upload.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.filename}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${upload.scraping_source === 'dealer_inventory' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                              {upload.scraping_source === 'dealer_inventory' ? 'Dealer' : 'Competitor'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.users?.full_name || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(upload.upload_date).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.vehicles_processed || 0}</td>
                          <td className="px-6 py-4 text-sm text-green-600">{upload.vehicles_new || 0}</td>
                          <td className="px-6 py-4 text-sm text-blue-600">{upload.vehicles_updated || 0}</td>
                          <td className="px-6 py-4 text-sm text-red-600">{upload.vehicles_sold || 0}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${upload.status === 'completed' ? 'bg-green-100 text-green-800' :
                              upload.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'reviews' && isSuperAdmin && (
              <div>
                <div className="mb-6 pb-6 border-b">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Automated Scraper</h3>
                  <div className="flex gap-4">
                    <select
                      value={selectedTenantForScrape}
                      onChange={(e) => setSelectedTenantForScrape(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    >
                      <option value="">Choose a dealership...</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} - {tenant.website_url}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleTestScrape}
                      disabled={!selectedTenantForScrape || scraping}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scraping ? 'Scraping...' : 'Test Scrape with Review'}
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Reviews</h3>
                {pendingReviews.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No pending reviews</p>
                ) : (
                  <div className="space-y-4">
                    {pendingReviews.map((review) => {
                      const displayName = review.source_name || review.tenants?.name || 'Unknown';
                      const timestamp = review.scanned_at
                        ? new Date(review.scanned_at).toLocaleString()
                        : review.created_at
                          ? new Date(review.created_at).toLocaleString()
                          : new Date(`${review.snapshot_date}T00:00:00`).toLocaleDateString();
                      const vehiclesFound = review.vehicle_count ?? 0;
                      const durationSeconds = review.scraping_duration_ms !== null && review.scraping_duration_ms !== undefined
                        ? Math.round(review.scraping_duration_ms / 1000)
                        : null;

                      return (
                        <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-medium text-gray-900">{displayName}</h4>
                              <p className="text-sm text-gray-500">{timestamp}</p>
                              {review.source_url && (
                                <p className="text-xs text-gray-500 mt-1">Source: {review.source_url}</p>
                              )}
                              <p className="text-sm text-gray-600 mt-1">
                                {vehiclesFound} vehicles found
                              </p>
                              {durationSeconds !== null && (
                                <p className="text-xs text-gray-500 mt-1">Duration: {durationSeconds}s</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveReview(review.id)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectReview(review.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Scrape Monitor</h3>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={scrapeMonitorQuery}
                        onChange={(e) => setScrapeMonitorQuery(e.target.value)}
                        placeholder="Search by name or URL"
                        className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
                      />
                      <button
                        onClick={loadScrapeMonitor}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {scrapeMonitorLoading ? (
                    <div className="text-sm text-gray-500">Loading scrape monitor...</div>
                  ) : scrapeMonitorRows.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">No scrape history found</p>
                  ) : (
                    <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicles</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Scraped</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {scrapeMonitorRows
                            .filter((row) => {
                              const needle = scrapeMonitorQuery.trim().toLowerCase();
                              if (!needle) return true;
                              const displayName = row.source_name || row.tenants?.name || row.source_url || '';
                              const url = row.source_url || '';
                              return displayName.toLowerCase().includes(needle) || url.toLowerCase().includes(needle);
                            })
                            .map((row) => {
                              const displayName = row.source_name || row.tenants?.name || 'Unknown';
                              const vehicles = row.vehicle_count ?? 0;
                              const timestamp = row.last_scraped_at
                                ? new Date(row.last_scraped_at).toLocaleString()
                                : 'N/A';
                              return (
                                <tr key={row.id}>
                                  <td className="px-6 py-4 text-sm text-gray-900">{displayName}</td>
                                  <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row.source_type === 'dealer' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                      {row.source_type === 'dealer' ? 'Dealer' : 'Competitor'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{row.source_url || 'N/A'}</td>
                                  <td className="px-6 py-4 text-sm text-gray-900">{vehicles}</td>
                                  <td className="px-6 py-4 text-sm text-gray-500">{timestamp}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Edit Tenant Modal */}
        {selectedTenantForEdit && (
          <EditTenantModal
            tenant={selectedTenantForEdit}
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedTenantForEdit(null);
            }}
            onSave={handleUpdateTenant}
          />
        )}

        {/* Edit Competitor Source Modal */}
        <EditCompetitorSourceModal
          isOpen={editSourceModalOpen}
          onClose={() => {
            setEditSourceModalOpen(false);
            setSelectedSourceForEdit(null);
          }}
          source={selectedSourceForEdit}
          onSave={handleUpdateSource}
        />

        {/* Upload Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in duration-200">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Successful!</h3>
                  <p className="text-gray-700">{uploadMessage}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setUploadMessage('');
                    setUploadError('');
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Upload Another File
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setUploadMessage('');
                    setActiveTab('history');
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                >
                  View Upload History
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setUploadMessage('');
                  }}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}
