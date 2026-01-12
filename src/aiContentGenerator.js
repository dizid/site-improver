// src/aiContentGenerator.js
// AI-First Content Generation - Generate ALL website content, not just polish

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity, safeParseJsonObject } from './utils.js';
import { getIndustryContent } from './industryContent.js';

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
   */
  async generateAllContent(siteData, industry) {
    const startTime = Date.now();
    log.info('Generating all content with AI', {
      business: siteData.businessName,
      industry
    });

    // Build comprehensive context from scraped data
    const context = this.buildContext(siteData, industry);

    // Get industry-specific content hints
    const industryContent = getIndustryContent(industry);

    // Build the comprehensive prompt
    const prompt = this.buildComprehensivePrompt(context, industryContent);

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: this.getSystemPrompt(context.language),
        messages: [{ role: 'user', content: prompt }]
      });

      const responseText = response.content[0].text.trim();

      // Parse JSON response
      const generated = this.parseResponse(responseText);

      // Merge with real contact info (never fake these)
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
        generationTime: Date.now() - startTime
      };

      log.info('Content generation complete', {
        business: result.businessName,
        duration: `${result.generationTime}ms`
      });

      return result;

    } catch (error) {
      log.error('AI content generation failed', { error: error.message });
      // Return fallback content
      return this.getFallbackContent(siteData, industry);
    }
  }

  getSystemPrompt(language = 'en') {
    const languageNames = {
      nl: 'Dutch', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English'
    };
    const langName = languageNames[language] || 'English';

    return `You are an elite website copywriter who creates compelling, conversion-optimized content.

YOUR TASK: Generate complete website copy for a local business. Create content that is:
- Specific to THIS business (use their name, location, services)
- Professional but warm and approachable
- Benefit-focused (what customers GET, not what the business DOES)
- Locally relevant (mention the service area naturally)
- Trustworthy and genuine (no hype or fake urgency)

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
      reviewCount: siteData.reviewCount
    };
  }

  buildComprehensivePrompt(context, industryContent) {
    const servicesHint = context.scrapedServices.length > 0
      ? `Services found on site: ${context.scrapedServices.join(', ')}`
      : `Typical ${context.industry} services might include: ${industryContent?.services?.slice(0, 4).join(', ') || 'various services'}`;

    const locationHint = context.city
      ? `Located in ${context.city}${context.address ? ` at ${context.address}` : ''}`
      : 'Serves local area';

    const testimonialHint = context.scrapedTestimonials.length > 0
      ? `\nReal testimonials found:\n${context.scrapedTestimonials.map(t => `- "${t.text?.substring(0, 100)}..." - ${t.author || 'Customer'}`).join('\n')}`
      : '';

    return `Create complete website copy for this ${context.industry} business:

BUSINESS INFO:
- Name: ${context.businessName}
- Industry: ${context.industry}
- ${locationHint}
${context.rating ? `- Rating: ${context.rating}/5 (${context.reviewCount || 'many'} reviews)` : ''}

CONTENT REFERENCE (from their current site - use for context, but write BETTER versions):
- Headlines found: ${context.scrapedHeadlines.slice(0, 3).join(' | ') || 'None found'}
- ${servicesHint}
${testimonialHint}

INDUSTRY CONTEXT:
- Customer pain points: ${industryContent?.painPoints?.slice(0, 2).join('; ') || 'Need reliable, quality service'}
- Key benefits to highlight: ${industryContent?.benefits?.slice(0, 2).join('; ') || 'Professional, trustworthy service'}

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
- Icon names should be: wrench, shield, clock, star, users, home, phone, truck, award, heart, check, zap`;
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
