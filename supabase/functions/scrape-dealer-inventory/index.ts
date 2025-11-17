// =====================================================
// DEALER CO-PILOT: WEBSITE SCRAPING EDGE FUNCTION
// =====================================================
// This function scrapes dealer websites to track inventory
// and automatically build sales history for AI recommendations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseInventoryHTML } from './parser.ts';
import { getSitemapCache, getActualListingDate, type SitemapCache } from './dateExtractor.ts';
import { enrichVehicleWithVIN } from './vinDecoder.ts';

// Scraper service URLs (deployed on DigitalOcean)
// Python scraper has better bot detection bypass, try it first
const PYTHON_SCRAPER_URL = Deno.env.get('PYTHON_SCRAPER_URL') || 'https://python-scraper-6tzlk.ondigitalocean.app';
const PLAYWRIGHT_SERVICE_URL = Deno.env.get('PLAYWRIGHT_SERVICE_URL') || 'https://squid-app-vew3y.ondigitalocean.app';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapingResult {
  tenant_id: string;
  tenant_name: string;
  website_url: string;
  vehicles_found: number;
  new_vehicles: number;
  updated_vehicles: number;
  sold_vehicles: number;
  status: 'success' | 'partial' | 'failed';
  error?: string;
  duration_ms: number;
  scraper_method?: 'python' | 'playwright' | 'html_parser' | 'mixed';
  scraper_tier?: string;
  scraper_confidence?: string;
}

/**
 * Enhance vehicle data by fetching individual vehicle pages
 * This extracts complete details including VINs, stock numbers, and additional specs
 */
async function enhanceVehicleData(vehicles: any[]): Promise<any[]> {
  const enhancedVehicles: any[] = [];

  // Process vehicles in parallel with a concurrency limit
  const concurrencyLimit = 5; // Fetch 5 pages at a time to be respectful

  for (let i = 0; i < vehicles.length; i += concurrencyLimit) {
    const batch = vehicles.slice(i, Math.min(i + concurrencyLimit, vehicles.length));

    const batchPromises = batch.map(async (vehicle) => {
      // Check if we have all critical data already
      const hasCriticalData = vehicle.year && vehicle.make && vehicle.model &&
                              vehicle.price && vehicle.mileage && vehicle.vin;

      // Only fetch detail page if missing critical information
      if (vehicle.url && !hasCriticalData) {
        try {
          console.log(`⚠️ Missing critical data for ${vehicle.year} ${vehicle.make} ${vehicle.model || ''} - fetching details...`);

          const response = await fetch(vehicle.url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
            },
            signal: AbortSignal.timeout(15000), // 15 second timeout
          });

          if (response.ok) {
            const html = await response.text();

            // Parse the detail page for additional data
            const detailVehicles = parseInventoryHTML(html, vehicle.url);

            if (detailVehicles.length > 0) {
              const detailVehicle = detailVehicles[0];

              // CRITICAL: Validate that detail page matches the original vehicle
              // to avoid mixing data from different vehicles
              const yearMatches = !vehicle.year || !detailVehicle.year ||
                                  vehicle.year === detailVehicle.year;
              const makeMatches = !vehicle.make || !detailVehicle.make ||
                                  vehicle.make.toLowerCase() === detailVehicle.make.toLowerCase();

              if (yearMatches && makeMatches) {
                // Safe to merge - vehicles match
                const merged = {
                  ...vehicle, // Keep original data as base
                  // Only override with detail data if it exists and is not empty
                  vin: detailVehicle.vin || vehicle.vin,
                  stock_number: detailVehicle.stock_number || vehicle.stock_number,
                  mileage: detailVehicle.mileage || vehicle.mileage,
                  // Don't fetch trim/color - not needed
                  // Prefer detail page model if listing page didn't have it
                  model: vehicle.model || detailVehicle.model,
                  // Only keep first image - use detail page first image if exists
                  image_url: vehicle.image_url || (detailVehicle.images && detailVehicle.images.length > 0
                                                   ? detailVehicle.images[0]
                                                   : null),
                  url: vehicle.url, // Always keep the original URL
                };

                console.log(`✅ Enhanced with detail page data`);
                // If we have a VIN but still missing year/make/model, try VIN decoder
                return await enrichVehicleWithVIN(merged);
              } else {
                // Vehicles don't match - keep original data only
                console.log(`⚠️ Vehicle mismatch: listing shows ${vehicle.year} ${vehicle.make}, detail page shows ${detailVehicle.year} ${detailVehicle.make}. Keeping listing data.`);

                // Still try VIN decoder if we have VIN but missing data
                return await enrichVehicleWithVIN(vehicle);
              }
            }
          }
        } catch (error) {
          console.log(`Failed to fetch details for ${vehicle.url}: ${error.message}`);
        }
      } else if (vehicle.url && hasCriticalData) {
        // Skip detail page fetch - already have all critical data
        console.log(`✅ ${vehicle.year} ${vehicle.make} ${vehicle.model} - all critical data present, skipping detail fetch`);
      }

      // If we have VIN but missing data, try VIN decoder as final fallback
      if (vehicle.vin && (!vehicle.year || !vehicle.make || !vehicle.model)) {
        return await enrichVehicleWithVIN(vehicle);
      }

      // Return vehicle as-is if we couldn't enhance it
      return vehicle;
    });

    const batchResults = await Promise.all(batchPromises);
    enhancedVehicles.push(...batchResults);
  }

  return enhancedVehicles;
}

