// tests/circuitBreaker.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CIRCUIT_BREAKERS } from '../src/utils/circuitBreaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CLOSED state (normal operation)', () => {
    it('should allow calls through when CLOSED', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.state).toBe('CLOSED');
    });

    it('should remain CLOSED after successful calls', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);
      await breaker.execute(fn);
      await breaker.execute(fn);

      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
    });
  });

  describe('OPEN state (circuit tripped)', () => {
    it('should open after failureThreshold consecutive failures', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // First 3 failures should trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('CLOSED'); // Still closed after 1 failure

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('CLOSED'); // Still closed after 2 failures

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('OPEN'); // NOW it opens on 3rd failure
      expect(breaker.failureCount).toBe(3);
    });

    it('should reject calls immediately when OPEN', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 2 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      expect(breaker.state).toBe('OPEN');

      // Now the circuit is open - next call should be rejected immediately
      const fastFail = vi.fn().mockResolvedValue('success');
      await expect(breaker.execute(fastFail)).rejects.toThrow(/Circuit breaker OPEN/);
      expect(fastFail).not.toHaveBeenCalled(); // Function should not be executed
    });

    it('should include service name and reset time in error message', async () => {
      const breaker = new CircuitBreaker('firecrawl', { failureThreshold: 2, resetTimeout: 60000 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      // Verify error message
      await expect(breaker.execute(fn)).rejects.toThrow(/firecrawl/);
      await expect(breaker.execute(fn)).rejects.toThrow(/Resets in \d+s/);
    });
  });

  describe('HALF_OPEN state (testing recovery)', () => {
    it('should transition to HALF_OPEN after resetTimeout', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 2, resetTimeout: 60000 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('OPEN');

      // Advance time to trigger timeout
      vi.advanceTimersByTime(60000);

      // Next call should transition to HALF_OPEN
      const testFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(testFn);

      expect(testFn).toHaveBeenCalledTimes(1);
      expect(breaker.state).toBe('CLOSED'); // Success closes circuit
    });

    it('should close circuit on success in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 2, resetTimeout: 1000 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.state).toBe('OPEN');

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Successful call should close circuit
      const successFn = vi.fn().mockResolvedValue('recovered');
      const result = await breaker.execute(successFn);

      expect(result).toBe('recovered');
      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
    });

    it('should re-open circuit on failure in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 2, resetTimeout: 1000 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.state).toBe('OPEN');

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Failed test request should re-open circuit
      const testFn = vi.fn().mockRejectedValue(new Error('still failing'));
      await expect(breaker.execute(testFn)).rejects.toThrow('still failing');

      expect(breaker.state).toBe('OPEN');
    });
  });

  describe('manual reset', () => {
    it('should reset circuit state when reset() is called', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 2 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.state).toBe('OPEN');
      expect(breaker.failureCount).toBe(2);

      // Manual reset
      breaker.reset();

      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
      expect(breaker.lastFailureTime).toBeNull();
    });
  });

  describe('getState', () => {
    it('should return correct state info', async () => {
      const breaker = new CircuitBreaker('test-service', { failureThreshold: 3, resetTimeout: 60000 });
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);

      const state = breaker.getState();

      expect(state).toMatchObject({
        name: 'test-service',
        state: 'CLOSED',
        failureCount: 0,
        successCount: 1,
        config: {
          failureThreshold: 3,
          resetTimeout: 60000
        }
      });
    });

    it('should track success count', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);
      await breaker.execute(fn);
      await breaker.execute(fn);

      const state = breaker.getState();
      expect(state.successCount).toBe(3);
    });
  });

  describe('pre-configured circuit breakers', () => {
    it('should have firecrawl breaker', () => {
      expect(CIRCUIT_BREAKERS.firecrawl).toBeInstanceOf(CircuitBreaker);
      expect(CIRCUIT_BREAKERS.firecrawl.name).toBe('firecrawl');
    });

    it('should have anthropic breaker', () => {
      expect(CIRCUIT_BREAKERS.anthropic).toBeInstanceOf(CircuitBreaker);
      expect(CIRCUIT_BREAKERS.anthropic.name).toBe('anthropic');
    });

    it('should have imageApi breaker', () => {
      expect(CIRCUIT_BREAKERS.imageApi).toBeInstanceOf(CircuitBreaker);
      expect(CIRCUIT_BREAKERS.imageApi.name).toBe('imageApi');
    });
  });
});
