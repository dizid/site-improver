// src/siteScorer.js
// Quick site quality scoring to filter leads before full pipeline

import { chromium } from 'playwright';
import logger from './logger.js';
import { CONFIG, getSpeedScore, classifyScore } from './config.js';

const log = logger.child('siteScorer');

// Score cache to avoid re-scoring the same site
const scoreCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class SiteScorer {
  constructor(options = {}) {
    this.timeout = options.timeout || CONFIG.timeouts.scoring;
    this.thresholds = {
      good: CONFIG.scoring.maxTargetScore,      // Skip - site is decent
      moderate: CONFIG.scoring.primeTargetScore,  // Maybe worth targeting
      poor: 0        // Prime target
    };
  }

  /**
   * Score a single site (0-100, lower = worse = better target)
   */
  async score(url) {
    // Check cache first
    const cacheKey = url.replace(/\/$/, '').toLowerCase();
    const cached = scoreCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      log.debug('Using cached score', { url, score: cached.result.score });
      return { ...cached.result, fromCache: true };
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    const scores = {
      https: 0,
      mobile: 0,
      speed: 0,
      modern: 0,
      seo: 0
    };

    const issues = [];
    let totalWeight = 0;
    let weightedScore = 0;

    try {
      // Normalize URL
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      const startTime = Date.now();
      
      // Try to load the page
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout
      }).catch(() => null);

      const loadTime = Date.now() - startTime;

      // 1. HTTPS Check (weight: 15)
      const isHttps = url.startsWith('https://') && response?.ok();
      scores.https = isHttps ? 100 : 0;
      if (!isHttps) issues.push('No HTTPS');
      totalWeight += 15;
      weightedScore += scores.https * 15;

      // 2. Load Speed (weight: 20)
      if (loadTime < 2000) scores.speed = 100;
      else if (loadTime < 4000) scores.speed = 70;
      else if (loadTime < 6000) scores.speed = 40;
      else if (loadTime < 10000) scores.speed = 20;
      else scores.speed = 0;
      
      if (scores.speed < 50) issues.push(`Slow load (${(loadTime/1000).toFixed(1)}s)`);
      totalWeight += 20;
      weightedScore += scores.speed * 20;

      // 3. Mobile Viewport (weight: 20)
      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });
      
      scores.mobile = viewport?.includes('width=device-width') ? 100 : 0;
      if (!scores.mobile) issues.push('Not mobile responsive');
      totalWeight += 20;
      weightedScore += scores.mobile * 20;

      // 4. Modern Design Indicators (weight: 25)
      // Uses actual computed styles instead of string matching for reliability
      const designScore = await page.evaluate(() => {
        let score = 0;

        // Check for actual CSS Grid/Flexbox use via computed styles
        const elements = document.querySelectorAll('header, nav, main, footer, section, article, div');
        let hasFlexbox = false;
        let hasGrid = false;
        for (const el of elements) {
          const display = getComputedStyle(el).display;
          if (display === 'flex' || display === 'inline-flex') hasFlexbox = true;
          if (display === 'grid' || display === 'inline-grid') hasGrid = true;
          if (hasFlexbox && hasGrid) break;
        }
        if (hasFlexbox) score += 15;
        if (hasGrid) score += 15;

        // Check for responsive images
        const hasResponsiveImages = document.querySelectorAll('img[srcset], picture source, img[loading="lazy"]').length > 0;
        if (hasResponsiveImages) score += 10;

        // Modern typography (check body font-family)
        const bodyFont = getComputedStyle(document.body).fontFamily.toLowerCase();
        const modernFonts = ['inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'nunito', 'raleway', 'source sans', 'work sans'];
        const hasModernFont = modernFonts.some(f => bodyFont.includes(f));
        // Also check if NOT using old defaults
        const oldFonts = ['times new roman', 'times', 'arial', 'courier', 'comic sans'];
        const hasOldFont = oldFonts.some(f => bodyFont.includes(f)) && !hasModernFont;
        if (hasModernFont) score += 15;
        if (hasOldFont) score -= 10;

        // Check for rounded corners on interactive elements
        const buttons = document.querySelectorAll('button, .btn, [class*="button"], a[class*="btn"]');
        const hasRoundedCorners = Array.from(buttons).some(el => {
          const radius = parseFloat(getComputedStyle(el).borderRadius);
          return radius > 2;
        });
        if (hasRoundedCorners) score += 10;

        // Check for transitions/animations (subtle interactivity)
        const hasTransitions = Array.from(elements).slice(0, 50).some(el => {
          const transition = getComputedStyle(el).transition;
          return transition && transition !== 'none' && transition !== 'all 0s ease 0s';
        });
        if (hasTransitions) score += 10;

        // Not using tables for layout (tables with colspan/rowspan in main content = layout abuse)
        const tables = document.querySelectorAll('table');
        const hasLayoutTables = Array.from(tables).some(t => {
          // Data tables are fine, layout tables are not
          const inContent = t.closest('article, .content, main');
          const hasLayoutAttrs = t.querySelector('td[colspan], td[rowspan], td[width], table[width]');
          return hasLayoutAttrs && !inContent;
        });
        if (!hasLayoutTables && tables.length < 5) score += 15;

        // Check for semantic HTML (modern practice)
        const hasSemanticHTML = document.querySelectorAll('header, nav, main, footer, article, section, aside').length >= 3;
        if (hasSemanticHTML) score += 10;

        return Math.max(0, Math.min(score, 100));
      });

      scores.modern = designScore;
      if (designScore < 40) issues.push('Outdated design');
      totalWeight += 25;
      weightedScore += scores.modern * 25;

      // 5. SEO Basics (weight: 20)
      const seoScore = await page.evaluate(() => {
        let score = 0;
        
        // Has title
        const title = document.querySelector('title');
        if (title?.textContent?.length > 10) score += 20;
        
        // Has meta description
        const desc = document.querySelector('meta[name="description"]');
        if (desc?.getAttribute('content')?.length > 50) score += 20;
        
        // Has H1
        const h1 = document.querySelector('h1');
        if (h1?.textContent?.length > 3) score += 20;
        
        // Has structured data
        const schema = document.querySelector('script[type="application/ld+json"]');
        if (schema) score += 20;
        
        // Has proper heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3');
        if (headings.length >= 3) score += 20;

        return score;
      });

      scores.seo = seoScore;
      if (seoScore < 40) issues.push('Poor SEO basics');
      totalWeight += 20;
      weightedScore += scores.seo * 20;

      // Calculate final score
      const finalScore = Math.round(weightedScore / totalWeight);

      await browser.close();

      const result = {
        url,
        score: finalScore,
        scores,
        issues,
        loadTime,
        isTarget: finalScore < this.thresholds.good,
        isPrimeTarget: finalScore < this.thresholds.moderate,
        recommendation: this.getRecommendation(finalScore)
      };

      // Cache the result
      scoreCache.set(cacheKey, { result, timestamp: Date.now() });
      log.debug('Cached score', { url, score: finalScore });

      return result;

    } catch (error) {
      await browser.close();

      // Site failed to load = SKIP (can't improve what we can't access)
      return {
        url,
        score: null,  // Unknown, not 0
        scores,
        issues: ['Site unreachable: ' + error.message],
        loadTime: null,
        isTarget: false,  // Don't target unreachable sites
        isPrimeTarget: false,
        recommendation: 'skip',
        error: error.message
      };
    }
  }

  /**
   * Score multiple sites
   */
  async scoreBatch(urls, concurrency = 3) {
    const results = [];
    
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.score(url).catch(e => ({
          url,
          score: null,  // Unknown - don't assume it's a good target
          error: e.message,
          isTarget: false,  // Skip unreachable sites
          isPrimeTarget: false,
          recommendation: 'skip'
        })))
      );
      results.push(...batchResults);
      
      // Progress
      log.info(`Scored ${Math.min(i + concurrency, urls.length)}/${urls.length} sites`);
    }

    return results;
  }

  /**
   * Filter leads to only targets
   */
  async filterLeads(leads, options = {}) {
    const { 
      maxScore = 70,        // Only sites scoring below this
      onlyPrime = false,    // Only prime targets (< 40)
      skipNoWebsite = true  // Skip leads without websites
    } = options;

    // Filter leads with websites
    const withWebsites = leads.filter(l => {
      if (!l.website) return !skipNoWebsite;
      return true;
    });

    log.info(`Scoring ${withWebsites.length} sites...`);

    // Score all sites
    const scored = await this.scoreBatch(
      withWebsites.map(l => l.website).filter(Boolean)
    );

    // Create lookup
    const scoreMap = new Map(scored.map(s => [s.url, s]));

    // Merge scores back to leads
    const results = withWebsites.map(lead => {
      const scoreData = lead.website ? scoreMap.get(lead.website) : null;
      return {
        ...lead,
        siteScore: scoreData?.score ?? null,
        siteIssues: scoreData?.issues ?? [],
        isTarget: scoreData?.isTarget ?? true,
        isPrimeTarget: scoreData?.isPrimeTarget ?? false
      };
    });

    // Filter by threshold
    const threshold = onlyPrime ? this.thresholds.moderate : maxScore;
    const targets = results.filter(r => 
      r.siteScore === null || r.siteScore < threshold
    );

    // Sort by score (worst first = best targets)
    targets.sort((a, b) => (a.siteScore ?? 0) - (b.siteScore ?? 0));

    log.info(`Found ${targets.length} targets out of ${leads.length} leads`);

    return {
      targets,
      all: results,
      stats: {
        total: leads.length,
        withWebsite: withWebsites.length,
        targets: targets.length,
        primeTargets: results.filter(r => r.isPrimeTarget).length,
        avgScore: results.length > 0 
          ? Math.round(results.reduce((sum, r) => sum + (r.siteScore ?? 0), 0) / results.length)
          : 0
      }
    };
  }

  getRecommendation(score) {
    if (score < 20) return 'prime_target';
    if (score < 40) return 'strong_target';
    if (score < 60) return 'moderate_target';
    if (score < 80) return 'weak_target';
    return 'skip';
  }
}

export default SiteScorer;
