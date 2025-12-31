import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Tenant } from '../types/database';
import { Target, Users, Building2, CreditCard, LogOut, LayoutDashboard, Upload, Database, FileText, Clock, Edit, Download, MessageSquare, Search, Play, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
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
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);
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

      const toastId = 'admin-confirm-action';
      toast.dismiss(toastId);
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
        { duration: Infinity, id: toastId }
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
  tenants!inner(name, contact_email),
    users!inner(full_name, email)
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
            throw new Error(`${errorMessage}${errorContext ? ': ' + JSON.stringify(errorContext) : ''} `);
          }

          // Check if response indicates an error (even if error object wasn't set)
          if (data && !data.success && data.error) {
            const errorMsg = data.error;
            const errorDetails = data.details ? `\n\nDetails: ${data.details} ` : '';
            console.error('Function returned error:', errorMsg, errorDetails);
            throw new Error(errorMsg + errorDetails);
          }

          if (data && data.success) {
            // Handle both dealer and competitor uploads
            let message = `Successfully processed ${data.vehicles_processed} vehicles!`;

            // Dealer upload has vehicles_new, vehicles_updated, vehicles_sold
            if (data.vehicles_new !== undefined) {
              const details = [];
              if (data.vehicles_new > 0) details.push(`${data.vehicles_new} new `);
              if (data.vehicles_updated > 0) details.push(`${data.vehicles_updated} updated`);
              if (data.vehicles_sold > 0) details.push(`${data.vehicles_sold} sold`);
              if (details.length > 0) message += ` (${details.join(', ')})`;
            }

            // Competitor upload has competitor_url
            if (data.competitor_url) {
              message += ` for competitor: ${data.competitor_name || data.competitor_url} `;
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
            const errorDetails = data?.details ? `\n\nDetails: ${data.details} ` : '';
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
        toast.success(`Scraping complete! Found ${vehiclesFound} vehicles.Review pending.`);
        loadPendingReviews();
        loadScrapeMonitor();
      } else if (status === 'failed') {
        const errorMsg = data.results?.[0]?.error || 'Unknown error';
        toast.error(`Scraping failed: ${errorMsg} `);
      } else {
        toast.success(`Scraping complete! Found ${vehiclesFound} vehicles.Review pending.`);
        loadPendingReviews();
        loadScrapeMonitor();
      }
    } catch (error: any) {
      console.error('Scraping error:', error);
      toast.error(`Scraping failed: ${error.message} `);
    } finally {
      setScraping(false);
    }
  };

  const handleApproveReview = async (snapshotId: string) => {
    const confirmed = await confirmAction('Approve this scraping result and apply changes?', 'Approve');
    if (!confirmed) return;

    try {
      setReviewActionId(snapshotId);
      const { data, error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action: 'approve' },
      });

      if (error) throw error;

      toast.success(`Approved! ${data.vehicles_new} new, ${data.vehicles_updated} updated, ${data.vehicles_sold} sold`);
      loadPendingReviews();
      loadScrapeMonitor();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(`Failed to approve: ${error.message} `);
    } finally {
      setReviewActionId(null);
    }
  };

  const handleRejectReview = async (snapshotId: string) => {
    const confirmed = await confirmAction('Reject this scraping result?', 'Reject');
    if (!confirmed) return;

    try {
      setReviewActionId(snapshotId);
      const { error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action: 'reject' },
      });

      if (error) throw error;

      toast.success('Review rejected');
      loadPendingReviews();
      loadScrapeMonitor();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(`Failed to reject: ${error.message} `);
    } finally {
      setReviewActionId(null);
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
      toast.error(`Failed to update: ${error.message} `);
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
      toast.error(`Failed to update status: ${error.message} `);
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
      toast.error(`Failed to update: ${error.message} `);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300" aria-busy={scraping}>
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-white dark:text-slate-900" />
              </div>
              <span className="ml-3 text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {isVAUploader ? 'Upload Portal' : 'Admin Control'}
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <Link to="/dashboard" className="flex items-center text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary-500 transition-colors">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                title="Sign out of administration"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {isVAUploader ? 'Inventory Management' : 'Super Admin'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {isVAUploader ? 'Source-agnostic inventory synchronization' : 'Complete control over tenants and operations'}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { label: 'Total Tenants', value: stats.totalTenants, icon: Building2, color: 'text-slate-400' },
              { label: 'Active Seats', value: stats.activeTenants, icon: CreditCard, color: 'text-secondary-500' },
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary-500' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest font-black text-slate-400">{stat.label}</span>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden">
          <div className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
              {[
                { id: 'tenants', label: 'Tenants', icon: Building2, show: isSuperAdmin },
                { id: 'scraping-queue', label: 'Queue', icon: Clock, show: true },
                { id: 'upload', label: 'Manual Upload', icon: Upload, show: true },
                { id: 'history', label: 'History', icon: FileText, show: true },
                { id: 'reviews', label: 'Reviews', icon: Database, show: isSuperAdmin },
                { id: 'support', label: 'Support', icon: MessageSquare, show: isSuperAdmin },
              ].filter(t => t.show).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-500 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'tenants' && isSuperAdmin && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Dealership</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 text-xs font-bold text-slate-500">
                              {tenant.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-sm">{tenant.name}</div>
                              <div className="text-xs text-slate-500 font-medium">{tenant.location || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{tenant.contact_email}</div>
                          <div className="text-xs text-slate-500">{tenant.contact_phone || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 uppercase tracking-tighter">
                            {tenant.plan_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-secondary-500 shadow-glow-secondary' : 'bg-slate-300'}`} />
                            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{tenant.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-tighter ${tenant.inventory_status === 'ready' ? 'bg-secondary-500/10 text-secondary-500' :
                            tenant.inventory_status === 'processing' ? 'bg-primary-500/10 text-primary-500 animate-pulse' :
                              'bg-slate-100 dark:bg-white/10 text-slate-500'
                            }`}>
                            {tenant.inventory_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleEditTenant(tenant)}
                            className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-500/5 rounded-lg transition-all"
                            title="Edit dealership"
                          >
                            <Edit size={16} />
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
                <div className="mb-8 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search queue (URL, Name, ID)..."
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="flex gap-3">
                    <select
                      className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500"
                      value={queueFilter.type}
                      onChange={(e) => setQueueFilter({ ...queueFilter, type: e.target.value })}
                    >
                      <option value="all">Sources</option>
                      <option value="dealer">Dealers</option>
                      <option value="competitor">Competitors</option>
                    </select>
                    <select
                      className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500"
                      value={queueFilter.status}
                      onChange={(e) => setQueueFilter({ ...queueFilter, status: e.target.value })}
                    >
                      <option value="all">Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="active">Active</option>
                      <option value="failed">Failed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {scrapingQueue.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl">
                      No operations match current filters.
                    </div>
                  ) : (
                    scrapingQueue.map((item) => (
                      <div key={item.id} className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 p-4 rounded-xl hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px - 2 py - 0.5 text - [10px] font - black rounded uppercase tracking - tighter ${item.source_type === 'dealer' ? 'bg-primary-500/10 text-primary-500' : 'bg-secondary-500/10 text-secondary-500'
                                } `}>
                                {item.source_type}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                                <a
                                  href={item.source_url?.startsWith('http') ? item.source_url : `https://${item.source_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary-500 border-b border-transparent hover:border-primary-500 transition-all font-mono"
                                >
                                  {item.source_url?.replace('https://', '').replace('www.', '').split('/')[0]}
                                </a >
                              </h4 >
                            </div >
                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                              <span className="flex items-center gap-1 uppercase">
                                <Users className="h-3 w-3" />
                                {item.tenant_name || 'System'}
                              </span>
                              <span className="flex items-center gap-1 uppercase">
                                <Clock className="h-3 w-3" />
                                {new Date(item.requested_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div >
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <span className={`px-2 py-1 text-[10px] font-black rounded-full uppercase tracking-widest block ${item.status === 'pending' ? 'bg-slate-100 dark:bg-white/5 text-slate-500' :
                                item.status === 'in_progress' ? 'bg-primary-500/10 text-primary-500 animate-pulse' :
                                  item.status === 'active' ? 'bg-secondary-500/10 text-secondary-500' :
                                    'bg-red-500/10 text-red-500'
                                }`}>
                                {item.status.replace('_', ' ')}
                              </span>
                              {item.assigned_user_name && (
                                <span className="text-[10px] text-slate-500 mt-1 block">
                                  @{item.assigned_user_name.split(' ')[0].toLowerCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.status === 'pending' && (
                                <button
                                  onClick={() => handleQueueAction('update_status', item.id, { status: 'in_progress' })}
                                  className="p-2 text-primary-500 hover:bg-primary-500/5 rounded-lg transition-colors"
                                  title="Start processing"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              {item.status === 'in_progress' && (
                                <button
                                  onClick={() => handleQueueAction('update_status', item.id, { status: 'active' })}
                                  className="p-2 text-secondary-500 hover:bg-secondary-500/5 rounded-lg transition-colors"
                                  title="Mark as complete"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  const confirmed = await confirmAction('Permanent removal of this entry?', 'Delete');
                                  if (confirmed) handleQueueAction('delete', item.id);
                                }}
                                className="p-2 text-red-500 hover:bg-red-500/5 rounded-lg transition-colors"
                                title="Delete request"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div >
                      </div >
                    ))
                  )}
                </div >
              </div >
            )}

            {
              activeTab === 'support' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter By Status:</span>
                      <select
                        value={supportStatusFilter}
                        onChange={(e) => setSupportStatusFilter(e.target.value as any)}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-lg text-xs font-bold focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">All Channels</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Active Tickets: {supportTickets.length}
                    </div>
                  </div>

                  {supportTickets.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50/50 dark:bg-black/10 rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5">
                      <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400">All quiet on the support front.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
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
              )
            }


            {
              activeTab === 'upload' && (
                <div className="max-w-2xl mx-auto py-10">
                  {uploadError && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-black">!</div>
                        <p className="text-red-500 text-xs font-bold leading-relaxed">{uploadError}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Inventory Injection</h3>
                    <a
                      href="/templates/inventory_upload_template.csv"
                      download="inventory_upload_template.csv"
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter text-primary-500 hover:text-primary-600 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Schema Template
                    </a>
                  </div>

                  <div className="mb-10">
                    <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl p-6 mb-8">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Vortex Data Engine</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Upload any inventory CSV (Internal or External). The AI-driven router will automatically
                        detect the origin and synchronize data with the appropriate registry.
                      </p>
                    </div>
                    <CSVUploader onFileSelect={handleFileSelect} onClear={handleClearFile} />
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={!csvFile || uploading}
                    className="w-full px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-glow-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing Stream...
                      </>
                    ) : (
                      'Initiate Synchronization'
                    )}
                  </button>
                </div>
              )
            }

            {
              activeTab === 'history' && (
                <div className="overflow-x-auto">
                  {uploadHistory.length === 0 ? (
                    <div className="py-20 text-center">
                      <FileText className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No transaction logs found</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-50/50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Payload</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Executor</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Metrics (P/N/U/S)</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {uploadHistory.map((upload) => (
                          <tr key={upload.id} className="hover:bg-slate-50/50 dark:hover:bg-white/1 group transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{upload.filename}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-tighter ${upload.scraping_source === 'dealer_inventory' ? 'bg-primary-500/10 text-primary-500' : 'bg-secondary-500/10 text-secondary-500'
                                }`}>
                                {upload.scraping_source === 'dealer_inventory' ? 'Internal' : 'External'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs font-bold text-slate-600 dark:text-slate-400">@{upload.users?.full_name?.split(' ')[0].toLowerCase() || 'system'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                              {new Date(upload.upload_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2 font-mono text-xs font-bold">
                                <span title="Processed" className="text-slate-400">{upload.vehicles_processed}</span>
                                <span title="New" className="text-secondary-500">{upload.vehicles_new}</span>
                                <span title="Updated" className="text-primary-500">{upload.vehicles_updated}</span>
                                <span title="Sold" className="text-red-500">{upload.vehicles_sold}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-tighter ${upload.status === 'completed' ? 'bg-secondary-500/10 text-secondary-500' :
                                upload.status === 'processing' ? 'bg-primary-500/10 text-primary-500 animate-pulse' :
                                  'bg-red-500/10 text-red-500'
                                }`}>
                                {upload.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            }

            {
              activeTab === 'reviews' && isSuperAdmin && (
                <div className="space-y-10">
                  <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">System Stress Test</h3>
                    <div className="flex gap-4">
                      <select
                        value={selectedTenantForScrape}
                        onChange={(e) => setSelectedTenantForScrape(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select Target Agency...</option>
                        {tenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name} ({tenant.website_url})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleTestScrape}
                        disabled={!selectedTenantForScrape || scraping}
                        className="px-6 py-2.5 bg-primary-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-glow-primary transition disabled:opacity-30"
                      >
                        {scraping ? 'Processing...' : 'Run Diagnostics'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Awaiting Validation</h3>
                    {pendingReviews.length === 0 ? (
                      <div className="py-20 text-center bg-slate-50/30 dark:bg-black/10 rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5">
                        <Database className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No pending snapshots</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingReviews.map((review) => {
                          const displayName = review.source_name || (review as any).tenants?.name || 'Unknown';
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
                            <div key={review.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm group">
                              <div className="flex justify-between items-center">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h4 className="font-black text-slate-900 dark:text-white text-sm truncate">{displayName}</h4>
                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 text-[10px] font-black text-slate-500 rounded uppercase tracking-tighter">
                                      {vehiclesFound} Units
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{timestamp}</p>
                                    {review.source_url && (
                                      <a
                                        href={review.source_url.startsWith('http') ? review.source_url : `https://${review.source_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-black text-primary-500 hover:underline flex items-center gap-1 uppercase tracking-tighter"
                                      >
                                        Origin <Search className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {durationSeconds !== null && (
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Clock: {durationSeconds}s
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApproveReview(review.id)}
                                    disabled={reviewActionId === review.id}
                                    className="px-4 py-2 bg-secondary-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-glow-secondary transition disabled:opacity-30"
                                  >
                                    {reviewActionId === review.id ? '...' : 'Commit'}
                                  </button>
                                  <button
                                    onClick={() => handleRejectReview(review.id)}
                                    disabled={reviewActionId === review.id}
                                    className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 text-white transition disabled:opacity-30"
                                  >
                                    {reviewActionId === review.id ? '...' : 'Purge'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-16">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ingestion Monitor</h3>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={scrapeMonitorQuery}
                              onChange={(e) => setScrapeMonitorQuery(e.target.value)}
                              placeholder="Filter stream..."
                              className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <button
                            onClick={loadScrapeMonitor}
                            className="p-2 bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {scrapeMonitorLoading ? (
                        <div className="py-20 text-center animate-pulse">
                          <Loader2 className="h-8 w-8 text-primary-500 mx-auto animate-spin mb-4" />
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Flux...</span>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50/50 dark:bg-black/20 border-b border-slate-200 dark:border-white/5">
                              <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Target</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Ingest</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                              {scrapeMonitorRows
                                .filter((row) => {
                                  const needle = scrapeMonitorQuery.trim().toLowerCase();
                                  if (!needle) return true;
                                  const displayName = row.source_name || (row as any).tenants?.name || row.source_url || '';
                                  return displayName.toLowerCase().includes(needle);
                                })
                                .map((row) => {
                                  const displayName = row.source_name || (row as any).tenants?.name || 'Unknown';
                                  return (
                                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-white/1 transition-colors">
                                      <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{displayName}</div>
                                        <div className="text-[10px] text-slate-400 font-medium truncate max-w-sm">{row.source_url}</div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-tighter ${row.source_type === 'dealer' ? 'bg-primary-500/10 text-primary-500' : 'bg-secondary-500/10 text-secondary-500'
                                          }`}>
                                          {row.source_type}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">{(row.vehicle_count ?? 0).toLocaleString()}</div>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <div className="text-xs font-bold text-slate-500">
                                          {row.last_scraped_at ? new Date(row.last_scraped_at).toLocaleDateString() : 'Pending'}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }
          </div >
        </div >
        {/* Edit Tenant Modal */}
        {
          selectedTenantForEdit && (
            <EditTenantModal
              tenant={selectedTenantForEdit}
              isOpen={editModalOpen}
              onClose={() => {
                setEditModalOpen(false);
                setSelectedTenantForEdit(null);
              }}
              onSave={handleUpdateTenant}
            />
          )
        }

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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/5">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-secondary-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-secondary-500 shadow-glow-secondary" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Upload Optimized</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">{uploadMessage}</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setUploadMessage('');
                    setUploadError('');
                  }}
                  className="w-full px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition"
                >
                  Synchronize Again
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setUploadMessage('');
                    setActiveTab('history');
                  }}
                  className="w-full px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition"
                >
                  Transactional Logs
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setUploadMessage('');
                  }}
                  className="w-full px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  Dismiss Overlay
                </button>
              </div>
            </div>
          </div>
        )}
      </div >
      {scraping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm px-4">
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-white/5 px-6 py-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Active Extraction</p>
                <p className="text-[10px] text-slate-500 font-medium">Synchronizing latest registry delta. Please standby.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
