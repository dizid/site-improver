// src/headlineFormulas.js
// Proven headline formulas based on direct response copywriting principles
// These patterns consistently convert - backed by decades of marketing data

import { extractCity } from './utils.js';

/**
 * Headline formula categories with templates
 * Each template uses {{placeholder}} syntax for variable substitution
 */
export const HEADLINE_FORMULAS = {
  // === YEARS IN BUSINESS (trust through longevity) ===
  yearsInBusiness: [
    '{{years}}+ Years of {{industry}} Excellence in {{city}}',
    'Serving {{city}} for {{years}}+ Years',
    '{{city}}\'s Trusted {{industry}} Since {{foundedYear}}',
    '{{years}} Years. {{customerCount}}+ Happy Customers. One Mission.',
    'Family-Owned {{industry}} Serving {{city}} Since {{foundedYear}}',
    '{{years}}+ Years Experience. Same-Day Service. Fair Prices.',
    'Still Going Strong After {{years}} Years in {{city}}'
  ],

  // === CUSTOMER COUNT (social proof) ===
  customerCount: [
    '{{customerCount}}+ {{city}} Families Trust Us',
    'Join {{customerCount}}+ Satisfied Customers',
    'Why {{customerCount}}+ {{city}} Residents Choose {{businessName}}',
    '{{customerCount}} Happy Customers Can\'t Be Wrong',
    'Trusted by {{customerCount}}+ Homeowners in {{city}}'
  ],

  // === RATINGS/REVIEWS (social proof) ===
  ratings: [
    '{{rating}}-Star {{industry}} Service in {{city}}',
    '{{reviewCount}}+ 5-Star Reviews - See Why {{city}} Trusts Us',
    '{{city}}\'s Highest-Rated {{industry}} ({{reviewCount}}+ Reviews)',
    'Rated {{rating}}/5 by {{reviewCount}} {{city}} Customers',
    '{{reviewCount}} Reviews. {{rating}} Stars. One Clear Choice.'
  ],

  // === GUARANTEES (risk reversal) ===
  guarantees: [
    '{{guarantee}} - Or Your Money Back',
    '{{guarantee}} Guaranteed',
    'We Promise: {{guarantee}}',
    '{{industry}} Service with a {{guarantee}} Guarantee',
    '{{guarantee}}. No Exceptions. No Excuses.'
  ],

  // === CERTIFICATIONS/CREDENTIALS (authority) ===
  certifications: [
    '{{certification}} {{industry}} Professionals',
    'Licensed. Insured. {{certification}}.',
    '{{city}}\'s Only {{certification}} {{industry}}',
    '{{certification}} Experts at Your Service',
    'Trust the {{certification}} Difference'
  ],

  // === PROBLEM-SOLUTION (pain point) ===
  problemSolution: [
    'Tired of Unreliable {{industry}}? We\'re Different.',
    'Stop Overpaying for {{industry}} in {{city}}',
    'Finally, {{industry}} Service That Shows Up On Time',
    'No More {{painPoint}}. No More Excuses.',
    '{{painPoint}}? We Fix That. Fast.',
    'Worried About {{painPoint}}? We\'ve Got You Covered.'
  ],

  // === LOCAL AUTHORITY (geographic trust) ===
  localAuthority: [
    '{{city}}\'s Most Recommended {{industry}}',
    'Your Neighbors\' Go-To {{industry}} in {{city}}',
    '{{neighborhood}}\'s Trusted {{industry}} for {{years}}+ Years',
    '{{industry}} by {{city}} Locals, for {{city}} Locals',
    'The {{industry}} {{city}} Recommends Most'
  ],

  // === SPEED/CONVENIENCE (urgency benefit) ===
  speedConvenience: [
    'Same-Day {{industry}} Service in {{city}}',
    '{{industry}} Help in {{city}} - Fast',
    'Call Now, We\'re There Today',
    '24/7 {{industry}} When You Need It Most',
    'Emergency {{industry}}? We Arrive in Under an Hour.'
  ],

  // === BENEFIT-FOCUSED (what they get) ===
  benefitFocused: [
    'Peace of Mind for {{city}} Homeowners',
    'Sleep Easy Knowing Your {{asset}} is Protected',
    'The {{industry}} Service That Actually Calls Back',
    'Fair Prices. Honest Work. Real Results.',
    'Professional {{industry}} Without the Professional Prices'
  ],

  // === QUESTION FORMAT (engagement) ===
  question: [
    'Need a {{industry}} You Can Actually Trust?',
    'Looking for Reliable {{industry}} in {{city}}?',
    'Why Do {{customerCount}}+ {{city}} Families Choose Us?',
    'What Makes {{businessName}} Different?',
    'Ready to Stop Worrying About Your {{asset}}?'
  ],

  // === GENERIC FALLBACK (when no trust signals) ===
  generic: [
    'Professional {{industry}} in {{city}}',
    '{{industry}} Done Right in {{city}}',
    'Your {{city}} {{industry}} Experts',
    'Reliable {{industry}} for {{city}} Homes',
    '{{industry}} Service {{city}} Can Count On'
  ]
};

