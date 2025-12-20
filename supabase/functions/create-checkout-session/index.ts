import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const priceProMonthly = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY');
const priceEnterpriseMonthly = Deno.env.get('STRIPE_PRICE_ENTERPRISE_MONTHLY');
const successUrl = Deno.env.get('STRIPE_CHECKOUT_SUCCESS_URL') || 'https://dealer-copilot.com/upgrade/success';
const cancelUrl = Deno.env.get('STRIPE_CHECKOUT_CANCEL_URL') || 'https://dealer-copilot.com/upgrade';
const trialDays = 7;

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
    const { tenantId, planType } = await req.json().catch(() => ({}));

    if (!tenantId || !planType) {
      return new Response(JSON.stringify({ error: 'tenantId and planType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId =
      planType === 'pro'
        ? priceProMonthly
        : planType === 'enterprise'
        ? priceEnterpriseMonthly
        : undefined;

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid or missing price ID' }), {
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

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    let stripeCustomerId = subscription?.stripe_customer_id || null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenant.contact_email || undefined,
        name: tenant.name || undefined,
        metadata: {
          tenant_id: tenantId,
        },
      });

      stripeCustomerId = customer.id;

      const today = new Date().toISOString().split('T')[0];
      const { data: existingSub, error: existingSubError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existingSubError) {
        throw existingSubError;
      }

      if (existingSub?.id) {
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('tenant_id', tenantId);

        if (updateError) {
          throw updateError;
        }
      } else {
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
          stripe_customer_id: stripeCustomerId,
        });

        if (insertError) {
          throw insertError;
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          tenant_id: tenantId,
          plan_type: planType,
        },
      },
      metadata: {
        tenant_id: tenantId,
        plan_type: planType,
      },
      client_reference_id: tenantId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Checkout session error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
