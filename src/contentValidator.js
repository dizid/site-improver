// src/contentValidator.js
// Content quality validation - detect clichés, generic phrases, and ensure specificity
// Expanded for PERFECTION - 150+ clichés, emotional resonance, headline structure validation

import logger from './logger.js';

const log = logger.child('contentValidator');

/**
 * EXPANDED Clichés and generic phrases blocklist (150+ phrases)
 * These are banned - using them triggers content regeneration
 */
const CLICHE_BLOCKLIST = [
  // ===== GENERIC SERVICE PHRASES =====
  'quality service',
  'quality services',
  'your trusted partner',
  'trusted partner',
  'one-stop shop',
  'one stop shop',
  'solutions for all your needs',
  'all your needs',
  'second to none',
  'best in class',
  'industry-leading',
  'industry leading',
  'world-class',
  'world class',
  'top-notch',
  'top notch',
  'state-of-the-art',
  'state of the art',
  'cutting-edge',
  'cutting edge',
  'next-level',
  'next level',
  'premier provider',
  'leading provider',
  'full-service',
  'full service',
  'comprehensive solutions',
  'turnkey solutions',
  'end-to-end solutions',
  'holistic approach',
  'synergy',
  'paradigm shift',
  'best practices',
  'value-added',
  'value added',
  'results-driven',
  'results driven',
  'customer-centric',
  'customer centric',
  'client-focused',
  'client focused',
  'innovative solutions',
  'tailored solutions',
  'customized solutions',
  'bespoke services',
  'seamless experience',
  'frictionless',
  'robust solutions',
  'scalable solutions',

  // ===== EMPTY PROMISES =====
  'customer satisfaction guaranteed',
  'customer satisfaction is our priority',
  'satisfaction is our priority',
  'your satisfaction is our priority',
  'we go above and beyond',
  'go above and beyond',
  'above and beyond',
  'we treat you like family',
  'treat you like family',
  'no job too big or small',
  'no job too small',
  'quality at affordable prices',
  'exceptional value',
  'unbeatable prices',
  'lowest prices guaranteed',
  'we won\'t be undersold',
  'exceed expectations',
  'exceed your expectations',
  'we deliver results',
  'results you can trust',
  'we make it easy',
  'hassle-free experience',
  'hassle free',
  'stress-free experience',
  'stress free',
  'your satisfaction is guaranteed',
  'we stand behind our work',
  'we get the job done',
  '110 percent',
  '110%',
  'give 110%',
  'go the extra mile',
  'extra mile',
  'white glove service',
  'white-glove',
  'red carpet treatment',
  'vip treatment',

  // ===== GENERIC BUSINESS PHRASES =====
  'dedicated team of professionals',
  'dedicated team',
  'team of professionals',
  'years of combined experience',
  'combined experience',
  'commitment to excellence',
  'committed to excellence',
  'passion for',
  'passionate about',
  'strive to provide',
  'strive to deliver',
  'pride ourselves',
  'take pride in',
  'here to help',
  'we\'re here to help',
  'reach out today',
  'reach out to us',
  'contact us today for',
  'don\'t hesitate to',
  'we are committed to',
  'our mission is to',
  'we believe in',
  'at the heart of',
  'our core values',
  'people are our greatest asset',
  'think outside the box',
  'outside the box',
  'raise the bar',
  'move the needle',
  'game changer',
  'game-changer',
  'disruptive',
  'leverage',
  'utilize',
  'facilitate',
  'streamline',
  'optimize',
  'empower',
  'enable',
  'enhance',
  'drive growth',
  'add value',
  'value proposition',
  'core competency',
  'core competencies',
  'low-hanging fruit',
  'low hanging fruit',

  // ===== MEANINGLESS SUPERLATIVES =====
  'truly exceptional',
  'absolutely the best',
  'unparalleled service',
  'unparalleled quality',
  'unmatched quality',
  'unmatched service',
  'superior service',
  'superior quality',
  'exceptional quality',
  'outstanding service',
  'outstanding quality',
  'remarkable',
  'extraordinary',
  'unprecedented',
  'unsurpassed',
  'unrivaled',
  'incomparable',
  'peerless',
  'matchless',
  'without equal',
  'bar none',
  'hands down the best',
  'simply the best',
  'head and shoulders above',
  'in a league of its own',
  'cream of the crop',
  'best of the best',
  'top of the line',
  'top-of-the-line',
  'a cut above',

  // ===== VAGUE TRUST LANGUAGE =====
  'you can count on us',
  'count on us',
  'trust the experts',
  'rely on the professionals',
  'leave it to the pros',
  'in good hands',
  'you\'re in good hands',
  'peace of mind guaranteed',
  'worry-free',
  'worry free',
  'rest assured',
  'sleep easy',
  'trusted by thousands',
  'industry experts',
  'seasoned professionals',
  'skilled craftsmen',
  'master craftsmen',

  // ===== WEAK OPENERS =====
  'welcome to our website',
  'welcome to',
  'thank you for visiting',
  'we are a',
  'we are the',
  'we offer',
  'we provide',
  'we specialize in',
  'our company',
  'our team',
  'our business',
  'about us',
  'who we are',
  'what we do',
  'our story',

  // ===== FILLER PHRASES =====
  'in today\'s world',
  'in this day and age',
  'at the end of the day',
  'when it comes to',
  'it goes without saying',
  'needless to say',
  'as a matter of fact',
  'the fact of the matter is',
  'truth be told',
  'to be honest',
  'honestly',
  'literally',
  'basically',
  'essentially',
  'actually',

  // ===== AI-GENERATED CLICHES (common AI writing patterns) =====
  'in today\'s fast-paced world',
  'in today\'s competitive landscape',
  'in today\'s digital age',
  'look no further',
  'your satisfaction is our priority',
  'we pride ourselves on',
  'one-stop shop',
  'above and beyond',
  'rest assured',
  'hassle-free',
  'cutting-edge',
  'best-in-class',
  'it\'s not just about',
  'at the forefront',
  'a testament to',
  'navigating the complexities',
  'unlock the potential',
  'unlock your potential',
  'embark on a journey',
  'take your business to the next level',
  'next level',
  'stand out from the crowd',
  'in a world where',
  'more than just a',
  'isn\'t just about',
  'redefine what it means',
  'elevate your',
  'bridge the gap',
  'dive deep',
  'deep dive',
  'touch base',
  'circle back',
  'moving forward',
  'space',          // as in "in the plumbing space"
  'landscape',      // as in "the competitive landscape"
  'ecosystem',
  'paradigm',
  'bandwidth',
  'wheelhouse',
  'pain point',     // meta-cliche: writing about pain points using the word
  'value-driven',
  'mission-driven',
  'purpose-driven',
  'data-driven',
  'thought leader',
  'thought leadership',
  'best kept secret',
  'hidden gem',
  'game changer',
  'game-changer',
  'revolutionary',
  'transformative',
  'unmatched expertise',
  'every step of the way',
  'from start to finish',
  'from day one',
  'like no other',
  'second to none',

  // ===== MORE AI-TYPICAL CLICHES =====
  'tailor-made solutions',
  'unparalleled expertise',
  'comprehensive suite of',
  'seamlessly integrate',
  'seamless integration',
  'deliver exceptional results',
  'transform your vision',
  'redefine the standard',
  'driving innovation',
  'proven track record of success',
  'proven track record'
];

