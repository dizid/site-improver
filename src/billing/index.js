// src/billing/index.js
// Billing module exports
export {
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
} from './stripe.js';

export {
  METRICS,
  getUsage,
  incrementUsage,
  checkQuota,
  enforceQuota,
  getUsageSummary,
  calculateOverages,
  resetUsage,
  // Spending caps
  setSpendingCap,
  getSpendingCap,
  checkSpendingCap,
  enforceSpendingCap,
  // Alerts
  checkSpendingAlerts,
  getPendingAlerts,
  clearAlerts,
  // Combined
  incrementUsageWithCapCheck,
  getSpendingSummary
} from './usage.js';

export {
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
} from './subscriptions.js';

export { handleWebhook } from './webhooks.js';
