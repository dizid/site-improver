// src/pipeline.js
import { scrapeSiteLite as scrapeSite } from './scraperLite.js';
import TemplateBuilder from './templateBuilder.js';
import AIPolisher from './aiPolish.js';
import NetlifyDeployer from './netlifyDeploy.js';
import { saveDeployment } from './db.js';
import logger from './logger.js';
import { extractCity } from './utils.js';

const log = logger.child('pipeline');

export async function rebuildAndDeploy(targetUrl, options = {}) {
  const startTime = Date.now();

  // 1. Scrape
  log.info('Scraping site...');
  const siteData = await scrapeSite(targetUrl);
  log.info('Site data extracted', {
    business: siteData.businessName || 'Unknown',
    phone: siteData.phone || 'Not found',
    email: siteData.email || 'Not found'
  });

  // 2. Build template
  log.info('Building template...');
  const builder = new TemplateBuilder(options.templatesDir);
  await builder.init();
  const { slots, industry, needsAiPolish } = await builder.build(siteData);
  siteData.industry = industry;
  log.info('Template built', { industry });

  // 3. AI Polish (optional)
  let polishedSlots = slots;
  if (!options.skipPolish) {
    log.info('Polishing copy with AI...');
    const polisher = new AIPolisher();
    polishedSlots = await polisher.polishAll(slots, siteData);
  }

  // 4. Generate final HTML
  log.info('Generating HTML...');
  const finalHtml = await builder.buildWithSlots(siteData, polishedSlots);

  // 5. Deploy to Netlify (optional)
  let deployment = null;
  if (!options.skipDeploy && process.env.NETLIFY_AUTH_TOKEN) {
    log.info('Deploying to Netlify...');
    const deployer = new NetlifyDeployer(process.env.NETLIFY_AUTH_TOKEN);
    deployment = await deployer.deploy(finalHtml, siteData.businessName || 'preview');
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