/**
 * EXPANDED Regex patterns for generic phrases
 */
const GENERIC_PATTERNS = [
  // Original patterns
  /professional\s+\w+\s+services?\s+(?:you can trust|for you)/i,
  /quality\s+\w+\s+(?:services?|solutions?)\s+(?:at|for)/i,
  /your\s+(?:local|trusted|premier|go-to)\s+\w+\s+(?:experts?|professionals?|specialists?)/i,
  /we\s+(?:offer|provide)\s+(?:a wide range|comprehensive|full range)\s+of/i,
  /(?:for|with)\s+all\s+(?:of\s+)?your\s+\w+\s+needs/i,
  /let\s+us\s+(?:take care|handle)\s+(?:of\s+)?(?:all\s+)?your/i,

  // NEW: More generic patterns
  /(?:serving|proudly serving)\s+(?:the\s+)?(?:greater\s+)?\w+\s+area\s+for/i,
  /family[\s-]owned\s+and\s+operated/i,
  /our\s+team\s+(?:of\s+)?(?:experts?|professionals?)\s+(?:is|are)\s+(?:here|ready)/i,
  /(?:we|our team)\s+(?:is|are)\s+(?:committed|dedicated)\s+to/i,
  /(?:call|contact)\s+us\s+(?:today|now)\s+(?:for|to)\s+(?:a\s+)?(?:free|your)/i,
  /we\s+(?:take|have)\s+(?:great\s+)?pride\s+in/i,
  /(?:your|the)\s+(?:go-to|number one|#1)\s+\w+\s+(?:in|for)/i,
  /making\s+\w+\s+(?:easy|simple|affordable)\s+(?:for|since)/i,
  /(?:whether\s+you\s+need|no matter what)\s+(?:you|your)/i,
  /look\s+no\s+further/i,
  /you['']?ve\s+come\s+to\s+the\s+right\s+place/i,
  /we['']?ve\s+got\s+you\s+covered/i,
  /the\s+\w+\s+(?:you\s+)?deserve/i,
  /(?:built|founded)\s+on\s+(?:trust|integrity|values)/i,
  /(?:best|top|leading|premier)\s+\w+\s+(?:in|around)\s+(?:the\s+)?\w+/i,
  /experience\s+the\s+difference/i,
  /see\s+(?:why|what)\s+(?:our|so many)\s+customers/i,
  /discover\s+(?:the|why)/i,

  // NEW: Generic superlatives without specifics (TASK 1 additions)
  /(?:the\s+)?(?:best|top|leading|premier|greatest)\s+(?:in\s+(?:the\s+)?(?:industry|business|area|region|field))/i,
  /(?:world|industry|area)\s*['']?s?\s+(?:best|finest|top|leading)/i,
  /(?:top[\s-]rated|best|world[\s-]class)\s+(?![\d])/i,  // Generic superlatives without following numbers

  // TASK 1: Empty value propositions
  /(?:quality|professional)\s+(?:service|team)/i,
  /dedicated\s+professionals?\b/i,

  // TASK 1: Excessive "we" usage pattern - will be checked separately in validateContent
  // Pattern added below in validation function
  /(?:most\s+)?(?:trusted|reliable|experienced)\s+(?:in|around)\s+/i,

  // NEW: Empty value propositions
  /(?:quality|professional|expert)\s+(?:service|team|staff)\s+(?:you\s+)?(?:can\s+)?(?:trust|rely|count)/i,
  /dedicated\s+to\s+(?:providing|delivering|offering)\s+(?:the\s+)?(?:best|quality|excellent)/i,

  // NEW: AI-typical sentence starters
  /^(?:whether\s+you['']re|imagine\s+a\s+world|picture\s+this)/i,
  /^(?:say\s+goodbye|say\s+hello)\s+to/i
];

/**
 * Power words that indicate strong, specific content
 */
const POWER_WORDS = [
  'free', 'guaranteed', 'emergency', 'same-day', 'same day',
  '24/7', '24-7', 'instant', 'proven', 'certified', 'licensed',
  'award-winning', 'award winning', 'family-owned', 'family owned',
  'local', 'save', 'fast', 'quick', 'today', 'now',
  'exclusive', 'limited', 'new', 'easy', 'simple'
];

/**
 * Validate content for quality issues
 */
export function validateContent(content, context = {}) {
  if (!content || typeof content !== 'string') {
    return {
      isValid: false,
      issues: [{ type: 'empty', text: 'Content is empty or invalid', severity: 'critical' }],
      score: 0,
      powerScore: 0
    };
  }

  const contentLower = content.toLowerCase();
  const issues = [];

  // Check for clichés
  for (const cliche of CLICHE_BLOCKLIST) {
    if (contentLower.includes(cliche.toLowerCase())) {
      issues.push({
        type: 'cliche',
        text: cliche,
        severity: 'high',
        suggestion: `Replace "${cliche}" with specific, unique value proposition`
      });
    }
  }

  // Check for generic patterns
  for (const pattern of GENERIC_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      issues.push({
        type: 'generic',
        text: match[0],
        severity: 'medium',
        suggestion: 'Use specific details instead of generic phrasing'
      });
    }
  }

  // Check for excessive "we" usage (more than 3x in headline/subheadline-length text)
  const weMatches = content.match(/\bwe\b/gi) || [];
  if (weMatches.length > 3) {
    issues.push({
      type: 'excessive_we',
      text: `Excessive "we" usage (${weMatches.length} times) — content should focus on the customer`,
      severity: 'medium',
      suggestion: 'Replace "We offer..." with "You get..." or "Your home gets..."'
    });
  }

  // Check for generic superlatives without specifics ("the best", "top-rated", "world-class")
  const genericSuperlatives = content.match(/\b(?:the\s+best|top[\s-]rated|world[\s-]class|number\s+one|#1)\b/gi) || [];
  if (genericSuperlatives.length > 0) {
    // Only flag if not followed by a specific qualifier (number, city, credential)
    for (const superlative of genericSuperlatives) {
      const idx = contentLower.indexOf(superlative.toLowerCase());
      const after = contentLower.substring(idx + superlative.length, idx + superlative.length + 30);
      const hasSpecific = /\d+|rated|review|star|certif|licens/.test(after);
      if (!hasSpecific) {
        issues.push({
          type: 'generic_superlative',
          text: `Generic superlative "${superlative}" without specific proof`,
          severity: 'medium',
          suggestion: 'Back up superlatives with numbers: "Top-rated (4.9★, 200+ reviews)"'
        });
        break; // Only report once
      }
    }
  }

  // Check for empty value propositions ("quality service", "professional team")
  const emptyValueProps = [
    /\bquality\s+(?:service|work|results)\b/i,
    /\bprofessional\s+team\b/i,
    /\bexperienced\s+(?:team|staff|professionals)\b/i
  ];
  for (const pattern of emptyValueProps) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      issues.push({
        type: 'empty_value_prop',
        text: `Empty value proposition: "${match[0]}" — says nothing specific`,
        severity: 'medium',
        suggestion: 'Replace with concrete proof: years, certifications, customer count'
      });
      break; // Only report once
    }
  }

  // Check for specificity (should mention business name or location)
  const hasBusinessName = context.businessName &&
    contentLower.includes(context.businessName.toLowerCase());
  const hasCity = context.city &&
    contentLower.includes(context.city.toLowerCase());
  const hasNeighborhood = context.neighborhood &&
    contentLower.includes(context.neighborhood.toLowerCase());

  if (!hasBusinessName && !hasCity && !hasNeighborhood) {
    issues.push({
      type: 'specificity',
      text: 'Missing business name or location reference',
      severity: 'low',
      suggestion: `Include "${context.businessName || 'business name'}" or "${context.city || 'city name'}" for personalization`
    });
  }

  // Calculate power word score
  let powerScore = 0;
  const foundPowerWords = [];
  for (const word of POWER_WORDS) {
    if (contentLower.includes(word)) {
      powerScore++;
      foundPowerWords.push(word);
    }
  }

  // Calculate overall quality score (0-100)
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 50;
    else if (issue.severity === 'high') score -= 20;
    else if (issue.severity === 'medium') score -= 10;
    else if (issue.severity === 'low') score -= 5;
  }

  // Bonus for power words (up to 15 points)
  score += Math.min(powerScore * 3, 15);

  // Bonus for specificity
  if (hasBusinessName) score += 5;
  if (hasCity) score += 5;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine if content passes validation
  const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');
  const isValid = criticalIssues.length === 0;

  return {
    isValid,
    issues,
    score,
    powerScore,
    powerWords: foundPowerWords,
    hasSpecificity: hasBusinessName || hasCity || hasNeighborhood,
    recommendations: generateRecommendations(issues, context)
  };
}

