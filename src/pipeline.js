// src/pipeline.js
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { scrapeSiteLite as scrapeSite } from './scraperLite.js';
import TemplateBuilder from './templateBuilder.js';
import AIPolisher from './aiPolish.js';
import { AIContentGenerator } from './aiContentGenerator.js';
import { saveDeployment, createPreview } from './db.js';
import logger from './logger.js';
import { extractCity, generatePreviewSlug } from './utils.js';
import { getFeatures, CONFIG } from './config.js';
import { ImageService, selectHeroImage } from './imageService.js';
import { validatePreview } from './previewValidator.js';
import { assessContentQuality } from './contentValidator.js';
import { captureException, addBreadcrumb } from './sentry.js';
import { RETRY_POLICIES } from './utils/retry.js';
import { CIRCUIT_BREAKERS } from './utils/circuitBreaker.js';
import { scrapeCache } from './cache/scrapeCache.js';

const log = logger.child('pipeline');

// Checkpointing constants
const CHECKPOINT_DIR = '.cache/checkpoints';
const CHECKPOINT_TTL_MS = 3600000; // 1 hour

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

// --- Checkpoint helpers ---

/**
 * Generate a deterministic job ID from a URL
 */
function getJobId(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/**
 * Save pipeline state after a completed step
 */
async function saveCheckpoint(jobId, step, data) {
  try {
    const dir = path.join(CHECKPOINT_DIR, jobId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `${step}.json`),
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch (error) {
    log.warn('Failed to save checkpoint', { jobId, step, error: error.message });
  }
}

/**
 * Load a checkpoint if it exists and hasn't expired
 */
async function loadCheckpoint(jobId, step) {
  try {
    const filePath = path.join(CHECKPOINT_DIR, jobId, `${step}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CHECKPOINT_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Remove all checkpoints for a job after successful completion
 */
async function clearCheckpoint(jobId) {
  try {
    await fs.rm(path.join(CHECKPOINT_DIR, jobId), { recursive: true });
  } catch {
    // Directory didn't exist - fine
  }
}

export async function rebuildAndDeploy(targetUrl, options = {}) {
  const startTime = Date.now();
  const features = getFeatures();
  const jobId = getJobId(targetUrl);

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

  // 1. Scrape (with cache + retry + circuit breaker)
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

  // Check checkpoint first
  const cachedSiteData = await loadCheckpoint(jobId, 'scrape');
  if (cachedSiteData) {
    log.info('Resuming from scrape checkpoint', { url: targetUrl });
    siteData = cachedSiteData;
  } else {
    // Check scrape cache (avoids re-scraping same URL within 24h)
    const scraped = await scrapeCache.get(targetUrl);
    if (scraped) {
      log.info('Using cached scrape data', { url: targetUrl });
      siteData = scraped;
    } else {
      try {
        // Wrap with retry + circuit breaker + timeout
        siteData = await RETRY_POLICIES.scraper.execute(
          () => CIRCUIT_BREAKERS.firecrawl.execute(
            () => Promise.race([
              scrapeSite(targetUrl),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Scraping timed out after ${SCRAPE_TIMEOUT_MS / 1000}s`)),
                  SCRAPE_TIMEOUT_MS
                )
              )
            ])
          ),
          {
            context: 'scrape',
            onRetry: (error, attempt, delay) => {
              log.warn(`Scrape retry ${attempt}`, { url: targetUrl, error: error.message, delay: Math.round(delay) });
              tracker.scrapeFallback?.({ attempt });
            }
          }
        );
        // Cache successful scrape
        await scrapeCache.set(targetUrl, siteData);
      } catch (error) {
        tracker.error(error, 'scrape');
        throw createPipelineError(`Failed to scrape site: ${error.message}`, 'scrape', error, { url: targetUrl });
      }
    }
  }

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

  // Save scrape checkpoint
  await saveCheckpoint(jobId, 'scrape', siteData);

  // 2. Hero image + industry detection (parallel where possible)
  log.info('Step 2: Selecting hero image + detecting industry...');
  tracker.analyzing({ label: 'Selecting images...' });

  // Initialize builder once, reuse for steps 2, 3, and 5
  let builder = new TemplateBuilder(options.templatesDir);
  await builder.init();

  // Check checkpoint for hero step
  const cachedHeroData = await loadCheckpoint(jobId, 'hero');
  if (cachedHeroData) {
    log.info('Resuming from hero checkpoint');
    siteData.industry = cachedHeroData.industry;
    if (cachedHeroData.heroImage) {
      if (!siteData.images) siteData.images = [];
      siteData.images.unshift(cachedHeroData.heroImage);
      if (cachedHeroData.heroAttribution) {
        siteData.heroAttribution = cachedHeroData.heroAttribution;
      }
    }
  } else {
    try {
      const imageService = new ImageService();

      // Industry detection is synchronous, hero image is async
      // Run industry detection first (needed for stock photo query), then hero image
      const detectedIndustry = builder.detectIndustry(siteData);
      siteData.industry = detectedIndustry;

      // Wrap image service call with retry + circuit breaker
      const heroImage = await RETRY_POLICIES.image.execute(
        () => CIRCUIT_BREAKERS.imageApi.execute(
          () => selectHeroImage(siteData, imageService)
        ),
        {
          context: 'heroImage',
          onRetry: (error, attempt) => {
            log.warn(`Hero image retry ${attempt}`, { error: error.message });
          }
        }
      );

      if (heroImage) {
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

    // Save hero step checkpoint (includes industry + image data)
    await saveCheckpoint(jobId, 'hero', {
      industry: siteData.industry,
      heroImage: siteData.images?.[0] || null,
      heroAttribution: siteData.heroAttribution || null
    });
  }

  // 3. Build template
  log.info('Step 3: Building template...');
  tracker.building({ label: 'Building template...' });

  let slots, industry;

  // Check checkpoint for build step
  const cachedBuildData = await loadCheckpoint(jobId, 'build');
  if (cachedBuildData) {
    log.info('Resuming from build checkpoint');
    slots = cachedBuildData.slots;
    industry = cachedBuildData.industry;
    siteData.industry = industry;
  } else {
    try {
      const buildResult = await builder.build(siteData);
      slots = buildResult.slots;
      industry = buildResult.industry;
      siteData.industry = industry;
      log.info('Template built', { industry });

      // Save build checkpoint
      await saveCheckpoint(jobId, 'build', { slots, industry });
    } catch (error) {
      tracker.error(error, 'build');
      throw createPipelineError(`Failed to build template: ${error.message}`, 'build', error, { url: targetUrl });
    }
  }

  // 4. AI Content Generation (optional - graceful degradation)
  let polishedSlots = slots;
  let aiGeneratedContent = null;
  const shouldGenerate = !options.skipPolish && features.aiPolish;

  // Check checkpoint for AI generation
  const cachedAiData = await loadCheckpoint(jobId, 'ai');
  if (cachedAiData) {
    log.info('Resuming from AI checkpoint');
    polishedSlots = cachedAiData.polishedSlots;
    aiGeneratedContent = cachedAiData.aiGeneratedContent;
  } else if (shouldGenerate) {
    log.info('Step 4: Generating content with AI...');
    tracker.generating({ label: 'Creating professional content...' });

    try {
      // Wrap AI call with retry + circuit breaker
      const generator = new AIContentGenerator();
      aiGeneratedContent = await RETRY_POLICIES.ai.execute(
        () => CIRCUIT_BREAKERS.anthropic.execute(
          () => generator.generateAllContent(siteData, industry)
        ),
        {
          context: 'aiContent',
          onRetry: (error, attempt) => {
            log.warn(`AI content generation retry ${attempt}`, { error: error.message });
          }
        }
      );

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

    // Save AI checkpoint
    await saveCheckpoint(jobId, 'ai', { polishedSlots, aiGeneratedContent });
  } else if (!options.skipPolish && !features.aiPolish) {
    log.info('Step 4: AI skipped - ANTHROPIC_API_KEY not configured');
  } else {
    log.info('Step 4: AI skipped by request');
  }

  // 4b. Validate Quality and Retry if Needed
  log.info('Step 4b: Validating content quality...');
  tracker.generating({ label: 'Validating quality...' });

  const qualityContext = {
    businessName: siteData.businessName,
    city: extractCity(siteData.address) || siteData.city,
    trustSignals: siteData.trustSignals
  };

  const qualityThreshold = (typeof CONFIG.ai?.qualityThreshold === 'object')
    ? (CONFIG.ai.qualityThreshold[industry] || CONFIG.ai.qualityThreshold.default || 78)
    : (CONFIG.ai?.qualityThreshold || 78);
  const maxQualityRetries = 2;
  let qualityRetryCount = 0;
  let bestQualitySlots = polishedSlots;
  let bestQualityScore = 0;

  while (qualityRetryCount <= maxQualityRetries) {
    // Assess quality
    const qualityAssessment = assessContentQuality(
      {
        headline: polishedSlots.headline,
        subheadline: polishedSlots.subheadline,
        ctaPrimary: polishedSlots.cta_text,
        aboutSnippet: polishedSlots.about_text
      },
      qualityContext,
      industry
    );

    bestQualityScore = qualityAssessment.overallScore;

    log.info('Content quality assessment', {
      score: qualityAssessment.overallScore,
      grade: qualityAssessment.grade,
      isPublishReady: qualityAssessment.isPublishReady,
      issues: qualityAssessment.issues.length,
      attempt: qualityRetryCount + 1
    });

    // Check if quality meets threshold
    if (qualityAssessment.overallScore >= qualityThreshold || !shouldGenerate) {
      log.info('Content quality meets threshold', {
        score: qualityAssessment.overallScore,
        threshold: qualityThreshold
      });
      break;
    }

    // If quality is below threshold and we have retries left, regenerate
    if (qualityRetryCount < maxQualityRetries && shouldGenerate) {
      log.warn('Content quality below threshold, regenerating', {
        score: qualityAssessment.overallScore,
        threshold: qualityThreshold,
        attempt: qualityRetryCount + 1
      });

      // Build specific feedback
      const specificFeedback = buildQualityFeedback(qualityAssessment);

      tracker.generating({ label: `Improving content (attempt ${qualityRetryCount + 2})...` });

      try {
        // Regenerate content with specific feedback
        const generator = new AIContentGenerator();
        const improvedContent = await RETRY_POLICIES.ai.execute(
          () => CIRCUIT_BREAKERS.anthropic.execute(
            () => generator.generateAllContent(siteData, industry, 0) // No internal retries, we're handling it here
          ),
          {
            context: 'aiContentRetry',
            onRetry: (error, attempt) => {
              log.warn(`AI content retry ${attempt}`, { error: error.message });
            }
          }
        );

        // Merge improved content
        polishedSlots = {
          ...slots,
          headline: improvedContent.headline || polishedSlots.headline,
          subheadline: improvedContent.subheadline || polishedSlots.subheadline,
          services: improvedContent.services?.length > 0 ? improvedContent.services : polishedSlots.services,
          why_us_points: improvedContent.whyUs || polishedSlots.why_us_points,
          section_testimonials: improvedContent.testimonialIntro || polishedSlots.section_testimonials,
          cta_text: improvedContent.ctaPrimary || polishedSlots.cta_text,
          cta_secondary: improvedContent.ctaSecondary || polishedSlots.cta_secondary,
          about_text: improvedContent.aboutSnippet || polishedSlots.about_text,
          meta_description: improvedContent.metaDescription || polishedSlots.meta_description,
          phone: siteData.phone || polishedSlots.phone,
          email: siteData.email || polishedSlots.email,
          address: siteData.address || polishedSlots.address,
          businessName: siteData.businessName || polishedSlots.businessName,
          hours: siteData.hours || polishedSlots.hours
        };

        qualityRetryCount++;
      } catch (error) {
        log.warn('Failed to regenerate content for quality', { error: error.message });
        break; // Exit retry loop
      }
    } else {
      break; // No more retries or AI not enabled
    }
  }

  // Track best result
  if (bestQualityScore > 0) {
    bestQualitySlots = polishedSlots;
  }

  // 4c. CRO Optimization (refine generated content for conversions)
  const shouldOptimize = !options.skipOptimize && features.aiPolish && aiGeneratedContent;

  if (shouldOptimize) {
    log.info('Step 4c: Optimizing content for conversions...');
    tracker.generating({ label: 'Optimizing for conversions...' });

    try {
      const { ContentOptimizer } = await import('./contentOptimizer.js');
      const optimizer = new ContentOptimizer();

      // Wrap CRO optimization with retry + circuit breaker (uses Anthropic API)
      const optimizeResult = await RETRY_POLICIES.ai.execute(
        () => CIRCUIT_BREAKERS.anthropic.execute(
          () => optimizer.optimizeContent(polishedSlots, siteData, industry)
        ),
        {
          context: 'croOptimize',
          onRetry: (error, attempt) => {
            log.warn(`CRO optimization retry ${attempt}`, { error: error.message });
          }
        }
      );

      if (optimizeResult.improved) {
        polishedSlots = optimizeResult.slots;
        log.info('Content optimized', {
          beforeScore: optimizeResult.beforeScore,
          afterScore: optimizeResult.afterScore,
          improvement: optimizeResult.afterScore - optimizeResult.beforeScore
        });
      } else {
        log.info('Optimization skipped - no improvement', {
          beforeScore: optimizeResult.beforeScore,
          afterScore: optimizeResult.afterScore
        });
      }
    } catch (error) {
      log.warn('CRO optimization failed, using unmodified content', { error: error.message });
    }
  }

  // Helper function to build specific quality feedback
  function buildQualityFeedback(assessment) {
    const issues = [];

    if (assessment.checks.cliches?.found?.length) {
      issues.push(`Remove these clichés: "${assessment.checks.cliches.found.join('", "')}"`);
    }
    if (assessment.checks.headline?.issues?.length) {
      assessment.checks.headline.issues.forEach(i => issues.push(`Headline: ${i.text || i.suggestion || ''}`));
    }
    if (assessment.checks.cta?.score < 60) {
      issues.push('CTA needs urgency word (today, now, free, instant) and specific benefit');
    }
    if (assessment.checks.temperature?.label === 'hot') {
      issues.push('Too salesy — replace superlatives with specific facts and numbers');
    }
    if (assessment.checks.temperature?.label === 'cold' || assessment.checks.temperature?.label === 'cool') {
      issues.push('Too generic — add specific numbers, credentials, or location details');
    }

    return issues.join('\n');
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

  // 6. Final validation for structural issues
  log.info('Step 6: Final structural validation...');
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

  // Clear checkpoints on successful completion
  await clearCheckpoint(jobId);

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
