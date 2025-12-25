// src/leadSource.js
// Lead source factory - abstracts lead discovery providers

import LeadFinder from './leadFinder.js';
import { GooglePlacesLeadFinder } from './googlePlaces.js';
import { getEnvConfig, getFeatures } from './config.js';
import logger from './logger.js';

const log = logger.child('leadSource');

/**
 * Create a lead finder based on configuration
 *
 * @param {string} source - Lead source: 'outscraper', 'googlePlaces', or 'auto'
 *   - 'outscraper': Use Outscraper API (requires OUTSCRAPER_API_KEY)
 *   - 'googlePlaces': Use Google Places API (requires GOOGLE_PLACES_API_KEY)
 *   - 'auto': Prefer Outscraper, fallback to Google Places
 * @returns {LeadFinder|GooglePlacesLeadFinder} Lead finder instance
 * @throws {Error} If required API key is not configured
 */
export function createLeadFinder(source = 'auto') {
  const env = getEnvConfig();
  const features = getFeatures();

  // Explicit Google Places
  if (source === 'googlePlaces') {
    if (!features.googlePlaces) {
      throw new Error('GOOGLE_PLACES_API_KEY not set. Get one at https://console.cloud.google.com/');
    }
    log.info('Using Google Places API for lead discovery');
    return new GooglePlacesLeadFinder(env.googlePlacesApiKey);
  }

  // Explicit Outscraper
  if (source === 'outscraper') {
    if (!features.leadFinder) {
      throw new Error('OUTSCRAPER_API_KEY not set. Get one at https://outscraper.com/');
    }
    log.info('Using Outscraper API for lead discovery');
    return new LeadFinder(env.outscraperApiKey);
  }

  // Auto mode: prefer Outscraper, fallback to Google Places
  if (source === 'auto') {
    if (features.leadFinder) {
      log.info('Using Outscraper API for lead discovery (auto)');
      return new LeadFinder(env.outscraperApiKey);
    }
    if (features.googlePlaces) {
      log.info('Using Google Places API for lead discovery (auto fallback)');
      return new GooglePlacesLeadFinder(env.googlePlacesApiKey);
    }
    throw new Error(
      'No lead source configured. Set OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY'
    );
  }

  throw new Error(`Unknown lead source: ${source}. Use 'outscraper', 'googlePlaces', or 'auto'`);
}

/**
 * Get available lead sources based on configured API keys
 * @returns {string[]} Available source names
 */
export function getAvailableLeadSources() {
  const features = getFeatures();
  const sources = [];

  if (features.leadFinder) sources.push('outscraper');
  if (features.googlePlaces) sources.push('googlePlaces');

  return sources;
}

export default createLeadFinder;
