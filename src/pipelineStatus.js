// src/pipelineStatus.js
import { getFirestore, isFirebaseEnabled, COLLECTIONS, PIPELINE_STATUS, STATUS_INFO } from './firebase.js';
import logger from './logger.js';

const log = logger.child('pipelineStatus');

/**
 * Pipeline Status Manager
 * Handles status transitions and history tracking for leads
 */
export class PipelineStatusManager {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Update lead status with history tracking
   */
  async updateStatus(leadId, newStatus, metadata = {}) {
    const timestamp = new Date().toISOString();
    const statusEntry = {
      status: newStatus,
      timestamp,
      ...metadata
    };

    if (isFirebaseEnabled()) {
      const db = getFirestore();
      const leadRef = db.collection(COLLECTIONS.LEADS).doc(leadId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(leadRef);

        if (!doc.exists) {
          throw new Error(`Lead ${leadId} not found`);
        }

        const data = doc.data();
        const statusHistory = data.statusHistory || [];
        statusHistory.push(statusEntry);

        transaction.update(leadRef, {
          status: newStatus,
          statusHistory,
          updatedAt: timestamp,
          ...(metadata.error && { lastError: metadata.error })
        });
      });

      log.info(`Status updated: ${leadId} -> ${newStatus}`, metadata);
    }

    // Emit event for real-time updates
    this.emit('statusChange', { leadId, status: newStatus, timestamp, metadata });

