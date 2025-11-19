import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVRow {
  Dealership_URL: string;
  Year: string;
  Make: string;
  Model: string;
  Mileage: string;
  Price: string;
  VIN: string;
  Days_In_Stock: string;
  Body_Style: string;
  Photo_URL: string;
}

interface ProcessingResult {
  success: boolean;
  upload_id?: string;
  vehicles_processed: number;
  vehicles_new: number;
  vehicles_updated: number;
  vehicles_sold: number;
  errors: string[];
  tenant_id?: string;
}

// VIN validation with checksum
function validateVIN(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;

  // VIN should not contain I, O, or Q
  if (/[IOQ]/i.test(vin)) return false;

  // Basic checksum validation
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

// Generate pseudo-VIN from vehicle data
function generatePseudoVIN(vehicle: Partial<CSVRow>, index: number): string {
  const parts = [
    vehicle.Year || 'XXXX',
    vehicle.Make || 'UNKNOWN',
    vehicle.Model || 'UNKNOWN',
    vehicle.Mileage || '0',
    vehicle.Price || '0',
    index.toString()
  ];

  const pseudo = parts
    .join('_')
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/gi, '')
    .toUpperCase()
    .substring(0, 17)
    .padEnd(17, '0');

  return `PSEUDO_${pseudo}`;
}

// Parse CSV content
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CSVRow[] = [];

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

    rows.push(row as CSVRow);
  }

  return rows;
}

