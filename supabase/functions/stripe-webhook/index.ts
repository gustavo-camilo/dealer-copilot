import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const priceProMonthly = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY');
const priceEnterpriseMonthly = Deno.env.get('STRIPE_PRICE_ENTERPRISE_MONTHLY');

if (!stripeSecretKey || !webhookSecret) {
  throw new Error('Missing Stripe secrets');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
  cryptoProvider: Stripe.createSubtleCryptoProvider(),
});

const formatDate = (unixSeconds?: number | null) => {
  if (!unixSeconds) {
    return new Date().toISOString().split('T')[0];
  }
  return new Date(unixSeconds * 1000).toISOString().split('T')[0];
};

const mapStatus = (status: string) => {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
      return status;
    case 'incomplete':
    case 'paused':
      return 'past_due';
    case 'incomplete_expired':
      return 'unpaid';
    default:
      return 'past_due';
  }
};

const mapPlanType = (priceId?: string | null) => {
  if (!priceId) return 'free';
  if (priceId === priceProMonthly) return 'pro';
  if (priceId === priceEnterpriseMonthly) return 'enterprise';
  return 'free';
};

const mapTier = (planType: string) => {
  if (planType === 'pro') return 'professional';
  if (planType === 'enterprise') return 'enterprise';
  return 'starter';
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const upsertSubscription = async (payload: {
    tenantId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    status?: string;
    planType?: string;
    billingInterval?: string;
    amount?: number;
    currency?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    trialEnd?: string | null;
  }) => {
    const today = new Date().toISOString().split('T')[0];
    const subscriptionData = {
      tenant_id: payload.tenantId,
      plan_type: payload.planType || 'free',
      status: payload.status || 'unpaid',
      billing_interval: payload.billingInterval || 'monthly',
      amount: payload.amount ?? 0,
      currency: payload.currency || 'USD',
      current_period_start: payload.currentPeriodStart || today,
      current_period_end: payload.currentPeriodEnd || today,
      trial_end: payload.trialEnd || null,
      stripe_customer_id: payload.stripeCustomerId || null,
      stripe_subscription_id: payload.stripeSubscriptionId || null,
    };

    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'tenant_id' });

    if (upsertError) {
      throw upsertError;
    }

    const shouldGrantAccess = payload.status === 'active' || payload.status === 'trialing';
    const tenantPlan = shouldGrantAccess ? payload.planType || 'free' : 'free';
    const tenantTier = shouldGrantAccess ? mapTier(payload.planType || 'free') : 'starter';

    const { error: tenantUpdateError } = await supabase
      .from('tenants')
      .update({
        plan_type: tenantPlan,
        subscription_tier: tenantTier,
      })
      .eq('id', payload.tenantId);

    if (tenantUpdateError) {
      throw tenantUpdateError;
    }
  };

  const syncStripeSubscription = async (subscription: Stripe.Subscription) => {
    const stripeCustomerId = subscription.customer as string;
    const stripeSubscriptionId = subscription.id;
    const price = subscription.items.data[0]?.price;
    const planType = mapPlanType(price?.id || null);
    const status = mapStatus(subscription.status);
    const billingInterval = price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
    const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
    const currency = price?.currency?.toUpperCase() || 'USD';
    const currentPeriodStart = formatDate(subscription.current_period_start);
    const currentPeriodEnd = formatDate(subscription.current_period_end);
    const trialEnd = subscription.trial_end ? formatDate(subscription.trial_end) : null;

    let tenantId = subscription.metadata?.tenant_id || null;

    if (!tenantId) {
      const { data: subscriptionRow } = await supabase
        .from('subscriptions')
        .select('tenant_id')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle();

      tenantId = subscriptionRow?.tenant_id || null;
    }

    if (!tenantId) {
      const { data: subscriptionRow } = await supabase
        .from('subscriptions')
        .select('tenant_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .maybeSingle();

      tenantId = subscriptionRow?.tenant_id || null;
    }

    if (!tenantId) {
      throw new Error('Unable to resolve tenant for subscription');
    }

    await upsertSubscription({
      tenantId,
      stripeCustomerId,
      stripeSubscriptionId,
      status,
      planType,
      billingInterval,
      amount,
      currency,
      currentPeriodStart,
      currentPeriodEnd,
      trialEnd,
    });
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.client_reference_id || session.metadata?.tenant_id;
        const stripeCustomerId = session.customer as string | null;
        const stripeSubscriptionId = session.subscription as string | null;

        if (tenantId) {
          await upsertSubscription({
            tenantId,
            stripeCustomerId,
            stripeSubscriptionId,
            status: 'trialing',
            planType: session.metadata?.plan_type || 'free',
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.subscription as string | null;

        if (stripeSubscriptionId) {
          const { data: subscriptionRow } = await supabase
            .from('subscriptions')
            .select('tenant_id, stripe_customer_id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .maybeSingle();

          if (subscriptionRow?.tenant_id) {
            await upsertSubscription({
              tenantId: subscriptionRow.tenant_id,
              stripeCustomerId: subscriptionRow.stripe_customer_id,
              stripeSubscriptionId,
              status: 'active',
            });
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.subscription as string | null;

        if (stripeSubscriptionId) {
          const { data: subscriptionRow } = await supabase
            .from('subscriptions')
            .select('tenant_id, stripe_customer_id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .maybeSingle();

          if (subscriptionRow?.tenant_id) {
            await upsertSubscription({
              tenantId: subscriptionRow.tenant_id,
              stripeCustomerId: subscriptionRow.stripe_customer_id,
              stripeSubscriptionId,
              status: 'past_due',
            });
          }
        }
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
