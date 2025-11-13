// =====================================================
// FIRECRAWL FALLBACK - Optional Premium Scraper
// =====================================================
// Use Firecrawl API as a fallback for sites that fail with standard scraping
// This is OPTIONAL - only needed if you want to maximize success rate
// Cost: 1 credit per page (see pricing at https://firecrawl.dev/pricing)

export interface FirecrawlConfig {
  apiKey: string;
  enabled: boolean;  // Set to false to disable Firecrawl
}

export interface FirecrawlResult {
  success: boolean;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
  };
  error?: string;
}

/**
 * Scrape a URL using Firecrawl API
 */
export async function scrapeWithFirecrawl(
  url: string,
  config: FirecrawlConfig
): Promise<FirecrawlResult> {
  if (!config.enabled) {
    return {
      success: false,
      error: 'Firecrawl is disabled in config',
    };
  }

  if (!config.apiKey) {
    return {
      success: false,
      error: 'Firecrawl API key not configured',
    };
  }

  try {
    console.log(`🔥 Calling Firecrawl API for ${url}...`);

    const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,  // Extract main content only
        waitFor: 2000,          // Wait 2 seconds for JS to load
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firecrawl API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown Firecrawl error');
    }

    console.log(`✅ Firecrawl successfully scraped ${url}`);

    return {
      success: true,
      markdown: data.markdown,
      metadata: data.metadata,
    };

  } catch (error) {
    console.error(`❌ Firecrawl failed for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Extract vehicle data from Firecrawl markdown output
 * Firecrawl returns clean markdown, so we can use regex patterns
 */
export function parseFirecrawlMarkdown(markdown: string, url: string): any {
  const vehicle: any = { url };

  // Extract year (4 digits)
  const yearMatch = markdown.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    vehicle.year = parseInt(yearMatch[1]);
  }

  // Extract make
  const makePattern = /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|Volvo)\b/i;
  const makeMatch = markdown.match(makePattern);
  if (makeMatch) {
    vehicle.make = makeMatch[1];
  }

  // Extract model (word after make)
  if (vehicle.make && makeMatch) {
    const afterMake = markdown.substring(makeMatch.index! + makeMatch[0].length);
    const modelMatch = afterMake.match(/^\s+([A-Za-z0-9][A-Za-z0-9\s\-]{0,30}?)(?:\s|$|\n)/);
    if (modelMatch) {
      vehicle.model = modelMatch[1].trim();
    }
  }

  // Extract price
  const priceMatch = markdown.match(/\$\s*([\d,]+)/);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (price >= 1000 && price <= 500000) {
      vehicle.price = price;
    }
  }

  // Extract mileage
  const mileageMatch = markdown.match(/([\d,]+)\s*(?:mi|miles)\b/i);
  if (mileageMatch) {
    const mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
    if (mileage >= 0 && mileage <= 500000) {
      vehicle.mileage = mileage;
    }
  }

  // Extract VIN
  const vinMatch = markdown.match(/VIN[:\s#]*([A-HJ-NPR-Z0-9]{17})\b/i);
  if (vinMatch) {
    vehicle.vin = vinMatch[1].toUpperCase();
  }

  return vehicle;
}

/**
 * Wrapper function: Try Firecrawl and parse result
 */
export async function scrapeVehicleWithFirecrawl(
  url: string,
  config: FirecrawlConfig
): Promise<any | null> {
  const result = await scrapeWithFirecrawl(url, config);

  if (!result.success || !result.markdown) {
    console.log(`Firecrawl failed: ${result.error}`);
    return null;
  }

  const vehicle = parseFirecrawlMarkdown(result.markdown, url);

  // Add metadata if available
  if (result.metadata?.ogImage) {
    vehicle.images = [result.metadata.ogImage];
  }

  // Mark as Firecrawl-sourced
  vehicle._source = 'firecrawl';
  vehicle._metadata = result.metadata;

  return vehicle;
}
