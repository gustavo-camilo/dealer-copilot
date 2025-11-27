import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- Interfaces ---

interface CSVRow {
    // Common
    URL?: string;
    Image_URL?: string;

    // Dealer specific
    Dealership_URL?: string;
    Year?: string;
    Make?: string;
    Model?: string;
    Mileage?: string;
    Price?: string;
    VIN?: string;
    Days_In_Stock?: string;
    Body_Style?: string;
    Photo_URL?: string;

    // Competitor specific
    Image?: string;
}

// --- Helper Functions ---

function normalizeHeader(header: string) {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function extractDomain(url: string) {
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

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSV(csvContent: string): CSVRow[] {
    const lines = csvContent.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h => h.trim());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;

        const row: any = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx];
        });
        rows.push(row);
    }
    return rows;
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

function generatePseudoVIN(vehicle: any, index: number): string {
    const parts = [
        vehicle.Year || 'XXXX',
        vehicle.Make || 'UNKNOWN',
        vehicle.Model || 'UNKNOWN',
        vehicle.Mileage || '0',
        vehicle.Price || '0',
        index.toString()
    ];
    const pseudo = parts.join('_').replace(/\s+/g, '_').replace(/[^A-Z0-9_]/gi, '').toUpperCase().substring(0, 17).padEnd(17, '0');
    return `PSEUDO_${pseudo}`;
}

function calculateFirstSeenAt(daysInStock: number): string {
    const now = new Date();
    now.setDate(now.getDate() - daysInStock);
    return now.toISOString();
}