/**
 * Validate a headline specifically
 */
export function validateHeadline(headline, context = {}) {
  const result = validateContent(headline, context);

  // Additional headline-specific checks
  if (headline && headline.length > 80) {
    result.issues.push({
      type: 'length',
      text: 'Headline too long',
      severity: 'medium',
      suggestion: 'Keep headlines under 80 characters for better impact'
    });
  }

  if (headline && headline.length < 10) {
    result.issues.push({
      type: 'length',
      text: 'Headline too short',
      severity: 'low',
      suggestion: 'Headlines should be at least 10 characters'
    });
  }

  // Check for weak headline openers
  const weakOpeners = [
    /^welcome to/i,
    /^we are/i,
    /^about us/i,
    /^our company/i
  ];

  for (const pattern of weakOpeners) {
    if (pattern.test(headline)) {
      result.issues.push({
        type: 'weak_opener',
        text: 'Weak headline opener',
        severity: 'medium',
        suggestion: 'Start with a benefit or unique value proposition'
      });
      break;
    }
  }

  // Recalculate validity
  result.isValid = result.issues.filter(i =>
    i.severity === 'critical' || i.severity === 'high'
  ).length === 0;

  return result;
}

/**
 * NEW: Validate headline structure and quality in depth
 * Checks for proven headline patterns and quality signals
 */
