// src/aiPolish.js
import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity, safeParseJsonArray, safeParseJsonObject } from './utils.js';

const log = logger.child('aiPolish');

export class AIPolisher {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.client = null;
    this.systemPrompt = `You are an expert copywriter specializing in local business websites.
Your job is to transform mediocre or generic copy into compelling, conversion-focused content.

Guidelines:
- Be concise and punchy - no fluff
- Focus on benefits, not features
- Use active voice
- Create urgency without being sleazy
- Match the tone to the industry (professional for lawyers, friendly for home services, warm for restaurants)
- Keep local/personal feel - don't sound corporate
- Preserve any specific details (years in business, service areas, etc.)

Return ONLY the improved text, no explanations or quotes around it.`;
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

  async polishSlot(slotName, originalContent, context) {
    const prompts = {
      headline: `Improve this headline for a ${context.industry} business. Make it punchy and benefit-driven. Max 10 words.

Original: "${originalContent}"
Business: ${context.businessName}`,

      subheadline: `Write a compelling subheadline for a ${context.industry} business. Should support the headline and communicate the core value prop. Max 25 words.

Headline: "${context.headline}"
Original subheadline: "${originalContent}"
Business: ${context.businessName}
Location: ${context.city || 'local area'}`,

      service_description: `Improve this service description for a ${context.industry}. Make it benefit-focused and concise. Max 20 words.

Service: "${context.serviceName}"
Original: "${originalContent}"`,

      cta_text: `Write a compelling CTA button text for a ${context.industry}. Action-oriented, creates urgency. Max 4 words.

Current: "${originalContent}"
Page goal: Get visitors to contact/call`,

      about_text: `Rewrite this about section for a ${context.industry}. Build trust, highlight experience, keep it warm and personal. Max 60 words.

Original: "${originalContent}"
Business: ${context.businessName}`,

      meta_description: `Write an SEO meta description for a ${context.industry} website. Include location if known. Compelling and click-worthy. Max 155 characters.

Business: ${context.businessName}
Services: ${context.services?.slice(0, 3).join(', ') || 'various services'}
Location: ${context.city || 'local area'}`
    };

    const prompt = prompts[slotName] || `Improve this text for a ${context.industry} website. Keep it concise and compelling.\n\nOriginal: "${originalContent}"`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: CONFIG.ai.maxTokens.slot,
        system: this.systemPrompt,
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
        system: this.systemPrompt,
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
    const context = {
      industry: siteData.industry || 'general',
      businessName: siteData.businessName || 'Business',
      city: extractCity(siteData.address),
      services: siteData.services || [],
      headline: slots.headline
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
    const prompt = `You're rewriting copy for a ${siteData.industry || 'local business'} website rebuild.

CURRENT SITE DATA:
Business: ${siteData.businessName || 'Unknown'}
Location: ${siteData.address || 'Unknown'}
Phone: ${siteData.phone || 'Unknown'}
Current Headlines: ${(siteData.headlines || []).slice(0, 3).join(' | ') || 'None'}
Services: ${(siteData.services || []).slice(0, 6).join(', ') || 'Not specified'}
About/Description: ${(siteData.paragraphs || [])[0] || 'None'}

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
        system: this.systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      return safeParseJsonObject(text, slots);
    } catch (error) {
      log.warn('Failed to polish entire site', { error: error.message });
    }

    return slots;
  }
}

export default AIPolisher;
