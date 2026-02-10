// src/aiContentGenerator.js
// AI-First Content Generation - Generate ALL website content, not just polish

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity, safeParseJsonObject } from './utils.js';
import { getIndustryContent } from './industryContent.js';
import { validateContent, validateHeadline, getRegenerationPrompt, checkEmotionalResonance, scoreCTAEffectiveness, assessContentQuality, hasCliche } from './contentValidator.js';
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
   * CONSOLIDATED: Single API call generates brand voice, headlines, and all content
   */
  async generateAllContent(siteData, industry, maxRetries = 2) {
    const startTime = Date.now();
    log.info('Generating all content with AI (consolidated call)', {
      business: siteData.businessName,
      industry
    });

    // Build comprehensive context from scraped data
    const context = this.buildContext(siteData, industry);

    // Get industry-specific content hints
    const industryContent = getIndustryContent(industry);

    // Get seasonal context for this industry
    const seasonalContext = this.getSeasonalContext(industry);

    // Get readability target for this industry
    const readabilityTarget = this.getReadabilityTarget(industry);

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
      const prompt = this.buildComprehensivePrompt(context, industryContent, rejectionFeedback, {
        seasonalContext,
        readabilityTarget
      });

      try {
        const response = await this.getClient().messages.create({
          model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
          max_tokens: 2500,
          system: this.getSystemPrompt(context.language, industry),
          messages: [{ role: 'user', content: prompt }]
        });

        const responseText = response.content[0].text.trim();

        // Parse JSON response (now includes brandVoice and headlineVariants)
        const generated = this.parseResponse(responseText);

        // Extract brand voice from response if present
        const brandVoice = generated.brandVoice || null;

        // Score headline variants if present and pick the best one
        if (generated.headlineVariants && Array.isArray(generated.headlineVariants) && generated.headlineVariants.length > 0) {
          const scored = generated.headlineVariants.map(headline => {
            const mockContent = { headline, subheadline: generated.subheadline || '', ctaPrimary: '', aboutSnippet: '' };
            const assessment = assessContentQuality(mockContent, validationContext, industry);
            return { headline, score: assessment.scores?.headline || assessment.overallScore };
          });

          // Sort by score descending
          scored.sort((a, b) => b.score - a.score);

          log.info('Headline variants scored', {
            variants: scored.map(v => ({ headline: v.headline.substring(0, 50), score: v.score })),
            winner: scored[0].headline.substring(0, 50)
          });

          // Use the best headline
          generated.headline = scored[0].headline;
        }

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
            attempts: attempt,
            brandVoice: brandVoice
          };

          log.info('Content generation complete', {
            business: result.businessName,
            duration: `${result.generationTime}ms`,
            attempts: attempt,
            score: validationResult.score,
            brandVoice: brandVoice ? `${brandVoice.formality}/${brandVoice.tone}` : 'defaults'
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

STEP 1: ANALYZE THE ORIGINAL SITE'S BRAND VOICE
Before writing, analyze the original content to match their voice:
- formality: "formal" (corporate, polished), "casual" (relaxed, conversational), or "neutral" (balanced)
- techLevel: "high" (jargon-heavy), "medium" (some technical), or "low" (plain language)
- tone: "serious" (authoritative), "warm" (friendly), or "playful" (humorous)

STEP 2: GENERATE 3 HEADLINE VARIANTS
Create 3 different headline options (5-10 words each):
- Variant 1: Social proof angle (ratings, customers served, years in business)
- Variant 2: Pain point + solution angle (problem → fix)
- Variant 3: Local authority angle (location + specialty + credential)

STEP 3: WRITE COMPLETE CONTENT

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

  buildComprehensivePrompt(context, industryContent, rejectionFeedback = null, options = {}) {
    const { seasonalContext, readabilityTarget } = options;
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
${seasonalContext ? `
📅 SEASONAL CONTEXT (current season priority):
- ${seasonalContext}
Weave seasonal relevance into headlines or service descriptions where natural.` : ''}
${readabilityTarget ? `
📖 READABILITY TARGET:
- Write at a ${readabilityTarget.label} level (Grade ${readabilityTarget.min}-${readabilityTarget.max})
- Use short sentences. Avoid complex words when simple ones work.` : ''}

GENERATE THIS JSON (all fields required):
{
  "brandVoice": {
    "formality": "formal|casual|neutral",
    "techLevel": "high|medium|low",
    "tone": "serious|warm|playful"
  },
  "headlineVariants": ["headline option 1 (5-10 words)", "headline option 2 (5-10 words)", "headline option 3 (5-10 words)"],
  "headline": "Your recommended best headline from the 3 variants above",
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
        brandVoice: parsed.brandVoice || null,
        headlineVariants: Array.isArray(parsed.headlineVariants) ? parsed.headlineVariants.slice(0, 3) : [],
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

  /**
   * @deprecated This method is no longer used. Headline variants are now generated
   * in the main consolidated generateAllContent() call to save API costs.
   * Kept for backwards compatibility with tests.
   *
   * Generate multiple headline variants and pick the best one
   * Uses a single API call returning multiple variants for cost efficiency
   */
  async generateHeadlineVariants(siteData, industry, count = 3) {
    const context = this.buildContext(siteData, industry);
    const industryContent = getIndustryContent(industry);
    const trustSignalContext = this.buildTrustSignalContext(context.trustSignals);

    const prompt = `Generate exactly ${count} different headline variants for this ${context.industry} business website.

BUSINESS:
- Name: ${context.businessName}
- Industry: ${context.industry}
- Location: ${context.city || 'local area'}
${context.rating ? `- Rating: ${context.rating}/5 (${context.reviewCount || 'many'} reviews)` : ''}
${trustSignalContext}

Each headline must be:
- 5-10 words
- Specific to this business (use real numbers, location, credentials)
- Free of clichés ("quality service", "trusted partner", etc.)
- Different angles (e.g., social proof, pain point, speed, local authority)

Return valid JSON only:
{"variants": ["headline 1", "headline 2", "headline 3"]}`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: 'You are a headline copywriter. Return valid JSON only. No markdown.',
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0].text.trim();
      let parsed;
      try {
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        log.warn('Failed to parse headline variants response');
        return null;
      }

      const variants = parsed.variants || [];
      if (variants.length === 0) return null;

      // Score each variant using assessContentQuality
      const validationContext = {
        businessName: siteData.businessName,
        city: context.city,
        trustSignals: siteData.trustSignals
      };

      const scored = variants.map(headline => {
        const assessment = assessContentQuality(
          { headline, subheadline: '', ctaPrimary: '', aboutSnippet: '' },
          validationContext,
          industry
        );
        return { headline, score: assessment.overallScore };
      });

      // Sort by score descending, pick the best
      scored.sort((a, b) => b.score - a.score);

      log.info('Headline variants scored', {
        variants: scored.map(v => ({ headline: v.headline.substring(0, 50), score: v.score })),
        winner: scored[0].headline.substring(0, 50),
        winnerScore: scored[0].score
      });

      return {
        best: scored[0].headline,
        bestScore: scored[0].score,
        all: scored
      };
    } catch (error) {
      log.warn('Headline variant generation failed', { error: error.message });
      return null;
    }
  }

  /**
   * @deprecated This method is no longer used. Brand voice extraction is now done
   * in the main consolidated generateAllContent() call to save API costs.
   * Kept for backwards compatibility with tests.
   *
   * Analyze the original site's tone before generating new content
   * Returns brand voice characteristics: formality, techLevel, tone
   */
  async extractBrandVoice(siteData) {
    // Check if there's enough content to analyze
    const textPieces = [
      ...(siteData.headlines || []),
      ...(siteData.paragraphs || []).slice(0, 3)
    ].filter(Boolean);

    const combinedText = textPieces.join(' ').trim();

    // If too sparse, skip extraction and return null (use industry defaults)
    if (combinedText.length < 50) {
      log.info('Original content too sparse for brand voice extraction, using industry defaults');
      return null;
    }

    const prompt = `Analyze the tone and voice of this business website content and classify it.

CONTENT:
"${combinedText.substring(0, 1000)}"

Classify along these three dimensions:
1. formality: "formal" (corporate, polished), "casual" (relaxed, conversational), or "neutral" (balanced)
2. techLevel: "high" (jargon-heavy, technical terms), "medium" (some technical), or "low" (plain language)
3. tone: "serious" (authoritative, no-nonsense), "warm" (friendly, caring), or "playful" (humorous, lighthearted)

Return valid JSON only:
{"formality": "...", "techLevel": "...", "tone": "..."}`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: 'You are a content analyst. Return valid JSON only. No markdown, no explanations.',
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0].text.trim();
      let parsed;
      try {
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        log.warn('Failed to parse brand voice response');
        return null;
      }

      // Validate the response has the expected fields
      const validFormalities = ['formal', 'casual', 'neutral'];
      const validTechLevels = ['high', 'medium', 'low'];
      const validTones = ['serious', 'warm', 'playful'];

      const result = {
        formality: validFormalities.includes(parsed.formality) ? parsed.formality : 'neutral',
        techLevel: validTechLevels.includes(parsed.techLevel) ? parsed.techLevel : 'medium',
        tone: validTones.includes(parsed.tone) ? parsed.tone : 'warm'
      };

      log.info('Brand voice extracted', result);
      return result;
    } catch (error) {
      log.warn('Brand voice extraction failed', { error: error.message });
      return null;
    }
  }

  /**
   * Get seasonal context for content generation
   * Returns relevant seasonal themes for industries where seasonality matters
   */
  getSeasonalContext(industry) {
    const month = new Date().getMonth(); // 0-11
    const season = month >= 2 && month <= 4 ? 'spring'
      : month >= 5 && month <= 7 ? 'summer'
      : month >= 8 && month <= 10 ? 'fall'
      : 'winter';

    const contexts = {
      plumber: {
        winter: 'frozen pipes, heating system plumbing, pipe insulation',
        spring: 'outdoor faucet repair, sump pump checks, water heater flush',
        summer: 'AC drain lines, outdoor plumbing, sprinkler systems',
        fall: 'pipe winterization, water heater maintenance, gutter drainage'
      },
      hvac: {
        winter: 'heating repair urgency, furnace breakdowns, emergency heat',
        spring: 'AC tune-up season, system maintenance, filter changes',
        summer: 'AC breakdown emergencies, cooling system installs, energy bills',
        fall: 'furnace inspection, heating system prep, maintenance plans'
      },
      landscaping: {
        winter: 'snow removal, holiday lighting, winter pruning',
        spring: 'spring cleanup, new plantings, mulching, lawn aeration',
        summer: 'lawn maintenance, irrigation, pest control, outdoor living',
        fall: 'leaf removal, fall cleanup, winterization, overseeding'
      },
      roofing: {
        winter: 'ice dam prevention, emergency leak repair, storm damage',
        spring: 'post-winter inspection, spring storms, gutter cleaning',
        summer: 'full roof replacement, shingle repair, ventilation',
        fall: 'pre-winter inspection, storm prep, gutter guards'
      },
      electrician: {
        winter: 'generator installation, holiday lighting safety, heating circuits',
        spring: 'outdoor electrical, landscape lighting, panel upgrades',
        summer: 'AC circuit overloads, ceiling fans, outdoor outlets',
        fall: 'weatherproofing, surge protection, generator prep'
      },
      cleaning: {
        winter: 'holiday cleaning, deep cleaning before guests',
        spring: 'spring deep clean, window washing, post-winter refresh',
        summer: 'vacation prep cleaning, regular maintenance',
        fall: 'back-to-school clean, holiday prep, fall deep clean'
      },
      'home-services': {
        winter: 'winterization, heating maintenance, pipe insulation',
        spring: 'spring maintenance checklist, exterior repairs',
        summer: 'outdoor projects, deck repair, painting season',
        fall: 'fall maintenance, gutter cleaning, winter prep'
      },
      auto: {
        winter: 'winter tires, battery checks, antifreeze, cold start issues',
        spring: 'spring checkup, brake inspection, alignment',
        summer: 'AC service, overheating prevention, road trip prep',
        fall: 'winter prep, tire change, heating system check'
      }
    };

    return contexts[industry]?.[season] || null;
  }

  /**
   * Get target Flesch-Kincaid grade level for an industry
   */
  getReadabilityTarget(industry) {
    const targets = {
      plumber: { min: 6, max: 8, label: 'simple, direct language' },
      electrician: { min: 6, max: 8, label: 'simple, direct language' },
      hvac: { min: 6, max: 8, label: 'simple, direct language' },
      restaurant: { min: 7, max: 9, label: 'descriptive but accessible' },
      lawyer: { min: 10, max: 12, label: 'professional but clear' },
      dentist: { min: 8, max: 10, label: 'reassuring, clear' },
      'real-estate': { min: 9, max: 11, label: 'descriptive, sophisticated' },
      roofing: { min: 6, max: 8, label: 'simple, direct language' },
      landscaping: { min: 7, max: 9, label: 'descriptive but accessible' },
      cleaning: { min: 6, max: 8, label: 'simple, direct language' },
      auto: { min: 6, max: 8, label: 'simple, direct language' },
      insurance: { min: 8, max: 10, label: 'clear, reassuring' },
      accountant: { min: 8, max: 10, label: 'clear, reassuring' },
      general: { min: 8, max: 10, label: 'balanced readability' }
    };

    return targets[industry] || targets.general;
  }

  getFallbackContent(siteData, industry) {
    const industryContent = getIndustryContent(industry);
    const city = extractCity(siteData.address) || 'your area';
    const trust = siteData.trustSignals || {};
    const businessName = siteData.businessName || 'Our Team';
    const industryLabel = industry ? industry.charAt(0).toUpperCase() + industry.slice(1) : 'Services';

    // Build headline using trust signals when available
    let headline;
    if (trust.yearsInBusiness && trust.yearsInBusiness >= 5) {
      headline = `${trust.yearsInBusiness}+ Years Serving ${city}`;
    } else if (trust.foundedYear) {
      headline = `Serving ${city} Since ${trust.foundedYear}`;
    } else if (siteData.rating && siteData.rating >= 4.5) {
      headline = `${siteData.rating}★ Rated ${industryLabel} in ${city}`;
    } else {
      headline = `${businessName} — ${city} ${industryLabel}`;
    }

    // Check headline for clichés and replace if found
    if (hasCliche(headline)) {
      log.warn('Fallback headline contains cliché, using simpler version', { headline });
      headline = `${businessName} — ${industryLabel} in ${city}`;
    }

    // Build subheadline from trust signals or industry content
    let subheadline;
    if (trust.certifications?.length > 0) {
      subheadline = `${trust.certifications[0]} • Serving ${city}`;
    } else if (siteData.reviewCount && siteData.reviewCount >= 10) {
      subheadline = `${siteData.reviewCount}+ customers served in ${city}`;
    } else if (industryContent.benefits?.[0]) {
      subheadline = industryContent.benefits[0];
    } else {
      subheadline = `Local ${industryLabel.toLowerCase()} team in ${city}`;
    }

    // Check subheadline for clichés and replace if found
    if (hasCliche(subheadline)) {
      log.warn('Fallback subheadline contains cliché, using simpler version', { subheadline });
      subheadline = `${industryLabel} serving ${city}`;
    }

    // Build why us points from trust signals
    const whyUs = [];
    if (trust.yearsInBusiness) {
      whyUs.push({ title: `${trust.yearsInBusiness}+ Years Experience`, description: `Established track record in ${city}` });
    }
    if (trust.certifications?.length > 0) {
      whyUs.push({ title: trust.certifications[0], description: 'Verified credentials and training' });
    }
    if (trust.insuranceVerified || trust.bondedInsured) {
      whyUs.push({ title: 'Licensed & Insured', description: 'Full coverage for your peace of mind' });
    }
    if (siteData.rating && siteData.rating >= 4.0) {
      whyUs.push({ title: `${siteData.rating}★ Customer Rating`, description: `Based on ${siteData.reviewCount || 'verified'} reviews` });
    }
    // Fill remaining slots if needed
    if (whyUs.length < 3) {
      whyUs.push({ title: `${city} Based`, description: 'Local team, fast response times' });
    }
    if (whyUs.length < 3) {
      whyUs.push({ title: 'Free Estimates', description: 'Transparent pricing, no surprises' });
    }

    return {
      headline,
      subheadline,
      services: (siteData.services || []).slice(0, 6).map(name => ({
        name,
        description: `${name} for ${city} homes and businesses`,
        icon: 'star'
      })),
      whyUs: whyUs.slice(0, 3),
      testimonialIntro: 'What Our Customers Say',
      ctaPrimary: industryContent.ctaOptions?.[0] || 'Get a Free Quote',
      ctaSecondary: 'Learn More',
      aboutSnippet: `${businessName} provides ${industryLabel.toLowerCase()} to ${city} and surrounding areas.`,
      metaDescription: `${businessName} — ${industryLabel} in ${city}. ${trust.yearsInBusiness ? trust.yearsInBusiness + '+ years experience. ' : ''}Call today.`,
      businessName: siteData.businessName,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      isFallback: true
    };
  }
}

export default AIContentGenerator;
