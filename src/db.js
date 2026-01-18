// src/db.js
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { getFirestore, isFirebaseEnabled, COLLECTIONS, PIPELINE_STATUS } from './firebase.js';

const DB_PATH = process.env.DB_PATH || CONFIG.database.defaultPath;
const log = logger.child('db');

// Firebase has a 1MB document size limit - we stay safely under
const MAX_DOCUMENT_SIZE = 900000; // 900KB to leave margin
const FIREBASE_TIMEOUT_MS = 5000; // 5 second timeout - Firebase should be fast

/**
 * Wrap a promise with a timeout
 */
function withTimeout(promise, ms, operation = 'Firebase operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Estimate JSON document size in bytes
 */
function estimateSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

/**
 * Timed Firebase write with logging for diagnostics
 */
async function timedFirebaseWrite(operation, label, docSize = null) {
  const start = Date.now();
  const sizeInfo = docSize ? ` (${Math.round(docSize/1024)}KB)` : '';
  log.debug(`Firebase: ${label}${sizeInfo}`);
  try {
    await withTimeout(operation, FIREBASE_TIMEOUT_MS, label);
    log.debug(`Firebase: ${label} done in ${Date.now() - start}ms`);
  } catch (err) {
    log.error(`Firebase: ${label} FAILED after ${Date.now() - start}ms`, { error: err.message });
    throw err;
  }
}

// ==================== LOCAL JSON STORAGE ====================

async function loadLocalDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    // Handle legacy array format (convert to new format)
    if (Array.isArray(parsed)) {
      log.info('Migrating legacy database format');
      return { leads: [], deployments: parsed };
    }

    // Ensure both arrays exist
    return {
      leads: parsed.leads || [],
      deployments: parsed.deployments || []
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      log.debug('Database file not found, starting fresh');
    } else {
      log.warn('Failed to load database', { error: error.message });
    }
    return { leads: [], deployments: [] };
  }
}

async function saveLocalDb(db) {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    log.error('Failed to save database', { error: error.message });
    throw error;
  }
}

// ==================== LEAD FUNCTIONS ====================

