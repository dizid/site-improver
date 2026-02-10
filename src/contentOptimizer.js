// src/contentOptimizer.js
// CRO (Conversion Rate Optimization) module - optimizes already-generated website content
// for higher conversions using proven direct-response copywriting frameworks

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { extractCity } from './utils.js';
import { getIndustryContent } from './industryContent.js';
import { assessContentQuality, validateContent, getRegenerationPrompt } from './contentValidator.js';
import { getToneProfile, generateToneGuidance } from './toneProfiles.js';

const log = logger.child('contentOptimizer');

/**
 * ContentOptimizer - Takes polished website content and optimizes it for higher conversions
 * Uses CRO frameworks (LIFT, PAS) to refine headlines, CTAs, and copy
 * without rewriting from scratch.
 */
export class ContentOptimizer {
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
   * Optimize polished content for higher conversions
   * Multi-pass: iterates until quality threshold is met (max 3 passes)
   * Includes validation, retry logic, and do-no-harm gate
   */
  async optimizeContent(polishedSlots, siteData, industry, maxRetries = 2) {
    const startTime = Date.now();
    const qualityThreshold = (typeof CONFIG.ai?.qualityThreshold === 'object')
      ? (CONFIG.ai.qualityThreshold[industry] || CONFIG.ai.qualityThreshold.default || 78)
      : (CONFIG.ai?.qualityThreshold || 78);
    const maxPasses = CONFIG.ai?.maxOptimizationPasses || 3;

    log.info('Optimizing content for conversions', {
      business: siteData.businessName,
      industry,
      qualityThreshold,
      maxPasses
    });

    // Build context from siteData
    const context = {
      businessName: siteData.businessName || 'Local Business',
      city: extractCity(siteData.address) || siteData.city || null,
      industry: industry || 'general',
      language: siteData.language || 'en',
      rating: siteData.rating,
      reviewCount: siteData.reviewCount,
      trustSignals: siteData.trustSignals || null
    };

    const qualityContext = { businessName: context.businessName, city: context.city, trustSignals: context.trustSignals };

    // Score BEFORE optimization
    const beforeContent = {
      headline: polishedSlots.headline,
      subheadline: polishedSlots.subheadline,
      ctaPrimary: polishedSlots.cta_text,
      aboutSnippet: polishedSlots.about_text
    };
    const beforeAssessment = assessContentQuality(beforeContent, qualityContext, industry);
    const beforeScore = beforeAssessment.overallScore;

    // Get industry-specific content hints
    const industryContent = getIndustryContent(industry);

    // Track the best result across all passes
    let bestSlots = polishedSlots;
    let bestScore = beforeScore;
    let slotsWereUpdated = false;
    let totalAttempts = 0;
    let totalTokensUsed = 0;
    let passScores = [beforeScore];
    let currentSlots = polishedSlots;

    // Multi-pass optimization loop
    for (let pass = 1; pass <= maxPasses; pass++) {
      // If we already meet the threshold, stop
      if (bestScore >= qualityThreshold && pass > 1) {
        log.info('Quality threshold met, stopping optimization', {
          pass,
          score: bestScore,
          threshold: qualityThreshold
        });
        break;
      }

      let attempt = 0;
      let rejectionFeedback = null;

      // Build quality feedback for passes > 1
      if (pass > 1) {
        const currentAssessment = assessContentQuality(
          { headline: currentSlots.headline, subheadline: currentSlots.subheadline, ctaPrimary: currentSlots.cta_text, aboutSnippet: currentSlots.about_text },
          qualityContext,
          industry
        );
        rejectionFeedback = this.buildQualityFeedback(currentAssessment);
      }

      while (attempt <= maxRetries) {
        attempt++;
        totalAttempts++;

        const prompt = this.buildOptimizationPrompt(currentSlots, context, industryContent, rejectionFeedback);

        try {
          const response = await this.getClient().messages.create({
            model: CONFIG.ai?.model || 'claude-sonnet-4-20250514',
            max_tokens: CONFIG.ai?.maxTokens?.optimize || 1200,
            system: this.getSystemPrompt(context.language, industry),
            messages: [{ role: 'user', content: prompt }]
          });

          // Track token usage
          if (response.usage) {
            totalTokensUsed += (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0);
          }

          const responseText = response.content[0].text.trim();
          const optimized = this.parseResponse(responseText);

          // Validate for cliches
          const validationResult = validateContent(optimized.headline || '', {
            businessName: context.businessName,
            city: context.city
          });

          if (validationResult.issues.some(i => i.severity === 'high' || i.severity === 'critical') && attempt <= maxRetries) {
            rejectionFeedback = getRegenerationPrompt(validationResult);
            log.warn('Optimized content rejected for cliches, retrying', {
              pass,
              attempt,
              issues: validationResult.issues.length
            });
            continue;
          }

          // Map optimized content back to slot format
          const optimizedSlots = this.mapOptimizedToSlots(optimized, currentSlots);

          // Score AFTER this pass
          const afterContent = {
            headline: optimizedSlots.headline,
            subheadline: optimizedSlots.subheadline,
            ctaPrimary: optimizedSlots.cta_text,
            aboutSnippet: optimizedSlots.about_text
          };
          const afterAssessment = assessContentQuality(afterContent, qualityContext, industry);
          const afterScore = afterAssessment.overallScore;

          passScores.push(afterScore);

          log.info('Optimization pass complete', {
            pass,
            beforeScore: pass === 1 ? beforeScore : passScores[pass - 1],
            afterScore,
            improvement: afterScore - (pass === 1 ? beforeScore : passScores[pass - 1]),
            totalTokens: totalTokensUsed
          });

          // Track best result (do-no-harm: only upgrade if strictly better)
          if (afterScore > bestScore) {
            bestSlots = optimizedSlots;
            bestScore = afterScore;
            currentSlots = optimizedSlots;
            slotsWereUpdated = true;
          }

          break; // Move to next pass

        } catch (error) {
          log.error('Optimization API call failed', { error: error.message, pass, attempt });
          if (attempt > maxRetries) {
            break; // Move to next pass or finish
          }
        }
      }
    }

    // Do-no-harm gate: only use optimized content if it actually scored better
    const improved = slotsWereUpdated && bestScore > beforeScore;

    log.info('Content optimization complete', {
      business: context.businessName,
      beforeScore,
      afterScore: bestScore,
      improved,
      totalAttempts,
      passScores,
      totalTokens: totalTokensUsed,
      duration: `${Date.now() - startTime}ms`
    });

    return {
      improved,
      slots: improved ? bestSlots : polishedSlots,
      beforeScore,
      afterScore: bestScore,
      attempts: totalAttempts,
      passScores,
      totalTokensUsed,
      duration: Date.now() - startTime
    };
  }

