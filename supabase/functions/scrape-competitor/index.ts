import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price?: number;
  mileage?: number;
  url?: string;
}

interface CompetitorStats {
  vehicle_count: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  avg_mileage: number | null;
  min_mileage: number | null;
  max_mileage: number | null;
  total_inventory_value: number | null;
  top_makes: Record<string, number>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, name } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Competitor URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    console.log(`🔍 Scanning competitor: ${url}`);

    // Step 1: Discover inventory page
    const inventoryUrl = await discoverInventoryPage(url);
    console.log(`📄 Found inventory page: ${inventoryUrl}`);

    // Step 2: Fetch and parse listing page
    const listingHtml = await fetchPage(inventoryUrl);
    const vehicles = parseInventoryHTML(listingHtml, inventoryUrl);
    console.log(`🚗 Found ${vehicles.length} vehicles on listing page`);

    // Step 3: Sample vehicles for detail page fetching (every 3rd vehicle)
    const sampleSize = Math.max(20, Math.ceil(vehicles.length / 3)); // At least 20 or 1/3 of total
    const sampledVehicles = vehicles.filter((_, index) => index % 3 === 0).slice(0, sampleSize);
    console.log(`📊 Sampling ${sampledVehicles.length} vehicles for detailed analysis`);

    // Step 4: Fetch detail pages for sampled vehicles
    const detailedSample = await fetchDetailPages(sampledVehicles);
    console.log(`✅ Successfully fetched ${detailedSample.length} detail pages`);

    // Step 5: Calculate aggregated stats
    const stats = calculateStats(vehicles, detailedSample);
    console.log(`📈 Stats calculated:`, stats);

    const duration = Date.now() - startTime;

    // Return results directly (no database storage for public competitor research)
    console.log(`✅ Competitor scan complete in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          competitor_url: url,
          competitor_name: name || new URL(url).hostname,
          scanned_at: new Date().toISOString(),
          vehicle_count: stats.vehicle_count,
          avg_price: stats.avg_price,
          min_price: stats.min_price,
          max_price: stats.max_price,
          avg_mileage: stats.avg_mileage,
          min_mileage: stats.min_mileage,
          max_mileage: stats.max_mileage,
          total_inventory_value: stats.total_inventory_value,
          top_makes: stats.top_makes,
          scraping_duration_ms: duration,
        },
        message: `Scanned ${stats.vehicle_count} vehicles in ${(duration / 1000).toFixed(1)}s`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error scanning competitor:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to scan competitor website',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Discover inventory page
async function discoverInventoryPage(baseUrl: string): Promise<string> {
  const url = new URL(baseUrl);
  const possiblePaths = [
    '/inventory',
    '/inventory.html',
    '/vehicles',
    '/used-cars',
    '/cars',
    '/shop',
    '',
  ];

  for (const path of possiblePaths) {
    const testUrl = `${url.protocol}//${url.host}${path}`;
    try {
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (response.ok) {
        return testUrl;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  // Fallback to base URL
  return baseUrl;
}

// Helper: Fetch page HTML
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return await response.text();
}

// Helper: Fetch detail pages for sampled vehicles
async function fetchDetailPages(vehicles: ParsedVehicle[]): Promise<ParsedVehicle[]> {
  const detailed: ParsedVehicle[] = [];
  const concurrency = 5; // Fetch 5 at a time

  for (let i = 0; i < vehicles.length; i += concurrency) {
    const batch = vehicles.slice(i, i + concurrency);
    const promises = batch.map(async (vehicle) => {
      if (!vehicle.url) return vehicle;

      try {
        const html = await fetchPage(vehicle.url);
        // Parse detail page
        const parsed = parseInventoryHTML(html, vehicle.url);
        // Return first parsed vehicle (detail page should have one) or original
        return parsed.length > 0 ? { ...vehicle, ...parsed[0] } : vehicle;
      } catch (error) {
        console.error(`Failed to fetch detail page: ${vehicle.url}`, error);
        return vehicle; // Return original if fetch fails
      }
    });

    const results = await Promise.all(promises);
    detailed.push(...results);

    // Small delay between batches to be respectful
    if (i + concurrency < vehicles.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return detailed;
}

// Helper: Simplified inventory parser with improved detection
function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  console.log('Starting HTML parsing...');

  // Strategy 1: Look for JSON-LD structured data (most reliable)
  const jsonLdVehicles = parseJSONLD(html, baseUrl);
  if (jsonLdVehicles.length > 0) {
    console.log(`Found ${jsonLdVehicles.length} vehicles via JSON-LD`);
    return jsonLdVehicles;
  }

  // Strategy 2: Look for vehicle card patterns with improved regex
  // Use non-greedy matching and limit depth
  const cardPatterns = [
    // Look for divs with vehicle-related classes, limit nesting
    /<div[^>]*class="[^"]*(?:vehicle|inventory|car|listing|item)[^"]*"[^>]*>(?:[^<]|<(?!\/div))*?<\/div>/gi,
    // Articles (common in modern sites)
    /<article[^>]*class="[^"]*(?:vehicle|car|listing|item)[^"]*"[^>]*>(?:[^<]|<(?!\/article))*?<\/article>/gi,
    // List items
    /<li[^>]*class="[^"]*(?:vehicle|inventory|car|item)[^"]*"[^>]*>(?:[^<]|<(?!\/li))*?<\/li>/gi,
  ];

  // Try to find repeating patterns (indicates vehicle cards)
  for (const pattern of cardPatterns) {
    const matches = [...html.matchAll(pattern)];
    console.log(`Pattern found ${matches.length} potential matches`);

    // Need at least 2 matches to be confident it's a listing page
    if (matches.length >= 2) {
      for (const match of matches) {
        const cardHtml = match[0];
        const vehicle = parseVehicleCard(cardHtml, baseUrl);

        // Only include if we found substantial info
        if ((vehicle.year && vehicle.make) || vehicle.price) {
          vehicles.push(vehicle);
        }
      }

      if (vehicles.length > 0) {
        console.log(`Successfully parsed ${vehicles.length} vehicles from cards`);
        break; // Use first successful strategy
      }
    }
  }

  // Strategy 3: If no cards found, look for year+make patterns (simple counting)
  if (vehicles.length === 0) {
    console.log('No cards found, trying text-based vehicle detection...');
    const yearMakePattern = /\b(20\d{2}|19\d{2})\s+(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Mazda|Subaru|Kia|Hyundai|BMW|Mercedes|Audi|Lexus|Volkswagen|VW)\s+(\w+)/gi;
    const textMatches = [...html.matchAll(yearMakePattern)];

    console.log(`Found ${textMatches.length} year+make patterns in text`);

    // Group by unique combinations to avoid duplicates
    const uniqueVehicles = new Set<string>();
    for (const match of textMatches) {
      const key = `${match[1]}-${match[2]}-${match[3]}`.toLowerCase();
      if (!uniqueVehicles.has(key)) {
        uniqueVehicles.add(key);
        vehicles.push({
          year: parseInt(match[1]),
          make: match[2],
          model: match[3],
        });
      }
    }

    console.log(`Extracted ${vehicles.length} unique vehicles from text patterns`);
  }

  // Strategy 4: Last resort - parse entire page as single vehicle (detail page)
  if (vehicles.length === 0) {
    console.log('Trying to parse as single vehicle detail page...');
    const vehicle = parseVehicleCard(html, baseUrl);
    if (vehicle.year || vehicle.make || vehicle.price) {
      vehicles.push(vehicle);
      console.log('Parsed as single vehicle detail page');
    }
  }

  console.log(`Total vehicles parsed: ${vehicles.length}`);
  return vehicles;
}

// Helper: Parse JSON-LD structured data
function parseJSONLD(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  try {
    const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
    const matches = [...html.matchAll(jsonLdPattern)];

    for (const match of matches) {
      try {
        const data = JSON.parse(match[1]);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'Car' || item['@type'] === 'Vehicle') {
            const vehicle: ParsedVehicle = {
              year: item.modelDate ? parseInt(item.modelDate) : item.vehicleModelDate ? parseInt(item.vehicleModelDate) : undefined,
              make: item.brand?.name || item.manufacturer?.name,
              model: item.model?.name || item.model,
              price: item.offers?.price ? parseFloat(item.offers.price) : undefined,
              mileage: item.mileageFromOdometer?.value ? parseInt(item.mileageFromOdometer.value) : undefined,
              url: item.url ? new URL(item.url, baseUrl).href : undefined,
            };

            if (vehicle.year || vehicle.make) {
              vehicles.push(vehicle);
            }
          }
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }
  } catch (e) {
    // Parsing error, return empty
  }

  return vehicles;
}

// Helper: Parse individual vehicle card
function parseVehicleCard(html: string, baseUrl: string): ParsedVehicle {
  const vehicle: ParsedVehicle = {};

  // Extract year (4-digit number between 1990-2030)
  const yearMatch = html.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) vehicle.year = parseInt(yearMatch[1]);

  // Extract make (common brands)
  const makePattern = /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Volkswagen|VW|Mazda|Subaru|Kia|Hyundai|BMW|Mercedes|Audi|Lexus|Acura|Infiniti|Cadillac|Buick|Lincoln|Chrysler|Mitsubishi|Volvo|Land Rover|Jaguar|Porsche|Tesla|Rivian)\b/i;
  const makeMatch = html.match(makePattern);
  if (makeMatch) vehicle.make = makeMatch[1];

  // Extract price
  const pricePattern = /\$\s*([\d,]+)/;
  const priceMatch = html.match(pricePattern);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (price > 1000 && price < 500000) vehicle.price = price;
  }

  // Extract mileage
  const mileagePattern = /([\d,]+)\s*(?:mi|miles|km)/i;
  const mileageMatch = html.match(mileagePattern);
  if (mileageMatch) {
    const mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
    if (mileage < 1000000) vehicle.mileage = mileage;
  }

  // Extract URL
  const urlPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>/i;
  const urlMatch = html.match(urlPattern);
  if (urlMatch) {
    try {
      const url = new URL(urlMatch[1], baseUrl);
      // Only include URLs that look like vehicle detail pages
      if (url.href.includes('/vehicle') ||
          url.href.includes('/inventory') ||
          url.href.includes('/car') ||
          /\/\d+/.test(url.pathname)) {
        vehicle.url = url.href;
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  return vehicle;
}

// Helper: Calculate aggregated stats
function calculateStats(allVehicles: ParsedVehicle[], detailedSample: ParsedVehicle[]): CompetitorStats {
  // Count makes from all vehicles (usually available on listing page)
  const makeCounts: Record<string, number> = {};
  allVehicles.forEach((v) => {
    if (v.make) {
      const make = v.make.toUpperCase();
      makeCounts[make] = (makeCounts[make] || 0) + 1;
    }
  });

  // Sort and get top 5 makes
  const topMakes = Object.entries(makeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .reduce((acc, [make, count]) => ({ ...acc, [make]: count }), {});

  // Calculate price/mileage stats from detailed sample
  const prices = detailedSample.filter((v) => v.price !== undefined).map((v) => v.price!);
  const mileages = detailedSample.filter((v) => v.mileage !== undefined).map((v) => v.mileage!);

  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  const avgMileage = mileages.length > 0 ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length) : null;
  const minMileage = mileages.length > 0 ? Math.min(...mileages) : null;
  const maxMileage = mileages.length > 0 ? Math.max(...mileages) : null;

  // Estimate total inventory value
  const totalInventoryValue = avgPrice ? avgPrice * allVehicles.length : null;

  return {
    vehicle_count: allVehicles.length,
    avg_price: avgPrice ? Math.round(avgPrice) : null,
    min_price: minPrice,
    max_price: maxPrice,
    avg_mileage: avgMileage,
    min_mileage: minMileage,
    max_mileage: maxMileage,
    total_inventory_value: totalInventoryValue ? Math.round(totalInventoryValue) : null,
    top_makes: topMakes,
  };
}