function generateLeadId() {
  return `lead_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function createLead(data) {
  const timestamp = new Date().toISOString();
  const leadId = generateLeadId();

  const lead = {
    id: leadId,
    ...data,
    status: data.status || PIPELINE_STATUS.DISCOVERED,
    statusHistory: [{
      status: data.status || PIPELINE_STATUS.DISCOVERED,
      timestamp
    }],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection(COLLECTIONS.LEADS).doc(leadId).set(lead);
    log.info('Lead created in Firebase', { leadId, businessName: lead.businessName });
  } else {
    const localDb = await loadLocalDb();
    localDb.leads = localDb.leads || [];
    localDb.leads.push(lead);
    await saveLocalDb(localDb);
    log.info('Lead created locally', { leadId, businessName: lead.businessName });
  }

  return lead;
}

export async function getLead(leadId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection(COLLECTIONS.LEADS).doc(leadId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return (localDb.leads || []).find(l => l.id === leadId) || null;
  }
}

export async function getLeadByUrl(url) {
  // Normalize URL for comparison (remove trailing slash, lowercase)
  const normalizeUrl = (u) => u?.toLowerCase().replace(/\/$/, '') || '';
  const normalizedSearch = normalizeUrl(url);

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    // Firebase doesn't support flexible string matching, so fetch and filter
    const snapshot = await db.collection(COLLECTIONS.LEADS).get();
    for (const doc of snapshot.docs) {
      if (normalizeUrl(doc.data().url) === normalizedSearch) {
        return { id: doc.id, ...doc.data() };
      }
    }
    return null;
  } else {
    const localDb = await loadLocalDb();
    return (localDb.leads || []).find(l => normalizeUrl(l.url) === normalizedSearch) || null;
  }
}

export async function getLeads(filters = {}) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    let query = db.collection(COLLECTIONS.LEADS);

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.industry) {
      query = query.where('industry', '==', filters.industry);
    }
    if (filters.country) {
      query = query.where('country', '==', filters.country);
    }

    query = query.orderBy('updatedAt', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const localDb = await loadLocalDb();
    let leads = localDb.leads || [];

    if (filters.status) {
      leads = leads.filter(l => l.status === filters.status);
    }
    if (filters.industry) {
      leads = leads.filter(l => l.industry === filters.industry);
    }
    if (filters.country) {
      leads = leads.filter(l => l.country === filters.country);
    }

    // Sort by updatedAt descending
    leads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (filters.limit) {
      leads = leads.slice(0, filters.limit);
    }

    return leads;
  }
}

export async function updateLead(leadId, updates) {
  const timestamp = new Date().toISOString();

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const leadRef = db.collection(COLLECTIONS.LEADS).doc(leadId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(leadRef);
      if (!doc.exists) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      const data = doc.data();
      const updateData = {
        ...updates,
        updatedAt: timestamp
      };

      // Add status to history if changed
      if (updates.status && updates.status !== data.status) {
        const statusHistory = data.statusHistory || [];
        statusHistory.push({
          status: updates.status,
          timestamp,
          ...(updates.statusMeta || {})
        });
        updateData.statusHistory = statusHistory;
      }

      transaction.update(leadRef, updateData);
    });

    log.debug('Lead updated in Firebase', { leadId, updates: Object.keys(updates) });
    return getLead(leadId);
  } else {
    const localDb = await loadLocalDb();
    const index = (localDb.leads || []).findIndex(l => l.id === leadId);

    if (index === -1) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const lead = localDb.leads[index];

    // Add status to history if changed
    if (updates.status && updates.status !== lead.status) {
      lead.statusHistory = lead.statusHistory || [];
      lead.statusHistory.push({
        status: updates.status,
        timestamp,
        ...(updates.statusMeta || {})
      });
    }

    localDb.leads[index] = {
      ...lead,
      ...updates,
      updatedAt: timestamp
    };

    await saveLocalDb(localDb);
    log.debug('Lead updated locally', { leadId, updates: Object.keys(updates) });
    return localDb.leads[index];
  }
}

export async function deleteLead(leadId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection(COLLECTIONS.LEADS).doc(leadId).delete();
    log.debug('Lead deleted from Firebase', { leadId });
  } else {
    const localDb = await loadLocalDb();
    localDb.leads = (localDb.leads || []).filter(l => l.id !== leadId);
    await saveLocalDb(localDb);
    log.debug('Lead deleted locally', { leadId });
  }
}

// ==================== DEPLOYMENT FUNCTIONS ====================

export async function saveDeployment(data) {
  const timestamp = new Date().toISOString();

  const deployment = {
    ...data,
    createdAt: timestamp,
    status: data.status || 'active'
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const deploymentId = data.siteId || `deploy_${Date.now()}`;
    await timedFirebaseWrite(
      db.collection(COLLECTIONS.DEPLOYMENTS).doc(deploymentId).set(deployment),
      `saveDeployment(${data.siteId})`
    );
  } else {
    const localDb = await loadLocalDb();
    localDb.deployments = localDb.deployments || [];
    localDb.deployments.push(deployment);
    await saveLocalDb(localDb);
    log.debug('Deployment saved locally', { siteId: data.siteId });
  }

  return deployment;
}

export async function getDeployment(siteId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection(COLLECTIONS.DEPLOYMENTS).doc(siteId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return (localDb.deployments || []).find(d => d.siteId === siteId) || null;
  }
}

export async function getDeployments(status = null) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    let query = db.collection(COLLECTIONS.DEPLOYMENTS);

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc');
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const localDb = await loadLocalDb();
    let deployments = localDb.deployments || [];

    if (status) {
      deployments = deployments.filter(d => d.status === status);
    }

    return deployments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

export async function updateDeployment(siteId, updates) {
  const timestamp = new Date().toISOString();

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection(COLLECTIONS.DEPLOYMENTS).doc(siteId).update({
      ...updates,
      updatedAt: timestamp
    });
    log.debug('Deployment updated in Firebase', { siteId, updates: Object.keys(updates) });
    return getDeployment(siteId);
  } else {
    const localDb = await loadLocalDb();
    const index = (localDb.deployments || []).findIndex(d => d.siteId === siteId);

    if (index === -1) {
      log.warn('Deployment not found for update', { siteId });
      throw new Error(`Deployment not found: ${siteId}`);
    }

    localDb.deployments[index] = {
      ...localDb.deployments[index],
      ...updates,
      updatedAt: timestamp
    };

    await saveLocalDb(localDb);
    log.debug('Deployment updated locally', { siteId, updates: Object.keys(updates) });
    return localDb.deployments[index];
  }
}

export async function deleteDeployment(siteId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection(COLLECTIONS.DEPLOYMENTS).doc(siteId).delete();
    log.debug('Deployment deleted from Firebase', { siteId });
  } else {
    const localDb = await loadLocalDb();
    const original = localDb.deployments?.length || 0;
    localDb.deployments = (localDb.deployments || []).filter(d => d.siteId !== siteId);

    if (localDb.deployments.length === original) {
      log.warn('Deployment not found for deletion', { siteId });
    } else {
      log.debug('Deployment deleted locally', { siteId });
    }

    await saveLocalDb(localDb);
  }
}

// ==================== PIPELINE ERROR TRACKING ====================

function generateErrorId() {
  return `error_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Log a pipeline error for tracking and debugging
 * @param {Object} errorData - Error information
 * @param {string} errorData.url - URL being processed
 * @param {string} errorData.error - Error message
 * @param {string} [errorData.stack] - Error stack trace
 * @param {string} [errorData.step] - Pipeline step that failed
 * @param {string} [errorData.leadId] - Associated lead ID
 */
export async function logPipelineError(errorData) {
  const timestamp = new Date().toISOString();
  const errorId = generateErrorId();

  const record = {
    id: errorId,
    url: errorData.url,
    error: errorData.error,
    stack: errorData.stack || null,
    step: errorData.step || 'unknown',
    leadId: errorData.leadId || null,
    createdAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('pipelineErrors').doc(errorId).set(record);
    log.debug('Pipeline error logged to Firebase', { errorId, url: errorData.url });
  } else {
    const localDb = await loadLocalDb();
    localDb.pipelineErrors = localDb.pipelineErrors || [];
    localDb.pipelineErrors.push(record);
    // Keep only last 100 errors to avoid bloat
    if (localDb.pipelineErrors.length > 100) {
      localDb.pipelineErrors = localDb.pipelineErrors.slice(-100);
    }
    await saveLocalDb(localDb);
    log.debug('Pipeline error logged locally', { errorId, url: errorData.url });
  }

  return record;
}

/**
 * Get recent pipeline errors
 * @param {number} [limit=20] - Maximum number of errors to return
 * @returns {Promise<Array>} - List of error records
 */
export async function getPipelineErrors(limit = 20) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('pipelineErrors')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const localDb = await loadLocalDb();
    const errors = localDb.pipelineErrors || [];
    return errors.slice(-limit).reverse();
  }
}

