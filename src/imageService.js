// src/imageService.js
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('imageService');

// Industry-specific search queries for stock photos
const INDUSTRY_QUERIES = {
  restaurant: ['restaurant interior elegant', 'chef cooking kitchen', 'fine dining table'],
  plumber: ['professional plumber work', 'modern bathroom renovation', 'plumbing repair service'],
  electrician: ['electrician professional work', 'electrical panel installation', 'home electrical service'],
  lawyer: ['modern law office', 'legal consultation professional', 'attorney meeting client'],
  'real-estate': ['modern home exterior', 'luxury house interior', 'real estate agent showing home'],
  retail: ['retail store modern', 'shopping boutique interior', 'product display elegant'],
  'home-services': ['home contractor professional', 'house renovation work', 'handyman service'],
  dentist: ['modern dental clinic', 'dentist with patient', 'dental office interior'],
  general: ['professional business office', 'team meeting modern', 'business consultation']
};

// Fallback generic queries if industry not matched
const GENERIC_QUERIES = [
  'professional business team',
  'modern office workspace',
  'customer service professional'
];

/**
 * Image service for fetching stock photos
 */
export class ImageService {
  constructor() {
    this.unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    this.pexelsKey = process.env.PEXELS_API_KEY;
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return Boolean(this.unsplashKey || this.pexelsKey);
  }

  /**
   * Get a hero image for the given industry
   */
  async getHeroImage(industry, keywords = []) {
    if (!this.isAvailable()) {
      log.debug('No image API keys configured');
      return null;
    }

    const queries = INDUSTRY_QUERIES[industry] || INDUSTRY_QUERIES.general;
    const query = queries[0]; // Use primary query

    // Add any custom keywords
    const searchQuery = keywords.length > 0
      ? `${query} ${keywords.join(' ')}`
      : query;

    // Try Unsplash first, then Pexels
    let result = null;
    if (this.unsplashKey) {
      result = await this.fetchFromUnsplash(searchQuery, 'landscape');
    }
    if (!result && this.pexelsKey) {
      result = await this.fetchFromPexels(searchQuery, 'landscape');
    }

    if (result) {
      log.info('Found hero image', { industry, source: result.source, photographer: result.photographer });
    }

    return result;
  }

  /**
   * Get multiple service images
   */
  async getServiceImages(industry, count = 3) {
    if (!this.isAvailable()) {
      return [];
    }

    const queries = INDUSTRY_QUERIES[industry] || GENERIC_QUERIES;
    const images = [];

    for (let i = 0; i < Math.min(count, queries.length); i++) {
      const query = queries[i] || queries[0];

      let result = null;
      if (this.unsplashKey) {
        result = await this.fetchFromUnsplash(query, 'squarish');
      }
      if (!result && this.pexelsKey) {
        result = await this.fetchFromPexels(query, 'square');
      }

      if (result) {
        images.push(result);
      }
    }

    log.debug('Fetched service images', { industry, count: images.length });
    return images;
  }

