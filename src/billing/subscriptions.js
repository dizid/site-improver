// src/billing/subscriptions.js
// Subscription lifecycle management
import logger from '../logger.js';
import {
  createCustomer,
  getCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  updateSubscriptionPlan,
  PLANS,
  isStripeConfigured
} from './stripe.js';
import { resetUsage, getUsageSummary } from './usage.js';

const log = logger.child('subscriptions');

// In-memory tenant store (replace with db in production)
const tenantStore = new Map();

/**
 * Get or create tenant billing record
 */
export async function getTenant(tenantId) {
  if (!tenantStore.has(tenantId)) {
    return null;
  }
  return tenantStore.get(tenantId);
}

/**
 * Create new tenant with billing
 */
export async function createTenant(tenantId, email, name) {
  if (tenantStore.has(tenantId)) {
    return tenantStore.get(tenantId);
  }

  const tenant = {
    tenantId,
    email,
    name,
    stripeCustomerId: null,
    subscriptionId: null,
    planId: 'free', // Start with free tier
    status: 'trialing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Create Stripe customer if configured
  if (isStripeConfigured()) {
    try {
      const customer = await createCustomer(tenantId, email, name);
      tenant.stripeCustomerId = customer.id;
    } catch (error) {
      log.warn('Failed to create Stripe customer', { tenantId, error: error.message });
    }
  }

  tenantStore.set(tenantId, tenant);
  log.info('Tenant created', { tenantId, email });
  return tenant;
}

/**
 * Update tenant record
 */
export async function updateTenant(tenantId, updates) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  Object.assign(tenant, updates, { updatedAt: new Date().toISOString() });
  tenantStore.set(tenantId, tenant);
  return tenant;
}

/**
 * Start checkout flow for a plan
 */
export async function startCheckout(tenantId, planId, returnUrl) {
  let tenant = await getTenant(tenantId);

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  if (!tenant.stripeCustomerId) {
    // Create Stripe customer if missing
    const customer = await createCustomer(tenantId, tenant.email, tenant.name);
    tenant = await updateTenant(tenantId, { stripeCustomerId: customer.id });
  }

  const successUrl = `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`;
  const cancelUrl = `${returnUrl}?canceled=true`;

  const session = await createCheckoutSession(
    tenant.stripeCustomerId,
    planId,
    successUrl,
    cancelUrl
  );

  return {
    sessionId: session.id,
    url: session.url
  };
}

/**
 * Get billing portal URL
 */
export async function getBillingPortal(tenantId, returnUrl) {
  const tenant = await getTenant(tenantId);

  if (!tenant || !tenant.stripeCustomerId) {
    throw new Error('No billing account found');
  }

  const session = await createPortalSession(tenant.stripeCustomerId, returnUrl);
  return session.url;
}

/**
 * Handle successful subscription activation
 * Called by webhook handler
 */
export async function activateSubscription(tenantId, subscriptionId, planId) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    log.warn('Tenant not found for subscription activation', { tenantId, subscriptionId });
    return null;
  }

  await updateTenant(tenantId, {
    subscriptionId,
    planId,
    status: 'active'
  });

  // Reset usage for new subscription
  await resetUsage(tenantId);

  log.info('Subscription activated', { tenantId, planId, subscriptionId });
  return getTenant(tenantId);
}

/**
 * Handle subscription cancellation
 */
export async function deactivateSubscription(tenantId) {
  const tenant = await getTenant(tenantId);
  if (!tenant) return null;

  await updateTenant(tenantId, {
    status: 'canceled',
    planId: 'free'
  });

  log.info('Subscription deactivated', { tenantId });
  return getTenant(tenantId);
}

/**
 * Handle subscription renewal
 */
export async function renewSubscription(tenantId) {
  // Reset usage for new billing period
  await resetUsage(tenantId);
  log.info('Subscription renewed, usage reset', { tenantId });
}

/**
 * Change subscription plan
 */
export async function changePlan(tenantId, newPlanId) {
  const tenant = await getTenant(tenantId);
  if (!tenant || !tenant.subscriptionId) {
    throw new Error('No active subscription');
  }

  await updateSubscriptionPlan(tenant.subscriptionId, newPlanId);
  await updateTenant(tenantId, { planId: newPlanId });

  log.info('Plan changed', { tenantId, newPlanId });
  return getTenant(tenantId);
}

/**
 * Cancel subscription
 */
export async function cancelTenantSubscription(tenantId, immediately = false) {
  const tenant = await getTenant(tenantId);
  if (!tenant || !tenant.subscriptionId) {
    throw new Error('No active subscription');
  }

  await cancelSubscription(tenant.subscriptionId, immediately);

  const newStatus = immediately ? 'canceled' : 'canceling';
  await updateTenant(tenantId, { status: newStatus });

  log.info('Subscription cancellation initiated', { tenantId, immediately });
  return getTenant(tenantId);
}

/**
 * Get subscription status and billing info
 */
export async function getSubscriptionInfo(tenantId) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return {
      status: 'none',
      planId: 'free',
      canUseFeatures: false
    };
  }

  const plan = PLANS[tenant.planId] || PLANS.starter;
  const usage = await getUsageSummary(tenantId, tenant.planId);

  let subscription = null;
  if (tenant.subscriptionId && isStripeConfigured()) {
    try {
      subscription = await getSubscription(tenant.subscriptionId);
    } catch (error) {
      log.warn('Failed to fetch subscription', { tenantId, error: error.message });
    }
  }

  return {
    status: tenant.status,
    planId: tenant.planId,
    planName: plan.name,
    planPrice: plan.price,
    canUseFeatures: ['active', 'trialing'].includes(tenant.status),
    usage,
    subscription: subscription ? {
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    } : null
  };
}

/**
 * Check if tenant can use a feature (has active subscription)
 */
export async function canUseFeatures(tenantId) {
  const tenant = await getTenant(tenantId);
  if (!tenant) return false;

  // Allow usage during trial or active subscription
  return ['active', 'trialing'].includes(tenant.status);
}

/**
 * Get all available plans
 */
export function getAvailablePlans() {
  return Object.values(PLANS).map(plan => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    limits: plan.limits
  }));
}

export default {
  getTenant,
  createTenant,
  updateTenant,
  startCheckout,
  getBillingPortal,
  activateSubscription,
  deactivateSubscription,
  renewSubscription,
  changePlan,
  cancelTenantSubscription,
  getSubscriptionInfo,
  canUseFeatures,
  getAvailablePlans
};
