// src/screenshot.js
import { chromium } from 'playwright';
import sharp from 'sharp';
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('screenshot');

/**
 * Capture a screenshot of a webpage
 */
export async function captureScreenshot(url, options = {}) {
  const {
    width = 1280,
    height = 800,
    fullPage = false,
    quality = 80
  } = options;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width, height });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: CONFIG.timeouts.pageLoad
    });

    // Wait for content to settle
    await page.waitForTimeout(1500);

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage
    });

    await browser.close();

    log.debug('Screenshot captured', { url, width, height });
    return screenshot;

  } catch (error) {
    await browser.close();
    log.error('Screenshot failed', { url, error: error.message });
    throw error;
  }
}

/**
 * Capture before/after screenshots and create a comparison image
 */
export async function captureBeforeAfter(originalUrl, previewUrl, options = {}) {
  const {
    width = 600,
    height = 450
  } = options;

  log.info('Capturing before/after screenshots', { originalUrl, previewUrl });

  // Capture both screenshots in parallel
  const [beforeBuffer, afterBuffer] = await Promise.all([
    captureScreenshot(originalUrl, { width, height }).catch(err => {
      log.warn('Failed to capture original site', { error: err.message });
      return null;
    }),
    captureScreenshot(previewUrl, { width, height }).catch(err => {
      log.warn('Failed to capture preview site', { error: err.message });
      return null;
    })
  ]);

  // If we got both, create comparison image
  let comparisonBuffer = null;
  if (beforeBuffer && afterBuffer) {
    comparisonBuffer = await createComparisonImage(beforeBuffer, afterBuffer, { width, height });
  }

  return {
    before: beforeBuffer,
    after: afterBuffer,
    comparison: comparisonBuffer,
    beforeBase64: beforeBuffer ? `data:image/png;base64,${beforeBuffer.toString('base64')}` : null,
    afterBase64: afterBuffer ? `data:image/png;base64,${afterBuffer.toString('base64')}` : null,
    comparisonBase64: comparisonBuffer ? `data:image/png;base64,${comparisonBuffer.toString('base64')}` : null
  };
}

/**
 * Create a side-by-side comparison image
 */
async function createComparisonImage(beforeBuffer, afterBuffer, { width, height }) {
  const gap = 20;
  const labelHeight = 30;
  const totalWidth = (width * 2) + gap;
  const totalHeight = height + labelHeight;

  // Process images with sharp
  const beforeResized = await sharp(beforeBuffer)
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();

  const afterResized = await sharp(afterBuffer)
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();

  // Create the comparison canvas
  const comparison = await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      // Before image
      { input: beforeResized, left: 0, top: labelHeight },
      // After image
      { input: afterResized, left: width + gap, top: labelHeight },
      // Before label
      {
        input: createLabel('BEFORE', width, labelHeight, '#6b7280'),
        left: 0,
        top: 0
      },
      // After label
      {
        input: createLabel('AFTER', width, labelHeight, '#2563eb'),
        left: width + gap,
        top: 0
      }
    ])
    .png()
    .toBuffer();

  log.debug('Created comparison image', { width: totalWidth, height: totalHeight });
  return comparison;
}

/**
 * Create a simple text label using SVG
 */
function createLabel(text, width, height, color) {
  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="white"/>
      <text
        x="${width / 2}"
        y="${height / 2 + 5}"
        font-family="Arial, sans-serif"
        font-size="14"
        font-weight="bold"
        fill="${color}"
        text-anchor="middle"
      >${text}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Capture a single screenshot and return as base64
 */
export async function captureAsBase64(url, options = {}) {
  const buffer = await captureScreenshot(url, options);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export default {
  captureScreenshot,
  captureBeforeAfter,
  captureAsBase64
};
