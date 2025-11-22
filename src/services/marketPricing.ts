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
  zipCode: string = '90210' // Default to Beverly Hills if no zip provided (TODO: Get from tenant settings)
): Promise<MarketPricingData | null> {
  // Try to get real market data from Marketcheck
  try {
    const marketCheckData = await searchActiveListings(
      vehicleData.year,
      vehicleData.make,
      vehicleData.model,
      zipCode,
      50, // 50 miles radius
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
export function calculateMaxBid(
  marketPrice: number,
  targetMarginPercent: number,
  auctionFeePercent: number,
  reconditioningCost: number,
  transportCost: number
): number {
  // Work backwards from desired retail price
  const targetMarginMultiplier = 1 + (targetMarginPercent / 100);
  const targetAcquisitionCost = marketPrice / targetMarginMultiplier;

  // Subtract fixed costs and auction fees
  const fixedCosts = reconditioningCost + transportCost;
  const maxBidBeforeFees = targetAcquisitionCost - fixedCosts;

  // Calculate max bid considering auction fees
  const maxBid = maxBidBeforeFees / (1 + auctionFeePercent / 100);

  return Math.round(maxBid);
}
