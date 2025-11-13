// =====================================================
// UNIFIED SCRAPER CORE
// =====================================================
// Main scraping orchestrator used by both scrapers
// Handles URL discovery, pagination, detail pages, and VIN enrichment

import type { ParsedVehicle, ScraperConfig, ScrapeResult } from './types.ts';
import { DEFAULT_SCRAPER_CONFIG } from './types.ts';
import { normalizeUrl, resolveUrl, getBaseUrl } from './url-normalizer.ts';
import { parseInventoryHTML } from './parser-unified.ts';
import { enrichVehicleWithVIN } from './vin-decoder.ts';

/**
 * Main scraping function - orchestrates the entire scraping process
 *
 * @param url - Website URL to scrape
 * @param config - Optional scraper configuration
 * @returns Complete list of vehicles found on the website
 */
export async function scrapeWebsite(
  url: string,
  config?: Partial<ScraperConfig>
): Promise<ParsedVehicle[]> {
  const startTime = Date.now();

  // Merge with default config
  const finalConfig: ScraperConfig = {
    ...DEFAULT_SCRAPER_CONFIG,
    ...config,
  };

  console.log(`🚀 Starting scrape of ${url}`);
  console.log(`   Config: concurrency=${finalConfig.maxConcurrency}, delay=${finalConfig.pageDelay}ms`);

  try {
    // Step 1: Normalize URL
    const normalizedUrl = normalizeUrl(url);
    console.log(`✅ Normalized URL: ${normalizedUrl}`);

    // Step 2: Discover all inventory pages
    const inventoryUrls = await discoverInventoryPages(normalizedUrl, finalConfig);
    console.log(`📄 Found ${inventoryUrls.length} inventory URL(s) to check`);

    // Step 3: Fetch all listing pages and follow pagination
    const allVehicles = await fetchAllInventoryPages(inventoryUrls, finalConfig);
    console.log(`🚗 Found ${allVehicles.length} total vehicles across all pages`);

    // Step 4: Fetch detail pages for complete data
    const detailedVehicles = await fetchDetailPages(allVehicles, finalConfig);
    console.log(`✅ Successfully fetched ${detailedVehicles.length} detail pages`);

    // Step 5: Enrich with VIN decoder for missing data
    const enrichedVehicles = await enrichVehicles(detailedVehicles);
    console.log(`✨ Enriched ${enrichedVehicles.length} vehicles with VIN decoder`);

    const duration = Date.now() - startTime;
    console.log(`✅ Scraping complete in ${(duration / 1000).toFixed(1)}s - Found ${enrichedVehicles.length} vehicles`);

    return enrichedVehicles;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Scraping failed after ${(duration / 1000).toFixed(1)}s:`, error);
    throw error;
  }
}

/**
 * Discover all potential inventory pages on a website
 * Tries multiple common patterns to maximize vehicle discovery
 */
async function discoverInventoryPages(baseUrl: string, config: ScraperConfig): Promise<string[]> {
  const urls = new Set<string>();
  const baseUrlOnly = getBaseUrl(baseUrl);

  // Common inventory page patterns
  const inventoryPaths = [
    '/inventory',
    '/used-cars',
    '/vehicles',
    '/cars',
    '/used-inventory',
    '/pre-owned',
    '/search',
    '/stock',
    '/cars-for-sale',
    '/used-vehicles',
    '/inventory.html',
    '/inventory.php',
    '',  // Try homepage too
  ];

  // First, try to fetch the provided URL or homepage
  try {
    console.log(`Checking provided URL: ${baseUrl}`);
    const response = await fetchPage(baseUrl, config);
    const html = await response.text();

    // Look for links that might lead to inventory
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    const matches = [...html.matchAll(linkRegex)];

    for (const match of matches) {
      const href = match[1];
      const text = match[2].toLowerCase();

      // Check if link text suggests inventory
      if (
        text.includes('inventory') ||
        text.includes('vehicles') ||
        text.includes('cars') ||
        text.includes('search') ||
        text.includes('browse')
      ) {
        try {
          const fullUrl = resolveUrl(href, baseUrl);
          urls.add(fullUrl);
        } catch {
          // Invalid URL, skip
        }
      }
    }
  } catch (error) {
    console.log(`Failed to fetch homepage: ${(error as Error).message}`);
  }

  // Add common inventory paths
  for (const path of inventoryPaths) {
    urls.add(`${baseUrlOnly}${path}`);
  }

  // Convert to array and test each URL (with HEAD requests for speed)
  const validUrls: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': config.userAgent,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        validUrls.push(url);
        console.log(`✓ Valid inventory URL: ${url}`);
      }
    } catch {
      // URL not accessible, skip
    }
  }

  // If no valid URLs found, at least try the base URL
  if (validUrls.length === 0) {
    validUrls.push(baseUrl);
  }

  return validUrls;
}

/**
 * Fetch all inventory pages including pagination
 */
async function fetchAllInventoryPages(
  inventoryUrls: string[],
  config: ScraperConfig
): Promise<ParsedVehicle[]> {
  const allVehicles: ParsedVehicle[] = [];
  const seenUrls = new Set<string>();

  for (const inventoryUrl of inventoryUrls) {
    console.log(`📄 Fetching inventory from: ${inventoryUrl}`);

    try {
      // Fetch first page
      let currentPage = 1;
      let html = await fetchPage(inventoryUrl, config).then((r) => r.text());
      let vehicles = parseInventoryHTML(html, inventoryUrl);

      // Add unique vehicles
      vehicles.forEach((v) => {
        if (v.url && !seenUrls.has(v.url)) {
          seenUrls.add(v.url);
          allVehicles.push(v);
        }
      });

      console.log(`📄 Page ${currentPage}: Found ${vehicles.length} vehicles (${allVehicles.length} total unique)`);

      // Follow pagination links
      while (currentPage < config.maxPages) {
        const nextPageUrl = findNextPageUrl(html, inventoryUrl, currentPage);

        if (!nextPageUrl) {
          console.log(`✅ No more pages found for ${inventoryUrl}`);
          break;
        }

        console.log(`📄 Fetching page ${currentPage + 1}: ${nextPageUrl}`);

        try {
          html = await fetchPage(nextPageUrl, config).then((r) => r.text());
          vehicles = parseInventoryHTML(html, nextPageUrl);

          // Check if we got any new vehicles
          let newVehicles = 0;
          vehicles.forEach((v) => {
            if (v.url && !seenUrls.has(v.url)) {
              seenUrls.add(v.url);
              allVehicles.push(v);
              newVehicles++;
            }
          });

          console.log(`📄 Page ${currentPage + 1}: Found ${vehicles.length} vehicles (${newVehicles} new, ${allVehicles.length} total)`);

          // If no new vehicles found, we've reached the end
          if (newVehicles === 0) {
            console.log(`✅ No new vehicles on page ${currentPage + 1}, stopping pagination`);
            break;
          }

          currentPage++;

          // Small delay between pages
          await new Promise((resolve) => setTimeout(resolve, config.pageDelay));
        } catch (error) {
          console.error(`Failed to fetch page ${currentPage + 1}: ${(error as Error).message}`);
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${inventoryUrl}: ${(error as Error).message}`);
      continue;
    }
  }

  return allVehicles;
}

