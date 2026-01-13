// src/aiPolish.js
import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity, safeParseJsonArray, safeParseJsonObject } from './utils.js';
import { getIndustryContent, getRandomUSPs, getRandomBenefits } from './industryContent.js';

const log = logger.child('aiPolish');

export class AIPolisher {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.client = null;
    this.language = 'en';
  }

  getSystemPrompt() {
    const languageNames = {
      nl: 'Dutch', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English'
    };
    const langName = languageNames[this.language] || 'the same language as the input';

    return `You are a world-class copywriter creating premium website content.
Your goal is to transform ordinary copy into exceptional, conversion-focused content that feels professionally crafted.

CRITICAL LANGUAGE RULE: Write ALL output in ${langName}. Do NOT translate to English. Keep the SAME language as the input content.

Quality Standards:
- Every word must earn its place - absolutely no filler or fluff
- Headlines should stop readers in their tracks - be bold and specific
- Benefits over features, always - show the transformation, not just the service
- Create genuine urgency without manipulation or false scarcity
- Sound human, local, and trustworthy - never corporate or generic
- Preserve specific details (years in business, service areas, specialties, unique selling points)
- Match tone to industry: authoritative for professionals, warm for home services, inviting for hospitality
- Use power words and emotional triggers appropriate to the local market

Return ONLY the improved text in ${langName}, no explanations or quotes.`;
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
   * Build trust signal context string for AI prompts
   */
  buildTrustContext(trustSignals) {
    if (!trustSignals) return '';

    const lines = [];

    if (trustSignals.yearsInBusiness) {
      lines.push(`Years in business: ${trustSignals.yearsInBusiness}+ years`);
    }
    if (trustSignals.foundedYear) {
      lines.push(`Founded: ${trustSignals.foundedYear}`);
    }
    if (trustSignals.certifications && trustSignals.certifications.length > 0) {
      lines.push(`Credentials: ${trustSignals.certifications.join(', ')}`);
    }
    if (trustSignals.licenses && trustSignals.licenses.length > 0) {
      lines.push(`License: ${trustSignals.licenses[0]}`);
    }
    if (trustSignals.customerCount) {
      lines.push(`Customers served: ${trustSignals.customerCount}`);
    }
    if (trustSignals.awards && trustSignals.awards.length > 0) {
      lines.push(`Awards: ${trustSignals.awards.slice(0, 2).join(', ')}`);
    }
    if (trustSignals.guarantees && trustSignals.guarantees.length > 0) {
      lines.push(`Guarantees: ${trustSignals.guarantees.join(', ')}`);
    }
    if (trustSignals.serviceAreas && trustSignals.serviceAreas.length > 0) {
      lines.push(`Service areas: ${trustSignals.serviceAreas.slice(0, 3).join(', ')}`);
    }

    if (lines.length === 0) return '';

    return `
TRUST SIGNALS (use these to make content specific):
${lines.join('\n')}`;
  }

  async polishSlot(slotName, originalContent, context) {
    // Build trust signal context for prompts
    const trustContext = this.buildTrustContext(context.trustSignals);

    const prompts = {
      headline: `Improve this headline for ${context.businessName}, a ${context.industry} in ${context.city || 'the local area'}.
Make it punchy, benefit-driven, and SPECIFIC to this business. Max 10 words.

Original: "${originalContent}"
${trustContext}

IMPORTANT:
- Include specific trust signals (years, certifications, location) when available
- AVOID generic phrases like "quality service" or "trusted partner"
- Make it unique to THIS business`,

      subheadline: `Write a compelling subheadline for ${context.businessName}, a ${context.industry} in ${context.city || 'the local area'}.
Should support the headline and communicate the core value prop. Max 25 words.

Headline: "${context.headline}"
Original subheadline: "${originalContent}"
${trustContext}

IMPORTANT:
- Reference specific differentiators (years, certifications, service areas)
- AVOID clichés and generic phrases
- Be specific about what makes this business unique`,

      service_description: `Improve this service description for ${context.businessName}, a ${context.industry}. Make it benefit-focused and concise. Max 20 words.

Service: "${context.serviceName}"
Original: "${originalContent}"
${trustContext}`,

      cta_text: `Write a compelling CTA button text for a ${context.industry}. Action-oriented, creates urgency. Max 4 words.

Current: "${originalContent}"
Business: ${context.businessName}
${context.trustSignals?.guarantees?.length > 0 ? `Offers: ${context.trustSignals.guarantees[0]}` : ''}

Examples of strong CTAs: "Get Free Quote", "Call Now - 24/7", "Book ${context.city ? context.city + ' ' : ''}Service"`,

      about_text: `Rewrite this about section for ${context.businessName}, a ${context.industry}. Build trust, highlight experience, keep it warm and personal. Max 60 words.

Original: "${originalContent}"
${trustContext}

IMPORTANT:
- Use specific facts (years, customers served, certifications)
- AVOID generic business clichés
- Sound authentic and local`,

      meta_description: `Write an SEO meta description for ${context.businessName}, a ${context.industry} website. Include location. Compelling and click-worthy. Max 155 characters.

Services: ${context.services?.slice(0, 3).join(', ') || 'various services'}
Location: ${context.city || 'local area'}
${trustContext}`
    };

    const prompt = prompts[slotName] || `Improve this text for a ${context.industry} website. Keep it concise and compelling.\n\nOriginal: "${originalContent}"`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: CONFIG.ai.maxTokens.slot,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text.trim();
    } catch (error) {
      log.warn(`Failed to polish ${slotName}`, { error: error.message });
      return originalContent;
    }
  }

  async polishServices(services, context) {
    if (!services || services.length === 0) return services;

    const prompt = `Improve these service names/descriptions for a ${context.industry} business.
Make each one concise (max 5 words for name, max 15 words for description), benefit-focused, and consistent in tone.

Services:
${services.map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.name}`).join('\n')}

