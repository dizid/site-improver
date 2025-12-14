// src/scraperLite.js
// Serverless scraper using Firecrawl API

import * as cheerio from 'cheerio';
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('scraper-firecrawl');

export async function scrapeSiteLite(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not set');
  }

  try {
    log.debug('Starting Firecrawl scrape', { url });

    // Call Firecrawl API
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'markdown'],
        onlyMainContent: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Firecrawl error: ${response.status} - ${err}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Firecrawl scrape failed');
    }

    const html = result.data?.html || '';
    const $ = cheerio.load(html);

    // Extract colors from inline styles and CSS
    const colors = extractColorsFromCSS($, html);

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

    log.debug('Lite scrape complete', { url, businessName: data.businessName });
    return data;

  } catch (error) {
    log.error('Lite scrape failed', { url, error: error.message });
    throw error;
  }
}

function extractIdentity($, baseUrl) {
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

  const businessName =
    $('meta[property="og:site_name"]').attr('content') ||
    $('title').text().split('|')[0].split('-')[0].split('–')[0].trim() ||
    $('.logo').text().trim() ||
    $('[class*="brand"]').first().text().trim() ||
    null;

  const favicon =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    '/favicon.ico';

  return { logo, businessName, favicon };
}

function extractContent($) {
  const headlines = [];
  const paragraphs = [];

  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 3 && text.length < 200 && !headlines.includes(text)) {
      headlines.push(text);
    }
  });

  $('p').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 50 && text.length < 1000) {
      paragraphs.push(text);
    }
  });

  const services = [];
  $('section, div, [class*="service"]').each((_, section) => {
    const heading = $(section).find('h2, h3').first().text().toLowerCase();
    if (heading.includes('service') || heading.includes('what we') || heading.includes('our ')) {
      $(section).find('li, h4, [class*="service-item"], [class*="card"] h3').each((_, item) => {
        const text = $(item).text().trim().replace(/\s+/g, ' ');
        if (text.length > 2 && text.length < 100 && !services.includes(text)) {
          services.push(text);
        }
      });
    }
  });

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
  const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = html.match(phoneRegex) || [];

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = (html.match(emailRegex) || [])
    .filter(e => !e.includes('example') && !e.includes('email@') && !e.includes('wixpress'));

  let address = null;
  $('[class*="address"], [class*="location"], address').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 10 && text.length < 200 && !address) {
      address = text;
    }
  });

  const socialLinks = [];
  $('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="youtube.com"]')
    .each((_, el) => {
      const href = $(el).attr('href');
      if (href && !socialLinks.includes(href)) {
        socialLinks.push(href);
      }
    });

  let hours = null;
  $('[class*="hour"], [class*="schedule"]').each((_, el) => {
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
    let src = $(el).attr('src') || $(el).attr('data-src');
    if (!src) return;

    if (src.startsWith('/')) {
      src = new URL(src, baseUrl).href;
    } else if (!src.startsWith('http')) {
      try { src = new URL(src, baseUrl).href; } catch { return; }
    }

    const width = parseInt($(el).attr('width')) || 999;
    const height = parseInt($(el).attr('height')) || 999;
    if (width < 50 || height < 50) return;
    if (src.includes('pixel') || src.includes('data:image') || src.includes('.svg')) return;

    images.push({ src, alt: $(el).attr('alt') || '', context: '' });
  });

  return { images: images.slice(0, CONFIG.limits.images) };
}

function extractMeta($) {
  return {
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') ||
                 $('meta[property="og:description"]').attr('content') || null,
    ogImage: $('meta[property="og:image"]').attr('content') || null
  };
}

function extractColorsFromCSS($, html) {
  const colors = new Set();
  const hexRegex = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
  const rgbRegex = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/g;

  // From inline styles
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const hexMatches = style.match(hexRegex) || [];
    hexMatches.forEach(c => colors.add(c.toLowerCase()));
  });

  // From style tags
  $('style').each((_, el) => {
    const css = $(el).html() || '';
    const hexMatches = css.match(hexRegex) || [];
    hexMatches.forEach(c => colors.add(c.toLowerCase()));
  });

  // Convert to array and filter common colors
  const filtered = [...colors]
    .filter(c => c !== '#000000' && c !== '#ffffff' && c !== '#000' && c !== '#fff')
    .slice(0, CONFIG.limits.colors);

  // Return defaults if none found
  return filtered.length > 0 ? filtered : ['#1e40af', '#3b82f6'];
}

export default { scrapeSiteLite };
