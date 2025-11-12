import { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';

export interface ProfitCalculatorProps {
  maxBidSuggestion: number;
  marketPrice: number;
  defaultAuctionFee: number;
  defaultRecon: number;
  defaultTransport: number;
  onCostsChange?: (costs: {
    auctionFee: number;
    recon: number;
    transport: number;
    maxBid: number;
    totalCost: number;
    estimatedProfit: number;
  }) => void;
}

export default function ProfitCalculator({
  maxBidSuggestion,
  marketPrice,
  defaultAuctionFee,
  defaultRecon,
  defaultTransport,
  onCostsChange,
}: ProfitCalculatorProps) {
  const [maxBid, setMaxBid] = useState(maxBidSuggestion);
  const [auctionFeePercent, setAuctionFeePercent] = useState(defaultAuctionFee);
  const [reconCost, setReconCost] = useState(defaultRecon);
  const [transportCost, setTransportCost] = useState(defaultTransport);
  const [isEditing, setIsEditing] = useState(false);

  // Calculate derived values
  const auctionFee = Math.round(maxBid * (auctionFeePercent / 100));
  const totalCost = maxBid + auctionFee + reconCost + transportCost;
  const estimatedProfit = marketPrice - totalCost;
  const profitMargin = totalCost > 0 ? ((estimatedProfit / totalCost) * 100) : 0;

  // Notify parent of cost changes
  useEffect(() => {
    if (onCostsChange) {
      onCostsChange({
        auctionFee: auctionFeePercent,
        recon: reconCost,
        transport: transportCost,
        maxBid,
        totalCost,
        estimatedProfit,
      });
    }
  }, [maxBid, auctionFeePercent, reconCost, transportCost, totalCost, estimatedProfit, onCostsChange]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900">💰 Profit Calculator</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-blue-900 hover:text-blue-700 flex items-center gap-1"
        >
          <Edit2 className="h-4 w-4" />
          {isEditing ? 'Done' : 'Edit Costs'}
        </button>
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
                value={auctionFeePercent}
                onChange={(e) => setAuctionFeePercent(Number(e.target.value))}
                step="0.5"
                className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs"
              />
            )}
            {!isEditing && <span className="text-gray-500">({auctionFeePercent}%)</span>}
          </div>
          <span className="font-medium">${auctionFee.toLocaleString()}</span>
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
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Market Retail Price</span>
          <span className="font-medium">${marketPrice.toLocaleString()}</span>
        </div>

        {/* Expected Gross Profit */}
        <div
          className={`flex justify-between text-lg font-bold pt-2 border-t ${
            estimatedProfit >= 1500
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