/**
 * Find the next page URL from HTML
 */
function findNextPageUrl(html: string, baseUrl: string, currentPage: number): string | null {
  // Strategy 1: Look for "Next" button/link
  const nextPatterns = [
    /<a[^>]*href=["']([^"']+)["'][^>]*>(?:<[^>]*>)*\s*(?:Next|›|»|&gt;|&raquo;)\s*(?:<[^>]*>)*<\/a>/gi,
    /<a[^>]*class="[^"]*next[^"]*"[^>]*href=["']([^"']+)["']/gi,
  ];

  for (const pattern of nextPatterns) {
    const match = html.match(pattern);
    if (match) {
      const hrefMatch = match[0].match(/href=["']([^"']+)["']/);
      if (hrefMatch) {
        try {
          return resolveUrl(hrefMatch[1], baseUrl);
        } catch {
          continue;
        }
      }
    }
  }

  // Strategy 2: Look for page number links
  const nextPage = currentPage + 1;
  const pagePatterns = [
    new RegExp(`<a[^>]*href=["']([^"']*[?&]page=${nextPage}[^"']*)["']`, 'i'),
    new RegExp(`<a[^>]*href=["']([^"']*[?&]p=${nextPage}[^"']*)["']`, 'i'),
    new RegExp(`<a[^>]*href=["']([^"']*/page/${nextPage}[^"']*)["']`, 'i'),
  ];

  for (const pattern of pagePatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return resolveUrl(match[1], baseUrl);
      } catch {
        continue;
      }
    }
  }

  // Strategy 3: Try common pagination URL patterns
  const url = new URL(baseUrl);
  const commonPatterns = [
    `${url.pathname}?page=${nextPage}`,
    `${url.pathname}?p=${nextPage}`,
    `${url.pathname}/page/${nextPage}`,
  ];

  // Only try these if we see evidence of pagination in HTML
  if (html.includes('page') || html.includes('pagination') || html.includes('Next')) {
    for (const pattern of commonPatterns) {
      try {
        return resolveUrl(pattern, baseUrl);
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Fetch detail pages for all vehicles
 */
async function fetchDetailPages(vehicles: ParsedVehicle[], config: ScraperConfig): Promise<ParsedVehicle[]> {
  const detailed: ParsedVehicle[] = [];
  let successCount = 0;
  let failCount = 0;

  console.log(`📊 Fetching details for ${vehicles.length} vehicles...`);

  for (let i = 0; i < vehicles.length; i += config.maxConcurrency) {
    const batch = vehicles.slice(i, i + config.maxConcurrency);

    const promises = batch.map(async (vehicle) => {
      if (!vehicle.url) return vehicle;

      try {
        const response = await fetchPage(vehicle.url, config);
        const html = await response.text();

        // Parse detail page
        const parsed = parseInventoryHTML(html, vehicle.url);

        // Merge with original vehicle data (prefer detail page data)
        const merged = parsed.length > 0 ? { ...vehicle, ...parsed[0] } : vehicle;

        successCount++;
        return merged;
      } catch (error) {
        failCount++;
        console.error(`Failed to fetch detail page ${i + batch.indexOf(vehicle) + 1}/${vehicles.length}: ${vehicle.url}`);
        return vehicle;
      }
    });

    const results = await Promise.all(promises);
    detailed.push(...results);

    // Progress update
    if ((i + config.maxConcurrency) % 10 === 0 || i + config.maxConcurrency >= vehicles.length) {
      console.log(`📊 Progress: ${Math.min(i + config.maxConcurrency, vehicles.length)}/${vehicles.length} (${successCount} success, ${failCount} failed)`);
    }

    // Delay between batches
    if (i + config.maxConcurrency < vehicles.length) {
      await new Promise((resolve) => setTimeout(resolve, config.pageDelay));
    }
  }

  console.log(`✅ Completed: ${successCount}/${vehicles.length} detail pages fetched`);
  return detailed;
}

/**
 * Enrich vehicles with VIN decoder
 */
async function enrichVehicles(vehicles: ParsedVehicle[]): Promise<ParsedVehicle[]> {
  const enriched: ParsedVehicle[] = [];

  for (const vehicle of vehicles) {
    const enrichedVehicle = await enrichVehicleWithVIN(vehicle);
    enriched.push(enrichedVehicle);
  }

  return enriched;
}

/**
 * Fetch a single page with proper headers and error handling
 */
async function fetchPage(url: string, config: ScraperConfig): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response;
}
