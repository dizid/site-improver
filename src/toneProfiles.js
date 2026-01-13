// src/toneProfiles.js
// Industry-specific tone and voice profiles for content generation
// Each profile defines how content should sound for that industry

/**
 * Tone profiles for each industry
 * These guide AI content generation to match customer expectations
 */
export const TONE_PROFILES = {
  plumber: {
    name: 'Plumbing',
    voiceDescription: 'Straightforward, competent, and reliable. Like talking to a trusted neighbor who knows their stuff.',

    // Primary tone attributes (1-10 scale for AI guidance)
    attributes: {
      professional: 7,
      friendly: 8,
      technical: 5,
      urgent: 6,
      empathetic: 6,
      authoritative: 7
    },

    // Words/phrases TO USE
    preferredLanguage: [
      'fix', 'repair', 'solve', 'stop', 'prevent',
      'leak', 'drain', 'pipe', 'water',
      'fast', 'same-day', 'reliable', 'honest',
      'licensed', 'insured', 'guaranteed',
      'no mess', 'clean up', 'respect your home'
    ],

    // Words/phrases to AVOID
    avoidLanguage: [
      'premium', 'luxury', 'exclusive',
      'plumbing solutions', 'water management',
      'state-of-the-art plumbing', 'revolutionary',
      'synergy', 'leverage', 'optimize'
    ],

    // Emotional hooks that resonate
    emotionalHooks: [
      'peace of mind', 'protect your home', 'sleep easy',
      'no surprise bills', 'we show up on time',
      'family-safe', 'clean drinking water'
    ],

    // Trust language that works
    trustLanguage: [
      '{{years}} years fixing {{city}} plumbing',
      'Licensed plumber #{{license}}',
      'Same plumber every visit',
      'We answer our phones'
    ],

    // Sample headline angles
    headlineAngles: [
      'Emergency focus', 'Honest pricing', 'Local expertise', 'Family safety'
    ]
  },

  electrician: {
    name: 'Electrical',
    voiceDescription: 'Safety-conscious, precise, and reassuring. Conveys expertise without being intimidating.',

    attributes: {
      professional: 8,
      friendly: 6,
      technical: 7,
      urgent: 5,
      empathetic: 5,
      authoritative: 9
    },

    preferredLanguage: [
      'safe', 'safety', 'secure', 'protect',
      'code-compliant', 'up to code', 'inspection-ready',
      'licensed', 'certified', 'master electrician',
      'fire prevention', 'surge protection',
      'reliable', 'dependable', 'guaranteed'
    ],

    avoidLanguage: [
      'electrifying', 'shocking deals', 'power up your life',
      'electrical solutions', 'energy synergy',
      'cutting-edge', 'revolutionary'
    ],

    emotionalHooks: [
      'keep your family safe', 'prevent electrical fires',
      'peace of mind', 'protect your investment',
      'sleep soundly', 'code compliance'
    ],

    trustLanguage: [
      'Licensed Master Electrician',
      '{{years}} years, zero safety incidents',
      'Background-checked technicians',
      'Always pull proper permits'
    ],

    headlineAngles: [
      'Safety first', 'Code compliance', 'Fire prevention', 'Licensed expertise'
    ]
  },

  hvac: {
    name: 'HVAC',
    voiceDescription: 'Comfort-focused and knowledgeable. Balances technical expertise with approachable warmth.',

    attributes: {
      professional: 7,
      friendly: 7,
      technical: 6,
      urgent: 5,
      empathetic: 7,
      authoritative: 7
    },

    preferredLanguage: [
      'comfort', 'comfortable', 'cool', 'warm',
      'efficient', 'energy savings', 'lower bills',
      'air quality', 'breathe easy', 'fresh air',
      'reliable', 'quiet', 'consistent',
      'seasonal', 'maintenance', 'tune-up'
    ],

    avoidLanguage: [
      'climate solutions', 'thermal management',
      'HVAC excellence', 'revolutionary comfort',
      'state-of-the-art systems'
    ],

    emotionalHooks: [
      'stay comfortable year-round', 'lower energy bills',
      'breathe cleaner air', 'no more hot spots',
      'keep your family comfortable', 'reliable comfort'
    ],

    trustLanguage: [
      'NATE-certified technicians',
      '{{years}}+ years of comfort',
      '24/7 emergency service',
      'Free comfort consultation'
    ],

    headlineAngles: [
      'Energy savings', 'Year-round comfort', 'Air quality', 'Emergency service'
    ]
  },

  roofing: {
    name: 'Roofing',
    voiceDescription: 'Protective and trustworthy. Emphasizes long-term security and storm readiness.',

    attributes: {
      professional: 8,
      friendly: 6,
      technical: 6,
      urgent: 7,
      empathetic: 6,
      authoritative: 8
    },

    preferredLanguage: [
      'protect', 'protection', 'secure', 'defend',
      'storm', 'weather', 'leak-free', 'watertight',
      'durable', 'long-lasting', 'warranty',
      'insurance', 'claim', 'inspection',
      'shingle', 'flashing', 'gutter'
    ],

    avoidLanguage: [
      'roofing solutions', 'overhead protection',
      'revolutionary materials', 'state-of-the-art roofing',
      'raise the roof'
    ],

    emotionalHooks: [
      'protect your biggest investment', 'storm-ready',
      'no more leak worries', 'insurance claim help',
      'peace of mind overhead', 'sleep dry'
    ],

    trustLanguage: [
      'GAF Master Elite contractor',
      'Free storm damage inspection',
      '25-year workmanship warranty',
      'Licensed, bonded, insured'
    ],

    headlineAngles: [
      'Storm protection', 'Insurance help', 'Long-term warranty', 'Free inspection'
    ]
  },

  lawyer: {
    name: 'Legal',
    voiceDescription: 'Confident and empathetic. Professional authority balanced with genuine care for client outcomes.',

    attributes: {
      professional: 9,
      friendly: 5,
      technical: 6,
      urgent: 4,
      empathetic: 8,
      authoritative: 9
    },

    preferredLanguage: [
      'fight', 'advocate', 'protect', 'defend',
      'rights', 'justice', 'compensation', 'recovery',
      'experience', 'results', 'track record',
      'confidential', 'personal attention',
      'no fee unless we win', 'free consultation'
    ],

    avoidLanguage: [
      'legal solutions', 'law firm excellence',
      'synergistic approach', 'leverage our expertise',
      'revolutionary legal services', 'best lawyer'
    ],

    emotionalHooks: [
      'you deserve justice', 'we fight for you',
      'get what you deserve', 'hold them accountable',
      'peace of mind', 'focus on healing'
    ],

    trustLanguage: [
      '${{amount}}M+ recovered for clients',
      '{{years}} years fighting for {{city}}',
      'Former prosecutor on your side',
      'Personal attention from a real attorney'
    ],

    headlineAngles: [
      'Results/track record', 'Personal attention', 'Fighting for you', 'No upfront cost'
    ]
  },

  dentist: {
    name: 'Dental',
    voiceDescription: 'Warm, reassuring, and patient-focused. Addresses anxiety while emphasizing modern comfort.',

    attributes: {
      professional: 7,
      friendly: 9,
      technical: 5,
      urgent: 3,
      empathetic: 9,
      authoritative: 6
    },

    preferredLanguage: [
      'smile', 'comfortable', 'gentle', 'caring',
      'pain-free', 'relaxing', 'soothing',
      'modern', 'technology', 'efficient',
      'family', 'children', 'welcoming',
      'confident', 'beautiful', 'healthy'
    ],

    avoidLanguage: [
      'dental solutions', 'oral health excellence',
      'revolutionary dentistry', 'state-of-the-art clinic',
      'drill', 'extraction', 'painful'
    ],

    emotionalHooks: [
      'smile with confidence', 'no more dental anxiety',
      'gentle care you deserve', 'modern comfort',
      'love your smile again', 'the dentist you\'ll actually like'
    ],

    trustLanguage: [
      'Sedation options available',
      'Same-day appointments',
      '{{years}} years of gentle care',
      'Like 5-star spa, but for teeth'
    ],

    headlineAngles: [
      'Comfort/anxiety-free', 'Beautiful smiles', 'Family-friendly', 'Modern technology'
    ]
  },

  restaurant: {
    name: 'Restaurant',
    voiceDescription: 'Inviting, passionate, and community-focused. Evokes taste, atmosphere, and belonging.',

    attributes: {
      professional: 5,
      friendly: 9,
      technical: 3,
      urgent: 4,
      empathetic: 6,
      authoritative: 4
    },

    preferredLanguage: [
      'fresh', 'local', 'homemade', 'scratch',
      'flavor', 'taste', 'savor', 'enjoy',
      'gather', 'celebrate', 'share',
      'family recipe', 'chef', 'craft',
      'cozy', 'welcoming', 'neighborhood'
    ],

    avoidLanguage: [
      'dining solutions', 'culinary excellence',
      'gastronomic experience', 'food synergy',
      'revolutionary cuisine', 'state-of-the-art kitchen'
    ],

    emotionalHooks: [
      'taste the difference', 'where memories are made',
      'your neighborhood gathering spot', 'like grandma made',
      'where {{city}} comes together', 'feed your soul'
    ],

    trustLanguage: [
      'Serving {{city}} since {{foundedYear}}',
      '{{reviewCount}} 5-star reviews',
      'Family recipes, three generations',
      'Locally sourced, chef-crafted'
    ],

    headlineAngles: [
      'Local/fresh ingredients', 'Community gathering', 'Family tradition', 'Unique flavors'
    ]
  },

  'real-estate': {
    name: 'Real Estate',
    voiceDescription: 'Confident, knowledgeable, and client-focused. Combines market expertise with personal care.',

    attributes: {
      professional: 8,
      friendly: 7,
      technical: 5,
      urgent: 5,
      empathetic: 7,
      authoritative: 8
    },

    preferredLanguage: [
      'home', 'dream home', 'investment',
      'market', 'neighborhood', 'community',
      'negotiate', 'advocate', 'guide',
      'local expert', 'insider', 'connections',
      'sell fast', 'best price', 'smooth closing'
    ],

    avoidLanguage: [
      'real estate solutions', 'property excellence',
      'revolutionary approach', 'synergistic transactions',
      'leverage the market'
    ],

    emotionalHooks: [
      'find your dream home', 'get top dollar',
      'insider knowledge', 'stress-free process',
      'your home, your way', 'make the right move'
    ],

    trustLanguage: [
      '{{customerCount}}+ homes sold',
      '#1 agent in {{neighborhood}}',
      'Average {{days}} days to close',
      '{{percentage}}% of asking price average'
    ],

    headlineAngles: [
      'Local expertise', 'Results/track record', 'Personal service', 'Market knowledge'
    ]
  },

  landscaping: {
    name: 'Landscaping',
    voiceDescription: 'Creative, reliable, and pride-focused. Emphasizes curb appeal and outdoor living.',

    attributes: {
      professional: 6,
      friendly: 8,
      technical: 5,
      urgent: 4,
      empathetic: 5,
      authoritative: 6
    },

    preferredLanguage: [
      'beautiful', 'curb appeal', 'outdoor living',
      'lawn', 'garden', 'yard', 'landscape',
      'design', 'transform', 'maintain',
      'reliable', 'consistent', 'scheduled',
      'green', 'lush', 'healthy'
    ],

    avoidLanguage: [
      'landscaping solutions', 'outdoor excellence',
      'revolutionary lawn care', 'synergistic design',
      'state-of-the-art landscaping'
    ],

    emotionalHooks: [
      'love your yard again', 'the lawn you deserve',
      'impress the neighbors', 'outdoor oasis',
      'come home to beautiful', 'weekends back'
    ],

    trustLanguage: [
      '{{years}} years beautifying {{city}}',
      '{{customerCount}}+ happy homeowners',
      'Same crew every visit',
      'Show up every time, on time'
    ],

    headlineAngles: [
      'Curb appeal', 'Reliable service', 'Time savings', 'Outdoor transformation'
    ]
  },

  cleaning: {
    name: 'Cleaning',
    voiceDescription: 'Trustworthy, thorough, and respectful. Emphasizes reliability and home respect.',

    attributes: {
      professional: 7,
      friendly: 8,
      technical: 4,
      urgent: 3,
      empathetic: 6,
      authoritative: 5
    },

    preferredLanguage: [
      'clean', 'spotless', 'fresh', 'sparkling',
      'trust', 'reliable', 'consistent',
      'detail', 'thorough', 'deep clean',
      'eco-friendly', 'safe', 'non-toxic',
      'bonded', 'insured', 'background-checked'
    ],

    avoidLanguage: [
      'cleaning solutions', 'sanitation excellence',
      'revolutionary cleaning', 'synergistic approach',
      'state-of-the-art cleaning'
    ],

    emotionalHooks: [
      'come home to clean', 'your time back',
      'trust us in your home', 'relax, we\'ve got this',
      'breathe easier', 'healthy home'
    ],

    trustLanguage: [
      'Background-checked, bonded, insured',
      'Same cleaner every visit',
      '{{customerCount}}+ {{city}} homes trust us',
      '100% satisfaction guaranteed'
    ],

    headlineAngles: [
      'Trust/security', 'Time savings', 'Consistency', 'Eco-friendly'
    ]
  },

  auto: {
    name: 'Auto Repair',
    voiceDescription: 'Honest, knowledgeable, and straightforward. Combats "mechanic distrust" with transparency.',

    attributes: {
      professional: 7,
      friendly: 7,
      technical: 7,
      urgent: 5,
      empathetic: 6,
      authoritative: 8
    },

    preferredLanguage: [
      'honest', 'fair', 'transparent',
      'fix', 'repair', 'diagnose',
      'ASE-certified', 'factory-trained',
      'warranty', 'quality parts',
      'explain', 'understand', 'no surprises'
    ],

    avoidLanguage: [
      'automotive solutions', 'vehicle excellence',
      'revolutionary repairs', 'state-of-the-art garage',
      'synergistic maintenance'
    ],

    emotionalHooks: [
      'no more mechanic anxiety', 'honest diagnosis',
      'fair prices, no surprises', 'understand before you pay',
      'trust your mechanic again', 'reliable ride'
    ],

    trustLanguage: [
      'ASE-certified technicians',
      '{{years}} years, same location',
      'Free inspection, honest diagnosis',
      'We explain everything first'
    ],

    headlineAngles: [
      'Honest/transparent', 'Fair pricing', 'Certified expertise', 'Warranty work'
    ]
  },

  insurance: {
    name: 'Insurance',
    voiceDescription: 'Protective, knowledgeable, and client-focused. Simplifies complexity with personal care.',

    attributes: {
      professional: 8,
      friendly: 6,
      technical: 5,
      urgent: 4,
      empathetic: 7,
      authoritative: 8
    },

    preferredLanguage: [
      'protect', 'coverage', 'secure',
      'save', 'compare', 'customize',
      'local', 'independent', 'advocate',
      'claim', 'help', 'guide',
      'family', 'business', 'assets'
    ],

    avoidLanguage: [
      'insurance solutions', 'coverage excellence',
      'revolutionary policies', 'synergistic protection',
      'state-of-the-art insurance'
    ],

    emotionalHooks: [
      'protect what matters', 'peace of mind',
      'we fight for your claim', 'someone in your corner',
      'understand your policy', 'right coverage, right price'
    ],

    trustLanguage: [
      'Independent agent - we work for YOU',
      '{{customerCount}}+ families protected',
      '{{years}} years serving {{city}}',
      'Claims advocacy included'
    ],

    headlineAngles: [
      'Independent/advocacy', 'Savings', 'Local service', 'Claims help'
    ]
  },

  accountant: {
    name: 'Accounting',
    voiceDescription: 'Trustworthy, precise, and stress-reducing. Turns tax anxiety into confidence.',

    attributes: {
      professional: 9,
      friendly: 5,
      technical: 7,
      urgent: 4,
      empathetic: 6,
      authoritative: 9
    },

    preferredLanguage: [
      'save', 'maximize', 'protect',
      'tax', 'deduction', 'credit',
      'organize', 'plan', 'strategy',
      'audit protection', 'IRS',
      'small business', 'personal', 'year-round'
    ],

    avoidLanguage: [
      'accounting solutions', 'financial excellence',
      'revolutionary tax services', 'synergistic planning',
      'state-of-the-art accounting'
    ],

    emotionalHooks: [
      'no more tax stress', 'keep more of your money',
      'sleep easy at tax time', 'year-round peace of mind',
      'audit protection', 'maximize every deduction'
    ],

    trustLanguage: [
      'CPA with {{years}}+ years experience',
      '{{customerCount}}+ returns filed',
      'Average ${{savings}} saved per client',
      'IRS audit representation included'
    ],

    headlineAngles: [
      'Tax savings', 'Stress reduction', 'Year-round help', 'Audit protection'
    ]
  }
};

