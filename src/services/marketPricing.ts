import { DecodedVehicleData } from '../types/database';

const AUTODEV_API_KEY = import.meta.env.VITE_AUTODEV_API_KEY;
const AUTODEV_BASE_URL = 'https://api.auto.dev';

export interface MarketListing {
  vin: string;
  price: number;
  mileage?: number;
  dealer: string;
  city: string;
  state: string;
  daysListed?: number;
  url?: string;
}

export interface MarketPricingData {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  listingsCount: number;
  listings: MarketListing[];
  confidence: number; // 0-100
  dataSource: 'autodev' | 'estimated';
}

/**
 * Get market pricing from Auto.dev Listings API
 */
async function getMarketPricingFromAutoDev(
  year: number,
  make: string,
  model: string,
  maxRadius: number = 100
): Promise<MarketPricingData | null> {
  try {
    // Auto.dev listings API doesn't support direct make/model/year filtering
    // We'll need to fetch general listings and filter client-side
    // For MVP, we'll use estimation formulas instead
    // TODO: Implement pagination and filtering when API supports it
    return null;
  } catch (error) {
    console.error('Auto.dev market pricing error:', error);
    return null;
  }
}

/**
 * Estimate market price using depreciation formulas
 * Based on industry standard depreciation curves
 */
function estimateMarketPrice(vehicleData: DecodedVehicleData): MarketPricingData {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleData.year;

  // Base MSRP estimates by vehicle type and make (rough averages)
  const baseMSRPMap: Record<string, number> = {
    'Honda:Accord': 28000,
    'Honda:Civic': 24000,
    'Honda:CR-V': 30000,
    'Toyota:Camry': 28000,
    'Toyota:Corolla': 23000,
    'Toyota:RAV4': 32000,
    'Chevrolet:Silverado': 40000,
    'Chevrolet:Colorado': 32000,
    'Chevrolet:Malibu': 26000,
    'Ford:F-150': 42000,
    'Ford:Explorer': 38000,
    'Ford:Escape': 29000,
    'Nissan:Altima': 26000,
    'Nissan:Rogue': 29000,
  };

  // Get base MSRP or use generic default
  const vehicleKey = `${vehicleData.make}:${vehicleData.model}`;
  let baseMSRP = baseMSRPMap[vehicleKey];

  if (!baseMSRP) {
    // Generic estimate based on body type
    const bodyTypeDefaults: Record<string, number> = {
      'Sedan': 27000,
      'SUV': 35000,
      'Truck': 40000,
      'Trucks': 40000,
      'Coupe': 30000,
      'Van': 32000,
      'Wagon': 28000,
    };
    baseMSRP = bodyTypeDefaults[vehicleData.body_type || 'Sedan'] || 28000;
  }

  // Depreciation schedule (percent of value retained)
  const depreciationSchedule = [
    1.00,  // Year 0 (new)
    0.80,  // Year 1 (20% depreciation)
    0.70,  // Year 2
    0.60,  // Year 3
    0.50,  // Year 4
    0.42,  // Year 5
    0.36,  // Year 6
    0.31,  // Year 7
    0.27,  // Year 8
    0.24,  // Year 9
    0.21,  // Year 10
    0.18,  // Year 11+
  ];

  const depreciationFactor = depreciationSchedule[Math.min(vehicleAge, depreciationSchedule.length - 1)];
  let estimatedPrice = baseMSRP * depreciationFactor;

  // Adjust for mileage if provided
  if (vehicleData.mileage) {
    const expectedMileage = vehicleAge * 12000; // Average 12k miles/year
    const mileageDifference = vehicleData.mileage - expectedMileage;
    // Adjust $0.10 per mile above/below expected
    const mileageAdjustment = (mileageDifference * -0.10);
    estimatedPrice += mileageAdjustment;
  }

  // Adjust for title status
  if (vehicleData.title_status === 'salvage') {
    estimatedPrice *= 0.50; // 50% reduction for salvage
  } else if (vehicleData.title_status === 'rebuilt') {
    estimatedPrice *= 0.70; // 30% reduction for rebuilt
  }

  // Adjust for accidents
  if (vehicleData.accident_count && vehicleData.accident_count > 0) {
    estimatedPrice *= 0.90; // 10% reduction per accident
  }

  // Create price range (±10% for variance)
  const variance = estimatedPrice * 0.10;
  const minPrice = Math.round(estimatedPrice - variance);
  const maxPrice = Math.round(estimatedPrice + variance);
  const averagePrice = Math.round(estimatedPrice);

  return {
    averagePrice,
    minPrice,
    maxPrice,
    medianPrice: averagePrice,
    listingsCount: 0, // Estimated, not from real listings
    listings: [],
    confidence: 65, // Moderate confidence for estimation
    dataSource: 'estimated',
  };
}

/**
 * Get market pricing with fallback to estimation
 */
export async function getMarketPricing(
  vehicleData: DecodedVehicleData
): Promise<MarketPricingData> {
  // Try to get real market data from Auto.dev
  const autoDevData = await getMarketPricingFromAutoDev(
    vehicleData.year,
    vehicleData.make,
    vehicleData.model
  );

  if (autoDevData) {
    return autoDevData;
  }

  // Fallback to estimation
  return estimateMarketPrice(vehicleData);
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
