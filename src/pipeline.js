// src/pipeline.js
import { scrapeSiteLite as scrapeSite } from './scraperLite.js';
import TemplateBuilder from './templateBuilder.js';
import AIPolisher from './aiPolish.js';
import { AIContentGenerator } from './aiContentGenerator.js';
import { saveDeployment, createPreview } from './db.js';
import logger from './logger.js';
import { extractCity, generatePreviewSlug } from './utils.js';
import { getFeatures } from './config.js';
import { ImageService, selectHeroImage } from './imageService.js';
import { validatePreview } from './previewValidator.js';
import { captureException, addBreadcrumb } from './sentry.js';

const log = logger.child('pipeline');

/**
 * Create an error with step information for tracking
 * Also captures the error to Sentry with context
 */
function createPipelineError(message, step, cause = null, context = {}) {
  const error = new Error(message);
  error.step = step;
  if (cause) {
    error.cause = cause;
    error.stack = `${error.stack}\nCaused by: ${cause.stack}`;
  }

  // Capture to Sentry with pipeline context
  captureException(error, {
    tags: {
      component: 'pipeline',
      step
    },
    extra: {
      url: context.url,
      industry: context.industry,
      cause: cause?.message
    }
  });

  return error;
}

export async function rebuildAndDeploy(targetUrl, options = {}) {
  const startTime = Date.now();
  const features = getFeatures();

  // Get status tracker from options (if provided by server)
  const tracker = options.tracker || {
    queued: () => {},
    scraping: () => {},
    scrapeFallback: () => {},
    analyzing: () => {},
    generating: () => {},
    building: () => {},
    deploying: () => {},
    complete: () => {},
    error: () => {}
  };

  // 1. Scrape (with timeout protection)
  log.info('Step 1: Scraping site...');
  tracker.scraping({ url: targetUrl });

  addBreadcrumb({
    message: 'Pipeline started',
    category: 'pipeline',
    level: 'info',
    data: { url: targetUrl }
  });

  const SCRAPE_TIMEOUT_MS = 30000; // 30 second timeout
  let siteData;
  try {
    siteData = await Promise.race([
      scrapeSite(targetUrl),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Scraping timed out after ${SCRAPE_TIMEOUT_MS / 1000}s`)),
          SCRAPE_TIMEOUT_MS
        )
      )
    ]);
    log.info('Site data extracted', {
      business: siteData.businessName || 'Unknown',
      phone: siteData.phone || 'Not found',
      email: siteData.email || 'Not found'
    });
    addBreadcrumb({
      message: 'Scrape complete',
      category: 'pipeline',
      level: 'info',
      data: { businessName: siteData.businessName }
    });
  } catch (error) {
    tracker.error(error, 'scrape');
    throw createPipelineError(`Failed to scrape site: ${error.message}`, 'scrape', error, { url: targetUrl });
  }

  // 2. Enhance images (select hero from scraped or stock photos)
  log.info('Step 2: Selecting hero image...');
  tracker.analyzing({ label: 'Selecting images...' });

  try {
    const imageService = new ImageService();
    // Detect industry first for stock photo selection
    const builder = new TemplateBuilder(options.templatesDir);
    await builder.init();
    const detectedIndustry = builder.detectIndustry(siteData);
    siteData.industry = detectedIndustry;

    const heroImage = await selectHeroImage(siteData, imageService);
    if (heroImage) {
      // Inject hero image into site data for template
      if (!siteData.images) siteData.images = [];
      siteData.images.unshift({
        src: heroImage.url,
        alt: heroImage.alt,
        source: heroImage.source
      });
      if (heroImage.attribution) {
        siteData.heroAttribution = heroImage.attribution;
      }
      log.info('Hero image selected', { source: heroImage.source });
    } else {
      log.debug('No hero image available, template will use gradient');
    }
  } catch (error) {
    log.warn('Image enhancement failed, continuing', { error: error.message });
  }

  // 3. Build template
  log.info('Step 3: Building template...');
  tracker.building({ label: 'Building template...' });

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
    tracker.error(error, 'build');
    throw createPipelineError(`Failed to build template: ${error.message}`, 'build', error, { url: targetUrl });
  }

  // 4. AI Content Generation (optional - graceful degradation)
  // NEW: Generate ALL content with AI, not just polish
  let polishedSlots = slots;
  let aiGeneratedContent = null;
  const shouldGenerate = !options.skipPolish && features.aiPolish;

  if (shouldGenerate) {
    log.info('Step 4: Generating content with AI...');
    tracker.generating({ label: 'Creating professional content...' });

    try {
      // Use new AI-first content generator
      const generator = new AIContentGenerator();
      aiGeneratedContent = await generator.generateAllContent(siteData, industry);

      log.info('AI content generated', {
        headline: aiGeneratedContent.headline?.substring(0, 50),
        services: aiGeneratedContent.services?.length || 0,
        whyUs: aiGeneratedContent.whyUs?.length || 0
      });

      // Merge AI-generated content with scraped slots
      // Map AI output fields to template slot names
      polishedSlots = {
        ...slots,
        // Hero section
        headline: aiGeneratedContent.headline || slots.headline,
        subheadline: aiGeneratedContent.subheadline || slots.subheadline,

        // Services (array with name, description, icon)
        services: aiGeneratedContent.services?.length > 0
          ? aiGeneratedContent.services
          : slots.services,

        // Why Us section - template expects 'why_us_points' array
        why_us_points: aiGeneratedContent.whyUs || [],

        // Testimonials section header
        section_testimonials: aiGeneratedContent.testimonialIntro || 'What Our Customers Say',

        // CTA buttons
        cta_text: aiGeneratedContent.ctaPrimary || slots.cta_text || 'Get Started',
        cta_secondary: aiGeneratedContent.ctaSecondary || 'Learn More',

        // About snippet
        about_text: aiGeneratedContent.aboutSnippet || slots.about_text || '',

        // SEO
        meta_description: aiGeneratedContent.metaDescription || slots.meta_description || ''
      };

      // Keep real contact info from scraped data (never fake these)
      polishedSlots.phone = siteData.phone || slots.phone;
      polishedSlots.email = siteData.email || slots.email;
      polishedSlots.address = siteData.address || slots.address;
      polishedSlots.businessName = siteData.businessName || slots.businessName;
      polishedSlots.hours = siteData.hours || slots.hours;

    } catch (error) {
      log.warn('AI content generation failed, using scraped content', { error: error.message });
      // Fall back to legacy polish if new generator fails
      try {
        const polisher = new AIPolisher();
        polishedSlots = await polisher.polishAll(slots, siteData);
      } catch (polishError) {
        log.warn('Legacy AI polish also failed', { error: polishError.message });
      }
    }
  } else if (!options.skipPolish && !features.aiPolish) {
    log.info('Step 4: AI skipped - ANTHROPIC_API_KEY not configured');
  } else {
    log.info('Step 4: AI skipped by request');
  }

  // 5. Generate final HTML
  log.info('Step 5: Generating HTML...');
  tracker.building({ label: 'Generating final HTML...', progress: 75 });

  let finalHtml;
  try {
    finalHtml = await builder.buildWithSlots(siteData, polishedSlots);
  } catch (error) {
    tracker.error(error, 'generate');
    throw createPipelineError(`Failed to generate HTML: ${error.message}`, 'generate', error, { url: targetUrl, industry });
  }

  // 6. Validate preview quality
  log.info('Step 6: Validating preview quality...');
  tracker.building({ label: 'Checking quality...', progress: 85 });

  const validation = validatePreview(siteData, polishedSlots, industry);

  if (!validation.isValid) {
    log.warn('Preview validation failed', {
      issues: validation.issues.map(i => i.type),
      qualityScore: validation.qualityScore
    });
  } else if (validation.warnings.length > 0) {
    log.info('Preview validation passed with warnings', {
      warnings: validation.warnings.map(w => w.type),
      qualityScore: validation.qualityScore
    });
  } else {
    log.info('Preview validation passed', { qualityScore: validation.qualityScore });
  }

  // 7. Save preview to database (self-hosted, no external Netlify deployment)
  log.info('Step 7: Saving preview to database...');
  tracker.deploying({ label: 'Saving preview...' });

  const slug = generatePreviewSlug(siteData.businessName || 'preview');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  let preview = null;
  try {
    preview = await createPreview({
      slug,
      originalUrl: targetUrl,
      businessName: siteData.businessName,
      industry,
      html: finalHtml,
      siteData,
      slots: polishedSlots,
      status: validation.isValid ? 'complete' : 'review_needed',
      validation,
      expiresAt
    });
    log.info('Preview saved to database', {
      slug,
      id: preview.id,
      status: preview.status,
      qualityScore: validation.qualityScore
    });
  } catch (error) {
    log.error('Failed to save preview', { error: error.message, slug });
    tracker.error(error, 'save');
    throw createPipelineError(`Failed to save preview: ${error.message}`, 'save', error, { url: targetUrl, industry });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const result = {
    original: targetUrl,
    html: finalHtml,
    siteData,
    industry,
    slots: polishedSlots,
    duration,
    // New self-hosted preview URL
    preview: `/preview/${slug}`,
    slug,
    previewId: preview.id,
    expiresAt: expiresAt.toISOString(),
    // Validation results
    validation,
    status: validation.isValid ? 'complete' : 'review_needed'
  };

  // Also save to deployments table for backwards compatibility
  const city = extractCity(siteData.address);
  try {
    await saveDeployment({
      siteId: preview.id,
      siteName: slug,
      original: targetUrl,
      preview: `/preview/${slug}`,
      businessName: siteData.businessName,
      industry,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      city
    });
  } catch (saveError) {
    log.warn('Failed to save to deployments table', { error: saveError.message });
  }

  log.success(`Complete in ${duration}s`);
  log.info('Preview available at', { url: `/preview/${slug}` });

  return result;
}

export default { rebuildAndDeploy };
