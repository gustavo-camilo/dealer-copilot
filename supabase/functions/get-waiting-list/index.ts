import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WaitingListEntry {
  id: string;
  tenant_id: string;
  website_url: string;
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
    const status = url.searchParams.get('status') || 'pending';
    const includeCompleted = url.searchParams.get('include_completed') === 'true';

    // Build query
    let query = supabaseClient
      .from('scraping_waiting_list')
      .select(`
        id,
        tenant_id,
        website_url,
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

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Optionally exclude completed entries
    if (!includeCompleted) {
      query = query.neq('status', 'completed');
    }

    // Order by priority (DESC) then requested_at (ASC)
    query = query.order('priority', { ascending: false });
    query = query.order('requested_at', { ascending: true });

    const { data: waitingList, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to fetch waiting list: ${queryError.message}`);
    }

    // Fetch assigned user details for entries that have assignments
    const entriesWithAssignees = waitingList.filter(entry => entry.assigned_to);
    const assigneeIds = [...new Set(entriesWithAssignees.map(e => e.assigned_to))];

    let assigneeMap: Record<string, { full_name: string; email: string }> = {};

    if (assigneeIds.length > 0) {
      const { data: assignees, error: assigneeError } = await supabaseClient
        .from('users')
        .select('id, full_name, email')
        .in('id', assigneeIds);

      if (!assigneeError && assignees) {
        assigneeMap = assignees.reduce((acc, user) => {
          acc[user.id] = { full_name: user.full_name, email: user.email };
          return acc;
        }, {} as Record<string, { full_name: string; email: string }>);
      }
    }

    // Format response
    const formattedList: WaitingListEntry[] = waitingList.map(entry => ({
      id: entry.id,
      tenant_id: entry.tenant_id,
      website_url: entry.website_url,
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
    console.error('Error fetching waiting list:', error);
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
