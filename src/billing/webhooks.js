// src/billing/webhooks.js
// Stripe webhook event handlers
import logger from '../logger.js';
import { constructWebhookEvent, PLANS } from './stripe.js';
import {
  activateSubscription,
  deactivateSubscription,
  renewSubscription,
  updateTenant,
  getTenant
} from './subscriptions.js';

const log = logger.child('webhooks');

/**
 * Webhook event types we handle
 */
const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed'
];

/**
 * Extract tenant ID from Stripe customer metadata
 */
async function getTenantIdFromCustomer(customerId, stripe) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.metadata?.tenantId;
  } catch (error) {
    log.error('Failed to get tenant from customer', { customerId, error: error.message });
    return null;
  }
}

/**
 * Get plan ID from price ID
 */
function getPlanIdFromPrice(priceId) {
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) {
      return planId;
    }
  }
  return 'starter'; // Default fallback
}

/**
 * Handle checkout.session.completed
 * Customer completed the checkout flow
 */
async function handleCheckoutCompleted(event, stripe) {
  const session = event.data.object;

  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const planId = session.metadata?.planId || 'starter';

  const tenantId = await getTenantIdFromCustomer(customerId, stripe);
  if (!tenantId) {
    log.error('No tenant found for checkout completion', { customerId, subscriptionId });
    return;
  }

  await activateSubscription(tenantId, subscriptionId, planId);
  log.info('Checkout completed', { tenantId, planId, subscriptionId });
}

/**
 * Handle customer.subscription.created
 */
async function handleSubscriptionCreated(event, stripe) {
  const subscription = event.data.object;

  const tenantId = await getTenantIdFromCustomer(subscription.customer, stripe);
  if (!tenantId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const planId = getPlanIdFromPrice(priceId);

  await activateSubscription(tenantId, subscription.id, planId);
  log.info('Subscription created', { tenantId, planId });
}

/**
 * Handle customer.subscription.updated
 * Plan change, cancellation scheduled, etc.
 */
async function handleSubscriptionUpdated(event, stripe) {
  const subscription = event.data.object;

  const tenantId = await getTenantIdFromCustomer(subscription.customer, stripe);
  if (!tenantId) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const planId = getPlanIdFromPrice(priceId);

  const updates = {
    planId,
    status: subscription.status === 'active' ? 'active' :
            subscription.cancel_at_period_end ? 'canceling' :
            subscription.status
  };

  await updateTenant(tenantId, updates);
  log.info('Subscription updated', { tenantId, updates });
}

/**
 * Handle customer.subscription.deleted
 * Subscription was canceled and period ended
 */
async function handleSubscriptionDeleted(event, stripe) {
  const subscription = event.data.object;

  const tenantId = await getTenantIdFromCustomer(subscription.customer, stripe);
  if (!tenantId) return;

  await deactivateSubscription(tenantId);
  log.info('Subscription deleted', { tenantId });
}

/**
 * Handle invoice.paid
 * Recurring payment succeeded
 */
async function handleInvoicePaid(event, stripe) {
  const invoice = event.data.object;

  // Only handle subscription invoices
  if (!invoice.subscription) return;

  const tenantId = await getTenantIdFromCustomer(invoice.customer, stripe);
  if (!tenantId) return;

  // Reset usage on successful renewal
  await renewSubscription(tenantId);
  log.info('Invoice paid, usage reset', { tenantId, amount: invoice.amount_paid });
}

/**
 * Handle invoice.payment_failed
 * Payment failed
 */
async function handlePaymentFailed(event, stripe) {
  const invoice = event.data.object;

  const tenantId = await getTenantIdFromCustomer(invoice.customer, stripe);
  if (!tenantId) return;

  await updateTenant(tenantId, { status: 'past_due' });
  log.warn('Payment failed', { tenantId, invoiceId: invoice.id });

  // TODO: Send email notification about failed payment
}

/**
 * Main webhook handler
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - Stripe-Signature header
 */
export async function handleWebhook(payload, signature) {
  let event;

  try {
    event = constructWebhookEvent(payload, signature);
  } catch (error) {
    log.error('Webhook signature verification failed', { error: error.message });
    throw error;
  }

  log.debug('Webhook received', { type: event.type, id: event.id });

  if (!HANDLED_EVENTS.includes(event.type)) {
    log.debug('Ignoring unhandled event type', { type: event.type });
    return { received: true, handled: false };
  }

  // Get Stripe client for customer lookups
  const { getStripeClient } = await import('./stripe.js');
  const stripe = getStripeClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, stripe);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event, stripe);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, stripe);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, stripe);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event, stripe);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event, stripe);
        break;
    }

    return { received: true, handled: true, eventType: event.type };
  } catch (error) {
    log.error('Webhook handler error', { type: event.type, error: error.message });
    throw error;
  }
}

export default {
  handleWebhook,
  HANDLED_EVENTS
};
