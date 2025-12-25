// tests/leadSource.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLeadFinder, getAvailableLeadSources } from '../src/leadSource.js';

describe('leadSource', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear lead-related env vars before each test
    delete process.env.OUTSCRAPER_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.LEAD_SOURCE;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('createLeadFinder', () => {
    it('should throw when no API keys are configured', () => {
      expect(() => createLeadFinder('auto')).toThrow('No lead source configured');
    });

    it('should throw when requesting outscraper without API key', () => {
      expect(() => createLeadFinder('outscraper')).toThrow('OUTSCRAPER_API_KEY not set');
    });

    it('should throw when requesting googlePlaces without API key', () => {
      expect(() => createLeadFinder('googlePlaces')).toThrow('GOOGLE_PLACES_API_KEY not set');
    });

    it('should throw for unknown lead source', () => {
      expect(() => createLeadFinder('unknown')).toThrow('Unknown lead source');
    });

    it('should create Outscraper finder when API key is set', () => {
      process.env.OUTSCRAPER_API_KEY = 'test-outscraper-key';
      const finder = createLeadFinder('outscraper');
      expect(finder.constructor.name).toBe('LeadFinder');
    });

    it('should create Google Places finder when API key is set', () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
      const finder = createLeadFinder('googlePlaces');
      expect(finder.constructor.name).toBe('GooglePlacesLeadFinder');
    });

    it('should prefer Outscraper in auto mode when both are available', () => {
      process.env.OUTSCRAPER_API_KEY = 'test-outscraper-key';
      process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
      const finder = createLeadFinder('auto');
      expect(finder.constructor.name).toBe('LeadFinder');
    });

    it('should fallback to Google Places in auto mode when only it is available', () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
      const finder = createLeadFinder('auto');
      expect(finder.constructor.name).toBe('GooglePlacesLeadFinder');
    });

    it('should use Outscraper in auto mode when only it is available', () => {
      process.env.OUTSCRAPER_API_KEY = 'test-outscraper-key';
      const finder = createLeadFinder('auto');
      expect(finder.constructor.name).toBe('LeadFinder');
    });
  });

  describe('getAvailableLeadSources', () => {
    it('should return empty array when no API keys configured', () => {
      const sources = getAvailableLeadSources();
      expect(sources).toEqual([]);
    });

    it('should include outscraper when configured', () => {
      process.env.OUTSCRAPER_API_KEY = 'test-key';
      const sources = getAvailableLeadSources();
      expect(sources).toContain('outscraper');
    });

    it('should include googlePlaces when configured', () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      const sources = getAvailableLeadSources();
      expect(sources).toContain('googlePlaces');
    });

    it('should include both when both configured', () => {
      process.env.OUTSCRAPER_API_KEY = 'test-key';
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      const sources = getAvailableLeadSources();
      expect(sources).toContain('outscraper');
      expect(sources).toContain('googlePlaces');
      expect(sources.length).toBe(2);
    });
  });
});
