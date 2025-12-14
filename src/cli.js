#!/usr/bin/env node
// src/cli.js

import { program } from 'commander';
import { config } from 'dotenv';
import fs from 'fs/promises';

// Load environment variables
config();

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Error:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

program
  .name('site-improver')
  .description('Automated site rebuilding and cold outreach pipeline')
  .version('1.0.0');

// Scrape command
program
  .command('scrape <url>')
  .description('Scrape a website and output data')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (url, options) => {
    const { scrapeSite } = await import('./scraper.js');
    
    console.log(`🔍 Scraping ${url}...`);
    const data = await scrapeSite(url);
    
    const output = JSON.stringify(data, null, 2);
    
    if (options.output) {
      await fs.writeFile(options.output, output);
      console.log(`✅ Saved to ${options.output}`);
    } else {
      console.log(output);
    }
  });

// Build command
program
  .command('build <url>')
  .description('Scrape and build a new site (no deploy)')
  .option('-o, --output <file>', 'Output HTML file', 'output.html')
  .option('--no-polish', 'Skip AI polish step')
  .action(async (url, options) => {
    const { rebuildAndDeploy } = await import('./pipeline.js');
    
    const result = await rebuildAndDeploy(url, {
      skipDeploy: true,
      skipPolish: !options.polish
    });
    
    await fs.writeFile(options.output, result.html);
    console.log(`📄 Saved to ${options.output}`);
  });

// Deploy command
program
  .command('deploy <url>')
  .description('Scrape, build, and deploy to Netlify')
  .option('--no-polish', 'Skip AI polish step')
  .action(async (url, options) => {
    if (!process.env.NETLIFY_AUTH_TOKEN) {
      console.error('❌ NETLIFY_AUTH_TOKEN not set');
      process.exit(1);
    }
    
    const { rebuildAndDeploy } = await import('./pipeline.js');
    
    const result = await rebuildAndDeploy(url, {
      skipPolish: !options.polish
    });
    
    console.log('\n📋 Summary:');
    console.log(`   Business: ${result.siteData.businessName}`);
    console.log(`   Industry: ${result.industry}`);
    console.log(`   Preview:  ${result.preview}`);
    console.log(`   Email:    ${result.siteData.email || 'Not found'}`);
    console.log(`   Phone:    ${result.siteData.phone || 'Not found'}`);
  });

// Full pipeline command
program
  .command('pipeline <url>')
  .description('Run full pipeline: scrape, build, deploy, and send outreach email')
  .option('--no-polish', 'Skip AI polish step')
  .option('--no-email', 'Skip sending outreach email')
  .action(async (url, options) => {
    if (!process.env.NETLIFY_AUTH_TOKEN) {
      console.error('❌ NETLIFY_AUTH_TOKEN not set');
      process.exit(1);
    }
    
    const { rebuildAndDeploy } = await import('./pipeline.js');
    const { OutreachManager } = await import('./outreach.js');
    const { getDeployment } = await import('./db.js');
    
    // Rebuild and deploy
    const result = await rebuildAndDeploy(url, {
      skipPolish: !options.polish
    });
    
    // Send outreach email
    if (options.email && result.siteData.email) {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        console.log('⚠️  RESEND_API_KEY or FROM_EMAIL not set, skipping email');
      } else {
        const outreach = new OutreachManager({
          resendApiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.FROM_EMAIL
        });
        
        const deployment = await getDeployment(result.siteId);
        if (deployment) {
          await outreach.sendInitialOutreach(deployment);
        }
      }
    }
    
    console.log('\n📋 Summary:');
    console.log(`   Business: ${result.siteData.businessName}`);
    console.log(`   Industry: ${result.industry}`);
    console.log(`   Preview:  ${result.preview}`);
    console.log(`   Email:    ${result.siteData.email || 'Not found'}`);
    console.log(`   Phone:    ${result.siteData.phone || 'Not found'}`);
  });

// Outreach command
program
  .command('outreach <siteId>')
  .description('Send outreach email for a deployment')
  .action(async (siteId) => {
    if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
      console.error('❌ RESEND_API_KEY and FROM_EMAIL must be set');
      process.exit(1);
    }
    
    const { OutreachManager } = await import('./outreach.js');
    const { getDeployment } = await import('./db.js');
    
    const deployment = await getDeployment(siteId);
    if (!deployment) {
      console.error(`❌ Deployment not found: ${siteId}`);
      process.exit(1);
    }
    
    const outreach = new OutreachManager({
      resendApiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL
    });
    
    await outreach.sendInitialOutreach(deployment);
  });

// Sequence command
program
  .command('sequence')
  .description('Run daily outreach sequence (send follow-ups)')
  .action(async () => {
    if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
      console.error('❌ RESEND_API_KEY and FROM_EMAIL must be set');
      process.exit(1);
    }
    
    const { runDailySequence } = await import('./outreach.js');
    
    console.log('📧 Running daily outreach sequence...');
    await runDailySequence({
      resendApiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.FROM_EMAIL
    });
    console.log('✅ Sequence complete');
  });

// Cleanup command
program
  .command('cleanup')
  .description('Delete old Netlify preview sites')
  .option('-d, --days <days>', 'Max age in days', '30')
  .action(async (options) => {
    if (!process.env.NETLIFY_AUTH_TOKEN) {
      console.error('❌ NETLIFY_AUTH_TOKEN not set');
      process.exit(1);
    }
    
    const { default: NetlifyDeployer } = await import('./netlifyDeploy.js');
    
    const deployer = new NetlifyDeployer(process.env.NETLIFY_AUTH_TOKEN);
    const deleted = await deployer.cleanupOldSites(parseInt(options.days));
    
    console.log(`🗑️  Deleted ${deleted.length} old sites:`);
    deleted.forEach(name => console.log(`   - ${name}`));
  });