/**
 * Industry-specific pain points for problem-solution headlines
 */
const INDUSTRY_PAIN_POINTS = {
  plumber: ['leaky pipes', 'clogged drains', 'high water bills', 'no hot water', 'plumbing emergencies'],
  electrician: ['flickering lights', 'old wiring', 'power outages', 'high electric bills', 'safety concerns'],
  hvac: ['no A/C in summer', 'heating breakdowns', 'high energy bills', 'uneven temperatures', 'poor air quality'],
  roofing: ['roof leaks', 'storm damage', 'missing shingles', 'insurance headaches', 'aging roof'],
  lawyer: ['legal uncertainty', 'mounting bills', 'confusing paperwork', 'unresponsive attorneys', 'case delays'],
  dentist: ['dental anxiety', 'tooth pain', 'embarrassing smile', 'insurance confusion', 'long wait times'],
  restaurant: ['boring meals', 'inconsistent food', 'slow service', 'lack of options', 'overpriced dining'],
  'real-estate': ['home search stress', 'market confusion', 'bidding wars', 'paperwork nightmares', 'bad agents'],
  'home-services': ['unreliable contractors', 'hidden fees', 'no-show appointments', 'shoddy work', 'no callbacks'],
  landscaping: ['overgrown yard', 'brown grass', 'curb appeal', 'no time for yard work', 'drainage issues'],
  cleaning: ['messy house', 'no time to clean', 'dust and allergens', 'inconsistent cleaners', 'harsh chemicals'],
  auto: ['car troubles', 'unexpected repairs', 'dealership prices', 'no loaner car', 'long wait times'],
  insurance: ['confusing policies', 'high premiums', 'denied claims', 'poor coverage', 'unresponsive agents'],
  accountant: ['tax stress', 'IRS worries', 'missed deductions', 'disorganized finances', 'audit fears']
};

/**
 * Industry-specific assets (what customers want to protect/improve)
 */
const INDUSTRY_ASSETS = {
  plumber: 'plumbing',
  electrician: 'electrical system',
  hvac: 'home comfort',
  roofing: 'roof',
  lawyer: 'case',
  dentist: 'smile',
  restaurant: 'dining experience',
  'real-estate': 'home search',
  'home-services': 'home',
  landscaping: 'yard',
  cleaning: 'home',
  auto: 'vehicle',
  insurance: 'coverage',
  accountant: 'finances'
};

/**
 * Select the best headline formula based on available trust signals
 * @param {Object} trustSignals - Trust signals from scraped data
 * @param {Object} context - Business context (city, industry, businessName)
 * @returns {Object} Selected formula category and templates
 */
export function selectBestFormula(trustSignals, context) {
  const available = [];

  // Check what trust signals we have
  if (trustSignals?.yearsInBusiness && trustSignals.yearsInBusiness >= 5) {
    available.push({
      category: 'yearsInBusiness',
      priority: trustSignals.yearsInBusiness >= 15 ? 10 : 8,
      data: { years: trustSignals.yearsInBusiness, foundedYear: trustSignals.foundedYear }
    });
  }

  if (trustSignals?.customerCount && trustSignals.customerCount >= 100) {
    available.push({
      category: 'customerCount',
      priority: trustSignals.customerCount >= 1000 ? 9 : 7,
      data: { customerCount: formatNumber(trustSignals.customerCount) }
    });
  }

  if (trustSignals?.rating && trustSignals.rating >= 4.5 && trustSignals?.reviewCount >= 20) {
    available.push({
      category: 'ratings',
      priority: trustSignals.reviewCount >= 100 ? 10 : 8,
      data: { rating: trustSignals.rating, reviewCount: trustSignals.reviewCount }
    });
  }

  if (trustSignals?.guarantees?.length > 0) {
    available.push({
      category: 'guarantees',
      priority: 7,
      data: { guarantee: trustSignals.guarantees[0] }
    });
  }

  if (trustSignals?.certifications?.length > 0) {
    available.push({
      category: 'certifications',
      priority: 6,
      data: { certification: trustSignals.certifications[0] }
    });
  }

  // Always available options
  available.push({
    category: 'localAuthority',
    priority: 5,
    data: {}
  });

  available.push({
    category: 'speedConvenience',
    priority: 4,
    data: {}
  });

  available.push({
    category: 'problemSolution',
    priority: 6,
    data: { painPoint: getRandomPainPoint(context.industry) }
  });

  available.push({
    category: 'benefitFocused',
    priority: 5,
    data: { asset: INDUSTRY_ASSETS[context.industry] || 'home' }
  });

  // Sort by priority (highest first)
  available.sort((a, b) => b.priority - a.priority);

  // Return top 3 options for variety
  return available.slice(0, 3);
}