// ==================== EMAIL QUEUE FUNCTIONS ====================

function generateEmailId() {
  return `email_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create a draft email in the queue for approval
 */
export async function createEmailDraft(data) {
  const timestamp = new Date().toISOString();
  const emailId = generateEmailId();

  const draft = {
    id: emailId,
    leadId: data.leadId || null,
    deploymentId: data.deploymentId || null,
    type: data.type || 'initial', // 'initial', 'followup-1', 'followup-2', 'followup-3'
    to: data.to,
    subject: data.subject,
    textBody: data.textBody,
    htmlBody: data.htmlBody,
    businessName: data.businessName || null,
    status: 'draft', // 'draft', 'approved', 'rejected', 'sending', 'sent'
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('emailQueue').doc(emailId).set(draft);
    log.info('Email draft created in Firebase', { emailId, to: data.to });
  } else {
    const localDb = await loadLocalDb();
    localDb.emailQueue = localDb.emailQueue || [];
    localDb.emailQueue.push(draft);
    await saveLocalDb(localDb);
    log.info('Email draft created locally', { emailId, to: data.to });
  }

  return draft;
}

/**
 * Get email drafts from queue
 */
export async function getEmailQueue(filters = {}) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    let query = db.collection('emailQueue');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('createdAt', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const localDb = await loadLocalDb();
    let queue = localDb.emailQueue || [];

    if (filters.status) {
      queue = queue.filter(e => e.status === filters.status);
    }

    queue.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filters.limit) {
      queue = queue.slice(0, filters.limit);
    }

    return queue;
  }
}

/**
 * Get a single email draft by ID
 */
export async function getEmailDraft(emailId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection('emailQueue').doc(emailId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return (localDb.emailQueue || []).find(e => e.id === emailId) || null;
  }
}

/**
 * Approve an email for sending
 * @param {string} emailId - Email ID
 * @param {Object} context - User context with userId, email, name
 */
export async function approveEmail(emailId, context = {}) {
  const timestamp = new Date().toISOString();

  // Build audit trail info
  const auditInfo = {
    status: 'approved',
    approvedAt: timestamp,
    approvedBy: context.userId || null,
    approvedByEmail: context.email || null,
    approvedByName: context.name || null,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('emailQueue').doc(emailId).update(auditInfo);
    log.info('Email approved in Firebase', { emailId, approvedBy: context.userId });
    return getEmailDraft(emailId);
  } else {
    const localDb = await loadLocalDb();
    const index = (localDb.emailQueue || []).findIndex(e => e.id === emailId);

    if (index === -1) {
      throw new Error(`Email draft not found: ${emailId}`);
    }

    localDb.emailQueue[index] = {
      ...localDb.emailQueue[index],
      ...auditInfo
    };

    await saveLocalDb(localDb);
    log.info('Email approved locally', { emailId, approvedBy: context.userId });
    return localDb.emailQueue[index];
  }
}

/**
 * Reject an email
 * @param {string} emailId - Email ID
 * @param {string} reason - Rejection reason
 * @param {Object} context - User context with userId, email, name
 */
export async function rejectEmail(emailId, reason = null, context = {}) {
  const timestamp = new Date().toISOString();

  // Build audit trail info
  const auditInfo = {
    status: 'rejected',
    rejectedAt: timestamp,
    rejectedBy: context.userId || null,
    rejectedByEmail: context.email || null,
    rejectedByName: context.name || null,
    rejectionReason: reason,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('emailQueue').doc(emailId).update(auditInfo);
    log.info('Email rejected in Firebase', { emailId, reason, rejectedBy: context.userId });
    return getEmailDraft(emailId);
  } else {
    const localDb = await loadLocalDb();
    const index = (localDb.emailQueue || []).findIndex(e => e.id === emailId);

    if (index === -1) {
      throw new Error(`Email draft not found: ${emailId}`);
    }

    localDb.emailQueue[index] = {
      ...localDb.emailQueue[index],
      ...auditInfo
    };

    await saveLocalDb(localDb);
    log.info('Email rejected locally', { emailId, reason, rejectedBy: context.userId });
    return localDb.emailQueue[index];
  }
}

/**
 * Move email from queue to history after sending
 */
/**
 * Move email from queue to history after sending
 * @param {string} emailId - Email ID
 * @param {Object} sendResult - Send result with success, id, error
 * @param {Object} context - User context with userId, email, name
 */
export async function moveToHistory(emailId, sendResult, context = {}) {
  const timestamp = new Date().toISOString();
  const draft = await getEmailDraft(emailId);

  if (!draft) {
    throw new Error(`Email draft not found: ${emailId}`);
  }

  const historyRecord = {
    ...draft,
    status: sendResult.success ? 'sent' : 'failed',
    sentAt: timestamp,
    sentBy: context.userId || null,
    sentByEmail: context.email || null,
    sentByName: context.name || null,
    resendId: sendResult.id || null,
    error: sendResult.error || null,
    // Delivery tracking fields (populated by webhook)
    deliveryStatus: sendResult.success ? 'pending' : 'failed',
    deliveredAt: null,
    bouncedAt: null,
    complainedAt: null,
    openedAt: null,
    openCount: 0,
    clickedAt: null,
    clickCount: 0,
    clickedLinks: []
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    // Add to history
    await db.collection('emailHistory').doc(emailId).set(historyRecord);
    // Remove from queue
    await db.collection('emailQueue').doc(emailId).delete();
    log.info('Email moved to history in Firebase', {
      emailId,
      status: historyRecord.status,
      sentBy: context.userId
    });
  } else {
    const localDb = await loadLocalDb();
    // Add to history
    localDb.emailHistory = localDb.emailHistory || [];
    localDb.emailHistory.push(historyRecord);
    // Remove from queue
    localDb.emailQueue = (localDb.emailQueue || []).filter(e => e.id !== emailId);
    await saveLocalDb(localDb);
    log.info('Email moved to history locally', {
      emailId,
      status: historyRecord.status,
      sentBy: context.userId
    });
  }

  return historyRecord;
}

/**
 * Get email history
 */
export async function getEmailHistory(filters = {}) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    let query = db.collection('emailHistory');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('sentAt', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const localDb = await loadLocalDb();
    let history = localDb.emailHistory || [];

    if (filters.status) {
      history = history.filter(e => e.status === filters.status);
    }

    history.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    if (filters.limit) {
      history = history.slice(0, filters.limit);
    }

    return history;
  }
}

/**
 * Update an email in history (for webhook tracking updates)
 * @param {string} emailId - Email ID
 * @param {Object} updates - Fields to update
 */
export async function updateEmailHistory(emailId, updates) {
  const timestamp = new Date().toISOString();

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('emailHistory').doc(emailId).update({
      ...updates,
      updatedAt: timestamp
    });
    log.info('Email history updated in Firebase', { emailId, updates: Object.keys(updates) });

    const doc = await db.collection('emailHistory').doc(emailId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } else {
    const localDb = await loadLocalDb();
    localDb.emailHistory = localDb.emailHistory || [];

    const index = localDb.emailHistory.findIndex(e => e.id === emailId);
    if (index === -1) {
      throw new Error(`Email not found in history: ${emailId}`);
    }

    localDb.emailHistory[index] = {
      ...localDb.emailHistory[index],
      ...updates,
      updatedAt: timestamp
    };

    await saveLocalDb(localDb);
    log.info('Email history updated locally', { emailId, updates: Object.keys(updates) });

    return localDb.emailHistory[index];
  }
}

// ==================== EMAIL CONFIG FUNCTIONS ====================

/**
 * Get email configuration
 */
export async function getEmailConfig() {
  const defaults = {
    autoSendEnabled: CONFIG.email?.autoSendEnabled ?? false,
    requireApproval: CONFIG.email?.requireApproval ?? true
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection('config').doc('email').get();
    if (!doc.exists) return defaults;
    return { ...defaults, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return { ...defaults, ...(localDb.emailConfig || {}) };
  }
}

/**
 * Save email configuration
 */
export async function saveEmailConfig(config) {
  const timestamp = new Date().toISOString();

  const emailConfig = {
    autoSendEnabled: config.autoSendEnabled ?? false,
    requireApproval: config.requireApproval ?? true,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('config').doc('email').set(emailConfig, { merge: true });
    log.info('Email config saved to Firebase', emailConfig);
  } else {
    const localDb = await loadLocalDb();
    localDb.emailConfig = emailConfig;
    await saveLocalDb(localDb);
    log.info('Email config saved locally', emailConfig);
  }

  return emailConfig;
}

// ==================== FOLLOW-UP SEQUENCE FUNCTIONS ====================

// Default follow-up sequence (days after initial email)
const DEFAULT_FOLLOW_UP_SEQUENCE = [
  { day: 3, type: 'followup-1', subject: 'Re: {initialSubject}', template: 'followup1' },
  { day: 7, type: 'followup-2', subject: '{businessName} website', template: 'followup2' },
  { day: 12, type: 'followup-3', subject: 'Closing the loop', template: 'followup3' }
];

const DEFAULT_EXPIRE_DAYS = 14;

/**
 * Get follow-up sequence for a tenant (or default)
 * @param {string} tenantId - Tenant ID (optional, uses default if null)
 * @returns {Promise<Object>} Follow-up sequence configuration
 */
export async function getFollowUpSequence(tenantId = null) {
  const defaults = {
    steps: DEFAULT_FOLLOW_UP_SEQUENCE,
    expireDays: DEFAULT_EXPIRE_DAYS,
    enabled: true
  };

  if (!tenantId) {
    return defaults;
  }

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection('tenantSettings').doc(tenantId).get();
    if (!doc.exists) return defaults;
    const data = doc.data();
    return {
      steps: data.followUpSequence?.steps || defaults.steps,
      expireDays: data.followUpSequence?.expireDays ?? defaults.expireDays,
      enabled: data.followUpSequence?.enabled ?? defaults.enabled
    };
  } else {
    const localDb = await loadLocalDb();
    const settings = (localDb.tenantSettings || {})[tenantId];
    if (!settings?.followUpSequence) return defaults;
    return {
      steps: settings.followUpSequence.steps || defaults.steps,
      expireDays: settings.followUpSequence.expireDays ?? defaults.expireDays,
      enabled: settings.followUpSequence.enabled ?? defaults.enabled
    };
  }
}

/**
 * Set follow-up sequence for a tenant
 * @param {string} tenantId - Tenant ID
 * @param {Object} sequence - Sequence configuration
 * @param {Array} sequence.steps - Array of {day, type, subject, template}
 * @param {number} sequence.expireDays - Days until lead expires
 * @param {boolean} sequence.enabled - Whether sequence is enabled
 */
export async function setFollowUpSequence(tenantId, sequence) {
  const timestamp = new Date().toISOString();

  // Validate sequence steps
  if (sequence.steps) {
    for (const step of sequence.steps) {
      if (typeof step.day !== 'number' || step.day < 1) {
        throw new Error('Each step must have a positive day number');
      }
      if (!step.type || !step.subject) {
        throw new Error('Each step must have type and subject');
      }
    }
    // Sort by day
    sequence.steps.sort((a, b) => a.day - b.day);
  }

  const followUpSequence = {
    steps: sequence.steps || DEFAULT_FOLLOW_UP_SEQUENCE,
    expireDays: sequence.expireDays ?? DEFAULT_EXPIRE_DAYS,
    enabled: sequence.enabled ?? true,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('tenantSettings').doc(tenantId).set({
      followUpSequence
    }, { merge: true });
    log.info('Follow-up sequence saved to Firebase', { tenantId });
  } else {
    const localDb = await loadLocalDb();
    localDb.tenantSettings = localDb.tenantSettings || {};
    localDb.tenantSettings[tenantId] = localDb.tenantSettings[tenantId] || {};
    localDb.tenantSettings[tenantId].followUpSequence = followUpSequence;
    await saveLocalDb(localDb);
    log.info('Follow-up sequence saved locally', { tenantId });
  }

  return followUpSequence;
}

// ==================== STATS FUNCTIONS ====================

export async function getStats() {
  if (isFirebaseEnabled()) {
    const db = getFirestore();

    const [leadsSnapshot, deploymentsSnapshot] = await Promise.all([
      db.collection(COLLECTIONS.LEADS).get(),
      db.collection(COLLECTIONS.DEPLOYMENTS).get()
    ]);

    const leads = leadsSnapshot.docs.map(doc => doc.data());
    const deployments = deploymentsSnapshot.docs.map(doc => doc.data());

    return computeStats(leads, deployments);
  } else {
    const localDb = await loadLocalDb();
    return computeStats(localDb.leads || [], localDb.deployments || []);
  }
}

function computeStats(leads, deployments) {
  const byStatus = {};
  const byIndustry = {};

  leads.forEach(lead => {
    const status = lead.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    const industry = lead.industry || 'unknown';
    byIndustry[industry] = (byIndustry[industry] || 0) + 1;
  });

  const converted = byStatus[PIPELINE_STATUS.CONVERTED] || 0;
  const totalEligible = leads.length - (byStatus[PIPELINE_STATUS.DISQUALIFIED] || 0);

  return {
    totalLeads: leads.length,
    totalDeployments: deployments.length,
    byStatus,
    byIndustry,
    conversionRate: totalEligible > 0 ? ((converted / totalEligible) * 100).toFixed(1) : 0,
    activeDeployments: deployments.filter(d => d.status === 'active').length
  };
}

// ==================== BACKWARDS COMPATIBILITY ====================

// Keep old function names for backwards compatibility
export const loadDb = async () => {
  const localDb = await loadLocalDb();
  // Return deployments array for backwards compatibility
  return localDb.deployments || [];
};

export const saveDb = async (deployments) => {
  const localDb = await loadLocalDb();
  localDb.deployments = deployments;
  await saveLocalDb(localDb);
};

// ==================== PREVIEW FUNCTIONS ====================

function generatePreviewId() {
  return `preview_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create a new preview
 * @param {Object} data - Preview data
 * @param {string} data.slug - URL-friendly slug (unique)
 * @param {string} data.originalUrl - Original website URL
 * @param {string} data.businessName - Business name
 * @param {string} data.industry - Detected industry
 * @param {string} data.html - Full rendered HTML
 * @param {Object} data.siteData - Scraped site data (JSON)
 * @param {Object} data.slots - Template slots (JSON)
 * @param {string} data.status - Status (pending, generating, complete, failed)
 * @param {string} data.expiresAt - Expiration date ISO string
 */
export async function createPreview(data) {
  const timestamp = new Date().toISOString();
  const previewId = generatePreviewId();

  const preview = {
    id: previewId,
    slug: data.slug,
    originalUrl: data.originalUrl,
    businessName: data.businessName || 'Unknown',
    industry: data.industry || 'general',
    html: data.html,
    siteData: data.siteData || null,
    slots: data.slots || null,
    status: data.status || 'complete',
    validation: data.validation || null,  // Quality validation results
    expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    viewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();

    // Check document size - Firebase has 1MB limit
    let docToSave = preview;
    const size = estimateSize(preview);
    log.debug('Preview document size', { size, maxSize: MAX_DOCUMENT_SIZE });

    if (size > MAX_DOCUMENT_SIZE) {
      // Document too large - strip non-essential data (keep HTML for serving)
      log.warn('Preview document too large, stripping metadata', {
        originalSize: size,
        maxSize: MAX_DOCUMENT_SIZE
      });
      docToSave = {
        ...preview,
        siteData: null, // Strip scraped data (can be re-scraped if needed)
        slots: null     // Strip slots (embedded in HTML already)
      };
      const newSize = estimateSize(docToSave);
      log.debug('Reduced document size', { newSize });

      if (newSize > MAX_DOCUMENT_SIZE) {
        throw new Error(`Preview HTML too large for Firebase (${Math.round(newSize/1024)}KB > ${Math.round(MAX_DOCUMENT_SIZE/1024)}KB)`);
      }
    }

    // Save with timeout and logging
    await timedFirebaseWrite(
      db.collection('previews').doc(previewId).set(docToSave),
      `createPreview(${data.slug})`,
      size
    );
  } else {
    const localDb = await loadLocalDb();
    localDb.previews = localDb.previews || [];
    localDb.previews.push(preview);
    await saveLocalDb(localDb);
    log.info('Preview created locally', { previewId, slug: data.slug });
  }

  return preview;
}

/**
 * Get preview by slug
 * @param {string} slug - Preview slug
 */
export async function getPreviewBySlug(slug) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('previews')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return (localDb.previews || []).find(p => p.slug === slug) || null;
  }
}

