import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Edit2, Loader2, RotateCcw, Save } from 'lucide-react';

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
        onSave({
          recon: reconCost,
          transport: transportCost,
          maxBid,
          marketPrice
        });
      }
      setIsEditing(false); // Reset to view mode after save
    }
  }), [onSave, reconCost, transportCost, maxBid, marketPrice]);

  // Sync isEditing with prop
  useEffect(() => {
    if (isEditingProp !== undefined) {
      setIsEditing(isEditingProp);
    }
  }, [isEditingProp]);

  // Notify parent of isEditing change
  useEffect(() => {
    if (onEditStatusChange) {
      onEditStatusChange(isEditing);
    }
  }, [isEditing, onEditStatusChange]);

  // Handle click away
  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (onOutsideClick) {
          onOutsideClick();
        }
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isEditing]);

  // Calculate auction fee (use custom if set, otherwise calculate from thresholds based on current maxBid)
  const calculatedAuctionFee = calculateAuctionFee(maxBid, auctionFeeThresholds);
  const auctionFee = customAuctionFee !== null ? customAuctionFee : calculatedAuctionFee;

  // Track if any costs were edited
  const costsEdited =
    maxBid !== defaultMaxBid ||
    customAuctionFee !== null ||
    reconCost !== defaultRecon ||
    transportCost !== defaultTransport ||
    marketPrice !== defaultMarketPrice;

  // Calculate derived values
  const totalCost = maxBid + auctionFee + reconCost + transportCost;
  const estimatedProfit = marketPrice - totalCost;
  const profitMargin = totalCost > 0 ? ((estimatedProfit / totalCost) * 100) : 0;

  // Reset to defaults
  const resetToDefaults = () => {
    setMaxBid(defaultMaxBid);
    setCustomAuctionFee(null);
    setReconCost(defaultRecon);
    setTransportCost(defaultTransport);
    setMarketPrice(defaultMarketPrice);
  };

  // Notify parent of cost changes
  useEffect(() => {
    if (onCostsChange) {
      onCostsChange({
        auctionFee: auctionFee, // Pass the actual fee amount
        recon: reconCost,
        transport: transportCost,
        maxBid,
        marketPrice,
        totalCost,
        estimatedProfit,
        costsEdited,
      });
    }
  }, [maxBid, auctionFee, reconCost, transportCost, marketPrice, totalCost, estimatedProfit, costsEdited, onCostsChange]);

  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-white">💰 Profit Calculator</h3>
          {costsEdited && (
            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 text-xs font-medium rounded">
              Edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isSaving && (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 px-2 py-0.5 rounded text-[10px] items-center">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {costsEdited && (
            <button
              onClick={resetToDefaults}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-md transition-colors"
              title="Reset to Defaults"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => {
              if (isEditing && onSave) {
                onSave({
                  recon: reconCost,
                  transport: transportCost,
                  maxBid,
                  marketPrice
                });
              }
              setIsEditing(!isEditing);
            }}
            className={`text-sm flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${isEditing
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm dark:bg-blue-600 dark:hover:bg-blue-700'
              : 'text-blue-900 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20'
              }`}
          >
            {isEditing ? (
              <Save className="h-4 w-4" />
            ) : (
              <Edit2 className="h-4 w-4" />
            )}
            <span className="font-semibold">{isEditing ? 'Save' : 'Edit'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Max Bid */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400 font-medium">Suggested Max Bid</span>
          {isEditing ? (
            <input
              type="number"
              value={maxBid}
              onChange={(e) => setMaxBid(Number(e.target.value))}
              className="w-32 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-right font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          ) : (
            <span className="font-semibold text-gray-900 dark:text-white">${maxBid.toLocaleString()}</span>
          )}
        </div>

        {/* Auction Fee */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">+ Auction Fee</span>
          {isEditing ? (
            <input
              type="number"
              value={customAuctionFee !== null ? customAuctionFee : calculatedAuctionFee}
              onChange={(e) => setCustomAuctionFee(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Custom Fee"
            />
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">${auctionFee.toLocaleString()}</span>
          )}
        </div>
        {/* Recon Cost */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">+ Recon/Detail</span>
          {isEditing ? (
            <input
              type="number"
              value={reconCost}
              onChange={(e) => setReconCost(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">${reconCost.toLocaleString()}</span>
          )}
        </div>

        {/* Transport Cost */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">+ Transport</span>
          {isEditing ? (
            <input
              type="number"
              value={transportCost}
              onChange={(e) => setTransportCost(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">${transportCost.toLocaleString()}</span>
          )}
        </div>

        {/* Total Investment */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
            <span>Total Investment</span>
            <span>${totalCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Market Retail */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">Market Retail Price</span>
          {isEditing ? (
            <input
              type="number"
              value={marketPrice}
              onChange={(e) => setMarketPrice(Number(e.target.value))}
              className="w-32 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-right font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">${marketPrice.toLocaleString()}</span>
          )}
        </div>

        {/* Expected Gross Profit */}
        <div
          className={`flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700 ${estimatedProfit >= 1500
            ? 'text-green-600 dark:text-green-400'
            : estimatedProfit >= 800
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'
            }`}
        >
          <span>Expected Gross Profit</span>
          <span>${estimatedProfit.toLocaleString()}</span>
        </div>

        {/* Profit Margin */}
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Profit Margin</span>
          <span className="font-medium">{profitMargin.toFixed(1)}%</span>
        </div>

        {/* ROI */}
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Return on Investment (ROI)</span>
          <span className="font-medium">{((estimatedProfit / totalCost) * 100).toFixed(1)}%</span>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/20 rounded-lg text-sm text-blue-900 dark:text-blue-300">
          💡 Tip: Adjust costs based on this specific vehicle's needs. Your changes only apply to
          this scan.
        </div>
      )}
    </div>
  );
});

export default ProfitCalculator;
