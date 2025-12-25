// src/utils.js
// Shared utility functions used across the application

/**
 * Delay execution for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract city name from a US address string
 * @param {string} address - Full address (e.g., "123 Main St, Denver, CO 80202")
 * @returns {string|null} - City name or null if not found
 */
export function extractCity(address) {
  if (!address) return null;
  // Looks for pattern: "City Name, ST" where ST is two capital letters
  const match = address.match(/([A-Za-z\s]+),\s*[A-Z]{2}/);
  return match ? match[1].trim() : null;
}

/**
 * Safely parse JSON from a string that may contain other text
 * Extracts the first JSON array found in the text
 * @param {string} text - Text potentially containing JSON
 * @param {Array} fallback - Fallback value if parsing fails
 * @returns {Array} - Parsed array or fallback
 */
export function safeParseJsonArray(text, fallback = []) {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return fallback;
    return JSON.parse(match[0]);
  } catch (error) {
    return fallback;
  }
}

/**
 * Safely parse JSON object from a string that may contain other text
 * Extracts the first JSON object found in the text
 * @param {string} text - Text potentially containing JSON
 * @param {Object} fallback - Fallback value if parsing fails
 * @returns {Object} - Parsed object or fallback
 */
export function safeParseJsonObject(text, fallback = {}) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    return JSON.parse(match[0]);
  } catch (error) {
    return fallback;
  }
}

/**
 * Normalize a URL to a consistent format
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
export function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url.trim().toLowerCase();
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  // Add https if no protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized;
}

/**
 * Validate a URL format
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, normalized?: string, error?: string }}
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: 'URL is required' };
  }

  try {
    // Add protocol if missing
    const withProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    const parsed = new URL(withProtocol);

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }

    // Must have a valid domain (contains at least one dot)
    if (!parsed.hostname.includes('.')) {
      return { valid: false, error: 'Invalid domain format' };
    }

    // Reject localhost and IP addresses for business URLs
    if (parsed.hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) {
      return { valid: false, error: 'Local addresses not allowed' };
    }

    return { valid: true, normalized: parsed.href.replace(/\/$/, '') };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate an email address format
 * @param {string} email - Email to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }

  // RFC 5322 compliant regex (simplified but robust)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Must have at least one dot in domain part
  const [, domain] = trimmed.split('@');
  if (!domain || !domain.includes('.')) {
    return { valid: false, error: 'Invalid email domain' };
  }

  return { valid: true };
}

/**
 * Check if two URLs point to the same site
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} - True if same site
 */
export function isSameUrl(url1, url2) {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a slug from a business name
 * @param {string} name - Business name
 * @returns {string} - URL-safe slug
 */
export function slugify(name) {
  if (!name) return 'site';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

/**
 * Format a duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration (e.g., "2.5s", "1m 30s")
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function
 */
export async function retry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, onRetry = null } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt - 1);
        if (onRetry) onRetry(attempt, error, delayMs);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

export default {
  delay,
  extractCity,
  safeParseJsonArray,
  safeParseJsonObject,
  normalizeUrl,
  validateUrl,
  validateEmail,
  isSameUrl,
  truncate,
  slugify,
  formatDuration,
  retry
};
