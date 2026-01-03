import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';

export default function RecommendationDetailPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const { user, tenant, signOut } = useAuth();
  const [scanData, setScanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (scanId && user?.tenant_id) {
      loadScanData();
    }
  }, [scanId, user?.tenant_id]);

  const loadScanData = async () => {
    try {
      const { data, error } = await supabase
        .from('vin_scans')
        .select('*')
        .eq('id', scanId)
        .eq('tenant_id', user!.tenant_id)
        .single();

      if (error) throw error;
      setScanData(data);
    } catch (error) {
      console.error('Error loading scan:', error);
      navigate('/recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (updatedData: any) => {
    setScanData((prev: any) => ({ ...prev, ...updatedData }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark">
        <Header
          user={user}
          tenant={tenant}
          signOut={signOut}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!scanData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark">
      <Header
        user={user}
        tenant={tenant}
        signOut={signOut}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <VINScanResult
        scanData={scanData}
        isModal={false}
        tenantZipCode={tenant?.zip_code}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