/**
 * Get preview by ID
 * @param {string} previewId - Preview ID
 */
export async function getPreviewById(previewId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection('previews').doc(previewId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return (localDb.previews || []).find(p => p.id === previewId) || null;
  }
}

/**
 * Get all previews with optional filters
 * @param {Object} filters - Optional filters
 */
export async function getPreviews(filters = {}) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    let query = db.collection('previews');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('createdAt', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    const localDb = await loadLocalDb();
    let previews = localDb.previews || [];

    if (filters.status) {
      previews = previews.filter(p => p.status === filters.status);
    }

    previews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filters.limit) {
      previews = previews.slice(0, filters.limit);
    }

    return previews;
  }
}

/**
 * Update a preview
 * @param {string} slug - Preview slug
 * @param {Object} updates - Fields to update
 */
export async function updatePreview(slug, updates) {
  const timestamp = new Date().toISOString();

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('previews')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error(`Preview not found: ${slug}`);
    }

    const docRef = snapshot.docs[0].ref;
    await docRef.update({
      ...updates,
      updatedAt: timestamp
    });

    log.debug('Preview updated in Firebase', { slug });
    return getPreviewBySlug(slug);
  } else {
    const localDb = await loadLocalDb();
    const index = (localDb.previews || []).findIndex(p => p.slug === slug);

    if (index === -1) {
      throw new Error(`Preview not found: ${slug}`);
    }

    localDb.previews[index] = {
      ...localDb.previews[index],
      ...updates,
      updatedAt: timestamp
    };

    await saveLocalDb(localDb);
    log.debug('Preview updated locally', { slug });
    return localDb.previews[index];
  }
}

