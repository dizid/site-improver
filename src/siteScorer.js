// src/siteScorer.js
// Quick site quality scoring to filter leads before full pipeline

import { chromium } from 'playwright';
import logger from './logger.js';
import { CONFIG, getSpeedScore, classifyScore } from './config.js';

const log = logger.child('siteScorer');

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
      const designScore = await page.evaluate(() => {
        let score = 0;
        const html = document.documentElement.outerHTML.toLowerCase();
        const styles = Array.from(document.styleSheets).map(s => {
          try { return Array.from(s.cssRules).map(r => r.cssText).join(' '); }
          catch { return ''; }
        }).join(' ').toLowerCase();

        // Modern CSS features
        if (styles.includes('flexbox') || styles.includes('display: flex') || styles.includes('display:flex')) score += 15;
        if (styles.includes('grid') || styles.includes('display: grid')) score += 15;
        if (styles.includes('border-radius')) score += 10;
        if (styles.includes('transition') || styles.includes('animation')) score += 10;
        
        // Modern fonts
        const fonts = ['inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins'];
        if (fonts.some(f => html.includes(f) || styles.includes(f))) score += 15;
        
        // Not using tables for layout
        const tables = document.querySelectorAll('table');
        const layoutTables = Array.from(tables).filter(t => 
          !t.closest('article') && t.querySelectorAll('tr').length > 2
        );
        if (layoutTables.length === 0) score += 15;
        
        // Has modern framework indicators
        if (html.includes('react') || html.includes('vue') || html.includes('next') || 
            html.includes('nuxt') || html.includes('tailwind')) score += 20;

        return Math.min(score, 100);
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

      return {
        url,
        score: finalScore,
        scores,
        issues,
        loadTime,
        isTarget: finalScore < this.thresholds.good,
        isPrimeTarget: finalScore < this.thresholds.moderate,
        recommendation: this.getRecommendation(finalScore)
      };

    } catch (error) {
      await browser.close();
      
      // Site failed to load = prime target
      return {
        url,
        score: 0,
        scores,
        issues: ['Site failed to load: ' + error.message],
        loadTime: null,
        isTarget: true,
        isPrimeTarget: true,
        recommendation: 'prime_target',
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
          score: 0,
          error: e.message,
          isTarget: true,
          isPrimeTarget: true
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
