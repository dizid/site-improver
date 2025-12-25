// src/batch.js
// Batch processor: Find leads → Qualify → Score → Process pipeline

import fs from 'fs/promises';
import { createLeadFinder } from './leadSource.js';
import SiteScorer from './siteScorer.js';
import PageSpeedScorer from './pageSpeedScorer.js';
import { LeadQualifier } from './leadQualifier.js';
import { rebuildAndDeploy } from './pipeline.js';
import { OutreachManager } from './outreach.js';
import { saveDeployment, getDeployments } from './db.js';
import logger from './logger.js';
import { CONFIG, getFeatures } from './config.js';
import { delay } from './utils.js';

const log = logger.child('batch');

export class BatchProcessor {
  constructor(config = {}) {
    this.config = {
      netlifyToken: config.netlifyToken || process.env.NETLIFY_AUTH_TOKEN,
      resendKey: config.resendKey || process.env.RESEND_API_KEY,
      fromEmail: config.fromEmail || process.env.FROM_EMAIL,
      maxScoreThreshold: config.maxScoreThreshold || CONFIG.scoring.maxTargetScore,
      primeScoreThreshold: config.primeScoreThreshold || CONFIG.scoring.primeTargetScore,
      skipPolish: config.skipPolish || false,
      skipEmail: config.skipEmail || false,
      skipQualify: config.skipQualify || false,
      scoringStrategy: config.scoringStrategy || 'hybrid', // 'pageSpeed', 'browser', or 'hybrid'
      leadSource: config.leadSource || process.env.LEAD_SOURCE || 'auto', // 'outscraper', 'googlePlaces', or 'auto'
      concurrency: config.concurrency || CONFIG.batch.defaultConcurrency,
      delayBetween: config.delayBetween || CONFIG.batch.defaultDelay
    };

    this.features = getFeatures();

    // Initialize lead finder using factory (auto-selects based on available API keys)
    try {
      this.leadFinder = createLeadFinder(this.config.leadSource);
    } catch (error) {
      log.warn('No lead finder available', { error: error.message });
      this.leadFinder = null;
    }

    // Site scoring - browser-based (fallback)
    this.siteScorer = new SiteScorer();

    // PageSpeed API scoring (faster, when available)
    this.pageSpeedScorer = new PageSpeedScorer();

    // Lead qualification (filter junk, prioritize)
    this.leadQualifier = new LeadQualifier({
      requireContact: true,
      filterMarkets: false
    });
  }

  /**
   * Full flow: Search → Score → Process
   */
  async run(options) {
    const {
      query,           // e.g., "plumber"
      locations,       // e.g., ["Denver, CO", "Austin, TX"]
      limitPerLocation = 20,
      maxLeads = 50,   // Max leads to process
      dryRun = false   // Don't actually deploy/email
    } = options;

    // Input validation
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required');
    }
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      throw new Error('At least one location is required');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🚀 BATCH PROCESSOR');
    console.log('='.repeat(60));

    // Step 1: Find leads
    console.log('\n📍 STEP 1: Finding leads...\n');
    
    let leads;
    if (this.leadFinder) {
      leads = await this.leadFinder.searchIndustry(query, locations, limitPerLocation);
      console.log(`   Found ${leads.length} businesses`);
    } else {
      throw new Error('OUTSCRAPER_API_KEY not set - cannot find leads');
    }

    // Handle no results
    if (leads.length === 0) {
      console.log('\n⚠️  No leads found. Try different query or location.');
      return { leads: [], targets: [], results: [], stats: { total: 0 } };
    }

    // Step 1B: Pre-qualify leads (filter junk before scoring)
    let qualifiedLeads = leads;
    let qualificationStats = null;

