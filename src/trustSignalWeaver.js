// src/trustSignalWeaver.js
// Trust Signal Integration - Weave trust signals naturally into website content
// Converts raw trust data into compelling copy

import logger from './logger.js';

const log = logger.child('trustSignalWeaver');

/**
 * Trust signal patterns for different content locations
 * Each pattern shows how to integrate a trust signal type
 */
const TRUST_PATTERNS = {
  // Years in business patterns
  yearsInBusiness: {
    headline: [
      '{{years}}+ Years Serving {{city}}',
      'Trusted Since {{foundedYear}}',
      '{{years}} Years of Excellence in {{city}}',
      '{{city}}\'s Choice for {{years}}+ Years'
    ],
    subheadline: [
      'Serving {{city}} families for over {{years}} years',
      '{{years}}+ years of experience you can trust',
      'Proudly serving {{city}} since {{foundedYear}}'
    ],
    badge: [
      '{{years}}+ Years',
      'Est. {{foundedYear}}',
      'Serving Since {{foundedYear}}'
    ],
    whyUs: {
      title: '{{years}}+ Years Experience',
      description: 'Serving {{city}} since {{foundedYear}}. We\'ve seen it all and fixed it all.'
    }
  },

  // Customer count patterns
  customerCount: {
    headline: [
      '{{customerCount}}+ Happy Customers',
      'Trusted by {{customerCount}}+ Families',
      'Join {{customerCount}}+ Satisfied Customers'
    ],
    subheadline: [
      'Over {{customerCount}} {{city}} families trust us',
      'Join {{customerCount}}+ satisfied customers',
      '{{customerCount}}+ jobs completed with excellence'
    ],
    badge: [
      '{{customerCount}}+ Served',
      '{{customerCount}}+ Happy Customers'
    ],
    whyUs: {
      title: '{{customerCount}}+ Customers Served',
      description: 'We\'ve earned the trust of {{customerCount}}+ local families. You\'re in good company.'
    }
  },

  // Rating/reviews patterns
  rating: {
    headline: [
      '{{rating}}-Star Rated Service',
      '{{reviewCount}} 5-Star Reviews',
      '{{city}}\'s Highest-Rated {{industry}}'
    ],
    subheadline: [
      'Rated {{rating}}/5 by {{reviewCount}} customers',
      'See why {{reviewCount}} customers gave us 5 stars',
      '{{rating}} stars from {{reviewCount}} verified reviews'
    ],
    badge: [
      '{{rating}} ★ Rated',
      '{{reviewCount}}+ Reviews'
    ],
    whyUs: {
      title: '{{rating}}-Star Average Rating',
      description: '{{reviewCount}}+ verified reviews. Our reputation speaks for itself.'
    }
  },

  // Certifications patterns
  certifications: {
    headline: [
      '{{certification}} Professionals',
      '{{certification}} Certified',
      'Licensed {{certification}} Experts'
    ],
    subheadline: [
      '{{certification}} certified professionals you can trust',
      'Fully certified: {{certificationList}}',
      'Trained, tested, and {{certification}} certified'
    ],
    badge: [
      '{{certification}} Certified',
      '{{certification}}'
    ],
    whyUs: {
      title: '{{certification}} Certified',
      description: 'Our team holds {{certification}} certification. You get trained professionals every time.'
    }
  },

  // Licenses patterns
  licenses: {
    headline: [
      'Licensed & Insured',
      'License #{{license}}',
      'Fully Licensed Professionals'
    ],
    subheadline: [
      'Licensed (#{{license}}), bonded, and insured',
      'Fully licensed and insured for your protection',
      'License #{{license}} - your guarantee of quality'
    ],
    badge: [
      'Licensed #{{license}}',
      'Licensed & Insured'
    ],
    whyUs: {
      title: 'Licensed & Insured',
      description: 'License #{{license}}. Fully bonded and insured. Your home is protected.'
    }
  },

  // Guarantees patterns
  guarantees: {
    headline: [
      '{{guarantee}} Guaranteed',
      '{{guarantee}} or Your Money Back',
      'Our Promise: {{guarantee}}'
    ],
    subheadline: [
      '{{guarantee}} guaranteed on every job',
      'We stand behind our {{guarantee}} promise',
      'Not satisfied? {{guarantee}} or it\'s free'
    ],
    badge: [
      '{{guarantee}} Guarantee',
      '{{guarantee}}'
    ],
    whyUs: {
      title: '{{guarantee}} Guaranteed',
      description: 'We back every job with our {{guarantee}} guarantee. No exceptions.'
    }
  },

  // Awards patterns
  awards: {
    headline: [
      'Award-Winning {{industry}}',
      '{{award}} Winner',
      '{{city}}\'s Award-Winning Choice'
    ],
    subheadline: [
      'Proud recipient of {{award}}',
      'Award-winning service recognized by {{award}}',
      '{{award}} - recognized for excellence'
    ],
    badge: [
      '{{award}}',
      'Award Winner'
    ],
    whyUs: {
      title: '{{award}}',
      description: 'Recognized for excellence. Award-winning service you can count on.'
    }
  },

  // Service areas patterns
  serviceAreas: {
    headline: [
      '{{primaryArea}}\'s Trusted {{industry}}',
      'Serving {{areaList}}',
      '{{primaryArea}} & Surrounding Areas'
    ],
    subheadline: [
      'Proudly serving {{areaList}} and surrounding communities',
      'Local service for {{primaryArea}} and nearby areas',
      'From {{primaryArea}} to {{secondaryArea}} and beyond'
    ],
    badge: [
      '{{primaryArea}} Area',
      'Local Service'
    ],
    whyUs: {
      title: 'Local to {{primaryArea}}',
      description: 'We live and work here too. Serving {{areaList}} with pride.'
    }
  }
};

