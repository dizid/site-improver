// tests/scrapeCache.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrapeCache } from '../src/cache/scrapeCache.js';
import fs from 'fs/promises';

// Mock fs
vi.mock('fs/promises');

describe('ScrapeCache', () => {
  let cache;
  let originalDateNow;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock Date.now for TTL tests
    originalDateNow = Date.now;
    let mockTime = 1000000000000; // Start time
    Date.now = vi.fn(() => mockTime);

    // Store reference to advance time
    Date.now.advance = (ms) => {
      mockTime += ms;
    };

    // Mock fs operations
    fs.mkdir = vi.fn().mockResolvedValue(undefined);
    fs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));
    fs.writeFile = vi.fn().mockResolvedValue(undefined);
    fs.unlink = vi.fn().mockResolvedValue(undefined);
    fs.readdir = vi.fn().mockResolvedValue([]);

    cache = new ScrapeCache({ ttlMs: 60000, maxEntries: 3, cacheDir: '.test-cache' });
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('cache miss', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.get('https://example.com');
      expect(result).toBeNull();
    });

    it('should return null for non-existent URL', async () => {
      const result = await cache.get('https://never-cached.com');
      expect(result).toBeNull();
    });
  });

  describe('cache hit', () => {
    it('should return cached data after set()', async () => {
      const url = 'https://example.com';
      const data = { businessName: 'Test Business', headlines: ['Welcome'] };

      await cache.set(url, data);
      const result = await cache.get(url);

      expect(result).toEqual(data);
    });

    it('should handle multiple cached URLs', async () => {
      await cache.set('https://site1.com', { name: 'Site 1' });
      await cache.set('https://site2.com', { name: 'Site 2' });
      await cache.set('https://site3.com', { name: 'Site 3' });

      expect(await cache.get('https://site1.com')).toEqual({ name: 'Site 1' });
      expect(await cache.get('https://site2.com')).toEqual({ name: 'Site 2' });
      expect(await cache.get('https://site3.com')).toEqual({ name: 'Site 3' });
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const url = 'https://example.com';
      const data = { businessName: 'Test' };

      // Cache the data
      await cache.set(url, data);

      // Should be cached
      expect(await cache.get(url)).toEqual(data);

      // Advance time beyond TTL (60000ms)
      Date.now.advance(70000);

      // Should now return null (expired)
      const expired = await cache.get(url);
      expect(expired).toBeNull();
    });

    it('should not expire within TTL window', async () => {
      const url = 'https://example.com';
      const data = { businessName: 'Test' };

      await cache.set(url, data);

      // Advance time but stay within TTL
      Date.now.advance(30000); // Half TTL

      const result = await cache.get(url);
      expect(result).toEqual(data);
    });
  });

  describe('memory cache', () => {
    it('should use memory cache independently of disk', async () => {
      const url = 'https://example.com';
      const data = { test: 'data' };

      // Set in cache
      await cache.set(url, data);

      // Clear the mock to verify memory cache is used
      fs.readFile.mockClear();

      // Get from cache (should use memory, not disk)
      const result = await cache.get(url);

      expect(result).toEqual(data);
      // fs.readFile should not be called if memory cache hit
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should evict oldest entries when at capacity', async () => {
      const cache = new ScrapeCache({ maxEntries: 2 });

      await cache.set('https://site1.com', { id: 1 });
      await cache.set('https://site2.com', { id: 2 });

      // This should evict site1
      await cache.set('https://site3.com', { id: 3 });

      // site1 should be evicted from memory
      expect(cache.memoryCache.size).toBe(2);
      expect(cache.memoryCache.has(cache.hashUrl('https://site1.com'))).toBe(false);
    });
  });

  describe('disk cache fallback', () => {
    it('should read from disk if not in memory', async () => {
      const url = 'https://example.com';
      const diskData = {
        url,
        timestamp: Date.now(),
        data: { businessName: 'From Disk' }
      };

      // Mock disk read
      fs.readFile.mockResolvedValue(JSON.stringify(diskData));

      const result = await cache.get(url);

      expect(result).toEqual({ businessName: 'From Disk' });
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should promote disk cache to memory on hit', async () => {
      const url = 'https://example.com';
      const diskData = {
        url,
        timestamp: Date.now(),
        data: { businessName: 'Test' }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(diskData));

      // First get (from disk)
      await cache.get(url);

      // Clear mock to verify second get uses memory
      fs.readFile.mockClear();

      // Second get should use memory cache
      const result = await cache.get(url);
      expect(result).toEqual({ businessName: 'Test' });
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should write to disk on set()', async () => {
      const url = 'https://example.com';
      const data = { test: 'data' };

      await cache.set(url, data);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = fs.writeFile.mock.calls[0];
      expect(writeCall[0]).toContain('.test-cache');
      expect(writeCall[0]).toMatch(/\.json$/);
    });
  });

  describe('invalidate', () => {
    it('should remove entry from cache', async () => {
      const url = 'https://example.com';
      const data = { test: 'data' };

      await cache.set(url, data);
      expect(await cache.get(url)).toEqual(data);

      await cache.invalidate(url);

      const result = await cache.get(url);
      expect(result).toBeNull();
    });

    it('should delete disk file on invalidate', async () => {
      const url = 'https://example.com';
      await cache.set(url, { test: 'data' });

      await cache.invalidate(url);

      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all cached entries', async () => {
      await cache.set('https://site1.com', { id: 1 });
      await cache.set('https://site2.com', { id: 2 });
      await cache.set('https://site3.com', { id: 3 });

      expect(cache.memoryCache.size).toBe(3);

      await cache.clear();

      expect(cache.memoryCache.size).toBe(0);
    });

    it('should delete all disk files on clear', async () => {
      fs.readdir.mockResolvedValue(['file1.json', 'file2.json', 'readme.txt']);

      await cache.clear();

      // Should delete .json files but not others
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cache.getStats();

      expect(stats).toMatchObject({
        memoryEntries: 0,
        maxEntries: 3,
        ttlMs: 60000,
        cacheDir: '.test-cache'
      });
    });

    it('should track memory entries count', async () => {
      await cache.set('https://site1.com', { id: 1 });
      await cache.set('https://site2.com', { id: 2 });

      const stats = cache.getStats();
      expect(stats.memoryEntries).toBe(2);
    });
  });

  describe('hashUrl', () => {
    it('should create consistent hash for same URL', () => {
      const url = 'https://example.com';
      const hash1 = cache.hashUrl(url);
      const hash2 = cache.hashUrl(url);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should create different hashes for different URLs', () => {
      const hash1 = cache.hashUrl('https://site1.com');
      const hash2 = cache.hashUrl('https://site2.com');

      expect(hash1).not.toBe(hash2);
    });
  });
});
