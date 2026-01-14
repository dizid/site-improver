// src/smartFallbacks.js
// Smart fallback content that uses scraped data + industry templates
import { getIndustryContent } from './industryContent.js';
import { extractCity } from './utils.js';
import logger from './logger.js';

const log = logger.child('smartFallbacks');

/**
 * Industry-specific headline templates with placeholders
 * Uses {{city}}, {{businessName}}, {{yearsInBusiness}}
 */
const HEADLINE_TEMPLATES = {
  plumber: [
    '{{yearsInBusiness}}+ Years Serving {{city}}',
    '24/7 Plumbing Service in {{city}}',
    'Licensed Plumber • {{city}}',
    '{{businessName}} — Your Local Plumber'
  ],
  electrician: [
    'Licensed Electrician in {{city}}',
    '{{yearsInBusiness}}+ Years of Safe Wiring',
    '{{businessName}} — Electrical Experts',
    'Code-Compliant Electrical Service'
  ],
  hvac: [
    '24/7 HVAC Service in {{city}}',
    'Heating & Cooling • {{yearsInBusiness}}+ Years',
    '{{businessName}} — Stay Comfortable',
    'NATE Certified HVAC Technicians'
  ],
  roofing: [
    'Storm Damage Experts in {{city}}',
    '{{yearsInBusiness}}+ Years Protecting Homes',
    '{{businessName}} — Roofing Done Right',
    'Free Roof Inspections • {{city}}'
  ],
  'home-services': [
    'Trusted Home Services in {{city}}',
    '{{yearsInBusiness}}+ Years of Quality Work',
    '{{businessName}} — Done Right',
    'Licensed • Insured • {{city}}'
  ],
  dentist: [
    'Gentle Dental Care in {{city}}',
    '{{businessName}} — Family Dentistry',
    'Modern Dentistry • Caring Team',
    'Your {{city}} Dentist'
  ],
  lawyer: [
    'Experienced Attorneys in {{city}}',
    '{{businessName}} — Fighting for You',
    'Free Consultation • {{city}}',
    '{{yearsInBusiness}}+ Years of Legal Experience'
  ],
  'real-estate': [
    'Your {{city}} Real Estate Expert',
    '{{businessName}} — Local Market Specialist',
    'Find Your Dream Home in {{city}}',
    '{{yearsInBusiness}}+ Years in {{city}} Real Estate'
  ],
  restaurant: [
    'Authentic Dining in {{city}}',
    '{{businessName}} — Taste the Difference',
    'Fresh. Local. Delicious.',
    'Welcome to {{businessName}}'
  ],
  auto: [
    'Honest Auto Repair in {{city}}',
    '{{businessName}} — Mechanics You Can Trust',
    '{{yearsInBusiness}}+ Years Serving {{city}}',
    'ASE Certified • Fair Prices'
  ],
  cleaning: [
    'Professional Cleaning in {{city}}',
    '{{businessName}} — Spotless Results',
    'Trusted Cleaning Service • {{city}}',
    'Your Home, Professionally Cleaned'
  ],
  general: [
    '{{businessName}} — {{city}}',
    'Quality Service You Can Trust',
    'Serving {{city}} Since {{foundedYear}}',
    'Local Business, Personal Service'
  ]
};

/**
 * Industry-specific services with icons
 */
