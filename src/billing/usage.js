// src/billing/usage.js
// Usage tracking and quota enforcement
import logger from '../logger.js';
import { getPlanLimits, OVERAGE_RATES } from './stripe.js';

const log = logger.child('usage');

// Usage metric types
export const METRICS = {
  PIPELINE_RUNS: 'pipeline_runs',
  EMAILS_SENT: 'emails_sent',
  LEADS_DISCOVERED: 'leads_discovered'
};

// Default spending cap in cents ($100 = 10000 cents)
const DEFAULT_SPENDING_CAP_CENTS = 10000;

// Alert thresholds (percentages)
const ALERT_THRESHOLDS = [50, 80, 95];

// In-memory usage cache (will be replaced with db in production)
const usageCache = new Map();

// Spending caps per tenant (in-memory, replace with db)
const spendingCaps = new Map();

// Track which alerts have been sent
const alertsSent = new Map();

/**
 * Get the current billing period key (YYYY-MM format)
 */
function getBillingPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get usage key for tenant and period
 */
function getUsageKey(tenantId, period = null) {
  const periodKey = period || getBillingPeriodKey();
  return `${tenantId}:${periodKey}`;
}

/**
 * Initialize usage for a tenant if not exists
 */
function initUsage(tenantId) {
  const key = getUsageKey(tenantId);
  if (!usageCache.has(key)) {
    usageCache.set(key, {
      tenantId,
      period: getBillingPeriodKey(),
      [METRICS.PIPELINE_RUNS]: 0,
      [METRICS.EMAILS_SENT]: 0,
      [METRICS.LEADS_DISCOVERED]: 0,
      updatedAt: new Date().toISOString()
    });
  }
  return usageCache.get(key);
}

/**
 * Get current usage for a tenant
 * @param {string} tenantId
 * @returns {Object} Usage data
 */
export async function getUsage(tenantId) {
  // In production, this would query the database
  // For now, use in-memory cache
  return initUsage(tenantId);
}

/**
 * Increment a usage metric
 * @param {string} tenantId
 * @param {string} metric - One of METRICS
 * @param {number} amount - Amount to increment (default 1)
 * @returns {Object} Updated usage
 */
export async function incrementUsage(tenantId, metric, amount = 1) {
  const usage = initUsage(tenantId);

  if (!Object.values(METRICS).includes(metric)) {
    throw new Error(`Invalid metric: ${metric}`);
  }

  usage[metric] = (usage[metric] || 0) + amount;
  usage.updatedAt = new Date().toISOString();

  log.debug('Usage incremented', {
    tenantId,
    metric,
    amount,
    newTotal: usage[metric]
  });

  return usage;
}

/**
 * Check if tenant has quota remaining for a metric
 * @param {string} tenantId
 * @param {string} metric
 * @param {string} planId - Tenant's current plan
 * @returns {Object} { allowed: boolean, remaining: number, limit: number, current: number }
 */
export async function checkQuota(tenantId, metric, planId = 'starter') {
  const usage = await getUsage(tenantId);
  const limits = getPlanLimits(planId);

  const metricToLimit = {
    [METRICS.PIPELINE_RUNS]: 'pipelineRuns',
    [METRICS.EMAILS_SENT]: 'emails',
    [METRICS.LEADS_DISCOVERED]: 'leads'
  };

  const limitKey = metricToLimit[metric];
  const limit = limits[limitKey];
  const current = usage[metric] || 0;

  // -1 means unlimited
  if (limit === -1) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      current,
      unlimited: true
    };
  }

  const remaining = Math.max(0, limit - current);
  const allowed = remaining > 0;

  return {
    allowed,
    remaining,
    limit,
    current,
    unlimited: false
  };
}

/**
 * Enforce quota - throws error if quota exceeded
 * @param {string} tenantId
 * @param {string} metric
 * @param {string} planId
 */
export async function enforceQuota(tenantId, metric, planId = 'starter') {
  const quota = await checkQuota(tenantId, metric, planId);

  if (!quota.allowed) {
    const metricNames = {
      [METRICS.PIPELINE_RUNS]: 'pipeline runs',
      [METRICS.EMAILS_SENT]: 'emails',
      [METRICS.LEADS_DISCOVERED]: 'lead discoveries'
    };

    const error = new Error(
      `Quota exceeded for ${metricNames[metric]}. ` +
      `You've used ${quota.current} of ${quota.limit} this month. ` +
      `Upgrade your plan for more.`
    );
    error.code = 'QUOTA_EXCEEDED';
    error.quota = quota;
    throw error;
  }

  return quota;
}