  /**
   * Fetch image from Unsplash API
   */
  async fetchFromUnsplash(query, orientation = 'landscape') {
    try {
      const url = new URL('https://api.unsplash.com/photos/random');
      url.searchParams.set('query', query);
      url.searchParams.set('orientation', orientation);
      url.searchParams.set('content_filter', 'high');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Client-ID ${this.unsplashKey}`,
          'Accept-Version': 'v1'
        },
        signal: AbortSignal.timeout(CONFIG.timeouts.apiRequest)
      });

      if (!response.ok) {
        log.warn('Unsplash API error', { status: response.status, query });
        return null;
      }

      const data = await response.json();

      return {
        url: data.urls.regular,
        urlSmall: data.urls.small,
        urlThumb: data.urls.thumb,
        alt: data.alt_description || query,
        photographer: data.user.name,
        photographerUrl: data.user.links.html,
        source: 'unsplash',
        license: 'Unsplash License',
        attribution: `Photo by ${data.user.name} on Unsplash`
      };

    } catch (error) {
      log.warn('Unsplash fetch failed', { error: error.message, query });
      return null;
    }
  }

  /**
   * Fetch image from Pexels API
   */
  async fetchFromPexels(query, orientation = 'landscape') {
    try {
      const url = new URL('https://api.pexels.com/v1/search');
      url.searchParams.set('query', query);
      url.searchParams.set('orientation', orientation);
      url.searchParams.set('per_page', '1');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': this.pexelsKey
        },
        signal: AbortSignal.timeout(CONFIG.timeouts.apiRequest)
      });

      if (!response.ok) {
        log.warn('Pexels API error', { status: response.status, query });
        return null;
      }

      const data = await response.json();

      if (!data.photos || data.photos.length === 0) {
        log.debug('No Pexels results', { query });
        return null;
      }

      const photo = data.photos[0];

      return {
        url: photo.src.large,
        urlSmall: photo.src.medium,
        urlThumb: photo.src.tiny,
        alt: photo.alt || query,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        source: 'pexels',
        license: 'Pexels License',
        attribution: `Photo by ${photo.photographer} on Pexels`
      };

    } catch (error) {
      log.warn('Pexels fetch failed', { error: error.message, query });
      return null;
    }
  }

  /**
   * Get a placeholder gradient for when no image is available
   */
  getPlaceholderGradient(industry) {
    const gradients = {
      restaurant: 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%)',
      plumber: 'linear-gradient(135deg, #2196f3 0%, #00bcd4 100%)',
      electrician: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
      lawyer: 'linear-gradient(135deg, #1a237e 0%, #3f51b5 100%)',
      'real-estate': 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
      retail: 'linear-gradient(135deg, #9c27b0 0%, #e91e63 100%)',
      'home-services': 'linear-gradient(135deg, #ff9800 0%, #4caf50 100%)',
      dentist: 'linear-gradient(135deg, #00bcd4 0%, #4caf50 100%)',
      general: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
    };

    return gradients[industry] || gradients.general;
  }
}

/**
 * Select best hero image from extracted images or fallback to stock
 */
export async function selectHeroImage(siteData, imageService = null) {
  const { images = [], industry = 'general', ogImage = null } = siteData;

  // Priority 1: og:image (social share image - usually high quality)
  if (ogImage && isValidImageUrl(ogImage)) {
    log.debug('Using og:image as hero', { ogImage });
    return {
      url: ogImage,
      source: 'og:image',
      alt: siteData.businessName || 'Business hero image'
    };
  }

  // Priority 2: Largest extracted image
  const heroCandidate = findLargestImage(images);
  if (heroCandidate) {
    log.debug('Using extracted image as hero', { url: heroCandidate.src });
    return {
      url: heroCandidate.src,
      source: 'extracted',
      alt: heroCandidate.alt || siteData.businessName || 'Business image'
    };
  }

  // Priority 3: Stock photo
  if (imageService && imageService.isAvailable()) {
    const stockImage = await imageService.getHeroImage(industry);
    if (stockImage) {
      return {
        url: stockImage.url,
        source: 'stock',
        alt: stockImage.alt,
        attribution: stockImage.attribution
      };
    }
  }

  // Priority 4: No image (template will use gradient)
  log.debug('No hero image found, using gradient fallback');
  return null;
}

/**
 * Find the largest usable image from extracted images
 */
function findLargestImage(images) {
  if (!images || images.length === 0) return null;

  // Filter out likely icons, logos, and small images
  const candidates = images.filter(img => {
    const src = img.src || '';
    // Skip common icon/logo patterns
    if (/logo|icon|favicon|badge|sprite|avatar|thumb/i.test(src)) return false;
    // Skip data URIs (usually small)
    if (src.startsWith('data:')) return false;
    // Skip SVGs
    if (src.endsWith('.svg')) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Return the first candidate (they should be sorted by relevance/size by scraper)
  return candidates[0];
}

/**
 * Validate image URL
 */
function isValidImageUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url) ||
           url.includes('unsplash.com') ||
           url.includes('pexels.com');
  } catch {
    return false;
  }
}

export default ImageService;
