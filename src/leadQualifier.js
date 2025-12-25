// src/leadQualifier.js
// Lead qualification logic for filtering and prioritizing leads

import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('qualifier');

// Target markets configuration
const MARKETS = {
  NL: {
    name: 'Netherlands',
    regions: ['Amsterdam', 'Rotterdam', 'Den Haag', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda'],
    patterns: ['Netherlands', 'Nederland', 'NL'],
    languageCode: 'nl'
  },
  UK: {
    name: 'United Kingdom',
    regions: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff'],
    patterns: ['United Kingdom', 'UK', 'England', 'Scotland', 'Wales'],
    languageCode: 'en'
  }
};

// Social media domains to filter out (not valid business websites)
const SOCIAL_DOMAINS = [
  'facebook.com', 'fb.com',
  'instagram.com',
  'twitter.com', 'x.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'yelp.com',
  'tripadvisor.com'
];

// Qualification classifications
const CLASSIFICATIONS = {
  PRIME_TARGET: { name: 'prime_target', priority: 10, minScore: 0, maxScore: 40 },
  TARGET: { name: 'target', priority: 7, minScore: 40, maxScore: 60 },
  WEAK_TARGET: { name: 'weak_target', priority: 3, minScore: 60, maxScore: 80 },
  SKIP: { name: 'skip', priority: 0, minScore: 80, maxScore: 100 }
};

export class LeadQualifier {
  constructor(options = {}) {
    this.options = {
      requireContact: options.requireContact ?? true,
      filterMarkets: options.filterMarkets ?? false,
      targetMarkets: options.targetMarkets || ['NL', 'UK'],
      primeTargetScore: options.primeTargetScore || CONFIG.scoring.primeTargetScore,
      maxTargetScore: options.maxTargetScore || CONFIG.scoring.maxTargetScore
    };
  }

  /**
   * Qualify a single lead
   * @param {Object} lead - Lead data
   * @param {number|null} siteScore - Site quality score (0-100, lower = worse site = better target)
   * @returns {Object} - Qualification result
   */
  qualify(lead, siteScore = null) {
    const result = {
      lead,
      qualified: false,
      disqualifyReason: null,
      classification: CLASSIFICATIONS.SKIP.name,
      priority: 0,
      checks: {
        hasWebsite: false,
        validWebsite: false,
        hasContact: false,
        inTargetMarket: null,
        siteScore: siteScore
      }
    };

    // Check 1: Has website
    if (!lead.website) {
      result.disqualifyReason = 'No website';
      return result;
    }
    result.checks.hasWebsite = true;

    // Check 2: Valid website (not social media)
    const websiteValidation = this.validateBusiness(lead);
    if (!websiteValidation.valid) {
      result.disqualifyReason = websiteValidation.reason;
      return result;
    }
    result.checks.validWebsite = true;

    // Check 3: Has contact info (if required)
    const contactValidation = this.validateContact(lead);
    result.checks.hasContact = contactValidation.hasContact;
    if (this.options.requireContact && !contactValidation.hasContact) {
      result.disqualifyReason = 'No contact information';
      return result;
    }

    // Check 4: In target market (if filtering enabled)
    if (this.options.filterMarkets) {
      const marketValidation = this.validateMarket(lead);
      result.checks.inTargetMarket = marketValidation.inTargetMarket;
      if (!marketValidation.inTargetMarket) {
        result.disqualifyReason = `Not in target markets: ${this.options.targetMarkets.join(', ')}`;
        return result;
      }
    }

    // Classify based on site score
    if (siteScore !== null) {
      result.classification = this.classifyScore(siteScore);
      result.priority = this.getPriority(result.classification);
    } else {
      // No score available - default to target (will be scored later)
      result.classification = CLASSIFICATIONS.TARGET.name;
      result.priority = CLASSIFICATIONS.TARGET.priority;
    }

    // Qualified if not skipped
    result.qualified = result.classification !== CLASSIFICATIONS.SKIP.name;

    return result;
  }

  /**
   * Qualify and sort a batch of leads
   * @param {Array} leads - List of leads with optional siteScore
   * @returns {Object} - Qualified leads sorted by priority
   */
  qualifyBatch(leads) {
    const results = leads.map(lead => {
      const siteScore = lead.siteScore ?? lead.score ?? null;
      return this.qualify(lead, siteScore);
    });

    const qualified = results.filter(r => r.qualified);
    const disqualified = results.filter(r => !r.qualified);

    // Sort by priority (descending) then by score (ascending - lower is better)
    qualified.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // If same priority, sort by score (lower score = better target)
      const scoreA = a.checks.siteScore ?? 100;
      const scoreB = b.checks.siteScore ?? 100;
      return scoreA - scoreB;
    });

    const stats = {
      total: leads.length,
      qualified: qualified.length,
      disqualified: disqualified.length,
      byClassification: {
        prime_target: qualified.filter(r => r.classification === 'prime_target').length,
        target: qualified.filter(r => r.classification === 'target').length,
        weak_target: qualified.filter(r => r.classification === 'weak_target').length
      },
      disqualifyReasons: {}
    };

    // Count disqualification reasons
    for (const r of disqualified) {
      const reason = r.disqualifyReason || 'unknown';
      stats.disqualifyReasons[reason] = (stats.disqualifyReasons[reason] || 0) + 1;
    }

    log.info('Batch qualification complete', stats);

    return {
      qualified: qualified.map(r => ({ ...r.lead, qualification: r })),
      disqualified: disqualified.map(r => ({ ...r.lead, qualification: r })),
      stats
    };
  }

  /**
   * Validate business has a real website (not social media)
   * @param {Object} lead - Lead data
   * @returns {Object} - Validation result
   */
  validateBusiness(lead) {
    if (!lead.website) {
      return { valid: false, reason: 'No website' };
    }

    try {
      const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
      const hostname = url.hostname.toLowerCase();

      // Check for social media domains
      for (const social of SOCIAL_DOMAINS) {
        if (hostname === social || hostname.endsWith(`.${social}`)) {
          return { valid: false, reason: `Social media site: ${social}` };
        }
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * Validate lead has contact information
   * @param {Object} lead - Lead data
   * @returns {Object} - Contact validation result
   */
  validateContact(lead) {
    const hasEmail = Boolean(lead.email && lead.email.includes('@'));
    const hasPhone = Boolean(lead.phone && lead.phone.length >= 7);

    return {
      hasContact: hasEmail || hasPhone,
      hasEmail,
      hasPhone
    };
  }

  /**
   * Validate lead is in a target market
   * @param {Object} lead - Lead data
   * @returns {Object} - Market validation result
   */
  validateMarket(lead) {
    const address = (lead.address || '').toLowerCase();
    const detectedMarkets = [];

    for (const marketCode of this.options.targetMarkets) {
      const market = MARKETS[marketCode];
      if (!market) continue;

      // Check address patterns
      const inMarket = market.patterns.some(pattern =>
        address.includes(pattern.toLowerCase())
      ) || market.regions.some(region =>
        address.includes(region.toLowerCase())
      );

      if (inMarket) {
        detectedMarkets.push(marketCode);
      }
    }

    return {
      inTargetMarket: detectedMarkets.length > 0,
      markets: detectedMarkets
    };
  }

  /**
   * Classify a site score into target categories
   * @param {number} score - Site score (0-100)
   * @returns {string} - Classification name
   */
  classifyScore(score) {
    if (score < this.options.primeTargetScore) {
      return CLASSIFICATIONS.PRIME_TARGET.name;
    }
    if (score < this.options.maxTargetScore) {
      return CLASSIFICATIONS.TARGET.name;
    }
    if (score < 80) {
      return CLASSIFICATIONS.WEAK_TARGET.name;
    }
    return CLASSIFICATIONS.SKIP.name;
  }

  /**
   * Get priority for a classification
   * @param {string} classification - Classification name
   * @returns {number} - Priority value
   */
  getPriority(classification) {
    const match = Object.values(CLASSIFICATIONS).find(c => c.name === classification);
    return match ? match.priority : 0;
  }
}

// Export constants for use elsewhere
export { MARKETS, CLASSIFICATIONS, SOCIAL_DOMAINS };

export default LeadQualifier;