/**
 * Get usage summary for tenant
 * @param {string} tenantId
 * @param {string} planId
 */
export async function getUsageSummary(tenantId, planId = 'starter') {
  const usage = await getUsage(tenantId);
  const limits = getPlanLimits(planId);

  return {
    period: usage.period,
    metrics: {
      pipelineRuns: {
        used: usage[METRICS.PIPELINE_RUNS] || 0,
        limit: limits.pipelineRuns,
        unlimited: limits.pipelineRuns === -1
      },
      emails: {
        used: usage[METRICS.EMAILS_SENT] || 0,
        limit: limits.emails,
        unlimited: limits.emails === -1
      },
      leads: {
        used: usage[METRICS.LEADS_DISCOVERED] || 0,
        limit: limits.leads,
        unlimited: limits.leads === -1
      }
    },
    updatedAt: usage.updatedAt
  };
}

/**
 * Calculate overage charges
 * @param {string} tenantId
 * @param {string} planId
 */
export async function calculateOverages(tenantId, planId = 'starter') {
  const usage = await getUsage(tenantId);
  const limits = getPlanLimits(planId);

  const overages = {
    pipelineRuns: 0,
    emails: 0,
    leads: 0,
    totalCents: 0
  };

  // Pipeline runs overage
  if (limits.pipelineRuns !== -1) {
    const over = Math.max(0, (usage[METRICS.PIPELINE_RUNS] || 0) - limits.pipelineRuns);
    overages.pipelineRuns = over;
    overages.totalCents += over * OVERAGE_RATES.pipelineRun;
  }

  // Emails overage
  if (limits.emails !== -1) {
    const over = Math.max(0, (usage[METRICS.EMAILS_SENT] || 0) - limits.emails);
    overages.emails = over;
    overages.totalCents += over * OVERAGE_RATES.email;
  }

  // Leads overage
  if (limits.leads !== -1) {
    const over = Math.max(0, (usage[METRICS.LEADS_DISCOVERED] || 0) - limits.leads);
    overages.leads = over;
    overages.totalCents += over * OVERAGE_RATES.lead;
  }

  return overages;
}

/**
 * Reset usage for a new billing period
 * Called by webhook when subscription renews
 */
export async function resetUsage(tenantId) {
  const key = getUsageKey(tenantId);
  usageCache.delete(key);
  log.info('Usage reset for new billing period', { tenantId });
  return initUsage(tenantId);
}

/**
 * Get usage history (placeholder - would query db in production)
 */
export async function getUsageHistory(tenantId, months = 6) {
  // In production, query database for historical usage
  return [];
}

// ==================== SPENDING CAPS ====================

/**
 * Set spending cap for a tenant
 * @param {string} tenantId
 * @param {number} capCents - Maximum spending in cents (e.g., 10000 = $100)
 */
export async function setSpendingCap(tenantId, capCents) {
  spendingCaps.set(tenantId, capCents);
  log.info('Spending cap set', { tenantId, capCents, capDollars: capCents / 100 });
  return { tenantId, capCents };
}

/**
 * Get spending cap for a tenant
 * @param {string} tenantId
 * @returns {number} Cap in cents
 */
export async function getSpendingCap(tenantId) {
  return spendingCaps.get(tenantId) || DEFAULT_SPENDING_CAP_CENTS;
}

/**
 * Check current spending against cap
 * @param {string} tenantId
 * @param {string} planId
 * @returns {Object} Spending status
 */
export async function checkSpendingCap(tenantId, planId = 'starter') {
  const overages = await calculateOverages(tenantId, planId);
  const cap = await getSpendingCap(tenantId);
  const currentSpending = overages.totalCents;
  const percentUsed = cap > 0 ? (currentSpending / cap) * 100 : 0;

  return {
    currentSpendingCents: currentSpending,
    currentSpendingDollars: currentSpending / 100,
    capCents: cap,
    capDollars: cap / 100,
    percentUsed: Math.round(percentUsed * 100) / 100,
    remaining: Math.max(0, cap - currentSpending),
    exceeded: currentSpending >= cap
  };
}

/**
 * Enforce spending cap - throws error if cap exceeded
 * @param {string} tenantId
 * @param {string} planId
 */