const FALLBACK_SERVICES = {
  plumber: [
    { name: 'Emergency Repairs', description: '24/7 response for leaks and bursts', icon: 'clock' },
    { name: 'Drain Cleaning', description: 'Clear clogs with professional equipment', icon: 'wrench' },
    { name: 'Water Heaters', description: 'Installation, repair & maintenance', icon: 'zap' },
    { name: 'Pipe Repair', description: 'Fix leaks and replace damaged pipes', icon: 'tool' }
  ],
  electrician: [
    { name: 'Electrical Repairs', description: 'Fast fixes for any electrical issue', icon: 'zap' },
    { name: 'Panel Upgrades', description: 'Modern panels for safety & capacity', icon: 'shield' },
    { name: 'Lighting', description: 'Indoor, outdoor & recessed lighting', icon: 'lightbulb' },
    { name: 'Safety Inspections', description: 'Ensure your home is code-compliant', icon: 'check' }
  ],
  hvac: [
    { name: 'AC Repair', description: 'Fast cooling when you need it most', icon: 'thermometer' },
    { name: 'Heating Service', description: 'Keep warm all winter long', icon: 'flame' },
    { name: 'Maintenance Plans', description: 'Prevent breakdowns before they happen', icon: 'calendar' },
    { name: 'New Installations', description: 'Energy-efficient system upgrades', icon: 'zap' }
  ],
  roofing: [
    { name: 'Roof Repair', description: 'Stop leaks and fix damage fast', icon: 'tool' },
    { name: 'Roof Replacement', description: 'Quality materials, expert installation', icon: 'home' },
    { name: 'Storm Damage', description: 'Insurance claim assistance included', icon: 'shield' },
    { name: 'Free Inspections', description: 'Know the state of your roof', icon: 'search' }
  ],
  dentist: [
    { name: 'Cleanings & Checkups', description: 'Preventive care for healthy smiles', icon: 'check' },
    { name: 'Cosmetic Dentistry', description: 'Whitening, veneers & more', icon: 'star' },
    { name: 'Restorative Care', description: 'Crowns, bridges & implants', icon: 'tool' },
    { name: 'Emergency Dental', description: 'Same-day care when you need it', icon: 'clock' }
  ],
  lawyer: [
    { name: 'Free Consultation', description: 'Discuss your case with no obligation', icon: 'phone' },
    { name: 'Case Evaluation', description: 'Understand your options and rights', icon: 'search' },
    { name: 'Legal Representation', description: 'Experienced advocates in your corner', icon: 'shield' },
    { name: 'Negotiation', description: 'Fight for the best possible outcome', icon: 'check' }
  ],
  'real-estate': [
    { name: 'Home Search', description: 'Find your perfect property', icon: 'search' },
    { name: 'Market Analysis', description: 'Know the true value', icon: 'chart' },
    { name: 'Negotiation', description: 'Get the best possible deal', icon: 'check' },
    { name: 'Closing Support', description: 'Smooth transactions start to finish', icon: 'shield' }
  ],
  restaurant: [
    { name: 'Dine In', description: 'Cozy atmosphere, exceptional food', icon: 'home' },
    { name: 'Takeout', description: 'Fresh food ready when you are', icon: 'clock' },
    { name: 'Catering', description: 'Events of all sizes', icon: 'users' },
    { name: 'Reservations', description: 'Book your table today', icon: 'calendar' }
  ],
  'home-services': [
    { name: 'Repairs', description: 'Quality fixes that last', icon: 'tool' },
    { name: 'Installation', description: 'Professional setup done right', icon: 'check' },
    { name: 'Maintenance', description: 'Keep everything running smoothly', icon: 'calendar' },
    { name: 'Consultation', description: 'Expert advice for your project', icon: 'phone' }
  ],
  general: [
    { name: 'Consultation', description: 'Discuss your needs with our team', icon: 'phone' },
    { name: 'Service', description: 'Quality work you can count on', icon: 'check' },
    { name: 'Support', description: 'Here when you need us', icon: 'users' },
    { name: 'Follow-up', description: 'Ensuring your satisfaction', icon: 'star' }
  ]
};

/**
 * Industry-specific "Why Choose Us" points
 */
const FALLBACK_WHY_US = {
  plumber: [
    { title: 'Licensed & Insured', description: 'Full protection for you and your property', icon: 'shield' },
    { title: '24/7 Emergency', description: 'We answer when you need us most', icon: 'clock' },
    { title: 'Upfront Pricing', description: 'No surprises on your bill', icon: 'check' },
    { title: 'Satisfaction Guaranteed', description: 'We\'re not done until you\'re happy', icon: 'star' }
  ],
  electrician: [
    { title: 'Fully Licensed', description: 'Code-compliant work guaranteed', icon: 'shield' },
    { title: 'Safety First', description: 'Your family\'s protection is our priority', icon: 'check' },
    { title: 'Clean Workmanship', description: 'We leave your home spotless', icon: 'star' },
    { title: 'Warranty Included', description: 'Peace of mind on every job', icon: 'zap' }
  ],
  hvac: [
    { title: 'NATE Certified', description: 'Industry-leading technicians', icon: 'shield' },
    { title: '24/7 Service', description: 'Comfort emergencies don\'t wait', icon: 'clock' },
    { title: 'Energy Savings', description: 'Lower bills with efficient systems', icon: 'zap' },
    { title: 'Maintenance Plans', description: 'Prevent costly breakdowns', icon: 'calendar' }
  ],
  dentist: [
    { title: 'Gentle Approach', description: 'Comfortable care for anxious patients', icon: 'heart' },
    { title: 'Modern Technology', description: 'Latest equipment for better results', icon: 'zap' },
    { title: 'Insurance Accepted', description: 'We work with your provider', icon: 'check' },
    { title: 'Family Friendly', description: 'Care for patients of all ages', icon: 'users' }
  ],
  lawyer: [
    { title: 'Free Consultation', description: 'No cost to discuss your case', icon: 'phone' },
    { title: 'Experienced Team', description: 'Decades of combined experience', icon: 'shield' },
    { title: 'Personalized Service', description: 'You\'re not just a case number', icon: 'users' },
    { title: 'Results Driven', description: 'We fight for the best outcome', icon: 'star' }
  ],
  'home-services': [
    { title: 'Licensed & Bonded', description: 'Full protection on every job', icon: 'shield' },
    { title: 'On-Time Guarantee', description: 'We respect your schedule', icon: 'clock' },
    { title: 'Quality Work', description: 'Craftsmanship you can trust', icon: 'star' },
    { title: 'Fair Pricing', description: 'Honest quotes, no surprises', icon: 'check' }
  ],
  general: [
    { title: 'Trusted & Reliable', description: 'Count on us to deliver', icon: 'shield' },
    { title: 'Customer Focused', description: 'Your satisfaction is our priority', icon: 'star' },
    { title: 'Local Business', description: 'Invested in our community', icon: 'home' },
    { title: 'Quality Service', description: 'Excellence in everything we do', icon: 'check' }
  ]
};

