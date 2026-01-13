import React from 'react';
import { BarChart3, Gauge, DollarSign, Car } from 'lucide-react';

interface InventoryAssessmentProps {
  stats: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    minMileage: number;
    maxMileage: number;
    avgMileage: number;
    topMakes: Record<string, number>;
    vehicleCount?: number;
    totalValue?: number;
  };
}

export default function InventoryAssessment({ stats }: InventoryAssessmentProps) {
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return Math.round(value).toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {/* Price Range */}
      <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Price Range</h3>
        </div>

        {/* Average Price - Prominent */}
        <div className="mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats.avgPrice)}
          </div>
        </div>

        {/* Min/Max */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Min</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(stats.minPrice)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(stats.maxPrice)}
            </div>
          </div>
        </div>
      </div>

      {/* Mileage Range */}
      <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-4">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Mileage Range</h3>
        </div>

        {/* Average Mileage - Prominent */}
        <div className="mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatNumber(stats.avgMileage)} <span className="text-sm font-normal text-gray-500">mi</span>
          </div>
        </div>

        {/* Min/Max */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Min</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatNumber(stats.minMileage)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatNumber(stats.maxMileage)}
            </div>
          </div>
        </div>
      </div>

      {/* Top Makes */}
      <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-brand-border-dark p-4">
        <div className="flex items-center gap-2 mb-4">
          <Car className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Top Brands</h3>
        </div>

        <div className="space-y-3">
          {Object.entries(stats.topMakes)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5)
            .map(([make, count], index) => (
              <div key={make} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-4">{index + 1}.</span>
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{make}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                      style={{ width: `${(count / (stats.vehicleCount || 100)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(stats.topMakes).length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                No brand data available
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