export async function enforceSpendingCap(tenantId, planId = 'starter') {
  const status = await checkSpendingCap(tenantId, planId);

  if (status.exceeded) {
    const error = new Error(
      `Spending cap exceeded. You've spent $${status.currentSpendingDollars.toFixed(2)} ` +
      `of your $${status.capDollars.toFixed(2)} monthly cap. ` +
      `Increase your cap or wait for the next billing period.`
    );
    error.code = 'SPENDING_CAP_EXCEEDED';
    error.spendingStatus = status;
    throw error;
  }

  return status;
}

// ==================== SPENDING ALERTS ====================

/**
 * Get alert key for tracking sent alerts
 */
function getAlertKey(tenantId, threshold) {
  const period = getBillingPeriodKey();
  return `${tenantId}:${period}:${threshold}`;
}

/**
 * Check and generate spending alerts
 * @param {string} tenantId
 * @param {string} planId
 * @returns {Array} Array of triggered alerts
 */
export async function checkSpendingAlerts(tenantId, planId = 'starter') {
  const status = await checkSpendingCap(tenantId, planId);
  const alerts = [];

  for (const threshold of ALERT_THRESHOLDS) {
    const alertKey = getAlertKey(tenantId, threshold);

    if (status.percentUsed >= threshold && !alertsSent.has(alertKey)) {
      const alert = {
        tenantId,
        threshold,
        percentUsed: status.percentUsed,
        currentSpending: status.currentSpendingDollars,
        cap: status.capDollars,
        remaining: status.remaining / 100,
        severity: threshold >= 95 ? 'critical' : threshold >= 80 ? 'warning' : 'info',
        message: `Spending alert: You've used ${status.percentUsed.toFixed(1)}% of your $${status.capDollars.toFixed(2)} monthly cap.`,
        createdAt: new Date().toISOString()
      };

      alerts.push(alert);
      alertsSent.set(alertKey, true);

      log.warn('Spending alert triggered', alert);
    }
  }

  return alerts;
}

/**
 * Get all pending alerts for a tenant (not yet acknowledged)
 * @param {string} tenantId
 */
export async function getPendingAlerts(tenantId) {
  const period = getBillingPeriodKey();
  const pending = [];

  for (const threshold of ALERT_THRESHOLDS) {
    const alertKey = getAlertKey(tenantId, threshold);
    if (alertsSent.has(alertKey)) {
      pending.push({
        threshold,
        alertKey,
        period
      });
    }
  }

  return pending;
}

/**
 * Clear alerts for new billing period
 * @param {string} tenantId
 */
export async function clearAlerts(tenantId) {
  const period = getBillingPeriodKey();
  for (const threshold of ALERT_THRESHOLDS) {
    alertsSent.delete(`${tenantId}:${period}:${threshold}`);
  }
  log.info('Alerts cleared', { tenantId });
}

/**
 * Enhanced increment that checks spending cap and generates alerts
 * @param {string} tenantId
 * @param {string} metric
 * @param {string} planId
 * @param {number} amount
 */
export async function incrementUsageWithCapCheck(tenantId, metric, planId = 'starter', amount = 1) {
  // First check if spending cap would be exceeded
  await enforceSpendingCap(tenantId, planId);

  // Increment usage
  const usage = await incrementUsage(tenantId, metric, amount);

  // Check and generate any alerts
  const alerts = await checkSpendingAlerts(tenantId, planId);

  return { usage, alerts };
}

/**
 * Get spending summary for dashboard
 * @param {string} tenantId
 * @param {string} planId
 */
export async function getSpendingSummary(tenantId, planId = 'starter') {
  const usageSummary = await getUsageSummary(tenantId, planId);
  const overages = await calculateOverages(tenantId, planId);
  const spendingStatus = await checkSpendingCap(tenantId, planId);
  const pendingAlerts = await getPendingAlerts(tenantId);

  return {
    usage: usageSummary,
    overages: {
      pipelineRuns: overages.pipelineRuns,
      emails: overages.emails,
      leads: overages.leads,
      totalCents: overages.totalCents,
      totalDollars: overages.totalCents / 100
    },
    spending: spendingStatus,
    alerts: pendingAlerts,
    thresholds: ALERT_THRESHOLDS
  };
}

export default {
  METRICS,
  getUsage,
  incrementUsage,
  checkQuota,
  enforceQuota,
  getUsageSummary,
  calculateOverages,
  resetUsage,
  getUsageHistory,
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
};
