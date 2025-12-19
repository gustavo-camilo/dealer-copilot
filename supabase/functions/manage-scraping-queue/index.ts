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

        const { action, id, ...payload } = await req.json();

        if (!id) throw new Error('Missing ID');

        let result;

        if (action === 'update_status') {
            const { status } = payload;
            result = await supabaseClient
                .from('source_registry')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);
        } else if (action === 'assign') {
            const { assigned_to } = payload;
            result = await supabaseClient
                .from('source_registry')
                .update({ assigned_to, updated_at: new Date().toISOString() })
                .eq('id', id);
        } else if (action === 'delete') {
            // Hard delete to remove from queue and allow cleanup of bad data
            result = await supabaseClient
                .from('source_registry')
                .delete()
                .eq('id', id);
        } else if (action === 'update_priority') {
            const { priority } = payload;
            result = await supabaseClient
                .from('source_registry')
                .update({ priority, updated_at: new Date().toISOString() })
                .eq('id', id);
        } else {
            throw new Error('Invalid action');
        }

        if (result.error) throw result.error;

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
