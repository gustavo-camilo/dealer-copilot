import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseInventoryHTML, type ParsedVehicle } from './parser.ts';

// =====================================================
// VIN DECODER - Inlined to avoid deployment issues
// =====================================================

interface VINDecodedData {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}

async function decodeVIN(vin: string): Promise<VINDecodedData | null> {
  if (!vin || vin.length !== 17) return null;

  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.Results || !Array.isArray(data.Results)) return null;

    const results = data.Results;
    const getValueByName = (name: string) => results.find((r: { Variable: string; Value: string }) => r.Variable === name)?.Value;

    const yearStr = getValueByName('Model Year');
    const make = getValueByName('Make');
    const model = getValueByName('Model');
    const trim = getValueByName('Trim');

    return {
      vin,
      year: yearStr ? parseInt(yearStr) : undefined,
      make: make || undefined,
      model: model || undefined,
      trim: trim || undefined,
    };
  } catch {
    return null;
  }
}

function toTitleCase(str: string): string {
  if (!str) return str;
  const words = str.split(/(\s+|-)/);
  return words.map(word => {
    if (word === ' ' || word === '-' || word.trim() === '') return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

async function enrichVehicleWithVIN(vehicle: ParsedVehicle): Promise<ParsedVehicle> {
  if (!vehicle.vin || vehicle.vin.length !== 17) return vehicle;
  if (vehicle.year && vehicle.make && vehicle.model) return vehicle;

  const decoded = await decodeVIN(vehicle.vin);
  if (!decoded) return vehicle;

  return {
    ...vehicle,
    year: vehicle.year || decoded.year,
    make: vehicle.make || (decoded.make ? toTitleCase(decoded.make) : undefined),
    model: vehicle.model || (decoded.model ? toTitleCase(decoded.model) : undefined),
    trim: vehicle.trim || decoded.trim,
  };
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id, tenants(subscription_tier)')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = userData.tenant_id;
    const subscriptionTier = userData.tenants?.subscription_tier || 'starter';

    const { url, name } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Competitor URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL: add https:// if protocol is missing
    const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

    const startTime = Date.now();
    console.log(`🔍 Scanning competitor: ${normalizedUrl} for tenant: ${tenantId}`);

    // Step 1: Discover inventory page
    const inventoryUrl = await discoverInventoryPage(normalizedUrl);
    console.log(`📄 Found inventory page: ${inventoryUrl}`);

    // Step 2: Fetch ALL pages (follow pagination)
    const allVehicles = await fetchAllPages(inventoryUrl);
    console.log(`🚗 Found ${allVehicles.length} total vehicles across all pages`);

    // Step 3: Fetch detail pages for ALL vehicles to get accurate data
    const detailedVehicles = await fetchDetailPages(allVehicles);
    console.log(`✅ Successfully fetched ${detailedVehicles.length} detail pages`);

    // Step 4: Calculate aggregated stats from all detailed vehicles
    const stats = calculateStats(detailedVehicles);
    console.log(`📈 Stats calculated:`, stats);

    const duration = Date.now() - startTime;

    const scanData = {
      competitor_url: normalizedUrl,
      competitor_name: name || new URL(normalizedUrl).hostname,
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
    };

    // Save to history table (for all tiers, but only Enterprise can view history)
    try {
      await supabase
        .from('competitor_scan_history')
        .insert({
          tenant_id: tenantId,
          competitor_url: normalizedUrl,
          competitor_name: name || new URL(normalizedUrl).hostname,
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
          status: 'success',
        });
      console.log(`✅ Saved scan to history for tenant: ${tenantId}`);
    } catch (historyError) {
      console.error('Failed to save scan history:', historyError);
      // Continue even if history save fails
    }

    // Update or insert into competitor_snapshots (current snapshot)
    try {
      const { error: upsertError } = await supabase
        .from('competitor_snapshots')
        .upsert(
          {
            tenant_id: tenantId,
            competitor_url: normalizedUrl,
            competitor_name: name || new URL(normalizedUrl).hostname,
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
            status: 'success',
            scanned_at: new Date().toISOString(),
          },
          {
            onConflict: 'tenant_id,competitor_url',
          }
        );

      if (upsertError) {
        console.error('Failed to update snapshot:', upsertError);
      } else {
        console.log(`✅ Updated current snapshot for tenant: ${tenantId}`);
      }
    } catch (snapshotError) {
      console.error('Failed to update snapshot:', snapshotError);
      // Continue even if snapshot update fails
    }

    console.log(`✅ Competitor scan complete in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scanData,
        message: `Scanned ${stats.vehicle_count} vehicles in ${(duration / 1000).toFixed(1)}s`,
        subscription_tier: subscriptionTier,
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
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout for HEAD requests
      });
      if (response.ok) {
        return testUrl;
      }
    } catch (error) {
      // Continue to next path
      console.log(`Failed to check ${testUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Fallback to base URL
  return baseUrl;
}

// Helper: Fetch page HTML
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return await response.text();
}

// Helper: Fetch all pages by following pagination
async function fetchAllPages(inventoryUrl: string): Promise<ParsedVehicle[]> {
  const allVehicles: ParsedVehicle[] = [];
  const seenUrls = new Set<string>();
  let currentPage = 1;
  const maxPages = 20; // Safety limit to prevent infinite loops

  console.log(`📄 Starting pagination from: ${inventoryUrl}`);

  // Fetch first page
  let html = await fetchPage(inventoryUrl);
  let vehicles = parseInventoryHTML(html, inventoryUrl);

  vehicles.forEach(v => {
    if (v.url && !seenUrls.has(v.url)) {
      seenUrls.add(v.url);
      allVehicles.push(v);
    }
  });

  console.log(`📄 Page ${currentPage}: Found ${vehicles.length} vehicles (${allVehicles.length} total)`);

  // Look for pagination links
  while (currentPage < maxPages) {
    const nextPageUrl = findNextPageUrl(html, inventoryUrl, currentPage);

    if (!nextPageUrl) {
      console.log(`✅ No more pages found. Total pages scanned: ${currentPage}`);
      break;
    }

    console.log(`📄 Fetching page ${currentPage + 1}: ${nextPageUrl}`);

    try {
      html = await fetchPage(nextPageUrl);
      vehicles = parseInventoryHTML(html, nextPageUrl);

      // Check if we got any new vehicles (to detect if we've reached the end)
      let newVehicles = 0;
      vehicles.forEach(v => {
        if (v.url && !seenUrls.has(v.url)) {
          seenUrls.add(v.url);
          allVehicles.push(v);
          newVehicles++;
        }
      });

      console.log(`📄 Page ${currentPage + 1}: Found ${vehicles.length} vehicles (${newVehicles} new, ${allVehicles.length} total)`);

      // If no new vehicles found, we've likely reached the end
      if (newVehicles === 0) {
        console.log(`✅ No new vehicles on page ${currentPage + 1}. Stopping pagination.`);
        break;
      }

      currentPage++;

      // Small delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`Failed to fetch page ${currentPage + 1}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }

  return allVehicles;
}

// Helper: Find the next page URL from HTML
function findNextPageUrl(html: string, baseUrl: string, currentPage: number): string | null {
  const url = new URL(baseUrl);

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
          return new URL(hrefMatch[1], baseUrl).href;
        } catch {
          continue;
        }
      }
    }
  }

  // Strategy 2: Look for page number links (page=2, page=3, etc.)
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
        return new URL(match[1], baseUrl).href;
      } catch {
        continue;
      }
    }
  }

  // Strategy 3: Try common pagination URL patterns
  const commonPatterns = [
    `${url.pathname}?page=${nextPage}`,
    `${url.pathname}?p=${nextPage}`,
    `${url.pathname}/page/${nextPage}`,
    `${url.pathname}${url.pathname.includes('?') ? '&' : '?'}page=${nextPage}`,
  ];

  // Only try these if we see evidence of pagination in the HTML
  if (html.includes('page') || html.includes('pagination') || html.includes('Next')) {
    for (const pattern of commonPatterns) {
      try {
        return new URL(pattern, baseUrl).href;
      } catch {
        continue;
      }
    }
  }

  return null;
}

