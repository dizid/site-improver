// src/imageOptimizer.js
// Image optimization utilities for preview generation
// Supports Cloudinary, Imgix, and local fallbacks

import logger from './logger.js';

const log = logger.child('imageOptimizer');

/**
 * Configuration for image optimization
 */
const CONFIG = {
  maxWidth: 1200,
  maxHeight: 800,
  heroWidth: 1200,
  heroHeight: 630,
  thumbnailWidth: 400,
  thumbnailHeight: 300,
  quality: 80,
  format: 'webp', // Preferred format
  fallbackFormat: 'jpeg',
  lazyLoadPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+'
};

/**
 * Detect available CDN service
 */
export function getConfiguredCDN() {
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    return 'cloudinary';
  }
  if (process.env.IMGIX_DOMAIN) {
    return 'imgix';
  }
  return null;
}

/**
 * Check if image optimization is available
 */
export function isOptimizationAvailable() {
  return getConfiguredCDN() !== null;
}

/**
 * Generate optimized image URL
 * @param {string} originalUrl - Original image URL
 * @param {Object} options - Optimization options
 * @returns {string} Optimized URL or original if no CDN
 */
export function getOptimizedUrl(originalUrl, options = {}) {
  if (!originalUrl) return null;

  const cdn = getConfiguredCDN();
  const opts = {
    width: options.width || CONFIG.maxWidth,
    height: options.height,
    quality: options.quality || CONFIG.quality,
    format: options.format || CONFIG.format
  };

  if (cdn === 'cloudinary') {
    return getCloudinaryUrl(originalUrl, opts);
  }

  if (cdn === 'imgix') {
    return getImgixUrl(originalUrl, opts);
  }

  // No CDN - return original URL (browser will handle it)
  log.debug('No CDN configured, using original URL', { url: originalUrl });
  return originalUrl;
}

/**
 * Generate Cloudinary optimized URL
 * Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/fetch/{transformations}/{url}
 */
function getCloudinaryUrl(originalUrl, opts) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ||
    (process.env.CLOUDINARY_URL?.match(/cloudinary:\/\/[^@]+@(.+)/)?.[1]);

  if (!cloudName) {
    log.warn('Cloudinary cloud name not found');
    return originalUrl;
  }

  // Build transformation string
  const transforms = [];

  if (opts.width) transforms.push(`w_${opts.width}`);
  if (opts.height) transforms.push(`h_${opts.height}`);
  if (opts.quality) transforms.push(`q_${opts.quality}`);
  if (opts.format) transforms.push(`f_${opts.format}`);

  // Add auto-best quality and crop mode
  transforms.push('c_limit'); // Resize maintaining aspect ratio
  transforms.push('dpr_auto'); // Device pixel ratio

  const transformString = transforms.join(',');
  const encodedUrl = encodeURIComponent(originalUrl);

  const optimizedUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/${transformString}/${encodedUrl}`;

  log.debug('Generated Cloudinary URL', {
    original: originalUrl.slice(0, 50),
    optimized: optimizedUrl.slice(0, 80)
  });

  return optimizedUrl;
}

/**
 * Generate Imgix optimized URL
 * Imgix URL format: https://{domain}/{path}?{params}
 */
function getImgixUrl(originalUrl, opts) {
  const domain = process.env.IMGIX_DOMAIN;
  const secureToken = process.env.IMGIX_SECURE_TOKEN;

  if (!domain) {
    log.warn('Imgix domain not configured');
    return originalUrl;
  }

  // Build query params
  const params = new URLSearchParams();

  if (opts.width) params.set('w', opts.width.toString());
  if (opts.height) params.set('h', opts.height.toString());
  if (opts.quality) params.set('q', opts.quality.toString());
  if (opts.format && opts.format !== 'auto') params.set('fm', opts.format);

  // Auto format and quality optimization
  params.set('auto', 'format,compress');
  params.set('fit', 'max');

  const encodedUrl = encodeURIComponent(originalUrl);
  const optimizedUrl = `https://${domain}/external/${encodedUrl}?${params.toString()}`;

  log.debug('Generated Imgix URL', {
    original: originalUrl.slice(0, 50),
    optimized: optimizedUrl.slice(0, 80)
  });

  return optimizedUrl;
}

