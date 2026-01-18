// src/auth/index.js
// Authentication, authorization, and security module
export {
  initClerkMiddleware,
  requireAuth,
  requireRole,
  optionalAuth,
  getUserContext,
  isAuthConfigured
} from './middleware.js';

export {
  generalLimiter,
  pipelineLimiter,
  discoveryLimiter,
  emailLimiter,
  authLimiter,
  strictLimiter,
  createCustomLimiter,
  getRateLimitConfig,
  RATE_LIMITS
} from './rateLimiter.js';

export {
  initAuditLog,
  logAudit,
  auditMiddleware,
  getAuditLogs,
  shutdownAuditLog,
  AUDIT_ACTIONS
} from './auditLog.js';