Return as JSON array: [{"name": "...", "description": "..."}, ...]`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: CONFIG.ai.maxTokens.services,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const fallback = services.map(s => typeof s === 'string' ? { name: s, description: '' } : s);
      return safeParseJsonArray(text, fallback);
    } catch (error) {
      log.warn('Failed to polish services', { error: error.message });
      return services.map(s => typeof s === 'string' ? { name: s, description: '' } : s);
    }
  }

  async polishAll(slots, siteData) {
    // Set language for this polishing session
    this.language = siteData.language || 'en';
    log.info('Polishing content', {
      language: this.language,
      business: siteData.businessName,
      hasTrustSignals: !!siteData.trustSignals
    });

    const context = {
      industry: siteData.industry || 'general',
      businessName: siteData.businessName || 'Business',
      city: extractCity(siteData.address),
      services: siteData.services || [],
      headline: slots.headline,
      language: this.language,
      // Include trust signals for enhanced prompts
      trustSignals: siteData.trustSignals || null
    };

    const polished = { ...slots };
    const toPolish = [];

    // Collect slots that need polishing
    for (const [key, value] of Object.entries(slots)) {
      if (slots[`${key}_aiEnhance`] && value && !key.endsWith('_aiEnhance')) {
        toPolish.push({ key, value });
      }
    }

    // Polish in parallel (with concurrency limit)
    const results = await this.parallelPolish(toPolish, context, CONFIG.ai.concurrency);

    for (const { key, polished: polishedValue } of results) {
      polished[key] = polishedValue;
    }

    // Polish services separately
    if (siteData.services?.length > 0) {
      polished.services = await this.polishServices(siteData.services, context);
    }

    return polished;
  }

  async parallelPolish(items, context, concurrency = 3) {
    const results = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async ({ key, value }) => ({
          key,
          polished: await this.polishSlot(key, value, context)
        }))
      );
      results.push(...batchResults);
    }

    return results;
  }

  async polishEntireSite(siteData, slots) {
    // Build trust signal context
    const trustContext = this.buildTrustContext(siteData.trustSignals);

    const prompt = `You're rewriting copy for ${siteData.businessName || 'a local business'}, a ${siteData.industry || 'local business'} website rebuild.

CURRENT SITE DATA:
Business: ${siteData.businessName || 'Unknown'}
Location: ${siteData.address || 'Unknown'}
Phone: ${siteData.phone || 'Unknown'}
Current Headlines: ${(siteData.headlines || []).slice(0, 3).join(' | ') || 'None'}
Services: ${(siteData.services || []).slice(0, 6).join(', ') || 'Not specified'}
About/Description: ${(siteData.paragraphs || [])[0] || 'None'}
${trustContext}

CRITICAL RULES:
1. Use the trust signals above to make content SPECIFIC to this business
2. NEVER use clichés like "quality service", "your trusted partner", "one-stop shop"
3. Include years in business, certifications, or customer count in headlines/copy when available
4. Reference the specific location/city
5. Sound human, local, and authentic - not corporate

