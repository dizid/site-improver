// src/contentAnalyzer.js
// Smart content selection - rank and filter scraped content instead of taking first-match

import logger from './logger.js';

const log = logger.child('contentAnalyzer');

/**
 * Skip patterns - content matching these is almost never useful
 */
const SKIP_PATTERNS = {
  headlines: [
    /^(home|menu|about|contact|services?|products?|welcome|faq|blog)$/i,
    /^(sign in|log in|register|search|cart|checkout)$/i,
    /^(privacy|terms|cookie|disclaimer)$/i,
    /^(get started|learn more|read more|click here|view all)$/i,
    /^\w+$/, // Single word (too generic)
    /^(page \d+|section \d+)$/i,
    /^\d+$/, // Just numbers
    /^(navigation|menu items?|skip to)$/i
  ],
  paragraphs: [
    /copyright|©|\d{4}\s+all rights reserved/i,
    /cookie|gdpr|privacy policy/i,
    /powered by|built with/i,
    /loading|please wait/i,
    /subscribe to|newsletter/i,
    /^we use cookies/i,
    /^this site uses/i
  ]
};

/**
 * Benefit/value words that indicate good content
 */
const VALUE_WORDS = [
  'quality', 'trusted', 'professional', 'expert', 'experienced',
  'years', 'guaranteed', 'reliable', 'affordable', 'best',
  'local', 'family', 'licensed', 'certified', 'insured',
  'fast', 'quick', 'same day', '24/7', 'emergency',
  'free', 'estimate', 'quote', 'consultation',
  'satisfaction', 'warranty', 'money back'
];

/**
 * Content Analyzer - Rank and filter scraped content
 */
export class ContentAnalyzer {
  constructor(siteData) {
    this.siteData = siteData;
    this.businessName = siteData.businessName?.toLowerCase() || '';
    this.city = this.extractCity(siteData.address)?.toLowerCase() || '';
  }