/**
 * Get tone profile for an industry
 * @param {string} industry - Industry identifier
 * @returns {Object} Tone profile or default
 */
export function getToneProfile(industry) {
  const profile = TONE_PROFILES[industry];

  if (profile) {
    return profile;
  }

  // Return a sensible default for unknown industries
  return {
    name: formatIndustryName(industry),
    voiceDescription: 'Professional, friendly, and trustworthy. Balances expertise with approachability.',

    attributes: {
      professional: 7,
      friendly: 7,
      technical: 5,
      urgent: 5,
      empathetic: 6,
      authoritative: 7
    },

    preferredLanguage: [
      'professional', 'reliable', 'trusted',
      'experienced', 'quality', 'local',
      'guaranteed', 'licensed', 'insured'
    ],

    avoidLanguage: [
      'solutions', 'excellence', 'revolutionary',
      'state-of-the-art', 'synergy', 'leverage'
    ],

    emotionalHooks: [
      'peace of mind', 'trust the experts',
      'your local choice', 'reliable service'
    ],

    trustLanguage: [
      '{{years}} years serving {{city}}',
      'Licensed and insured',
      '{{customerCount}}+ satisfied customers'
    ],

    headlineAngles: [
      'Local expertise', 'Trust/reliability', 'Experience', 'Results'
    ]
  };
}

