import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseInventoryHTML, type ParsedVehicle } from './parser.ts';

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

// Helper: Fetch detail pages for sampled vehicles
async function fetchDetailPages(vehicles: ParsedVehicle[]): Promise<ParsedVehicle[]> {
  const detailed: ParsedVehicle[] = [];
  const concurrency = 3; // Reduced to 3 at a time to be more respectful

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
        console.error(`Failed to fetch detail page: ${vehicle.url}`, error instanceof Error ? error.message : String(error));
        return vehicle; // Return original if fetch fails
      }
    });

    const results = await Promise.all(promises);
    detailed.push(...results);

    // Small delay between batches to be respectful
    if (i + concurrency < vehicles.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased to 1 second
    }
  }

  return detailed;
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
