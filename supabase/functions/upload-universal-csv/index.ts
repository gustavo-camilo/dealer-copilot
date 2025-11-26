import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        const { csv_content, filename, tenant_id } = await req.json();

        if (!csv_content) {
            throw new Error('Missing csv_content');
        }

        // 1. Parse CSV to find the URL
        const lines = csv_content.trim().split('\n');
        if (lines.length < 2) throw new Error('Empty CSV');

        const headers = lines[0].split(',').map(h => h.trim());
        // Unified template has 'URL' or 'Dealership_URL'
        const urlIndex = headers.findIndex(h => h === 'URL' || h === 'Dealership_URL');

        if (urlIndex === -1) {
            throw new Error('Could not find URL column in CSV');
        }

        // Get URL from first data row
        const firstRow = lines[1].split(',');
        let url = firstRow[urlIndex]?.trim();

        if (!url) {
            throw new Error('First row has empty URL');
        }

        // Clean URL for matching (remove protocol, www, trailing slash)
        const cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
        console.log(`Detected URL from CSV: ${url} (Clean: ${cleanUrl})`);

        // 2. Check if this URL belongs to a Tenant (Dealer Inventory)
        const { data: tenant, error: tenantError } = await supabaseClient
            .from('tenants')
            .select('id, name, website_url')
            .ilike('website_url', `%${cleanUrl}%`)
            .maybeSingle();

        if (tenant) {
            console.log(`URL matches Tenant: ${tenant.name}. Routing to Dealer Upload.`);

            // Call upload-manual-scraping
            const { data, error } = await supabaseClient.functions.invoke('upload-manual-scraping', {
                body: { csv_content, filename, tenant_id: tenant.id } // Use matched tenant_id
            });

            if (error) {
                console.error('Error calling upload-manual-scraping:', error);
                throw error;
            }

            console.log('upload-manual-scraping response:', data);
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. Check if this URL is a known Competitor (Competitor Inventory)
        // We check the waiting list to see if ANYONE is tracking this competitor.
        // Or we just treat it as a competitor upload regardless.
        // Ideally, we check if it's in the waiting list to get the "Competitor Name".

        const { data: competitorEntry } = await supabaseClient
            .from('competitor_scraping_waiting_list')
            .select('id, competitor_name, competitor_url')
            .ilike('competitor_url', `%${cleanUrl}%`)
            .limit(1)
            .maybeSingle();

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
            }
        });

        if (error) {
            console.error('Error calling process-competitor-csv:', error);
            throw error;
        }

        console.log('process-competitor-csv response:', data);
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in universal upload:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