/**
 * Delete a preview
 * @param {string} slug - Preview slug
 */
export async function deletePreview(slug) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('previews')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
      log.debug('Preview deleted from Firebase', { slug });
    }
  } else {
    const localDb = await loadLocalDb();
    localDb.previews = (localDb.previews || []).filter(p => p.slug !== slug);
    await saveLocalDb(localDb);
    log.debug('Preview deleted locally', { slug });
  }
}

/**
 * Increment preview view count
 * @param {string} slug - Preview slug
 */
export async function incrementViewCount(slug) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('previews')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      const current = snapshot.docs[0].data().viewCount || 0;
      await docRef.update({ viewCount: current + 1 });
    }
  } else {
    const localDb = await loadLocalDb();
    const preview = (localDb.previews || []).find(p => p.slug === slug);
    if (preview) {
      preview.viewCount = (preview.viewCount || 0) + 1;
      await saveLocalDb(localDb);
    }
  }
}

/**
 * Clean up expired previews
 * @returns {number} Number of deleted previews
 */
export async function cleanupExpiredPreviews() {
  const now = new Date().toISOString();
  let deleted = 0;

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('previews')
      .where('expiresAt', '<', now)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleted++;
    });
    await batch.commit();
  } else {
    const localDb = await loadLocalDb();
    const originalLength = (localDb.previews || []).length;
    localDb.previews = (localDb.previews || []).filter(p =>
      !p.expiresAt || new Date(p.expiresAt) >= new Date(now)
    );
    deleted = originalLength - localDb.previews.length;
    await saveLocalDb(localDb);
  }

  if (deleted > 0) {
    log.info('Cleaned up expired previews', { deleted });
  }
  return deleted;
}