/**
 * Weave trust signals into content
 * @param {Object} trustSignals - Raw trust signals from scraper
 * @param {Object} context - Business context (city, industry, etc.)
 * @returns {Object} Content enhanced with trust signals
 */
export function weaveTrustSignals(trustSignals, context) {
  if (!trustSignals) return {};

  const woven = {
    headlineOptions: [],
    subheadlineOptions: [],
    badges: [],
    whyUsItems: []
  };

  const city = context.city || 'your area';
  const industry = formatIndustryName(context.industry);

  // Process each available trust signal
  if (trustSignals.yearsInBusiness) {
    const foundedYear = trustSignals.foundedYear ||
      (new Date().getFullYear() - trustSignals.yearsInBusiness);

    const vars = {
      years: trustSignals.yearsInBusiness,
      foundedYear,
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.yearsInBusiness.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.yearsInBusiness.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.yearsInBusiness.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.yearsInBusiness.whyUs, vars));
  }

  if (trustSignals.customerCount && trustSignals.customerCount >= 50) {
    const vars = {
      customerCount: formatNumber(trustSignals.customerCount),
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.customerCount.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.customerCount.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.customerCount.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.customerCount.whyUs, vars));
  }

  if (trustSignals.rating && trustSignals.rating >= 4.0) {
    const vars = {
      rating: trustSignals.rating,
      reviewCount: trustSignals.reviewCount || '50+',
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.rating.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.rating.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.rating.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.rating.whyUs, vars));
  }

  if (trustSignals.certifications && trustSignals.certifications.length > 0) {
    const vars = {
      certification: trustSignals.certifications[0],
      certificationList: trustSignals.certifications.slice(0, 3).join(', '),
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.certifications.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.certifications.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.certifications.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.certifications.whyUs, vars));
  }

  if (trustSignals.licenses && trustSignals.licenses.length > 0) {
    const vars = {
      license: trustSignals.licenses[0],
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.licenses.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.licenses.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.licenses.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.licenses.whyUs, vars));
  }

  if (trustSignals.guarantees && trustSignals.guarantees.length > 0) {
    const vars = {
      guarantee: trustSignals.guarantees[0],
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.guarantees.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.guarantees.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.guarantees.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.guarantees.whyUs, vars));
  }

  if (trustSignals.awards && trustSignals.awards.length > 0) {
    const vars = {
      award: trustSignals.awards[0],
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.awards.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.awards.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.awards.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.awards.whyUs, vars));
  }

  if (trustSignals.serviceAreas && trustSignals.serviceAreas.length > 0) {
    const vars = {
      primaryArea: trustSignals.serviceAreas[0],
      secondaryArea: trustSignals.serviceAreas[1] || city,
      areaList: trustSignals.serviceAreas.slice(0, 3).join(', '),
      city,
      industry
    };

    woven.headlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.serviceAreas.headline, vars));
    woven.subheadlineOptions.push(...interpolatePatterns(TRUST_PATTERNS.serviceAreas.subheadline, vars));
    woven.badges.push(...interpolatePatterns(TRUST_PATTERNS.serviceAreas.badge, vars));
    woven.whyUsItems.push(interpolateWhyUs(TRUST_PATTERNS.serviceAreas.whyUs, vars));
  }

  return woven;
}

