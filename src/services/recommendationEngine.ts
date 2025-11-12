import { DecodedVehicleData, RecommendationType, MatchReason, SalesRecord } from '../types/database';
import { MarketPricingData } from './marketPricing';

export interface VehicleRecommendation {
  recommendation: RecommendationType;
  confidenceScore: number;
  matchReasons: MatchReason[];
  estimatedProfit: number;
  maxBidSuggestion: number;
  estimatedDaysToSale: number;
}

interface ScoringFactors {
  vehicleCondition: number;
  marketDemand: number;
  profitPotential: number;
  dealerHistory: number;
  riskFactors: number;
}

/**
 * Analyze dealer's historical sales to find their "sweet spot"
 */
function analyzeDealerHistory(
  vehicleData: DecodedVehicleData,
  salesHistory: SalesRecord[]
): { score: number; reasons: MatchReason[]; avgDaysToSale: number } {
  const reasons: MatchReason[] = [];
  let score = 50; // Start at neutral
  let avgDaysToSale = 30; // Default

  if (salesHistory.length === 0) {
    reasons.push({
      type: 'neutral',
      message: 'No sales history available yet - recommendation based on market data',
    });
    return { score, reasons, avgDaysToSale };
  }

  // Find similar vehicles in history (same make/model)
  const similarVehicles = salesHistory.filter(
    (sale) =>
      sale.make.toLowerCase() === vehicleData.make.toLowerCase() &&
      sale.model.toLowerCase() === vehicleData.model.toLowerCase()
  );

  if (similarVehicles.length > 0) {
    // Calculate averages for similar vehicles
    const avgGrossProfit =
      similarVehicles.reduce((sum, v) => sum + v.gross_profit, 0) / similarVehicles.length;
    avgDaysToSale =
      similarVehicles.reduce((sum, v) => sum + v.days_to_sale, 0) / similarVehicles.length;

    if (avgDaysToSale <= 30) {
      score += 30;
      reasons.push({
        type: 'positive',
        message: `You've sold ${similarVehicles.length} ${vehicleData.make} ${vehicleData.model}s in ${Math.round(avgDaysToSale)} days average (fast!)`,
      });
    } else if (avgDaysToSale <= 45) {
      score += 15;
      reasons.push({
        type: 'neutral',
        message: `You've sold ${similarVehicles.length} ${vehicleData.make} ${vehicleData.model}s in ${Math.round(avgDaysToSale)} days average (moderate)`,
      });
    } else {
      score -= 15;
      reasons.push({
        type: 'negative',
        message: `Your ${vehicleData.make} ${vehicleData.model}s take ${Math.round(avgDaysToSale)} days to sell (slow)`,
      });
    }

    if (avgGrossProfit >= 2000) {
      score += 15;
      reasons.push({
        type: 'positive',
        message: `Strong profit history: $${Math.round(avgGrossProfit)} avg gross on these`,
      });
    }
  } else {
    // Check if dealer has sold this make before
    const sameMakeVehicles = salesHistory.filter(
      (sale) => sale.make.toLowerCase() === vehicleData.make.toLowerCase()
    );

    if (sameMakeVehicles.length > 0) {
      const avgDays =
        sameMakeVehicles.reduce((sum, v) => sum + v.days_to_sale, 0) / sameMakeVehicles.length;
      if (avgDays <= 35) {
        score += 10;
        reasons.push({
          type: 'positive',
          message: `You sell ${vehicleData.make} vehicles well (${Math.round(avgDays)} days avg)`,
        });
      }
    } else {
      score -= 10;
      reasons.push({
        type: 'negative',
        message: `You haven't sold ${vehicleData.make} vehicles before - unproven market for you`,
      });
    }
  }

  return { score, reasons, avgDaysToSale };
}

/**
 * Score vehicle condition
 */
function scoreVehicleCondition(vehicleData: DecodedVehicleData): {
  score: number;
  reasons: MatchReason[];
} {
  const reasons: MatchReason[] = [];
  let score = 70; // Start optimistic

  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleData.year;

  // Age scoring
  if (vehicleAge <= 3) {
    score += 15;
    reasons.push({
      type: 'positive',
      message: `Recent model year (${vehicleData.year}) - high demand`,
    });
  } else if (vehicleAge <= 6) {
    score += 5;
    reasons.push({
      type: 'positive',
      message: `Good age (${vehicleAge} years old)`,
    });
  } else if (vehicleAge >= 10) {
    score -= 15;
    reasons.push({
      type: 'negative',
      message: `Older vehicle (${vehicleAge} years) - may be harder to sell`,
    });
  }

  // Mileage scoring
  if (vehicleData.mileage) {
    const expectedMileage = vehicleAge * 12000;
    const mileageDiff = vehicleData.mileage - expectedMileage;

    if (vehicleData.mileage < 50000) {
      score += 15;
      reasons.push({
        type: 'positive',
        message: `Low mileage (${vehicleData.mileage.toLocaleString()} mi) - excellent condition`,
      });
    } else if (mileageDiff < -10000) {
      score += 10;
      reasons.push({
        type: 'positive',
        message: `Below average mileage for age (${vehicleData.mileage.toLocaleString()} mi)`,
      });
    } else if (mileageDiff > 30000) {
      score -= 15;
      reasons.push({
        type: 'negative',
        message: `High mileage (${vehicleData.mileage.toLocaleString()} mi) - may reduce value`,
      });
    }
  }

  // Title status
  if (vehicleData.title_status === 'clean') {
    score += 10;
    reasons.push({
      type: 'positive',
      message: 'Clean title - no issues',
    });
  } else if (vehicleData.title_status === 'salvage') {
    score -= 40;
    reasons.push({
      type: 'negative',
      message: 'Salvage title - significant value reduction and harder to sell',
    });
  } else if (vehicleData.title_status === 'rebuilt') {
    score -= 20;
    reasons.push({
      type: 'negative',
      message: 'Rebuilt title - will affect resale value',
    });
  }

  // Accident history
  if (vehicleData.accident_count !== undefined) {
    if (vehicleData.accident_count === 0) {
      score += 10;
      reasons.push({
        type: 'positive',
        message: 'No accidents reported - clean history',
      });
    } else if (vehicleData.accident_count >= 2) {
      score -= 15;
      reasons.push({
        type: 'negative',
        message: `${vehicleData.accident_count} accidents reported - buyers may be cautious`,
      });
    }
  }

  return { score, reasons };
}

