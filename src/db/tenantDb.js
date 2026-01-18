// src/db/tenantDb.js
// Tenant-aware database operations wrapper
// Adds tenantId filtering to all database queries
import * as db from '../db.js';
import logger from '../logger.js';

const log = logger.child('tenantDb');

// Default tenant for backwards compatibility
const DEFAULT_TENANT = 'default';

/**
 * Get tenant ID from context, falling back to default
 */
export function getTenantId(context) {
  return context?.tenantId || DEFAULT_TENANT;
}

/**
 * Add tenant ID to data object
 */
function addTenantId(data, tenantId) {
  return {
    ...data,
    tenantId: tenantId || DEFAULT_TENANT
  };
}

// ==================== TENANT-AWARE LEAD FUNCTIONS ====================

/**
 * Create a lead with tenant ID
 */
export async function createLead(context, data) {
  const tenantId = getTenantId(context);
  return db.createLead(addTenantId(data, tenantId));
}

/**
 * Get a single lead (with tenant check)
 */
export async function getLead(context, leadId) {
  const lead = await db.getLead(leadId);

  // Allow access if no tenantId on record (backwards compat) or matches
  if (lead && lead.tenantId && lead.tenantId !== getTenantId(context)) {
    log.warn('Tenant mismatch on lead access', {
      requestedTenant: getTenantId(context),
      recordTenant: lead.tenantId,
      leadId
    });
    return null;
  }

  return lead;
}

/**
 * Get leads filtered by tenant
 */
export async function getLeads(context, filters = {}) {
  const tenantId = getTenantId(context);
  const allLeads = await db.getLeads(filters);

  // Filter by tenant (allow records without tenantId for backwards compat)
  return allLeads.filter(lead =>
    !lead.tenantId || lead.tenantId === tenantId
  );
}

/**
 * Update a lead (with tenant check)
 */
export async function updateLead(context, leadId, updates) {
  // First verify tenant access
  const lead = await getLead(context, leadId);
  if (!lead) {
    throw new Error(`Lead not found or access denied: ${leadId}`);
  }

  return db.updateLead(leadId, updates);
}

/**
 * Delete a lead (with tenant check)
 */
export async function deleteLead(context, leadId) {
  // First verify tenant access
  const lead = await getLead(context, leadId);
  if (!lead) {
    throw new Error(`Lead not found or access denied: ${leadId}`);
  }

  return db.deleteLead(leadId);
}

// ==================== TENANT-AWARE DEPLOYMENT FUNCTIONS ====================

/**
 * Save a deployment with tenant ID
 */
export async function saveDeployment(context, data) {
  const tenantId = getTenantId(context);
  return db.saveDeployment(addTenantId(data, tenantId));
}

/**
 * Get a single deployment (with tenant check)
 */
export async function getDeployment(context, siteId) {
  const deployment = await db.getDeployment(siteId);

  // Allow access if no tenantId on record (backwards compat) or matches
  if (deployment && deployment.tenantId && deployment.tenantId !== getTenantId(context)) {
    log.warn('Tenant mismatch on deployment access', {
      requestedTenant: getTenantId(context),
      recordTenant: deployment.tenantId,
      siteId
    });
    return null;
  }

  return deployment;
}

/**
 * Get all deployments filtered by tenant
 */
export async function getDeployments(context, filters = {}) {
  const tenantId = getTenantId(context);
  const allDeployments = await db.getDeployments(filters);

  // Filter by tenant (allow records without tenantId for backwards compat)
  return allDeployments.filter(d =>
    !d.tenantId || d.tenantId === tenantId
  );
}

/**
 * Update a deployment (with tenant check)
 */
export async function updateDeployment(context, siteId, updates) {
  // First verify tenant access
  const deployment = await getDeployment(context, siteId);
  if (!deployment) {
    throw new Error(`Deployment not found or access denied: ${siteId}`);
  }

  return db.updateDeployment(siteId, updates);
}

