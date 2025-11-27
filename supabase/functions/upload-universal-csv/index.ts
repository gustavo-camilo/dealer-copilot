import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Add the last field
    result.push(current.trim());

    return result;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log('=== Upload Universal CSV Function Called ===');
        console.log('Request method:', req.method);
        console.log('Request headers:', Object.fromEntries(req.headers.entries()));

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        const authHeader = req.headers.get('Authorization') || undefined;

        let requestBody;
        try {
            requestBody = await req.json();
            console.log('Request body keys:', Object.keys(requestBody));
            console.log('Filename:', requestBody.filename);
            console.log('Tenant ID:', requestBody.tenant_id);
            console.log('CSV content length:', requestBody.csv_content?.length || 0);
        } catch (jsonError) {
            console.error('Failed to parse JSON body:', jsonError);
            throw new Error('Invalid JSON in request body');
        }

        const { csv_content, filename, tenant_id } = requestBody;

        if (!csv_content) {
            console.error('Validation failed: Missing csv_content');
            throw new Error('Missing csv_content');
        }

        // 1. Parse CSV to find the URL
        const lines = csv_content.trim().split('\n').filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error('Empty CSV');

        const rawHeaders = parseCSVLine(lines[0]).map(normalizeHeader);
        const urlIndex = rawHeaders.findIndex(h =>
            ['url', 'dealership_url', 'dealershipurl', 'website_url', 'website'].includes(h)
        );

        if (urlIndex === -1) {
            throw new Error('Could not find URL column in CSV (expected URL or Dealership_URL)');
        }

        // Find the first data row that actually has a URL value
        let url = '';
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const candidate = values[urlIndex]?.trim();
            if (candidate) {
                url = candidate;
                break;
            }
        }

        if (!url) {
            throw new Error('No rows with a URL value were found in the CSV');
        }

        const cleanDomain = extractDomain(url);
        console.log(`Detected URL from CSV: ${url} (Domain: ${cleanDomain})`);

        // 2. Check if this URL belongs to a Tenant (Dealer Inventory)
        const { data: tenant, error: tenantError } = await supabaseClient
            .from('tenants')
            .select('id, name, website_url')
            .ilike('website_url', `%${cleanDomain}%`)
            .maybeSingle();

        if (tenantError) {
            console.warn('Tenant lookup error:', tenantError);
        }

        if (tenant) {
            console.log(`URL matches Tenant: ${tenant.name}. Routing to Dealer Upload.`);

            // Call upload-manual-scraping
            const { data, error } = await supabaseClient.functions.invoke('upload-manual-scraping', {
                body: { csv_content, filename, tenant_id: tenant.id }, // Use matched tenant_id
                headers: authHeader ? { Authorization: authHeader } : undefined
            });

            if (error) {
                console.error('Error calling upload-manual-scraping:', error);
                throw new Error(error.message || 'upload-manual-scraping failed');
            }

            console.log('upload-manual-scraping response:', data);
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. Check if this URL is a known Competitor (Competitor Inventory)
        // We check the waiting list to see if ANYONE is tracking this competitor.
        // Or we just treat it as a competitor upload regardless.
        // Ideally, we check if it's in the waiting list to get the "Competitor Name".

        const { data: competitorEntry, error: competitorError } = await supabaseClient
            .from('competitor_scraping_waiting_list')
            .select('id, competitor_name, competitor_url')
            .ilike('competitor_url', `%${cleanDomain}%`)
            .limit(1)
            .maybeSingle();

        if (competitorError) {
            console.warn('Competitor waiting list lookup error:', competitorError);
        }

        console.log(`URL does not match any Tenant. Routing to Competitor Upload.`);

        // Call process-competitor-csv
        // We pass the raw URL found in the CSV (or the one from waiting list if matched)
        const targetUrl = competitorEntry?.competitor_url || url;
        const targetName = competitorEntry?.competitor_name || null;
        const waitingListId = competitorEntry?.id || null;

        const { data, error } = await supabaseClient.functions.invoke('process-competitor-csv', {
            body: {
                csv_content,
                filename,
                competitor_url: targetUrl,
                competitor_name: targetName,
                waiting_list_entry_id: waitingListId, // Pass the waiting list ID to auto-complete it
                tenant_id // Pass the uploader's tenant_id for logging (optional)
            },
            headers: authHeader ? { Authorization: authHeader } : undefined
        });

        if (error) {
            console.error('Error calling process-competitor-csv:', error);
            throw new Error(error.message || 'process-competitor-csv failed');
        }

        console.log('process-competitor-csv response:', data);
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in universal upload:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error details:', { message: errorMessage, stack: errorStack });

        return new Response(
            JSON.stringify({
                success: false,
                error: errorMessage,
                details: errorStack
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
