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

    // First, get all tenants without inventory (inventory_status != 'ready')
    const { data: tenantsWithoutInventory, error: tenantsError } = await supabaseClient
      .from('tenants')
      .select('id, name, website_url, contact_email, contact_phone, location, created_at')
      .neq('inventory_status', 'ready')
      .order('created_at', { ascending: true });

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    // Get existing waiting list entries
    const { data: existingEntries, error: existingError } = await supabaseClient
      .from('scraping_waiting_list')
      .select('tenant_id, id, status, assigned_to, priority, notes, requested_at, completed_at, notified_at');

    if (existingError) {
      throw new Error(`Failed to fetch existing entries: ${existingError.message}`);
    }

    // Create a map of existing entries by tenant_id
    const existingMap = new Map(existingEntries.map(e => [e.tenant_id, e]));

    // For each tenant without inventory, ensure they have a waiting list entry
    const waitingListPromises = tenantsWithoutInventory.map(async (tenant) => {
      let entry = existingMap.get(tenant.id);

      // If no entry exists, create one
      if (!entry) {
        const { data: newEntry, error: insertError } = await supabaseClient
          .from('scraping_waiting_list')
          .insert({
            tenant_id: tenant.id,
            website_url: tenant.website_url || '',
            status: 'pending',
            priority: 2, // Default normal priority
            requested_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!insertError && newEntry) {
          entry = newEntry;
        }
      }

      return {
        id: entry?.id || '',
        tenant_id: tenant.id,
        website_url: tenant.website_url || '',
        requested_at: entry?.requested_at || tenant.created_at,
        status: entry?.status || 'pending',
        assigned_to: entry?.assigned_to || null,
        priority: entry?.priority || 2,
        notes: entry?.notes || null,
        completed_at: entry?.completed_at || null,
        notified_at: entry?.notified_at || null,
        tenant: {
          name: tenant.name,
          contact_email: tenant.contact_email,
          contact_phone: tenant.contact_phone,
          location: tenant.location,
        },
      };
    });

    let waitingList = await Promise.all(waitingListPromises);

    // Filter by status if requested
    if (status && status !== 'all') {
      waitingList = waitingList.filter(e => e.status === status);
    }

    // Optionally exclude completed entries
    if (!includeCompleted) {
      waitingList = waitingList.filter(e => e.status !== 'completed');
    }

    // Sort by priority (DESC) then requested_at (ASC)
    waitingList.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime();
    });

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

    // Format response with assigned user details
    const formattedList: WaitingListEntry[] = waitingList.map(entry => ({
      ...entry,
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
