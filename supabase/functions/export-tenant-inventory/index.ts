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

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check user role
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    // Parse request parameters
    const url = new URL(req.url);
    let tenantId = url.searchParams.get('tenant_id');

    // If not super_admin, can only export their own tenant's data
    if (userData.role !== 'super_admin') {
      if (tenantId && tenantId !== userData.tenant_id) {
        throw new Error('Insufficient permissions to export other tenants data');
      }
      tenantId = userData.tenant_id;
    }

    if (!tenantId) {
      throw new Error('Missing tenant_id parameter');
    }

    // Fetch tenant info
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error('Tenant not found');
    }

    // Fetch all vehicles for this tenant
    const { data: vehicles, error: vehiclesError } = await supabaseClient
      .from('vehicle_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('last_seen_at', { ascending: false });

    if (vehiclesError) {
      throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`);
    }

    if (!vehicles || vehicles.length === 0) {
      throw new Error('No vehicles found for this tenant');
    }

    // Generate CSV
    const csvHeaders = [
      'VIN',
      'Year',
      'Make',
      'Model',
      'Trim',
      'Price',
      'Mileage',
      'Exterior_Color',
      'Status',
      'Stock_Number',
      'Listing_URL',
      'First_Photo_URL',
      'First_Seen_Date',
      'Last_Seen_Date',
      'Days_In_Inventory',
      'Listing_Date_Confidence',
      'Listing_Date_Source',
    ];

    const csvRows = vehicles.map(vehicle => {
      // Calculate days in inventory
      const firstSeen = new Date(vehicle.first_seen_at);
      const lastSeen = new Date(vehicle.last_seen_at);
      const daysInInventory = Math.floor((lastSeen.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));

      // Get first photo URL
      const firstPhoto = vehicle.image_urls && vehicle.image_urls.length > 0
        ? vehicle.image_urls[0]
        : '';

      return [
        vehicle.vin || '',
        vehicle.year || '',
        vehicle.make || '',
        vehicle.model || '',
        vehicle.trim || '',
        vehicle.price || '',
        vehicle.mileage || '',
        vehicle.exterior_color || '',
        vehicle.status || '',
        vehicle.stock_number || '',
        vehicle.listing_url || '',
        firstPhoto,
        vehicle.first_seen_at ? new Date(vehicle.first_seen_at).toLocaleDateString() : '',
        vehicle.last_seen_at ? new Date(vehicle.last_seen_at).toLocaleDateString() : '',
        daysInInventory,
        vehicle.listing_date_confidence || '',
        vehicle.listing_date_source || '',
      ].map(field => {
        // Escape commas and quotes in CSV
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
      }).join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Generate filename
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const sanitizedTenantName = tenant.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `inventory_${sanitizedTenantName}_${dateString}.csv`;

    // Return CSV file
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error exporting inventory:', error);
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
