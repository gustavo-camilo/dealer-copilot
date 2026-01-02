import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, ChevronDown as ChevronDownIcon, Car, Target, ShieldCheck, Database, TrendingUp, AlertTriangle, X } from 'lucide-react';
import ProfitCalculator from './ProfitCalculator';
import { supabase } from '../lib/supabase';
import { VehicleCommentSection } from './VehicleCommentSection';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import GlassCard from './ui/GlassCard';

function getSimplifiedBodyType(bodyType: string | undefined): string {
    if (!bodyType) return '';
    const normalized = bodyType.toLowerCase();
    if (normalized.includes('sedan') || normalized.includes('coupe')) return 'Sedan';
    if (normalized.includes('suv') || normalized.includes('crossover') || normalized.includes('wagon') || normalized.includes('mpv') || normalized.includes('van') || normalized.includes('minivan')) return 'SUV';
    if (normalized.includes('pickup') || normalized.includes('truck')) return 'Pickup';
    return '';
}

interface VINScanResultProps {
    scanData: {
        id?: string;
        decoded_data: any;
        market_data: any;
        recommendation: 'buy' | 'caution' | 'pass';
        confidence_score: number;
        match_reasoning: any[];
        estimated_profit: number | null;
        max_bid_suggestion: number | null;
        estimated_days_to_sale?: number | null;
        radius?: number;
        custom_recon_cost?: number | null;
        custom_transport_cost?: number | null;
        custom_max_bid?: number | null;
        custom_market_price?: number | null;
    };
    onClose?: () => void;
    onScanAnother?: () => void;
    isModal?: boolean;
    costSettings?: any;
    tenantZipCode?: string | null;
    onRescan?: (radius: number) => Promise<void>;
    onEditStatusChange?: (isEditing: boolean) => void;
    onOutsideClick?: () => void;
    isEditing?: boolean;
}

