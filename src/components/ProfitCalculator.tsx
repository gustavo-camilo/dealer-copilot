import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Edit2, Loader2, RotateCcw, Save, DollarSign, BarChart3, Gauge, Target, TrendingDown } from 'lucide-react';

import { AuctionFeeThreshold } from '../types/database';
import { calculateAuctionFee } from '../services/marketPricing';

export interface ProfitCalculatorProps {
  maxBidSuggestion: number;
  marketPrice: number;
  initialMaxBid?: number;
  initialRecon?: number;
  initialTransport?: number;
  initialMarketPrice?: number;
  auctionFeeThresholds: AuctionFeeThreshold[];
  defaultRecon: number;
  defaultTransport: number;
  onCostsChange: (costs: {
    auctionFee: number;
    recon: number;
    transport: number;
    maxBid: number;
    marketPrice: number;
    totalCost: number;
    estimatedProfit: number;
    costsEdited: boolean;
  }) => void;
  onSave?: (costs: {
    recon: number;
    transport: number;
    maxBid: number;
    marketPrice: number;
  }) => void;
  onEditStatusChange?: (isEditing: boolean) => void;
  onOutsideClick?: () => void;
  isSaving?: boolean;
  isEditing?: boolean;
}

const ProfitCalculator = forwardRef<{ save: () => void }, ProfitCalculatorProps>(({
  maxBidSuggestion: defaultMaxBid,
  marketPrice: defaultMarketPrice,
  initialMaxBid,
  initialRecon,
  initialTransport,
  initialMarketPrice,
  auctionFeeThresholds,
  defaultRecon,
  defaultTransport,
  onCostsChange,
  onSave,
  onEditStatusChange,
  onOutsideClick,
  isSaving = false,
  isEditing: isEditingProp,
}, ref) => {
  const [maxBid, setMaxBid] = useState(initialMaxBid !== undefined ? initialMaxBid : defaultMaxBid);
  const [customAuctionFee, setCustomAuctionFee] = useState<number | null>(null);
  const [reconCost, setReconCost] = useState(initialRecon !== undefined ? initialRecon : defaultRecon);
  const [transportCost, setTransportCost] = useState(initialTransport !== undefined ? initialTransport : defaultTransport);
  const [marketPrice, setMarketPrice] = useState(initialMarketPrice !== undefined ? initialMarketPrice : defaultMarketPrice);
  const [isEditing, setIsEditing] = useState(isEditingProp || false);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    save: () => {
      if (onSave) {
        onSave({ recon: reconCost, transport: transportCost, maxBid, marketPrice });
      }
      setIsEditing(false);
    }
  }), [onSave, reconCost, transportCost, maxBid, marketPrice]);

  useEffect(() => { if (isEditingProp !== undefined) setIsEditing(isEditingProp); }, [isEditingProp]);
  useEffect(() => { if (onEditStatusChange) onEditStatusChange(isEditing); }, [isEditing, onEditStatusChange]);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (onOutsideClick) onOutsideClick();
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [isEditing]);

  const calculatedAuctionFee = calculateAuctionFee(maxBid, auctionFeeThresholds);
  const auctionFee = customAuctionFee !== null ? customAuctionFee : calculatedAuctionFee;
  const costsEdited = maxBid !== defaultMaxBid || customAuctionFee !== null || reconCost !== defaultRecon || transportCost !== defaultTransport || marketPrice !== defaultMarketPrice;
  const totalCost = maxBid + auctionFee + reconCost + transportCost;
  const estimatedProfit = marketPrice - totalCost;
  const profitMargin = totalCost > 0 ? ((estimatedProfit / totalCost) * 100) : 0;

  const resetToDefaults = () => {
    setMaxBid(defaultMaxBid);
    setCustomAuctionFee(null);
    setReconCost(defaultRecon);
    setTransportCost(defaultTransport);
    setMarketPrice(defaultMarketPrice);
  };

  useEffect(() => {
    if (onCostsChange) {
      onCostsChange({ auctionFee, recon: reconCost, transport: transportCost, maxBid, marketPrice, totalCost, estimatedProfit, costsEdited });
    }
  }, [maxBid, auctionFee, reconCost, transportCost, marketPrice, totalCost, estimatedProfit, costsEdited, onCostsChange]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  return (
    <div ref={containerRef} className="bg-white/50 dark:bg-black/20 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-white/5 overflow-hidden">
      <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-500/10 rounded-2xl">
            <DollarSign size={20} className="text-primary-500" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Financial <span className="text-primary-500">Calculator</span></h3>
        </div>
        <div className="flex items-center gap-3">
          {isSaving && <div className="flex items-center gap-2 text-[8px] font-black uppercase text-primary-500 animate-pulse"><Loader2 size={12} className="animate-spin" /> Syncing...</div>}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl gap-1">
            <button onClick={() => { if (isEditing && onSave) onSave({ recon: reconCost, transport: transportCost, maxBid, marketPrice }); setIsEditing(!isEditing); }} className={`p-2.5 rounded-xl transition-all ${isEditing ? 'bg-primary-500 text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}>
              {isEditing ? <Save size={16} /> : <Edit2 size={16} />}
            </button>
            {costsEdited && (
              <button onClick={resetToDefaults} className="p-2.5 rounded-xl text-slate-400 hover:text-secondary-500 transition-all">
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 grid md:grid-cols-2 gap-12">
        <div className="space-y-6">
          {[
            { label: 'Buy Bid (Max)', value: maxBid, setter: setMaxBid, icon: Target },
            { label: 'Auction Protocol', value: auctionFee, setter: setCustomAuctionFee, icon: Gauge },
            { label: 'Recon & Detail', value: reconCost, setter: setReconCost, icon: BarChart3 },
            { label: 'Transport Log', value: transportCost, setter: setTransportCost, icon: TrendingDown },
          ].map((item, i) => (
            <div key={i} className="group relative">
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <item.icon size={10} className="text-primary-500" /> {item.label}
                </label>
              </div>
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                  <input type="number" value={item.value} onChange={(e) => item.setter(Number(e.target.value))} className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white" />
                </div>
              ) : (
                <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent flex justify-between items-center">
                  <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(item.value)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-primary-500/5 dark:bg-primary-500/10 rounded-3xl p-8 border border-primary-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <DollarSign size={120} />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary-500 mb-6 flex justify-between items-center">
                Total Investment Phase
                <div className="px-3 py-1 bg-primary-500 text-white rounded-lg">LIVE DELTA</div>
              </div>
              <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-4 italic">{formatCurrency(totalCost)}</div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Aggregated costs for current acquisition protocol</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-white/5 rounded-3xl p-6 border border-slate-100 dark:border-white/5">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-3">Gross Alpha</div>
              <div className={`text-2xl font-black tracking-tight ${estimatedProfit > 0 ? 'text-primary-500' : 'text-red-500'}`}>{formatCurrency(estimatedProfit)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-3xl p-6 border border-slate-100 dark:border-white/5">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-3">Yield Matrix</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{profitMargin.toFixed(1)}%</div>
            </div>
          </div>

          <div className="p-6 bg-slate-900 dark:bg-white rounded-3xl flex items-center justify-between">
            <div>
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Market Retail Reference</div>
              {isEditing ? (
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                  <input type="number" value={marketPrice} onChange={(e) => setMarketPrice(Number(e.target.value))} className="w-40 pl-8 pr-4 py-2 bg-white/10 dark:bg-slate-900/10 border border-white/20 dark:border-slate-900/20 rounded-xl text-[10px] font-black tracking-widest uppercase outline-none focus:ring-2 focus:ring-primary-500 transition-all text-white dark:text-slate-900" />
                </div>
              ) : (
                <div className="text-xl font-black text-white dark:text-slate-900 tracking-tight">{formatCurrency(marketPrice)}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">ROI Index</div>
              <div className="text-xl font-black text-primary-500 tracking-tight">{((estimatedProfit / totalCost) * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProfitCalculator;
