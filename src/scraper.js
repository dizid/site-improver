// src/scraper.js
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('scraper');

export async function scrapeSite(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    log.debug('Starting scrape', { url });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: CONFIG.timeouts.pageLoad
    });

    // Wait for dynamic content
    await page.waitForTimeout(CONFIG.timeouts.scrapeWait);

    const html = await page.content();
    const $ = cheerio.load(html);

    // Extract colors from page
    const colors = await extractColors(page);

    const data = {
      url,
      scrapedAt: new Date().toISOString(),
      ...extractIdentity($, url),
      ...extractContent($),
      ...extractContact($, html),
      ...extractMedia($, url),
      ...extractMeta($),
      colors
    };

    await browser.close();
    log.debug('Scrape complete', { url, businessName: data.businessName });
    return data;

  } catch (error) {
    await browser.close();
    log.error('Scrape failed', { url, error: error.message });
    throw error;
  }
}

function extractIdentity($, baseUrl) {
  // Logo - check common patterns
  const logoSelectors = [
    'header img[src*="logo"]',
    '.logo img',
    'a.brand img',
    'img[alt*="logo" i]',
    'header a:first-child img',
    '[class*="logo"] img',
    'img[class*="logo"]'
  ];

  let logo = null;
  for (const sel of logoSelectors) {
    const el = $(sel).first();
    if (el.length) {
      logo = el.attr('src') || el.attr('data-src') || null;
      if (logo && logo.startsWith('/')) {
        logo = new URL(logo, baseUrl).href;
      }
      break;
    }
  }

  // Business name - try multiple sources
  const businessName =
    $('meta[property="og:site_name"]').attr('content') ||
    $('title').text().split('|')[0].split('-')[0].split('–')[0].trim() ||
    $('.logo').text().trim() ||
    $('[class*="brand"]').first().text().trim() ||
    null;

  // Favicon
  const favicon =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    '/favicon.ico';

  return { logo, businessName, favicon };
}

function extractContent($) {
  const headlines = [];
  const paragraphs = [];

  // Extract headlines
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 3 && text.length < 200 && !headlines.includes(text)) {
      headlines.push(text);
    }
  });

  // Extract paragraphs
  $('p').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 50 && text.length < 1000) {
      paragraphs.push(text);
    }
  });

  // Services - look for lists in services sections
  const services = [];
  $('section, div, [class*="service"]').each((_, section) => {
    const heading = $(section).find('h2, h3').first().text().toLowerCase();
    if (heading.includes('service') || heading.includes('what we') || heading.includes('our ')) {
      $(section).find('li, h4, [class*="service-item"], [class*="card"] h3, [class*="card"] h4').each((_, item) => {
        const text = $(item).text().trim().replace(/\s+/g, ' ');
        if (text.length > 2 && text.length < 100 && !services.includes(text)) {
          services.push(text);
        }
      });
    }
  });

  // Testimonials
  const testimonials = [];
  $('[class*="testimonial"], [class*="review"], blockquote').each((_, el) => {
    const text = $(el).find('p, [class*="text"], [class*="content"]').first().text().trim();
    const author = $(el).find('[class*="author"], [class*="name"], cite').first().text().trim();
    if (text.length > 20 && text.length < 500) {
      testimonials.push({ text, author: author || 'Customer' });
    }
  });

  return {
    headlines: headlines.slice(0, CONFIG.limits.headlines),
    paragraphs: paragraphs.slice(0, CONFIG.limits.paragraphs),
    services: services.slice(0, CONFIG.limits.services),
    testimonials: testimonials.slice(0, CONFIG.limits.testimonials)
  };
}

function extractContact($, html) {
  // Phone - regex patterns
  const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = html.match(phoneRegex) || [];

  // Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = (html.match(emailRegex) || [])
    .filter(e => !e.includes('example') && !e.includes('email@') && !e.includes('wixpress'));

  // Address - look for common containers
  let address = null;
  $('[class*="address"], [class*="location"], address, [itemtype*="PostalAddress"]').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 10 && text.length < 200 && !address) {
      address = text;
    }
  });

  // Social links
  const socialLinks = [];
  $('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="youtube.com"], a[href*="x.com"]')
    .each((_, el) => {
      const href = $(el).attr('href');
      if (href && !socialLinks.includes(href)) {
        socialLinks.push(href);
      }
    });

  // Business hours
  let hours = null;
  $('[class*="hour"], [class*="schedule"], [class*="time"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 300 && text.match(/\d/)) {
      hours = text.replace(/\s+/g, ' ');
    }
  });

  return {
    phone: phones[0] || null,
    email: emails[0] || null,
    address,
    socialLinks: [...new Set(socialLinks)],
    hours
  };
}

function extractMedia($, baseUrl) {
  const images = [];

  $('img').each((_, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (!src) return;

    // Make absolute
    if (src.startsWith('/')) {
      src = new URL(src, baseUrl).href;
    } else if (!src.startsWith('http')) {
      src = new URL(src, baseUrl).href;
    }

    // Skip tiny images, icons, tracking pixels
    const width = parseInt($(el).attr('width')) || 999;
    const height = parseInt($(el).attr('height')) || 999;
    if (width < 50 || height < 50) return;
    if (src.includes('pixel') || src.includes('tracking') || src.includes('data:image')) return;
    if (src.includes('.svg') || src.includes('icon')) return;

    const alt = $(el).attr('alt') || '';
    const context = $(el).closest('section').find('h2, h3').first().text().trim();

    images.push({ src, alt, context });
  });

  return { images: images.slice(0, CONFIG.limits.images) };
}

function extractMeta($) {
  return {
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') || 
                 $('meta[property="og:description"]').attr('content') || 
                 null,
    ogImage: $('meta[property="og:image"]').attr('content') || null
  };
}

async function extractColors(page) {
  // Extract colors from computed styles
  const colors = await page.evaluate(() => {
    const colorSet = new Set();
    const elements = document.querySelectorAll('*');

    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bgColor = style.backgroundColor;
      const color = style.color;

      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        colorSet.add(bgColor);
      }
      if (color) {
        colorSet.add(color);
      }
    });

    return Array.from(colorSet).slice(0, 10);
  });

  // Convert to hex
  const hexColors = colors.map(c => {
    const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const [, r, g, b] = match;
      return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
    return c;
  }).filter(c => c.startsWith('#') && c !== '#000000' && c !== '#ffffff');

  return [...new Set(hexColors)].slice(0, CONFIG.limits.colors);
}

export default { scrapeSite };