    return statusEntry;
  }

  /**
   * Get current status of a lead
   */
  async getStatus(leadId) {
    if (!isFirebaseEnabled()) {
      return null;
    }

    const db = getFirestore();
    const doc = await db.collection(COLLECTIONS.LEADS).doc(leadId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data().status;
  }

  /**
   * Get status history for a lead
   */
  async getStatusHistory(leadId) {
    if (!isFirebaseEnabled()) {
      return [];
    }

    const db = getFirestore();
    const doc = await db.collection(COLLECTIONS.LEADS).doc(leadId).get();

    if (!doc.exists) {
      return [];
    }

    return doc.data().statusHistory || [];
  }

  /**
   * Get all leads with their pipeline status
   */
  async getAllLeadsWithStatus(filters = {}) {
    if (!isFirebaseEnabled()) {
      return [];
    }

    const db = getFirestore();
    let query = db.collection(COLLECTIONS.LEADS);

    // Apply filters
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.industry) {
      query = query.where('industry', '==', filters.industry);
    }
    if (filters.country) {
      query = query.where('country', '==', filters.country);
    }

    // Order by most recently updated
    query = query.orderBy('updatedAt', 'desc');

    // Limit results
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStats() {
    if (!isFirebaseEnabled()) {
      return this.getEmptyStats();
    }

    const db = getFirestore();
    const snapshot = await db.collection(COLLECTIONS.LEADS).get();

    const stats = {
      total: 0,
      byStatus: {},
      byStage: {
        discovery: 0,
        processing: 0,
        deployed: 0,
        outreach: 0,
        conversion: 0,
        final: 0
      },
      conversionRate: 0,
      averageTimeToConvert: 0
    };

    const convertedTimes = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      stats.total++;

      // Count by status
      const status = data.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Count by stage
      const statusInfo = STATUS_INFO[status];
      if (statusInfo) {
        if (statusInfo.stage === 1) stats.byStage.discovery++;
        else if (statusInfo.stage <= 3) stats.byStage.processing++;
        else if (statusInfo.stage === 4) stats.byStage.deployed++;
        else if (statusInfo.stage <= 6) stats.byStage.outreach++;
        else stats.byStage.final++;
      }

      // Track conversion times
      if (status === PIPELINE_STATUS.CONVERTED && data.statusHistory) {
        const firstStatus = data.statusHistory[0];
        const lastStatus = data.statusHistory[data.statusHistory.length - 1];
        if (firstStatus && lastStatus) {
          const timeToConvert = new Date(lastStatus.timestamp) - new Date(firstStatus.timestamp);
          convertedTimes.push(timeToConvert);
        }
      }
    });

    // Calculate conversion rate
    const converted = stats.byStatus[PIPELINE_STATUS.CONVERTED] || 0;
    const total = stats.total - (stats.byStatus[PIPELINE_STATUS.DISQUALIFIED] || 0);
    stats.conversionRate = total > 0 ? (converted / total * 100).toFixed(1) : 0;

    // Calculate average time to convert (in days)
    if (convertedTimes.length > 0) {
      const avgMs = convertedTimes.reduce((a, b) => a + b, 0) / convertedTimes.length;
      stats.averageTimeToConvert = (avgMs / (1000 * 60 * 60 * 24)).toFixed(1);
    }

    return stats;
  }

  /**
   * Get empty stats structure (for when Firebase is not enabled)
   */
  getEmptyStats() {
    return {
      total: 0,
      byStatus: {},
      byStage: {
        discovery: 0,
        processing: 0,
        deployed: 0,
        outreach: 0,
        conversion: 0,
        final: 0
      },
      conversionRate: 0,
      averageTimeToConvert: 0
    };
  }

  /**
   * Get leads that need follow-up emails
   */
  async getLeadsForFollowUp() {
    if (!isFirebaseEnabled()) {
      return [];
    }

    const db = getFirestore();
    const now = new Date();

    // Email timing in days
    const timing = {
      [PIPELINE_STATUS.DEPLOYED]: 0,      // Initial email immediately
      [PIPELINE_STATUS.EMAILING]: 2,      // Follow-up 1 after 2 days
      [PIPELINE_STATUS.FOLLOW_UP_1]: 2,   // Follow-up 2 after 2 more days
      [PIPELINE_STATUS.FOLLOW_UP_2]: 2    // Last chance after 2 more days
    };

    const leadsToFollowUp = [];

    for (const [status, daysToWait] of Object.entries(timing)) {
      const cutoff = new Date(now - daysToWait * 24 * 60 * 60 * 1000);

      const snapshot = await db.collection(COLLECTIONS.LEADS)
        .where('status', '==', status)
        .where('updatedAt', '<=', cutoff.toISOString())
        .get();

      snapshot.forEach(doc => {
        leadsToFollowUp.push({
          id: doc.id,
          ...doc.data(),
          nextAction: this.getNextEmailAction(status)
        });
      });
    }

    return leadsToFollowUp;
  }

  /**
   * Get next email action for a status
   */
  getNextEmailAction(currentStatus) {
    const transitions = {
      [PIPELINE_STATUS.DEPLOYED]: { nextStatus: PIPELINE_STATUS.EMAILING, template: 'initial' },
      [PIPELINE_STATUS.EMAILING]: { nextStatus: PIPELINE_STATUS.FOLLOW_UP_1, template: 'followUp1' },
      [PIPELINE_STATUS.FOLLOW_UP_1]: { nextStatus: PIPELINE_STATUS.FOLLOW_UP_2, template: 'followUp2' },
      [PIPELINE_STATUS.FOLLOW_UP_2]: { nextStatus: PIPELINE_STATUS.LAST_CHANCE, template: 'lastChance' }
    };
    return transitions[currentStatus] || null;
  }

  /**
   * Get leads that should be expired
   */
  async getLeadsToExpire() {
    if (!isFirebaseEnabled()) {
      return [];
    }

    const db = getFirestore();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const snapshot = await db.collection(COLLECTIONS.LEADS)
      .where('status', '==', PIPELINE_STATUS.LAST_CHANCE)
      .where('updatedAt', '<=', cutoff.toISOString())
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Event emitter methods
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          log.error('Event listener error', { event, error: error.message });
        }
      });
    }
  }
}

// Singleton instance
export const pipelineStatus = new PipelineStatusManager();

export default pipelineStatus;
