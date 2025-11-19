import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Check if user is super_admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'super_admin') {
      throw new Error('Insufficient permissions. Must be super_admin.');
    }

    // Parse request body
    const { snapshot_id, action } = await req.json();

    if (!snapshot_id) {
      throw new Error('Missing required field: snapshot_id');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Invalid action. Must be "approve" or "reject"');
    }

    // Fetch the snapshot
    const { data: snapshot, error: snapshotError } = await supabaseClient
      .from('inventory_snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .single();

    if (snapshotError || !snapshot) {
      throw new Error(`Snapshot not found: ${snapshot_id}`);
    }

    if (snapshot.status !== 'pending_review') {
      throw new Error(`Snapshot is not in pending_review status. Current status: ${snapshot.status}`);
    }

    if (action === 'reject') {
      // Reject: Just update snapshot status
      const { error: updateError } = await supabaseClient
        .from('inventory_snapshots')
        .update({
          status: 'failed',
          error_message: 'Rejected by admin during review',
        })
        .eq('id', snapshot_id);

      if (updateError) {
        throw new Error(`Failed to reject snapshot: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'rejected',
          snapshot_id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Approve: Apply the pending changes to vehicle_history
    // The raw_data contains the vehicles that were found
    const vehiclesData = snapshot.raw_data?.vehicles || [];

    if (!Array.isArray(vehiclesData) || vehiclesData.length === 0) {
      throw new Error('No vehicle data found in snapshot');
    }

    let newCount = 0;
    let updatedCount = 0;
    let soldCount = 0;

    // Get existing vehicles for this tenant
    const { data: existingVehicles, error: existingError } = await supabaseClient
      .from('vehicle_history')
      .select('vin, id')
      .eq('tenant_id', snapshot.tenant_id)
      .eq('status', 'active');

    if (existingError) {
      console.error('Error fetching existing vehicles:', existingError);
    }

    const existingVINs = new Set((existingVehicles || []).map(v => v.vin));
    const scrapedVINs = new Set<string>();

    // Process each vehicle
    for (const vehicle of vehiclesData) {
      if (!vehicle.vin) continue;

      scrapedVINs.add(vehicle.vin);

      if (existingVINs.has(vehicle.vin)) {
        // Update existing vehicle
        const { error: updateError } = await supabaseClient
          .from('vehicle_history')
          .update({
            price: vehicle.price,
            mileage: vehicle.mileage,
            last_seen_at: new Date().toISOString(),
            image_urls: vehicle.image_urls || [],
          })
          .eq('vin', vehicle.vin)
          .eq('tenant_id', snapshot.tenant_id);

        if (!updateError) {
          updatedCount++;
        }
      } else {
        // Insert new vehicle
        const { error: insertError } = await supabaseClient
          .from('vehicle_history')
          .insert({
            tenant_id: snapshot.tenant_id,
            vin: vehicle.vin,
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
            price: vehicle.price,
            mileage: vehicle.mileage,
            exterior_color: vehicle.exterior_color,
            listing_url: vehicle.listing_url,
            image_urls: vehicle.image_urls || [],
            first_seen_at: vehicle.first_seen_at || new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            status: 'active',
            listing_date_confidence: vehicle.listing_date_confidence || 'medium',
            listing_date_source: vehicle.listing_date_source || 'automated_scraper',
          });

        if (!insertError) {
          newCount++;
        }
      }
    }

    // Mark vehicles not in scraped data as sold
    const vehiclesToMarkSold = (existingVehicles || []).filter(v => !scrapedVINs.has(v.vin));

    for (const vehicle of vehiclesToMarkSold) {
      const { error: soldError } = await supabaseClient
        .from('vehicle_history')
        .update({
          status: 'sold',
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (!soldError) {
        soldCount++;
      }
    }

    // Update snapshot status to approved/success
    const { error: approveError } = await supabaseClient
      .from('inventory_snapshots')
      .update({
        status: 'success',
        vehicles_found: vehiclesData.length,
      })
      .eq('id', snapshot_id);

    if (approveError) {
      throw new Error(`Failed to approve snapshot: ${approveError.message}`);
    }

    // Update tenant inventory status to 'ready'
    const { error: tenantUpdateError } = await supabaseClient
      .from('tenants')
      .update({
        inventory_status: 'ready',
        inventory_ready_at: new Date().toISOString(),
      })
      .eq('id', snapshot.tenant_id);

    if (tenantUpdateError) {
      console.error('Failed to update tenant status:', tenantUpdateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: 'approved',
        snapshot_id,
        vehicles_new: newCount,
        vehicles_updated: updatedCount,
        vehicles_sold: soldCount,
        total_processed: vehiclesData.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error approving scraping results:', error);
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
