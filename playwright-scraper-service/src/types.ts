/**
 * Vehicle data structure
 */
export interface Vehicle {
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  vin?: string;
  price?: number;
  listing_date?: Date;
  image_url?: string;
  url: string;
  trim?: string;
  color?: string;
  stock_number?: string;
}

/**
 * Extraction strategy result
 */
export interface ExtractionResult {
  vehicles: Vehicle[];
  tier: 'api' | 'structured' | 'selector' | 'llm';
  confidence: 'high' | 'medium' | 'low';
  pattern?: DomainPattern;
}

/**
 * Domain-specific extraction pattern (cached)
 */
export interface DomainPattern {
  domain: string;
  tier: 'api' | 'structured' | 'selector';
  config: {
    // For API tier
    apiEndpoint?: string;
    apiMethod?: string;
    apiDataPath?: string;

    // For selector tier
    selectors?: {
      container?: string;
      year?: string;
      make?: string;
      model?: string;
      price?: string;
      mileage?: string;
      vin?: string;
      image?: string;
      url?: string;
    };

    // For structured data tier
    schemaType?: string;
  };
  lastUsed: Date;
  successRate: number;
}

/**
 * Scraping request
 */
export interface ScrapeRequest {
  url: string;
  useCachedPattern?: boolean;
  maxPages?: number;
}

/**
 * Scraping response
 */
export interface ScrapeResponse {
  success: boolean;
  vehicles: Vehicle[];
  tier: string;
  confidence: string;
  error?: string;
  pagesScraped: number;
  duration: number;
}
