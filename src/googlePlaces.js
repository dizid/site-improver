// src/googlePlaces.js
// Google Places API client for lead discovery

import logger from './logger.js';
import { CONFIG, getEnvConfig } from './config.js';
import { delay } from './utils.js';

const log = logger.child('googlePlaces');

const API_BASE = 'https://places.googleapis.com/v1/places:searchText';

// Fields to request (keeps costs down)
const DEFAULT_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryType'
].join(',');

export class GooglePlacesLeadFinder {
  constructor(apiKey = null) {
    this.apiKey = apiKey || getEnvConfig().googlePlacesApiKey;
    if (!this.apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is required');
    }
  }

  /**
   * Search for businesses using Google Places Text Search API
   * @param {string} query - Search query (e.g., "plumber")
   * @param {string} location - Location to search (e.g., "Amsterdam, Netherlands")
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - List of businesses
   */
  async search(query, location, options = {}) {
    const {
      limit = 20,
      languageCode = 'en',
      regionCode = null
    } = options;

    const textQuery = `${query} in ${location}`;

    log.info('Searching Google Places', { query: textQuery, limit });

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': DEFAULT_FIELDS
        },
        body: JSON.stringify({
          textQuery,
          languageCode,
          ...(regionCode && { regionCode }),
          maxResultCount: Math.min(limit, 20) // API max is 20 per request
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('Google Places API error', { status: response.status, error: errorText });
        throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const places = data.places || [];

      log.info('Search complete', { found: places.length });

      return places.map(place => this.extractBusinessData(place));
    } catch (error) {
      log.error('Search failed', { query: textQuery, error: error.message });
      throw error;
    }
  }

  /**
   * Search multiple queries with rate limiting
   * @param {Array<{query: string, location: string}>} searches - List of searches
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Combined list of businesses (deduplicated)
   */
  async searchBatch(searches, options = {}) {
    const { rateLimit = CONFIG.batch.rateLimit } = options;
    const allResults = [];
    const seenWebsites = new Set();

    for (let i = 0; i < searches.length; i++) {
      const { query, location } = searches[i];

      try {
        const results = await this.search(query, location, options);

        // Deduplicate by website
        for (const result of results) {
          if (result.website && !seenWebsites.has(result.website)) {
            seenWebsites.add(result.website);
            allResults.push(result);
          } else if (!result.website) {
            // Include businesses without websites (might have other contact info)
            allResults.push(result);
          }
        }
      } catch (error) {
        log.warn('Batch search failed for query', { query, location, error: error.message });
      }

      // Rate limit between requests
      if (i < searches.length - 1) {
        await delay(rateLimit);
      }
    }

    log.info('Batch search complete', {
      searches: searches.length,
      totalFound: allResults.length
    });

    return allResults;
  }

  /**
   * Search for an industry across multiple regions
   * @param {string} industry - Industry name (e.g., "plumber")
   * @param {Array<string>} regions - List of regions to search
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Combined list of businesses
   */
  async searchIndustry(industry, regions, options = {}) {
    const searches = regions.map(region => ({
      query: industry,
      location: region
    }));

    return this.searchBatch(searches, options);
  }

  /**
   * Extract business data from a Google Places result
   * @param {Object} place - Google Places API place object
   * @returns {Object} - Normalized business data
   */
  extractBusinessData(place) {
    return {
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      website: place.websiteUri || null,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
      address: place.formattedAddress || null,
      rating: place.rating || null,
      reviews: place.userRatingCount || 0,
      status: place.businessStatus || 'OPERATIONAL',
      type: place.primaryType || null,
      source: 'google_places'
    };
  }
}

export default GooglePlacesLeadFinder;
