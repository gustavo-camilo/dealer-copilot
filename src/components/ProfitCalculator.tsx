import { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';

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
}

export default function ProfitCalculator({
  maxBidSuggestion,
  marketPrice: defaultMarketPrice,
  auctionFeeThresholds,
  defaultRecon,
  defaultTransport,
  onCostsChange,
}: ProfitCalculatorProps) {
  const [maxBid, setMaxBid] = useState(maxBidSuggestion);
  const [customAuctionFee, setCustomAuctionFee] = useState<number | null>(null);
  const [reconCost, setReconCost] = useState(defaultRecon);
  const [transportCost, setTransportCost] = useState(defaultTransport);
  const [marketPrice, setMarketPrice] = useState(defaultMarketPrice);
  const [isEditing, setIsEditing] = useState(false);

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">💰 Profit Calculator</h3>
          {costsEdited && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
              Edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {costsEdited && (
            <button
              onClick={resetToDefaults}
              className="text-xs text-gray-600 hover:text-gray-900 underline"
            >
              Use Defaults
            </button>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-blue-900 hover:text-blue-700 flex items-center gap-1 p-1 hover:bg-blue-50 rounded"
            title={isEditing ? 'Done' : 'Edit Costs'}
          >
            <Edit2 className="h-4 w-4" />
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
          <div className="flex items-center gap-2">
            <span className="text-gray-600">+ Auction Fee</span>
            {isEditing && (
              <input
                type="number"
                value={customAuctionFee !== null ? customAuctionFee : calculatedAuctionFee}
                onChange={(e) => setCustomAuctionFee(Number(e.target.value))}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-xs"
                placeholder="Custom Fee"
              />
            )}
          </div>
          {!isEditing && <span className="font-medium">${auctionFee.toLocaleString()}</span>}
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
}
