// src/leadFinder.js
// Find businesses via Google Maps using Outscraper API

import logger from './logger.js';
import { CONFIG } from './config.js';
import { delay } from './utils.js';

const log = logger.child('leadFinder');

export class LeadFinder {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.app.outscraper.com';
  }

  /**
   * Search for businesses by query and location
   * @param {string} query - Business type (e.g., "plumber", "restaurant")
   * @param {string} location - City/region (e.g., "Denver, CO")
   * @param {number} limit - Max results (default 20)
   */
  async search(query, location, limit = 20) {
    const searchQuery = `${query} ${location}`;
    
    const params = new URLSearchParams({
      query: searchQuery,
      limit: limit.toString(),
      async: 'false'
    });

    const response = await fetch(
      `${this.baseUrl}/maps/search-v3?${params}`,
      {
        headers: {
          'X-API-KEY': this.apiKey
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Outscraper API error: ${error}`);
    }

    const data = await response.json();
    
    // Outscraper returns nested array
    const results = data.data?.[0] || [];
    
    return results.map(biz => ({
      name: biz.name,
      website: biz.site || biz.website || null,
      phone: biz.phone || null,
      email: this.extractEmail(biz),
      address: biz.full_address || biz.address || null,
      city: biz.city || null,
      state: biz.state || null,
      rating: biz.rating || null,
      reviews: biz.reviews || 0,
      category: biz.category || biz.type || null,
      placeId: biz.place_id || null,
      lat: biz.latitude,
      lng: biz.longitude
    }));
  }

  /**
   * Search multiple queries/locations
   */
  async searchBatch(searches) {
    const results = [];

    for (const { query, location, limit } of searches) {
      log.info('Searching', { query, location });

      try {
        const businesses = await this.search(query, location, limit || 20);
        results.push(...businesses.map(b => ({
          ...b,
          searchQuery: query,
          searchLocation: location
        })));

        // Rate limiting - be nice to API
        await delay(CONFIG.batch.rateLimit);
      } catch (error) {
        log.error('Search failed', { query, location, error: error.message });
      }
    }
    
    // Dedupe by website
    const seen = new Set();
    return results.filter(r => {
      if (!r.website || seen.has(r.website)) return false;
      seen.add(r.website);
      return true;
    });
  }

  /**
   * Search by industry across multiple cities
   */
  async searchIndustry(industry, cities, limitPerCity = 20) {
    const searches = cities.map(city => ({
      query: industry,
      location: city,
      limit: limitPerCity
    }));
    
    return this.searchBatch(searches);
  }

  extractEmail(biz) {
    // Outscraper sometimes includes email in different fields
    if (biz.email) return biz.email;
    if (biz.emails?.length) return biz.emails[0];
    return null;
  }
}

/**
 * Alternative: Free approach using Google Custom Search
 * Less data but free tier available
 */
export class GoogleSearchLeadFinder {
  constructor(apiKey, searchEngineId) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  async search(query, location, limit = 10) {
    const searchQuery = `${query} ${location}`;
    
    const params = new URLSearchParams({
      key: this.apiKey,
      cx: this.searchEngineId,
      q: searchQuery,
      num: Math.min(limit, 10).toString()
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`
    );

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.items || []).map(item => ({
      name: item.title,
      website: item.link,
      snippet: item.snippet
    }));
  }
}

export default LeadFinder;
