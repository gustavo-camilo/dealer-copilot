import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorWaitingListEntry {
  id: string;
  tenant_id: string;
  competitor_url: string;
  competitor_name: string | null;
  requested_at: string;
  status: string;
  assigned_to: string | null;
  priority: number;
  notes: string | null;
  completed_at: string | null;
  notified_at: string | null;
  tenant: {
    name: string;
    contact_email: string;
    contact_phone: string | null;
    location: string | null;
  };
  assigned_user: {
    full_name: string;
    email: string;
  } | null;
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

    // Parse query parameters
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'all';
    const includeCompleted = url.searchParams.get('include_completed') === 'true';

    // Build query
    let query = supabaseClient
      .from('competitor_scraping_waiting_list')
      .select(`
        id,
        tenant_id,
        competitor_url,
        competitor_name,
        requested_at,
        status,
        assigned_to,
        priority,
        notes,
        completed_at,
        notified_at,
        tenants!inner (
          name,
          contact_email,
          contact_phone,
          location
        )
      `);

    // Filter by status if requested
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Optionally exclude completed entries
    if (!includeCompleted) {
      query = query.neq('status', 'completed');
    }

    // Sort by priority (DESC) then requested_at (ASC)
    query = query.order('priority', { ascending: false }).order('requested_at', { ascending: true });

    const { data: waitingList, error: listError } = await query;

    if (listError) {
      throw new Error(`Failed to fetch competitor waiting list: ${listError.message}`);
    }

    // Fetch assigned user details for entries that have assignments
    const entriesWithAssignees = waitingList.filter((entry: any) => entry.assigned_to);
    const assigneeIds = [...new Set(entriesWithAssignees.map((e: any) => e.assigned_to))];

    let assigneeMap: Record<string, { full_name: string; email: string }> = {};

    if (assigneeIds.length > 0) {
      const { data: assignees, error: assigneeError } = await supabaseClient
        .from('users')
        .select('id, full_name, email')
        .in('id', assigneeIds);

      if (!assigneeError && assignees) {
        assigneeMap = assignees.reduce((acc: any, user: any) => {
          acc[user.id] = { full_name: user.full_name, email: user.email };
          return acc;
        }, {} as Record<string, { full_name: string; email: string }>);
      }
    }

    // Format response with assigned user details
    const formattedList: CompetitorWaitingListEntry[] = (waitingList || []).map((entry: any) => ({
      id: entry.id,
      tenant_id: entry.tenant_id,
      competitor_url: entry.competitor_url,
      competitor_name: entry.competitor_name,
      requested_at: entry.requested_at,
      status: entry.status,
      assigned_to: entry.assigned_to,
      priority: entry.priority,
      notes: entry.notes,
      completed_at: entry.completed_at,
      notified_at: entry.notified_at,
      tenant: {
        name: entry.tenants.name,
        contact_email: entry.tenants.contact_email,
        contact_phone: entry.tenants.contact_phone,
        location: entry.tenants.location,
      },
      assigned_user: entry.assigned_to ? assigneeMap[entry.assigned_to] || null : null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        count: formattedList.length,
        waiting_list: formattedList,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching competitor waiting list:', error);
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