export function validateHeadlineStructure(headline, context = {}) {
  const result = {
    isValid: true,
    score: 100,
    issues: [],
    strengths: []
  };

  if (!headline) {
    return { isValid: false, score: 0, issues: [{ type: 'empty', severity: 'critical' }], strengths: [] };
  }

  const headlineLower = headline.toLowerCase();
  const words = headline.split(/\s+/);

  // === LENGTH CHECKS ===
  if (words.length < 3) {
    result.issues.push({
      type: 'too_short',
      text: 'Headline too short - needs more substance',
      severity: 'high',
      suggestion: 'Headlines should be 5-12 words for maximum impact'
    });
    result.score -= 25;
  }

  if (words.length > 15) {
    result.issues.push({
      type: 'too_long',
      text: 'Headline too long - loses impact',
      severity: 'medium',
      suggestion: 'Keep headlines punchy - under 12 words ideal'
    });
    result.score -= 15;
  }

  // === WEAK OPENER DETECTION ===
  const weakOpeners = [
    /^welcome/i,
    /^we are/i,
    /^we offer/i,
    /^we provide/i,
    /^our company/i,
    /^about/i,
    /^introducing/i,
    /^discover\s+our/i,
    /^experience\s+(?:our|the)/i,
    /^learn\s+(?:about|more)/i
  ];

  for (const pattern of weakOpeners) {
    if (pattern.test(headline)) {
      result.issues.push({
        type: 'weak_opener',
        text: `Weak headline opener: "${headline.split(' ').slice(0, 2).join(' ')}"`,
        severity: 'high',
        suggestion: 'Start with a benefit, number, or compelling statement'
      });
      result.score -= 20;
      break;
    }
  }

  // === POWER PATTERNS (positive signals) ===
  const powerPatterns = {
    hasNumber: /\d+\+?/.test(headline),
    hasLocation: !!context.city && headlineLower.includes(context.city.toLowerCase()),
    hasBusinessName: !!context.businessName && headlineLower.includes(context.businessName.toLowerCase()),
    hasQuestion: headline.endsWith('?'),
    hasSpecificBenefit: /\b(save|fast|same.?day|24.?7|emergency|free|guaranteed)\b/i.test(headline),
    hasTrustSignal: /\b(certified|licensed|insured|local|family)\b/i.test(headline)
  };

  // Award points for power patterns
  if (powerPatterns.hasNumber) {
    result.strengths.push('Contains specific number (good for credibility)');
    result.score += 5;
  }
  if (powerPatterns.hasLocation) {
    result.strengths.push('Mentions location (good for local SEO)');
    result.score += 5;
  }
  if (powerPatterns.hasSpecificBenefit) {
    result.strengths.push('Contains specific benefit');
    result.score += 5;
  }
  if (powerPatterns.hasTrustSignal) {
    result.strengths.push('Contains trust signal');
    result.score += 3;
  }

  // === SPECIFICITY CHECK ===
  const vaguePatterns = [
    /(?:quality|best|top|great|excellent)\s+(?:service|quality)/i,
    /trusted\s+(?:partner|provider|choice)/i,
    /(?:professional|expert)\s+(?:service|solutions?)/i
  ];

  for (const pattern of vaguePatterns) {
    if (pattern.test(headline)) {
      result.issues.push({
        type: 'vague_language',
        text: 'Headline uses vague marketing language',
        severity: 'medium',
        suggestion: 'Replace with specific benefits or credentials'
      });
      result.score -= 15;
      break;
    }
  }

  // Determine overall validity
  result.isValid = result.issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0;
  result.score = Math.max(0, Math.min(100, result.score));

  return result;
}

/**
 * Validate a CTA (Call to Action)
 */
export function validateCTA(cta, context = {}) {
  const result = validateContent(cta, context);

  // CTA-specific checks
  const weakCTAs = [
    'click here',
    'learn more',
    'read more',
    'submit',
    'send',
    'contact',
    'get started'
  ];

  const ctaLower = (cta || '').toLowerCase();
  for (const weak of weakCTAs) {
    if (ctaLower === weak) {
      result.issues.push({
        type: 'weak_cta',
        text: `Weak CTA: "${cta}"`,
        severity: 'medium',
        suggestion: 'Use action-oriented, benefit-focused CTAs like "Get Free Quote" or "Schedule Service"'
      });
      break;
    }
  }

  // Strong CTA patterns
  const strongPatterns = [
    /^get\s+(free|your|a)/i,
    /^book\s+(now|your|a)/i,
    /^schedule\s+(now|your|a)/i,
    /^call\s+(now|us|today)/i,
    /^request\s+(free|your|a)/i
  ];

  const isStrong = strongPatterns.some(p => p.test(cta));
  if (isStrong) {
    result.score = Math.min(100, result.score + 10);
  }

  result.isValid = result.issues.filter(i =>
    i.severity === 'critical' || i.severity === 'high'
  ).length === 0;

  return result;
}

/**
 * NEW: Score CTA effectiveness based on direct response principles
 */