function aggregateVehicleData(vehicles: any[]) {
    const prices = vehicles.map(v => parseFloat(v.Price)).filter(p => !isNaN(p) && p > 0);
    const mileages = vehicles.map(v => parseInt(v.Mileage)).filter(m => !isNaN(m) && m >= 0);
    const makeCounts: Record<string, number> = {};
    vehicles.forEach(v => {
        if (v.Make) makeCounts[v.Make] = (makeCounts[v.Make] || 0) + 1;
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

// --- Main Handler ---

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('=== Upload Universal CSV (Unified) Called ===');

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) throw new Error('Unauthorized');

        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('role, id, tenant_id')
            .eq('id', user.id)
            .single();

        if (userError || !userData || !['super_admin', 'va_uploader'].includes(userData.role)) {
            throw new Error('Insufficient permissions.');
        }

        let requestBody;
        try {
            requestBody = await req.json();
        } catch (e) {
            throw new Error('Invalid JSON body');
        }
        const { csv_content, filename, tenant_id } = requestBody;

        if (!csv_content) throw new Error('Missing csv_content');

        const rows = parseCSV(csv_content);
        if (rows.length === 0) throw new Error('CSV is empty or invalid');

        // 1. Detect Domain
        let detectedUrl = '';
        for (const row of rows) {
            const url = row.URL || row.Dealership_URL || row.website_url || row.website;
            if (url) {
                detectedUrl = url.trim();
                break;
            }
        }

        if (!detectedUrl) throw new Error('Could not find URL in CSV.');
        const cleanDomain = extractDomain(detectedUrl);
        console.log(`Detected Domain: ${cleanDomain}`);

        // 2. Resolve Source (Unified Logic)
        // Check source_registry first
        let { data: source } = await supabaseClient
            .from('source_registry')
            .select('*')
            .eq('source_url', cleanDomain)
            .maybeSingle();

        if (!source) {
            console.log(`Source not found in registry. Checking tenants...`);
            // Check tenants
            const { data: tenant } = await supabaseClient
                .from('tenants')
                .select('id, name, website_url')
                .ilike('website_url', `%${cleanDomain}%`)
                .maybeSingle();

            if (tenant) {
                console.log(`Found matching tenant: ${tenant.name}. Creating Dealer Source.`);
                const { data: newSource, error: createError } = await supabaseClient
                    .from('source_registry')
                    .insert({
                        source_url: cleanDomain,
                        source_type: 'dealer',
                        tenant_id: tenant.id,
                        source_name: tenant.name,
                        scraping_enabled: true
                    })
                    .select()
                    .single();

                if (createError) throw new Error(`Failed to create source registry: ${createError.message}`);
                source = newSource;
            } else {
                console.log(`No tenant found. Creating Competitor Source.`);
                // Check waiting list for name
                const { data: waitingEntry } = await supabaseClient
                    .from('competitor_scraping_waiting_list')
                    .select('competitor_name')
                    .ilike('competitor_url', `%${cleanDomain}%`)
                    .maybeSingle();

                const { data: newSource, error: createError } = await supabaseClient
                    .from('source_registry')
                    .insert({
                        source_url: cleanDomain,
                        source_type: 'competitor',
                        tenant_id: null,
                        source_name: waitingEntry?.competitor_name || cleanDomain,
                        scraping_enabled: true
                    })
                    .select()
                    .single();

                if (createError) throw new Error(`Failed to create source registry: ${createError.message}`);
                source = newSource;
            }
        }

        console.log(`Processing for Source: ${source.source_name} (${source.source_type})`);

        // 3. Process Vehicles (Unified Logic)
        const targetTenantId = source.tenant_id; // UUID or NULL
        const targetSourceUrl = source.source_url; // Domain
        const targetSourceType = source.source_type; // 'dealer' or 'competitor'

        // Create Upload Record (Log)
        // We log it to the uploader's tenant if available, or the target tenant if it's a dealer upload
        const logTenantId = tenant_id || targetTenantId || userData.tenant_id;

        let uploadRecordId = null;
        if (logTenantId) {
            const { data: uploadRecord } = await supabaseClient
                .from('manual_scraping_uploads')
                .insert({
                    tenant_id: logTenantId,
                    uploaded_by: user.id,
                    filename: filename || `${cleanDomain}.csv`,
                    status: 'processing',
                    raw_csv_data: csv_content,
                    scraping_source: targetSourceType === 'dealer' ? 'dealer_inventory' : 'competitor_data'
                })
                .select()
                .single();
            uploadRecordId = uploadRecord?.id;
        }

        // Fetch Existing Vehicles for this Source
        // We use source_url as the primary key for grouping, and tenant_id as a filter if present
        let query = supabaseClient.from('tracked_vehicles').select('vin, id').eq('source_url', targetSourceUrl).eq('status', 'active');
        if (targetTenantId) {
            query = query.eq('tenant_id', targetTenantId);
        } else {
            query = query.is('tenant_id', null);
        }
        const { data: existingVehicles } = await query;

        const existingVINs = new Set((existingVehicles || []).map(v => v.vin));
        const csvVINs = new Set<string>();
        const errors: string[] = [];
        let newCount = 0;
        let updatedCount = 0;
        let pseudoVINCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            // Normalize
            if (!row.Dealership_URL && row.URL) row.Dealership_URL = row.URL;
            if (!row.Photo_URL && row.Image_URL) row.Photo_URL = row.Image_URL;

            // Basic Validation
            if (!row.Dealership_URL && !row.URL) continue;

            let vin = row.VIN?.trim();
            if (vin && vin.length === 17) {
                if (!validateVIN(vin)) {
                    vin = generatePseudoVIN(row, i);
                    pseudoVINCount++;
                }
            } else {
                vin = generatePseudoVIN(row, i);
                pseudoVINCount++;
            }
            csvVINs.add(vin);

            const daysInStock = parseInt(row.Days_In_Stock || '0');
            const firstSeenAt = calculateFirstSeenAt(daysInStock);
            const listingUrl = row.Dealership_URL || row.URL || null;

            const vehicleData = {
                tenant_id: targetTenantId,
                source_url: targetSourceUrl,
                source_type: targetSourceType,
                vin,
                year: parseInt(row.Year || '0') || null,
                make: row.Make || 'Unknown',
                model: row.Model || 'Unknown',
                price: parseFloat(row.Price || '0') || null,
                mileage: parseInt(row.Mileage || '0') || null,
                listing_url: listingUrl,
                image_url: row.Photo_URL || row.Image || null,
                first_seen_at: existingVINs.has(vin) ? undefined : firstSeenAt,
                last_seen_at: new Date().toISOString(),
                status: 'active',
                listing_date_confidence: 'high',
                listing_date_source: 'manual_upload',
            };

            // Upsert
            // We need to handle the unique constraint carefully
            // unique_dealer_vehicle: (tenant_id, source_url, vin)
            // unique_competitor_vehicle: (source_url, vin) WHERE tenant_id IS NULL

            // We can use a single upsert call if we match the constraint
            const matchCriteria = targetTenantId
                ? { tenant_id: targetTenantId, source_url: targetSourceUrl, vin }
                : { source_url: targetSourceUrl, vin }; // Implicitly tenant_id is null in DB for this constraint? 
            // Actually, for upsert to work on the partial index, we might need to be explicit or rely on the conflict target.

            // Let's try explicit upsert with onConflict
            const onConflict = targetTenantId ? 'tenant_id,source_url,vin' : 'source_url,vin';

            const { error: upsertError } = await supabaseClient
                .from('tracked_vehicles')
                .upsert(vehicleData, { onConflict });

            if (upsertError) {
                // If it failed, it might be due to the partial index constraint not being picked up by 'onConflict' string
                // But 'source_url,vin' should match the unique constraint for competitors if we don't pass tenant_id in the conflict?
                // Actually, if tenant_id is null, 'tenant_id,source_url,vin' constraint (NULLS NOT DISTINCT) should work if defined that way.
                // Our migration defined: UNIQUE NULLS NOT DISTINCT (tenant_id, source_url, vin)
                // So we can ALWAYS use 'tenant_id,source_url,vin' as the conflict target!

                // Retry with full constraint if first attempt failed (or just use full constraint always)
                const { error: retryError } = await supabaseClient
                    .from('tracked_vehicles')
                    .upsert(vehicleData, { onConflict: 'tenant_id,source_url,vin' });

                if (retryError) {
                    errors.push(`Failed to upsert ${vin}: ${retryError.message}`);
                } else {
                    if (existingVINs.has(vin)) updatedCount++; else newCount++;
                }
            } else {
                if (existingVINs.has(vin)) updatedCount++; else newCount++;
            }
        }

        // 4. Mark Sold (Unified)
        let soldCount = 0;
        const vehiclesToMarkSold = (existingVehicles || []).filter(v => !csvVINs.has(v.vin));
        for (const v of vehiclesToMarkSold) {
            const { error: sErr } = await supabaseClient.from('tracked_vehicles')
                .update({ status: 'sold', last_seen_at: new Date().toISOString() })
                .eq('id', v.id);
            if (!sErr) soldCount++;
        }

        // 5. Create Snapshot (Unified)
        const stats = aggregateVehicleData(rows);
        await supabaseClient.from('inventory_snapshots_unified').upsert({
            source_url: targetSourceUrl,
            source_type: targetSourceType,
            source_name: source.source_name,
            tenant_id: targetTenantId,
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
            status: 'success',
        }, { onConflict: targetTenantId ? 'tenant_id,snapshot_date' : 'source_url,snapshot_date' });

        // 6. Update Upload Record
        if (uploadRecordId) {
            await supabaseClient.from('manual_scraping_uploads').update({
                status: 'completed',
                vehicles_processed: rows.length,
                vehicles_new: newCount,
                vehicles_updated: updatedCount,
                vehicles_sold: soldCount,
                error_log: errors.length > 0 ? { errors } : null
            }).eq('id', uploadRecordId);
        }

        // 7. Update Tenant Inventory Status (if Dealer)
        if (targetTenantId) {
            await supabaseClient.from('tenants').update({
                inventory_status: 'ready',
                inventory_ready_at: new Date().toISOString()
            }).eq('id', targetTenantId);
        }

        // 8. Update Waiting List (if Competitor)
        if (!targetTenantId) {
            await supabaseClient.from('competitor_scraping_waiting_list')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .ilike('competitor_url', `%${cleanDomain}%`);
        }

        return new Response(JSON.stringify({
            success: true,
            vehicles_processed: stats.vehicle_count,
            vehicles_new: newCount,
            vehicles_updated: updatedCount,
            vehicles_sold: soldCount,
            source_url: targetSourceUrl,
            source_type: targetSourceType,
            errors
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in universal upload:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            details: error instanceof Error ? error.stack : undefined
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
});