/**
 * Call Python scraper service (undetected-chromedriver)
 * Better bot detection bypass than Playwright
 */
async function scrapeWithPython(url: string): Promise<{ vehicles: any[], tier?: string, confidence?: string }> {
  try {
    if (!PYTHON_SCRAPER_URL) {
      console.log('⚠️  Python scraper URL not configured, skipping...');
      return { vehicles: [] };
    }

    console.log(`🐍 Calling Python scraper (priority) for: ${url}`);

    const response = await fetch(`${PYTHON_SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!response.ok) {
      throw new Error(`Python scraper returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || result.vehicles.length === 0) {
      console.log('⚠️  Python scraper returned no vehicles');
      return { vehicles: [], tier: result.tier, confidence: result.confidence };
    }

    console.log(`✅ Python scraper found ${result.vehicles.length} vehicles using Tier ${result.tier} (${result.confidence} confidence)`);
    console.log(`   Duration: ${result.duration}ms`);

    return {
      vehicles: result.vehicles,
      tier: result.tier,
      confidence: result.confidence
    };
  } catch (error) {
    console.error('❌ Python scraper failed:', error.message);
    return { vehicles: [] };
  }
}

/**
 * Call Playwright service to scrape a website
 * This uses the new 4-tier extraction system for more robust scraping
 */
