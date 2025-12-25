// src/pipeline.js
import { scrapeSiteLite as scrapeSite } from './scraperLite.js';
import TemplateBuilder from './templateBuilder.js';
import AIPolisher from './aiPolish.js';
import NetlifyDeployer from './netlifyDeploy.js';
import { saveDeployment } from './db.js';
import logger from './logger.js';
import { extractCity } from './utils.js';
import { getFeatures } from './config.js';

const log = logger.child('pipeline');

/**
 * Create an error with step information for tracking
 */
function createPipelineError(message, step, cause = null) {
  const error = new Error(message);
  error.step = step;
  if (cause) {
    error.cause = cause;
    error.stack = `${error.stack}\nCaused by: ${cause.stack}`;
  }
  return error;
}

export async function rebuildAndDeploy(targetUrl, options = {}) {
  const startTime = Date.now();
  const features = getFeatures();

  // 1. Scrape
  log.info('Step 1: Scraping site...');
  let siteData;
  try {
    siteData = await scrapeSite(targetUrl);
    log.info('Site data extracted', {
      business: siteData.businessName || 'Unknown',
      phone: siteData.phone || 'Not found',
      email: siteData.email || 'Not found'
    });
  } catch (error) {
    throw createPipelineError(`Failed to scrape site: ${error.message}`, 'scrape', error);
  }

  // 2. Build template
  log.info('Step 2: Building template...');
  let slots, industry, builder;
  try {
    builder = new TemplateBuilder(options.templatesDir);
    await builder.init();
    const buildResult = await builder.build(siteData);
    slots = buildResult.slots;
    industry = buildResult.industry;
    siteData.industry = industry;
    log.info('Template built', { industry });
  } catch (error) {
    throw createPipelineError(`Failed to build template: ${error.message}`, 'build', error);
  }

  // 3. AI Polish (optional - graceful degradation)
  let polishedSlots = slots;
  const shouldPolish = !options.skipPolish && features.aiPolish;

  if (shouldPolish) {
    log.info('Step 3: Polishing copy with AI...');
    try {
      const polisher = new AIPolisher();
      polishedSlots = await polisher.polishAll(slots, siteData);
    } catch (error) {
      log.warn('AI polish failed, using raw content', { error: error.message });
      // Continue with unpolished slots - graceful degradation
    }
  } else if (!options.skipPolish && !features.aiPolish) {
    log.info('Step 3: AI polish skipped - ANTHROPIC_API_KEY not configured');
  } else {
    log.info('Step 3: AI polish skipped by request');
  }

  // 4. Generate final HTML
  log.info('Step 4: Generating HTML...');
  let finalHtml;
  try {
    finalHtml = await builder.buildWithSlots(siteData, polishedSlots);
  } catch (error) {
    throw createPipelineError(`Failed to generate HTML: ${error.message}`, 'generate', error);
  }

  // 5. Deploy to Netlify (optional - graceful degradation)
  let deployment = null;
  const shouldDeploy = !options.skipDeploy && features.deploy;

  if (shouldDeploy) {
    log.info('Step 5: Deploying to Netlify...');
    try {
      const deployer = new NetlifyDeployer(process.env.NETLIFY_AUTH_TOKEN);
      deployment = await deployer.deploy(finalHtml, siteData.businessName || 'preview');
    } catch (error) {
      log.warn('Netlify deploy failed', { error: error.message });
      // Continue without deployment - graceful degradation
    }
  } else if (!options.skipDeploy && !features.deploy) {
    log.info('Step 5: Netlify deploy skipped - NETLIFY_AUTH_TOKEN not configured');
  } else {
    log.info('Step 5: Netlify deploy skipped by request');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const result = {
    original: targetUrl,
    html: finalHtml,
    siteData,
    industry,
    slots: polishedSlots,
    duration
  };

  if (deployment) {
    result.preview = deployment.url;
    result.siteId = deployment.siteId;
    result.siteName = deployment.siteName;

    // Extract city from address
    const city = extractCity(siteData.address);

    // Save to database
    await saveDeployment({
      siteId: deployment.siteId,
      siteName: deployment.siteName,
      original: targetUrl,
      preview: deployment.url,
      businessName: siteData.businessName,
      industry,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      city
    });
  }

  log.success(`Complete in ${duration}s`);
  if (deployment) {
    log.info('Preview deployed', { url: deployment.url });
  }

  return result;
}

export default { rebuildAndDeploy };
