// src/auth/middleware.js
// Authentication middleware using Clerk
import { clerkMiddleware, getAuth, requireAuth as clerkRequireAuth } from '@clerk/express';
import logger from '../logger.js';

const log = logger.child('auth');

/**
 * Check if authentication is configured
 */
export function isAuthConfigured() {
  return !!(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY);
}

/**
 * Initialize Clerk middleware
 * Returns a no-op middleware if Clerk is not configured
 */
export function initClerkMiddleware() {
  if (!isAuthConfigured()) {
    log.warn('Clerk not configured - auth disabled. Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY to enable.');
    return (req, res, next) => next();
  }

  log.info('Clerk authentication enabled');
  return clerkMiddleware();
}

/**
 * Require authentication middleware
 * In development without Clerk: warns but allows through
 * In production without Clerk: blocks all requests
 */
export function requireAuth() {
  return (req, res, next) => {
    if (!isAuthConfigured()) {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        log.error('Auth required in production but Clerk not configured');
        return res.status(503).json({
          error: 'Service unavailable',
          code: 'AUTH_NOT_CONFIGURED'
        });
      }
      // Development mode - allow through with warning
      log.debug('Auth bypassed in development mode');
      req.auth = { userId: 'dev-user', sessionId: 'dev-session' };
      return next();
    }

    // Use Clerk's auth check
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    req.auth = auth;
    next();
  };
}

/**
 * Require specific role middleware
 * @param {string|string[]} allowedRoles - Role(s) required to access
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req, res, next) => {
    if (!isAuthConfigured()) {
      // In dev mode, allow through
      if (process.env.NODE_ENV !== 'production') {
        req.userRole = 'admin'; // Dev gets admin
        return next();
      }
      return res.status(503).json({ error: 'Service unavailable' });
    }

    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Get role from session claims or user metadata
    // Clerk stores custom claims in sessionClaims.metadata or publicMetadata
    const userRole = auth.sessionClaims?.metadata?.role ||
                     auth.sessionClaims?.publicMetadata?.role ||
                     'member';

    if (!roles.includes(userRole) && !roles.includes('*')) {
      log.warn('Access denied - insufficient role', {
        userId: auth.userId,
        required: roles,
        actual: userRole
      });
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    req.auth = auth;
    req.userRole = userRole;
    next();
  };
}

/**
 * Optional auth - populates req.auth if authenticated, but doesn't block
 */
export function optionalAuth() {
  return (req, res, next) => {
    if (!isAuthConfigured()) {
      req.auth = null;
      return next();
    }

    const auth = getAuth(req);
    req.auth = auth?.userId ? auth : null;
    next();
  };
}

/**
 * Extract user context for database operations
 * @param {Object} req - Express request
 * @returns {Object} User context with tenantId, userId
 */
export function getUserContext(req) {
  const auth = req.auth || {};
  return {
    userId: auth.userId || 'anonymous',
    sessionId: auth.sessionId || null,
    // TenantId comes from organization or user metadata
    tenantId: auth.orgId || auth.sessionClaims?.metadata?.tenantId || auth.userId || 'default',
    role: req.userRole || 'member',
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  };
}

export default {
  initClerkMiddleware,
  requireAuth,
  requireRole,
  optionalAuth,
  getUserContext,
  isAuthConfigured
};