// List deployments command
program
  .command('list')
  .description('List all deployments')
  .option('-s, --status <status>', 'Filter by status')
  .action(async (options) => {
    const { getDeployments } = await import('./db.js');
    
    const deployments = await getDeployments(options.status);
    
    if (deployments.length === 0) {
      console.log('No deployments found');
      return;
    }
    
    console.log(`\n📋 Deployments (${deployments.length}):\n`);
    
    for (const d of deployments) {
      console.log(`${d.businessName || 'Unknown'}`);
      console.log(`   Status:  ${d.status}`);
      console.log(`   Preview: ${d.preview}`);
      console.log(`   Email:   ${d.email || 'N/A'}`);
      console.log(`   Created: ${d.createdAt}`);
      console.log('');
    }
  });

// Find leads command
program
  .command('find <query>')
  .description('Find leads via Google Maps (requires OUTSCRAPER_API_KEY)')
  .option('-l, --location <location>', 'Location to search', 'Denver, CO')
  .option('-n, --limit <number>', 'Number of results', '20')
  .option('-o, --output <file>', 'Save to JSON file')
  .action(async (query, options) => {
    if (!process.env.OUTSCRAPER_API_KEY) {
      console.error('❌ OUTSCRAPER_API_KEY not set');
      console.log('\nGet an API key at: https://outscraper.com/');
      process.exit(1);
    }
    
    const { default: LeadFinder } = await import('./leadFinder.js');
    
    const finder = new LeadFinder(process.env.OUTSCRAPER_API_KEY);
    
    console.log(`🔍 Searching for "${query}" in ${options.location}...`);
    
    const leads = await finder.search(query, options.location, parseInt(options.limit));
    
    console.log(`\n✅ Found ${leads.length} businesses:\n`);
    
    for (const lead of leads) {
      console.log(`${lead.name}`);
      console.log(`   Website: ${lead.website || 'N/A'}`);
      console.log(`   Phone:   ${lead.phone || 'N/A'}`);
      console.log(`   Rating:  ${lead.rating || 'N/A'} (${lead.reviews} reviews)`);
      console.log('');
    }
    
    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(leads, null, 2));
      console.log(`💾 Saved to ${options.output}`);
    }
  });

// Score sites command
program
  .command('score <urls...>')
  .description('Score website quality (0-100, lower = better target)')
  .action(async (urls) => {
    const { default: SiteScorer } = await import('./siteScorer.js');
    
    const scorer = new SiteScorer();
    
    console.log(`\n📊 Scoring ${urls.length} site(s)...\n`);
    
    for (const url of urls) {
      const result = await scorer.score(url);
      
      console.log(`${url}`);
      console.log(`   Score: ${result.score}/100 (${result.recommendation})`);
      console.log(`   - HTTPS: ${result.scores.https}`);
      console.log(`   - Speed: ${result.scores.speed} (${result.loadTime}ms)`);
      console.log(`   - Mobile: ${result.scores.mobile}`);
      console.log(`   - Modern: ${result.scores.modern}`);
      console.log(`   - SEO: ${result.scores.seo}`);
      if (result.issues.length > 0) {
        console.log(`   Issues: ${result.issues.join(', ')}`);
      }
      console.log(`   Target: ${result.isTarget ? '✅ Yes' : '❌ No'}`);
      console.log('');
    }
  });

// Batch command
program
  .command('batch <query>')
  .description('Find, score, and process leads in batch')
  .option('-l, --locations <locations>', 'Comma-separated locations', 'Denver, CO')
  .option('-n, --limit <number>', 'Leads per location', '20')
  .option('-m, --max <number>', 'Max leads to process', '10')
  .option('--max-score <number>', 'Max site score to target', '60')
  .option('--dry-run', 'Find and score only, don\'t deploy')
  .option('--no-email', 'Skip sending outreach emails')
  .action(async (query, options) => {
    if (!process.env.OUTSCRAPER_API_KEY) {
      console.error('❌ OUTSCRAPER_API_KEY not set');
      process.exit(1);
    }
    if (!options.dryRun && !process.env.NETLIFY_AUTH_TOKEN) {
      console.error('❌ NETLIFY_AUTH_TOKEN not set');
      process.exit(1);
    }
    
    const { default: BatchProcessor } = await import('./batch.js');
    
    const processor = new BatchProcessor({
      maxScoreThreshold: parseInt(options.maxScore),
      skipEmail: !options.email
    });
    
    const locations = options.locations.split(',').map(l => l.trim());
    
    await processor.run({
      query,
      locations,
      limitPerLocation: parseInt(options.limit),
      maxLeads: parseInt(options.max),
      dryRun: options.dryRun
    });
  });

// Process CSV command
program
  .command('process-csv <file>')
  .description('Process leads from CSV file')
  .option('-m, --max <number>', 'Max leads to process', '10')
  .option('--max-score <number>', 'Max site score to target', '60')
  .option('--dry-run', 'Score only, don\'t deploy')
  .action(async (file, options) => {
    if (!options.dryRun && !process.env.NETLIFY_AUTH_TOKEN) {
      console.error('❌ NETLIFY_AUTH_TOKEN not set');
      process.exit(1);
    }
    
    const { default: BatchProcessor } = await import('./batch.js');
    
    const processor = new BatchProcessor({
      maxScoreThreshold: parseInt(options.maxScore)
    });
    
    await processor.processCSV(file, {
      maxLeads: parseInt(options.max),
      maxScore: parseInt(options.maxScore),
      dryRun: options.dryRun
    });
  });

program.parse();