async function scrapeWithPlaywright(url: string): Promise<{ vehicles: any[], tier?: string, confidence?: string }> {
  try {
    console.log(`📞 Calling Playwright service (fallback) for: ${url}`);

    const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        useCachedPattern: true, // Use cached patterns for speed
        maxPages: 5, // Limit pagination to avoid long scrapes
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for Playwright
    });

    if (!response.ok) {
      throw new Error(`Playwright service returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      console.error('❌ Playwright scrape failed:', result.error);
      return { vehicles: [], tier: result.tier, confidence: result.confidence };
    }

    console.log(`✅ Playwright found ${result.vehicles.length} vehicles using Tier ${result.tier} (${result.confidence} confidence)`);
    console.log(`   Duration: ${result.duration}ms`);

    return {
      vehicles: result.vehicles,
      tier: result.tier,
      confidence: result.confidence
    };
  } catch (error) {
    console.error('❌ Failed to call Playwright service:', error.message);
    return { vehicles: [] };
  }
}

/**
 * Find potential inventory pages on a dealer website
 */
async function findInventoryPages(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];

  // Normalize URL: add https:// if protocol is missing
  const normalizedUrl = baseUrl.match(/^https?:\/\//) ? baseUrl : `https://${baseUrl}`;

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
  ];

  // Parse base URL
  const url = new URL(normalizedUrl);
  const baseUrlClean = `${url.protocol}//${url.host}`;

  // First, try to fetch the homepage and look for inventory links
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
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
            const fullUrl = new URL(href, baseUrl).href;
            if (!urls.includes(fullUrl)) {
              urls.push(fullUrl);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    }
  } catch (error) {
    console.log('Error fetching homepage:', error.message);
  }

  // Add common inventory paths
  for (const path of inventoryPaths) {
    const fullUrl = `${baseUrlClean}${path}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  // If no specific URLs found, at least try the homepage
  if (urls.length === 0) {
    urls.push(baseUrl);
  }

  return urls;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 100000; // 100 seconds (leave buffer before 120s timeout)

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body (optional: can specify specific tenant)
    const { tenant_id } = await req.json().catch(() => ({}));

    // Get all active/trial tenants with website URLs (exclude only suspended/cancelled)
    let query = supabase
      .from('tenants')
      .select('id, name, website_url')
      .not('website_url', 'is', null)
      .not('status', 'in', '("suspended","cancelled")');

    if (tenant_id) {
      query = query.eq('id', tenant_id);
    }

    const { data: tenants, error: tenantsError } = await query;

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tenants with websites found',
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Starting scraping for ${tenants.length} tenant(s)...`);

    // Process each tenant
    const results: ScrapingResult[] = [];

    for (const tenant of tenants) {
      // Check if we're approaching timeout - leave time to return response
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log(`⏰ Approaching timeout, stopping after ${results.length} tenants`);
        break;
      }

      const tenantStartTime = Date.now();

      try {
        console.log(`Scraping ${tenant.name} (${tenant.website_url})...`);

        // Create snapshot record
        const { data: snapshot, error: snapshotError } = await supabase
          .from('inventory_snapshots')
          .insert({
            tenant_id: tenant.id,
            status: 'pending',
          })
          .select()
          .single();

        if (snapshotError) {
          throw new Error(`Failed to create snapshot: ${snapshotError.message}`);
        }

        // Try to find inventory pages
        const inventoryUrls = await findInventoryPages(tenant.website_url);

        console.log(`Found ${inventoryUrls.length} inventory URL(s) to scrape`);

        let vehicles: any[] = [];
        let usedPython = false;
        let usedPlaywright = false;
        let usedHtmlParser = false;
        let scraperTier: string | undefined;
        let scraperConfidence: string | undefined;

        // Try each inventory URL with cascading fallback system
        // Priority: Python (best bot bypass) → Playwright → HTML parser
        for (const url of inventoryUrls) {
          try {
            console.log(`Fetching ${url}...`);

            let pageVehicles: any[] = [];

            // TIER 1: Try Python scraper first (best bot detection bypass)
            const pythonResult = await scrapeWithPython(url);
            pageVehicles = pythonResult.vehicles;

            if (pageVehicles.length > 0) {
              usedPython = true;
              scraperTier = pythonResult.tier;
              scraperConfidence = pythonResult.confidence;
              console.log(`✅ Python scraper succeeded with ${pageVehicles.length} vehicles`);
            } else {
              // TIER 2: Fallback to Playwright if Python fails
              console.log('⚠️  Python scraper returned no vehicles, trying Playwright...');

              const playwrightResult = await scrapeWithPlaywright(url);
              pageVehicles = playwrightResult.vehicles;

              if (pageVehicles.length > 0) {
                usedPlaywright = true;
                scraperTier = playwrightResult.tier;
                scraperConfidence = playwrightResult.confidence;
                console.log(`✅ Playwright succeeded with ${pageVehicles.length} vehicles`);
              } else {
                // TIER 3: Final fallback to basic HTML parsing
                console.log('⚠️  Playwright returned no vehicles, falling back to HTML parsing...');
                usedHtmlParser = true;

                const response = await fetch(url, {
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                  },
                  signal: AbortSignal.timeout(30000), // 30 second timeout
                });

                if (!response.ok) {
                  console.log(`HTTP ${response.status} for ${url}, skipping...`);
                  continue;
                }

                const html = await response.text();

                // Parse inventory from HTML
                pageVehicles = parseInventoryHTML(html, url);

                if (pageVehicles.length > 0) {
                  console.log(`✅ HTML parser succeeded with ${pageVehicles.length} vehicles`);
                } else {
                  console.log(`❌ All extraction methods failed for ${url}`);
                }
              }
            }

            console.log(`Found ${pageVehicles.length} vehicles on ${url}`);

            vehicles = vehicles.concat(pageVehicles);

            // Continue checking all inventory URLs to catch pagination
            // Don't break early - we want all vehicles from all pages
          } catch (error) {
            console.log(`Error fetching ${url}:`, error.message);
            // Continue to next URL
          }
        }

        console.log(`Found ${vehicles.length} vehicles on ${tenant.name}`);

        // Log which scraper method was used
        let scraperMethod: 'python' | 'playwright' | 'html_parser' | 'mixed' = 'html_parser';

        if (usedPython && !usedPlaywright && !usedHtmlParser) {
          console.log(`🐍 Used Python scraper - Tier ${scraperTier} (${scraperConfidence} confidence)`);
          scraperMethod = 'python';
        } else if (usedPlaywright && !usedPython && !usedHtmlParser) {
          console.log(`🚀 Used Playwright scraper - Tier ${scraperTier} (${scraperConfidence} confidence)`);
          scraperMethod = 'playwright';
        } else if (usedPython || usedPlaywright || usedHtmlParser) {
          const methods = [];
          if (usedPython) methods.push(`Python (Tier ${scraperTier})`);
          if (usedPlaywright) methods.push(`Playwright (Tier ${scraperTier})`);
          if (usedHtmlParser) methods.push('HTML Parser');
          console.log(`🔀 Used mixed scraping - ${methods.join(' + ')}`);
          scraperMethod = 'mixed';
        } else {
          console.log(`📄 Used legacy HTML parser`);
          scraperMethod = 'html_parser';
        }

        // Log sample of what we found
        if (vehicles.length > 0) {
          const sample = vehicles[0];
          console.log(`Sample vehicle: ${sample.year} ${sample.make} ${sample.model} - $${sample.price} - ${sample.mileage}mi - ${sample.url} - ${sample.images?.length || 0} images`);
        }

        // Enhance vehicle data by fetching individual vehicle pages
        console.log('Fetching individual vehicle pages for complete data...');
        const enhancedVehicles = await enhanceVehicleData(vehicles);
        console.log(`Enhanced ${enhancedVehicles.length} vehicles with detailed information`);

        // Log enhanced sample
        if (enhancedVehicles.length > 0) {
          const sample = enhancedVehicles[0];
          console.log(`Enhanced sample: ${sample.year} ${sample.make} ${sample.model} - $${sample.price} - ${sample.mileage}mi - ${sample.url} - ${sample.images?.length || 0} images`);
        }

        // Get sitemap cache for accurate date extraction
        const sitemapCache = await getSitemapCache(supabase, tenant.id, tenant.website_url);
        console.log(`Loaded sitemap cache with ${Object.keys(sitemapCache).length} URLs`);

        // Process vehicles and update database
        const { newVehicles, updatedVehicles, soldVehicles } = await processVehicles(
          supabase,
          tenant.id,
          enhancedVehicles,
          sitemapCache
        );

        // Update snapshot with results
        await supabase
          .from('inventory_snapshots')
          .update({
            vehicles_found: enhancedVehicles.length,
            status: 'success',
            scraping_duration_ms: Date.now() - tenantStartTime,
            raw_data: enhancedVehicles,
          })
          .eq('id', snapshot.id);

        // Log success
        await supabase.from('scraping_logs').insert({
          tenant_id: tenant.id,
          snapshot_id: snapshot.id,
          log_level: 'info',
          message: `Successfully scraped ${enhancedVehicles.length} vehicles`,
          details: {
            new: newVehicles,
            updated: updatedVehicles,
            sold: soldVehicles,
          },
        });

        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          website_url: tenant.website_url,
          vehicles_found: enhancedVehicles.length,
          new_vehicles: newVehicles,
          updated_vehicles: updatedVehicles,
          sold_vehicles: soldVehicles,
          status: 'success',
          duration_ms: Date.now() - tenantStartTime,
          scraper_method: scraperMethod,
          scraper_tier: scraperTier,
          scraper_confidence: scraperConfidence,
        });
      } catch (error) {
        console.error(`Error scraping ${tenant.name}:`, error);

        // Log error
        await supabase.from('scraping_logs').insert({
          tenant_id: tenant.id,
          log_level: 'error',
          message: `Scraping failed: ${error.message}`,
          details: { error: error.toString() },
        });

        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          website_url: tenant.website_url,
          vehicles_found: 0,
          new_vehicles: 0,
          updated_vehicles: 0,
          sold_vehicles: 0,
          status: 'failed',
          error: error.message,
          duration_ms: Date.now() - tenantStartTime,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const timedOut = totalDuration > MAX_EXECUTION_TIME;

    return new Response(
      JSON.stringify({
        success: true,
        message: timedOut
          ? `Scraped ${results.length}/${tenants.length} tenant(s) in ${totalDuration}ms (timeout reached)`
          : `Scraped ${results.length} tenant(s) in ${totalDuration}ms`,
        results,
        summary: {
          total_tenants: results.length,
          requested_tenants: tenants.length,
          successful: results.filter((r) => r.status === 'success').length,
          failed: results.filter((r) => r.status === 'failed').length,
          total_vehicles: results.reduce((sum, r) => sum + r.vehicles_found, 0),
          duration_ms: totalDuration,
          timed_out: timedOut,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Scraping function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Process scraped vehicles and update database
 */
async function processVehicles(
  supabase: any,
  tenant_id: string,
  vehicles: any[],
  sitemapCache: SitemapCache = {}
): Promise<{ newVehicles: number; updatedVehicles: number; soldVehicles: number }> {
  let newVehicles = 0;
  let updatedVehicles = 0;

  const currentVINs = vehicles.map((v) => v.vin).filter(Boolean);

  // Process each vehicle
  for (const vehicle of vehicles) {
    // Generate a unique identifier for vehicles without VIN
    // Use stock_number if available, otherwise generate from year/make/model/mileage/color
    let identifier = vehicle.vin;
    if (!identifier) {
      if (vehicle.stock_number) {
        identifier = `STOCK_${vehicle.stock_number}`;
      } else if (vehicle.year && vehicle.make && vehicle.model) {
        // Create a pseudo-VIN from available data
        // Include mileage and color to differentiate similar vehicles
        const uniqueParts = [
          vehicle.year,
          vehicle.make,
          vehicle.model,
          vehicle.trim || '',
          vehicle.mileage || 0,
          vehicle.color || '',
          vehicle.price || 0,
        ].filter(Boolean); // Remove empty values

        identifier = uniqueParts.join('_').replace(/\s+/g, '_').toUpperCase();

        // If this identifier already exists in current batch, make it more unique with URL hash
        const existingInBatch = vehicles.slice(0, vehicles.indexOf(vehicle)).find(v => {
          const testId = v.vin || (v.year && v.make && v.model ?
            [v.year, v.make, v.model, v.trim || '', v.mileage || 0, v.color || '', v.price || 0]
              .filter(Boolean).join('_').replace(/\s+/g, '_').toUpperCase() : null);
          return testId === identifier;
        });

        if (existingInBatch || !identifier) {
          // Add URL hash as last resort for uniqueness
          const urlHash = vehicle.url ?
            vehicle.url.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') :
            Math.random().toString(36).substring(2, 10).toUpperCase();
          identifier = `${identifier}_${urlHash}`;
        }
      } else {
        console.log(`Skipping vehicle without enough identifying information:`, vehicle);
        continue; // Skip vehicles we can't identify
      }
    }

    // Check if vehicle exists in history (by VIN or generated identifier)
    const { data: existing } = await supabase
      .from('vehicle_history')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('vin', identifier)
      .eq('status', 'active')
      .single();

    if (!existing) {
      // New vehicle - Try to get actual listing date
      console.log(`New vehicle found: ${identifier}, extracting listing date...`);

      // Extract listing date using all available strategies including image filenames
      const listingDate = await getActualListingDate(
        '', // We don't have individual vehicle page HTML yet
        vehicle.url || '',
        sitemapCache,
        vehicle.imageDate // Pass the date extracted from vehicle images
      );

      console.log(`Listing date for ${identifier}: ${listingDate.date.toISOString()} (${listingDate.confidence}, ${listingDate.source})`);

      // Insert new vehicle with extracted listing date
      await supabase.from('vehicle_history').insert({
        tenant_id,
        vin: identifier, // Use identifier (real VIN or generated)
        stock_number: vehicle.stock_number,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        price: vehicle.price,
        mileage: vehicle.mileage,
        exterior_color: vehicle.color,
        listing_url: vehicle.url,
        image_urls: vehicle.images,
        first_seen_at: listingDate.date.toISOString(),
        listing_date_confidence: listingDate.confidence,
        listing_date_source: listingDate.source,
        last_seen_at: new Date().toISOString(),
        status: 'active',
        price_history: [{ date: new Date().toISOString(), price: vehicle.price }],
      });

      newVehicles++;
    } else {
      // Existing vehicle - Smart update: only update fields that have new data
      console.log(`Updating existing vehicle: ${identifier}`);

      const updates: any = {
        last_seen_at: new Date().toISOString(),
      };

      // Smart update: only update fields if new scrape found data
      if (vehicle.stock_number !== undefined && vehicle.stock_number !== null) {
        updates.stock_number = vehicle.stock_number;
      }
      if (vehicle.year !== undefined && vehicle.year !== null) {
        updates.year = vehicle.year;
      }
      if (vehicle.make !== undefined && vehicle.make !== null) {
        updates.make = vehicle.make;
      }
      if (vehicle.model !== undefined && vehicle.model !== null) {
        updates.model = vehicle.model;
      }
      if (vehicle.trim !== undefined && vehicle.trim !== null) {
        updates.trim = vehicle.trim;
      }
      if (vehicle.mileage !== undefined && vehicle.mileage !== null) {
        updates.mileage = vehicle.mileage;
        console.log(`  Updating mileage: ${existing.mileage} -> ${vehicle.mileage}`);
      } else {
        console.log(`  Preserving existing mileage: ${existing.mileage}`);
      }
      if (vehicle.color !== undefined && vehicle.color !== null) {
        updates.exterior_color = vehicle.color;
      }
      if (vehicle.url !== undefined && vehicle.url !== null) {
        updates.listing_url = vehicle.url;
      }
      // Only update images if we found a new image
      if (vehicle.images && vehicle.images.length > 0) {
        updates.image_urls = vehicle.images;
        console.log(`  Updating image: ${vehicle.images[0]}`);
      } else if (existing.image_urls && existing.image_urls.length > 0) {
        console.log(`  Preserving existing image`);
      }

      // Update price (keep price history for tracking, but don't change status)
      if (vehicle.price !== undefined && vehicle.price !== null) {
        if (existing.price !== vehicle.price) {
          const priceHistory = existing.price_history || [];
          priceHistory.push({
            date: new Date().toISOString(),
            price: vehicle.price,
          });
          updates.price = vehicle.price;
          updates.price_history = priceHistory;
          // Keep status as 'active' - no more price_changed status
          console.log(`  Price changed: ${existing.price} -> ${vehicle.price}`);
        } else {
          // Price same, just update it
          updates.price = vehicle.price;
        }
      }

      // Upgrade VIN if we now have a real VIN and previously had a generated identifier
      if (vehicle.vin && vehicle.vin.length === 17 && existing.vin !== vehicle.vin) {
        // Only update if the existing VIN looks generated (starts with STOCK_ or contains underscores)
        if (existing.vin.includes('_') || existing.vin.startsWith('STOCK_')) {
          updates.vin = vehicle.vin;
          console.log(`Upgrading identifier to real VIN: ${existing.vin} → ${vehicle.vin}`);
        }
      }

      await supabase
        .from('vehicle_history')
        .update(updates)
        .eq('id', existing.id);

      updatedVehicles++;
    }
  }

  // Find vehicles that disappeared (sold)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data: potentiallySold } = await supabase
    .from('vehicle_history')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('status', 'active')
    .lt('last_seen_at', twoDaysAgo.toISOString());

  let soldVehicles = 0;

  if (potentiallySold && potentiallySold.length > 0) {
    for (const vehicle of potentiallySold) {
      // Double check it's not in current scrape (check both real VINs and identifiers)
      const vehicleIdentifier = vehicle.vin;
      if (!currentVINs.includes(vehicleIdentifier) && !vehicles.some(v => {
        // Check if any current vehicle would generate the same identifier
        let currentId = v.vin;
        if (!currentId && v.stock_number) {
          currentId = `STOCK_${v.stock_number}`;
        } else if (!currentId && v.year && v.make && v.model) {
          // Use same logic as identifier generation
          const uniqueParts = [
            v.year,
            v.make,
            v.model,
            v.trim || '',
            v.mileage || 0,
            v.color || '',
            v.price || 0,
          ].filter(Boolean);
          currentId = uniqueParts.join('_').replace(/\s+/g, '_').toUpperCase();
        }
        return currentId === vehicleIdentifier || vehicleIdentifier.startsWith(currentId + '_');
      })) {
        console.log(`Vehicle ${vehicleIdentifier} marked as sold, creating sales record...`);

        // Calculate days to sale
        const firstSeen = new Date(vehicle.first_seen_at);
        const now = new Date();
        const daysListed = Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));

        // Mark vehicle as sold
        await supabase
          .from('vehicle_history')
          .update({ status: 'sold' })
          .eq('id', vehicle.id);

        // Create sales record (acquisition_cost and profit fields left null)
        await supabase.from('sales_records').insert({
          tenant_id: vehicle.tenant_id,
          vehicle_id: vehicle.vehicle_id,
          vin: vehicle.vin,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          sale_price: vehicle.price, // Last known listing price
          acquisition_cost: null,    // Unknown from scraping
          gross_profit: null,        // Can't calculate without acquisition cost
          margin_percent: null,      // Can't calculate without acquisition cost
          days_to_sale: daysListed,
          sale_date: now.toISOString().split('T')[0], // Format as YYYY-MM-DD
        });

        console.log(`Sales record created for ${vehicleIdentifier}: $${vehicle.price}, ${daysListed} days`);
        soldVehicles++;
      }
    }
  }

  return { newVehicles, updatedVehicles, soldVehicles };
}