// Helper: Fetch detail pages for ALL vehicles
async function fetchDetailPages(vehicles: ParsedVehicle[]): Promise<ParsedVehicle[]> {
  const detailed: ParsedVehicle[] = [];
  const concurrency = 5; // Process 5 at a time for better performance
  let successCount = 0;
  let failCount = 0;

  console.log(`📊 Fetching details for ${vehicles.length} vehicles...`);

  for (let i = 0; i < vehicles.length; i += concurrency) {
    const batch = vehicles.slice(i, i + concurrency);
    const promises = batch.map(async (vehicle) => {
      if (!vehicle.url) return vehicle;

      try {
        const html = await fetchPage(vehicle.url);
        // Parse detail page
        const parsed = parseInventoryHTML(html, vehicle.url);
        // Merge with original vehicle data
        const merged = parsed.length > 0 ? { ...vehicle, ...parsed[0] } : vehicle;

        // If we have VIN but missing data, try VIN decoder
        const enriched = await enrichVehicleWithVIN(merged);

        successCount++;
        return enriched;
      } catch (error) {
        failCount++;
        console.error(`Failed to fetch detail page ${i + batch.indexOf(vehicle) + 1}/${vehicles.length}: ${vehicle.url}`);

        // Even if fetch fails, try VIN decoder if we have VIN
        return await enrichVehicleWithVIN(vehicle);
      }
    });

    const results = await Promise.all(promises);
    detailed.push(...results);

    // Progress update every 10 vehicles
    if ((i + concurrency) % 10 === 0 || i + concurrency >= vehicles.length) {
      console.log(`📊 Progress: ${Math.min(i + concurrency, vehicles.length)}/${vehicles.length} vehicles processed (${successCount} success, ${failCount} failed)`);
    }

    // Small delay between batches to be respectful
    if (i + concurrency < vehicles.length) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  console.log(`✅ Completed: ${successCount}/${vehicles.length} detail pages fetched successfully`);
  return detailed;
}

// Helper: Calculate aggregated stats from all detailed vehicles
function calculateStats(vehicles: ParsedVehicle[]): CompetitorStats {
  // Count makes from all vehicles
  const makeCounts: Record<string, number> = {};
  vehicles.forEach((v) => {
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

  // Calculate price/mileage stats from ALL vehicles
  const prices = vehicles.filter((v) => v.price !== undefined && v.price > 0).map((v) => v.price!);
  const mileages = vehicles.filter((v) => v.mileage !== undefined && v.mileage >= 0).map((v) => v.mileage!);

  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  const avgMileage = mileages.length > 0 ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length) : null;
  const minMileage = mileages.length > 0 ? Math.min(...mileages) : null;
  const maxMileage = mileages.length > 0 ? Math.max(...mileages) : null;

  // Calculate ACTUAL total inventory value from all prices
  const totalInventoryValue = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) : null;

  console.log(`📊 Stats Summary: ${vehicles.length} vehicles, ${prices.length} with prices, ${mileages.length} with mileage`);

  return {
    vehicle_count: vehicles.length,
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