  /**
   * Build specific quality feedback for multi-pass optimization
   * Tells the AI exactly what needs improvement with concrete examples
   */
  buildQualityFeedback(assessment) {
    const issues = [];

    // Clichés - most critical issue
    if (assessment.checks.cliches?.found?.length) {
      issues.push(`Remove these clichés: "${assessment.checks.cliches.found.join('", "')}"`);
    }

    // Headline issues - specific problems
    if (assessment.checks.headline?.issues?.length) {
      assessment.checks.headline.issues.forEach(i => {
        const text = i.text || i.suggestion || '';
        if (text) issues.push(`Headline: ${text}`);
      });
    } else if (assessment.checks.headline?.score < 70) {
      issues.push('Headline is weak - needs specific numbers, location, or credentials');
    }

    // CTA issues - be specific about what's missing
    if (assessment.checks.cta?.score < 60) {
      if (assessment.checks.cta?.issues?.length) {
        issues.push('CTA: ' + assessment.checks.cta.issues.join(', '));
      } else {
        issues.push('CTA needs urgency word (today, now, free, instant) and specific benefit');
      }
    }

    // Emotional triggers - name what's missing
    if (assessment.checks.emotional?.missing?.length) {
      const missing = assessment.checks.emotional.missing.slice(0, 2).map(m => m.description).join(', ');
      issues.push(`Add emotional triggers: ${missing}`);
    }

    // Temperature issues - specific fixes
    if (assessment.checks.temperature?.label === 'hot') {
      issues.push('Too salesy — replace superlatives with specific facts and numbers');
    } else if (assessment.checks.temperature?.label === 'cold' || assessment.checks.temperature?.label === 'cool') {
      issues.push('Too generic — add specific numbers, credentials, or location details');
    }

    // Length issues
    if (assessment.checks.lengths) {
      if (assessment.checks.lengths.headline?.issue) {
        issues.push(assessment.checks.lengths.headline.issue);
      }
      if (assessment.checks.lengths.subheadline?.issue) {
        issues.push(assessment.checks.lengths.subheadline.issue);
      }
      if (assessment.checks.lengths.cta?.issue) {
        issues.push(assessment.checks.lengths.cta.issue);
      }
    }

    if (issues.length === 0) {
      return 'Previous score: ' + assessment.overallScore + '/100. Minor improvements needed for optimal conversion.';
    }

    return issues.join('\n');
  }