/**
 * Generate tone guidance for AI prompts
 * @param {string} industry - Industry identifier
 * @returns {string} Tone guidance text for AI
 */
export function generateToneGuidance(industry) {
  const profile = getToneProfile(industry);

  return `
TONE & VOICE GUIDANCE for ${profile.name}:

Voice: ${profile.voiceDescription}

Tone Attributes:
- Professional: ${profile.attributes.professional}/10
- Friendly: ${profile.attributes.friendly}/10
- Technical: ${profile.attributes.technical}/10
- Urgent: ${profile.attributes.urgent}/10
- Empathetic: ${profile.attributes.empathetic}/10
- Authoritative: ${profile.attributes.authoritative}/10

USE these words/phrases:
${profile.preferredLanguage.slice(0, 15).join(', ')}

AVOID these words/phrases:
${profile.avoidLanguage.join(', ')}

Emotional hooks that resonate:
${profile.emotionalHooks.join(', ')}

Headline angles to consider:
${profile.headlineAngles.join(', ')}
`.trim();
}

/**
 * Score content against tone profile
 * @param {string} content - Content to score
 * @param {string} industry - Industry identifier
 * @returns {Object} Score and feedback
 */
export function scoreToneMatch(content, industry) {
  const profile = getToneProfile(industry);
  const contentLower = content.toLowerCase();

  let score = 50; // Start neutral
  const feedback = [];

  // Check for preferred language (bonus)
  let preferredCount = 0;
  for (const word of profile.preferredLanguage) {
    if (contentLower.includes(word.toLowerCase())) {
      preferredCount++;
    }
  }
  score += Math.min(preferredCount * 5, 25);
  if (preferredCount >= 3) {
    feedback.push(`Good: Uses ${preferredCount} industry-appropriate terms`);
  }

  // Check for avoided language (penalty)
  let avoidedCount = 0;
  for (const word of profile.avoidLanguage) {
    if (contentLower.includes(word.toLowerCase())) {
      avoidedCount++;
      feedback.push(`Avoid: "${word}" doesn't fit ${profile.name} tone`);
    }
  }
  score -= avoidedCount * 15;

  // Check for emotional hooks (bonus)
  let emotionalCount = 0;
  for (const hook of profile.emotionalHooks) {
    if (contentLower.includes(hook.toLowerCase())) {
      emotionalCount++;
    }
  }
  score += Math.min(emotionalCount * 10, 20);
  if (emotionalCount >= 1) {
    feedback.push(`Good: Uses effective emotional hook`);
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
    feedback,
    profile: profile.name
  };
}

/**
 * Format industry name for display
 */
function formatIndustryName(industry) {
  if (!industry) return 'General Service';

  return industry
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default {
  TONE_PROFILES,
  getToneProfile,
  generateToneGuidance,
  scoreToneMatch
};
