// src/sentry.js
// Sentry error tracking initialization

import * as Sentry from '@sentry/node';

let initialized = false;

/**
 * Check if Sentry is configured
 * @returns {boolean}
 */
export function isSentryConfigured() {
  return !!process.env.SENTRY_DSN;
}

/**
 * Initialize Sentry error tracking
 * Safe to call multiple times - only initializes once
 * @param {Object} options - Additional Sentry options
 * @returns {boolean} Whether Sentry was initialized
 */
export function initSentry(options = {}) {
  if (initialized) return true;
  if (!isSentryConfigured()) return false;

  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const release = process.env.npm_package_version || '1.0.0';

  Sentry.init({
    dsn,
    environment,
    release: `site-improver@${release}`,

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Don't send errors in test environment
    enabled: process.env.NODE_ENV !== 'test',

    // Additional options
    ...options
  });

  initialized = true;
  return true;
}

/**
 * Capture an exception and send to Sentry
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  if (!initialized) return;

  Sentry.withScope(scope => {
    // Add extra context
    if (context.user) {
      scope.setUser(context.user);
    }
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message and send to Sentry
 * @param {string} message - The message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!initialized) return;

  Sentry.withScope(scope => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for all subsequent events
 * @param {Object} user - User info { id, email, tenantId }
 */
export function setUser(user) {
  if (!initialized) return;
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser() {
  if (!initialized) return;
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 * @param {Object} breadcrumb - { message, category, level, data }
 */
export function addBreadcrumb(breadcrumb) {
  if (!initialized) return;
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Express error handler middleware
 * Should be added after all routes
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Report all 400+ errors to Sentry
      if (error.statusCode >= 400) {
        return true;
      }
      return true;
    }
  });
}

/**
 * Express request handler middleware
 * Should be added before all routes
 */
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    // Include user data in request context
    user: ['id', 'email', 'tenantId']
  });
}

/**
 * Wrap an async function to capture errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export function wrapAsync(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error);
      throw error;
    }
  };
}

export default {
  init: initSentry,
  isConfigured: isSentryConfigured,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  errorHandler: sentryErrorHandler,
  requestHandler: sentryRequestHandler,
  wrapAsync
};
