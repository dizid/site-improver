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
    testimonials: 5,          // Max testimonials to extract
    images: 20,               // Max images to extract
    colors: 5,                // Max colors to extract from site
    siteNameLength: 30        // Max length for generated site names
  },

  // Site scoring configuration
  scoring: {
    // Speed thresholds in ms (maps to score percentages)
    speedThresholds: {
      excellent: 2000,        // <= 2s = 100%
      good: 4000,             // <= 4s = 75%
      fair: 6000,             // <= 6s = 50%
      poor: 10000             // <= 10s = 25%, > 10s = 0%
    },
    // Score weights (must sum to 100)
    weights: {
      https: 15,
      speed: 20,
      mobile: 20,
      modern: 25,
      seo: 20
    },
    // Target thresholds
    maxTargetScore: 60,       // Sites below this are targets
    primeTargetScore: 40      // Sites below this are prime targets
  },

  // Batch processing
  batch: {
    defaultDelay: 5000,       // ms between pipeline runs
    defaultConcurrency: 2,    // parallel processing limit
    rateLimit: 1000           // ms between API calls
  },

  // AI Polish configuration
  ai: {
    model: 'claude-sonnet-4-20250514',
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
    port: parseInt(process.env.PORT, 10) || CONFIG.server.defaultPort,
    dbPath: process.env.DB_PATH || CONFIG.database.defaultPath,
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
    isTest: process.env.NODE_ENV === 'test',
    isProduction: process.env.NODE_ENV === 'production'
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
    OUTSCRAPER_API_KEY: env.outscraperApiKey
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
