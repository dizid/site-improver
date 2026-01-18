// src/auth/rateLimiter.js
// Rate limiting middleware with tiered limits per endpoint type
import rateLimit from 'express-rate-limit';
import logger from '../logger.js';

const log = logger.child('rateLimiter');

/**
 * Rate limit configurations by endpoint type
 */
const RATE_LIMITS = {
  // General API calls - generous limit
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // 100 requests per window
    message: 'Too many requests, please try again later'
  },

  // Pipeline runs - expensive operations
  pipeline: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,                   // 10 per hour
    message: 'Pipeline rate limit reached. Upgrade your plan for more.'
  },

  // Lead discovery - external API costs
  discovery: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,                   // 20 per hour
    message: 'Discovery rate limit reached. Upgrade your plan for more.'
  },

  // Email operations - spam prevention
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,                   // 50 per hour
    message: 'Email rate limit reached. Try again later.'
  },

  // Auth endpoints - brute force prevention
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // 10 attempts
    message: 'Too many authentication attempts'
  },

  // Strict limit for sensitive operations
  strict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,                    // 5 per hour
    message: 'Rate limit reached for this operation'
  }
};

/**
 * Create a rate limiter with custom key generator
 * Uses user ID if authenticated, falls back to IP
 */
function createLimiter(config, name) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: { error: config.message, code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,

    // Disable validations since we use userId-first key generation
    // which handles IPv6 concerns by preferring authenticated user keys
    validate: false,

    // Use userId if available, otherwise IP
    keyGenerator: (req) => {
      const userId = req.auth?.userId;
      // Prefer userId over IP to avoid IPv6 bypass issues
      if (userId) {
        return `${name}:user:${userId}`;
      }
      // Fallback to IP (normalized)
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      return `${name}:ip:${ip}`;
    },

    // Log when limit is hit
    handler: (req, res, next, options) => {
      const userId = req.auth?.userId || 'anonymous';
      const ip = req.ip || 'unknown';
      log.warn('Rate limit exceeded', {
        limiter: name,
        userId,
        ip,
        path: req.path
      });
      res.status(429).json(options.message);
    },

    // Skip rate limiting in test environment
    skip: () => process.env.NODE_ENV === 'test'
  });
}

// Pre-built limiters
export const generalLimiter = createLimiter(RATE_LIMITS.general, 'general');
export const pipelineLimiter = createLimiter(RATE_LIMITS.pipeline, 'pipeline');
export const discoveryLimiter = createLimiter(RATE_LIMITS.discovery, 'discovery');
export const emailLimiter = createLimiter(RATE_LIMITS.email, 'email');
export const authLimiter = createLimiter(RATE_LIMITS.auth, 'auth');
export const strictLimiter = createLimiter(RATE_LIMITS.strict, 'strict');

/**
 * Create a custom rate limiter
 * @param {Object} options - Rate limit options
 * @param {string} name - Limiter name for logging
 */
export function createCustomLimiter(options, name = 'custom') {
  return createLimiter({ ...RATE_LIMITS.general, ...options }, name);
}

/**
 * Get rate limit config (for exposing to clients)
 */
export function getRateLimitConfig() {
  return Object.entries(RATE_LIMITS).reduce((acc, [key, config]) => {
    acc[key] = {
      windowMs: config.windowMs,
      max: config.max
    };
    return acc;
  }, {});
}

export default {
  generalLimiter,
  pipelineLimiter,
  discoveryLimiter,
  emailLimiter,
  authLimiter,
  strictLimiter,
  createCustomLimiter,
  getRateLimitConfig,
  RATE_LIMITS
};