/**
 * Score market demand and pricing
 */
function scoreMarketDemand(
  vehicleData: DecodedVehicleData,
  marketData: MarketPricingData
): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let score = 60;

  // Popular makes get bonus
  const popularMakes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan'];
  if (popularMakes.includes(vehicleData.make)) {
    score += 15;
    reasons.push({
      type: 'positive',
      message: `${vehicleData.make} is a popular, reliable brand - easier to sell`,
    });
  }

  // Market confidence from pricing data
  if (marketData.confidence >= 80) {
    score += 10;
    reasons.push({
      type: 'positive',
      message: 'Strong market data available - confident pricing',
    });
  } else if (marketData.confidence < 50) {
    score -= 10;
    reasons.push({
      type: 'negative',
      message: 'Limited market data - pricing estimates less reliable',
    });
  }

  return { score, reasons };
}

/**
 * Calculate profit potential
 */
function calculateProfitPotential(
  marketPrice: number,
  maxBid: number,
  targetMargin: number
): { score: number; reasons: MatchReason[]; estimatedProfit: number } {
  const reasons: MatchReason[] = [];
  let score = 60;

  const estimatedProfit = marketPrice - maxBid;
  const profitMargin = (estimatedProfit / maxBid) * 100;

  if (profitMargin >= targetMargin + 5) {
    score += 20;
    reasons.push({
      type: 'positive',
      message: `Excellent profit potential: $${Math.round(estimatedProfit)} (${Math.round(profitMargin)}% margin)`,
    });
  } else if (profitMargin >= targetMargin) {
    score += 10;
    reasons.push({
      type: 'positive',
      message: `Good profit potential: $${Math.round(estimatedProfit)} (${Math.round(profitMargin)}% margin)`,
    });
  } else if (profitMargin >= targetMargin - 5) {
    score += 0;
    reasons.push({
      type: 'neutral',
      message: `Moderate profit: $${Math.round(estimatedProfit)} (${Math.round(profitMargin)}% margin)`,
    });
  } else {
    score -= 20;
    reasons.push({
      type: 'negative',
      message: `Low profit margin: $${Math.round(estimatedProfit)} (${Math.round(profitMargin)}% only)`,
    });
  }

  return { score, reasons, estimatedProfit };
}

/**
 * Main recommendation engine
 */
export async function generateRecommendation(
  vehicleData: DecodedVehicleData,
  marketData: MarketPricingData,
  salesHistory: SalesRecord[],
  maxBid: number,
  targetMarginPercent: number
): Promise<VehicleRecommendation> {
  // Score different factors
  const conditionScore = scoreVehicleCondition(vehicleData);
  const marketScore = scoreMarketDemand(vehicleData, marketData);
  const historyResult = analyzeDealerHistory(vehicleData, salesHistory);
  const profitResult = calculateProfitPotential(
    marketData.averagePrice,
    maxBid,
    targetMarginPercent
  );

  // Combine all reasons
  const allReasons: MatchReason[] = [
    ...conditionScore.reasons,
    ...marketScore.reasons,
    ...historyResult.reasons,
    ...profitResult.reasons,
  ];

  // Calculate weighted total score (0-100)
  const weights = {
    condition: 0.25,
    market: 0.20,
    history: 0.30,
    profit: 0.25,
  };

  const totalScore =
    conditionScore.score * weights.condition +
    marketScore.score * weights.market +
    historyResult.score * weights.history +
    profitResult.score * weights.profit;

  // Determine recommendation type
  let recommendation: RecommendationType;
  if (totalScore >= 75) {
    recommendation = 'buy';
  } else if (totalScore >= 55) {
    recommendation = 'caution';
  } else {
    recommendation = 'pass';
  }

  // Adjust confidence based on available data
  let confidenceScore = totalScore;
  if (salesHistory.length === 0) {
    confidenceScore *= 0.7; // Lower confidence without dealer history
  }
  if (marketData.dataSource === 'estimated') {
    confidenceScore *= 0.9; // Slightly lower confidence with estimates
  }

  return {
    recommendation,
    confidenceScore: Math.round(Math.min(95, Math.max(10, confidenceScore))),
    matchReasons: allReasons,
    estimatedProfit: Math.round(profitResult.estimatedProfit),
    maxBidSuggestion: Math.round(maxBid),
    estimatedDaysToSale: Math.round(historyResult.avgDaysToSale),
  };
}
