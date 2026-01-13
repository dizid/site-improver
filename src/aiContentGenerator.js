// src/aiContentGenerator.js
// AI-First Content Generation - Generate ALL website content, not just polish

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity, safeParseJsonObject } from './utils.js';
import { getIndustryContent } from './industryContent.js';
import { validateContent, validateHeadline, getRegenerationPrompt, checkEmotionalResonance, scoreCTAEffectiveness } from './contentValidator.js';
import { generateHeadlineOptions, validateAgainstFormulas } from './headlineFormulas.js';
import { getToneProfile, generateToneGuidance } from './toneProfiles.js';

const log = logger.child('aiContentGenerator');

/**
 * AI Content Generator - Creates complete website copy from scraped data
 * Instead of polishing scraped content, this generates professional content
 * using scraped data as context/reference only.
 */
export class AIContentGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.client = null;
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
   * Generate complete website content from scraped site data
   * Includes validation and retry logic for cliché detection
   */
  async generateAllContent(siteData, industry, maxRetries = 2) {
    const startTime = Date.now();
    log.info('Generating all content with AI', {
      business: siteData.businessName,
      industry
    });

    // Build comprehensive context from scraped data
    const context = this.buildContext(siteData, industry);

    // Get industry-specific content hints
    const industryContent = getIndustryContent(industry);

    // Validation context for content checks
    const validationContext = {
      businessName: siteData.businessName,
      city: context.city,
      trustSignals: siteData.trustSignals
    };

    let attempt = 0;
    let rejectionFeedback = null;

    while (attempt <= maxRetries) {
      attempt++;

      // Build the comprehensive prompt (with rejection feedback if retrying)
      const prompt = this.buildComprehensivePrompt(context, industryContent, rejectionFeedback);

      try {
        const response = await this.getClient().messages.create({
          model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: this.getSystemPrompt(context.language, industry),
          messages: [{ role: 'user', content: prompt }]
        });

        const responseText = response.content[0].text.trim();

        // Parse JSON response
        const generated = this.parseResponse(responseText);

        // Validate content for clichés
        const validationResult = this.validateGeneratedContent(generated, validationContext);

        if (validationResult.isValid) {
          // Content passed validation
          const result = {
            ...generated,
            // Keep real business info
            businessName: siteData.businessName || generated.businessName,
            phone: siteData.phone,
            email: siteData.email,
            address: siteData.address,
            hours: siteData.hours,
            // Add metadata
            generatedAt: new Date().toISOString(),
            generationTime: Date.now() - startTime,
            validationScore: validationResult.score,
            attempts: attempt
          };

          log.info('Content generation complete', {
            business: result.businessName,
            duration: `${result.generationTime}ms`,
            attempts: attempt,
            score: validationResult.score
          });

          return result;

        } else if (attempt <= maxRetries) {
          // Content has clichés - prepare rejection feedback for retry
          rejectionFeedback = getRegenerationPrompt(validationResult);
          log.warn('Content rejected for clichés, retrying', {
            attempt,
            issues: validationResult.issues.length,
            cliches: validationResult.issues.filter(i => i.type === 'cliche').map(i => i.text)
          });
        } else {
          // Final attempt also failed - log warning but use content
          log.warn('Content still has clichés after retries, using anyway', {
            issues: validationResult.issues.length,
            score: validationResult.score
          });

          return {
            ...generated,
            businessName: siteData.businessName || generated.businessName,
            phone: siteData.phone,
            email: siteData.email,
            address: siteData.address,
            hours: siteData.hours,
            generatedAt: new Date().toISOString(),
            generationTime: Date.now() - startTime,
            validationScore: validationResult.score,
            attempts: attempt,
            hasUnresolvedIssues: true,
            validationIssues: validationResult.issues
          };
        }

      } catch (error) {
        log.error('AI content generation failed', { error: error.message, attempt });
        if (attempt > maxRetries) {
          // Return fallback content
          return this.getFallbackContent(siteData, industry);
        }
      }
    }

    // Shouldn't reach here, but return fallback just in case
    return this.getFallbackContent(siteData, industry);
  }

  /**
   * Validate generated content for clichés and quality
   */
  validateGeneratedContent(generated, context) {
    const allIssues = [];
    let totalScore = 100;

    // Validate headline
    if (generated.headline) {
      const headlineResult = validateHeadline(generated.headline, context);
      allIssues.push(...headlineResult.issues);
      if (!headlineResult.isValid) {
        totalScore -= 20;
      }
    }

    // Validate subheadline
    if (generated.subheadline) {
      const subResult = validateContent(generated.subheadline, context);
      allIssues.push(...subResult.issues);
      if (!subResult.isValid) {
        totalScore -= 15;
      }
    }

    // Validate about snippet
    if (generated.aboutSnippet) {
      const aboutResult = validateContent(generated.aboutSnippet, context);
      allIssues.push(...aboutResult.issues);
      if (!aboutResult.isValid) {
        totalScore -= 15;
      }
    }

    // Check service descriptions
    if (generated.services && Array.isArray(generated.services)) {
      for (const service of generated.services) {
        if (service.description) {
          const serviceResult = validateContent(service.description, context);
          // Only add high-severity issues from services
          const criticalIssues = serviceResult.issues.filter(i => i.severity === 'high' || i.severity === 'critical');
          allIssues.push(...criticalIssues);
        }
      }
    }

    // Determine if valid (no high/critical issues)
    const criticalIssues = allIssues.filter(i => i.severity === 'critical' || i.severity === 'high');
    const isValid = criticalIssues.length === 0;

    return {
      isValid,
      issues: allIssues,
      score: Math.max(0, totalScore)
    };
  }

  getSystemPrompt(language = 'en', industry = 'general') {
    const languageNames = {
      nl: 'Dutch', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English'
    };
    const langName = languageNames[language] || 'English';

    // Get industry-specific tone guidance
    const toneGuidance = generateToneGuidance(industry);

    return `You are an elite direct-response copywriter trained by legends like David Ogilvy, Gary Halbert, and Eugene Schwartz. You write copy that CONVERTS - not just sounds good.

YOUR MISSION: Create website copy that turns visitors into customers. Every word must earn its place.

COPYWRITING PRINCIPLES YOU MUST FOLLOW:

1. SPECIFICITY BEATS GENERALITY
   ❌ "Quality service" → ✅ "37 years serving Boston. 4,200+ happy customers."
   ❌ "Trusted professionals" → ✅ "Licensed #12345. BBB A+ rated since 2010."
   ❌ "Great prices" → ✅ "Average job: $185. Free estimates, always."

2. BENEFITS OVER FEATURES
   ❌ "We use advanced equipment" → ✅ "Your problem fixed in hours, not days"
   ❌ "Our team is experienced" → ✅ "Sleep easy knowing it's done right"
   ❌ "We offer many services" → ✅ "One call handles everything"

3. CUSTOMER-FOCUSED LANGUAGE
   ❌ "We pride ourselves..." → ✅ "You get..."
   ❌ "Our company offers..." → ✅ "Your home gets..."
   ❌ "We believe in..." → ✅ "You deserve..."

4. CREDIBILITY THROUGH FACTS
   - Use specific numbers (years, customers, ratings)
   - Reference real credentials (licenses, certifications)
   - Mention local areas by name
   - Include guarantees and warranties

5. EMOTIONAL RESONANCE
   - Address the customer's pain points
   - Paint a picture of the desired outcome
   - Use sensory and emotional language
   - Create a sense of relief/satisfaction

${toneGuidance}

ABSOLUTE BANS (using these phrases will get your content rejected):
- "quality service" / "trusted partner" / "one-stop shop"
- "state-of-the-art" / "cutting-edge" / "world-class"
- "commitment to excellence" / "passion for" / "go above and beyond"
- "your satisfaction is our priority" / "we treat you like family"
- "dedicated team of professionals" / "years of combined experience"
- Generic openers: "Welcome to..." / "We are a..." / "About us..."

CRITICAL: Write ALL content in ${langName}. Match the language and cultural tone of the target market.

OUTPUT: Return valid JSON only. No markdown, no explanations, just the JSON object.`;
  }

  buildContext(siteData, industry) {
    return {
      businessName: siteData.businessName || 'Local Business',
      industry: industry || 'general',
      language: siteData.language || 'en',
      city: extractCity(siteData.address) || siteData.city || null,
      address: siteData.address || null,
      phone: siteData.phone || null,
      email: siteData.email || null,
      // Scraped content for reference (but we'll generate better versions)
      scrapedHeadlines: (siteData.headlines || []).slice(0, 5),
      scrapedParagraphs: (siteData.paragraphs || []).slice(0, 3),
      scrapedServices: (siteData.services || []).slice(0, 10),
      scrapedTestimonials: (siteData.testimonials || []).slice(0, 3),
      // Ratings/reviews if available
      rating: siteData.rating,
      reviewCount: siteData.reviewCount,
      // Trust signals for specific, credible content
      trustSignals: siteData.trustSignals || null
    };
  }

  /**
   * Build trust signal context string for inclusion in prompts
   */
  buildTrustSignalContext(trustSignals) {
    if (!trustSignals) return '';

    const lines = [];

    if (trustSignals.yearsInBusiness) {
      lines.push(`- ${trustSignals.yearsInBusiness}+ years in business`);
    }
    if (trustSignals.foundedYear) {
      lines.push(`- Established ${trustSignals.foundedYear}`);
    }
    if (trustSignals.certifications && trustSignals.certifications.length > 0) {
      lines.push(`- Credentials: ${trustSignals.certifications.join(', ')}`);
    }
    if (trustSignals.licenses && trustSignals.licenses.length > 0) {
      lines.push(`- License: ${trustSignals.licenses[0]}`);
    }
    if (trustSignals.customerCount) {
      lines.push(`- ${trustSignals.customerCount} customers served`);
    }
    if (trustSignals.awards && trustSignals.awards.length > 0) {
      lines.push(`- Awards: ${trustSignals.awards.slice(0, 2).join(', ')}`);
    }
    if (trustSignals.guarantees && trustSignals.guarantees.length > 0) {
      lines.push(`- Guarantees: ${trustSignals.guarantees.join(', ')}`);
    }
    if (trustSignals.serviceAreas && trustSignals.serviceAreas.length > 0) {
      lines.push(`- Service areas: ${trustSignals.serviceAreas.slice(0, 3).join(', ')}`);
    }

    if (lines.length === 0) return '';

    return `\nTRUST SIGNALS (use these specific facts to make content credible):\n${lines.join('\n')}`;
  }

  /**
   * Generate headline examples using the headline formulas module
   */
  generateHeadlineExamples(context) {
    try {
      // Build site data structure for headline formulas
      const siteData = {
        businessName: context.businessName,
        address: context.address,
        city: context.city,
        trustSignals: context.trustSignals,
        rating: context.rating,
        reviewCount: context.reviewCount
      };

      // Generate headline options
      const options = generateHeadlineOptions(siteData, context.industry);

      if (options.length === 0) {
        return '- Use specific numbers and location in headlines\n- Focus on customer benefits, not business features';
      }

      // Format as prompt examples
      return options
        .slice(0, 3)
        .map((opt, i) => `${i + 1}. "${opt.text}" (${opt.category})`)
        .join('\n');
    } catch (error) {
      log.warn('Failed to generate headline examples', { error: error.message });
      return '- Use specific numbers and location in headlines\n- Focus on customer benefits, not business features';
    }
  }

  buildComprehensivePrompt(context, industryContent, rejectionFeedback = null) {
    const servicesHint = context.scrapedServices.length > 0
      ? `Services found on site: ${context.scrapedServices.join(', ')}`
      : `Typical ${context.industry} services might include: ${industryContent?.services?.slice(0, 4).join(', ') || 'various services'}`;

    const locationHint = context.city
      ? `Located in ${context.city}${context.address ? ` at ${context.address}` : ''}`
      : 'Serves local area';

    const testimonialHint = context.scrapedTestimonials.length > 0
      ? `\nReal testimonials found:\n${context.scrapedTestimonials.map(t => `- "${t.text?.substring(0, 100)}..." - ${t.author || 'Customer'}`).join('\n')}`
      : '';

    const trustSignalContext = this.buildTrustSignalContext(context.trustSignals);

    const rejectionSection = rejectionFeedback
      ? `\n⚠️ PREVIOUS ATTEMPT REJECTED:\n${rejectionFeedback}\n`
      : '';

    // Generate headline examples from formulas
    const headlineExamples = this.generateHeadlineExamples(context);

    return `Create complete website copy for this ${context.industry} business:
${rejectionSection}
BUSINESS INFO:
- Name: ${context.businessName}
- Industry: ${context.industry}
- ${locationHint}
${context.rating ? `- Rating: ${context.rating}/5 (${context.reviewCount || 'many'} reviews)` : ''}
${trustSignalContext}

CONTENT REFERENCE (from their current site - use for context, but write BETTER versions):
- Headlines found: ${context.scrapedHeadlines.slice(0, 3).join(' | ') || 'None found'}
- ${servicesHint}
${testimonialHint}

INDUSTRY CONTEXT:
- Customer pain points: ${industryContent?.painPoints?.slice(0, 2).join('; ') || 'Need reliable, quality service'}
- Key benefits to highlight: ${industryContent?.benefits?.slice(0, 2).join('; ') || 'Professional, trustworthy service'}

📝 HEADLINE INSPIRATION (use these patterns, adapt to this business):
${headlineExamples}

⛔ FORBIDDEN PHRASES (never use these - they are generic clichés):
- "quality service", "trusted partner", "one-stop shop", "solutions for all your needs"
- "state-of-the-art", "cutting-edge", "world-class", "best in class", "second to none"
- "commitment to excellence", "dedicated team of professionals", "years of combined experience"
- "customer satisfaction guaranteed", "we go above and beyond", "passion for"
- "industry-leading", "top-notch", "unparalleled service", "unmatched quality"

✅ INSTEAD, USE:
- Specific numbers: "Serving Boston since 1987" not "Serving you for years"
- Concrete facts: "Licensed, Insured, BBB A+" not "Trusted professionals"
- Local specificity: "North Shore's go-to plumber" not "Your local expert"

GENERATE THIS JSON (all fields required):
{
  "headline": "5-10 word compelling headline - grab attention, show value",
  "subheadline": "15-25 word supporting statement - expand on headline, build interest",
  "services": [
    {
      "name": "Service name",
      "description": "20-30 word benefit-focused description",
      "icon": "appropriate-icon-name"
    }
  ],
  "whyUs": [
    {
      "title": "3-5 word title",
      "description": "15-25 word explanation of this benefit"
    }
  ],
  "testimonialIntro": "8-15 word section header for testimonials",
  "ctaPrimary": "3-5 word primary call-to-action button",
  "ctaSecondary": "3-5 word secondary call-to-action",
  "aboutSnippet": "40-60 word about section - build trust, show expertise",
  "metaDescription": "Max 155 chars - SEO description with location and services"
}

REQUIREMENTS:
- Generate 4-6 services (use scraped services as starting point, but write compelling descriptions)
- Generate 3-4 "Why Us" items (e.g., experienced, licensed, local, guaranteed)
- Make everything specific to ${context.businessName} and ${context.city || 'their area'}
- Icon names should be: wrench, shield, clock, star, users, home, phone, truck, award, heart, check, zap
- USE the trust signals above to create specific, credible content
- NEVER use generic phrases - every sentence must be specific to THIS business`;
  }

  parseResponse(responseText) {
    try {
      // Try to extract JSON from response
      let jsonStr = responseText;

      // Handle if wrapped in markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      return {
        headline: parsed.headline || 'Quality Service You Can Trust',
        subheadline: parsed.subheadline || 'Professional solutions for all your needs',
        services: Array.isArray(parsed.services) ? parsed.services.slice(0, 8) : [],
        whyUs: Array.isArray(parsed.whyUs) ? parsed.whyUs.slice(0, 4) : [],
        testimonialIntro: parsed.testimonialIntro || 'What Our Customers Say',
        ctaPrimary: parsed.ctaPrimary || 'Get Started',
        ctaSecondary: parsed.ctaSecondary || 'Learn More',
        aboutSnippet: parsed.aboutSnippet || '',
        metaDescription: parsed.metaDescription || ''
      };
    } catch (error) {
      log.warn('Failed to parse AI response as JSON', { error: error.message });
      return this.getEmptyContent();
    }
  }

  getEmptyContent() {
    return {
      headline: '',
      subheadline: '',
      services: [],
      whyUs: [],
      testimonialIntro: 'What Our Customers Say',
      ctaPrimary: 'Get Started',
      ctaSecondary: 'Learn More',
      aboutSnippet: '',
      metaDescription: ''
    };
  }

  getFallbackContent(siteData, industry) {
    const industryContent = getIndustryContent(industry);
    const city = extractCity(siteData.address) || 'your area';

    return {
      headline: `Quality ${industry || 'Services'} in ${city}`,
      subheadline: `Professional, reliable service from a trusted local business.`,
      services: (siteData.services || []).slice(0, 6).map(name => ({
        name,
        description: `Professional ${name.toLowerCase()} services`,
        icon: 'star'
      })),
      whyUs: [
        { title: 'Local & Trusted', description: `Proudly serving ${city} and surrounding areas` },
        { title: 'Quality Guaranteed', description: 'We stand behind every job we do' },
        { title: 'Experienced Team', description: 'Skilled professionals you can count on' }
      ],
      testimonialIntro: 'What Our Customers Say',
      ctaPrimary: 'Contact Us Today',
      ctaSecondary: 'Learn More',
      aboutSnippet: `${siteData.businessName || 'We'} provide quality ${industry || 'services'} to ${city} and the surrounding area.`,
      metaDescription: `${siteData.businessName || 'Local'} ${industry || 'business'} in ${city}. Quality service, fair prices.`,
      businessName: siteData.businessName,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      isFallback: true
    };
  }
}

export default AIContentGenerator;
