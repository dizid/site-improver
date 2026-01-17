// src/config.js
// Centralized configuration - all magic numbers and settings in one place

/**
 * Application configuration
 * All hardcoded values are centralized here for easy modification
 */
export const CONFIG = {
  // Timeouts (in milliseconds)
  timeouts: {
    pageLoad: 30000,          // Max time to wait for page load
    scoring: 15000,           // Max time for scoring a site
    deployPoll: 2000,         // Interval between deploy status checks
    deployMax: 60000,         // Max time to wait for deploy to complete
    scrapeWait: 2000,         // Wait after page load for JS to settle
    apiRequest: 30000         // Default API request timeout
  },

  // Content extraction limits
  limits: {
    headlines: 10,            // Max headlines to extract
    paragraphs: 10,           // Max paragraphs to extract
    services: 10,             // Max services to extract
    testimonials: 10,         // Max testimonials to extract (increased for better coverage)
    images: 20,               // Max images to extract
    colors: 5,                // Max colors to extract from site
    siteNameLength: 30,       // Max length for generated site names
    listItems: 20,            // Max list items to extract
    faqs: 10,                 // Max FAQs to extract
    blockquotes: 10,          // Max blockquotes to extract
    tables: 5                 // Max tables to extract
  },

  // Site scoring configuration
  scoring: {
    // Scoring strategy: 'pageSpeed' (API), 'browser' (Playwright), 'hybrid' (API first, fallback)
    strategy: 'hybrid',

    // Speed thresholds in ms (maps to score percentages)
    speedThresholds: {
      excellent: 2000,        // <= 2s = 100%
      good: 4000,             // <= 4s = 75%
      fair: 6000,             // <= 6s = 50%
      poor: 10000             // <= 10s = 25%, > 10s = 0%
    },

    // Score weights for browser-based scoring (must sum to 100)
    weights: {
      https: 15,
      speed: 20,
      mobile: 20,
      modern: 25,
      seo: 20
    },

    // PageSpeed weights (for combined score calculation)
    pageSpeedWeights: {
      performance: 0.35,
      seo: 0.25,
      accessibility: 0.20,
      bestPractices: 0.20
    },

    // Target thresholds (lower score = worse site = better target)
    primeTargetScore: 35,     // Sites below this are prime targets (best opportunities)
    maxTargetScore: 65,       // Sites below this are worth pursuing
    skipScore: 75             // Sites above this are too good, skip them
  },

  // Lead qualification configuration
  qualification: {
    requireContact: true,     // Must have email or phone
    filterMarkets: false,     // Filter by target markets
    targetMarkets: ['NL', 'UK'],
    // Social media domains to filter out
    socialDomains: [
      'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
      'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
      'yelp.com', 'tripadvisor.com'
    ]
  },

  // Batch processing
  batch: {
    defaultDelay: 5000,       // ms between pipeline runs
    defaultConcurrency: 2,    // parallel processing limit
    rateLimit: 1000           // ms between API calls
  },

  // AI Polish configuration
  ai: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: {
      slot: 200,              // For individual slot polish
      services: 800,          // For service list polish
      fullSite: 1000          // For entire site polish
    },
    concurrency: 3            // Max parallel AI requests
  },

  // Cleanup configuration
  cleanup: {
    maxAgeDays: 30            // Delete sites older than this
  },

  // Email control configuration
  email: {
    autoSendEnabled: false,   // If false, emails queue for approval instead of sending
    requireApproval: true     // Require manual approval before any email sends
  },

  // Email sequence timing (days after initial email)
  emailSequence: {
    followUp1: 3,
    followUp2: 7,
    followUp3: 12,
    expire: 14
  },

  // Server configuration
  server: {
    defaultPort: 3000,
    functionsPort: 9999,
    corsOrigins: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:9999']
  },

  // Database
  database: {
    defaultPath: './deployments.json'
  }
};

/**
 * Get environment configuration
 * Merges environment variables with defaults
 */