// Calculate first_seen_at from days in stock
function calculateFirstSeenAt(daysInStock: number): string {
  const now = new Date();
  now.setDate(now.getDate() - daysInStock);
  return now.toISOString();
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

    // Check if user is super_admin or va_uploader
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !['super_admin', 'va_uploader'].includes(userData.role)) {
      throw new Error('Insufficient permissions. Must be super_admin or va_uploader.');
    }

    // Parse request body
    const { csv_content, filename, tenant_id } = await req.json();

    if (!csv_content || !filename) {
      throw new Error('Missing required fields: csv_content and filename');
    }

    // Parse CSV
    const rows = parseCSV(csv_content);
    console.log(`Parsed ${rows.length} rows from CSV`);

    // Validate required fields
    const errors: string[] = [];
    const validRows: Array<CSVRow & { row_index: number }> = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // +2 for header and 0-indexing

      // Check required fields
      if (!row.Dealership_URL) {
        errors.push(`Row ${rowNum}: Missing Dealership_URL`);
        return;
      }
      if (!row.Year) {
        errors.push(`Row ${rowNum}: Missing Year`);
        return;
      }
      if (!row.Make) {
        errors.push(`Row ${rowNum}: Missing Make`);
        return;
      }
      if (!row.Model) {
        errors.push(`Row ${rowNum}: Missing Model`);
        return;
      }
      if (!row.Price) {
        errors.push(`Row ${rowNum}: Missing Price`);
        return;
      }
      if (!row.Days_In_Stock) {
        errors.push(`Row ${rowNum}: Missing Days_In_Stock`);
        return;
      }

      validRows.push({ ...row, row_index: index });
    });

    if (validRows.length === 0) {
      throw new Error(`No valid rows found in CSV. Errors: ${errors.join('; ')}`);
    }

    // Get tenant_id from first row's dealership URL if not provided
    let targetTenantId = tenant_id;

    if (!targetTenantId) {
      const firstDealershipUrl = validRows[0].Dealership_URL.toLowerCase().trim();

      // Find tenant by website_url
      const { data: tenant, error: tenantError } = await supabaseClient
        .from('tenants')
        .select('id, name')
        .ilike('website_url', `%${firstDealershipUrl}%`)
        .single();

      if (tenantError || !tenant) {
        throw new Error(`No tenant found with website URL matching: ${firstDealershipUrl}`);
      }

      targetTenantId = tenant.id;
      console.log(`Matched tenant: ${tenant.name} (${tenant.id})`);
    }

    // Create upload record
    const { data: uploadRecord, error: uploadError } = await supabaseClient
      .from('manual_scraping_uploads')
      .insert({
        tenant_id: targetTenantId,
        uploaded_by: user.id,
        filename,
        status: 'processing',
        raw_csv_data: csv_content,
      })
      .select()
      .single();

    if (uploadError) {
      throw new Error(`Failed to create upload record: ${uploadError.message}`);
    }

    console.log(`Created upload record: ${uploadRecord.id}`);

    // Get existing vehicles for this tenant
    const { data: existingVehicles, error: existingError } = await supabaseClient
      .from('vehicle_history')
      .select('vin, id, price, mileage')
      .eq('tenant_id', targetTenantId)
      .eq('status', 'active');

    if (existingError) {
      console.error('Error fetching existing vehicles:', existingError);
    }

    const existingVINs = new Set((existingVehicles || []).map(v => v.vin));
    const csvVINs = new Set<string>();

    let newCount = 0;
    let updatedCount = 0;
    let pseudoVINCount = 0;

    // Process each valid row
    for (const row of validRows) {
      let vin = row.VIN?.trim();
      let vinValidated = false;

      // Validate or generate VIN
      if (vin && vin.length === 17) {
        vinValidated = validateVIN(vin);
        if (!vinValidated) {
          console.warn(`Invalid VIN checksum for row ${row.row_index + 2}: ${vin}, generating pseudo-VIN`);
          vin = generatePseudoVIN(row, row.row_index);
          pseudoVINCount++;
        }
      } else {
        vin = generatePseudoVIN(row, row.row_index);
        pseudoVINCount++;
      }

      csvVINs.add(vin);

      // Calculate first_seen_at
      const daysInStock = parseInt(row.Days_In_Stock) || 0;
      const firstSeenAt = calculateFirstSeenAt(daysInStock);

      const vehicleData = {
        tenant_id: targetTenantId,
        vin,
        year: parseInt(row.Year),
        make: row.Make,
        model: row.Model,
        trim: null,
        price: parseFloat(row.Price),
        mileage: row.Mileage ? parseInt(row.Mileage) : null,
        exterior_color: null,
        listing_url: row.Dealership_URL,
        image_urls: row.Photo_URL ? [row.Photo_URL] : [],
        first_seen_at: existingVINs.has(vin) ? undefined : firstSeenAt,
        last_seen_at: new Date().toISOString(),
        status: 'active',
        listing_date_confidence: 'high',
        listing_date_source: 'manual_upload',
      };

      if (existingVINs.has(vin)) {
        // Update existing vehicle
        const { error: updateError } = await supabaseClient
          .from('vehicle_history')
          .update({
            price: vehicleData.price,
            mileage: vehicleData.mileage,
            last_seen_at: vehicleData.last_seen_at,
            image_urls: vehicleData.image_urls,
          })
          .eq('vin', vin)
          .eq('tenant_id', targetTenantId);

        if (updateError) {
          errors.push(`Failed to update vehicle ${vin}: ${updateError.message}`);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new vehicle
        const { error: insertError } = await supabaseClient
          .from('vehicle_history')
          .insert(vehicleData);

        if (insertError) {
          errors.push(`Failed to insert vehicle ${vin}: ${insertError.message}`);
        } else {
          newCount++;
        }
      }
    }

    // Mark vehicles not in CSV as sold
    let soldCount = 0;
    const vehiclesToMarkSold = (existingVehicles || []).filter(v => !csvVINs.has(v.vin));

    for (const vehicle of vehiclesToMarkSold) {
      const { error: soldError } = await supabaseClient
        .from('vehicle_history')
        .update({
          status: 'sold',
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (soldError) {
        errors.push(`Failed to mark vehicle ${vehicle.vin} as sold: ${soldError.message}`);
      } else {
        soldCount++;
      }
    }

    // Update upload record with results
    const finalStatus = errors.length > 0 ? 'completed' : 'completed'; // Could add 'partial' status
    await supabaseClient
      .from('manual_scraping_uploads')
      .update({
        status: finalStatus,
        vehicles_processed: validRows.length,
        vehicles_new: newCount,
        vehicles_updated: updatedCount,
        vehicles_sold: soldCount,
        error_log: errors.length > 0 ? { errors } : null,
      })
      .eq('id', uploadRecord.id);

    // Update tenant inventory status to 'ready'
    await supabaseClient
      .from('tenants')
      .update({
        inventory_status: 'ready',
        inventory_ready_at: new Date().toISOString(),
      })
      .eq('id', targetTenantId);

    console.log(`Processing complete: ${newCount} new, ${updatedCount} updated, ${soldCount} sold, ${pseudoVINCount} pseudo-VINs`);

    const result: ProcessingResult = {
      success: true,
      upload_id: uploadRecord.id,
      vehicles_processed: validRows.length,
      vehicles_new: newCount,
      vehicles_updated: updatedCount,
      vehicles_sold: soldCount,
      errors,
      tenant_id: targetTenantId,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing manual scraping upload:', error);
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
