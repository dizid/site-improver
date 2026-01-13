// src/variantGenerator.js
// Multi-variant content generation with automatic best selection
// Generates multiple content angles and picks the highest scoring variant

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity } from './utils.js';
import { getIndustryContent } from './industryContent.js';
import {
  validateContent,
  validateHeadline,
  validateHeadlineStructure,
  scoreCTAEffectiveness,
  checkEmotionalResonance,
  checkContentTemperature,
  calculateReadability
} from './contentValidator.js';
import { generateHeadlineOptions } from './headlineFormulas.js';
import { getToneProfile, generateToneGuidance, scoreToneMatch } from './toneProfiles.js';

const log = logger.child('variantGenerator');

/**
 * Content generation angles/approaches
 * Each angle takes a different approach to the same content
 */
const GENERATION_ANGLES = {
  trustSignal: {
    name: 'Trust Signal Lead',
    description: 'Lead with the strongest trust signal (years, certifications, reviews)',
    promptAddition: `
APPROACH: Lead with your strongest trust credential.
- Open the headline with years in business, customer count, or rating
- Emphasize credentials and proof points throughout
- Build confidence through specific, verifiable facts`
  },

  painPoint: {
    name: 'Pain Point Lead',
    description: 'Lead by addressing the customer\'s primary frustration',
    promptAddition: `
APPROACH: Lead with the customer's pain point.
- Open by acknowledging what frustrates customers in this industry
- Position the business as the solution to that specific problem
- Use empathetic language that shows understanding`
  },

  boldPromise: {
    name: 'Bold Promise Lead',
    description: 'Lead with a compelling guarantee or promise',
    promptAddition: `
APPROACH: Lead with a bold, credible promise.
- Open with a guarantee, warranty, or commitment
- Make a specific promise (time, quality, satisfaction)
- Back it up with how you deliver on that promise`
  },

  localConnection: {
    name: 'Local Connection Lead',
    description: 'Lead with local expertise and community ties',
    promptAddition: `
APPROACH: Lead with local expertise and community connection.
- Open by emphasizing local roots and knowledge
- Reference specific neighborhoods or local landmarks
- Position as a neighbor, not just a service provider`
  },

  resultsFocused: {
    name: 'Results Focused Lead',
    description: 'Lead with specific outcomes and results',
    promptAddition: `
APPROACH: Lead with specific results and outcomes.
- Open with what customers will get (not what you do)
- Use numbers: time saved, money saved, problems solved
- Focus on the transformation/improvement they'll experience`
  }
};

/**
 * Score weights for variant comparison
 */
const SCORE_WEIGHTS = {
  headlineScore: 0.25,      // Headline quality
  clicheScore: 0.30,        // Absence of clichés
  ctaScore: 0.15,           // CTA effectiveness
  emotionalScore: 0.15,     // Emotional resonance
  toneScore: 0.10,          // Industry tone match
  temperatureScore: 0.05    // Content temperature
};

/**
 * VariantGenerator class
 * Generates multiple content variants in parallel and selects the best
 */
