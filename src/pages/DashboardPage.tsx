import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VINScan, RecommendationType } from '../types/database';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { Sheet } from '../components/ui';
import { DashboardView, DashboardSkeleton } from '../components/dashboard/DashboardView';
import { formatVehicleName } from '../utils/vehicle';


export default function DashboardPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalVehicles: 0,
    portfolioValue: 0,
    weekSales: 0,
    minPrice: 0,
    maxPrice: 0,
    avgPrice: 0,
    minMileage: 0,
    maxMileage: 0,
    avgMileage: 0,
    topMakes: {} as Record<string, number>,
  });
  const [recentScans, setRecentScans] = useState<VINScan[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<VINScan | null>(null);
  const [hasRequestedInventory, setHasRequestedInventory] = useState(false);
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const scanResultRef = useRef<{ saveCosts: () => void }>(null);

  const handleCloseModal = () => {
    if (isEditingCosts) {
      setShowConfirmDialog(true);
    } else {
      setSelectedScan(null);
      setIsEditingCosts(false);
    }
  };

  const confirmCloseModal = () => {
    setSelectedScan(null);
    setIsEditingCosts(false);
    setShowConfirmDialog(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.tenant_id) return;

    try {
      // Load vehicles: First get sources, then get vehicles (Centralized Model)
      const { data: sources } = await supabase
        .from('tenant_sources')
        .select('source_id')
        .eq('tenant_id', user.tenant_id)
        .eq('relationship_type', 'owner');

      const sourceIds = sources?.map(s => s.source_id) || [];

      let vehicles: any[] = [];

      if (sourceIds.length > 0) {
        const { data: sourcedVehicles } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .in('source_id', sourceIds)
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'active');

        vehicles = sourcedVehicles || [];
      } else {
        const { data: legacyVehicles } = await supabase
          .from('tracked_vehicles')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'active');

        vehicles = legacyVehicles || [];
      }

      // Load recent sales
      const { data: recentSales } = await supabase
        .from('sales_records')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .gte('sale_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('sale_date', { ascending: false });

      // Load recent VIN scans (limit 5)
      const { data: scans } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Load recommendations (vehicles with "buy" recommendation)
      const { data: recs } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('recommendation', 'buy')
        .gte('confidence_score', 70)
        .order('confidence_score', { ascending: false })
        .limit(5);

      // Check if inventory has been requested/submitted (any status means they've submitted)
      const hasInventoryBeenRequested = tenant?.inventory_status !== null && tenant?.inventory_status !== undefined;
      setHasRequestedInventory(hasInventoryBeenRequested);

      if (vehicles) {
        const totalValue = vehicles.reduce((sum, v) => sum + Number(v.price), 0);
        
        // Calculate inventory stats
        const prices = vehicles.map(v => Number(v.price)).filter(p => !isNaN(p) && p > 0);
        const mileages = vehicles.map(v => Number(v.mileage)).filter(m => !isNaN(m) && m > 0);
        
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const avgPrice = prices.length > 0 ? totalValue / prices.length : 0;
        
        const minMileage = mileages.length > 0 ? Math.min(...mileages) : 0;
        const maxMileage = mileages.length > 0 ? Math.max(...mileages) : 0;
        const avgMileage = mileages.length > 0 ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length) : 0;
        
        // Calculate top makes
        const topMakes: Record<string, number> = {};
        vehicles.forEach(v => {
          if (v.make) {
            topMakes[v.make] = (topMakes[v.make] || 0) + 1;
          }
        });

        setStats({
          totalVehicles: vehicles.length,
          portfolioValue: totalValue,
          weekSales: recentSales?.length || 0,
          minPrice,
          maxPrice,
          avgPrice,
          minMileage,
          maxMileage,
          avgMileage,
          topMakes,
        });
      }

      if (scans) {
        setRecentScans(scans);
      }

      if (recs) {
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScanUpdate = (updatedData: {
    id: string;
    recommendation?: RecommendationType;
    estimated_profit?: number | null;
    max_bid_suggestion?: number | null;
    custom_recon_cost?: number | null;
    custom_transport_cost?: number | null;
    custom_max_bid?: number | null;
    custom_market_price?: number | null;
  }) => {
    // Update recentScans list
    setRecentScans(prevScans =>
      prevScans.map(scan =>
        scan.id === updatedData.id
          ? { ...scan, ...updatedData }
          : scan
      )
    );

    // Update selectedScan if it's the one being edited
    if (selectedScan?.id === updatedData.id) {
      setSelectedScan(prev => prev ? { ...prev, ...updatedData } : null);
    }
  };

  const header = (
    <Header
      user={user}
      tenant={tenant}
      signOut={handleSignOut}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        {header}
        <DashboardSkeleton />
      </div>
    );
  }

  const selectedTitle = selectedScan
    ? `${selectedScan.decoded_data.year} ${formatVehicleName(selectedScan.decoded_data.make)} ${formatVehicleName(selectedScan.decoded_data.model)}`
    : '';

  return (
    <div className="min-h-screen bg-canvas">
      {header}

      <DashboardView
        firstName={user?.full_name?.split(' ')[0]}
        tenantName={tenant?.name}
        stats={stats}
        recentScans={recentScans}
        recommendations={recommendations}
        showOnboarding={!hasRequestedInventory}
        onSelectScan={(scan) => setSelectedScan(scan as VINScan)}
      />

        {/* Details Sheet */}
        <Sheet open={!!selectedScan} onClose={handleCloseModal} title={selectedTitle} size="xl" bodyClassName="p-4 sm:p-6">
          {selectedScan && (
                <VINScanResult
                  scanData={{
                    id: selectedScan.id,
                    decoded_data: selectedScan.decoded_data,
                    market_data: selectedScan.market_data,
                    recommendation: selectedScan.recommendation,
                    confidence_score: selectedScan.confidence_score,
                    match_reasoning: selectedScan.match_reasoning,
                    estimated_profit: selectedScan.estimated_profit,
                    max_bid_suggestion: selectedScan.max_bid_suggestion,
                    custom_recon_cost: selectedScan.custom_recon_cost,
                    custom_transport_cost: selectedScan.custom_transport_cost,
                    custom_max_bid: selectedScan.custom_max_bid,
                    custom_market_price: selectedScan.custom_market_price,
                  }}
                  isModal={true}
                  tenantZipCode={tenant?.zip_code}
                  onClose={handleCloseModal}
                  onUpdate={handleScanUpdate}
                  onEditStatusChange={setIsEditingCosts}
                  onOutsideClick={() => setShowConfirmDialog(true)}
                  ref={scanResultRef}
                  isEditing={isEditingCosts}
                />
          )}
        </Sheet>

        <ConfirmationDialog
          isOpen={showConfirmDialog}
          onConfirm={confirmCloseModal}
          onCancel={() => {
            scanResultRef.current?.saveCosts();
            setIsEditingCosts(false);
            setShowConfirmDialog(false);
          }}
          confirmLabel="Discard & Leave"
          cancelLabel="Save and Stay"
          message="You have unsaved changes in the profit calculator. How would you like to proceed?"
        />
      </div>
  );
}