export function scoreCTAEffectiveness(cta, context = {}) {
  const result = {
    score: 50, // Start at neutral
    grade: 'C',
    issues: [],
    suggestions: []
  };

  if (!cta) {
    return { score: 0, grade: 'F', issues: ['No CTA provided'], suggestions: [] };
  }

  const ctaLower = cta.toLowerCase().trim();
  const words = cta.split(/\s+/);

  // === WEAK CTAs (penalty) ===
  const weakCTAs = {
    'click here': -30,
    'learn more': -20,
    'read more': -20,
    'submit': -25,
    'send': -15,
    'contact': -10,
    'contact us': -10,
    'get started': -5,
    'more info': -20,
    'find out more': -15,
    'info': -25,
    'details': -20
  };

  for (const [weak, penalty] of Object.entries(weakCTAs)) {
    if (ctaLower === weak) {
      result.score += penalty;
      result.issues.push(`"${cta}" is a weak CTA`);
    }
  }

  // === STRONG CTA PATTERNS (bonus) ===
  const strongPatterns = {
    actionVerb: /^(get|book|schedule|call|request|claim|start|download|grab|reserve)/i,
    urgency: /(now|today|instant|immediate)/i,
    benefit: /(free|save|discount|offer|quote|estimate|consultation)/i,
    specificity: /\d+|[$%]/,
    personalization: /your|my/i
  };

  if (strongPatterns.actionVerb.test(cta)) {
    result.score += 15;
    result.suggestions.push('Good: Starts with action verb');
  }

  if (strongPatterns.urgency.test(cta)) {
    result.score += 10;
    result.suggestions.push('Good: Creates urgency');
  }

  if (strongPatterns.benefit.test(cta)) {
    result.score += 15;
    result.suggestions.push('Good: Promises specific benefit');
  }

  if (strongPatterns.specificity.test(cta)) {
    result.score += 10;
    result.suggestions.push('Good: Contains specific value');
  }

  // === LENGTH CHECK ===
  if (words.length > 5) {
    result.score -= 10;
    result.issues.push('CTA too long - should be 2-4 words');
  } else if (words.length >= 2 && words.length <= 4) {
    result.score += 5;
  }

  // === EXCELLENT CTA EXAMPLES ===
  const excellentCTAs = [
    'get free quote',
    'get your free quote',
    'book now',
    'call now',
    'schedule free estimate',
    'claim your discount',
    'request free consultation',
    'start your project'
  ];

  if (excellentCTAs.some(e => ctaLower.includes(e) || e.includes(ctaLower))) {
    result.score += 20;
    result.suggestions.push('Excellent CTA pattern detected');
  }

  // Clamp and grade
  result.score = Math.max(0, Math.min(100, result.score));
  result.grade = result.score >= 80 ? 'A' : result.score >= 60 ? 'B' : result.score >= 40 ? 'C' : result.score >= 20 ? 'D' : 'F';

  return result;
}

/**
 * NEW: Check content for emotional resonance and psychological triggers
 * Based on Cialdini's principles and direct response copywriting
 */
export function checkEmotionalResonance(content, industry = 'general') {
  const result = {
    score: 0,
    triggers: [],
    missing: [],
    recommendations: []
  };

  if (!content) return result;

  const contentLower = content.toLowerCase();

  // === EMOTIONAL TRIGGER DETECTION ===
  const emotionalTriggers = {
    // Pain avoidance (powerful)
    painAvoidance: {
      patterns: [
        /(?:no more|stop|avoid|prevent|protect|never again)/i,
        /(?:worried|stress|anxiety|fear|frustration)/i,
        /(?:damage|problem|issue|emergency|disaster)/i
      ],
      weight: 3,
      description: 'Addresses pain/fear'
    },

    // Gain/benefit (motivating)
    gain: {
      patterns: [
        /(?:save|earn|gain|improve|increase|boost)/i,
        /(?:peace of mind|confidence|comfort|relief)/i,
        /(?:fast|quick|instant|immediate|same.?day)/i
      ],
      weight: 2,
      description: 'Promises clear benefit'
    },

    // Social proof
    socialProof: {
      patterns: [
        /(?:trusted by|join|thousands|hundreds|families|neighbors)/i,
        /(?:reviews?|rated|stars?|recommended)/i,
        /(?:\d+\+?\s*(?:customers?|clients?|projects?|years?))/i
      ],
      weight: 2,
      description: 'Uses social proof'
    },

    // Authority
    authority: {
      patterns: [
        /(?:certified|licensed|accredited|award)/i,
        /(?:expert|master|specialist|professional)/i,
        /(?:EPA|BBB|NATE|ISO|ASE)/i
      ],
      weight: 2,
      description: 'Establishes authority'
    },

    // Scarcity/Urgency
    urgency: {
      patterns: [
        /(?:limited|exclusive|only|today|now|hurry)/i,
        /(?:emergency|24.?7|available|ready)/i,
        /(?:before|while|seasonal|spring|winter|fall|summer)/i
      ],
      weight: 1,
      description: 'Creates urgency'
    },

    // Local/Community
    local: {
      patterns: [
        /(?:local|neighborhood|community|family.?owned)/i,
        /(?:serving|proudly|since|established)/i
      ],
      weight: 2,
      description: 'Builds local connection'
    }
  };

  // Check each trigger category
  for (const [name, trigger] of Object.entries(emotionalTriggers)) {
    const found = trigger.patterns.some(p => p.test(content));
    if (found) {
      result.triggers.push({ name, description: trigger.description });
      result.score += trigger.weight * 10;
    } else {
      result.missing.push({ name, description: trigger.description });
    }
  }

  // Industry-specific recommendations
  const industryRecommendations = {
    plumber: ['Emphasize emergency availability', 'Highlight damage prevention', 'Mention family safety'],
    electrician: ['Lead with safety', 'Mention code compliance', 'Reference fire prevention'],
    lawyer: ['Address fear/uncertainty', 'Highlight case results', 'Emphasize confidentiality'],
    dentist: ['Address anxiety gently', 'Highlight comfort', 'Mention modern technology'],
    restaurant: ['Evoke taste/smell', 'Mention fresh/local', 'Create atmosphere'],
    'real-estate': ['Address dream home emotions', 'Mention investment security', 'Local expertise'],
    'home-services': ['Emphasize reliability', 'Mention fair pricing', 'Local reputation'],
    retail: ['Create desire', 'Mention uniqueness', 'Local support'],
    hvac: ['Comfort in extreme weather', 'Energy savings', 'Emergency availability'],
    roofing: ['Storm protection', 'Insurance help', 'Long-term security'],
    general: ['Build trust', 'Show local connection', 'Highlight reliability']
  };

  result.recommendations = industryRecommendations[industry] || industryRecommendations.general;

  // Clamp score
  result.score = Math.min(100, result.score);

  return result;
}

