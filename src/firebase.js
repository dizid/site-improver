// src/firebase.js
import admin from 'firebase-admin';
import logger from './logger.js';

const log = logger.child('firebase');

let db = null;
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Falls back gracefully if credentials not configured
 */
export function initFirebase() {
  if (initialized) return db;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    log.warn('Firebase credentials not configured - using local JSON storage');
    initialized = true;
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });

    db = admin.firestore();
    initialized = true;
    log.info('Firebase initialized successfully', { projectId });
    return db;
  } catch (error) {
    log.error('Failed to initialize Firebase', { error: error.message });
    initialized = true;
    return null;
  }
}

/**
 * Get Firestore instance
 */
export function getFirestore() {
  if (!initialized) {
    initFirebase();
  }
  return db;
}

/**
 * Check if Firebase is available
 */
export function isFirebaseEnabled() {
  if (!initialized) {
    initFirebase();
  }
  return db !== null;
}

// Collection references
export const COLLECTIONS = {
  LEADS: 'leads',
  DEPLOYMENTS: 'deployments',
  QUEUE: 'queue',
  EMAIL_LOGS: 'emailLogs'
};

// Pipeline status enum
export const PIPELINE_STATUS = {
  // Discovery phase
  DISCOVERED: 'discovered',
  SCORING: 'scoring',
  QUALIFIED: 'qualified',
  DISQUALIFIED: 'disqualified',

  // Processing phase
  QUEUED: 'queued',
  SCRAPING: 'scraping',
  SCRAPED: 'scraped',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  DEPLOYED: 'deployed',

  // Outreach phase
  EMAILING: 'emailing',
  FOLLOW_UP_1: 'follow_up_1',
  FOLLOW_UP_2: 'follow_up_2',
  LAST_CHANCE: 'last_chance',

  // Final states
  CONVERTED: 'converted',
  EXPIRED: 'expired',
  DELETED: 'deleted',
  ERROR: 'error'
};

// Status display info
export const STATUS_INFO = {
  [PIPELINE_STATUS.DISCOVERED]: { label: 'Discovered', color: 'blue', stage: 1 },
  [PIPELINE_STATUS.SCORING]: { label: 'Scoring', color: 'blue', stage: 1 },
  [PIPELINE_STATUS.QUALIFIED]: { label: 'Qualified', color: 'blue', stage: 1 },
  [PIPELINE_STATUS.DISQUALIFIED]: { label: 'Disqualified', color: 'gray', stage: 1 },
  [PIPELINE_STATUS.QUEUED]: { label: 'Queued', color: 'yellow', stage: 2 },
  [PIPELINE_STATUS.SCRAPING]: { label: 'Scraping', color: 'yellow', stage: 2 },
  [PIPELINE_STATUS.SCRAPED]: { label: 'Scraped', color: 'yellow', stage: 2 },
  [PIPELINE_STATUS.BUILDING]: { label: 'Building', color: 'yellow', stage: 3 },
  [PIPELINE_STATUS.DEPLOYING]: { label: 'Deploying', color: 'yellow', stage: 3 },
  [PIPELINE_STATUS.DEPLOYED]: { label: 'Deployed', color: 'green', stage: 4 },
  [PIPELINE_STATUS.EMAILING]: { label: 'Emailing', color: 'green', stage: 5 },
  [PIPELINE_STATUS.FOLLOW_UP_1]: { label: 'Follow-up 1', color: 'green', stage: 5 },
  [PIPELINE_STATUS.FOLLOW_UP_2]: { label: 'Follow-up 2', color: 'green', stage: 5 },
  [PIPELINE_STATUS.LAST_CHANCE]: { label: 'Last Chance', color: 'orange', stage: 6 },
  [PIPELINE_STATUS.CONVERTED]: { label: 'Converted', color: 'purple', stage: 7 },
  [PIPELINE_STATUS.EXPIRED]: { label: 'Expired', color: 'red', stage: 7 },
  [PIPELINE_STATUS.DELETED]: { label: 'Deleted', color: 'gray', stage: 7 },
  [PIPELINE_STATUS.ERROR]: { label: 'Error', color: 'red', stage: 0 }
};

// Total pipeline stages for progress calculation
export const TOTAL_STAGES = 7;

export default {
  initFirebase,
  getFirestore,
  isFirebaseEnabled,
  COLLECTIONS,
  PIPELINE_STATUS,
  STATUS_INFO,
  TOTAL_STAGES
};
