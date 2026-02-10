// src/utils/retry.js
// Exponential backoff with jitter for external API calls

import logger from '../logger.js';

const log = logger.child('retry');

// HTTP status codes and error codes that are safe to retry
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED',
  'EPIPE', 'EAI_AGAIN', 'EHOSTUNREACH'
]);

/**
 * Check if an error is retryable based on HTTP status or network error code
 */
function isRetryableError(error) {
  // HTTP response errors
  if (error.status && RETRYABLE_STATUS_CODES.has(error.status)) return true;
  if (error.statusCode && RETRYABLE_STATUS_CODES.has(error.statusCode)) return true;

  // Network-level errors
  if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) return true;

  // Timeout errors
  if (error.message && /timed?\s*out/i.test(error.message)) return true;

  // Anthropic rate limit / overloaded
  if (error.error?.type === 'overloaded_error') return true;

  return false;
}

/**
 * RetryPolicy - Wraps async functions with exponential backoff retry logic
 *
 * @example
 * const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1000 });
 * const result = await policy.execute(() => fetch(url), { context: 'scrape' });
 */
export class RetryPolicy {
  constructor({ maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, multiplier = 2 } = {}) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.multiplier = multiplier;
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Retry options
   * @param {Function} options.onRetry - Called before each retry (error, attempt, delay)
   * @param {Function} options.shouldRetry - Custom retry predicate (error) => boolean
   * @param {string} options.context - Label for log messages
   * @returns {Promise<*>} Result of fn
   */
  async execute(fn, options = {}) {
    const { onRetry, shouldRetry, context = 'unknown' } = options;
    let lastError;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        const canRetry = shouldRetry
          ? shouldRetry(error)
          : isRetryableError(error);

        if (!canRetry || attempt === this.maxAttempts) {
          log.warn('All retry attempts exhausted', {
            context,
            attempts: attempt,
            error: error.message
          });
          throw error;
        }

        // Calculate delay with exponential backoff + jitter
        const exponentialDelay = this.baseDelay * Math.pow(this.multiplier, attempt - 1);
        const jitter = Math.random() * 500;
        const delay = Math.min(exponentialDelay + jitter, this.maxDelay);

        // Honor Retry-After header if present (429 responses)
        const retryAfter = error.headers?.get?.('retry-after');
        const effectiveDelay = retryAfter
          ? Math.max(parseInt(retryAfter, 10) * 1000, delay)
          : delay;

        log.warn('Retrying after failure', {
          context,
          attempt,
          maxAttempts: this.maxAttempts,
          delay: Math.round(effectiveDelay),
          error: error.message,
          code: error.code || error.status || 'N/A'
        });

        if (onRetry) {
          onRetry(error, attempt, effectiveDelay);
        }

        await sleep(effectiveDelay);
      }
    }

    throw lastError;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Pre-configured policies for different services
export const RETRY_POLICIES = {
  scraper: new RetryPolicy({ maxAttempts: 3, baseDelay: 2000, maxDelay: 15000 }),
  ai: new RetryPolicy({ maxAttempts: 2, baseDelay: 3000, maxDelay: 10000 }),
  image: new RetryPolicy({ maxAttempts: 2, baseDelay: 1000, maxDelay: 5000 }),
  deploy: new RetryPolicy({ maxAttempts: 2, baseDelay: 2000, maxDelay: 10000 })
};