// ==================== ANALYTICS ====================

/**
 * Record an analytics event for a preview
 * @param {string} slug - Preview slug
 * @param {object} event - Event data
 */
export async function recordAnalyticsEvent(slug, event) {
  const timestamp = new Date().toISOString();
  const eventData = {
    slug,
    type: event.type, // 'pageview', 'scroll', 'click', 'form', 'time'
    data: event.data || {},
    timestamp,
    userAgent: event.userAgent || null,
    sessionId: event.sessionId || null
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('analytics').add(eventData);
  } else {
    const localDb = await loadLocalDb();
    if (!localDb.analytics) localDb.analytics = [];
    localDb.analytics.push(eventData);
    // Keep only last 10000 events to prevent unbounded growth
    if (localDb.analytics.length > 10000) {
      localDb.analytics = localDb.analytics.slice(-10000);
    }
    await saveLocalDb(localDb);
  }

  return eventData;
}

/**
 * Get analytics for a preview
 * @param {string} slug - Preview slug
 * @returns {object} Analytics summary
 */
export async function getPreviewAnalytics(slug) {
  let events = [];

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('analytics')
      .where('slug', '==', slug)
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();
    events = snapshot.docs.map(doc => doc.data());
  } else {
    const localDb = await loadLocalDb();
    events = (localDb.analytics || []).filter(e => e.slug === slug);
  }

  // Aggregate analytics
  const pageviews = events.filter(e => e.type === 'pageview').length;
  const uniqueSessions = new Set(events.map(e => e.sessionId).filter(Boolean)).size;

  // Scroll depth tracking
  const scrollEvents = events.filter(e => e.type === 'scroll');
  const scrollDepths = {
    '25': scrollEvents.filter(e => e.data?.depth >= 25).length,
    '50': scrollEvents.filter(e => e.data?.depth >= 50).length,
    '75': scrollEvents.filter(e => e.data?.depth >= 75).length,
    '100': scrollEvents.filter(e => e.data?.depth >= 100).length
  };

  // Click tracking
  const clickEvents = events.filter(e => e.type === 'click');
  const clicks = {
    cta: clickEvents.filter(e => e.data?.target === 'cta').length,
    phone: clickEvents.filter(e => e.data?.target === 'phone').length,
    email: clickEvents.filter(e => e.data?.target === 'email').length,
    navigation: clickEvents.filter(e => e.data?.target === 'nav').length
  };

  // Time on page
  const timeEvents = events.filter(e => e.type === 'time');
  const avgTimeOnPage = timeEvents.length > 0
    ? Math.round(timeEvents.reduce((sum, e) => sum + (e.data?.seconds || 0), 0) / timeEvents.length)
    : 0;

  // Form interactions
  const formEvents = events.filter(e => e.type === 'form');
  const formInteractions = {
    focused: formEvents.filter(e => e.data?.action === 'focus').length,
    submitted: formEvents.filter(e => e.data?.action === 'submit').length
  };

  return {
    slug,
    pageviews,
    uniqueSessions,
    scrollDepths,
    clicks,
    avgTimeOnPage,
    formInteractions,
    lastViewed: events[0]?.timestamp || null,
    eventCount: events.length
  };
}

export default {
  // Lead functions
  createLead,
  getLead,
  getLeadByUrl,
  getLeads,
  updateLead,
  deleteLead,
  // Deployment functions
  saveDeployment,
  getDeployment,
  getDeployments,
  updateDeployment,
  deleteDeployment,
  // Preview functions
  createPreview,
  getPreviewBySlug,
  getPreviewById,
  getPreviews,
  updatePreview,
  deletePreview,
  incrementViewCount,
  cleanupExpiredPreviews,
  // Error tracking
  logPipelineError,
  getPipelineErrors,
  // Email queue functions
  createEmailDraft,
  getEmailQueue,
  getEmailDraft,
  approveEmail,
  rejectEmail,
  moveToHistory,
  getEmailHistory,
  updateEmailHistory,
  // Email config
  getEmailConfig,
  saveEmailConfig,
  // Follow-up sequence
  getFollowUpSequence,
  setFollowUpSequence,
  // Stats
  getStats,
  // Analytics
  recordAnalyticsEvent,
  getPreviewAnalytics,
  // Backwards compatibility
  loadDb,
  saveDb
};
