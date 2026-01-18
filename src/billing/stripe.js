// src/billing/stripe.js
// Stripe SDK wrapper and configuration
import Stripe from 'stripe';
import logger from '../logger.js';

const log = logger.child('stripe');

// Pricing configuration
export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 4900, // $49 in cents
    priceId: process.env.STRIPE_PRICE_STARTER,
    limits: {
      leads: 50,
      pipelineRuns: 25,
      emails: 100
    }
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 14900, // $149 in cents
    priceId: process.env.STRIPE_PRICE_GROWTH,
    limits: {
      leads: 200,
      pipelineRuns: 100,
      emails: 500
    }
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 39900, // $399 in cents
    priceId: process.env.STRIPE_PRICE_AGENCY,
    limits: {
      leads: -1, // unlimited
      pipelineRuns: 500,
      emails: 2000
    }
  }
};

// Overage pricing (in cents)
export const OVERAGE_RATES = {
  pipelineRun: 100,  // $1.00 per extra pipeline run
  email: 10,         // $0.10 per extra email
  lead: 5            // $0.05 per extra lead discovery
};

let stripeClient = null;

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Get or create Stripe client
 */
export function getStripeClient() {
  if (!stripeClient) {
    if (!isStripeConfigured()) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia'
    });
    log.info('Stripe client initialized');
  }
  return stripeClient;
}

/**
 * Create a Stripe customer for a tenant
 */
export async function createCustomer(tenantId, email, name, metadata = {}) {
  const stripe = getStripeClient();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      tenantId,
      ...metadata
    }
  });

  log.info('Stripe customer created', { customerId: customer.id, tenantId });
  return customer;
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId) {
  const stripe = getStripeClient();
  return stripe.customers.retrieve(customerId);
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(customerId, planId, successUrl, cancelUrl) {
  const stripe = getStripeClient();
  const plan = PLANS[planId];

  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  if (!plan.priceId) {
    throw new Error(`Price ID not configured for plan: ${planId}. Set STRIPE_PRICE_${planId.toUpperCase()}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price: plan.priceId,
      quantity: 1
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      planId
    }
  });

  log.info('Checkout session created', { sessionId: session.id, planId });
  return session;
}

/**
 * Create a billing portal session
 */
export async function createPortalSession(customerId, returnUrl) {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });

  return session;
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId) {
  const stripe = getStripeClient();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId, immediately = false) {
  const stripe = getStripeClient();

  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  // Cancel at period end
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  });
}

/**
 * Update subscription plan
 */
export async function updateSubscriptionPlan(subscriptionId, newPlanId) {
  const stripe = getStripeClient();
  const plan = PLANS[newPlanId];

  if (!plan || !plan.priceId) {
    throw new Error(`Invalid plan: ${newPlanId}`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: plan.priceId
    }],
    proration_behavior: 'create_prorations'
  });
}

/**
 * Create usage record for metered billing
 */
export async function createUsageRecord(subscriptionItemId, quantity, action = 'increment') {
  const stripe = getStripeClient();

  return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    action,
    timestamp: Math.floor(Date.now() / 1000)
  });
}

/**
 * Get plan limits for a subscription
 */
export function getPlanLimits(planId) {
  const plan = PLANS[planId];
  return plan ? plan.limits : PLANS.starter.limits;
}

/**
 * Verify webhook signature
 */
export function constructWebhookEvent(payload, signature) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export default {
  isStripeConfigured,
  getStripeClient,
  createCustomer,
  getCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  updateSubscriptionPlan,
  createUsageRecord,
  getPlanLimits,
  constructWebhookEvent,
  PLANS,
  OVERAGE_RATES
};
