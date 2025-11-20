import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
}

interface ProcessingResult {
  success: boolean;
  upload_id?: string;
  vehicles_processed: number;
  competitor_url: string;
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
      .select('role, id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['super_admin', 'va_uploader'].includes(userData.role)) {
      throw new Error('Insufficient permissions. Must be super_admin or va_uploader.');
    }

    // Parse request body
    const { csv_content, filename, tenant_id, competitor_url, competitor_name, waiting_list_entry_id } = await req.json();

    if (!csv_content || !tenant_id || !competitor_url) {
      throw new Error('Missing required fields: csv_content, tenant_id, competitor_url');
    }

    console.log(`Processing competitor CSV for tenant ${tenant_id}, competitor: ${competitor_url}`);

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

    // Aggregate statistics
    const stats = aggregateVehicleData(vehicles);

    // UPSERT into competitor_snapshots
    const { data: snapshot, error: snapshotError } = await supabaseClient
      .from('competitor_snapshots')
      .upsert({
        tenant_id,
        competitor_url,
        competitor_name: competitor_name || null,
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
        scraping_duration_ms: Date.now() - startTime,
        status: 'success',
      }, {
        onConflict: 'tenant_id,competitor_url'
      })
      .select()
      .single();

    if (snapshotError) {
      throw new Error(`Failed to create snapshot: ${snapshotError.message}`);
    }

    // INSERT into competitor_scan_history
    const { error: historyError } = await supabaseClient
      .from('competitor_scan_history')
      .insert({
        tenant_id,
        competitor_url,
        competitor_name: competitor_name || null,
        scanned_at: new Date().toISOString(),
        vehicle_count: stats.vehicle_count,
        avg_price: stats.avg_price,
        total_inventory_value: stats.total_inventory_value,
        top_makes: stats.top_makes,
      });

    if (historyError) {
      console.error('Failed to create history entry:', historyError);
      errors.push(`Failed to create history: ${historyError.message}`);
    }

    // Create record in manual_scraping_uploads
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('manual_scraping_uploads')
      .insert({
        tenant_id,
        uploaded_by: userData.id,
        filename: filename || 'competitor_data.csv',
        upload_date: new Date().toISOString(),
        status: 'completed',
        vehicles_processed: stats.vehicle_count,
        vehicles_new: stats.vehicle_count, // All are "new" for competitor data
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
      upload_id: uploadRecord?.id,
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
