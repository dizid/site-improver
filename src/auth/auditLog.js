// src/auth/auditLog.js
// Audit logging for security-sensitive operations
import logger from '../logger.js';
import { getUserContext } from './middleware.js';

const log = logger.child('audit');

/**
 * Audit log entry structure
 */
const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  LOGIN_FAILED: 'auth.login_failed',

  // Lead operations
  LEAD_CREATE: 'lead.create',
  LEAD_UPDATE: 'lead.update',
  LEAD_DELETE: 'lead.delete',
  LEAD_EXPORT: 'lead.export',

  // Deployment operations
  DEPLOYMENT_CREATE: 'deployment.create',
  DEPLOYMENT_UPDATE: 'deployment.update',
  DEPLOYMENT_DELETE: 'deployment.delete',
  DEPLOYMENT_CONVERT: 'deployment.convert',

  // Email operations
  EMAIL_QUEUE: 'email.queue',
  EMAIL_APPROVE: 'email.approve',
  EMAIL_REJECT: 'email.reject',
  EMAIL_SEND: 'email.send',

  // Pipeline operations
  PIPELINE_START: 'pipeline.start',
  PIPELINE_COMPLETE: 'pipeline.complete',
  PIPELINE_FAIL: 'pipeline.fail',

  // Discovery operations
  DISCOVERY_START: 'discovery.start',
  DISCOVERY_COMPLETE: 'discovery.complete',

  // Admin operations
  CONFIG_UPDATE: 'config.update',
  USER_INVITE: 'user.invite',
  USER_REMOVE: 'user.remove',
  ROLE_CHANGE: 'role.change',

  // Team management
  TEAM_INVITE: 'team.invite',
  TEAM_INVITE_REVOKE: 'team.invite_revoke',
  TEAM_MEMBER_REMOVE: 'team.member_remove',
  TEAM_ROLE_CHANGE: 'team.role_change',

  // Data operations
  DATA_EXPORT: 'data.export',
  DATA_IMPORT: 'data.import',
  DATA_DELETE: 'data.bulk_delete'
};

// In-memory audit buffer for batch writes
let auditBuffer = [];
const BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

// Flush buffer periodically
let flushInterval = null;

/**
 * Initialize audit logging (call on server start)
 */
export function initAuditLog() {
  if (flushInterval) return;

  flushInterval = setInterval(() => {
    if (auditBuffer.length > 0) {
      flushAuditBuffer();
    }
  }, FLUSH_INTERVAL_MS);

  // Don't prevent process exit
  flushInterval.unref();

  log.info('Audit logging initialized');
}

/**
 * Flush audit buffer to storage
 * In production, this would write to a database or external service
 */
async function flushAuditBuffer() {
  if (auditBuffer.length === 0) return;

  const entries = [...auditBuffer];
  auditBuffer = [];

  // For now, just log to file. In production, save to database.
  for (const entry of entries) {
    log.info('AUDIT', entry);
  }

  // TODO: Save to database when db supports audit collection
  // await db.saveAuditLogs(entries);
}

/**
 * Log an audit event
 * @param {string} action - Action type from AUDIT_ACTIONS
 * @param {Object} req - Express request (for user context)
 * @param {Object} details - Additional details about the action
 */
export async function logAudit(action, req, details = {}) {
  const context = req ? getUserContext(req) : {};

  const entry = {
    timestamp: new Date().toISOString(),
    action,
    userId: context.userId || 'system',
    tenantId: context.tenantId || 'default',
    sessionId: context.sessionId || null,
    ip: context.ip || null,
    userAgent: context.userAgent || null,
    resource: details.resource || null,
    resourceId: details.resourceId || null,
    metadata: details.metadata || {},
    success: details.success !== false,
    errorMessage: details.error || null
  };

  // Add to buffer
  auditBuffer.push(entry);

  // Flush if buffer is full
  if (auditBuffer.length >= BUFFER_SIZE) {
    await flushAuditBuffer();
  }

  // Also log immediately for important actions
  const criticalActions = [
    AUDIT_ACTIONS.EMAIL_SEND,
    AUDIT_ACTIONS.EMAIL_APPROVE,
    AUDIT_ACTIONS.DEPLOYMENT_DELETE,
    AUDIT_ACTIONS.DATA_DELETE,
    AUDIT_ACTIONS.CONFIG_UPDATE
  ];

  if (criticalActions.includes(action)) {
    log.info('AUDIT_CRITICAL', entry);
  }

  return entry;
}

/**
 * Express middleware to auto-log requests
 * Use on sensitive routes
 */
export function auditMiddleware(action) {
  return (req, res, next) => {
    // Log after response
    res.on('finish', () => {
      const success = res.statusCode < 400;
      logAudit(action, req, {
        resource: req.baseUrl + req.path,
        resourceId: req.params.id || req.params.siteId || null,
        metadata: {
          method: req.method,
          statusCode: res.statusCode
        },
        success,
        error: success ? null : res.statusMessage
      });
    });
    next();
  };
}

/**
 * Get audit logs (for admin dashboard)
 * @param {Object} filters - Filters for querying logs
 */
export async function getAuditLogs(filters = {}) {
  // For now, return empty. In production, query from database.
  // TODO: Implement when db supports audit collection
  log.debug('getAuditLogs called', filters);
  return [];
}

/**
 * Cleanup function for graceful shutdown
 */
export async function shutdownAuditLog() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  await flushAuditBuffer();
  log.info('Audit log flushed on shutdown');
}

export {
  AUDIT_ACTIONS
};

export default {
  initAuditLog,
  logAudit,
  auditMiddleware,
  getAuditLogs,
  shutdownAuditLog,
  AUDIT_ACTIONS
};
