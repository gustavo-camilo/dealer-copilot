// =====================================================
// DEALER CO-PILOT: WEBSITE SCRAPING EDGE FUNCTION
// =====================================================
// This function scrapes dealer websites to track inventory
// and automatically build sales history for AI recommendations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Use unified scraper core
import { scrapeWebsite } from '../_shared/scraper-core.ts';
import type { ParsedVehicle } from '../_shared/types.ts';

// Keep dealer-specific date extraction logic
import { getSitemapCache, getActualListingDate, type SitemapCache } from './dateExtractor.ts';

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

// =====================================================
// MAIN SERVE FUNCTION
// =====================================================

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

        // Use unified scraper core - handles URL discovery, pagination, detail pages, and VIN enrichment
        const vehicles = await scrapeWebsite(tenant.website_url, {
          maxConcurrency: 5,
          pageDelay: 800,
          maxPages: 20,
          timeout: 30000,
        });

        console.log(`Found ${vehicles.length} vehicles on ${tenant.name}`);

        // Log sample of what we found
        if (vehicles.length > 0) {
          const sample = vehicles[0];
          console.log(`Sample vehicle: ${sample.year} ${sample.make} ${sample.model} - $${sample.price} - ${sample.mileage}mi - ${sample.url} - ${sample.images?.length || 0} images`);
        }

        // Get sitemap cache for accurate date extraction
        const sitemapCache = await getSitemapCache(supabase, tenant.id, tenant.website_url);
        console.log(`Loaded sitemap cache with ${Object.keys(sitemapCache).length} URLs`);

        // Process vehicles and update database
        const { newVehicles, updatedVehicles, soldVehicles } = await processVehicles(
          supabase,
          tenant.id,
          vehicles,
          sitemapCache
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

      // Check if price changed (keep price history)
      if (vehicle.price !== undefined && vehicle.price !== null) {
        if (existing.price !== vehicle.price) {
          const priceHistory = existing.price_history || [];
          priceHistory.push({
            date: new Date().toISOString(),
            price: vehicle.price,
          });
          updates.price = vehicle.price;
          updates.price_history = priceHistory;
          updates.status = 'price_changed';
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
