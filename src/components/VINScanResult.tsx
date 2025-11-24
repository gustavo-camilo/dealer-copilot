import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import ProfitCalculator from './ProfitCalculator';
import { supabase } from '../lib/supabase';

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
    };
    onClose?: () => void;
    onScanAnother?: () => void;
    isModal?: boolean;
    costSettings?: any; // Pass cost settings if available, otherwise defaults will be used in ProfitCalculator (though we might want to pass them down)
    tenantZipCode?: string | null;
}

export default function VINScanResult({
    scanData,
    onClose,
    onScanAnother,
    isModal = false,
    costSettings,
    tenantZipCode,
}: VINScanResultProps) {
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSuccess, setReportSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    // Default cost settings if not provided (though ideally they should be passed)
    const defaultCostSettings = costSettings || {
        auction_fee_percent: 2,
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
                                {scanData.decoded_data.trim && `${scanData.decoded_data.trim} • `}
                                {scanData.decoded_data.body_type}
                            </p>
                            {/* If VIN is available in decoded_data, show it. Otherwise it might be in the parent object but we didn't pass it explicitly in the interface above except inside decoded_data potentially */}
                            {/* We can assume decoded_data has what we need or pass vin separately if needed. For now, let's rely on what's there. */}
                        </div>
                        <div
                            className={`px-4 py-2 rounded-lg font-semibold ${scanData.recommendation === 'buy'
                                ? 'bg-green-100 text-green-800'
                                : scanData.recommendation === 'caution'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                        >
                            {scanData.recommendation === 'buy' && '🟢 STRONG BUY'}
                            {scanData.recommendation === 'caution' && '🟡 PROCEED WITH CAUTION'}
                            {scanData.recommendation === 'pass' && '🔴 PASS'}
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
                        <div>
                            <p className="text-gray-600">Confidence Score</p>
                            <p className="font-semibold">{scanData.confidence_score}%</p>
                        </div>
                        {scanData.estimated_days_to_sale !== undefined && (
                            <div>
                                <p className="text-gray-600">Est. Days to Sale</p>
                                <p className="font-semibold">{scanData.estimated_days_to_sale ? `${scanData.estimated_days_to_sale} days` : 'N/A'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Match Reasoning */}
                {scanData.market_data && (
                    <div
                        className={`rounded-lg p-6 mb-6 ${scanData.recommendation === 'buy'
                            ? 'bg-green-50 border border-green-200'
                            : scanData.recommendation === 'caution'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : 'bg-red-50 border border-red-200'
                            }`}
                    >
                        <h3 className="font-bold text-gray-900 mb-3">
                            {scanData.recommendation === 'buy' && '✅ Why This is a Strong Match'}
                            {scanData.recommendation === 'caution' && '⚠️ Proceed Carefully - Here\'s Why'}
                            {scanData.recommendation === 'pass' && '❌ Why You Should Pass'}
                        </h3>
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

                {/* Profit Calculator */}
                <ProfitCalculator
                    maxBidSuggestion={scanData.max_bid_suggestion || 0}
                    marketPrice={scanData.market_data?.averagePrice || 0}
                    defaultAuctionFee={defaultCostSettings.auction_fee_percent}
                    defaultRecon={defaultCostSettings.reconditioning_cost}
                    defaultTransport={defaultCostSettings.transport_cost}
                    onCostsChange={async (costs) => {
                        // Save custom costs to database if scan_id exists and costs were edited
                        if (scanData.id && costs.costsEdited) {
                            try {
                                await supabase
                                    .from('vin_scans')
                                    .update({
                                        custom_auction_fee_percent: costs.auctionFee,
                                        custom_recon_cost: costs.recon,
                                        custom_transport_cost: costs.transport,
                                        custom_max_bid: costs.maxBid,
                                        custom_market_price: costs.marketPrice,
                                        costs_edited: true,
                                    })
                                    .eq('id', scanData.id);
                            } catch (error) {
                                console.error('Error saving custom costs:', error);
                            }
                        }
                    }}
                />

                {/* Market Context */}
                {scanData.market_data ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
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
                            <p>• Data Confidence: {scanData.market_data.confidence}%</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6 text-center">
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
                                    We couldn't find sufficient market data for this specific vehicle configuration in your area.
                                    This can happen with rare trims or very new inventory.
                                </p>

                                {reportSuccess ? (
                                    <div className="bg-green-100 text-green-800 p-4 rounded-lg flex items-center justify-center">
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Report submitted successfully! Our team will investigate.
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleReportMissingData}
                                        disabled={reportLoading}
                                        className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center justify-center mx-auto"
                                    >
                                        {reportLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                        Report Missing Data to Support
                                    </button>
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
