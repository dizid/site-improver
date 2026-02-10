// src/cache/scrapeCache.js
// Two-tier cache (memory + disk) for scraped site data
// Prevents re-scraping the same URL within the TTL window

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';

const log = logger.child('scrapeCache');

/**
 * ScrapeCache - Two-tier caching for scraped site data
 *
 * Memory tier: fast lookup, lost on restart
 * Disk tier: persistent across restarts, slower
 *
 * @example
 * const cached = await scrapeCache.get('https://example.com');
 * if (!cached) {
 *   const data = await scrapeSite('https://example.com');
 *   await scrapeCache.set('https://example.com', data);
 * }
 */
export class ScrapeCache {
  constructor({ ttlMs = 24 * 60 * 60 * 1000, maxEntries = 500, cacheDir = '.cache/scrapes' } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.cacheDir = cacheDir;
    this.memoryCache = new Map();
    this.initialized = false;
  }

  /**
   * Ensure cache directory exists
   */
  async ensureDir() {
    if (!this.initialized) {
      try {
        await fs.mkdir(this.cacheDir, { recursive: true });
        this.initialized = true;
      } catch (error) {
        log.warn('Failed to create cache directory', { dir: this.cacheDir, error: error.message });
      }
    }
  }

  /**
   * Create a short hash from a URL for file naming
   */
  hashUrl(url) {
    return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  }

  /**
   * Get cached data for a URL
   * Checks memory first, then disk
   * @param {string} url - The URL to look up
   * @returns {Object|null} Cached site data, or null if not found/expired
   */
  async get(url) {
    const hash = this.hashUrl(url);

    // Check memory cache first
    const memEntry = this.memoryCache.get(hash);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < this.ttlMs) {
        log.debug('Cache hit (memory)', { url, hash });
        return memEntry.data;
      }
      // Expired - remove from memory
      this.memoryCache.delete(hash);
    }

    // Check disk cache
    await this.ensureDir();
    try {
      const filePath = path.join(this.cacheDir, `${hash}.json`);
      const raw = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(raw);

      if (Date.now() - entry.timestamp < this.ttlMs) {
        // Promote to memory cache for faster subsequent lookups
        this.memoryCache.set(hash, entry);
        log.debug('Cache hit (disk)', { url, hash });
        return entry.data;
      }

      // Expired on disk - clean up
      await fs.unlink(filePath).catch(() => {});
    } catch {
      // File doesn't exist or is unreadable - cache miss
    }

    return null;
  }

  /**
   * Store scraped data in both memory and disk cache
   * @param {string} url - The URL that was scraped
   * @param {Object} data - The scraped site data
   */
  async set(url, data) {
    const hash = this.hashUrl(url);
    const entry = {
      url,
      timestamp: Date.now(),
      data
    };

    // Evict oldest entries if at capacity
    if (this.memoryCache.size >= this.maxEntries) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    // Write to memory
    this.memoryCache.set(hash, entry);

    // Write to disk
    await this.ensureDir();
    try {
      const filePath = path.join(this.cacheDir, `${hash}.json`);
      await fs.writeFile(filePath, JSON.stringify(entry));
      log.debug('Cached scrape data', { url, hash });
    } catch (error) {
      log.warn('Failed to write cache to disk', { url, error: error.message });
    }
  }

  /**
   * Remove a specific URL from cache
   * @param {string} url - The URL to invalidate
   */
  async invalidate(url) {
    const hash = this.hashUrl(url);
    this.memoryCache.delete(hash);

    try {
      const filePath = path.join(this.cacheDir, `${hash}.json`);
      await fs.unlink(filePath);
      log.debug('Cache invalidated', { url, hash });
    } catch {
      // File didn't exist, that's fine
    }
  }

  /**
   * Clear all cached data (memory + disk)
   */
  async clear() {
    this.memoryCache.clear();

    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(f => fs.unlink(path.join(this.cacheDir, f)).catch(() => {}))
      );
      log.info('Cache cleared');
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Get cache stats for monitoring
   */
  getStats() {
    return {
      memoryEntries: this.memoryCache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      cacheDir: this.cacheDir
    };
  }
}

// Default singleton instance
export const scrapeCache = new ScrapeCache();