    if (!this.config.skipQualify) {
      console.log('\n🔍 STEP 1B: Qualifying leads...\n');

      const qualResult = this.leadQualifier.qualifyBatch(leads);
      qualifiedLeads = qualResult.qualified.map(q => q.lead || q);
      qualificationStats = qualResult.stats;

      console.log(`   - Total: ${qualificationStats.total}`);
      console.log(`   - Qualified: ${qualificationStats.qualified}`);
      console.log(`   - Disqualified: ${qualificationStats.disqualified}`);

      if (Object.keys(qualificationStats.disqualifyReasons).length > 0) {
        console.log('   - Rejection reasons:');
        for (const [reason, count] of Object.entries(qualificationStats.disqualifyReasons)) {
          console.log(`     • ${reason}: ${count}`);
        }
      }

      if (qualifiedLeads.length === 0) {
        console.log('\n⚠️  No qualified leads. All filtered out.');
        return { leads, targets: [], results: [], stats: { total: leads.length, qualified: 0 } };
      }
    }

    // Step 2: Score sites (hybrid: PageSpeed first, fallback to browser)
    console.log('\n📊 STEP 2: Scoring websites...\n');

    const { targets, stats } = await this.scoreLeads(qualifiedLeads, {
      maxScore: this.config.maxScoreThreshold,
      strategy: this.config.scoringStrategy
    });

    console.log('\n   Scoring Stats:');
    console.log(`   - Leads scored: ${stats.total}`);
    console.log(`   - With websites: ${stats.withWebsite}`);
    console.log(`   - Targets (score < ${this.config.maxScoreThreshold}): ${stats.targets}`);
    console.log(`   - Prime targets (score < ${this.config.primeScoreThreshold}): ${stats.primeTargets}`);
    console.log(`   - Average score: ${stats.avgScore}`);
    if (stats.scoringMethod) {
      console.log(`   - Scoring method: ${stats.scoringMethod}`);
    }

    // Step 3: Process pipeline
    console.log('\n🔧 STEP 3: Processing targets...\n');
    
    const toProcess = targets.slice(0, maxLeads);
    const results = [];

