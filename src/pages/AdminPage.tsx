import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Tenant } from '../types/database';
import { Target, Users, Building2, CreditCard, LogOut, LayoutDashboard, Upload, Database, FileText, Clock, Edit, Globe, Download, MessageSquare, Search } from 'lucide-react';
import CSVUploader from '../components/CSVUploader';
import WaitingListCard from '../components/WaitingListCard';
import CompetitorWaitingListCard from '../components/CompetitorWaitingListCard';
import EditTenantModal from '../components/EditTenantModal';
import SupportTicketCard from '../components/SupportTicketCard';
import toast from 'react-hot-toast';

interface UploadHistory {
  id: string;
  filename: string;
  upload_date: string;
  status: string;
  vehicles_processed: number;
  vehicles_new: number;
  vehicles_updated: number;
  vehicles_sold: number;
  scraping_source: string;
  tenants: { name: string };
  users: { full_name: string };
}

interface WaitingListEntry {
  id: string;
  tenant_id: string;
  website_url: string;
  requested_at: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  tenant: {
    name: string;
    contact_email: string;
    contact_phone: string | null;
    location: string | null;
  };
  assigned_user?: {
    full_name: string;
    email: string;
  } | null;
}

interface PendingReview {
  id: string;
  tenant_id: string;
  snapshot_date: string;
  vehicles_found: number;
  status: string;
  tenants: { name: string };
}

