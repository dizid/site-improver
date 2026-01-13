// src/industryContent.js
// Industry-specific content for AI generation and fallbacks

/**
 * Pain points, benefits, and USPs for each industry
 * Used for AI content generation and fallback templates
 */
export const INDUSTRY_CONTENT = {
  plumber: {
    painPoints: [
      'Emergency leaks causing costly water damage',
      'Contractors who never show up on time',
      'Hidden fees and surprise charges on the final bill',
      'Waiting days for a simple repair',
      'Unlicensed workers doing subpar work'
    ],
    benefits: [
      'Same-day emergency service when you need it most',
      'Upfront, honest pricing with no hidden fees',
      '100% satisfaction guarantee on all work',
      'Licensed, insured, and background-checked technicians',
      'Free estimates before any work begins'
    ],
    usps: [
      'Licensed & Insured',
      '24/7 Emergency Service',
      'Free Estimates',
      'Satisfaction Guaranteed',
      'Local & Family Owned'
    ],
    ctaOptions: [
      'Get a Free Quote',
      'Call Now',
      'Schedule Service',
      'Book Online'
    ],
    testimonialTones: ['relieved', 'grateful', 'impressed'],
    // Industry-specific clichés to avoid
    clichesToAvoid: [
      'draining your worries', 'pipe dreams', 'going with the flow',
      'plumbing solutions', 'water management services',
      'your trusted plumbing partner'
    ],
    // Proven effective phrases for this industry
    powerPhrases: [
      'Fixed right, priced right',
      'Leaks stopped. Drains cleared. Done.',
      'There when you need us',
      'Clean work. Fair prices.',
      'Your pipes are in good hands'
    ]
  },

  electrician: {
    painPoints: [
      'Flickering lights and mysterious electrical issues',
      'Outdated wiring that could be a fire hazard',
      'Waiting weeks for an appointment',
      'Electricians who leave a mess behind',
      'Not knowing if the work is up to code'
    ],
    benefits: [
      'Code-compliant work that passes inspection first time',
      'Clean, respectful technicians who protect your home',
      'Same-week appointments available',
      'Transparent pricing before work begins',
      'Lifetime warranty on all installations'
    ],
    usps: [
      'Fully Licensed',
      'Code Compliant',
      'Free Safety Inspections',
      'Warranty Included',
      '5-Star Rated'
    ],
    ctaOptions: [
      'Get a Quote',
      'Schedule Inspection',
      'Call Now',
      'Book Today'
    ],
    testimonialTones: ['relieved', 'satisfied', 'confident'],
    clichesToAvoid: [
      'electrifying service', 'shocking deals', 'power up your life',
      'electrical solutions', 'current with the times',
      'wired for success'
    ],
    powerPhrases: [
      'Safe wiring. Code compliant. Done right.',
      'Lights on. Worries off.',
      'Your safety is our standard',
      'Inspect. Repair. Protect.',
      'One call fixes it all'
    ]
  },

  restaurant: {
    painPoints: [
      'Tired of the same boring takeout options',
      'Looking for authentic flavors',
      'Hard to find restaurants with fresh ingredients',
      'Want a memorable dining experience',
      'Need reliable catering for events'
    ],
    benefits: [
      'Fresh, locally-sourced ingredients daily',
      'Authentic recipes passed down for generations',
      'Cozy atmosphere perfect for any occasion',
      'Friendly service that makes you feel at home',
      'Full catering service for events and parties'
    ],
    usps: [
      'Fresh Daily',
      'Family Recipes',
      'Online Ordering',
      'Catering Available',
      'Private Events'
    ],
    ctaOptions: [
      'View Menu',
      'Order Online',
      'Make a Reservation',
      'Book a Table'
    ],
    testimonialTones: ['delighted', 'satisfied', 'enthusiastic']
  },

  lawyer: {
    painPoints: [
      'Confusing legal processes with no clear answers',
      'Lawyers who charge by the minute',
      'Feeling unheard during a difficult time',
      'Not understanding your rights and options',
      'Intimidating law firms that treat you like a number'
    ],
    benefits: [
      'Clear, honest communication throughout your case',
      'Free initial consultation with no obligation',
      'Personalized attention from experienced attorneys',
      'Proven track record of successful outcomes',
      'Flexible payment plans available'
    ],
    usps: [
      'Free Consultation',
      'No Win, No Fee',
      'Experienced Team',
      'Confidential',
      'Award Winning'
    ],
    ctaOptions: [
      'Free Consultation',
      'Get Legal Help',
      'Schedule a Call',
      'Contact Us'
    ],
    testimonialTones: ['relieved', 'grateful', 'vindicated']
  },

  'real-estate': {
    painPoints: [
      'Agents who only care about their commission',
      'Missing out on the perfect home',
      'Stressful negotiations with no guidance',
      'Hidden issues discovered after closing',
      'Not knowing the true market value'
    ],
    benefits: [
      'Local market expertise to find your perfect home',
      'Skilled negotiation to get you the best deal',
      'Transparent process with regular updates',
      'Comprehensive market analysis included',
      'Trusted network of inspectors and lenders'
    ],
    usps: [
      'Local Expert',
      'Free Home Valuation',
      'Top Negotiator',
      'Full Service',
      '5-Star Reviews'
    ],
    ctaOptions: [
      'Get Free Valuation',
      'Browse Listings',
      'Schedule Showing',
      'Contact Agent'
    ],
    testimonialTones: ['thrilled', 'grateful', 'satisfied']
  },

  retail: {
    painPoints: [
      'Hard to find unique, quality products',
      'Generic big-box store experiences',
      'No personalized customer service',
      'Products that dont last',
      'Not supporting local businesses'
    ],
    benefits: [
      'Carefully curated selection you wont find elsewhere',
      'Expert staff who know our products inside and out',
      'Quality guarantee on everything we sell',
      'Supporting your local community',
      'Hassle-free returns and exchanges'
    ],
    usps: [
      'Locally Owned',
      'Quality Guarantee',
      'Expert Staff',
      'Easy Returns',
      'Shop Local'
    ],
    ctaOptions: [
      'Shop Now',
      'Browse Collection',
      'Visit Store',
      'Learn More'
    ],
    testimonialTones: ['happy', 'satisfied', 'impressed']
  },

  'home-services': {
    painPoints: [
      'Contractors who never call back',
      'Projects that go over budget',
      'Shoddy workmanship that fails quickly',
      'Scheduling nightmares and no-shows',
      'Not knowing who to trust'
    ],
    benefits: [
      'On-time, every time - we value your schedule',
      'Fixed pricing with no surprise charges',
      'Skilled craftsmen who take pride in their work',
      'Background-checked and fully insured',
      'Satisfaction guaranteed or we make it right'
    ],
    usps: [
      'Licensed & Bonded',
      'Free Estimates',
      'On-Time Guarantee',
      'Local Company',
      '100% Satisfaction'
    ],
    ctaOptions: [
      'Get Free Quote',
      'Schedule Service',
      'Call Us Today',
      'Book Online'
    ],
    testimonialTones: ['relieved', 'impressed', 'satisfied']
  },

  dentist: {
    painPoints: [
      'Fear and anxiety about dental visits',
      'Cold, clinical office environments',
      'Long waits for appointments',
      'Feeling rushed during exams',
      'Confusing insurance and billing'
    ],
    benefits: [
      'Gentle, caring approach for anxious patients',
      'Modern, comfortable office environment',
      'Same-week appointments available',
      'Thorough exams with time to answer questions',
      'Clear pricing and insurance assistance'
    ],
    usps: [
      'Gentle Care',
      'Modern Office',
      'Insurance Accepted',
      'Family Friendly',
      'Emergency Care'
    ],
    ctaOptions: [
      'Book Appointment',
      'Schedule Checkup',
      'Call Us',
      'New Patient Special'
    ],
    testimonialTones: ['relieved', 'comfortable', 'confident'],
    clichesToAvoid: [
      'something to smile about', 'dental excellence',
      'sinking your teeth into', 'bite-sized',
      'keeping you smiling'
    ],
    powerPhrases: [
      'Gentle care. Beautiful smiles.',
      'The dentist you\'ll actually like',
      'Anxiety-free dentistry',
      'Modern comfort. Caring team.',
      'Your smile, our priority'
    ]
  },

  // ===== NEW INDUSTRIES =====

  hvac: {
    painPoints: [
      'No A/C in the middle of summer',
      'Heating system breaks down in winter',
      'Sky-high energy bills each month',
      'Uneven temperatures throughout the house',
      'Waiting days for service during peak season'
    ],
    benefits: [
      '24/7 emergency service - even on weekends',
      'Energy-efficient systems that lower your bills',
      'Maintenance plans that prevent breakdowns',
      'Even heating and cooling in every room',
      'Same-day service when available'
    ],
    usps: [
      'NATE Certified',
      '24/7 Emergency',
      'Free Estimates',
      'Financing Available',
      'Maintenance Plans'
    ],
    ctaOptions: [
      'Get Free Estimate',
      'Schedule Service',
      'Call Now',
      'Book Maintenance'
    ],
    testimonialTones: ['relieved', 'comfortable', 'grateful'],
    clichesToAvoid: [
      'keeping you cool', 'hot deals', 'chilling out',
      'climate solutions', 'heating up savings',
      'cool comfort'
    ],
    powerPhrases: [
      'Cool in summer. Warm in winter. Always.',
      'Comfort you can count on',
      'Lower bills. Better comfort.',
      'There when you need us most',
      'Stay comfortable year-round'
    ]
  },

  roofing: {
    painPoints: [
      'Leaks damaging your home during storms',
      'Missing or damaged shingles',
      'Insurance claim headaches after a storm',
      'Not knowing if your roof needs replacement',
      'Contractors who disappear after taking deposits'
    ],
    benefits: [
      'Free storm damage inspections',
      'Direct insurance billing and claim assistance',
      'Quality materials with manufacturer warranties',
      'Licensed, bonded, and insured crews',
      'No payment until you\'re satisfied'
    ],
    usps: [
      'Insurance Specialist',
      'Free Inspections',
      'Warranty Included',
      'Licensed & Bonded',
      'Storm Damage Experts'
    ],
    ctaOptions: [
      'Free Roof Inspection',
      'Get Free Estimate',
      'Call Now',
      'Schedule Inspection'
    ],
    testimonialTones: ['relieved', 'protected', 'satisfied'],
    clichesToAvoid: [
      'raising the roof', 'over your head',
      'roofing solutions', 'top-notch roofing',
      'covering all your needs'
    ],
    powerPhrases: [
      'Leak-free. Guaranteed.',
      'Storm damage? We handle the insurance.',
      'Your roof. Our reputation.',
      'Protect your biggest investment',
      'Weather the storm with confidence'
    ]
  },

  landscaping: {
    painPoints: [
      'Overgrown yard that\'s embarrassing',
      'No time to maintain the lawn',
      'Dead grass and brown patches',
      'Unreliable lawn services that no-show',
      'Drainage problems flooding your yard'
    ],
    benefits: [
      'Reliable weekly service - same crew every time',
      'Beautiful lawns that impress the neighbors',
      'Professional design for outdoor living spaces',
      'Seasonal cleanup and maintenance included',
      'Drainage solutions that work'
    ],
    usps: [
      'Reliable Service',
      'Same Crew Weekly',
      'Free Design Consult',
      'Seasonal Packages',
      'Locally Owned'
    ],
    ctaOptions: [
      'Get Free Quote',
      'Schedule Consult',
      'Call Us',
      'Book Service'
    ],
    testimonialTones: ['impressed', 'satisfied', 'proud'],
    clichesToAvoid: [
      'growing your dreams', 'green with envy',
      'landscaping solutions', 'branching out',
      'rooted in quality'
    ],
    powerPhrases: [
      'The lawn you deserve',
      'Love your yard again',
      'Curb appeal. Made easy.',
      'Your outdoor oasis awaits',
      'Same crew. Every time. On time.'
    ]
  },

  auto: {
    painPoints: [
      'Not trusting mechanics to be honest',
      'Surprise repair bills that break the bank',
      'Waiting all day for simple repairs',
      'Dealerships charging outrageous prices',
      'Not understanding what\'s actually wrong'
    ],
    benefits: [
      'Honest diagnostics - we explain everything first',
      'Upfront pricing before any work begins',
      'Same-day service for most repairs',
      'Warranty on parts and labor',
      'Fair prices - often 30% less than dealers'
    ],
    usps: [
      'ASE Certified',
      'Honest Pricing',
      'Same-Day Service',
      'Warranty Included',
      'Free Diagnostics'
    ],
    ctaOptions: [
      'Schedule Service',
      'Get Free Diagnostic',
      'Call Now',
      'Book Appointment'
    ],
    testimonialTones: ['relieved', 'trusting', 'satisfied'],
    clichesToAvoid: [
      'driving success', 'on the road to savings',
      'auto solutions', 'revving up quality',
      'full throttle service'
    ],
    powerPhrases: [
      'Honest work. Fair prices.',
      'The mechanic you can trust',
      'No surprises. Just solutions.',
      'Dealer quality. Neighborhood prices.',
      'We explain before we fix'
    ]
  },

  cleaning: {
    painPoints: [
      'Cleaning services that do a mediocre job',
      'Different cleaners every time who don\'t know your home',
      'Products that aggravate allergies',
      'Services that cancel at the last minute',
      'Not trusting strangers in your home'
    ],
    benefits: [
      'Same cleaner every visit - they know your home',
      'Background-checked, bonded, and insured staff',
      'Eco-friendly products safe for families and pets',
      '100% satisfaction guarantee',
      'Flexible scheduling that works for you'
    ],
    usps: [
      'Same Cleaner Always',
      'Background Checked',
      'Eco-Friendly',
      'Bonded & Insured',
      'Satisfaction Guaranteed'
    ],
    ctaOptions: [
      'Get Free Quote',
      'Book Cleaning',
      'Call Us',
      'Schedule Today'
    ],
    testimonialTones: ['relieved', 'happy', 'trusting'],
    clichesToAvoid: [
      'cleaning up the competition', 'sparkling success',
      'cleaning solutions', 'wiping away worries',
      'sweeping you off your feet'
    ],
    powerPhrases: [
      'Come home to clean',
      'Trust us in your home',
      'Your time back. Your home spotless.',
      'Same cleaner. Every time.',
      'Clean home. Clear mind.'
    ]
  },

  insurance: {
    painPoints: [
      'Confusing policies with hidden exclusions',
      'Agents who disappear after the sale',
      'Claims that get denied without explanation',
      'Premiums that keep going up',
      'One-size-fits-all coverage that doesn\'t fit'
    ],
    benefits: [
      'Independent agent who works for YOU, not the insurance company',
      'Compare rates from multiple carriers',
      'Claims advocacy - we fight for your claim',
      'Annual policy reviews to save you money',
      'Local service when you need us most'
    ],
    usps: [
      'Independent Agent',
      'Multiple Carriers',
      'Claims Advocacy',
      'Local Service',
      'Free Policy Review'
    ],
    ctaOptions: [
      'Get Free Quote',
      'Review My Policy',
      'Call Us',
      'Compare Rates'
    ],
    testimonialTones: ['protected', 'confident', 'grateful'],
    clichesToAvoid: [
      'insuring your future', 'peace of mind guaranteed',
      'insurance solutions', 'covering all bases',
      'protecting what matters most'
    ],
    powerPhrases: [
      'We work for you. Not them.',
      'Your advocate when it matters',
      'Better coverage. Better price.',
      'Someone in your corner',
      'Compare. Save. Relax.'
    ]
  },

  accountant: {
    painPoints: [
      'Dreading tax season every year',
      'Worried about missing deductions',
      'Fear of IRS audits and penalties',
      'Disorganized finances causing stress',
      'Accountants who only talk to you once a year'
    ],
    benefits: [
      'Year-round tax planning, not just April',
      'Proactive strategies to minimize tax burden',
      'IRS audit representation included',
      'Clear explanations in plain English',
      'Responsive communication when you need answers'
    ],
    usps: [
      'CPA Licensed',
      'Year-Round Service',
      'Audit Protection',
      'Tax Planning',
      'Small Business Specialist'
    ],
    ctaOptions: [
      'Free Consultation',
      'Schedule Review',
      'Call Us',
      'Get Started'
    ],
    testimonialTones: ['relieved', 'confident', 'organized'],
    clichesToAvoid: [
      'counting on success', 'adding up savings',
      'accounting solutions', 'balancing your needs',
      'your financial partner'
    ],
    powerPhrases: [
      'Keep more. Stress less.',
      'Year-round tax help',
      'Your numbers. Our expertise.',
      'Tax stress? We handle it.',
      'Maximize every deduction'
    ]
  },

  general: {
    painPoints: [
      'Hard to find reliable, trustworthy businesses',
      'Poor communication and customer service',
      'Services that dont meet expectations',
      'Hidden fees and unclear pricing',
      'Long waits and delayed responses'
    ],
    benefits: [
      'Dedicated to exceeding your expectations',
      'Clear communication every step of the way',
      'Fair, transparent pricing',
      'Quick response times',
      'Locally owned and operated'
    ],
    usps: [
      'Trusted & Reliable',
      'Customer Focused',
      'Local Business',
      'Quality Service',
      'Fair Pricing'
    ],
    ctaOptions: [
      'Get Started',
      'Contact Us',
      'Learn More',
      'Get a Quote'
    ],
    testimonialTones: ['satisfied', 'impressed', 'happy']
  }
};

/**
 * Get industry content by industry name
 */
export function getIndustryContent(industry) {
  return INDUSTRY_CONTENT[industry] || INDUSTRY_CONTENT.general;
}

/**
 * Get random items from an array
 */
export function getRandomItems(array, count = 3) {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get random pain points for an industry
 */
export function getRandomPainPoints(industry, count = 3) {
  const content = getIndustryContent(industry);
  return getRandomItems(content.painPoints, count);
}

/**
 * Get random benefits for an industry
 */
export function getRandomBenefits(industry, count = 3) {
  const content = getIndustryContent(industry);
  return getRandomItems(content.benefits, count);
}

/**
 * Get random USPs for an industry
 */
export function getRandomUSPs(industry, count = 4) {
  const content = getIndustryContent(industry);
  return getRandomItems(content.usps, count);
}

/**
 * Get a random CTA text for an industry
 */
export function getRandomCTA(industry) {
  const content = getIndustryContent(industry);
  const options = content.ctaOptions;
  return options[Math.floor(Math.random() * options.length)];
}

export default {
  INDUSTRY_CONTENT,
  getIndustryContent,
  getRandomPainPoints,
  getRandomBenefits,
  getRandomUSPs,
  getRandomCTA
};