/**
 * NEW: Check content "temperature" - too cold (generic) vs too hot (salesy)
 */
export function checkContentTemperature(content, context = {}) {
  const result = {
    temperature: 'neutral', // cold, cool, neutral, warm, hot
    score: 50, // 0-100, 50 is ideal
    issues: [],
    suggestions: []
  };

  if (!content) {
    return { temperature: 'cold', score: 0, issues: ['No content'], suggestions: [] };
  }

  const contentLower = content.toLowerCase();

  // === COLD INDICATORS (too generic/boring) ===
  const coldIndicators = [
    /we\s+(?:offer|provide)\s+(?:a variety|many|various)/i,
    /for\s+all\s+your\s+\w+\s+needs/i,
    /(?:quality|professional)\s+(?:service|work)/i,
    /(?:contact|call)\s+us\s+(?:today|now)/i,
    /our\s+team\s+(?:is|of)/i
  ];

  let coldScore = 0;
  for (const pattern of coldIndicators) {
    if (pattern.test(content)) coldScore += 15;
  }

  // Check for lack of specificity (cold)
  if (!context.city || !contentLower.includes(context.city.toLowerCase())) {
    coldScore += 10;
  }
  if (!context.businessName || !contentLower.includes(context.businessName.toLowerCase())) {
    coldScore += 10;
  }
  if (!/\d+/.test(content)) { // No numbers
    coldScore += 10;
  }

  // === HOT INDICATORS (too salesy/pushy) ===
  const hotIndicators = [
    /\!{2,}/g, // Multiple exclamation marks
    /act\s+now/i,
    /limited\s+time/i,
    /don['']t\s+miss/i,
    /best\s+(?:deal|price|offer)/i,
    /hurry/i,
    /only\s+\d+\s+left/i,
    /exclusive\s+offer/i,
    /click\s+(?:here|now)/i,
    /buy\s+now/i,
    /order\s+today/i
  ];

  let hotScore = 0;
  for (const pattern of hotIndicators) {
    if (pattern.test(content)) hotScore += 20;
  }

  // Check for excessive superlatives (hot)
  const superlatives = content.match(/(?:best|greatest|most|ultimate|amazing|incredible|unbelievable)/gi) || [];
  hotScore += superlatives.length * 10;

  // === CALCULATE TEMPERATURE ===
  // Score starts at 50 (neutral)
  // Cold indicators push down, hot indicators push up
  result.score = 50 - (coldScore / 2) + (hotScore / 2);
  result.score = Math.max(0, Math.min(100, result.score));

  // Determine temperature label
  if (result.score <= 20) {
    result.temperature = 'cold';
    result.issues.push('Content is too generic and lacks personality');
    result.suggestions.push('Add specific details: years in business, location, credentials');
    result.suggestions.push('Use more vivid, benefit-focused language');
  } else if (result.score <= 40) {
    result.temperature = 'cool';
    result.issues.push('Content could be more engaging');
    result.suggestions.push('Add trust signals or social proof');
  } else if (result.score <= 60) {
    result.temperature = 'neutral';
    // Ideal range - no issues
  } else if (result.score <= 80) {
    result.temperature = 'warm';
    result.issues.push('Content is slightly promotional');
    result.suggestions.push('Tone down urgency language');
  } else {
    result.temperature = 'hot';
    result.issues.push('Content is too salesy and may erode trust');
    result.suggestions.push('Remove excessive exclamation marks');
    result.suggestions.push('Replace superlatives with specific facts');
    result.suggestions.push('Remove false urgency');
  }

  return result;
}

/**
 * NEW: Calculate readability score using Flesch-Kincaid
 * Target: 55-75 (easily understood by average adult)
 */
export function calculateReadability(text) {
  if (!text) return { score: 0, grade: 'N/A', isIdeal: false };

  // Count sentences (rough estimate)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(sentences.length, 1);

  // Count words
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = Math.max(words.length, 1);

  // Count syllables (simplified)
  const syllableCount = words.reduce((count, word) => {
    return count + countSyllables(word);
  }, 0);

  // Flesch Reading Ease formula
  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;

  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  const clampedScore = Math.max(0, Math.min(100, score));

  // Grade level
  let grade;
  if (clampedScore >= 90) grade = '5th Grade';
  else if (clampedScore >= 80) grade = '6th Grade';
  else if (clampedScore >= 70) grade = '7th Grade';
  else if (clampedScore >= 60) grade = '8th-9th Grade';
  else if (clampedScore >= 50) grade = '10th-12th Grade';
  else if (clampedScore >= 30) grade = 'College';
  else grade = 'Graduate';

  return {
    score: Math.round(clampedScore),
    grade,
    avgSentenceLength: Math.round(avgSentenceLength),
    avgSyllablesPerWord: avgSyllablesPerWord.toFixed(1),
    isIdeal: clampedScore >= 55 && clampedScore <= 75
  };
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = word.match(/[aeiouy]+/g);
  if (!vowels) return 1;

  let count = vowels.length;

  // Subtract for silent e
  if (word.endsWith('e')) count--;

  // Subtract for certain patterns
  const doubleVowels = word.match(/[aeiouy]{2}/g);
  if (doubleVowels) count -= doubleVowels.length;

  return Math.max(1, count);
}

/**
 * NEW: Check if content length is optimal for its type
 */
export const OPTIMAL_LENGTHS = {
  headline: { min: 20, max: 80, ideal: { min: 35, max: 65 } },
  subheadline: { min: 40, max: 150, ideal: { min: 60, max: 120 } },
  serviceDescription: { min: 50, max: 150, ideal: { min: 70, max: 120 } },
  whyUsDescription: { min: 40, max: 120, ideal: { min: 50, max: 100 } },
  aboutSnippet: { min: 100, max: 300, ideal: { min: 150, max: 250 } },
  metaDescription: { min: 120, max: 160, ideal: { min: 140, max: 155 } },
  ctaText: { min: 8, max: 25, ideal: { min: 10, max: 20 } }
};