/**
 * Generate a headline from a formula template
 * @param {string} template - Template with {{placeholders}}
 * @param {Object} context - All available data for substitution
 * @returns {string} Generated headline
 */
export function generateFromTemplate(template, context) {
  let headline = template;

  const substitutions = {
    years: context.years || context.yearsInBusiness || '10',
    foundedYear: context.foundedYear || (new Date().getFullYear() - (context.years || 10)),
    customerCount: context.customerCount || '500',
    rating: context.rating || '5',
    reviewCount: context.reviewCount || '50',
    guarantee: context.guarantee || 'Satisfaction',
    certification: context.certification || 'Certified',
    painPoint: context.painPoint || 'unreliable service',
    asset: context.asset || 'home',
    city: context.city || 'Your Area',
    neighborhood: context.neighborhood || context.city || 'Your Area',
    industry: formatIndustry(context.industry) || 'Service',
    businessName: context.businessName || 'Our Team'
  };

  // Replace all placeholders
  for (const [key, value] of Object.entries(substitutions)) {
    headline = headline.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return headline;
}

/**
 * Generate multiple headline options based on trust signals
 * @param {Object} siteData - Scraped site data
 * @param {string} industry - Industry type
 * @returns {Array} Array of generated headlines with metadata
 */
export function generateHeadlineOptions(siteData, industry) {
  const trustSignals = siteData.trustSignals || {};
  const city = extractCity(siteData.address) || siteData.city;

  const context = {
    ...trustSignals,
    city,
    industry,
    businessName: siteData.businessName,
    rating: siteData.rating,
    reviewCount: siteData.reviewCount
  };

  // Get best formula categories
  const bestFormulas = selectBestFormula(trustSignals, context);
  const headlines = [];

  // Generate headlines from each selected category
  for (const formula of bestFormulas) {
    const templates = HEADLINE_FORMULAS[formula.category] || HEADLINE_FORMULAS.generic;
    const mergedContext = { ...context, ...formula.data };

    // Pick 2 random templates from the category
    const shuffled = [...templates].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);

    for (const template of selected) {
      headlines.push({
        text: generateFromTemplate(template, mergedContext),
        category: formula.category,
        priority: formula.priority,
        template
      });
    }
  }

  // Sort by priority and return top options
  return headlines
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

/**
 * Format a number for display (e.g., 1500 -> "1,500")
 */
function formatNumber(num) {
  if (num >= 1000) {
    return Math.round(num / 100) * 100; // Round to nearest hundred
  }
  return num;
}

/**
 * Format industry name for display
 */
function formatIndustry(industry) {
  if (!industry) return 'Service';

  const displayNames = {
    plumber: 'Plumbing',
    electrician: 'Electrical',
    hvac: 'HVAC',
    roofing: 'Roofing',
    lawyer: 'Legal',
    dentist: 'Dental',
    restaurant: 'Dining',
    'real-estate': 'Real Estate',
    'home-services': 'Home Service',
    landscaping: 'Landscaping',
    cleaning: 'Cleaning',
    auto: 'Auto Repair',
    insurance: 'Insurance',
    accountant: 'Accounting'
  };

  return displayNames[industry] || industry.charAt(0).toUpperCase() + industry.slice(1);
}

/**
 * Get a random pain point for an industry
 */
function getRandomPainPoint(industry) {
  const painPoints = INDUSTRY_PAIN_POINTS[industry] || ['unreliable service', 'hidden fees', 'poor communication'];
  return painPoints[Math.floor(Math.random() * painPoints.length)];
}

/**
 * Validate a headline against formula best practices
 */
export function validateAgainstFormulas(headline, context) {
  const issues = [];
  const strengths = [];

  // Check for specificity signals
  const hasNumber = /\d+/.test(headline);
  const hasCity = context.city && headline.toLowerCase().includes(context.city.toLowerCase());
  const hasIndustry = context.industry && headline.toLowerCase().includes(formatIndustry(context.industry).toLowerCase());

  if (hasNumber) strengths.push('Contains specific number');
  if (hasCity) strengths.push('Mentions location');
  if (hasIndustry) strengths.push('References industry');

  // Check for weak patterns
  const weakPatterns = [
    { pattern: /^we\s/i, issue: 'Starts with "we" - make it about the customer' },
    { pattern: /quality\s+service/i, issue: 'Uses "quality service" - too generic' },
    { pattern: /your\s+(?:trusted|local)\s+/i, issue: 'Uses generic trust language' }
  ];

  for (const { pattern, issue } of weakPatterns) {
    if (pattern.test(headline)) {
      issues.push(issue);
    }
  }

  return {
    isStrong: issues.length === 0 && strengths.length >= 2,
    issues,
    strengths,
    score: Math.max(0, 100 - (issues.length * 20) + (strengths.length * 10))
  };
}

export default {
  HEADLINE_FORMULAS,
  selectBestFormula,
  generateFromTemplate,
  generateHeadlineOptions,
  validateAgainstFormulas
};
