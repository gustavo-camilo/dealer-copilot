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
            .from('scraping_queue_view')
            .select('*')
            .order('priority', { ascending: false })
            .order('requested_at', { ascending: true });

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

        return new Response(
            JSON.stringify({ success: true, queue: data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
