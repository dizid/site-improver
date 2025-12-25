// src/pageSpeedScorer.js
// Google PageSpeed Insights API client for site scoring

import logger from './logger.js';
import { getEnvConfig, CONFIG } from './config.js';

const log = logger.child('pageSpeed');

const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export class PageSpeedScorer {
  constructor(apiKey = null) {
    this.apiKey = apiKey || getEnvConfig().pageSpeedApiKey;
    // API key is optional but recommended for higher quota
  }

  /**
   * Analyze a URL with PageSpeed Insights
   * @param {string} url - URL to analyze
   * @param {string} strategy - 'mobile' or 'desktop'
   * @returns {Promise<Object>} - PageSpeed results
   */
  async analyze(url, strategy = 'mobile') {
    const params = new URLSearchParams({
      url,
      strategy,
      category: ['performance', 'accessibility', 'best-practices', 'seo'].join(',')
    });

    if (this.apiKey) {
      params.set('key', this.apiKey);
    }

    const apiUrl = `${API_BASE}?${params}`;

    log.info('Analyzing with PageSpeed', { url, strategy });

    try {
      const response = await fetch(apiUrl, {
        timeout: CONFIG.timeouts.pageLoad
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('PageSpeed API error', { status: response.status, error: errorText });
        throw new Error(`PageSpeed API error: ${response.status}`);
      }

      const data = await response.json();
      return this.extractMetrics(data, strategy);
    } catch (error) {
      log.error('PageSpeed analysis failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze a URL with both mobile and desktop strategies
   * @param {string} url - URL to analyze
   * @returns {Promise<Object>} - Combined results
   */
  async analyzeAll(url) {
    log.info('Running full PageSpeed analysis', { url });

    const [mobile, desktop] = await Promise.all([
      this.analyze(url, 'mobile').catch(err => {
        log.warn('Mobile analysis failed', { error: err.message });
        return null;
      }),
      this.analyze(url, 'desktop').catch(err => {
        log.warn('Desktop analysis failed', { error: err.message });
        return null;
      })
    ]);

    // Calculate combined score
    const scores = {};
    const categories = ['performance', 'accessibility', 'bestPractices', 'seo'];

    for (const cat of categories) {
      const mobileScore = mobile?.categories?.[cat] ?? null;
      const desktopScore = desktop?.categories?.[cat] ?? null;

      if (mobileScore !== null && desktopScore !== null) {
        // Weight mobile higher (60/40) since that's what Google prioritizes
        scores[cat] = Math.round(mobileScore * 0.6 + desktopScore * 0.4);
      } else if (mobileScore !== null) {
        scores[cat] = mobileScore;
      } else if (desktopScore !== null) {
        scores[cat] = desktopScore;
      } else {
        scores[cat] = null;
      }
    }

    const overallScore = this.calculateOverallScore(scores);

    return {
      url,
      mobile,
      desktop,
      combined: {
        categories: scores,
        overall: overallScore,
        coreWebVitals: {
          lcp: mobile?.coreWebVitals?.lcp || desktop?.coreWebVitals?.lcp,
          fid: mobile?.coreWebVitals?.fid || desktop?.coreWebVitals?.fid,
          cls: mobile?.coreWebVitals?.cls || desktop?.coreWebVitals?.cls
        }
      }
    };
  }

  /**
   * Extract metrics from PageSpeed API response
   * @param {Object} data - API response
   * @param {string} strategy - Strategy used
   * @returns {Object} - Extracted metrics
   */
  extractMetrics(data, strategy) {
    const lighthouse = data.lighthouseResult;
    if (!lighthouse) {
      return { strategy, categories: {}, coreWebVitals: {} };
    }

    // Extract category scores (0-100)
    const categories = {};
    for (const [key, value] of Object.entries(lighthouse.categories || {})) {
      const normalizedKey = key === 'best-practices' ? 'bestPractices' : key;
      categories[normalizedKey] = Math.round((value.score || 0) * 100);
    }

    // Extract Core Web Vitals from audits
    const audits = lighthouse.audits || {};
    const coreWebVitals = {
      // Largest Contentful Paint (ms)
      lcp: audits['largest-contentful-paint']?.numericValue || null,
      // First Input Delay / Total Blocking Time as proxy (ms)
      fid: audits['total-blocking-time']?.numericValue || null,
      // Cumulative Layout Shift
      cls: audits['cumulative-layout-shift']?.numericValue || null,
      // First Contentful Paint (ms)
      fcp: audits['first-contentful-paint']?.numericValue || null,
      // Time to First Byte (ms)
      ttfb: audits['server-response-time']?.numericValue || null,
      // Speed Index
      speedIndex: audits['speed-index']?.numericValue || null
    };

    // Extract loading time
    const loadTime = audits['interactive']?.numericValue || null;

    return {
      strategy,
      categories,
      coreWebVitals,
      loadTime,
      fetchTime: data.analysisUTCTimestamp
    };
  }

  /**
   * Calculate overall score from category scores
   * @param {Object} categories - Category scores
   * @returns {number} - Overall score (0-100)
   */
  calculateOverallScore(categories) {
    // Weight distribution (aligned with typical site quality priorities)
    const weights = {
      performance: 0.35,
      seo: 0.25,
      accessibility: 0.20,
      bestPractices: 0.20
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [cat, weight] of Object.entries(weights)) {
      if (categories[cat] !== null && categories[cat] !== undefined) {
        weightedSum += categories[cat] * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return null;

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Quick check if a site is a good target based on PageSpeed score
   * Lower scores are better targets (more room for improvement)
   * @param {string} url - URL to check
   * @returns {Promise<Object>} - Target assessment
   */
  async assessTarget(url) {
    try {
      const result = await this.analyzeAll(url);
      const score = result.combined.overall;

      if (score === null) {
        return { url, isTarget: false, reason: 'Could not analyze' };
      }

      // Invert the score for targeting (lower PageSpeed = higher target priority)
      // PageSpeed 100 = Site Score 0 (not a target)
      // PageSpeed 0 = Site Score 100 (prime target)
      const targetScore = 100 - score;

      const isPrimeTarget = targetScore >= 60; // PageSpeed <= 40
      const isTarget = targetScore >= 40;      // PageSpeed <= 60

      let recommendation;
      if (isPrimeTarget) {
        recommendation = 'prime_target';
      } else if (isTarget) {
        recommendation = 'good_target';
      } else if (targetScore >= 20) {
        recommendation = 'weak_target';
      } else {
        recommendation = 'skip';
      }

      return {
        url,
        pageSpeedScore: score,
        targetScore,
        isTarget,
        isPrimeTarget,
        recommendation,
        categories: result.combined.categories,
        coreWebVitals: result.combined.coreWebVitals
      };
    } catch (error) {
      log.warn('Target assessment failed', { url, error: error.message });
      return {
        url,
        isTarget: false,
        reason: error.message
      };
    }
  }
}

export default PageSpeedScorer;