/**
 * Get hero image URL optimized for display
 */
export function getHeroImageUrl(originalUrl) {
  return getOptimizedUrl(originalUrl, {
    width: CONFIG.heroWidth,
    height: CONFIG.heroHeight,
    quality: 85, // Higher quality for hero
    format: 'webp'
  });
}

/**
 * Get thumbnail URL
 */
export function getThumbnailUrl(originalUrl) {
  return getOptimizedUrl(originalUrl, {
    width: CONFIG.thumbnailWidth,
    height: CONFIG.thumbnailHeight,
    quality: 75,
    format: 'webp'
  });
}

/**
 * Generate srcset for responsive images
 * @param {string} originalUrl - Original image URL
 * @param {Array} widths - Array of widths for srcset
 * @returns {string} srcset attribute value
 */
export function generateSrcset(originalUrl, widths = [400, 800, 1200]) {
  if (!originalUrl) return '';

  const cdn = getConfiguredCDN();
  if (!cdn) {
    // No CDN - just return the original URL for the largest size
    return `${originalUrl} ${Math.max(...widths)}w`;
  }

  return widths
    .map(width => {
      const url = getOptimizedUrl(originalUrl, { width, format: 'webp' });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate picture element HTML with WebP and fallback
 * @param {Object} image - Image object with src and alt
 * @param {Object} options - Options for sizing
 * @returns {string} Picture element HTML
 */
export function generatePictureElement(image, options = {}) {
  const { src, alt = '' } = image;
  const {
    width = CONFIG.maxWidth,
    height,
    className = '',
    loading = 'lazy',
    sizes = '100vw'
  } = options;

  if (!src) return '';

  const cdn = getConfiguredCDN();

  // Build responsive images
  const widths = [400, 800, 1200];
  const srcset = generateSrcset(src, widths);

  // Fallback URL
  const fallbackUrl = cdn ? getOptimizedUrl(src, { width, format: 'jpeg' }) : src;

  // WebP source
  const webpSrcset = cdn ? srcset : '';

  // Generate HTML
  let html = '<picture>\n';

  // WebP source (if CDN available)
  if (cdn && webpSrcset) {
    html += `  <source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">\n`;
  }

  // Fallback img
  const imgAttrs = [
    `src="${fallbackUrl}"`,
    `alt="${escapeHtml(alt)}"`,
    `loading="${loading}"`,
    `decoding="async"`
  ];

  if (className) imgAttrs.push(`class="${className}"`);
  if (width) imgAttrs.push(`width="${width}"`);
  if (height) imgAttrs.push(`height="${height}"`);

  // Add srcset if CDN available
  if (cdn && srcset) {
    imgAttrs.push(`srcset="${srcset}"`);
    imgAttrs.push(`sizes="${sizes}"`);
  }

  html += `  <img ${imgAttrs.join(' ')}>\n`;
  html += '</picture>';

  return html;
}

/**
 * Generate lazy-loaded image HTML
 * @param {Object} image - Image object
 * @param {Object} options - Options
 * @returns {string} Image HTML with lazy loading
 */
export function generateLazyImage(image, options = {}) {
  const { src, alt = '' } = image;
  const {
    width = CONFIG.maxWidth,
    height,
    className = '',
    placeholder = CONFIG.lazyLoadPlaceholder
  } = options;

  if (!src) return '';

  const optimizedSrc = getOptimizedUrl(src, { width, format: 'webp' });

  const attrs = [
    `src="${placeholder}"`,
    `data-src="${optimizedSrc}"`,
    `alt="${escapeHtml(alt)}"`,
    `loading="lazy"`,
    `decoding="async"`,
    `class="lazy-image ${className}".trim()`
  ];

  if (width) attrs.push(`width="${width}"`);
  if (height) attrs.push(`height="${height}"`);

  return `<img ${attrs.join(' ')}>`;
}

/**
 * Generate background image CSS with optimized URL
 * @param {string} url - Image URL
 * @param {Object} options - Options
 * @returns {Object} CSS properties
 */
export function generateBackgroundImageCSS(url, options = {}) {
  if (!url) return {};

  const { width = CONFIG.heroWidth, position = 'center', size = 'cover' } = options;

  const optimizedUrl = getOptimizedUrl(url, { width, format: 'webp' });
  const fallbackUrl = getOptimizedUrl(url, { width, format: 'jpeg' });

  return {
    backgroundImage: `url('${optimizedUrl}')`,
    backgroundPosition: position,
    backgroundSize: size,
    backgroundRepeat: 'no-repeat',
    // Fallback for browsers that don't support WebP (very rare now)
    fallback: `url('${fallbackUrl}')`
  };
}

/**
 * Process all images in site data for optimization
 * @param {Object} siteData - Scraped site data
 * @returns {Object} Site data with optimized image URLs
 */
export function optimizeSiteImages(siteData) {
  if (!siteData) return siteData;

  const result = { ...siteData };

  // Optimize main images array
  if (result.images && Array.isArray(result.images)) {
    result.images = result.images.map(img => {
      const src = img.src || img.url || img;
      return {
        ...img,
        src,
        optimizedSrc: getOptimizedUrl(src, {
          width: img.context === 'hero' ? CONFIG.heroWidth : CONFIG.maxWidth
        }),
        thumbnailSrc: getThumbnailUrl(src),
        srcset: generateSrcset(src)
      };
    });
  }

  // Optimize og:image
  if (result.ogImage) {
    result.ogImageOptimized = getHeroImageUrl(result.ogImage);
  }

  // Optimize logo
  if (result.logo) {
    result.logoOptimized = getOptimizedUrl(result.logo, {
      width: 300,
      height: 100,
      format: 'png' // Preserve transparency
    });
  }

  log.debug('Site images optimized', {
    imageCount: result.images?.length || 0,
    hasOgImage: !!result.ogImageOptimized,
    hasLogo: !!result.logoOptimized
  });

  return result;
}

/**
 * Validate image URL is likely to work
 * @param {string} url - Image URL
 * @returns {boolean} Is valid
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Check for common invalid patterns
  const invalidPatterns = [
    /^data:image\/svg/i,
    /placeholder/i,
    /loading/i,
    /spinner/i,
    /1x1/,
    /spacer/i,
    /blank/i,
    /default/i,
    /no-?image/i,
    /missing/i
  ];

  if (invalidPatterns.some(p => p.test(url))) {
    return false;
  }

  // Check URL format
  try {
    if (url.startsWith('data:image/')) {
      return !url.startsWith('data:image/svg');
    }
    const parsed = new URL(url, 'https://example.com');
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Get optimization status/info
 */
export function getOptimizationStatus() {
  const cdn = getConfiguredCDN();
  return {
    available: cdn !== null,
    provider: cdn,
    config: {
      maxWidth: CONFIG.maxWidth,
      heroWidth: CONFIG.heroWidth,
      quality: CONFIG.quality,
      format: CONFIG.format
    }
  };
}

/**
 * Escape HTML for safe attribute insertion
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default {
  getConfiguredCDN,
  isOptimizationAvailable,
  getOptimizedUrl,
  getHeroImageUrl,
  getThumbnailUrl,
  generateSrcset,
  generatePictureElement,
  generateLazyImage,
  generateBackgroundImageCSS,
  optimizeSiteImages,
  isValidImageUrl,
  getOptimizationStatus,
  CONFIG
};