  /**
   * CRO-focused system prompt with optimization frameworks
   */
  getSystemPrompt(language = 'en', industry = 'general') {
    const languageNames = {
      nl: 'Dutch', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English'
    };
    const langName = languageNames[language] || 'English';

    // Get industry-specific tone guidance
    const toneGuidance = generateToneGuidance(industry);

    return `You are a Conversion Rate Optimization (CRO) specialist. You take existing website copy and optimize it to convert more visitors into customers. You REFINE and SHARPEN existing content — you don't rewrite from scratch.

OPTIMIZATION FRAMEWORK:

1. HEADLINE FORMULAS (pick the best fit for this business):
   - Specificity: "[Number/Years] + [City] + [Key Benefit]"
     Example: "Same-Day Plumbing Repairs in Denver Since 1987"
   - Social Proof: "[Rating/Reviews] + [Outcome]"
     Example: "4.9★ Rated · 2,847 Denver Homes Fixed"
   - Pain-Agitate: "[Problem]? [Your Solution]."
     Example: "Leaking Pipe? Fixed in Hours, Not Days"

2. LIFT FRAMEWORK FOR CTAs:
   - Clarity: Make it obvious what happens next
   - Value: Lead with what THEY get
   - Low Friction: Reduce perceived effort
   - Urgency: Honest time sensitivity
   Good: "Get Your Free Quote in 60 Seconds"
   Bad: "Submit" or "Learn More"

3. PROOF POINTS FOR WHY US:
   - Every point must contain ONE verifiable fact
   Bad: "Experienced team" → Good: "23 Years · 4,200+ Jobs Completed"
   Bad: "Quality work" → Good: "4.9★ Rating · 180+ Reviews"

4. ABOUT TEXT (4 sentences, this structure):
   S1: Who you are + how long + where
   S2: What makes you different
   S3: Social proof (customers, rating, award)
   S4: Promise/guarantee

5. SERVICES: Lead with benefits, add one specific detail per service.

BANNED PHRASES (using these will get content rejected):
"quality service", "trusted partner", "one-stop shop", "state-of-the-art",
"cutting-edge", "world-class", "commitment to excellence", "passion for",
"go above and beyond", "dedicated team of professionals", "Welcome to",
"We are a", "industry-leading", "top-notch", "unparalleled"

${toneGuidance}

SELF-CHECK before returning:
□ Headline has a specific number OR location
□ Every "Why Us" has a verifiable fact
□ CTA starts with action verb + benefit
□ About is exactly 4 sentences
□ Zero banned phrases

LANGUAGE: Write ALL content in ${langName}. Match the cultural tone.

OUTPUT: Return valid JSON only. No markdown, no explanations.`;
  }

