import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useBlocker } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Scan, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { decodeVIN, enrichDecodedData } from '../services/vinDecoder';
import { getMarketPricing, calculateMaxBid } from '../services/marketPricing';
import { generateRecommendation } from '../services/recommendationEngine';
import VINScanResult from '../components/VINScanResult';
import Header from '../components/Header';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { Button, Input } from '../components/ui';
import { VinPlate } from '../components/scan/VinPlate';

const SCAN_STEPS = ['Decoding VIN…', 'Pulling market comps…', 'Calculating true cost…'];

/** Cycles through the real pipeline steps while a scan runs. */
function ScanProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 1400);
    return () => clearInterval(id);
  }, []);
  return <span aria-live="polite">{SCAN_STEPS[step]}</span>;
}
import { SalesRecord, TenantCostSettings } from '../types/database';

// Default cost settings if tenant hasn't configured them
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

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditingCosts) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditingCosts]);

  // Handle in-app navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isEditingCosts && currentLocation.pathname !== nextLocation.pathname
  );

  const handleConfirmNavigation = () => {
    if (blocker.state === 'blocked') {
      blocker.proceed?.();
    }
  };

  const handleCancelNavigation = () => {
    if (blocker.state === 'blocked') {
      scanResultRef.current?.saveCosts();
      setIsEditingCosts(false);
      blocker.reset?.();
    }
  };

  const costSettings = tenant?.cost_settings || DEFAULT_COST_SETTINGS;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };



  const handleScan = async (customRadius?: number) => {
    if (!vin || !user?.tenant_id) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Decode VIN
      const decodedResult = await decodeVIN(vin);

      if (!decodedResult.success || !decodedResult.data) {
        setError(decodedResult.error || 'Failed to decode VIN');
        setLoading(false);
        return;
      }

      // Enrich with user-provided mileage
      const enrichedData = enrichDecodedData(decodedResult.data, {
        mileage: mileage ? parseInt(mileage) : undefined,
      });

      // Step 2: Get market pricing
      // Enforce tenant zip code
      if (!tenant?.zip_code) {
        setError(
          <span>
            Missing ZIP Code. Please configure your location in{' '}
            <Link to="/settings" className="underline font-bold hover:text-red-900">
              Settings
            </Link>{' '}
            to get accurate market data.
          </span> as any
        );
        setLoading(false);
        return;
      }

      const marketData = await getMarketPricing(enrichedData, tenant.zip_code, customRadius || 100);

      // If no market data, we still proceed but with limited info
      if (!marketData) {
        console.warn('Market data unavailable, proceeding with limited analysis');
      }

      // Step 3: Get dealer's sales history for this vehicle type
      const { data: salesHistory, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('sale_date', { ascending: false })
        .limit(100);

      if (salesError) {
        console.error('Error fetching sales history:', salesError);
      }

      const salesRecords: SalesRecord[] = salesHistory || [];

      // Step 4: Calculate max bid
      const maxBid = marketData ? calculateMaxBid(
        marketData.averagePrice,
        costSettings.target_margin_percent,
        costSettings.auction_fee_thresholds || [],
        costSettings.reconditioning_cost,
        costSettings.transport_cost
      ) : 0;

      // Step 5: Generate recommendation
      const recommendation = await generateRecommendation(
        enrichedData,
        marketData,
        salesRecords,
        maxBid,
        costSettings.target_margin_percent
      );

      // Step 6: Save scan to database
      const { data: scanData, error: scanError } = await supabase
        .from('vin_scans')
        .insert({
          tenant_id: user.tenant_id,
          user_id: user.id,
          vin: vin,
          decoded_data: enrichedData,
          recommendation: recommendation.recommendation,
          confidence_score: recommendation.confidenceScore,
          match_reasoning: recommendation.matchReasons,
          estimated_profit: recommendation.estimatedProfit,
          max_bid_suggestion: recommendation.maxBidSuggestion,
          market_data: marketData, // Save market data for history
          saved_to_bid_list: false,
          // Initialize custom costs as null - will be set if user edits
          custom_auction_fee_percent: null,
          custom_recon_cost: null,
          custom_transport_cost: null,
          custom_max_bid: null,
          custom_market_price: null,
          costs_edited: false,
        })
        .select()
        .single();

      if (scanError) {
        console.error('Error saving scan:', scanError);
        // Don't fail the whole process if save fails
      }

      // Display results
      setResult({
        decoded_data: enrichedData,
        recommendation: recommendation.recommendation,
        confidence_score: recommendation.confidenceScore,
        match_reasoning: recommendation.matchReasons,
        estimated_profit: recommendation.estimatedProfit,
        max_bid_suggestion: recommendation.maxBidSuggestion,
        estimated_days_to_sale: recommendation.estimatedDaysToSale,
        market_data: marketData,
        scan_id: scanData?.id,
        radius: customRadius || 100,
      });
    } catch (error) {
      console.error('Error scanning VIN:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async (radius: number) => {
    if (!result?.decoded_data || !user?.tenant_id || !tenant?.zip_code) return;

    setLoading(true);

    try {
      // Re-fetch market data with new radius
      const marketData = await getMarketPricing(result.decoded_data, tenant.zip_code, radius);

      // Recalculate max bid with new market data
      const maxBid = marketData ? calculateMaxBid(
        marketData.averagePrice,
        costSettings.target_margin_percent,
        costSettings.auction_fee_thresholds || [],
        costSettings.reconditioning_cost,
        costSettings.transport_cost
      ) : 0;

      // Fetch sales history again for recommendation
      const { data: salesHistory } = await supabase
        .from('sales_records')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('sale_date', { ascending: false })
        .limit(100);

      const salesRecords: SalesRecord[] = salesHistory || [];

      // Re-generate recommendation with new market data
      const recommendation = await generateRecommendation(
        result.decoded_data,
        marketData,
        salesRecords,
        maxBid,
        costSettings.target_margin_percent
      );

      // If expansion returns NO results but we ALREADY HAD results, 
      // something probably went wrong with the wider search (API limit or error).
      // We should keep the previous results instead of showing nothing.
      if ((!marketData || marketData.listingsCount === 0) && result.market_data?.listingsCount > 0) {
        toast.error(`No additional vehicles found within ${radius} miles. Keeping previous results.`);
        setResult({
          ...result,
          radius: radius, // Mark as expanded so we don't ask again
        });
        setLoading(false);
        return;
      }

      // Update result with new market data
      setResult({
        ...result,
        market_data: marketData,
        max_bid_suggestion: recommendation.maxBidSuggestion,
        estimated_profit: recommendation.estimatedProfit,
        recommendation: recommendation.recommendation,
        confidence_score: recommendation.confidenceScore,
        match_reasoning: recommendation.matchReasons,
        estimated_days_to_sale: recommendation.estimatedDaysToSale,
        radius: radius,
      });

      // Update database with new market data if scan_id exists
      if (result.scan_id) {
        await supabase
          .from('vin_scans')
          .update({
            market_data: marketData,
            max_bid_suggestion: recommendation.maxBidSuggestion,
            estimated_profit: recommendation.estimatedProfit,
            recommendation: recommendation.recommendation,
            confidence_score: recommendation.confidenceScore,
            match_reasoning: recommendation.matchReasons,
          })
          .eq('id', result.scan_id);
      }
    } catch (error) {
      console.error('Error rescanning with expanded radius:', error);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-canvas">
        {/* Header */}
        <Header
          user={user}
          tenant={tenant}
          signOut={handleSignOut}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onScanVinClick={() => {
            if (isEditingCosts) {
              setPendingReset(true);
            } else {
              resetScan();
            }
          }}
        />

        <VINScanResult
          scanData={{
            id: result.scan_id,
            decoded_data: result.decoded_data,
            market_data: result.market_data,
            recommendation: result.recommendation,
            confidence_score: result.confidence_score,
            match_reasoning: result.match_reasoning,
            estimated_profit: result.estimated_profit,
            max_bid_suggestion: result.max_bid_suggestion,
            estimated_days_to_sale: result.estimated_days_to_sale,
            radius: result.radius,
            custom_recon_cost: result.custom_recon_cost,
            custom_transport_cost: result.custom_transport_cost,
            custom_max_bid: result.custom_max_bid,
            custom_market_price: result.custom_market_price,
          }}
          costSettings={costSettings}
          tenantZipCode={tenant?.zip_code}
          onRescan={handleRescan}
          onScanAnother={() => {
            setResult(null);
            setVin('');
            setMileage('');
            setError(null);
            setIsEditingCosts(false);
          }}
          onEditStatusChange={setIsEditingCosts}
          onOutsideClick={() => setPendingReset(true)}
          ref={scanResultRef}
          isEditing={isEditingCosts}
        />

        {/* Navigation Warning Dialog */}
        <ConfirmationDialog
          isOpen={blocker.state === 'blocked'}
          onConfirm={handleConfirmNavigation}
          onCancel={handleCancelNavigation}
          confirmLabel="Leave & Discard"
          cancelLabel="Save and Stay"
        />

        {/* Discard Changes Warning Dialog (for clicks and resets) */}
        <ConfirmationDialog
          isOpen={pendingReset}
          onConfirm={resetScan}
          onCancel={() => {
            scanResultRef.current?.saveCosts();
            setIsEditingCosts(false);
            setPendingReset(false);
          }}
          confirmLabel="Discard & Scan Another"
          cancelLabel="Save and Stay"
          message="You have unsaved changes in the profit calculator. How would you like to proceed?"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <Header
        user={user}
        tenant={tenant}
        signOut={handleSignOut}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onScanVinClick={() => {
          if (isEditingCosts) {
            setPendingReset(true);
          } else {
            resetScan();
          }
        }}
      />

      <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-14">
        <div className="mb-7 animate-enter text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-[0_12px_28px_-10px_rgb(249_115_22/0.8)]">
            <Scan className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Scan a VIN</h1>
          <p className="mt-1.5 text-sm text-ink-muted">True cost, max bid and a clear buy / pass verdict.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (vin.length === 17 && !loading) handleScan();
          }}
          className="animate-enter space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6"
          style={{ animationDelay: '60ms' }}
        >
          {error && (
            <div role="alert" className="rounded-2xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          <VinPlate value={vin} onChange={setVin} scanning={loading} disabled={loading} />

          <Input
            label={
              <>
                Mileage <span className="font-normal text-ink-subtle">(optional)</span>
              </>
            }
            type="number"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 45000"
            hint="Adding mileage sharpens the recommendation."
            disabled={loading}
          />

          <Button type="submit" size="lg" block loading={loading} disabled={vin.length !== 17}>
            {loading ? <ScanProgress /> : 'Analyze vehicle'}
          </Button>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-5 text-xs text-ink-muted">
            {['Full decode & specs', 'Live market pricing', 'Buy / Maybe / Pass', 'Profit with your costs'].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </form>
      </main>
    </div>
  );
}
