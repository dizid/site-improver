// src/db.js
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { getFirestore, isFirebaseEnabled, COLLECTIONS, PIPELINE_STATUS } from './firebase.js';

const DB_PATH = process.env.DB_PATH || CONFIG.database.defaultPath;
const log = logger.child('db');

// ==================== LOCAL JSON STORAGE ====================

async function loadLocalDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
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
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTIONS.LEADS)
      .where('url', '==', url)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } else {
    const localDb = await loadLocalDb();
    return (localDb.leads || []).find(l => l.url === url) || null;
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
    await db.collection(COLLECTIONS.DEPLOYMENTS).doc(deploymentId).set(deployment);
    log.debug('Deployment saved to Firebase', { siteId: data.siteId });
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
  // Error tracking
  logPipelineError,
  getPipelineErrors,
  // Stats
  getStats,
  // Backwards compatibility
  loadDb,
  saveDb
};