  extractCity(address) {
    if (!address) return null;
    // Simple city extraction from address
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      return parts[parts.length - 2].replace(/\d+/g, '').trim();
    }
    return null;
  }

  /**
   * Analyze and rank all scraped content
   * Returns best content for each category
   */
  analyze() {
    log.debug('Analyzing content', {
      headlines: this.siteData.headlines?.length || 0,
      paragraphs: this.siteData.paragraphs?.length || 0,
      services: this.siteData.services?.length || 0
    });

    const result = {
      bestHeadline: this.selectBestHeadline(),
      bestSubheadline: this.selectBestSubheadline(),
      rankedServices: this.rankServices(),
      rankedParagraphs: this.rankParagraphs(),
      quality: 'unknown'
    };

    // Calculate overall content quality score
    result.quality = this.assessQuality(result);

    log.debug('Content analysis complete', {
      headline: result.bestHeadline?.substring(0, 50),
      quality: result.quality
    });

    return result;
  }

  /**
   * Select best headline from scraped headlines
   */
  selectBestHeadline() {
    const headlines = this.siteData.headlines || [];
    if (headlines.length === 0) return null;

    const scored = headlines
      .map(h => ({ text: h, score: this.scoreHeadline(h) }))
      .filter(h => h.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.text || null;
  }

  /**
   * Select best subheadline (supporting paragraph)
   */
  selectBestSubheadline() {
    const paragraphs = this.siteData.paragraphs || [];
    if (paragraphs.length === 0) return null;

    const scored = paragraphs
      .filter(p => p.length >= 30 && p.length <= 200)
      .map(p => ({ text: p, score: this.scoreParagraph(p, true) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.text || null;
  }

  /**
   * Score a headline (higher = better)
   */
  scoreHeadline(headline) {
    let score = 0;

    // Skip if matches garbage patterns
    if (SKIP_PATTERNS.headlines.some(p => p.test(headline.trim()))) {
      return -100;
    }

    // Length preference (10-60 chars is ideal)
    const len = headline.length;
    if (len >= 10 && len <= 60) score += 20;
    else if (len < 10) score -= 30;
    else if (len > 100) score -= 10;

    // Contains business name (good for verification)
    if (this.businessName && headline.toLowerCase().includes(this.businessName)) {
      score += 15;
    }

    // Contains location (local business signal)
    if (this.city && headline.toLowerCase().includes(this.city)) {
      score += 10;
    }

    // Contains value words
    const headlineLower = headline.toLowerCase();
    const valueWordCount = VALUE_WORDS.filter(w => headlineLower.includes(w)).length;
    score += valueWordCount * 5;

    // Has proper capitalization (not all caps, not all lower)
    if (headline !== headline.toUpperCase() && headline !== headline.toLowerCase()) {
      score += 5;
    }

    // Penalize if looks like navigation
    if (headline.includes('|') || headline.includes('>') || headline.includes('::')) {
      score -= 20;
    }

    return score;
  }

  /**
   * Score a paragraph (higher = better)
   */
  scoreParagraph(paragraph, forSubheadline = false) {
    let score = 0;

    // Skip if matches garbage patterns
    if (SKIP_PATTERNS.paragraphs.some(p => p.test(paragraph))) {
      return -100;
    }

    const len = paragraph.length;

    if (forSubheadline) {
      // For subheadline: prefer shorter, punchier content
      if (len >= 30 && len <= 100) score += 20;
      else if (len > 200) score -= 10;
    } else {
      // For body paragraphs: prefer substantial content
      if (len >= 100 && len <= 500) score += 15;
      else if (len < 50) score -= 10;
    }

    // Contains value words
    const paragraphLower = paragraph.toLowerCase();
    const valueWordCount = VALUE_WORDS.filter(w => paragraphLower.includes(w)).length;
    score += valueWordCount * 3;

    // Contains business name
    if (this.businessName && paragraphLower.includes(this.businessName)) {
      score += 10;
    }

    // Contains location
    if (this.city && paragraphLower.includes(this.city)) {
      score += 8;
    }

    // Penalize if has too many links (probably navigation)
    const linkCount = (paragraph.match(/http|www\.|click|tap/gi) || []).length;
    score -= linkCount * 5;

    return score;
  }

  /**
   * Rank services by quality
   */
  rankServices() {
    const services = this.siteData.services || [];
    if (services.length === 0) return [];

    const scored = services
      .map(service => {
        const name = typeof service === 'string' ? service : service.name || service;
        return {
          name,
          description: typeof service === 'object' ? service.description : null,
          score: this.scoreService(name)
        };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 8);
  }

  /**
   * Score a service name
   */
  scoreService(name) {
    if (!name || name.length < 3 || name.length > 80) return -100;

    let score = 10; // Base score

    // Skip generic/navigation items
    if (/^(home|about|contact|more|view|see|all)$/i.test(name)) {
      return -100;
    }

    // Prefer medium length (3-40 chars)
    if (name.length >= 5 && name.length <= 40) score += 10;

    // Contains value words
    const nameLower = name.toLowerCase();
    const valueWordCount = VALUE_WORDS.filter(w => nameLower.includes(w)).length;
    score += valueWordCount * 3;

    return score;
  }

  /**
   * Rank all paragraphs by quality
   */
  rankParagraphs() {
    const paragraphs = this.siteData.paragraphs || [];
    if (paragraphs.length === 0) return [];

    const scored = paragraphs
      .map(text => ({ text, score: this.scoreParagraph(text) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 5);
  }

  /**
   * Assess overall content quality
   */
  assessQuality(analysis) {
    let qualityScore = 0;

    // Has good headline
    if (analysis.bestHeadline && analysis.bestHeadline.length > 10) {
      qualityScore += 25;
    }

    // Has good subheadline
    if (analysis.bestSubheadline && analysis.bestSubheadline.length > 30) {
      qualityScore += 20;
    }

    // Has services
    const serviceCount = analysis.rankedServices.length;
    if (serviceCount >= 3) qualityScore += 25;
    else if (serviceCount >= 1) qualityScore += 10;

    // Has body content
    const paragraphCount = analysis.rankedParagraphs.length;
    if (paragraphCount >= 3) qualityScore += 15;
    else if (paragraphCount >= 1) qualityScore += 5;

    // Has testimonials
    const testimonialCount = this.siteData.testimonials?.length || 0;
    if (testimonialCount >= 2) qualityScore += 15;
    else if (testimonialCount >= 1) qualityScore += 8;

    if (qualityScore >= 70) return 'good';
    if (qualityScore >= 40) return 'fair';
    return 'poor';
  }
}

/**
 * Convenience function to analyze site data
 */
export function analyzeContent(siteData) {
  const analyzer = new ContentAnalyzer(siteData);
  return analyzer.analyze();
}

export default ContentAnalyzer;
