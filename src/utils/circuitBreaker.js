// src/utils/circuitBreaker.js
// Circuit breaker pattern - prevent hammering failing services

import logger from '../logger.js';

const log = logger.child('circuitBreaker');

// Circuit breaker states
const STATE = {
  CLOSED: 'CLOSED',       // Normal operation, requests pass through
  OPEN: 'OPEN',           // Service is down, reject requests immediately
  HALF_OPEN: 'HALF_OPEN'  // Testing if service recovered, allow one request
};

/**
 * CircuitBreaker - Wraps external service calls to prevent cascading failures
 *
 * State machine:
 *   CLOSED  --[failureThreshold reached]--> OPEN
 *   OPEN    --[resetTimeout elapsed]------> HALF_OPEN
 *   HALF_OPEN --[success]-----------------> CLOSED
 *   HALF_OPEN --[failure]-----------------> OPEN
 *
 * @example
 * const breaker = new CircuitBreaker('firecrawl', { failureThreshold: 3 });
 * const result = await breaker.execute(() => fetch(url));
 */
export class CircuitBreaker {
  constructor(name, { failureThreshold = 3, resetTimeout = 60000 } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  /**
   * Execute a function through the circuit breaker
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>} Result of fn
   * @throws {Error} If circuit is open or fn fails
   */
  async execute(fn) {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === STATE.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeout) {
        log.info('Circuit half-opening, testing service', { name: this.name });
        this.state = STATE.HALF_OPEN;
      } else {
        const remainingMs = this.resetTimeout - elapsed;
        const error = new Error(
          `Circuit breaker OPEN for ${this.name} - service unavailable. Resets in ${Math.ceil(remainingMs / 1000)}s`
        );
        error.code = 'CIRCUIT_OPEN';
        error.circuitBreaker = this.name;
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful call
   */
  onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      log.info('Circuit closing - service recovered', {
        name: this.name,
        previousFailures: this.failureCount
      });
    }
    this.failureCount = 0;
    this.state = STATE.CLOSED;
    this.successCount++;
  }

  /**
   * Record a failed call
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATE.HALF_OPEN) {
      // Test request failed, go back to OPEN
      log.warn('Circuit re-opening - test request failed', {
        name: this.name
      });
      this.state = STATE.OPEN;
    } else if (this.failureCount >= this.failureThreshold) {
      log.warn('Circuit opening - failure threshold reached', {
        name: this.name,
        failures: this.failureCount,
        threshold: this.failureThreshold,
        resetTimeout: this.resetTimeout
      });
      this.state = STATE.OPEN;
    }
  }

  /**
   * Get current circuit breaker state for health checks
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      config: {
        failureThreshold: this.failureThreshold,
        resetTimeout: this.resetTimeout
      }
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    log.info('Circuit breaker manually reset', { name: this.name });
  }
}

// Pre-configured circuit breakers for each external service
export const CIRCUIT_BREAKERS = {
  firecrawl: new CircuitBreaker('firecrawl', { failureThreshold: 3, resetTimeout: 60000 }),
  anthropic: new CircuitBreaker('anthropic', { failureThreshold: 5, resetTimeout: 30000 }),
  imageApi: new CircuitBreaker('imageApi', { failureThreshold: 3, resetTimeout: 60000 })
};
