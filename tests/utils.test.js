// tests/utils.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  delay,
  extractCity,
  safeParseJsonArray,
  safeParseJsonObject,
  normalizeUrl,
  isSameUrl,
  truncate,
  slugify,
  formatDuration,
  retry
} from '../src/utils.js';

describe('utils', () => {
  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('extractCity', () => {
    it('should extract city from address', () => {
      expect(extractCity('123 Main St, Denver, CO 80202')).toBe('Denver');
      expect(extractCity('456 Oak Ave, Austin, TX')).toBe('Austin');
      expect(extractCity('San Francisco, CA')).toBe('San Francisco');
    });

    it('should return null for invalid addresses', () => {
      expect(extractCity(null)).toBeNull();
      expect(extractCity('')).toBeNull();
      expect(extractCity('no state here')).toBeNull();
    });
  });

  describe('safeParseJsonArray', () => {
    it('should parse valid JSON array from text', () => {
      expect(safeParseJsonArray('Here is the array: ["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
      expect(safeParseJsonArray('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should return fallback for invalid JSON', () => {
      expect(safeParseJsonArray('no array here', ['default'])).toEqual(['default']);
      expect(safeParseJsonArray('{"object": true}', [])).toEqual([]);
      expect(safeParseJsonArray('[invalid json]', ['fallback'])).toEqual(['fallback']);
    });
  });

  describe('safeParseJsonObject', () => {
    it('should parse valid JSON object from text', () => {
      expect(safeParseJsonObject('Result: {"key": "value"}')).toEqual({ key: 'value' });
      expect(safeParseJsonObject('{"a": 1, "b": 2}')).toEqual({ a: 1, b: 2 });
    });

    it('should return fallback for invalid JSON', () => {
      expect(safeParseJsonObject('no object', { default: true })).toEqual({ default: true });
      expect(safeParseJsonObject('["array"]', {})).toEqual({});
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize URLs consistently', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('https://Example.COM/')).toBe('https://example.com');
      expect(normalizeUrl('HTTP://site.com')).toBe('http://site.com');
      expect(normalizeUrl('  https://test.com/  ')).toBe('https://test.com');
    });

    it('should handle empty/null inputs', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl(null)).toBe('');
      expect(normalizeUrl(undefined)).toBe('');
    });
  });

  describe('isSameUrl', () => {
    it('should correctly compare URLs', () => {
      expect(isSameUrl('example.com', 'https://example.com')).toBe(true);
      expect(isSameUrl('https://site.com/', 'https://site.com')).toBe(true);
      expect(isSameUrl('site1.com', 'site2.com')).toBe(false);
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
      expect(truncate('Short', 10)).toBe('Short');
      expect(truncate('Exactly10!', 10)).toBe('Exactly10!');
    });

    it('should handle edge cases', () => {
      expect(truncate(null, 10)).toBeNull();
      expect(truncate('', 5)).toBe('');
    });
  });

  describe('slugify', () => {
    it('should create valid slugs', () => {
      expect(slugify("Bob's Plumbing")).toBe('bob-s-plumbing');
      expect(slugify('Acme Corp & Sons')).toBe('acme-corp-sons');
      expect(slugify('123 Test Business')).toBe('123-test-business');
    });

    it('should limit slug length', () => {
      const longName = 'This is a very long business name that should be truncated';
      expect(slugify(longName).length).toBeLessThanOrEqual(30);
    });

    it('should handle empty input', () => {
      expect(slugify('')).toBe('site');
      expect(slugify(null)).toBe('site');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(2500)).toBe('2.5s');
      expect(formatDuration(10000)).toBe('10.0s');
    });

    it('should format minutes', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(120000)).toBe('2m 0s');
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, { maxRetries: 3, baseDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(retry(fn, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      await retry(fn, { maxRetries: 3, baseDelay: 10, onRetry });
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });
  });
});