export class VariantGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.client = null;
    this.variantCount = CONFIG.contentGeneration?.variantCount || 3;
    this.maxRetries = CONFIG.contentGeneration?.maxRetries || 4;
  }

  getClient() {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /**
   * Generate multiple content variants and select the best
   * @param {Object} siteData - Scraped site data
   * @param {string} industry - Industry type
   * @returns {Object} Best variant with metadata
   */
  async generateBestContent(siteData, industry) {
    const startTime = Date.now();
    log.info('Starting multi-variant generation', {
      business: siteData.businessName,
      industry,
      variantCount: this.variantCount
    });

    const context = this.buildContext(siteData, industry);

    // Select angles based on available trust signals
    const selectedAngles = this.selectAngles(context);

    // Generate variants in parallel
    const variantPromises = selectedAngles.map((angle, index) =>
      this.generateVariant(context, industry, angle, index)
    );

    const variants = await Promise.allSettled(variantPromises);

    // Filter successful variants
    const successfulVariants = variants
      .filter(v => v.status === 'fulfilled' && v.value)
      .map(v => v.value);

    if (successfulVariants.length === 0) {
      log.error('All variant generations failed');
      return this.getFallbackContent(siteData, industry);
    }

    // Score each variant
    const scoredVariants = successfulVariants.map(variant =>
      this.scoreVariant(variant, context, industry)
    );

    // Sort by total score (descending)
    scoredVariants.sort((a, b) => b.totalScore - a.totalScore);

    const best = scoredVariants[0];

    log.info('Multi-variant generation complete', {
      business: siteData.businessName,
      variantsGenerated: successfulVariants.length,
      bestAngle: best.angle,
      bestScore: best.totalScore,
      duration: `${Date.now() - startTime}ms`
    });

    return {
      ...best.content,
      // Preserve original business data
      businessName: siteData.businessName,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      hours: siteData.hours,
      // Add generation metadata
      generatedAt: new Date().toISOString(),
      generationTime: Date.now() - startTime,
      angle: best.angle,
      totalScore: best.totalScore,
      scoreBreakdown: best.scores,
      variantsGenerated: successfulVariants.length,
      allVariantScores: scoredVariants.map(v => ({
        angle: v.angle,
        score: v.totalScore
      }))
    };
  }

  /**
   * Build context from site data
   */
  buildContext(siteData, industry) {
    return {
      businessName: siteData.businessName || 'Local Business',
      industry: industry || 'general',
      language: siteData.language || 'en',
      city: extractCity(siteData.address) || siteData.city || null,
      address: siteData.address || null,
      phone: siteData.phone || null,
      email: siteData.email || null,
      scrapedHeadlines: (siteData.headlines || []).slice(0, 5),
      scrapedParagraphs: (siteData.paragraphs || []).slice(0, 3),
      scrapedServices: (siteData.services || []).slice(0, 10),
      scrapedTestimonials: (siteData.testimonials || []).slice(0, 3),
      rating: siteData.rating,
      reviewCount: siteData.reviewCount,
      trustSignals: siteData.trustSignals || {}
    };
  }

  /**
   * Select angles based on available trust signals
   * Prioritizes angles that can leverage available data
   */
  selectAngles(context) {
    const angles = [];
    const ts = context.trustSignals || {};

    // Always include trust signal lead if we have signals
    if (ts.yearsInBusiness || ts.customerCount || context.rating) {
      angles.push(GENERATION_ANGLES.trustSignal);
    }

    // Include pain point lead (always applicable)
    angles.push(GENERATION_ANGLES.painPoint);

    // Include bold promise if we have guarantees
    if (ts.guarantees?.length > 0) {
      angles.push(GENERATION_ANGLES.boldPromise);
    }

    // Include local connection if we have city
    if (context.city) {
      angles.push(GENERATION_ANGLES.localConnection);
    }

    // Include results focused
    angles.push(GENERATION_ANGLES.resultsFocused);

    // Return requested number of variants (or all if fewer available)
    return angles.slice(0, this.variantCount);
  }

  /**
   * Generate a single variant with a specific angle
   */
  async generateVariant(context, industry, angle, index) {
    const industryContent = getIndustryContent(industry);
    const toneGuidance = generateToneGuidance(industry);

    const systemPrompt = this.buildSystemPrompt(context.language, toneGuidance);
    const userPrompt = this.buildUserPrompt(context, industryContent, angle);

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const responseText = response.content[0].text.trim();
      const parsed = this.parseResponse(responseText);

      return {
        content: parsed,
        angle: angle.name,
        angleDescription: angle.description
      };
    } catch (error) {
      log.warn('Variant generation failed', {
        angle: angle.name,
        index,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Build system prompt with tone guidance
   */
  buildSystemPrompt(language, toneGuidance) {
    const languageNames = {
      nl: 'Dutch', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English'
    };
    const langName = languageNames[language] || 'English';

    return `You are an elite direct-response copywriter. Create content that CONVERTS.

CORE PRINCIPLES:
1. SPECIFICITY over generality - use numbers, credentials, location names
2. BENEFITS over features - what customers GET, not what you DO
3. CUSTOMER-FOCUSED - "you get" not "we provide"
4. CREDIBILITY through facts - real numbers, real credentials

${toneGuidance}

BANNED PHRASES (instant rejection):
"quality service", "trusted partner", "commitment to excellence", "passion for",
"go above and beyond", "satisfaction guaranteed", "dedicated team", "years of experience",
"state-of-the-art", "cutting-edge", "world-class", "one-stop shop"

Write ALL content in ${langName}. Return valid JSON only.`;
  }

  /**
   * Build user prompt with specific angle
   */
  buildUserPrompt(context, industryContent, angle) {
    const ts = context.trustSignals || {};

    const trustSignalText = this.formatTrustSignals(ts);
    const servicesText = context.scrapedServices.length > 0
      ? context.scrapedServices.join(', ')
      : industryContent?.services?.slice(0, 5).join(', ') || 'various services';

    return `Create website copy for: ${context.businessName} (${context.industry} in ${context.city || 'local area'})

${angle.promptAddition}

AVAILABLE DATA:
- Business: ${context.businessName}
- Location: ${context.city || 'Local area'}${context.address ? ` - ${context.address}` : ''}
${context.rating ? `- Rating: ${context.rating}/5 (${context.reviewCount || 'many'} reviews)` : ''}
${trustSignalText}
- Services: ${servicesText}

INDUSTRY PAIN POINTS: ${industryContent?.painPoints?.slice(0, 3).join(', ') || 'unreliable service, unclear pricing'}

GENERATE JSON:
{
  "headline": "5-10 word compelling headline using the ${angle.name} approach",
  "subheadline": "15-25 word supporting statement",
  "services": [{"name": "Service", "description": "20-30 word benefit-focused description", "icon": "icon-name"}],
  "whyUs": [{"title": "3-5 word title", "description": "15-25 word explanation"}],
  "testimonialIntro": "8-15 word section header",
  "ctaPrimary": "3-5 word action button",
  "ctaSecondary": "3-5 word secondary action",
  "aboutSnippet": "40-60 word about section",
  "metaDescription": "Max 155 chars SEO description"
}

Generate 4-6 services and 3-4 "Why Us" items.
Icons: wrench, shield, clock, star, users, home, phone, truck, award, heart, check, zap`;
  }

  /**
   * Format trust signals for prompt
   */
  formatTrustSignals(ts) {
    const lines = [];
    if (ts.yearsInBusiness) lines.push(`- ${ts.yearsInBusiness}+ years in business`);
    if (ts.customerCount) lines.push(`- ${ts.customerCount}+ customers served`);
    if (ts.certifications?.length) lines.push(`- Certifications: ${ts.certifications.join(', ')}`);
    if (ts.licenses?.length) lines.push(`- License: ${ts.licenses[0]}`);
    if (ts.guarantees?.length) lines.push(`- Guarantee: ${ts.guarantees[0]}`);
    return lines.length > 0 ? 'TRUST SIGNALS:\n' + lines.join('\n') : '';
  }

  /**
   * Score a variant across multiple dimensions
   */
  scoreVariant(variant, context, industry) {
    const content = variant.content;
    const scores = {};

    // 1. Headline score (structure + formulas)
    const headlineValidation = validateHeadlineStructure(content.headline, context);
    scores.headline = headlineValidation.score;

    // 2. Cliché score (higher = fewer clichés)
    const headlineContent = validateHeadline(content.headline, context);
    const subheadlineContent = validateContent(content.subheadline || '', context);
    const clicheIssues = [
      ...headlineContent.issues.filter(i => i.type === 'cliche'),
      ...subheadlineContent.issues.filter(i => i.type === 'cliche')
    ];
    scores.cliche = Math.max(0, 100 - (clicheIssues.length * 25));

    // 3. CTA score
    const ctaResult = scoreCTAEffectiveness(content.ctaPrimary);
    scores.cta = ctaResult.score;

    // 4. Emotional resonance score
    const emotionalResult = checkEmotionalResonance(
      `${content.headline} ${content.subheadline} ${content.aboutSnippet}`,
      industry
    );
    scores.emotional = emotionalResult.score;

    // 5. Tone match score
    const toneResult = scoreToneMatch(
      `${content.headline} ${content.subheadline}`,
      industry
    );
    scores.tone = toneResult.score;

    // 6. Temperature score (50 is ideal, penalize deviation)
    const tempResult = checkContentTemperature(
      `${content.headline} ${content.subheadline}`,
      context
    );
    scores.temperature = 100 - Math.abs(tempResult.score - 50) * 2;

    // Calculate weighted total
    const totalScore = Math.round(
      scores.headline * SCORE_WEIGHTS.headlineScore +
      scores.cliche * SCORE_WEIGHTS.clicheScore +
      scores.cta * SCORE_WEIGHTS.ctaScore +
      scores.emotional * SCORE_WEIGHTS.emotionalScore +
      scores.tone * SCORE_WEIGHTS.toneScore +
      scores.temperature * SCORE_WEIGHTS.temperatureScore
    );

    return {
      content: variant.content,
      angle: variant.angle,
      scores,
      totalScore
    };
  }

  /**
   * Parse AI response
   */
  parseResponse(responseText) {
    try {
      let jsonStr = responseText;

      // Handle markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        headline: parsed.headline || '',
        subheadline: parsed.subheadline || '',
        services: Array.isArray(parsed.services) ? parsed.services.slice(0, 8) : [],
        whyUs: Array.isArray(parsed.whyUs) ? parsed.whyUs.slice(0, 4) : [],
        testimonialIntro: parsed.testimonialIntro || 'What Our Customers Say',
        ctaPrimary: parsed.ctaPrimary || 'Get Started',
        ctaSecondary: parsed.ctaSecondary || 'Learn More',
        aboutSnippet: parsed.aboutSnippet || '',
        metaDescription: parsed.metaDescription || ''
      };
    } catch (error) {
      log.warn('Failed to parse variant response', { error: error.message });
      return null;
    }
  }

  /**
   * Fallback content when generation fails
   */
  getFallbackContent(siteData, industry) {
    const city = extractCity(siteData.address) || 'your area';
    const industryName = industry?.charAt(0).toUpperCase() + industry?.slice(1) || 'Services';

    return {
      headline: `Professional ${industryName} in ${city}`,
      subheadline: `Reliable, trusted service from local professionals.`,
      services: (siteData.services || []).slice(0, 6).map(name => ({
        name,
        description: `Professional ${name.toLowerCase()} services`,
        icon: 'star'
      })),
      whyUs: [
        { title: 'Local & Trusted', description: `Proudly serving ${city}` },
        { title: 'Quality Guaranteed', description: 'We stand behind every job' },
        { title: 'Experienced Team', description: 'Skilled professionals you can count on' }
      ],
      testimonialIntro: 'What Our Customers Say',
      ctaPrimary: 'Contact Us Today',
      ctaSecondary: 'Learn More',
      aboutSnippet: `${siteData.businessName || 'We'} provide quality ${industry || 'services'} to ${city}.`,
      metaDescription: `${siteData.businessName || 'Local'} ${industry || 'business'} in ${city}. Quality service.`,
      businessName: siteData.businessName,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      isFallback: true
    };
  }
}

export default VariantGenerator;