const VINScanResult = forwardRef<{ saveCosts: () => void }, VINScanResultProps>(({
    scanData, onClose, onScanAnother, isModal = false, costSettings, tenantZipCode, onRescan, onEditStatusChange, onOutsideClick, isEditing = false,
}, ref) => {
    const { user } = useAuth();
    const calculatorRef = useRef<{ save: () => void }>(null);

    useImperativeHandle(ref, () => ({ saveCosts: () => { calculatorRef.current?.save(); } }));
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSuccess, setReportSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reasoningExpanded, setReasoningExpanded] = useState(false);
    const [isExpandingSearch, setIsExpandingSearch] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentRecommendation, setCurrentRecommendation] = useState(scanData.recommendation);

    const handleSaveCosts = async (costs: { recon: number; transport: number; maxBid: number; marketPrice: number }) => {
        if (!scanData.id) return;
        setIsSaving(true);
        try {
            await supabase.from('vin_scans').update({ custom_recon_cost: costs.recon, custom_transport_cost: costs.transport, custom_max_bid: costs.maxBid, custom_market_price: costs.marketPrice, costs_edited: true }).eq('id', scanData.id);
            toast.success('Cost matrix calibrated');
        } catch (e) { toast.error('Calibration failed'); } finally { setIsSaving(false); }
    };

    useEffect(() => { setCurrentRecommendation(scanData.recommendation); }, [scanData.recommendation]);

    const handleUpdateRecommendation = async (newRec: 'buy' | 'caution' | 'pass') => {
        if (!scanData.id) return;
        setIsSaving(true);
        try {
            setCurrentRecommendation(newRec);
            await supabase.from('vin_scans').update({ recommendation: newRec }).eq('id', scanData.id);
            toast.success(`Protocol ${newRec.toUpperCase()} activated`);
        } catch (e) { toast.error('Protocol update failed'); setCurrentRecommendation(scanData.recommendation); } finally { setIsSaving(false); }
    };

    const handleReportMissingData = async () => {
        if (!scanData?.decoded_data) return;
        setReportLoading(true);
        try {
            const { SupportService } = await import('../services/support');
            await SupportService.createTicket({ type: 'missing_market_data', subject: `Missing Pricing: ${scanData.decoded_data.year} ${scanData.decoded_data.make} ${scanData.decoded_data.model}`, details: { vin: scanData.decoded_data.vin || '', decoded_data: scanData.decoded_data, mileage: scanData.decoded_data.mileage }, priority: 'medium' });
            setReportSuccess(true);
        } catch (e) { setError('Support ticket injection failed'); } finally { setReportLoading(false); }
    };

    const handleExpandSearch = async () => {
        if (!onRescan) return;
        setIsExpandingSearch(true); setError(null);
        try { await onRescan(500); } catch (e) { setError('Search expansion failed'); } finally { setIsExpandingSearch(false); }
    };

    const defaultCostSettings = costSettings || { auction_fee_thresholds: [{ min_price: 0, max_price: 5000, fee: 200 }, { min_price: 5000, max_price: 10000, fee: 350 }, { min_price: 10000, max_price: 999999, fee: 500 }], reconditioning_cost: 800, transport_cost: 150 };

    const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

    return (
        <div className={`bg-transparent ${isModal ? 'p-0' : 'min-h-screen py-12'}`}>
            <div className={`${isModal ? 'p-8' : 'max-w-5xl mx-auto px-6'}`}>
                {/* Asset Identity Card */}
                <GlassCard className="p-8 mb-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Car size={180} />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Database size={14} className="text-primary-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Validated Registry Entry</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
                                {scanData.decoded_data.year} {scanData.decoded_data.make} <span className="text-primary-500">{scanData.decoded_data.model}</span>
                            </h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">
                                {scanData.decoded_data.trim || 'Standard Protocol'} {getSimplifiedBodyType(scanData.decoded_data.body_type) && ` • ${getSimplifiedBodyType(scanData.decoded_data.body_type)}`}
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-4 min-w-[240px]">
                            <div className="text-right">
                                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Acquisition Protocol</div>
                                <select
                                    value={currentRecommendation || ''}
                                    onChange={(e) => handleUpdateRecommendation(e.target.value as any)}
                                    className={`w-full appearance-none px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border-2 transition-all cursor-pointer text-center
                                    ${currentRecommendation === 'buy' ? 'bg-primary-500 border-primary-500 text-white shadow-glow-primary' :
                                            currentRecommendation === 'caution' ? 'bg-secondary-500 border-secondary-500 text-white shadow-glow-secondary' :
                                                'bg-red-500 border-red-500 text-white shadow-red-500/20'}`}
                                >
                                    <option value="buy">🟢 Buy Protocol</option>
                                    <option value="caution">🟡 Caution Protocol</option>
                                    <option value="pass">🔴 Pass Protocol</option>
                                </select>
                            </div>
                            <div className="text-right">
                                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Confidence Matrix</div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{scanData.confidence_score}%</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12 pt-8 border-t border-slate-100 dark:border-white/5">
                        {[
                            { label: 'Odometer Index', value: scanData.decoded_data.mileage ? `${scanData.decoded_data.mileage.toLocaleString()} mi` : 'N/A' },
                            { label: 'Registry Status', value: scanData.decoded_data.title_status || 'Unverified' },
                            { label: 'Ownership History', value: scanData.decoded_data.owner_count?.toString() || 'N/A' },
                            { label: 'Incident Registry', value: scanData.decoded_data.accident_count?.toString() || '0' },
                        ].map((stat, i) => (
                            <div key={i}>
                                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">{stat.label}</div>
                                <div className="text-sm font-black text-slate-900 dark:text-white uppercase italic">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <div className="grid lg:grid-cols-3 gap-8 mb-8">
                    {/* Market Delta Card */}
                    <GlassCard className="lg:col-span-1 p-6 border-primary-500/20">
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp size={16} className="text-primary-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white italic">Market Delta</h4>
                        </div>
                        {scanData.market_data ? (
                            <div className="space-y-6">
                                <div>
                                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Mean Retail</div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(scanData.market_data.averagePrice)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Floor</div>
                                        <div className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatCurrency(scanData.market_data.minPrice)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Ceiling</div>
                                        <div className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatCurrency(scanData.market_data.maxPrice)}</div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Search Radius</div>
                                    <div className="text-[10px] font-black text-primary-500">{scanData.market_data.radius || 100} MILES</div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center bg-yellow-500/5 rounded-2xl border border-dashed border-yellow-500/20">
                                <AlertTriangle size={24} className="text-yellow-500 mx-auto mb-3" />
                                <div className="text-[8px] font-black uppercase tracking-widest text-yellow-500">Telemetry Missing</div>
                            </div>
                        )}
                    </GlassCard>

                    {/* Reasoning Protocol */}
                    <div className="lg:col-span-2">
                        <GlassCard className="h-full p-6">
                            <button onClick={() => setReasoningExpanded(!reasoningExpanded)} className="w-full flex items-center justify-between mb-6 group">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={16} className="text-secondary-500" />
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white italic">Decision Reasoning</h4>
                                </div>
                                <ChevronDown className={`text-slate-400 group-hover:text-primary-500 transition-all ${reasoningExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            <div className={`space-y-4 ${reasoningExpanded ? '' : 'max-h-[160px] overflow-hidden relative'}`}>
                                {!reasoningExpanded && <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/50 dark:from-slate-900/50 to-transparent z-10" />}
                                {scanData.match_reasoning?.length > 0 ? (
                                    scanData.match_reasoning.map((reason: any, idx: number) => (
                                        <div key={idx} className="flex gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl items-center border border-slate-100 dark:border-white/5">
                                            {reason.type === 'positive' ? <CheckCircle size={14} className="text-primary-500 shrink-0" /> : <AlertCircle size={14} className="text-secondary-500 shrink-0" />}
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest leading-relaxed">{reason.message}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center">Protocol reasoning not available</div>
                                )}
                            </div>
                        </GlassCard>
                    </div>
                </div>

                {/* Profit Protocol Injection */}
                <div className="mb-8">
                    <ProfitCalculator
                        ref={calculatorRef} maxBidSuggestion={scanData.max_bid_suggestion || 0} marketPrice={scanData.market_data?.averagePrice || 0}
                        initialMaxBid={scanData.custom_max_bid || undefined} initialRecon={scanData.custom_recon_cost || undefined}
                        initialTransport={scanData.custom_transport_cost || undefined} initialMarketPrice={scanData.custom_market_price || undefined}
                        auctionFeeThresholds={defaultCostSettings.auction_fee_thresholds || []} defaultRecon={defaultCostSettings.reconditioning_cost}
                        defaultTransport={defaultCostSettings.transport_cost} onCostsChange={() => { }} onSave={handleSaveCosts}
                        onEditStatusChange={onEditStatusChange} onOutsideClick={onOutsideClick} isSaving={isSaving} isEditing={isEditing}
                    />
                </div>

                {/* Comments Protocol */}
                {scanData.id && user?.tenant_id && (
                    <GlassCard className="p-8 mb-8">
                        <VehicleCommentSection vinScanId={scanData.id} tenantId={user.tenant_id} />
                    </GlassCard>
                )}

                {/* Action Protocols */}
                <div className="flex gap-4">
                    {onScanAnother && (
                        <button onClick={onScanAnother} className="flex-1 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all">
                            Scan Another Asset
                        </button>
                    )}
                    {!isModal && (
                        <button onClick={() => window.location.href = '/recommendations'} className="flex-1 py-5 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-primary transition-all shadow-lg shadow-primary-500/20">
                            Registry Archives
                        </button>
                    )}
                </div>
            </div>
            {/* Modal Specific Header/Close */}
            {isModal && (
                <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all z-50">
                    <X size={20} />
                </button>
            )}
        </div>
    );
});

export default VINScanResult;
