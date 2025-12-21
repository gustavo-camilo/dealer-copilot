import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { tenantId, email, name } = await req.json().catch(() => ({}));

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, contact_email')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError) {
      throw tenantError;
    }

    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existingSub, error: existingSubError } = await supabase
      .from('subscriptions')
      .select('id, stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingSubError) {
      throw existingSubError;
    }

    if (existingSub?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ stripe_customer_id: existingSub.stripe_customer_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customer = await stripe.customers.create({
      email: email || tenant.contact_email || undefined,
      name: name || tenant.name || undefined,
      metadata: {
        tenant_id: tenantId,
      },
    });

    if (existingSub?.id) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customer.id })
        .eq('tenant_id', tenantId);

      if (updateError) {
        throw updateError;
      }
    } else {
      const today = new Date().toISOString().split('T')[0];
      const { error: insertError } = await supabase.from('subscriptions').insert({
        tenant_id: tenantId,
        plan_type: 'free',
        status: 'unpaid',
        billing_interval: 'monthly',
        amount: 0,
        currency: 'USD',
        current_period_start: today,
        current_period_end: today,
        trial_end: null,
        stripe_customer_id: customer.id,
      });

      if (insertError) {
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ stripe_customer_id: customer.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stripe customer error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
