import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useBlocker } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Target, Loader2, ChevronRight, Hash, Gauge, ArrowRight, ShieldCheck, Database, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { decodeVIN, enrichDecodedData } from '../services/vinDecoder';
import { getMarketPricing, calculateMaxBid } from '../services/marketPricing';
import { generateRecommendation } from '../services/recommendationEngine';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { SalesRecord, TenantCostSettings } from '../types/database';

const DEFAULT_COST_SETTINGS: TenantCostSettings = {
  auction_fee_thresholds: [
    { min_price: 0, max_price: 5000, fee: 200 },
    { min_price: 5000, max_price: 10000, fee: 350 },
    { min_price: 10000, max_price: 999999, fee: 500 },
  ],
  reconditioning_cost: 800,
  transport_cost: 150,
  floor_plan_rate: 0.08,
  target_margin_percent: 15,
  target_days_to_sale: 30,
};

export default function VINScanPage() {
  const navigate = useNavigate();
  const { user, tenant, signOut } = useAuth();
  const [vin, setVin] = useState('');
  const [mileage, setMileage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const scanResultRef = useRef<{ saveCosts: () => void }>(null);

  const resetScan = () => {
    setResult(null);
    setVin('');
    setMileage('');
    setError(null);
    setMenuOpen(false);
    setIsEditingCosts(false);
    setPendingReset(false);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditingCosts) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditingCosts]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => isEditingCosts && currentLocation.pathname !== nextLocation.pathname);

  const handleConfirmNavigation = () => { if (blocker.state === 'blocked') blocker.proceed?.(); };
  const handleCancelNavigation = () => { if (blocker.state === 'blocked') { scanResultRef.current?.saveCosts(); setIsEditingCosts(false); blocker.reset?.(); } };

  const costSettings = tenant?.cost_settings || DEFAULT_COST_SETTINGS;

  const handleSignOut = async () => { try { await signOut(); navigate('/signin'); } catch (e) { console.error(e); } };

  const handleScan = async (customRadius?: number) => {
    if (!vin || !user?.tenant_id) return;
    setLoading(true);
    setError(null);
    try {
      const decodedResult = await decodeVIN(vin);
      if (!decodedResult.success || !decodedResult.data) {
        setError(decodedResult.error || 'Failed to decode VIN');
        setLoading(false);
        return;
      }
      const enrichedData = enrichDecodedData(decodedResult.data, { mileage: mileage ? parseInt(mileage) : undefined });
      if (!tenant?.zip_code) {
        setError(<span>Missing ZIP Code. Please configure location in <Link to="/settings" className="underline font-black hover:text-primary-500">Settings</Link></span> as any);
        setLoading(false);
        return;
      }
      const marketData = await getMarketPricing(enrichedData, tenant.zip_code, customRadius || 100);
      const { data: salesHistory } = await supabase.from('sales_records').select('*').eq('tenant_id', user.tenant_id).order('sale_date', { ascending: false }).limit(100);
      const salesRecords: SalesRecord[] = salesHistory || [];
      const maxBid = marketData ? calculateMaxBid(marketData.averagePrice, costSettings.target_margin_percent, costSettings.auction_fee_thresholds || [], costSettings.reconditioning_cost, costSettings.transport_cost) : 0;
      const recommendation = await generateRecommendation(enrichedData, marketData, salesRecords, maxBid, costSettings.target_margin_percent);
      const { data: scanData } = await supabase.from('vin_scans').insert({
        tenant_id: user.tenant_id, user_id: user.id, vin, decoded_data: enrichedData, recommendation: recommendation.recommendation, confidence_score: recommendation.confidenceScore, match_reasoning: recommendation.matchReasons, estimated_profit: recommendation.estimatedProfit, max_bid_suggestion: recommendation.maxBidSuggestion, market_data: marketData, saved_to_bid_list: false, costs_edited: false,
      }).select().single();

      setResult({
        decoded_data: enrichedData, recommendation: recommendation.recommendation, confidence_score: recommendation.confidenceScore, match_reasoning: recommendation.matchReasons, estimated_profit: recommendation.estimatedProfit, max_bid_suggestion: recommendation.maxBidSuggestion, estimated_days_to_sale: recommendation.estimatedDaysToSale, market_data: marketData, scan_id: scanData?.id, radius: customRadius || 100,
      });
    } catch (e: any) {
      setError(e.message || 'Analysis encountered a matrix error');
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async (radius: number) => {
    if (!result?.decoded_data || !user?.tenant_id || !tenant?.zip_code) return;
    setLoading(true);
    try {
      const marketData = await getMarketPricing(result.decoded_data, tenant.zip_code, radius);
      const maxBid = marketData ? calculateMaxBid(marketData.averagePrice, costSettings.target_margin_percent, costSettings.auction_fee_thresholds || [], costSettings.reconditioning_cost, costSettings.transport_cost) : 0;
      const { data: salesHistory } = await supabase.from('sales_records').select('*').eq('tenant_id', user.tenant_id).order('sale_date', { ascending: false }).limit(100);
      const recommendation = await generateRecommendation(result.decoded_data, marketData, salesHistory || [], maxBid, costSettings.target_margin_percent);

      if ((!marketData || marketData.listingsCount === 0) && result.market_data?.listingsCount > 0) {
        toast.error(`No additional telemetry units found within ${radius}mi.`);
        setResult({ ...result, radius });
        setLoading(false);
        return;
      }
      setResult({ ...result, market_data: marketData, max_bid_suggestion: recommendation.maxBidSuggestion, estimated_profit: recommendation.estimatedProfit, recommendation: recommendation.recommendation, confidence_score: recommendation.confidenceScore, match_reasoning: recommendation.matchReasons, estimated_days_to_sale: recommendation.estimatedDaysToSale, radius });
      if (result.scan_id) {
        await supabase.from('vin_scans').update({ market_data: marketData, max_bid_suggestion: recommendation.maxBidSuggestion, estimated_profit: recommendation.estimatedProfit, recommendation: recommendation.recommendation, confidence_score: recommendation.confidenceScore, match_reasoning: recommendation.matchReasons }).eq('id', result.scan_id);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <Header user={user} tenant={tenant} signOut={handleSignOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onScanVinClick={() => { if (isEditingCosts) setPendingReset(true); else resetScan(); }} />
        <VINScanResult
          scanData={{
            id: result.scan_id, decoded_data: result.decoded_data, market_data: result.market_data, recommendation: result.recommendation, confidence_score: result.confidence_score, match_reasoning: result.match_reasoning, estimated_profit: result.estimated_profit, max_bid_suggestion: result.max_bid_suggestion, estimated_days_to_sale: result.estimated_days_to_sale, radius: result.radius,
            custom_recon_cost: result.custom_recon_cost, custom_transport_cost: result.custom_transport_cost, custom_max_bid: result.custom_max_bid, custom_market_price: result.custom_market_price,
          }}
          costSettings={costSettings} tenantZipCode={tenant?.zip_code} onRescan={handleRescan} onScanAnother={() => { setResult(null); setVin(''); setMileage(''); setError(null); setIsEditingCosts(false); }} onEditStatusChange={setIsEditingCosts} onOutsideClick={() => setPendingReset(true)} ref={scanResultRef} isEditing={isEditingCosts}
        />
        <ConfirmationDialog isOpen={blocker.state === 'blocked'} onConfirm={handleConfirmNavigation} onCancel={handleCancelNavigation} confirmLabel="Abandon & Discard" cancelLabel="Commit & Stay" />
        <ConfirmationDialog isOpen={pendingReset} onConfirm={resetScan} onCancel={() => { scanResultRef.current?.saveCosts(); setIsEditingCosts(false); setPendingReset(false); }} confirmLabel="Discard & Scan New" cancelLabel="Commit & Stay" message="Uncommitted tactical cost parameters detected. Discard data set?" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={handleSignOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onScanVinClick={() => { if (isEditingCosts) setPendingReset(true); else resetScan(); }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative z-10">
        <div className="max-w-xl w-full text-center">
          <div className="mb-12">
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full" />
              <div className="relative bg-primary-500 p-5 rounded-3xl shadow-glow-primary">
                <Target className="h-10 w-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase italic">
              Tactical <span className="text-primary-500">Analysis</span>
            </h1>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
              Inject VIN telemetry for real-time buy/pass intelligence guidace
            </p>
          </div>

          <GlassCard className="p-8 sm:p-12">
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest text-left flex items-start gap-3">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Serial (VIN)</label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="1HGCV1F3..."
                    maxLength={17}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wear Factor (Mileage)</label>
                <div className="relative group">
                  <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  <input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                onClick={() => handleScan()}
                disabled={vin.length !== 17 || loading}
                className="w-full bg-primary-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:shadow-glow-primary transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20 group"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                {loading ? 'Synthesizing...' : 'Execute Analysis'}
              </button>

              <div className="pt-8 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-4">
                {[
                  { icon: ShieldCheck, text: 'Confidence Score' },
                  { icon: Database, text: 'Market Delta' },
                  { icon: DollarSign, text: 'Profit Matrix' },
                  { icon: LayoutDashboard, text: 'Competitor Intel' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 opacity-50">
                    <item.icon size={12} className="text-primary-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <Link to="/dashboard" className="inline-flex items-center gap-2 mt-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-500 transition-colors">
            <ArrowRight size={14} className="rotate-180" />
            Abort to Deck
          </Link>
        </div>
      </div>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
