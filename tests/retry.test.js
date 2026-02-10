// tests/retry.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryPolicy, RETRY_POLICIES } from '../src/utils/retry.js';

describe('RetryPolicy', () => {
  describe('successful calls', () => {
    it('should succeed on first try (no retries needed)', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });

      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retries on failure', () => {
    it('should succeed after 1 retry (fail once, then succeed)', async () => {
      const error = new Error('Temporary failure');
      error.status = 500; // Make it retryable

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });
      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should give up after max attempts and throw the last error', async () => {
      const error = new Error('Always fails');
      error.status = 503; // Retryable

      const fn = vi.fn().mockRejectedValue(error);
      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });

      await expect(policy.execute(fn)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryable error detection', () => {
    it('should retry on 429 rate limit', async () => {
      const error = new Error('Rate limited');
      error.status = 429;

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });
      const result = await policy.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx server errors', async () => {
      const errors = [500, 502, 503, 504];

      for (const status of errors) {
        const error = new Error('Server error');
        error.status = status;

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue('success');

        const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });
        const result = await policy.execute(fn);

        expect(result).toBe('success');
      }
    });

    it('should retry on network errors (ECONNRESET, ETIMEDOUT)', async () => {
      const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];

      for (const code of networkErrors) {
        const error = new Error('Network error');
        error.code = code;

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue('success');

        const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });
        const result = await policy.execute(fn);

        expect(result).toBe('success');
      }
    });

    it('should NOT retry non-retryable errors (400, 404, 403)', async () => {
      const nonRetryableErrors = [400, 404, 403, 401];

      for (const status of nonRetryableErrors) {
        const error = new Error('Client error');
        error.status = status;

        const fn = vi.fn().mockRejectedValue(error);
        const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });

        await expect(policy.execute(fn)).rejects.toThrow('Client error');
        expect(fn).toHaveBeenCalledTimes(1); // Should fail immediately
      }
    });
  });

  describe('retry callbacks', () => {
    it('should call onRetry callback with attempt number and delay', async () => {
      const error = new Error('Fail');
      error.status = 500;

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const onRetry = vi.fn();
      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });

      await policy.execute(fn, { onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Fail' }),
        expect.any(Number), // attempt number
        expect.any(Number)  // delay
      );
    });

    it('should support custom shouldRetry predicate', async () => {
      const error = new Error('Custom error');
      error.customField = true;

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Custom retry logic: only retry if error has customField
      const shouldRetry = (err) => err.customField === true;

      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });
      const result = await policy.execute(fn, { shouldRetry });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry when custom shouldRetry returns false', async () => {
      const error = new Error('Custom error');
      error.status = 500; // Would normally be retryable

      const fn = vi.fn().mockRejectedValue(error);

      // Custom retry logic: never retry
      const shouldRetry = () => false;

      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1 });

      await expect(policy.execute(fn, { shouldRetry })).rejects.toThrow('Custom error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('exponential backoff with jitter', () => {
    it('should use short delays in tests (baseDelay=1ms)', async () => {
      const error = new Error('Fail');
      error.status = 500;

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const policy = new RetryPolicy({ maxAttempts: 3, baseDelay: 1, maxDelay: 10 });

      const start = Date.now();
      await policy.execute(fn);
      const elapsed = Date.now() - start;

      // With baseDelay=1ms and 2 retries, should complete in < 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('pre-configured policies', () => {
    it('should have scraper policy with correct config', () => {
      expect(RETRY_POLICIES.scraper).toBeInstanceOf(RetryPolicy);
      expect(RETRY_POLICIES.scraper.maxAttempts).toBe(3);
      expect(RETRY_POLICIES.scraper.baseDelay).toBe(2000);
    });

    it('should have ai policy with correct config', () => {
      expect(RETRY_POLICIES.ai).toBeInstanceOf(RetryPolicy);
      expect(RETRY_POLICIES.ai.maxAttempts).toBe(2);
      expect(RETRY_POLICIES.ai.baseDelay).toBe(3000);
    });

    it('should have image policy with correct config', () => {
      expect(RETRY_POLICIES.image).toBeInstanceOf(RetryPolicy);
      expect(RETRY_POLICIES.image.maxAttempts).toBe(2);
    });

    it('should have deploy policy with correct config', () => {
      expect(RETRY_POLICIES.deploy).toBeInstanceOf(RetryPolicy);
      expect(RETRY_POLICIES.deploy.maxAttempts).toBe(2);
    });
  });
});