    for (let i = 0; i < toProcess.length; i++) {
      const lead = toProcess[i];
      console.log(`\n[${i + 1}/${toProcess.length}] ${lead.name}`);
      console.log(`   Website: ${lead.website}`);
      console.log(`   Score: ${lead.siteScore} (${lead.siteIssues.join(', ') || 'N/A'})`);

      if (dryRun) {
        console.log('   ⏭️  Skipped (dry run)');
        results.push({ lead, status: 'skipped', reason: 'dry_run' });
        continue;
      }

      // Check if already processed
      const existing = await this.checkExisting(lead.website);
      if (existing) {
        console.log('   ⏭️  Skipped (already processed)');
        results.push({ lead, status: 'skipped', reason: 'already_processed' });
        continue;
      }

      try {
        // Run pipeline
        const result = await rebuildAndDeploy(lead.website, {
          skipPolish: this.config.skipPolish
        });

        // Override contact info with lead data (often more accurate)
        if (lead.email && !result.siteData.email) {
          result.siteData.email = lead.email;
        }
        if (lead.phone && !result.siteData.phone) {
          result.siteData.phone = lead.phone;
        }

        console.log(`   ✅ Deployed: ${result.preview}`);

        // Send email if configured
        if (!this.config.skipEmail && result.siteData.email && this.config.resendKey) {
          try {
            const outreach = new OutreachManager({
              resendApiKey: this.config.resendKey,
              fromEmail: this.config.fromEmail
            });
            
            const deployment = await this.getDeploymentBySiteId(result.siteId);
            if (deployment) {
              await outreach.sendInitialOutreach(deployment);
              console.log(`   📧 Email sent to ${result.siteData.email}`);
            }
          } catch (emailError) {
            console.log(`   ⚠️  Email failed: ${emailError.message}`);
          }
        }

        results.push({
          lead,
          status: 'success',
          preview: result.preview,
          siteId: result.siteId
        });

        // Delay between runs
        if (i < toProcess.length - 1) {
          await delay(this.config.delayBetween);
        }

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        log.error('Pipeline failed', { lead: lead.name, error: error.message });
        results.push({ lead, status: 'error', error: error.message });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    const skipped = results.filter(r => r.status === 'skipped');

    console.log(`\n   Processed: ${toProcess.length}`);
    console.log(`   ✅ Success: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   ⏭️  Skipped: ${skipped.length}`);
    console.log('');

    return {
      leads,
      targets,
      results,
      stats: {
        ...stats,
        processed: toProcess.length,
        successful: successful.length,
        failed: failed.length,
        skipped: skipped.length
      }
    };
  }

  /**
   * Process from CSV file
   */
  async processCSV(filePath, options = {}) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const websiteIndex = header.findIndex(h => 
      h === 'website' || h === 'url' || h === 'site'
    );
    const nameIndex = header.findIndex(h => 
      h === 'name' || h === 'business' || h === 'company'
    );
    const emailIndex = header.findIndex(h => h === 'email');
    const phoneIndex = header.findIndex(h => h === 'phone');

    if (websiteIndex === -1) {
      throw new Error('CSV must have a "website" or "url" column');
    }

    // Parse rows
    const leads = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i]);
      if (!cols[websiteIndex]) continue;

      leads.push({
        website: cols[websiteIndex],
        name: nameIndex >= 0 ? cols[nameIndex] : `Lead ${i}`,
        email: emailIndex >= 0 ? cols[emailIndex] : null,
        phone: phoneIndex >= 0 ? cols[phoneIndex] : null
      });
    }

    console.log(`📄 Loaded ${leads.length} leads from CSV`);

    // Qualify leads first
    let qualifiedLeads = leads;
    if (!options.skipQualify) {
      console.log('\n🔍 Qualifying leads...');
      const qualResult = this.leadQualifier.qualifyBatch(leads);
      qualifiedLeads = qualResult.qualified.map(q => q.lead || q);
      console.log(`   Qualified: ${qualifiedLeads.length}/${leads.length}`);
    }

    // Score and filter using hybrid scoring
    console.log('\n📊 Scoring websites...');
    const { targets, stats } = await this.scoreLeads(qualifiedLeads, {
      maxScore: options.maxScore || this.config.maxScoreThreshold,
      strategy: this.config.scoringStrategy
    });

    console.log(`   Targets: ${targets.length} (score < ${options.maxScore || this.config.maxScoreThreshold})`);

    // Process
    return this.processLeads(targets, options);
  }

  /**
   * Process a list of leads
   */
  async processLeads(leads, options = {}) {
    const {
      maxLeads = 50,
      dryRun = false
    } = options;

    const toProcess = leads.slice(0, maxLeads);
    const results = [];

    console.log(`\n🔧 Processing ${toProcess.length} leads...\n`);

    for (let i = 0; i < toProcess.length; i++) {
      const lead = toProcess[i];
      console.log(`\n[${i + 1}/${toProcess.length}] ${lead.name || lead.website}`);

      if (dryRun) {
        console.log('   ⏭️  Skipped (dry run)');
        results.push({ lead, status: 'skipped' });
        continue;
      }

      const existing = await this.checkExisting(lead.website);
      if (existing) {
        console.log('   ⏭️  Already processed');
        results.push({ lead, status: 'skipped', reason: 'exists' });
        continue;
      }

      try {
        const result = await rebuildAndDeploy(lead.website, {
          skipPolish: this.config.skipPolish
        });

        console.log(`   ✅ ${result.preview}`);
        results.push({ lead, status: 'success', preview: result.preview });

        if (i < toProcess.length - 1) {
          await delay(this.config.delayBetween);
        }
      } catch (error) {
        console.log(`   ❌ ${error.message}`);
        log.error('Lead processing failed', { lead: lead.name, error: error.message });
        results.push({ lead, status: 'error', error: error.message });
      }
    }

    return results;
  }

  /**
   * Score leads using hybrid strategy (PageSpeed first, browser fallback)
   */
  async scoreLeads(leads, options = {}) {
    const { maxScore = 60, strategy = 'hybrid' } = options;
    const results = [];
    let scoringMethod = 'browser';

    // Filter to leads with websites
    const leadsWithWebsites = leads.filter(l => l.website);

    for (const lead of leadsWithWebsites) {
      let scoreResult = null;

      // Try PageSpeed first (if hybrid or pageSpeed strategy)
      if (strategy === 'hybrid' || strategy === 'pageSpeed') {
        try {
          const psResult = await this.pageSpeedScorer.assessTarget(lead.website);
          if (psResult && psResult.targetScore !== undefined) {
            scoreResult = {
              score: psResult.targetScore, // Already inverted (lower PageSpeed = higher target score)
              pageSpeedScore: psResult.pageSpeedScore,
              isTarget: psResult.isTarget,
              isPrimeTarget: psResult.isPrimeTarget,
              issues: this.formatPageSpeedIssues(psResult.categories),
              method: 'pageSpeed'
            };
            scoringMethod = 'pageSpeed';
          }
        } catch (error) {
          log.debug('PageSpeed failed, falling back to browser', { url: lead.website, error: error.message });
        }
      }

      // Fallback to browser scoring (if no result yet or browser-only strategy)
      if (!scoreResult && (strategy === 'hybrid' || strategy === 'browser')) {
        try {
          const browserResult = await this.siteScorer.score(lead.website);
          scoreResult = {
            score: browserResult.score,
            isTarget: browserResult.isTarget,
            isPrimeTarget: browserResult.isPrimeTarget,
            issues: browserResult.issues || [],
            method: 'browser'
          };
          if (scoringMethod !== 'pageSpeed') scoringMethod = 'browser';
        } catch (error) {
          log.warn('Browser scoring failed', { url: lead.website, error: error.message });
          // Mark as potential target with unknown score
          scoreResult = {
            score: 50, // Middle score - unknown
            isTarget: true,
            isPrimeTarget: false,
            issues: ['Scoring failed'],
            method: 'fallback'
          };
        }
      }

      // Enrich lead with score
      results.push({
        ...lead,
        siteScore: scoreResult.score,
        siteIssues: scoreResult.issues,
        isTarget: scoreResult.score < maxScore,
        isPrimeTarget: scoreResult.score < this.config.primeScoreThreshold,
        scoringMethod: scoreResult.method
      });

      console.log(`   ${lead.name || lead.website}: ${scoreResult.score} (${scoreResult.method})`);
    }

    // Filter to targets and sort (lower score = worse site = better target)
    const targets = results
      .filter(l => l.siteScore < maxScore)
      .sort((a, b) => a.siteScore - b.siteScore);

    // Calculate stats
    const scores = results.map(r => r.siteScore).filter(s => s !== null);
    const stats = {
      total: results.length,
      withWebsite: leadsWithWebsites.length,
      targets: targets.length,
      primeTargets: results.filter(r => r.isPrimeTarget).length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      scoringMethod
    };

    return { targets, all: results, stats };
  }

  /**
   * Format PageSpeed categories into issue list
   */
  formatPageSpeedIssues(categories) {
    if (!categories) return [];
    const issues = [];
    if (categories.performance < 50) issues.push('Slow performance');
    if (categories.accessibility < 50) issues.push('Accessibility issues');
    if (categories.seo < 50) issues.push('Poor SEO');
    if (categories.bestPractices < 50) issues.push('Best practices issues');
    return issues;
  }

  async checkExisting(website) {
    const deployments = await getDeployments();
    return deployments.find(d =>
      d.original === website ||
      d.original === website.replace(/\/$/, '') ||
      d.original === 'https://' + website.replace(/^https?:\/\//, '')
    );
  }

  async getDeploymentBySiteId(siteId) {
    const deployments = await getDeployments();
    return deployments.find(d => d.siteId === siteId);
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}

/**
 * Quick helper to run from command line
 */
export async function runBatch(query, locations, options = {}) {
  const processor = new BatchProcessor();
  return processor.run({
    query,
    locations: Array.isArray(locations) ? locations : [locations],
    ...options
  });
}

export default BatchProcessor;
