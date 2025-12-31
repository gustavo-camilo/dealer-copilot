import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        // Verify user role
        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser();

        if (authError || !user) throw new Error('Unauthorized');

        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (userError || !userData || !['super_admin', 'va_uploader'].includes(userData.role)) {
            throw new Error('Insufficient permissions');
        }

        // Parse query params
        const url = new URL(req.url);
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type'); // dealer or competitor
        const assignee = url.searchParams.get('assignee');

        let query = supabaseClient
            .from('source_registry')
            .select(`
                *,
                tenant_sources (
                    tenant_id,
                    tenants (
                        name
                    )
                )
            `)
            .order('priority', { ascending: false })
            .order('next_scheduled_scrape', { ascending: true });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (type && type !== 'all') {
            query = query.eq('source_type', type);
        }

        if (assignee && assignee !== 'all') {
            if (assignee === 'me') {
                query = query.eq('assigned_to', user.id);
            } else {
                query = query.eq('assigned_to', assignee);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        // Map response to match frontend expectations (Adapter Pattern)
        const queue = (data || []).map((item: any) => {
            // Extract tenant name from the nested relationship
            const tenantName = item.tenant_sources && item.tenant_sources.length > 0
                ? item.tenant_sources[0].tenants?.name
                : 'System';

            return {
                ...item,
                tenant_name: tenantName,
                website_url: item.source_url, // Alias for backward compatibility
                requested_at: item.created_at, // Use created_at as requested_at
            };
        });

        return new Response(
            JSON.stringify({ success: true, queue }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