/**
 * Interpolate template placeholders with actual data
 */
function interpolate(template, data) {
  return template
    .replace(/\{\{city\}\}/g, data.city || 'your area')
    .replace(/\{\{businessName\}\}/g, data.businessName || 'Our Team')
    .replace(/\{\{yearsInBusiness\}\}/g, data.yearsInBusiness || '10')
    .replace(/\{\{foundedYear\}\}/g, data.foundedYear || '2010');
}

/**
 * Select best headline based on available trust signals
 */
function selectBestHeadline(templates, data) {
  // Prefer templates that use available data
  if (data.yearsInBusiness) {
    const withYears = templates.find(t => t.includes('{{yearsInBusiness}}'));
    if (withYears) return withYears;
  }
  if (data.city && data.city !== 'your area') {
    const withCity = templates.find(t => t.includes('{{city}}'));
    if (withCity) return withCity;
  }
  // Default to first template
  return templates[0];
}

/**
 * Generate smart fallbacks for a site based on scraped data and industry
 * @param {Object} siteData - Scraped site data
 * @param {string} industry - Detected industry
 * @returns {Object} Fallback content for slots
 */
export function resolveSmartFallbacks(siteData, industry = 'general') {
  const normalizedIndustry = industry.toLowerCase();
  const content = getIndustryContent(normalizedIndustry);

  // Extract key data points
  const trust = siteData.trustSignals || {};
  const data = {
    city: extractCity(siteData.address) || siteData.country || '',
    businessName: siteData.businessName || 'Our Team',
    yearsInBusiness: trust.yearsInBusiness,
    foundedYear: trust.foundedYear
  };

  // Get industry-specific templates or fall back to general
  const headlineTemplates = HEADLINE_TEMPLATES[normalizedIndustry] || HEADLINE_TEMPLATES.general;
  const services = FALLBACK_SERVICES[normalizedIndustry] || FALLBACK_SERVICES.general;
  const whyUs = FALLBACK_WHY_US[normalizedIndustry] || FALLBACK_WHY_US.general;

  // Select and interpolate headline
  const headlineTemplate = selectBestHeadline(headlineTemplates, data);
  const headline = interpolate(headlineTemplate, data);

  // Select subheadline from benefits
  const subheadline = content.benefits?.[0] || 'Quality service you can count on';

  // Get CTA from industry content
  const cta = content.ctaOptions?.[0] || 'Get Started';

  log.debug('Generated smart fallbacks', { industry: normalizedIndustry, headline, hasCity: !!data.city });

  return {
    headline,
    subheadline,
    cta_text: cta,
    services,
    why_us_points: whyUs,
    // Additional useful fallbacks
    section_services: `Our ${normalizedIndustry === 'general' ? '' : normalizedIndustry + ' '}Services`,
    services_subtitle: content.benefits?.[1] || 'Professional service tailored to your needs'
  };
}

/**
 * Check if a value is empty or placeholder-like
 */
export function isEmptyOrPlaceholder(value) {
  if (!value) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower.includes('quality service') ||
           lower.includes('lorem ipsum') ||
           lower.includes('placeholder') ||
           lower === 'unknown' ||
           value.length < 5;
  }
  return false;
}

export default {
  resolveSmartFallbacks,
  isEmptyOrPlaceholder,
  HEADLINE_TEMPLATES,
  FALLBACK_SERVICES,
  FALLBACK_WHY_US
};