export function checkContentLength(content, contentType) {
  const config = OPTIMAL_LENGTHS[contentType];
  if (!config) return { isOptimal: true, isAcceptable: true };

  const length = content?.length || 0;

  const result = {
    length,
    contentType,
    isOptimal: length >= config.ideal.min && length <= config.ideal.max,
    isAcceptable: length >= config.min && length <= config.max,
    issue: null
  };

  if (length < config.min) {
    result.issue = `Too short (${length} chars). Minimum: ${config.min}, Ideal: ${config.ideal.min}-${config.ideal.max}`;
  } else if (length > config.max) {
    result.issue = `Too long (${length} chars). Maximum: ${config.max}, Ideal: ${config.ideal.min}-${config.ideal.max}`;
  } else if (!result.isOptimal) {
    if (length < config.ideal.min) {
      result.issue = `Slightly short (${length} chars). Ideal: ${config.ideal.min}-${config.ideal.max}`;
    } else {
      result.issue = `Slightly long (${length} chars). Ideal: ${config.ideal.min}-${config.ideal.max}`;
    }
  }

  return result;
}

/**
 * Generate improvement recommendations based on issues
 */
function generateRecommendations(issues, context) {
  const recommendations = [];

  const hasCliche = issues.some(i => i.type === 'cliche');
  const hasGeneric = issues.some(i => i.type === 'generic');
  const hasSpecificityIssue = issues.some(i => i.type === 'specificity');

  if (hasCliche) {
    recommendations.push({
      priority: 'high',
      action: 'Replace clichés with specific differentiators',
      examples: context.trustSignals ? buildTrustExamples(context.trustSignals) : [
        'Mention specific years in business',
        'Include license numbers or certifications',
        'Reference actual customer count or reviews'
      ]
    });
  }

  if (hasGeneric) {
    recommendations.push({
      priority: 'medium',
      action: 'Make content more specific to this business',
      examples: [
        `Include "${context.businessName || 'business name'}" in the content`,
        `Reference "${context.city || 'location'}" for local relevance`,
        'Mention specific services by name'
      ]
    });
  }

  if (hasSpecificityIssue) {
    recommendations.push({
      priority: 'low',
      action: 'Add local/personal touch',
      examples: [
        'Mention the city or neighborhood served',
        'Reference local landmarks or community'
      ]
    });
  }

  return recommendations;
}

/**
 * Build examples from trust signals
 */
function buildTrustExamples(trustSignals) {
  const examples = [];

  if (trustSignals.yearsInBusiness) {
    examples.push(`"${trustSignals.yearsInBusiness}+ years serving [city]"`);
  }
  if (trustSignals.certifications && trustSignals.certifications.length > 0) {
    examples.push(`"${trustSignals.certifications.slice(0, 2).join(', ')} professionals"`);
  }
  if (trustSignals.customerCount) {
    examples.push(`"Trusted by ${trustSignals.customerCount} customers"`);
  }
  if (trustSignals.guarantees && trustSignals.guarantees.length > 0) {
    examples.push(`"${trustSignals.guarantees[0]}"`);
  }

  return examples.length > 0 ? examples : ['Use specific data from the business'];
}

/**
 * Quick check if content contains clichés (for filtering)
 */
export function hasCliche(content) {
  if (!content) return false;
  const contentLower = content.toLowerCase();
  return CLICHE_BLOCKLIST.some(cliche => contentLower.includes(cliche.toLowerCase()));
}

/**
 * Get a rejection reason for AI regeneration
 */
export function getRegenerationPrompt(validationResult) {
  if (validationResult.isValid) return null;

  const cliches = validationResult.issues
    .filter(i => i.type === 'cliche')
    .map(i => `"${i.text}"`);

  const generics = validationResult.issues
    .filter(i => i.type === 'generic')
    .map(i => `"${i.text}"`);

  let prompt = 'The previous content was rejected because:\n';

  if (cliches.length > 0) {
    prompt += `- Contains clichés: ${cliches.join(', ')}\n`;
    prompt += '  → Use specific, unique value propositions instead\n';
  }

  if (generics.length > 0) {
    prompt += `- Too generic: ${generics.join(', ')}\n`;
    prompt += '  → Include specific business details, location, or trust signals\n';
  }

  prompt += '\nPlease regenerate with more specific, unique content.';

  return prompt;
}

/**
 * COMPREHENSIVE QUALITY ASSESSMENT
 * Combines all quality checks into a single quality report
 * @param {Object} content - Generated content object
 * @param {Object} context - Business context
 * @param {string} industry - Industry type
 * @returns {Object} Complete quality assessment
 */