TASK:
Generate polished, conversion-focused copy for each section. Keep the local, personal feel. Be concise.

Return JSON:
{
  "headline": "...",
  "subheadline": "...",
  "cta_primary": "...",
  "cta_secondary": "...",
  "services_headline": "...",
  "services": [
    {"name": "...", "description": "..."}
  ],
  "why_us_headline": "...",
  "why_us_points": ["...", "...", "..."],
  "meta_description": "..."
}`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: CONFIG.ai.maxTokens.fullSite,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      return safeParseJsonObject(text, slots);
    } catch (error) {
      log.warn('Failed to polish entire site', { error: error.message });
    }

    return slots;
  }

  /**
   * Generate UI strings (navigation, buttons, form labels) in the detected language
   */
  async generateUIStrings(language, industry) {
    this.language = language || 'en';

    const prompt = `Generate website UI text for a ${industry || 'local business'} website.

Return JSON with these UI elements translated appropriately:
{
  "nav_services": "Services",
  "nav_about": "About Us",
  "nav_contact": "Contact",
  "nav_reviews": "Reviews",
  "btn_call": "Call Us",
  "btn_quote": "Get a Quote",
  "btn_send": "Send Message",
  "btn_contact": "Contact Us",
  "form_name": "Your Name",
  "form_email": "Your Email",
  "form_phone": "Your Phone",
  "form_message": "Your Message",
  "section_services": "Our Services",
  "section_why_us": "Why Choose Us",
  "section_contact": "Get in Touch",
  "section_hours": "Business Hours",
  "cta_ready": "Ready to Get Started?",
  "cta_help": "We're here to help"
}

Return ONLY valid JSON.`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: 500,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const defaults = {
        nav_services: 'Services', nav_about: 'About Us', nav_contact: 'Contact', nav_reviews: 'Reviews',
        btn_call: 'Call Us', btn_quote: 'Get a Quote', btn_send: 'Send Message', btn_contact: 'Contact Us',
        form_name: 'Your Name', form_email: 'Your Email', form_phone: 'Your Phone', form_message: 'Your Message',
        section_services: 'Our Services', section_why_us: 'Why Choose Us', section_contact: 'Get in Touch',
        section_hours: 'Business Hours', cta_ready: 'Ready to Get Started?', cta_help: "We're here to help"
      };
      return safeParseJsonObject(text, defaults);
    } catch (error) {
      log.warn('Failed to generate UI strings', { error: error.message, language });
      // Return English defaults
      return {
        nav_services: 'Services', nav_about: 'About Us', nav_contact: 'Contact', nav_reviews: 'Reviews',
        btn_call: 'Call Us', btn_quote: 'Get a Quote', btn_send: 'Send Message', btn_contact: 'Contact Us',
        form_name: 'Your Name', form_email: 'Your Email', form_phone: 'Your Phone', form_message: 'Your Message',
        section_services: 'Our Services', section_why_us: 'Why Choose Us', section_contact: 'Get in Touch',
        section_hours: 'Business Hours', cta_ready: 'Ready to Get Started?', cta_help: "We're here to help"
      };
    }
  }
  /**
   * Generate testimonials when none were scraped
   */
  async generateTestimonials(siteData, count = 3) {
    const industry = siteData.industry || 'general';
    const industryContent = getIndustryContent(industry);
    const tones = industryContent.testimonialTones || ['satisfied', 'happy'];

    const prompt = `Generate ${count} realistic customer testimonials for a ${industry} business.

Business: ${siteData.businessName || 'Local Business'}
Location: ${extractCity(siteData.address) || 'local area'}
Services: ${(siteData.services || []).slice(0, 4).join(', ') || 'various services'}

Requirements:
- Make them sound authentic and specific (mention actual services if possible)
- Vary the length (one short, one medium, one longer)
- Include realistic first names (appropriate for the region)
- Each should highlight a different benefit: ${industryContent.benefits?.slice(0, 3).join(', ') || 'quality, reliability, professionalism'}
- Tones to use: ${tones.join(', ')}

