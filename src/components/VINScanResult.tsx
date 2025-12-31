import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import ProfitCalculator from './ProfitCalculator';
import { supabase } from '../lib/supabase';
import { VehicleCommentSection } from './VehicleCommentSection';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// Helper function to simplify body types to Sedan, SUV, Pickup, or hide if not matching
function getSimplifiedBodyType(bodyType: string | undefined): string {
    if (!bodyType) return '';

    const normalized = bodyType.toLowerCase();

    // Map to Sedan
    if (normalized.includes('sedan') || normalized.includes('coupe')) {
        return 'Sedan';
    }

    // Map to SUV
    if (normalized.includes('suv') || normalized.includes('crossover') ||
        normalized.includes('wagon') || normalized.includes('mpv') ||
        normalized.includes('van') || normalized.includes('minivan')) {
        return 'SUV';
    }

    // Map to Pickup
    if (normalized.includes('pickup') || normalized.includes('truck')) {
        return 'Pickup';
    }

    // If doesn't match any category, return empty string (hide it)
    return '';
}

interface VINScanResultProps {
    scanData: {
        id?: string; // scan_id
        decoded_data: any;
        market_data: any;
        recommendation: 'buy' | 'caution' | 'pass';
        confidence_score: number;
        match_reasoning: any[];
        estimated_profit: number | null;
        max_bid_suggestion: number | null;
        estimated_days_to_sale?: number | null;
        radius?: number; // The radius used for the search
    };
    onClose?: () => void;
    onScanAnother?: () => void;
    isModal?: boolean;
    costSettings?: any; // Pass cost settings if available
    tenantZipCode?: string | null;
    onRescan?: (radius: number) => Promise<void>; // NEW: Handler for expanding search
    onEditStatusChange?: (isEditing: boolean) => void;
    onOutsideClick?: () => void;
}