/**
 * Select the strongest trust signal for headline use
 * @param {Object} trustSignals - Raw trust signals
 * @returns {Object} Strongest signal with priority score
 */
export function selectStrongestSignal(trustSignals) {
  if (!trustSignals) return null;

  const signals = [];

  // Score each signal type
  if (trustSignals.yearsInBusiness >= 10) {
    signals.push({
      type: 'yearsInBusiness',
      value: trustSignals.yearsInBusiness,
      priority: trustSignals.yearsInBusiness >= 20 ? 10 : 8
    });
  }

  if (trustSignals.customerCount >= 500) {
    signals.push({
      type: 'customerCount',
      value: trustSignals.customerCount,
      priority: trustSignals.customerCount >= 1000 ? 9 : 7
    });
  }

  if (trustSignals.rating >= 4.5 && trustSignals.reviewCount >= 50) {
    signals.push({
      type: 'rating',
      value: { rating: trustSignals.rating, count: trustSignals.reviewCount },
      priority: trustSignals.reviewCount >= 100 ? 10 : 8
    });
  }

  if (trustSignals.certifications?.length > 0) {
    signals.push({
      type: 'certifications',
      value: trustSignals.certifications[0],
      priority: 7
    });
  }

  if (trustSignals.guarantees?.length > 0) {
    signals.push({
      type: 'guarantees',
      value: trustSignals.guarantees[0],
      priority: 6
    });
  }

  if (trustSignals.awards?.length > 0) {
    signals.push({
      type: 'awards',
      value: trustSignals.awards[0],
      priority: 5
    });
  }

  // Sort by priority and return strongest
  signals.sort((a, b) => b.priority - a.priority);
  return signals[0] || null;
}

/**
 * Auto-generate "Why Us" items from trust signals
 * @param {Object} trustSignals - Raw trust signals
 * @param {Object} context - Business context
 * @returns {Array} Array of Why Us items
 */
export function generateWhyUsFromSignals(trustSignals, context) {
  const woven = weaveTrustSignals(trustSignals, context);
  return woven.whyUsItems.slice(0, 4);
}

/**
 * Generate a trust badge for the hero section
 * @param {Object} trustSignals - Raw trust signals
 * @param {Object} context - Business context
 * @returns {string} Badge text
 */
export function generateHeroBadge(trustSignals, context) {
  const strongest = selectStrongestSignal(trustSignals);

  if (!strongest) {
    return context.city ? `Serving ${context.city}` : 'Local & Trusted';
  }

  const city = context.city || 'your area';

  switch (strongest.type) {
    case 'yearsInBusiness':
      return `${strongest.value}+ Years in ${city}`;
    case 'customerCount':
      return `${formatNumber(strongest.value)}+ Happy Customers`;
    case 'rating':
      return `${strongest.value.rating}★ Rated (${strongest.value.count} Reviews)`;
    case 'certifications':
      return `${strongest.value} Certified`;
    case 'guarantees':
      return `${strongest.value} Guaranteed`;
    case 'awards':
      return strongest.value;
    default:
      return `Trusted in ${city}`;
  }
}

/**
 * Interpolate variables into pattern templates
 */
function interpolatePatterns(patterns, vars) {
  return patterns.map(pattern => {
    let result = pattern;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  });
}

/**
 * Interpolate variables into a Why Us item
 */
function interpolateWhyUs(template, vars) {
  const result = { ...template };
  for (const [key, value] of Object.entries(vars)) {
    result.title = result.title.replace(new RegExp(`{{${key}}}`, 'g'), value);
    result.description = result.description.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * Format number for display
 */
function formatNumber(num) {
  if (num >= 1000) {
    return Math.floor(num / 100) * 100;
  }
  return num;
}

/**
 * Format industry name for display
 */
function formatIndustryName(industry) {
  if (!industry) return 'Service';

  const names = {
    plumber: 'Plumber',
    electrician: 'Electrician',
    hvac: 'HVAC',
    roofing: 'Roofer',
    lawyer: 'Attorney',
    dentist: 'Dentist',
    restaurant: 'Restaurant',
    'real-estate': 'Realtor',
    landscaping: 'Landscaper',
    cleaning: 'Cleaner',
    auto: 'Mechanic',
    insurance: 'Insurance Agent',
    accountant: 'Accountant'
  };

  return names[industry] || industry.charAt(0).toUpperCase() + industry.slice(1);
}

export default {
  weaveTrustSignals,
  selectStrongestSignal,
  generateWhyUsFromSignals,
  generateHeroBadge,
  TRUST_PATTERNS
};
