import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// UNIFIED SCRAPER CORE - INLINED
// =====================================================
// Inlined version for Supabase Edge Functions deployment
import { scrapeWebsite, type ParsedVehicle } from './scraper-core-inline.ts';

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

    const startTime = Date.now();
    console.log(`🔍 Scanning competitor: ${url} for tenant: ${tenantId}`);

    // Use unified scraper core - handles URL normalization, pagination, detail pages, and VIN enrichment
    const vehicles = await scrapeWebsite(url, {
      maxConcurrency: 5,
      pageDelay: 800,
      maxPages: 20,
      timeout: 30000,
    });

    console.log(`🚗 Found ${vehicles.length} total vehicles`);

    // Calculate aggregated stats from all vehicles
    const stats = calculateStats(vehicles);
    console.log(`📈 Stats calculated:`, stats);

    const duration = Date.now() - startTime;

    // Get normalized URL for database storage
    const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

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

// =====================================================
// STATS CALCULATION
// =====================================================
// Calculate aggregated stats from scraped vehicles
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
