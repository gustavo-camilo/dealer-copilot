import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Edit2, Loader2, RotateCcw, Save } from 'lucide-react';

import { AuctionFeeThreshold } from '../types/database';
import { calculateAuctionFee } from '../services/marketPricing';

export interface ProfitCalculatorProps {
  maxBidSuggestion: number;
  marketPrice: number;
  auctionFeeThresholds: AuctionFeeThreshold[];
  defaultRecon: number;
  defaultTransport: number;
  onCostsChange?: (costs: {
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
  maxBidSuggestion,
  marketPrice: defaultMarketPrice,
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
  const [maxBid, setMaxBid] = useState(maxBidSuggestion);
  const [customAuctionFee, setCustomAuctionFee] = useState<number | null>(null);
  const [reconCost, setReconCost] = useState(defaultRecon);
  const [transportCost, setTransportCost] = useState(defaultTransport);
  const [marketPrice, setMarketPrice] = useState(defaultMarketPrice);
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
    maxBid !== maxBidSuggestion ||
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
    setMaxBid(maxBidSuggestion);
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
    <div ref={containerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">💰 Profit Calculator</h3>
          {costsEdited && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
              Edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isSaving && (
            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] items-center">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {costsEdited && (
            <button
              onClick={resetToDefaults}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
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
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'text-blue-900 hover:text-blue-700 hover:bg-blue-50'
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
          <span className="text-gray-600 font-medium">Suggested Max Bid</span>
          {isEditing ? (
            <input
              type="number"
              value={maxBid}
              onChange={(e) => setMaxBid(Number(e.target.value))}
              className="w-32 px-3 py-1 border border-gray-300 rounded text-right font-semibold"
            />
          ) : (
            <span className="font-semibold">${maxBid.toLocaleString()}</span>
          )}
        </div>

        {/* Auction Fee */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">+ Auction Fee</span>
          {isEditing ? (
            <input
              type="number"
              value={customAuctionFee !== null ? customAuctionFee : calculatedAuctionFee}
              onChange={(e) => setCustomAuctionFee(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-300 rounded text-right"
              placeholder="Custom Fee"
            />
          ) : (
            <span className="font-medium">${auctionFee.toLocaleString()}</span>
          )}
        </div>
        {/* Recon Cost */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">+ Recon/Detail</span>
          {isEditing ? (
            <input
              type="number"
              value={reconCost}
              onChange={(e) => setReconCost(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-300 rounded text-right"
            />
          ) : (
            <span className="font-medium">${reconCost.toLocaleString()}</span>
          )}
        </div>

        {/* Transport Cost */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">+ Transport</span>
          {isEditing ? (
            <input
              type="number"
              value={transportCost}
              onChange={(e) => setTransportCost(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-300 rounded text-right"
            />
          ) : (
            <span className="font-medium">${transportCost.toLocaleString()}</span>
          )}
        </div>

        {/* Total Investment */}
        <div className="border-t pt-3">
          <div className="flex justify-between font-semibold">
            <span>Total Investment</span>
            <span>${totalCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Market Retail */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Market Retail Price</span>
          {isEditing ? (
            <input
              type="number"
              value={marketPrice}
              onChange={(e) => setMarketPrice(Number(e.target.value))}
              className="w-32 px-3 py-1 border border-gray-300 rounded text-right font-medium"
            />
          ) : (
            <span className="font-medium">${marketPrice.toLocaleString()}</span>
          )}
        </div>

        {/* Expected Gross Profit */}
        <div
          className={`flex justify-between text-lg font-bold pt-2 border-t ${estimatedProfit >= 1500
            ? 'text-green-600'
            : estimatedProfit >= 800
              ? 'text-yellow-600'
              : 'text-red-600'
            }`}
        >
          <span>Expected Gross Profit</span>
          <span>${estimatedProfit.toLocaleString()}</span>
        </div>

        {/* Profit Margin */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Profit Margin</span>
          <span className="font-medium">{profitMargin.toFixed(1)}%</span>
        </div>

        {/* ROI */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Return on Investment (ROI)</span>
          <span className="font-medium">{((estimatedProfit / totalCost) * 100).toFixed(1)}%</span>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
          💡 Tip: Adjust costs based on this specific vehicle's needs. Your changes only apply to
          this scan.
        </div>
      )}
    </div>
  );
});

export default ProfitCalculator;
