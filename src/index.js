// src/index.js
// Main entry point - exports all modules

export { scrapeSite } from './scraper.js';
export { default as TemplateBuilder } from './templateBuilder.js';
export { default as AIPolisher } from './aiPolish.js';
export { default as NetlifyDeployer } from './netlifyDeploy.js';
export { default as EmailGenerator, wrapInHtml } from './emailGenerator.js';
export { default as EmailSender } from './emailSender.js';
export { default as OutreachManager, runDailySequence } from './outreach.js';
export { rebuildAndDeploy } from './pipeline.js';
export { default as LeadFinder } from './leadFinder.js';
export { default as SiteScorer } from './siteScorer.js';
export { default as BatchProcessor, runBatch } from './batch.js';
export * from './db.js';