interface CompetitorWaitingListEntry {
  id: string;
  tenant_id: string;
  competitor_url: string;
  competitor_name: string | null;
  requested_at: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  tenant: {
    name: string;
    contact_email: string;
    contact_phone: string | null;
    location: string | null;
  };
  assigned_user?: {
    full_name: string;
    email: string;
  } | null;
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
  const [activeTab, setActiveTab] = useState<'tenants' | 'waiting-list' | 'competitor-queue' | 'upload' | 'history' | 'reviews' | 'support'>('tenants');

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
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [waitingListStatusFilter, setWaitingListStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [waitingListSearchQuery, setWaitingListSearchQuery] = useState('');
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [selectedTenantForScrape, setSelectedTenantForScrape] = useState('');
  const [scraping, setScraping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTenantForEdit, setSelectedTenantForEdit] = useState<Tenant | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [competitorWaitingList, setCompetitorWaitingList] = useState<CompetitorWaitingListEntry[]>([]);
  const [competitorStatusFilter, setCompetitorStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [competitorSearchQuery, setCompetitorSearchQuery] = useState('');
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportStatusFilter, setSupportStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');

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
      setActiveTab('waiting-list');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'waiting-list') loadWaitingList();
    else if (activeTab === 'competitor-queue') loadCompetitorWaitingList();
    else if (activeTab === 'history') loadUploadHistory();
    else if (activeTab === 'reviews') loadPendingReviews();
    else if (activeTab === 'support') loadSupportTickets();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'support') loadSupportTickets();
  }, [supportStatusFilter]);

  useEffect(() => {
    if (activeTab === 'waiting-list') {
      loadWaitingList();
    }
  }, [waitingListStatusFilter]);

  useEffect(() => {
    if (activeTab === 'competitor-queue') {
      loadCompetitorWaitingList();
    }
  }, [competitorStatusFilter]);

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

  const loadWaitingList = async () => {
    try {
      const params = new URLSearchParams({
        status: waitingListStatusFilter,
        include_completed: 'true', // Always include completed so we can filter client-side
      });

      const { data, error } = await supabase.functions.invoke(`get-waiting-list?${params.toString()}`);

      if (error) throw error;
      setWaitingList(data.waiting_list || []);
    } catch (error) {
      console.error('Error loading waiting list:', error);
    }
  };

  const loadCompetitorWaitingList = async () => {
    try {
      const params = new URLSearchParams({
        status: competitorStatusFilter,
        include_completed: 'true',
      });

      const { data, error } = await supabase.functions.invoke(`get-competitor-waiting-list?${params.toString()}`);

      if (error) throw error;
      setCompetitorWaitingList(data.waiting_list || []);
    } catch (error) {
      console.error('Error loading competitor waiting list:', error);
    }
  };

  const loadUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('manual_scraping_uploads')
        .select('id, filename, upload_date, status, vehicles_processed, vehicles_new, vehicles_updated, vehicles_sold, scraping_source, tenants!inner (name), users!inner (full_name)')
        .eq('status', 'completed') // Only show successful scrapes
        .order('upload_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        scraping_source: item.scraping_source || 'dealer_inventory',
        tenants: Array.isArray(item.tenants) && item.tenants.length > 0 ? item.tenants[0] : { name: 'Unknown' },
        users: Array.isArray(item.users) && item.users.length > 0 ? item.users[0] : { full_name: 'Unknown' }
      }));
      setUploadHistory(mapped);
    } catch (error) {
      console.error('Error loading upload history:', error);
    }
  };

  const loadPendingReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('id, tenant_id, snapshot_date, vehicles_found, status, tenants!inner (name)')
        .eq('status', 'pending_review')
        .order('snapshot_date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        tenants: Array.isArray(item.tenants) && item.tenants.length > 0 ? item.tenants[0] : { name: 'Unknown' }
      }));
      setPendingReviews(mapped);
    } catch (error) {
      console.error('Error loading pending reviews:', error);
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

  const handleFileSelect = (file: File, content: string) => {
    setCsvFile(file);
    setUploadError('');
    setUploadMessage('');
  };

  const handleClearFile = () => {
    setCsvFile(null);
    setUploadError('');
    setUploadMessage('');
  };

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
          const { data, error } = await supabase.functions.invoke('upload-universal-csv', {
            body: {
              csv_content: text,
              filename: csvFile.name,
              tenant_id: user.tenant_id // Pass user's tenant_id for logging purposes
            }
          });

          if (error) throw error;

          if (data.success) {
            setUploadMessage(`Successfully processed ${data.vehicles_processed} vehicles!`);
            if (data.vehicles_new > 0) setUploadMessage(prev => `${prev} (${data.vehicles_new} new)`);
            handleClearFile();
            // Refresh data
            loadAdminData();
            loadCompetitorWaitingList();
          } else {
            throw new Error(data.error || 'Upload failed');
          }
        } catch (err: any) {
          console.error('Upload error:', err);
          setUploadError(err.message || 'Failed to upload CSV');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsText(csvFile);
    } catch (err: any) {
      console.error('File reading error:', err);
      setUploadError('Failed to read file');
      setUploading(false);
    }
  };

  const handleTestScrape = async () => {
    if (!selectedTenantForScrape) {
      alert('Please select a tenant');
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
        alert(`Scraping complete! Found ${vehiclesFound} vehicles. Review pending.`);
        loadPendingReviews();
      } else if (status === 'failed') {
        const errorMsg = data.results?.[0]?.error || 'Unknown error';
        alert(`Scraping failed: ${errorMsg}`);
      } else {
        alert(`Scraping complete! Found ${vehiclesFound} vehicles. Review pending.`);
        loadPendingReviews();
      }
    } catch (error: any) {
      console.error('Scraping error:', error);
      alert(`Scraping failed: ${error.message}`);
    } finally {
      setScraping(false);
    }
  };

  const handleApproveReview = async (snapshotId: string) => {
    if (!confirm('Approve this scraping result and apply changes?')) return;

    try {
      const { data, error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action: 'approve' },
      });

      if (error) throw error;

      alert(`Approved! ${data.vehicles_new} new, ${data.vehicles_updated} updated, ${data.vehicles_sold} sold`);
      loadPendingReviews();
    } catch (error: any) {
      console.error('Approval error:', error);
      alert(`Failed to approve: ${error.message}`);
    }
  };

  const handleRejectReview = async (snapshotId: string) => {
    if (!confirm('Reject this scraping result?')) return;

    try {
      const { error } = await supabase.functions.invoke('approve-scraping-results', {
        body: { snapshot_id: snapshotId, action: 'reject' },
      });

      if (error) throw error;

      alert('Review rejected');
      loadPendingReviews();
    } catch (error: any) {
      console.error('Rejection error:', error);
      alert(`Failed to reject: ${error.message}`);
    }
  };

  const handleUpdateWaitingListStatus = async (entryId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('scraping_waiting_list')
        .update({ status })
        .eq('id', entryId);

      if (error) throw error;

      loadWaitingList();
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(`Failed to update: ${error.message}`);
    }
  };

  const handleDeleteWaitingListRequest = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('scraping_waiting_list')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Request deleted successfully');
      loadWaitingList();
    } catch (error: any) {
      console.error('Error deleting waiting list request:', error);
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  const handleUpdateCompetitorStatus = async (entryId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('competitor_scraping_waiting_list')
        .update({ status })
        .eq('id', entryId);

      if (error) throw error;

      loadCompetitorWaitingList();
    } catch (error: any) {
      console.error('Error updating competitor status:', error);
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  const handleDeleteCompetitorRequest = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('competitor_scraping_waiting_list')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Request deleted successfully');
      loadCompetitorWaitingList();
    } catch (error: any) {
      console.error('Error deleting competitor request:', error);
      toast.error(`Failed to delete: ${error.message}`);
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
                onClick={() => setActiveTab('waiting-list')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'waiting-list'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Clock className="inline-block h-4 w-4 mr-2" />
                Waiting List
              </button>

              {(isSuperAdmin || isVAUploader) && (
                <button
                  onClick={() => setActiveTab('competitor-queue')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'competitor-queue'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Globe className="inline-block h-4 w-4 mr-2" />
                  Competitor Queue
                </button>
              )}

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

            {activeTab === 'waiting-list' && (
              <div className="space-y-4">
                {isVAUploader && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800">
                      View dealerships waiting for inventory scraping. Click "Upload CSV" on any entry to upload data.
                    </p>
                  </div>
                )}

                {/* Filter Controls */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700">Status:</label>
                      <select
                        value={waitingListStatusFilter}
                        onChange={(e) => setWaitingListStatusFilter(e.target.value as any)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent text-sm"
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {/* Search Field */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by website URL, dealership name, or location..."
                        value={waitingListSearchQuery}
                        onChange={(e) => setWaitingListSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Pending: {waitingList.filter(e => e.status === 'pending').length}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      In Progress: {waitingList.filter(e => e.status === 'in_progress').length}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Completed: {waitingList.filter(e => e.status === 'completed').length}
                    </span>
                  </div>
                </div>

                {(() => {
                  // Filter by search query
                  const filteredList = waitingList.filter((entry) => {
                    if (!waitingListSearchQuery) return true;
                    const query = waitingListSearchQuery.toLowerCase();
                    return (
                      entry.website_url.toLowerCase().includes(query) ||
                      entry.tenant.name.toLowerCase().includes(query) ||
                      entry.tenant.location?.toLowerCase().includes(query)
                    );
                  });

                  if (filteredList.length === 0) {
                    return (
                      <p className="text-gray-500 text-center py-8">
                        {waitingListSearchQuery
                          ? `No results found for "${waitingListSearchQuery}"`
                          : waitingListStatusFilter === 'all'
                          ? 'No tenants in waiting list'
                          : `No ${waitingListStatusFilter.replace('_', ' ')} entries`}
                      </p>
                    );
                  }

                  return filteredList.map((entry) => (
                    <WaitingListCard
                      key={entry.id}
                      entry={entry}
                      onUpdateStatus={isSuperAdmin ? handleUpdateWaitingListStatus : undefined}
                      onDelete={isSuperAdmin ? handleDeleteWaitingListRequest : undefined}
                      onUpload={() => {
                        setActiveTab('upload');
                      }}
                    />
                  ));
                })()}
              </div>
            )}

            {activeTab === 'competitor-queue' && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-purple-800">
                    Competitor websites waiting for CSV upload. Click "Upload CSV" on any entry to upload competitor data.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700">Status:</label>
                      <select
                        value={competitorStatusFilter}
                        onChange={(e) => setCompetitorStatusFilter(e.target.value as any)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {/* Search Field */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by competitor URL, dealership name, or location..."
                        value={competitorSearchQuery}
                        onChange={(e) => setCompetitorSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Pending: {competitorWaitingList.filter(e => e.status === 'pending').length}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                      In Progress: {competitorWaitingList.filter(e => e.status === 'in_progress').length}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Completed: {competitorWaitingList.filter(e => e.status === 'completed').length}
                    </span>
                  </div>
                </div>

                {(() => {
                  // Filter by search query
                  const filteredList = competitorWaitingList.filter((entry) => {
                    if (!competitorSearchQuery) return true;
                    const query = competitorSearchQuery.toLowerCase();
                    return (
                      entry.competitor_url.toLowerCase().includes(query) ||
                      entry.competitor_name?.toLowerCase().includes(query) ||
                      entry.tenant.name.toLowerCase().includes(query) ||
                      entry.tenant.location?.toLowerCase().includes(query)
                    );
                  });

                  if (filteredList.length === 0) {
                    return (
                      <p className="text-gray-500 text-center py-8">
                        {competitorSearchQuery
                          ? `No results found for "${competitorSearchQuery}"`
                          : competitorStatusFilter === 'all'
                          ? 'No competitors in queue'
                          : `No ${competitorStatusFilter.replace('_', ' ')} entries`}
                      </p>
                    );
                  }

                  return filteredList.map((entry) => (
                    <CompetitorWaitingListCard
                      key={entry.id}
                      entry={entry}
                      onUpdateStatus={isSuperAdmin ? handleUpdateCompetitorStatus : undefined}
                      onDelete={isSuperAdmin ? handleDeleteCompetitorRequest : undefined}
                      onUpload={() => {
                        setActiveTab('upload');
                      }}
                    />
                  ));
                })()}
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
                {uploadMessage && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    {uploadMessage}
                  </div>
                )}

                {uploadError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    {uploadError}
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
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Processing...' : 'Upload CSV'}
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
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
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.tenants.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.filename}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${upload.scraping_source === 'competitor_data'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                              }`}>
                              {upload.scraping_source === 'competitor_data' ? 'Competitor Data' : 'Dealer Inventory'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.users.full_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(upload.upload_date).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{upload.vehicles_processed}</td>
                          <td className="px-6 py-4 text-sm text-green-600">{upload.vehicles_new}</td>
                          <td className="px-6 py-4 text-sm text-blue-600">{upload.vehicles_updated}</td>
                          <td className="px-6 py-4 text-sm text-red-600">{upload.vehicles_sold}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${upload.status === 'completed' ? 'bg-green-100 text-green-800' :
                              upload.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
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
                    {pendingReviews.map((review) => (
                      <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900">{review.tenants.name}</h4>
                            <p className="text-sm text-gray-500">
                              {new Date(review.snapshot_date).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {review.vehicles_found} vehicles found
                            </p>
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
                    ))}
                  </div>
                )}
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
      </div>
    </div>
  );
}