export function assessContentQuality(content, context = {}, industry = 'general') {
  const assessment = {
    overallScore: 0,
    grade: 'F',
    isPublishReady: false,
    checks: {},
    issues: [],
    strengths: [],
    recommendations: []
  };

  if (!content) {
    assessment.issues.push('No content provided');
    return assessment;
  }

  // 1. Headline Quality
  const headlineCheck = validateHeadlineStructure(content.headline, context);
  assessment.checks.headline = {
    score: headlineCheck.score,
    issues: headlineCheck.issues,
    strengths: headlineCheck.strengths
  };
  if (headlineCheck.score >= 70) {
    assessment.strengths.push('Strong headline');
  } else {
    assessment.issues.push('Headline needs improvement');
  }

  // 2. Cliché Detection
  const headlineValidation = validateHeadline(content.headline, context);
  const subheadlineValidation = validateContent(content.subheadline || '', context);
  const clicheCount =
    headlineValidation.issues.filter(i => i.type === 'cliche').length +
    subheadlineValidation.issues.filter(i => i.type === 'cliche').length;

  assessment.checks.cliches = {
    score: Math.max(0, 100 - (clicheCount * 25)),
    count: clicheCount,
    found: [
      ...headlineValidation.issues.filter(i => i.type === 'cliche').map(i => i.text),
      ...subheadlineValidation.issues.filter(i => i.type === 'cliche').map(i => i.text)
    ]
  };
  if (clicheCount === 0) {
    assessment.strengths.push('No clichés detected');
  } else {
    assessment.issues.push(`${clicheCount} cliché(s) found`);
    assessment.recommendations.push('Replace clichés with specific, unique phrases');
  }

  // 3. CTA Effectiveness
  const ctaCheck = scoreCTAEffectiveness(content.ctaPrimary);
  assessment.checks.cta = {
    score: ctaCheck.score,
    grade: ctaCheck.grade,
    suggestions: ctaCheck.suggestions
  };
  if (ctaCheck.score >= 60) {
    assessment.strengths.push('Effective call-to-action');
  } else {
    assessment.issues.push('CTA could be stronger');
    assessment.recommendations.push('Use action verbs with specific benefits in CTA');
  }

  // 4. Emotional Resonance
  const emotionalCheck = checkEmotionalResonance(
    `${content.headline} ${content.subheadline} ${content.aboutSnippet || ''}`,
    industry
  );
  assessment.checks.emotional = {
    score: emotionalCheck.score,
    triggers: emotionalCheck.triggers,
    missing: emotionalCheck.missing.slice(0, 2)
  };
  if (emotionalCheck.score >= 40) {
    assessment.strengths.push('Good emotional engagement');
  } else {
    assessment.recommendations.push('Add emotional triggers: ' +
      emotionalCheck.missing.slice(0, 2).map(m => m.description).join(', '));
  }

  // 5. Content Temperature
  const tempCheck = checkContentTemperature(
    `${content.headline} ${content.subheadline}`,
    context
  );
  assessment.checks.temperature = {
    score: tempCheck.score,
    label: tempCheck.temperature,
    isIdeal: tempCheck.temperature === 'neutral'
  };
  if (tempCheck.temperature === 'neutral') {
    assessment.strengths.push('Balanced tone (not too cold or salesy)');
  } else if (tempCheck.temperature === 'cold' || tempCheck.temperature === 'cool') {
    assessment.issues.push('Content feels generic');
    assessment.recommendations.push('Add specific details and personality');
  } else {
    assessment.issues.push('Content feels too salesy');
    assessment.recommendations.push('Tone down urgency and superlatives');
  }

  // 6. Readability
  const readabilityCheck = calculateReadability(
    `${content.headline}. ${content.subheadline}. ${content.aboutSnippet || ''}`
  );
  assessment.checks.readability = {
    score: readabilityCheck.score,
    grade: readabilityCheck.grade,
    isIdeal: readabilityCheck.isIdeal
  };
  if (readabilityCheck.isIdeal) {
    assessment.strengths.push('Easy to read (good readability)');
  } else if (readabilityCheck.score < 50) {
    assessment.recommendations.push('Simplify sentence structure for easier reading');
  }

  // 7. Length Checks
  const lengthIssues = [];
  const headlineLength = checkContentLength(content.headline, 'headline');
  const subheadlineLength = checkContentLength(content.subheadline, 'subheadline');
  const ctaLength = checkContentLength(content.ctaPrimary, 'ctaText');

  if (!headlineLength.isAcceptable) lengthIssues.push(`Headline: ${headlineLength.issue}`);
  if (!subheadlineLength.isAcceptable) lengthIssues.push(`Subheadline: ${subheadlineLength.issue}`);
  if (!ctaLength.isAcceptable) lengthIssues.push(`CTA: ${ctaLength.issue}`);

  assessment.checks.lengths = {
    headline: headlineLength,
    subheadline: subheadlineLength,
    cta: ctaLength,
    allOptimal: headlineLength.isOptimal && subheadlineLength.isOptimal && ctaLength.isOptimal
  };
  if (lengthIssues.length > 0) {
    assessment.recommendations.push(...lengthIssues);
  }

  // Calculate overall score (weighted average)
  const weights = {
    headline: 0.25,
    cliches: 0.25,
    cta: 0.15,
    emotional: 0.15,
    temperature: 0.10,
    readability: 0.10
  };

  // Normalize temperature score (50 is ideal, so map to 0-100 where 50 = 100)
  const tempScore = 100 - Math.abs(assessment.checks.temperature.score - 50) * 2;

  assessment.overallScore = Math.round(
    assessment.checks.headline.score * weights.headline +
    assessment.checks.cliches.score * weights.cliches +
    assessment.checks.cta.score * weights.cta +
    assessment.checks.emotional.score * weights.emotional +
    tempScore * weights.temperature +
    assessment.checks.readability.score * weights.readability
  );

  // Determine grade
  if (assessment.overallScore >= 85) assessment.grade = 'A';
  else if (assessment.overallScore >= 70) assessment.grade = 'B';
  else if (assessment.overallScore >= 55) assessment.grade = 'C';
  else if (assessment.overallScore >= 40) assessment.grade = 'D';
  else assessment.grade = 'F';

  // Determine if publish-ready
  assessment.isPublishReady =
    assessment.overallScore >= 65 &&
    assessment.checks.cliches.count === 0 &&
    assessment.checks.headline.score >= 60;

  return assessment;
}

export default {
  validateContent,
  validateHeadline,
  validateHeadlineStructure,
  validateCTA,
  scoreCTAEffectiveness,
  checkEmotionalResonance,
  checkContentTemperature,
  calculateReadability,
  checkContentLength,
  assessContentQuality,
  hasCliche,
  getRegenerationPrompt,
  OPTIMAL_LENGTHS
};