export default function VINScanResult({
    scanData,
    onClose,
    onScanAnother,
    isModal = false,
    costSettings,
    tenantZipCode,
    onRescan,
    onEditStatusChange,
    onOutsideClick,
}: VINScanResultProps) {
    const { user } = useAuth();
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSuccess, setReportSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reasoningExpanded, setReasoningExpanded] = useState(false);
    const [isExpandingSearch, setIsExpandingSearch] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentRecommendation, setCurrentRecommendation] = useState(scanData.recommendation);

    useEffect(() => {
        setCurrentRecommendation(scanData.recommendation);
    }, [scanData.recommendation]);

    const handleUpdateRecommendation = async (newRec: 'buy' | 'caution' | 'pass') => {
        if (!scanData.id) return;

        setIsSaving(true);
        try {
            setCurrentRecommendation(newRec);
            const { error: updateError } = await supabase
                .from('vin_scans')
                .update({ recommendation: newRec })
                .eq('id', scanData.id);

            if (updateError) throw updateError;
            toast.success(`Recommendation changed to ${newRec.toUpperCase()}`);
        } catch (err: any) {
            console.error('Error updating recommendation:', err);
            toast.error('Failed to update recommendation');
            setCurrentRecommendation(scanData.recommendation);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReportMissingData = async () => {
        if (!scanData?.decoded_data) return;

        setReportLoading(true);
        try {
            const { SupportService } = await import('../services/support');
            await SupportService.createTicket({
                type: 'missing_market_data',
                subject: `Missing Pricing: ${scanData.decoded_data.year} ${scanData.decoded_data.make} ${scanData.decoded_data.model}`,
                details: {
                    vin: scanData.decoded_data.vin || '', // Assuming VIN is in decoded_data or passed separately. It's usually in decoded_data.
                    decoded_data: scanData.decoded_data,
                    mileage: scanData.decoded_data.mileage
                },
                priority: 'medium'
            });
            setReportSuccess(true);
        } catch (err) {
            console.error('Failed to report issue:', err);
            setError('Failed to submit report. Please try again.');
        } finally {
            setReportLoading(false);
        }
    };

    const handleExpandSearch = async () => {
        if (!onRescan) return;

        setIsExpandingSearch(true);
        setError(null);
        try {
            await onRescan(500); // Expand to 500 miles
        } catch (err) {
            console.error('Failed to expand search:', err);
            setError('Failed to expand search. Please try again.');
        } finally {
            setIsExpandingSearch(false);
        }
    };

    // Default cost settings if not provided (though ideally they should be passed)
    const defaultCostSettings = costSettings || {
        auction_fee_thresholds: [
            { min_price: 0, max_price: 5000, fee: 200 },
            { min_price: 5000, max_price: 10000, fee: 350 },
            { min_price: 10000, max_price: 999999, fee: 500 },
        ],
        reconditioning_cost: 800,
        transport_cost: 150,
    };

    return (
        <div className={`bg-gray-50 ${isModal ? 'p-0' : 'min-h-screen'}`}>
            <div className={`${isModal ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
                {/* Vehicle Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {scanData.decoded_data.year} {scanData.decoded_data.make} {scanData.decoded_data.model}
                            </h2>
                            <p className="text-gray-600">
                                {scanData.decoded_data.trim}
                                {scanData.decoded_data.trim && getSimplifiedBodyType(scanData.decoded_data.body_type) && ' • '}
                                {getSimplifiedBodyType(scanData.decoded_data.body_type)}
                            </p>
                            {/* If VIN is available in decoded_data, show it. Otherwise it might be in the parent object but we didn't pass it explicitly in the interface above except inside decoded_data potentially */}
                            {/* We can assume decoded_data has what we need or pass vin separately if needed. For now, let's rely on what's there. */}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div
                                className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${currentRecommendation === 'buy'
                                    ? 'bg-green-100 text-green-800'
                                    : currentRecommendation === 'caution'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                            >
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {currentRecommendation === 'buy' && '🟢 Strong Buy'}
                                {currentRecommendation === 'caution' && '🟡 Caution'}
                                {currentRecommendation === 'pass' && '🔴 Pass'}
                            </div>

                            {/* Manual Override Controls */}
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleUpdateRecommendation('buy')}
                                    className={`text-[10px] px-2 py-1 rounded border transition ${currentRecommendation === 'buy' ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Buy
                                </button>
                                <button
                                    onClick={() => handleUpdateRecommendation('caution')}
                                    className={`text-[10px] px-2 py-1 rounded border transition ${currentRecommendation === 'caution' ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Caution
                                </button>
                                <button
                                    onClick={() => handleUpdateRecommendation('pass')}
                                    className={`text-[10px] px-2 py-1 rounded border transition ${currentRecommendation === 'pass' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Pass
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {scanData.decoded_data.mileage && (
                            <div>
                                <p className="text-gray-600">Mileage</p>
                                <p className="font-semibold">{scanData.decoded_data.mileage.toLocaleString()} mi</p>
                            </div>
                        )}
                        <div>
                            <p className="text-gray-600">Title Status</p>
                            <p className="font-semibold capitalize">{scanData.decoded_data.title_status || 'Unknown'}</p>
                        </div>
                        {scanData.decoded_data.owner_count !== undefined && (
                            <div>
                                <p className="text-gray-600">Owners</p>
                                <p className="font-semibold">{scanData.decoded_data.owner_count}</p>
                            </div>
                        )}
                        {scanData.decoded_data.accident_count !== undefined && (
                            <div>
                                <p className="text-gray-600">Accidents</p>
                                <p className="font-semibold">{scanData.decoded_data.accident_count}</p>
                            </div>
                        )}
                        {scanData.estimated_days_to_sale !== undefined && (
                            <div>
                                <p className="text-gray-600">Est. Days to Sale</p>
                                <p className="font-semibold">{scanData.estimated_days_to_sale ? `${scanData.estimated_days_to_sale} days` : 'N/A'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Market Context - Moved up */}
                {scanData.market_data ? (
                    <>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <h4 className="font-semibold text-blue-900 mb-2">📊 Market Context</h4>
                            <div className="text-sm text-blue-800 space-y-1">
                                <p>
                                    • Average Market Price: ${scanData.market_data.averagePrice.toLocaleString()} (
                                    {scanData.market_data.dataSource === 'estimated' ? 'estimated' : 'from real listings'})
                                </p>
                                <p>
                                    • Price Range: ${scanData.market_data.minPrice.toLocaleString()} - $
                                    {scanData.market_data.maxPrice.toLocaleString()}
                                </p>
                                <p>
                                    • Cheapest Listing: ${scanData.market_data.minPrice.toLocaleString()} (Within {scanData.market_data.radius || 100} Miles)
                                </p>
                            </div>
                        </div>

                        {/* Show warning and expand button if limited data */}
                        {scanData.market_data.listingsCount < 5 && onRescan && (scanData.market_data.radius || scanData.radius || 0) < 500 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-yellow-900 mb-1">⚠️ Limited Market Data</h4>
                                        <p className="text-sm text-yellow-800">
                                            Found only {scanData.market_data.listingsCount} listing(s) within {scanData.market_data.radius || scanData.radius || 100} miles.
                                            Expand to 500 miles for more results?
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleExpandSearch}
                                        disabled={isExpandingSearch}
                                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center whitespace-nowrap"
                                    >
                                        {isExpandingSearch ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Searching...
                                            </>
                                        ) : (
                                            'Expand Search to 500 Miles'
                                        )}
                                    </button>
                                </div>

                                {/* Show individual listings when <5 found */}
                                {scanData.market_data.listings && scanData.market_data.listings.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-yellow-300">
                                        <p className="font-semibold text-sm text-yellow-900 mb-2">Available Listings:</p>
                                        <div className="space-y-2">
                                            {scanData.market_data.listings.slice(0, 3).map((listing: any, idx: number) => (
                                                <div key={idx} className="bg-white border border-yellow-200 rounded p-3 text-sm">
                                                    <div className="font-semibold text-gray-900">
                                                        {listing.title || `${scanData.decoded_data.year} ${scanData.decoded_data.make} ${scanData.decoded_data.model}`}
                                                    </div>
                                                    <div className="text-gray-600 mt-1">
                                                        ${listing.price?.toLocaleString()} • {listing.miles?.toLocaleString()} mi
                                                        {listing.distance && ` • ${Math.round(listing.distance)} mi away`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6 text-center">
                        <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />

                        {!tenantZipCode ? (
                            <>
                                <h3 className="text-lg font-bold text-yellow-900 mb-2">Missing ZIP Code</h3>
                                <p className="text-yellow-800 mb-6">
                                    Please configure your location in <a href="/settings" className="underline font-bold hover:text-yellow-900">Settings</a> to get accurate market data.
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold text-yellow-900 mb-2">Market Data Unavailable</h3>
                                <p className="text-yellow-800 mb-6">
                                    We couldn't find any market data for this specific vehicle configuration in your area.
                                    This can happen with rare trims or very new inventory.
                                </p>

                                {/* Show expand button if onRescan available and not already expanded */}
                                {onRescan && !isExpandingSearch && (scanData.market_data?.radius || scanData.radius || 0) < 500 && (
                                    <button
                                        onClick={handleExpandSearch}
                                        className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center justify-center mx-auto mb-4"
                                    >
                                        Expand Search to 500 Miles
                                    </button>
                                )}

                                {isExpandingSearch && (
                                    <div className="flex items-center justify-center mb-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
                                        <span className="ml-2 text-yellow-800">Searching wider area...</span>
                                    </div>
                                )}

                                {reportSuccess ? (
                                    <div className="bg-green-100 text-green-800 p-4 rounded-lg flex items-center justify-center">
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Report submitted successfully! Our team will investigate.
                                    </div>
                                ) : (
                                    // Only show report button if search was already expanded to 500 miles OR if onRescan is not available
                                    ((scanData.market_data?.radius || scanData.radius || 0) >= 500 || !onRescan) && (
                                        <button
                                            onClick={handleReportMissingData}
                                            disabled={reportLoading}
                                            className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center justify-center mx-auto"
                                        >
                                            {reportLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                            Report Missing Data to Support
                                        </button>
                                    )
                                )}
                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                                        {error}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Profit Calculator */}
                <ProfitCalculator
                    maxBidSuggestion={scanData.max_bid_suggestion || 0}
                    marketPrice={scanData.market_data?.averagePrice || 0}
                    auctionFeeThresholds={defaultCostSettings.auction_fee_thresholds || []}
                    defaultRecon={defaultCostSettings.reconditioning_cost}
                    defaultTransport={defaultCostSettings.transport_cost}
                    onCostsChange={async (costs) => {
                        // Save custom costs to database if scan_id exists and costs were edited
                        if (scanData.id && costs.costsEdited) {
                            setIsSaving(true);
                            try {
                                const { error: saveError } = await supabase
                                    .from('vin_scans')
                                    .update({
                                        custom_recon_cost: costs.recon,
                                        custom_transport_cost: costs.transport,
                                        custom_max_bid: costs.maxBid,
                                        custom_market_price: costs.marketPrice,
                                        costs_edited: true,
                                    })
                                    .eq('id', scanData.id);

                                if (saveError) throw saveError;
                            } catch (error) {
                                console.error('Error saving custom costs:', error);
                                toast.error('Failed to save costs');
                            } finally {
                                setIsSaving(false);
                            }
                        }
                    }}
                    onEditStatusChange={onEditStatusChange}
                    onOutsideClick={onOutsideClick}
                    isSaving={isSaving}
                />

                {/* Match Reasoning - Moved to bottom with collapsible */}
                {scanData.market_data && scanData.match_reasoning && scanData.match_reasoning.length > 0 && (
                    <div className="mt-6">
                        <button
                            onClick={() => setReasoningExpanded(!reasoningExpanded)}
                            className={`w-full rounded-lg p-4 text-left transition-colors ${scanData.recommendation === 'buy'
                                ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                                : scanData.recommendation === 'caution'
                                    ? 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
                                    : 'bg-red-50 border border-red-200 hover:bg-red-100'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">
                                    {scanData.recommendation === 'buy' && '✅ Why This is a Strong Match'}
                                    {scanData.recommendation === 'caution' && '⚠️ Why Caution is Advised'}
                                    {scanData.recommendation === 'pass' && '❌ Why You Should Pass'}
                                </h3>
                                {reasoningExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-gray-600" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-gray-600" />
                                )}
                            </div>
                        </button>
                        {reasoningExpanded && (
                            <div
                                className={`rounded-b-lg p-4 border-x border-b ${scanData.recommendation === 'buy'
                                    ? 'bg-green-50 border-green-200'
                                    : scanData.recommendation === 'caution'
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : 'bg-red-50 border-red-200'
                                    }`}
                            >
                                <div className="space-y-2">
                                    {scanData.match_reasoning.map((reason: any, index: number) => (
                                        <div key={index} className="flex items-start">
                                            {reason.type === 'positive' ? (
                                                <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                                            ) : reason.type === 'negative' ? (
                                                <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                                            )}
                                            <span className="text-gray-700">{reason.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Comments & Auction Source */}
                {scanData.id && user?.tenant_id && (
                    <div className="mt-6">
                        <VehicleCommentSection
                            vinScanId={scanData.id}
                            tenantId={user.tenant_id}
                        />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 mt-6">
                    {onScanAnother && (
                        <button
                            onClick={onScanAnother}
                            className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
                        >
                            Scan Another VIN
                        </button>
                    )}
                    {!isModal && (
                        onClose ? (
                            <button
                                onClick={onClose}
                                className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition"
                            >
                                Close
                            </button>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/recommendations'} // Redirect to recommendations page
                                className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition"
                            >
                                View All Recommendations
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