/**
 * Delete a deployment (with tenant check)
 */
export async function deleteDeployment(context, siteId) {
  // First verify tenant access
  const deployment = await getDeployment(context, siteId);
  if (!deployment) {
    throw new Error(`Deployment not found or access denied: ${siteId}`);
  }

  return db.deleteDeployment(siteId);
}

// ==================== TENANT-AWARE EMAIL FUNCTIONS ====================

/**
 * Queue an email with tenant ID
 */
export async function queueEmail(context, data) {
  const tenantId = getTenantId(context);
  return db.queueEmail(addTenantId(data, tenantId));
}

/**
 * Get email queue filtered by tenant
 */
export async function getEmailQueue(context, filters = {}) {
  const tenantId = getTenantId(context);
  const allEmails = await db.getEmailQueue(filters);

  return allEmails.filter(email =>
    !email.tenantId || email.tenantId === tenantId
  );
}

/**
 * Approve email (with tenant check)
 */
export async function approveEmail(context, emailId) {
  const queue = await getEmailQueue(context);
  const email = queue.find(e => e.id === emailId);
  if (!email) {
    throw new Error(`Email not found or access denied: ${emailId}`);
  }

  return db.approveEmail(emailId);
}

/**
 * Reject email (with tenant check)
 */
export async function rejectEmail(context, emailId, reason) {
  const queue = await getEmailQueue(context);
  const email = queue.find(e => e.id === emailId);
  if (!email) {
    throw new Error(`Email not found or access denied: ${emailId}`);
  }

  return db.rejectEmail(emailId, reason);
}

// ==================== TENANT-AWARE STATS ====================

/**
 * Get stats for a tenant
 */
export async function getStats(context) {
  const tenantId = getTenantId(context);

  // Get filtered data
  const deployments = await getDeployments(context);
  const leads = await getLeads(context);

  const stats = {
    totalLeads: leads.length,
    totalDeployments: deployments.length,
    byStatus: {},
    byIndustry: {},
    conversionRate: 0,
    activeDeployments: deployments.filter(d => d.status !== 'deleted' && d.status !== 'expired').length
  };

  // Count by status
  deployments.forEach(d => {
    const status = d.status || 'pending';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    const ind = d.industry || 'unknown';
    stats.byIndustry[ind] = (stats.byIndustry[ind] || 0) + 1;
  });

  // Calculate conversion rate
  const converted = stats.byStatus.converted || 0;
  stats.conversionRate = deployments.length > 0
    ? ((converted / deployments.length) * 100).toFixed(1)
    : 0;

  return stats;
}

// ==================== PREVIEW FUNCTIONS (public, no tenant filter) ====================
// Preview functions remain public since they're accessed by preview URLs

export const getPreviewBySlug = db.getPreviewBySlug;
export const createPreview = db.createPreview;
export const trackPreviewEvent = db.trackPreviewEvent;
export const getPreviewAnalytics = db.getPreviewAnalytics;

// ==================== RE-EXPORT UNCHANGED FUNCTIONS ====================

export const getEmailConfig = db.getEmailConfig;
export const saveEmailConfig = db.saveEmailConfig;
export const getPipelineErrors = db.getPipelineErrors;
export const logPipelineError = db.logPipelineError;

export default {
  // Tenant-aware functions
  createLead,
  getLead,
  getLeads,
  updateLead,
  deleteLead,
  saveDeployment,
  getDeployment,
  getDeployments,
  updateDeployment,
  deleteDeployment,
  queueEmail,
  getEmailQueue,
  approveEmail,
  rejectEmail,
  getStats,

  // Public functions (no tenant filter)
  getPreviewBySlug,
  createPreview,
  trackPreviewEvent,
  getPreviewAnalytics,
  getEmailConfig,
  saveEmailConfig,
  getPipelineErrors,
  logPipelineError,

  // Helper
  getTenantId
};
