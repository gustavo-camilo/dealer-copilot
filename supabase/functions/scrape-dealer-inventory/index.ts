// =====================================================
// DEALER CO-PILOT: WEBSITE SCRAPING EDGE FUNCTION
// =====================================================
// This function scrapes dealer websites to track inventory
// and automatically build sales history for AI recommendations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseInventoryHTML } from './parser.ts';

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
}

/**
 * Find potential inventory pages on a dealer website
 */
async function findInventoryPages(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];

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
  const url = new URL(baseUrl);
  const baseUrlClean = `${url.protocol}//${url.host}`;

  // First, try to fetch the homepage and look for inventory links
  try {
    const response = await fetch(baseUrl, {
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

        // Try each inventory URL
        for (const url of inventoryUrls) {
          try {
            console.log(`Fetching ${url}...`);

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
            const pageVehicles = parseInventoryHTML(html, url);

            console.log(`Found ${pageVehicles.length} vehicles on ${url}`);

            vehicles = vehicles.concat(pageVehicles);

            // If we found vehicles, we can stop (unless we want to check all pages)
            if (vehicles.length > 0) {
              break;
            }
          } catch (error) {
            console.log(`Error fetching ${url}:`, error.message);
            // Continue to next URL
          }
        }

        console.log(`Found ${vehicles.length} vehicles on ${tenant.name}`);

        // Process vehicles and update database
        const { newVehicles, updatedVehicles, soldVehicles } = await processVehicles(
          supabase,
          tenant.id,
          vehicles
        );

        // Update snapshot with results
        await supabase
          .from('inventory_snapshots')
          .update({
            vehicles_found: vehicles.length,
            status: 'success',
            scraping_duration_ms: Date.now() - tenantStartTime,
            raw_data: vehicles,
          })
          .eq('id', snapshot.id);

        // Log success
        await supabase.from('scraping_logs').insert({
          tenant_id: tenant.id,
          snapshot_id: snapshot.id,
          log_level: 'info',
          message: `Successfully scraped ${vehicles.length} vehicles`,
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
          vehicles_found: vehicles.length,
          new_vehicles: newVehicles,
          updated_vehicles: updatedVehicles,
          sold_vehicles: soldVehicles,
          status: 'success',
          duration_ms: Date.now() - tenantStartTime,
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped ${results.length} tenant(s) in ${totalDuration}ms`,
        results,
        summary: {
          total_tenants: results.length,
          successful: results.filter((r) => r.status === 'success').length,
          failed: results.filter((r) => r.status === 'failed').length,
          total_vehicles: results.reduce((sum, r) => sum + r.vehicles_found, 0),
          duration_ms: totalDuration,
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
  vehicles: any[]
): Promise<{ newVehicles: number; updatedVehicles: number; soldVehicles: number }> {
  let newVehicles = 0;
  let updatedVehicles = 0;

  const currentVINs = vehicles.map((v) => v.vin).filter(Boolean);

  // Process each vehicle
  for (const vehicle of vehicles) {
    if (!vehicle.vin) continue; // Skip vehicles without VIN

    // Check if vehicle exists in history
    const { data: existing } = await supabase
      .from('vehicle_history')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('vin', vehicle.vin)
      .eq('status', 'active')
      .single();

    if (!existing) {
      // New vehicle - insert
      await supabase.from('vehicle_history').insert({
        tenant_id,
        vin: vehicle.vin,
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
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        status: 'active',
        price_history: [{ date: new Date().toISOString(), price: vehicle.price }],
      });

      newVehicles++;
    } else {
      // Existing vehicle - update
      const updates: any = {
        last_seen_at: new Date().toISOString(),
      };

      // Check if price changed
      if (existing.price !== vehicle.price) {
        const priceHistory = existing.price_history || [];
        priceHistory.push({
          date: new Date().toISOString(),
          price: vehicle.price,
        });
        updates.price = vehicle.price;
        updates.price_history = priceHistory;
        updates.status = 'price_changed';
      }

      // Update mileage if changed
      if (vehicle.mileage && existing.mileage !== vehicle.mileage) {
        updates.mileage = vehicle.mileage;
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
      // Double check it's not in current scrape
      if (!currentVINs.includes(vehicle.vin)) {
        await supabase
          .from('vehicle_history')
          .update({ status: 'sold' })
          .eq('id', vehicle.id);

        soldVehicles++;
      }
    }
  }

  return { newVehicles, updatedVehicles, soldVehicles };
}
