import { DecodedVehicleData } from '../types/database';
import { MarketPricingData } from '../types/market';
import { searchActiveListings, processMarketcheckData } from './marketcheck';

// Re-export types for backward compatibility if needed, or just use from types/market
export type { MarketPricingData, MarketListing } from '../types/market';

/**
 * Get market pricing with fallback to estimation
 */
export async function getMarketPricing(
  vehicleData: DecodedVehicleData,
  zipCode: string = '90210', // Default to Beverly Hills if no zip provided (TODO: Get from tenant settings)
  radius: number = 100 // Default to 100 miles, can be expanded to 500
): Promise<MarketPricingData | null> {
  // Try to get real market data from Marketcheck
  try {
    const marketCheckData = await searchActiveListings(
      vehicleData.year,
      vehicleData.make,
      vehicleData.model,
      zipCode,
      radius, // Use radius parameter instead of hardcoded 50
      vehicleData.mileage
    );

    if (marketCheckData && marketCheckData.num_found > 0) {
      return processMarketcheckData(marketCheckData);
    }
  } catch (error) {
    console.error('Failed to get Marketcheck data:', error);
  }

  // No data found - return null instead of estimating
  return null;
}



/**
 * Calculate suggested retail price based on acquisition cost and target margin
 */
export function calculateSuggestedRetail(
  acquisitionCost: number,
  targetMarginPercent: number
): number {
  return Math.round(acquisitionCost * (1 + targetMarginPercent / 100));
}

/**
 * Calculate maximum bid based on market price and target margin
 */
import { AuctionFeeThreshold } from '../types/database';

/**
 * Calculate auction fee based on price and thresholds
 */
export function calculateAuctionFee(price: number, thresholds: AuctionFeeThreshold[]): number {
  if (!thresholds || thresholds.length === 0) return 0;

  const threshold = thresholds.find(t => price >= t.min_price && price < t.max_price);
  return threshold ? threshold.fee : 0;
}

/**
 * Calculate maximum bid based on market price and target margin
 * Iteratively solves for max bid since fee depends on the bid amount
 */
export function calculateMaxBid(
  marketPrice: number,
  targetMarginPercent: number,
  auctionFeeThresholds: AuctionFeeThreshold[],
  reconditioningCost: number,
  transportCost: number
): number {
  // Work backwards from desired retail price
  const targetMarginMultiplier = 1 + (targetMarginPercent / 100);
  const targetAcquisitionCost = marketPrice / targetMarginMultiplier;

  // Initial estimate: assume 0 auction fee
  let maxBid = targetAcquisitionCost - reconditioningCost - transportCost;

  // Iteratively refine max bid (simple fixed-point iteration)
  // We need to find a bid B such that: B + Fee(B) + FixedCosts = TargetAcquisitionCost
  // So B = TargetAcquisitionCost - FixedCosts - Fee(B)

  for (let i = 0; i < 5; i++) {
    const fee = calculateAuctionFee(maxBid, auctionFeeThresholds);
    const newMaxBid = targetAcquisitionCost - reconditioningCost - transportCost - fee;

    if (Math.abs(newMaxBid - maxBid) < 1) {
      maxBid = newMaxBid;
      break;
    }
    maxBid = newMaxBid;
  }

  return Math.max(0, Math.round(maxBid));
}