Return as JSON array:
[
  {"text": "...", "author": "First Name", "rating": 5},
  ...
]`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: 600,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const fallback = this.getFallbackTestimonials(siteData);
      return safeParseJsonArray(text, fallback);
    } catch (error) {
      log.warn('Failed to generate testimonials', { error: error.message });
      return this.getFallbackTestimonials(siteData);
    }
  }

  /**
   * Get fallback testimonials using industry content
   */
  getFallbackTestimonials(siteData) {
    const benefits = getRandomBenefits(siteData.industry || 'general', 3);
    const names = ['Sarah', 'Michael', 'Jennifer'];

    return benefits.map((benefit, i) => ({
      text: `${benefit}. Highly recommend!`,
      author: names[i],
      rating: 5
    }));
  }

  /**
   * Generate missing content when scraped content is weak
   */
  async generateMissingContent(siteData, existingSlots = {}) {
    const industry = siteData.industry || 'general';
    const industryContent = getIndustryContent(industry);
    const city = extractCity(siteData.address);

    // Determine what's missing
    const hasWeakHeadline = !existingSlots.headline || existingSlots.headline.length < 20;
    const hasWeakSubheadline = !existingSlots.subheadline || existingSlots.subheadline.length < 30;
    const hasNoTestimonials = !siteData.testimonials || siteData.testimonials.length === 0;
    const hasNoWhyUs = !existingSlots.why_us_points || existingSlots.why_us_points.length === 0;

    log.info('Generating missing content', {
      industry,
      hasWeakHeadline,
      hasWeakSubheadline,
      hasNoTestimonials,
      hasNoWhyUs
    });

    const prompt = `Generate compelling website content for a ${industry} business.

Business: ${siteData.businessName || 'Local Business'}
Location: ${city || 'local area'}
Services: ${(siteData.services || []).slice(0, 5).join(', ') || 'various services'}
Existing headline: ${existingSlots.headline || 'None'}

Industry pain points customers face: ${industryContent.painPoints?.slice(0, 2).join('; ') || 'common frustrations'}
Key benefits to highlight: ${industryContent.benefits?.slice(0, 2).join('; ') || 'quality service'}

Generate the following (return as JSON):
{
  ${hasWeakHeadline ? '"headline": "Punchy headline, max 10 words, benefit-focused",' : ''}
  ${hasWeakSubheadline ? '"subheadline": "Supporting text, max 25 words, builds on headline",' : ''}
  "cta_text": "Action button text, max 4 words",
  ${hasNoWhyUs ? '"why_us_points": ["Point 1", "Point 2", "Point 3", "Point 4"],' : ''}
  "meta_description": "SEO meta description, max 155 chars"
}`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: 500,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const generated = safeParseJsonObject(text, {});

      // Merge generated content with existing slots
      const result = { ...existingSlots };

      if (generated.headline && hasWeakHeadline) {
        result.headline = generated.headline;
      }
      if (generated.subheadline && hasWeakSubheadline) {
        result.subheadline = generated.subheadline;
      }
      if (generated.cta_text) {
        result.cta_text = generated.cta_text;
      }
      if (generated.why_us_points && hasNoWhyUs) {
        result.why_us_points = generated.why_us_points;
      }
      if (generated.meta_description) {
        result.meta_description = generated.meta_description;
      }

      // Generate testimonials if missing
      if (hasNoTestimonials) {
        result.testimonials = await this.generateTestimonials(siteData);
      }

      log.info('Generated missing content successfully');
      return result;

    } catch (error) {
      log.warn('Failed to generate missing content', { error: error.message });
      // Return fallbacks from industry content
      return {
        ...existingSlots,
        cta_text: industryContent.ctaOptions?.[0] || 'Get Started',
        why_us_points: hasNoWhyUs ? getRandomUSPs(industry, 4) : existingSlots.why_us_points,
        testimonials: hasNoTestimonials ? this.getFallbackTestimonials(siteData) : undefined
      };
    }
  }

  /**
   * Check if content needs generation (is too weak)
   */
  needsContentGeneration(siteData, slots) {
    const hasWeakHeadline = !slots.headline || slots.headline.length < 20;
    const hasWeakSubheadline = !slots.subheadline || slots.subheadline.length < 30;
    const hasNoTestimonials = !siteData.testimonials || siteData.testimonials.length === 0;
    const hasNoServices = !siteData.services || siteData.services.length === 0;

    // Need generation if more than 2 things are weak/missing
    const weakPoints = [hasWeakHeadline, hasWeakSubheadline, hasNoTestimonials, hasNoServices]
      .filter(Boolean).length;

    return weakPoints >= 2;
  }
}

export default AIPolisher;
