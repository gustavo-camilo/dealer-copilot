import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CompetitorCSVRow {
  VIN: string;
  Year: string;
  Make: string;
  Model: string;
  Price: string;
  Mileage: string;
  URL?: string;
  Image?: string;
  // Unified template aliases
  Image_URL?: string;
}

interface ProcessingResult {
  success: boolean;
  upload_id?: string;
  vehicles_processed: number;
  vehicles_new?: number;
  vehicles_updated?: number;
  vehicles_sold?: number;
  competitor_url?: string;
  competitor_name?: string;
  errors: string[];
}

// Parse CSV content
function parseCSV(csvContent: string): CompetitorCSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CompetitorCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`);
      continue;
    }

    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    // Map unified headers
    if (!row.Image && row.Image_URL) {
      row.Image = row.Image_URL;
    }

    rows.push(row as CompetitorCSVRow);
  }

  return rows;
}

// Aggregate vehicle data
function aggregateVehicleData(vehicles: CompetitorCSVRow[]) {
  const prices = vehicles.map(v => parseFloat(v.Price)).filter(p => !isNaN(p) && p > 0);
  const mileages = vehicles.map(v => parseInt(v.Mileage)).filter(m => !isNaN(m) && m >= 0);

  // Count makes
  const makeCounts: Record<string, number> = {};
  vehicles.forEach(v => {
    if (v.Make) {
      makeCounts[v.Make] = (makeCounts[v.Make] || 0) + 1;
    }
  });

  // Sort makes by count and get top 10
  const topMakes = Object.fromEntries(
    Object.entries(makeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
  );

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

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super_admin or va_uploader
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role, id, tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['super_admin', 'va_uploader'].includes(userData.role)) {
      throw new Error('Insufficient permissions. Must be super_admin or va_uploader.');
    }

    // Parse request body
    // Note: tenant_id is no longer required for the data itself, but we might still receive it for logging/auth context
    const { csv_content, filename, competitor_url, competitor_name, waiting_list_entry_id, tenant_id } = await req.json();

    if (!csv_content || !competitor_url) {
      throw new Error('Missing required fields: csv_content, competitor_url');
    }

    console.log(`Processing competitor CSV for competitor: ${competitor_url}`);

    const errors: string[] = [];
    const startTime = Date.now();

    // Parse CSV
    let vehicles: CompetitorCSVRow[];
    try {
      vehicles = parseCSV(csv_content);
    } catch (error) {
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }

    console.log(`Parsed ${vehicles.length} vehicles from CSV`);

    // 0. Fetch existing active vehicles for this competitor to track what's missing (sold)
    const { data: existingVehicles, error: existingError } = await supabaseClient
      .from('tracked_vehicles')
      .select('vin, id')
      .eq('source_url', competitor_url)
      .eq('source_type', 'competitor')
      .is('tenant_id', null)
      .eq('status', 'active');

    if (existingError) {
      console.error('Error fetching existing competitor vehicles:', existingError);
    }

    const existingVINs = new Set((existingVehicles || []).map(v => v.vin));
    const csvVINs = new Set<string>();

    // 1. Upsert individual vehicles into competitor_vehicles
    let newCount = 0;
    let updatedCount = 0;

    for (const vehicle of vehicles) {
      const price = parseFloat(vehicle.Price);
      const mileage = parseInt(vehicle.Mileage);

      // Skip invalid rows
      if (!vehicle.VIN && !vehicle.URL) continue;

      const vin = vehicle.VIN || `NO_VIN_${Math.random().toString(36).substring(7)}`;
      csvVINs.add(vin);

      const vehicleData = {
        source_url: competitor_url,
        source_type: 'competitor',
        tenant_id: null,
        vin,
        year: parseInt(vehicle.Year) || null,
        make: vehicle.Make,
        model: vehicle.Model,
        price: isNaN(price) ? null : price,
        mileage: isNaN(mileage) ? null : mileage,
        listing_url: vehicle.URL || null,
        image_url: vehicle.Image || null,
        last_seen_at: new Date().toISOString(),
        status: 'active'
      };

      // Upsert based on source_url + vin (where tenant_id is null)
      const { error: upsertError } = await supabaseClient
        .from('tracked_vehicles')
        .upsert(vehicleData, {
          onConflict: 'source_url,vin',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.warn(`Failed to upsert competitor vehicle ${vehicle.VIN}:`, upsertError);
      } else {
        newCount++;
      }
    }

    // 1.5 Mark vehicles not in CSV as sold
    let soldCount = 0;
    const vehiclesToMarkSold = (existingVehicles || []).filter(v => v.vin && !csvVINs.has(v.vin));

    for (const vehicle of vehiclesToMarkSold) {
      const { error: soldError } = await supabaseClient
        .from('tracked_vehicles')
        .update({
          status: 'sold',
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (soldError) {
        console.error(`Failed to mark competitor vehicle ${vehicle.vin} as sold:`, soldError);
      } else {
        soldCount++;
      }
    }
    console.log(`Marked ${soldCount} competitor vehicles as sold`);

    // 2. Aggregate statistics
    const stats = aggregateVehicleData(vehicles);

    // 3. UPSERT into inventory_snapshots_unified (Global)
    // This serves as both the "latest" snapshot and the history record
    const { data: snapshot, error: snapshotError } = await supabaseClient
      .from('inventory_snapshots_unified')
      .upsert({
        source_url: competitor_url,
        source_type: 'competitor',
        source_name: competitor_name || null,
        tenant_id: null,
        snapshot_date: new Date().toISOString().split('T')[0],
        scanned_at: new Date().toISOString(),
        vehicle_count: stats.vehicle_count,
        avg_price: stats.avg_price,
        min_price: stats.min_price,
        max_price: stats.max_price,
        avg_mileage: stats.avg_mileage,
        min_mileage: stats.min_mileage,
        max_mileage: stats.max_mileage,
        total_inventory_value: stats.total_inventory_value,
        make_distribution: stats.top_makes,
        scraping_duration_ms: Date.now() - startTime,
        status: 'success',
      }, {
        onConflict: 'source_url,snapshot_date'
      })
      .select()
      .single();

    if (snapshotError) {
      throw new Error(`Failed to create snapshot: ${snapshotError.message}`);
    }

    // 4. History is automatically handled by the unified snapshot table
    // No need for separate competitor_scan_history insert

    // 5. Create record in manual_scraping_uploads (This still needs a tenant_id if we want to track WHO uploaded it)
    // But if it's global, maybe we just assign it to the uploader's tenant?
    // Or we make tenant_id nullable in manual_scraping_uploads?
    // For now, let's assume the uploader has a tenant_id (they are a VA for someone).
    // If not provided in request, we try to get it from user data.

    let uploaderTenantId = userData.tenant_id; // Assuming user has tenant_id
    // If user doesn't have tenant_id (Super Admin), we might need to leave it null or use a system tenant.
    // Let's check if manual_scraping_uploads requires tenant_id. Yes it does (NOT NULL).
    // So we MUST provide a tenant_id.
    // If the request didn't provide one, and the user is Super Admin without one, we have a problem.
    // However, for now, let's assume we pass the tenant_id of the DEALER who requested this, if known.
    // If it's a pure global upload, we might need a "System Tenant".

    // Ideally, we pass the tenant_id of the *requesting* dealer so they see the upload in their logs.
    // If multiple dealers requested it, we just pick one (the one the VA is "working for" at that moment).
    // The request body usually has tenant_id. Let's keep using it for the LOG, but not for the DATA.

    // Use tenant_id from request body (passed from upload-universal-csv)
    // or fall back to uploader's tenant_id if they have one
    const logTenantId = tenant_id || uploaderTenantId;

    if (logTenantId) {
      console.log(`Creating upload record for tenant_id: ${logTenantId}`);
      const { data: uploadRecord, error: uploadError } = await supabaseClient
        .from('manual_scraping_uploads')
        .insert({
          tenant_id: logTenantId,
          uploaded_by: userData.id,
          filename: filename || 'competitor_data.csv',
          upload_date: new Date().toISOString(),
          status: 'completed',
          vehicles_processed: stats.vehicle_count,
          vehicles_new: stats.vehicle_count,
          vehicles_updated: 0,
          vehicles_sold: 0,
          scraping_source: 'competitor_data',
          raw_csv_data: csv_content,
        })
        .select()
        .single();

      if (uploadError) {
        console.error('Failed to create upload record:', uploadError);
        errors.push(`Failed to create upload record: ${uploadError.message}`);
      } else {
        console.log(`Upload record created successfully: ${uploadRecord.id}`);
      }
    } else {
      console.warn('No tenant_id available for upload logging - skipping manual_scraping_uploads record');
    }

    // Mark competitor_scraping_waiting_list entry as completed (if provided)
    if (waiting_list_entry_id) {
      const { error: updateError } = await supabaseClient
        .from('competitor_scraping_waiting_list')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', waiting_list_entry_id);

      if (updateError) {
        console.error('Failed to update waiting list:', updateError);
        errors.push(`Failed to update waiting list: ${updateError.message}`);
      }
    }

    const result: ProcessingResult = {
      success: true,
      // upload_id: uploadRecord?.id, // Might be undefined if no logTenantId
      vehicles_processed: stats.vehicle_count,
      competitor_url,
      competitor_name: competitor_name || undefined,
      errors,
    };

    console.log('Processing complete:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing competitor CSV:', error);
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