  /**
   * Build the user-facing optimization prompt
   */
  buildOptimizationPrompt(polishedSlots, context, industryContent, rejectionFeedback = null) {
    const trustSignalContext = this.buildTrustSignalContext(context.trustSignals);

    const rejectionSection = rejectionFeedback
      ? `\n⚠️ PREVIOUS ATTEMPT REJECTED:\n${rejectionFeedback}\nFix the issues and try again.\n`
      : '';

    // Build location-specific social proof hint
    const locationProof = context.city
      ? `- Generate location-specific social proof (e.g., "Trusted by 500+ ${context.city} families")`
      : '';

    return `Optimize this ${context.industry} website copy for higher conversions:
${rejectionSection}
BUSINESS:
- Name: ${context.businessName}
- Industry: ${context.industry}
- Location: ${context.city || 'Local area'}
${context.rating ? `- Rating: ${context.rating}/5 (${context.reviewCount || 'many'} reviews)` : ''}
${trustSignalContext}

CURRENT CONTENT TO OPTIMIZE:
${JSON.stringify({
  headline: polishedSlots.headline,
  subheadline: polishedSlots.subheadline,
  services: (polishedSlots.services || []).slice(0, 6),
  why_us_points: polishedSlots.why_us_points || [],
  cta_text: polishedSlots.cta_text,
  cta_secondary: polishedSlots.cta_secondary,
  about_text: polishedSlots.about_text,
  meta_description: polishedSlots.meta_description
}, null, 2)}

INDUSTRY HINTS:
- Pain points: ${industryContent?.painPoints?.slice(0, 2).join('; ') || 'Need reliable service'}
- Power phrases: ${industryContent?.powerPhrases?.slice(0, 3).join(' | ') || 'Honest work. Fair prices.'}

CRO ENHANCEMENTS TO ADD:
- CTAs: Use urgency words (Today, Now, Fast, Same-Day) and specific time frames (60 seconds, 24 hours)
${locationProof}
- Add testimonial-style snippets if none exist (use rating/review data to create credible quotes)
- Form micro-copy: Add helper text like "Takes 30 seconds" or "We'll respond within 1 hour"
- Trust micro-copy: Include phrases like "Your information is secure" or "No spam, ever"

RETURN optimized content as JSON with these exact keys:
{
  "headline": "optimized headline (5-10 words)",
  "subheadline": "optimized subheadline (15-25 words)",
  "services": [{"name": "...", "description": "...", "icon": "..."}],
  "why_us_points": [{"title": "...", "description": "..."}],
  "cta_text": "primary CTA with urgency (2-5 words, e.g. 'Get Free Quote Today')",
  "cta_secondary": "secondary CTA (2-5 words)",
  "about_text": "4-sentence about section",
  "meta_description": "SEO description (max 155 chars)",
  "form_helper_text": "micro-copy for form (e.g., 'Takes 30 seconds • We respond within 1 hour')",
  "location_social_proof": "location-specific proof if city provided (e.g., 'Trusted by 500+ Denver families')"
}

Keep service count and why_us count the same as input. Preserve all factual details.`;
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
   * Parse AI response JSON, extracting from markdown code blocks if needed
   */
  parseResponse(responseText) {
    try {
      let jsonStr = responseText;

      // Handle if wrapped in markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        headline: parsed.headline || '',
        subheadline: parsed.subheadline || '',
        services: Array.isArray(parsed.services) ? parsed.services.slice(0, 8) : [],
        why_us_points: Array.isArray(parsed.why_us_points) ? parsed.why_us_points.slice(0, 6) : [],
        cta_text: parsed.cta_text || '',
        cta_secondary: parsed.cta_secondary || '',
        about_text: parsed.about_text || '',
        meta_description: parsed.meta_description || '',
        form_helper_text: parsed.form_helper_text || '',
        location_social_proof: parsed.location_social_proof || ''
      };
    } catch (error) {
      log.warn('Failed to parse optimization response as JSON', { error: error.message });
      return {
        headline: '',
        subheadline: '',
        services: [],
        why_us_points: [],
        cta_text: '',
        cta_secondary: '',
        about_text: '',
        meta_description: '',
        form_helper_text: '',
        location_social_proof: ''
      };
    }
  }

  /**
   * Merge optimized content into original slots
   * Only overwrites fields where optimized value is non-empty
   * Never touches contact fields or images
   */
  mapOptimizedToSlots(optimized, originalSlots) {
    // Protected fields - never modify these
    const protectedFields = ['phone', 'email', 'address', 'businessName', 'hours', 'heroImage', 'logo'];

    const result = { ...originalSlots };

    // Only overwrite with non-empty optimized values
    for (const [key, value] of Object.entries(optimized)) {
      if (protectedFields.includes(key)) continue;

      if (Array.isArray(value) && value.length > 0) {
        result[key] = value;
      } else if (typeof value === 'string' && value.trim().length > 0) {
        result[key] = value;
      }
    }

    return result;
  }
}

export default ContentOptimizer;
