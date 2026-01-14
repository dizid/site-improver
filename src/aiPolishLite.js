// src/aiPolishLite.js
// Lightweight AI polish for serverless - single fast call for critical slots
import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { extractCity } from './utils.js';

const log = logger.child('aiPolishLite');

// Use Haiku for speed (~1-2s vs 5-10s for larger models)
const FAST_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 300;
const TIMEOUT_MS = 4000;

/**
 * Build trust context string from scraped data
 */
function buildTrustContext(siteData) {
  const lines = [];
  const trust = siteData.trustSignals || {};

  if (trust.yearsInBusiness) {
    lines.push(`Years in business: ${trust.yearsInBusiness}+`);
  }
  if (trust.certifications?.length) {
    lines.push(`Credentials: ${trust.certifications.slice(0, 3).join(', ')}`);
  }
  if (trust.guarantees?.length) {
    lines.push(`Guarantees: ${trust.guarantees[0]}`);
  }
  if (trust.customerCount) {
    lines.push(`Customers served: ${trust.customerCount}`);
  }
  if (trust.rating) {
    lines.push(`Rating: ${trust.rating} stars`);
  }

  return lines.length > 0 ? `\nTrust signals to incorporate:\n${lines.join('\n')}` : '';
}

/**
 * Polish critical slots (headline, subheadline, CTA) in a single fast API call
 * @param {Object} siteData - Scraped site data
 * @param {Object} slots - Current slot values
 * @param {Object} options - Options including timeout
 * @returns {Object} Enhanced slots (headline, subheadline, cta_text)
 */
export async function polishCriticalSlots(siteData, slots, options = {}) {
  const timeout = options.timeout || TIMEOUT_MS;

  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('No ANTHROPIC_API_KEY, skipping AI polish');
    return {};
  }

  const businessName = siteData.businessName || slots.business_name || 'the business';
  const industry = siteData.industry || 'general';
  const city = extractCity(siteData.address) || siteData.country || '';
  const trustContext = buildTrustContext(siteData);

  // Get existing content to improve
  const currentHeadline = slots.headline || siteData.headlines?.[0] || '';
  const currentSubheadline = slots.subheadline || siteData.paragraphs?.[0] || '';
  const currentCTA = slots.cta_text || 'Get Started';

  const prompt = `You are a conversion-focused copywriter. Create compelling website copy for "${businessName}", a ${industry} business${city ? ` in ${city}` : ''}.
${trustContext}

Current content to improve:
- Headline: "${currentHeadline}"
- Subheadline: "${currentSubheadline}"
- CTA button: "${currentCTA}"

Return ONLY a JSON object with these 3 fields:
{
  "headline": "5-8 words, specific and benefit-driven, NOT generic",
  "subheadline": "15-25 words, supports headline, builds trust",
  "cta_text": "2-4 words, action-oriented"
}

RULES:
- NEVER use generic phrases like "Quality service", "Trusted partner", "Your satisfaction"
- Include specific details (years, location, credentials) when available
- Make it sound local and authentic, not corporate
- Return valid JSON only, no other text`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Race against timeout
    const result = await Promise.race([
      client.messages.create({
        model: FAST_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI polish timeout')), timeout)
      )
    ]);

    const text = result.content[0]?.text || '';
    log.debug('AI polish raw response', { text: text.substring(0, 200) });

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('Could not parse AI response as JSON');
      return {};
    }

    const enhanced = JSON.parse(jsonMatch[0]);

    // Validate we got meaningful content
    if (!enhanced.headline || enhanced.headline.length < 5) {
      log.warn('AI returned invalid headline');
      return {};
    }

    log.info('AI polish complete', {
      headline: enhanced.headline?.substring(0, 50),
      subheadline: enhanced.subheadline?.substring(0, 50)
    });

    return {
      headline: enhanced.headline,
      subheadline: enhanced.subheadline,
      cta_text: enhanced.cta_text
    };

  } catch (error) {
    log.warn('AI polish failed', { error: error.message });
    return {};
  }
}

export default { polishCriticalSlots };
