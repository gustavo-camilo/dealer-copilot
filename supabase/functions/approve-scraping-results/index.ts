import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractDomain(url: string): string {
  try {
    const hasProtocol = /^https?:\/\//i.test(url);
    const parsed = new URL(hasProtocol ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}

function validateVIN(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;
  if (/[IOQ]/i.test(vin)) return false;
  const transliteration = '0123456789X';
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const map = '0123456789.ABCDEFGH..JKLMN.P.R..STUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const value = map.indexOf(vin[i].toUpperCase());
    if (value < 0) return false;
    sum += value * weights[i];
  }
  const checkDigit = transliteration[sum % 11];
  return checkDigit === vin[8].toUpperCase();
}

function generatePseudoVINFromVehicle(vehicle: any, listingUrl: string): string {
  const year = vehicle.year || 'UNKN';
  const make = (vehicle.make || 'UNKNOWN').replace(/\s+/g, '_').toUpperCase();
  const model = (vehicle.model || 'UNKNOWN').replace(/\s+/g, '_').toUpperCase();

  if (vehicle.mileage && parseInt(vehicle.mileage) > 0) {
    const mileage = parseInt(vehicle.mileage);
    return `noVIN_${year}_${make}_${model}_${mileage}`;
  }

  if (vehicle.price && parseFloat(vehicle.price) > 0) {
    const price = Math.round(parseFloat(vehicle.price));
    return `noVIN_${year}_${make}_${model}_$${price}`;
  }

  if (listingUrl) {
    let hash = 0;
    for (let i = 0; i < listingUrl.length; i++) {
      hash = ((hash << 5) - hash) + listingUrl.charCodeAt(i);
      hash = hash & hash;
    }
    const urlHash = Math.abs(hash).toString(36).toUpperCase();
    return `noVIN_${year}_${make}_${model}_${urlHash}`;
  }

  return `noVIN_${year}_${make}_${model}_NODATA`;
}

function normalizeVehicleForTracking(vehicle: any): any {
  const listingUrl = vehicle.listing_url || vehicle.url || '';
  let vin = vehicle.vin?.trim();

  if (vin && vin.length === 17) {
    if (!validateVIN(vin)) {
      vin = generatePseudoVINFromVehicle(vehicle, listingUrl);
    }
  } else {
    vin = generatePseudoVINFromVehicle(vehicle, listingUrl);
  }

  return {
    ...vehicle,
    vin,
    listing_url: listingUrl || null,
  };
}

function aggregateVehicleData(vehicles: any[]) {
  const prices = vehicles.map(v => parseFloat(v.price)).filter(p => !isNaN(p) && p > 0);
  const mileages = vehicles.map(v => parseInt(v.mileage)).filter(m => !isNaN(m) && m >= 0);
  const makeCounts: Record<string, number> = {};
  vehicles.forEach(v => {
    if (v.make) makeCounts[v.make] = (makeCounts[v.make] || 0) + 1;
  });
  const topMakes = Object.fromEntries(Object.entries(makeCounts).sort(([, a], [, b]) => b - a).slice(0, 10));
  return {
    vehicle_count: vehicles.length,
    avg_price: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    min_price: prices.length > 0 ? Math.min(...prices) : null,
    max_price: prices.length > 0 ? Math.max(...prices) : null,
    avg_mileage: mileages.length > 0 ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length) : null,
    min_mileage: mileages.length > 0 ? Math.min(...mileages) : null,
    max_mileage: mileages.length > 0 ? Math.max(...mileages) : null,
    total_inventory_value: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) : null,
    top_makes: topMakes,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user authentication and role
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super_admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'super_admin') {
      throw new Error('Insufficient permissions. Must be super_admin.');
    }

    // Parse request body
    const { snapshot_id, action } = await req.json();

    if (!snapshot_id) {
      throw new Error('Missing required field: snapshot_id');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Invalid action. Must be "approve" or "reject"');
    }

    // Fetch the snapshot
    const { data: snapshot, error: snapshotError } = await supabaseClient
      .from('inventory_snapshots_unified')
      .select('*')
      .eq('id', snapshot_id)
      .single();

    if (snapshotError || !snapshot) {
      throw new Error(`Snapshot not found: ${snapshot_id}`);
    }

    if (snapshot.status !== 'pending_review') {
      throw new Error(`Snapshot is not in pending_review status. Current status: ${snapshot.status}`);
    }

    if (action === 'reject') {
      // Reject: Just update snapshot status
      const { error: updateError } = await supabaseClient
        .from('inventory_snapshots_unified')
        .update({
          status: 'failed',
          error_message: 'Rejected by admin during review',
        })
        .eq('id', snapshot_id);

      if (updateError) {
        throw new Error(`Failed to reject snapshot: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'rejected',
          snapshot_id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Approve: Apply the pending changes to tracked_vehicles
    // The raw_data contains the vehicles that were found
    const vehiclesData = snapshot.raw_data?.vehicles || [];

    if (!Array.isArray(vehiclesData) || vehiclesData.length === 0) {
      throw new Error('No vehicle data found in snapshot');
    }

    const normalizedSourceUrl = extractDomain(snapshot.source_url || '');
    const sourceUrlCandidates = [snapshot.source_url, normalizedSourceUrl].filter(Boolean) as string[];
    const normalizedVehicles = vehiclesData.map(normalizeVehicleForTracking);

    if (snapshot.source_url && snapshot.source_url !== normalizedSourceUrl) {
      await supabaseClient
        .from('tracked_vehicles')
        .update({ source_url: normalizedSourceUrl })
        .eq('tenant_id', snapshot.tenant_id)
        .eq('source_type', 'dealer')
        .eq('source_url', snapshot.source_url);
    }

    let newCount = 0;
    let updatedCount = 0;
    let soldCount = 0;

    // Get existing vehicles for this tenant
    const { data: existingVehicles, error: existingError } = await supabaseClient
      .from('tracked_vehicles')
      .select('vin, id')
      .eq('tenant_id', snapshot.tenant_id)
      .eq('status', 'active')
      .eq('source_type', 'dealer')
      .in('source_url', sourceUrlCandidates);

    if (existingError) {
      console.error('Error fetching existing vehicles:', existingError);
    }

    const existingVINs = new Set((existingVehicles || []).map(v => v.vin));
    const scrapedVINs = new Set<string>();

    // Process each vehicle
    for (const vehicle of normalizedVehicles) {
      if (!vehicle.vin) continue;

      const listingUrl = vehicle.listing_url || vehicle.url || null;
      const imageUrl = vehicle.image_url || vehicle.image_urls?.[0] || vehicle.images?.[0] || null;
      const vin = vehicle.vin;

      scrapedVINs.add(vin);

      const vehicleData: any = {
        tenant_id: snapshot.tenant_id,
        source_url: normalizedSourceUrl,
        source_type: snapshot.source_type || 'dealer',
        vin,
        stock_number: vehicle.stock_number || null,
        year: vehicle.year || null,
        make: vehicle.make || null,
        model: vehicle.model || null,
        trim: vehicle.trim || null,
        price: vehicle.price ?? null,
        mileage: vehicle.mileage ?? null,
        exterior_color: vehicle.color || vehicle.exterior_color || null,
        listing_url: listingUrl,
        image_url: imageUrl,
        last_seen_at: new Date().toISOString(),
        status: 'active',
        listing_date_confidence: vehicle.listing_date_confidence || 'medium',
        listing_date_source: vehicle.listing_date_source || 'automated_scraper',
      };

      if (!existingVINs.has(vin)) {
        vehicleData.first_seen_at = vehicle.first_seen_at || new Date().toISOString();
      }

      const { error: upsertError } = await supabaseClient
        .from('tracked_vehicles')
        .upsert(vehicleData, {
          onConflict: 'tenant_id,source_url,vin',
          ignoreDuplicates: false,
        });

      if (!upsertError) {
        if (existingVINs.has(vin)) updatedCount++; else newCount++;
      }
    }

    // Mark vehicles not in scraped data as sold
    const vehiclesToMarkSold = (existingVehicles || []).filter(v => !scrapedVINs.has(v.vin));

    for (const vehicle of vehiclesToMarkSold) {
      const { error: soldError } = await supabaseClient
        .from('tracked_vehicles')
        .update({
          status: 'sold',
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (!soldError) {
        soldCount++;
      }
    }

    // Update snapshot status to approved/success
    const stats = aggregateVehicleData(normalizedVehicles);
    const { error: approveError } = await supabaseClient
      .from('inventory_snapshots_unified')
      .update({
        status: 'success',
        vehicle_count: stats.vehicle_count,
        avg_price: stats.avg_price,
        min_price: stats.min_price,
        max_price: stats.max_price,
        avg_mileage: stats.avg_mileage,
        min_mileage: stats.min_mileage,
        max_mileage: stats.max_mileage,
        total_inventory_value: stats.total_inventory_value,
        make_distribution: stats.top_makes,
        source_url: normalizedSourceUrl,
      })
      .eq('id', snapshot_id);

    if (approveError) {
      throw new Error(`Failed to approve snapshot: ${approveError.message}`);
    }

    // Update tenant inventory status to 'ready'
    const { error: tenantUpdateError } = await supabaseClient
      .from('tenants')
      .update({
        inventory_status: 'ready',
        inventory_ready_at: new Date().toISOString(),
      })
      .eq('id', snapshot.tenant_id);

    if (tenantUpdateError) {
      console.error('Failed to update tenant status:', tenantUpdateError);
    }

    // Aggregate vehicle data for inventory stats
    const aggregatedData = aggregateVehicleData(normalizedVehicles);

    return new Response(
      JSON.stringify({
        success: true,
        action: 'approved',
        snapshot_id,
        vehicles_new: newCount,
        vehicles_updated: updatedCount,
        vehicles_sold: soldCount,
        total_processed: vehiclesData.length,
        inventory_stats: aggregatedData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error approving scraping results:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