export function getEnvConfig() {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    netlifyToken: process.env.NETLIFY_AUTH_TOKEN,
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    outscraperApiKey: process.env.OUTSCRAPER_API_KEY,
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY,
    pageSpeedApiKey: process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
    leadSource: process.env.LEAD_SOURCE || 'auto', // 'outscraper', 'googlePlaces', or 'auto'
    port: parseInt(process.env.PORT, 10) || CONFIG.server.defaultPort,
    dbPath: process.env.DB_PATH || CONFIG.database.defaultPath,
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
    isTest: process.env.NODE_ENV === 'test',
    isProduction: process.env.NODE_ENV === 'production'
  };
}

/**
 * Get feature availability based on configured API keys
 * @returns {Object} Feature flags indicating what's available
 */
export function getFeatures() {
  const env = getEnvConfig();
  return {
    aiPolish: !!env.anthropicApiKey,
    deploy: true, // Always available - uses database storage, no external service needed
    email: !!(env.resendApiKey && env.fromEmail),
    leadFinder: !!env.outscraperApiKey,
    googlePlaces: !!env.googlePlacesApiKey,
    pageSpeed: !!env.pageSpeedApiKey
  };
}

/**
 * Validate required environment variables
 * @param {string[]} required - List of required env vars
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnv(required = []) {
  const env = getEnvConfig();
  const missing = [];

  const varMap = {
    ANTHROPIC_API_KEY: env.anthropicApiKey,
    NETLIFY_AUTH_TOKEN: env.netlifyToken,
    RESEND_API_KEY: env.resendApiKey,
    FROM_EMAIL: env.fromEmail,
    OUTSCRAPER_API_KEY: env.outscraperApiKey,
    GOOGLE_PLACES_API_KEY: env.googlePlacesApiKey,
    PAGESPEED_API_KEY: env.pageSpeedApiKey
  };

  for (const varName of required) {
    if (!varMap[varName]) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Validate startup configuration and log feature availability
 * @param {Object} logger - Logger instance with info/warn/error methods
 * @returns {{ features: Object, warnings: string[] }}
 */
export function validateStartup(logger) {
  const features = getFeatures();
  const warnings = [];

  // Log feature availability
  logger.info('Feature availability:', features);

  // Warn about missing optional features
  if (!features.aiPolish) {
    warnings.push('AI polish disabled - ANTHROPIC_API_KEY not set');
  }
  if (!features.email) {
    warnings.push('Email outreach disabled - RESEND_API_KEY or FROM_EMAIL not set');
  }

  // Log warnings
  warnings.forEach(w => logger.warn(w));

  return { features, warnings };
}

/**
 * Get speed score based on load time
 * @param {number} loadTimeMs - Page load time in milliseconds
 * @returns {number} - Score from 0-100
 */
export function getSpeedScore(loadTimeMs) {
  const { speedThresholds } = CONFIG.scoring;

  if (loadTimeMs <= speedThresholds.excellent) return 100;
  if (loadTimeMs <= speedThresholds.good) return 75;
  if (loadTimeMs <= speedThresholds.fair) return 50;
  if (loadTimeMs <= speedThresholds.poor) return 25;
  return 0;
}

/**
 * Determine if a score qualifies as a target
 * @param {number} score - Site score
 * @returns {{ isTarget: boolean, isPrimeTarget: boolean, recommendation: string }}
 */
export function classifyScore(score) {
  const { maxTargetScore, primeTargetScore } = CONFIG.scoring;

  const isPrimeTarget = score < primeTargetScore;
  const isTarget = score < maxTargetScore;

  let recommendation;
  if (isPrimeTarget) {
    recommendation = 'prime_target';
  } else if (isTarget) {
    recommendation = 'good_target';
  } else if (score < 80) {
    recommendation = 'weak_target';
  } else {
    recommendation = 'skip';
  }

  return { isTarget, isPrimeTarget, recommendation };
}

export default CONFIG;
