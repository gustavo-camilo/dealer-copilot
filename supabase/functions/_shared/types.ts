// =====================================================
// SHARED TYPES FOR DEALER CO-PILOT SCRAPERS
// =====================================================
// Common interfaces used across all scraping functions

/**
 * Parsed vehicle data extracted from dealer websites
 */
export interface ParsedVehicle {
  vin?: string;
  stock_number?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price?: number;
  mileage?: number;
  color?: string;
  url?: string;
  images?: string[];
  imageDate?: Date;
}

/**
 * VIN decoded data from NHTSA vPIC API
 */
export interface VINDecodedData {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyType?: string;
  engineType?: string;
  driveType?: string;
}

/**
 * Configuration options for the scraper
 */
export interface ScraperConfig {
  /** Maximum number of concurrent HTTP requests (default: 5) */
  maxConcurrency: number;

  /** Delay between batches in milliseconds (default: 800) */
  pageDelay: number;

  /** Maximum number of pagination pages to follow (default: 20) */
  maxPages: number;

  /** Request timeout in milliseconds (default: 30000) */
  timeout: number;

  /** User agent string for HTTP requests */
  userAgent: string;
}

/**
 * Default scraper configuration
 */
export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  maxConcurrency: 5,
  pageDelay: 800,
  maxPages: 20,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
};

/**
 * Result of a scraping operation
 */
export interface ScrapeResult {
  success: boolean;
  vehicles: ParsedVehicle[];
  totalFound: number;
  duration: number;
  error?: string;
}
