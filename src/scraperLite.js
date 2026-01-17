// src/scraperLite.js
// Serverless scraper using Firecrawl API with browser fallback

import * as cheerio from 'cheerio';
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('scraper-firecrawl');

/**
 * Main scrape function with automatic fallback
 * 1. Try Firecrawl API first (fast, serverless)
 * 2. Fall back to browser-based scraping if Firecrawl fails
 * 3. Return clear error if both fail
 */
export async function scrapeSiteLite(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  // Try Firecrawl first if API key is available
  if (apiKey) {
    try {
      log.info('Attempting Firecrawl scrape...', { url });
      const result = await scrapeWithFirecrawl(url, apiKey);
      result.scraperMethod = 'firecrawl';
      return result;
    } catch (firecrawlError) {
      log.warn('Firecrawl failed, falling back to browser scraper', {
        url,
        error: firecrawlError.message
      });
    }
  } else {
    log.info('No Firecrawl API key, using browser scraper', { url });
  }

  // Fallback to browser-based scraping
  try {
    log.info('Attempting browser-based scrape...', { url });
    const { scrapeSite: scrapeSiteBrowser } = await import('./scraper.js');
    const result = await scrapeSiteBrowser(url);
    result.scraperMethod = 'browser';
    return result;
  } catch (browserError) {
    log.error('Browser scraper also failed', {
      url,
      error: browserError.message
    });

    // Create helpful error message
    const errorMsg = apiKey
      ? `Site could not be scraped. Firecrawl and browser scraping both failed. The site may be blocking automated access or have technical issues.`
      : `Site could not be scraped. Browser scraping failed. Try adding a FIRECRAWL_API_KEY for better results.`;

    const error = new Error(errorMsg);
    error.code = 'SCRAPE_FAILED';
    error.details = {
      firecrawlError: apiKey ? 'Failed' : 'No API key',
      browserError: browserError.message
    };
    throw error;
  }
}

/**
 * Firecrawl API scraper (separated for clarity)
 */
async function scrapeWithFirecrawl(url, apiKey) {
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

    // Detect language from HTML or content
    const language = detectLanguage($, html);

    // Extract structured data from JSON-LD
    const structuredData = extractStructuredData($);

    // Extract trust signals (years in business, licenses, certifications, etc.)
    const trustSignals = extractTrustSignals($, html);

    const data = {
      url,
      scrapedAt: new Date().toISOString(),
      language,
      ...extractIdentity($, url),
      ...extractContent($),
      ...extractContact($, html),
      ...extractMedia($, url),
      ...extractMeta($),
      colors,
      // Trust signals
      trustSignals,
      // Schema.org structured data
      rating: structuredData.rating,
      reviewCount: structuredData.reviewCount,
      priceRange: structuredData.priceRange
    };

    // Merge schema data with scraped data (schema takes precedence for certain fields)
    if (structuredData.schemaName && !data.businessName) {
      data.businessName = structuredData.schemaName;
    }
    if (structuredData.schemaAddress && !data.address) {
      data.address = structuredData.schemaAddress;
    }
    if (structuredData.schemaPhone && !data.phone) {
      data.phone = structuredData.schemaPhone;
    }
    if (structuredData.schemaEmail && !data.email) {
      data.email = structuredData.schemaEmail;
    }
    if (structuredData.openingHours && !data.hours) {
      data.hours = structuredData.openingHours;
    }
    if (structuredData.schemaDescription && (!data.description || data.description.length < 50)) {
      data.description = structuredData.schemaDescription;
    }

    // Merge services from schema
    if (structuredData.schemaServices.length > 0) {
      const existingServices = new Set(data.services.map(s => s.toLowerCase()));
      for (const service of structuredData.schemaServices) {
        if (!existingServices.has(service.toLowerCase())) {
          data.services.push(service);
        }
      }
    }

    // Merge testimonials/reviews from schema
    if (structuredData.schemaReviews.length > 0) {
      for (const review of structuredData.schemaReviews) {
        // Check for duplicates
        const isDuplicate = data.testimonials.some(t =>
          t.text.toLowerCase().includes(review.text.substring(0, 50).toLowerCase())
        );
        if (!isDuplicate) {
          data.testimonials.push({
            text: review.text,
            author: review.author,
            rating: review.rating
          });
        }
      }
    }

    log.debug('Lite scrape complete', {
      url,
      businessName: data.businessName,
      hasSchema: structuredData.rating !== null || structuredData.schemaName !== null
    });
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

  const testimonials = extractTestimonials($);
  const listItems = extractListItems($);
  const faqs = extractFAQs($);
  const blockquotes = extractBlockquotes($);
  const tables = extractTableContent($);

  return {
    headlines: headlines.slice(0, CONFIG.limits.headlines),
    paragraphs: paragraphs.slice(0, CONFIG.limits.paragraphs),
    services: services.slice(0, CONFIG.limits.services),
    testimonials: testimonials.slice(0, CONFIG.limits.testimonials),
    listItems,
    faqs,
    blockquotes,
    tables
  };
}

/**
 * Extract meaningful list items (services, features, benefits)
 * Filters out navigation and menu items
 */
function extractListItems($) {
  const listItems = [];
  const seenTexts = new Set();

  // Priority selectors for meaningful content
  const contentSelectors = [
    'main li', 'article li', '.services li', '.features li',
    '.benefits li', '[class*="service"] li', '[class*="feature"] li',
    '.content li', '#content li', '[class*="list"] li'
  ];

  // Ancestors to exclude
  const excludeAncestors = [
    'nav', 'header', 'footer', '.menu', '.navigation',
    '[role="navigation"]', '.breadcrumb', '.pagination'
  ];

  for (const selector of contentSelectors) {
    $(selector).each((_, el) => {
      if ($(el).closest(excludeAncestors.join(', ')).length > 0) return;

      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length < 10 || text.length > 200) return;
      if (seenTexts.has(text.toLowerCase())) return;

      // Skip if it's just a navigation link
      if ($(el).find('a').length > 0 &&
          $(el).find('a').text().trim() === text) return;

      seenTexts.add(text.toLowerCase());
      listItems.push({
        text,
        context: $(el).closest('section, div').find('h2, h3').first().text().trim() || null
      });
    });
  }

  return listItems.slice(0, 20);
}

/**
 * Extract FAQ content from multiple sources
 */
function extractFAQs($) {
  const faqs = [];
  const seenQuestions = new Set();

  // Strategy 1: FAQPage Schema.org JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = data['@graph'] || [data];

      for (const item of items) {
        if (item['@type'] === 'FAQPage' && item.mainEntity) {
          const entities = Array.isArray(item.mainEntity)
            ? item.mainEntity : [item.mainEntity];

          for (const entity of entities) {
            if (entity['@type'] === 'Question' && entity.acceptedAnswer) {
              const question = entity.name;
              const answer = entity.acceptedAnswer.text;
              if (question && answer &&
                  !seenQuestions.has(question.toLowerCase())) {
                seenQuestions.add(question.toLowerCase());
                faqs.push({ question, answer: answer.slice(0, 500), source: 'schema' });
              }
            }
          }
        }
      }
    } catch (e) { /* Invalid JSON */ }
  });

  // Strategy 2: FAQ/Accordion section containers
  const faqSelectors = [
    '[class*="faq"]', '[class*="accordion"]',
    '[id*="faq"]', '[data-faq]'
  ];

  for (const selector of faqSelectors) {
    $(selector).each((_, container) => {
      $(container).find('[class*="question"], dt, summary, button[aria-expanded]').each((_, qEl) => {
        const question = $(qEl).text().trim().replace(/\s+/g, ' ');
        if (question.length < 10 || question.length > 200) return;
        if (seenQuestions.has(question.toLowerCase())) return;

        // Find answer in sibling/panel
        let answer = '';
        const answerSources = [
          $(qEl).next('[class*="answer"], [class*="content"], dd, p, [class*="panel"]'),
          $(qEl).parent().find('[class*="answer"], [class*="body"]'),
          $(qEl).closest('[class*="item"]').find('[class*="answer"], [class*="content"]')
        ];

        for (const $answer of answerSources) {
          if ($answer.length && $answer.text().trim().length > 20) {
            answer = $answer.text().trim().replace(/\s+/g, ' ');
            break;
          }
        }

        if (answer.length > 20) {
          seenQuestions.add(question.toLowerCase());
          faqs.push({ question, answer: answer.slice(0, 500), source: 'html' });
        }
      });
    });
  }

  // Strategy 3: Definition lists
  $('dl').each((_, dl) => {
    $(dl).find('dt').each((_, dt) => {
      const question = $(dt).text().trim().replace(/\s+/g, ' ');
      const answer = $(dt).next('dd').text().trim().replace(/\s+/g, ' ');

      if (question.length > 10 && answer.length > 20 &&
          !seenQuestions.has(question.toLowerCase())) {
        seenQuestions.add(question.toLowerCase());
        faqs.push({ question, answer: answer.slice(0, 500), source: 'dl' });
      }
    });
  });

  log.debug('Extracted FAQs', { count: faqs.length });
  return faqs.slice(0, 10);
}

/**
 * Extract blockquotes for testimonials or important quotes
 */
function extractBlockquotes($) {
  const quotes = [];
  const seenTexts = new Set();

  $('blockquote').each((_, el) => {
    if ($(el).find('code, pre').length > 0) return; // Skip code blocks

    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length < 30 || text.length > 600) return;
    if (seenTexts.has(text.toLowerCase())) return;

    seenTexts.add(text.toLowerCase());

    // Find citation/author
    let author = null;
    const citeSources = [
      $(el).find('cite, footer, .author'),
      $(el).next('cite, .author'),
      $(el).parent().find('figcaption')
    ];

    for (const $source of citeSources) {
      if ($source.length && $source.text().trim()) {
        author = $source.text().trim();
        break;
      }
    }

    quotes.push({
      text,
      author,
      context: $(el).closest('section').find('h2, h3').first().text().trim() || null
    });
  });

  return quotes.slice(0, 10);
}

/**
 * Extract table content (menus, pricing, hours)
 */
function extractTableContent($) {
  const tables = [];

  $('table').each((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    if (rows.length < 2 || rows.length > 50) return;

    // Get table context/heading
    let context = '';
    const headingSources = [
      $table.closest('section').find('h2, h3').first(),
      $table.prev('h2, h3'),
      $table.find('caption')
    ];

    for (const $h of headingSources) {
      if ($h.length && $h.text().trim()) {
        context = $h.text().trim();
        break;
      }
    }

    // Extract headers
    const headers = [];
    $table.find('thead th, tr:first-child th').each((_, th) => {
      headers.push($(th).text().trim());
    });

    // Extract rows
    const tableRows = [];
    const startIdx = headers.length > 0 && $table.find('thead').length === 0 ? 1 : 0;

    $table.find('tbody tr, tr').slice(startIdx, 30).each((_, tr) => {
      const rowData = [];
      $(tr).find('td, th').each((_, cell) => {
        rowData.push($(cell).text().trim().replace(/\s+/g, ' '));
      });
      if (rowData.some(c => c.length > 0)) tableRows.push(rowData);
    });

    if (tableRows.length > 0) {
      tables.push({
        context,
        headers: headers.length > 0 ? headers : null,
        rows: tableRows,
        type: detectTableType(context, headers)
      });
    }
  });

  return tables.slice(0, 5);
}

/**
 * Detect table type from context and headers
 */
function detectTableType(context, headers) {
  const text = ((context || '') + ' ' + (headers || []).join(' ')).toLowerCase();
  if (text.match(/hour|time|day|schedule/)) return 'hours';
  if (text.match(/price|cost|menu|service|rate/)) return 'pricing';
  if (text.match(/contact|phone|email|location/)) return 'contact';
  return 'general';
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
  const imageData = [];
  const ogImage = $('meta[property="og:image"]').attr('content');

  // 1. Add OG image first (high priority)
  if (ogImage) {
    let ogSrc = ogImage;
    if (ogSrc.startsWith('/')) ogSrc = new URL(ogSrc, baseUrl).href;
    else if (!ogSrc.startsWith('http')) {
      try { ogSrc = new URL(ogSrc, baseUrl).href; } catch { /* skip */ }
    }

    if (ogSrc.startsWith('http')) {
      imageData.push({
        src: ogSrc,
        alt: $('meta[property="og:image:alt"]').attr('content') || 'Featured image',
        width: parseInt($('meta[property="og:image:width"]').attr('content')) || 1200,
        height: parseInt($('meta[property="og:image:height"]').attr('content')) || 630,
        position: 'hero',
        isOg: true,
        isLogo: false
      });
    }
  }

  // 2. Process all images
  $('img').each((_, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src');
    if (!src) return;

    // Normalize URL
    if (src.startsWith('/')) src = new URL(src, baseUrl).href;
    else if (!src.startsWith('http')) {
      try { src = new URL(src, baseUrl).href; } catch { return; }
    }

    // Skip OG image duplicate
    if (ogImage && src === ogImage) return;

    // Get dimensions
    let width = parseInt($(el).attr('width')) || 400;
    let height = parseInt($(el).attr('height')) || 300;

    // FILTER: Skip tiny images (<100px)
    if (width < 100 || height < 100) return;

    // FILTER: Skip problematic URLs
    const srcLower = src.toLowerCase();
    if (srcLower.match(/pixel|tracking|analytics|beacon|1x1|spacer|sprite/) ||
        src.includes('data:image') ||
        srcLower.endsWith('.svg') ||
        srcLower.endsWith('.gif') ||
        srcLower.match(/facebook\.com|twitter\.com|linkedin\.com|instagram\.com/)) return;

    const position = detectImagePosition($, el);
    const isLogo = isLikelyLogo($, el);

    imageData.push({
      src,
      alt: $(el).attr('alt') || '',
      width, height,
      position,
      isOg: false,
      isLogo
    });
  });

  // 3. Calculate scores and sort
  for (const img of imageData) {
    img.score = calculateImageScore(img);
  }
  imageData.sort((a, b) => b.score - a.score);

  // 4. Log top images
  log.debug('Image ranking', {
    total: imageData.length,
    top3: imageData.slice(0, 3).map(i => ({
      score: i.score, size: `${i.width}x${i.height}`, position: i.position
    }))
  });

  // 5. Return ranked images
  return {
    images: imageData.slice(0, CONFIG.limits.images).map(img => ({
      src: img.src,
      alt: img.alt,
      context: img.position,
      score: img.score,
      isLogo: img.isLogo,
      width: img.width,
      height: img.height
    }))
  };
}

/**
 * Calculate image quality score (0-100)
 */
function calculateImageScore(imgData) {
  let score = 0;

  // 1. Size score (30% weight) - larger is better
  const area = (imgData.width || 100) * (imgData.height || 100);
  if (area >= 40000) { // Min 200x200
    score += Math.min(30, Math.floor((area - 40000) / 30000));
  }

  // 2. Position score (25% weight)
  const positionScores = { hero: 25, header: 20, 'above-fold': 15, main: 10 };
  score += positionScores[imgData.position] || 0;

  // 3. Alt text score (20% weight)
  if (imgData.alt && imgData.alt.length > 5) {
    const altLower = imgData.alt.toLowerCase();
    if (!altLower.match(/icon|logo|button|arrow|spacer/)) {
      score += 15;
      if (altLower.match(/team|office|work|service|product|project/)) score += 5;
    }
  }

  // 4. OG:image bonus (15% weight)
  if (imgData.isOg) score += 15;

  // 5. Logo penalty for hero use (logos are useful but not for main hero)
  if (imgData.isLogo) score -= 10;

  return Math.max(0, Math.round(score));
}

/**
 * Detect image position context
 */
function detectImagePosition($, el) {
  const $el = $(el);

  if ($el.closest('.hero, [class*="hero"], #hero, [class*="banner"], [class*="jumbotron"]').length) {
    return 'hero';
  }
  if ($el.closest('header, .header, [role="banner"]').length) return 'header';

  const index = $('img').index(el);
  if (index < 3) return 'above-fold';
  if (index < 10) return 'main';
  return 'other';
}

/**
 * Check if image is likely a logo
 */
function isLikelyLogo($, el) {
  const $el = $(el);
  const src = ($el.attr('src') || '').toLowerCase();
  const alt = ($el.attr('alt') || '').toLowerCase();
  const cls = ($el.attr('class') || '').toLowerCase();

  return src.includes('logo') || alt.includes('logo') ||
         cls.includes('logo') ||
         $el.closest('[class*="logo"], .brand, [class*="brand"]').length > 0;
}

function extractMeta($) {
  return {
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') ||
                 $('meta[property="og:description"]').attr('content') || null,
    ogImage: $('meta[property="og:image"]').attr('content') || null
  };
}

/**
 * Enhanced testimonial extraction with multiple strategies
 * Detects review widgets, star ratings, and various testimonial formats
 */
function extractTestimonials($) {
  const testimonials = [];
  const seenTexts = new Set();

  // Strategy 1: Standard testimonial/review containers
  const containerSelectors = [
    '[class*="testimonial"]',
    '[class*="review"]:not([class*="preview"])',
    '[class*="feedback"]',
    '[class*="quote"]',
    '[class*="customer-story"]',
    '[class*="success-story"]',
    '[data-testimonial]',
    '[data-review]',
    '.testimonial',
    '.review',
    '.customer-review'
  ];

  for (const selector of containerSelectors) {
    $(selector).each((_, el) => {
      const testimonial = extractSingleTestimonial($, el);
      if (testimonial && !seenTexts.has(testimonial.text.toLowerCase())) {
        seenTexts.add(testimonial.text.toLowerCase());
        testimonials.push(testimonial);
      }
    });
  }

  // Strategy 2: Blockquotes (common testimonial format)
  $('blockquote').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    // Skip short blockquotes or code blocks
    if (text.length < 30 || text.length > 600) return;
    if ($(el).find('code, pre').length > 0) return;

    if (!seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      const author = $(el).next('cite, .author, [class*="author"]').text().trim() ||
                    $(el).find('cite, footer').text().trim() ||
                    'Customer';
      const rating = extractStarRating($, el);
      testimonials.push({ text, author, rating });
    }
  });

  // Strategy 3: Google Reviews widget
  $('[class*="google-review"], [class*="greviews"], [data-google-review]').each((_, el) => {
    const text = $(el).find('[class*="text"], [class*="content"], p').first().text().trim();
    if (text.length > 20 && text.length < 500 && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      const author = $(el).find('[class*="author"], [class*="name"]').first().text().trim() || 'Google Reviewer';
      const rating = extractStarRating($, el);
      testimonials.push({ text, author, rating, source: 'google' });
    }
  });

  // Strategy 4: Yelp Reviews widget
  $('[class*="yelp-review"], [class*="yelp-widget"], [data-yelp]').each((_, el) => {
    const text = $(el).find('[class*="text"], [class*="content"], p').first().text().trim();
    if (text.length > 20 && text.length < 500 && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      const author = $(el).find('[class*="author"], [class*="name"]').first().text().trim() || 'Yelp Reviewer';
      const rating = extractStarRating($, el);
      testimonials.push({ text, author, rating, source: 'yelp' });
    }
  });

  // Strategy 5: TrustPilot widget
  $('[class*="trustpilot"], [data-trustpilot]').each((_, el) => {
    const text = $(el).find('[class*="text"], [class*="content"], p').first().text().trim();
    if (text.length > 20 && text.length < 500 && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      const author = $(el).find('[class*="author"], [class*="name"]').first().text().trim() || 'Customer';
      const rating = extractStarRating($, el);
      testimonials.push({ text, author, rating, source: 'trustpilot' });
    }
  });

  // Strategy 6: Sections with review-related headings
  $('section, div').each((_, section) => {
    const heading = $(section).find('h1, h2, h3').first().text().toLowerCase();
    const reviewKeywords = ['testimonial', 'review', 'what our', 'what people', 'hear from', 'customer say', 'client say'];

    if (reviewKeywords.some(kw => heading.includes(kw))) {
      // Find review items within this section
      $(section).find('[class*="item"], [class*="card"], [class*="slide"], li').each((_, item) => {
        const testimonial = extractSingleTestimonial($, item);
        if (testimonial && !seenTexts.has(testimonial.text.toLowerCase())) {
          seenTexts.add(testimonial.text.toLowerCase());
          testimonials.push(testimonial);
        }
      });
    }
  });

  // Strategy 7: Case study / success story sections
  $('section, div').each((_, section) => {
    const heading = $(section).find('h1, h2, h3').first().text().toLowerCase();
    const keywords = ['case study', 'success story', 'customer story', 'client spotlight', 'featured client'];

    if (keywords.some(kw => heading.includes(kw))) {
      $(section).find('[class*="quote"], blockquote, [class*="testimonial"]').each((_, item) => {
        const testimonial = extractSingleTestimonial($, item);
        if (testimonial && !seenTexts.has(testimonial.text.toLowerCase())) {
          seenTexts.add(testimonial.text.toLowerCase());
          testimonials.push({ ...testimonial, source: 'case-study' });
        }
      });
    }
  });

  // Strategy 8: Facebook review widgets
  $('[class*="fb-review"], [data-href*="facebook.com/reviews"], .facebook-review, [class*="facebook"][class*="review"]').each((_, el) => {
    const text = $(el).find('[class*="text"], [class*="content"], p').first().text().trim();
    if (text.length > 20 && text.length < 500 && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      const authorDetails = extractAuthorDetails($, el);
      testimonials.push({
        text,
        author: authorDetails.name || 'Facebook User',
        rating: extractStarRating($, el),
        source: 'facebook',
        company: authorDetails.company || null
      });
    }
  });

  // Strategy 9: Review schema microdata
  $('[itemtype*="Review"], [itemprop="review"]').each((_, el) => {
    const $el = $(el);
    const text = $el.find('[itemprop="reviewBody"]').text().trim();

    if (text.length > 20 && text.length < 500 && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      const authorName = $el.find('[itemprop="author"]').text().trim();
      const rating = $el.find('[itemprop="ratingValue"]').attr('content');

      testimonials.push({
        text,
        author: authorName || 'Customer',
        rating: rating ? parseFloat(rating) : extractStarRating($, el),
        source: 'microdata'
      });
    }
  });

  log.debug('Extracted testimonials', { count: testimonials.length });
  return testimonials;
}

/**
 * Extract a single testimonial from an element
 */
function extractSingleTestimonial($, el) {
  // Text selectors in order of priority
  const textSelectors = [
    '[class*="text"]',
    '[class*="content"]',
    '[class*="quote"]',
    '[class*="body"]',
    'p:not([class*="author"]):not([class*="name"])',
    'blockquote'
  ];

  let text = '';
  for (const selector of textSelectors) {
    const found = $(el).find(selector).first().text().trim();
    if (found && found.length > 20) {
      text = found;
      break;
    }
  }

  // Fallback: direct text if no nested text found
  if (!text) {
    text = $(el).clone()
      .find('[class*="author"], [class*="name"], cite, img, svg')
      .remove()
      .end()
      .text()
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Validate text
  if (text.length < 20 || text.length > 600) return null;

  // Author selectors
  const authorSelectors = [
    '[class*="author"]',
    '[class*="name"]:not([class*="company"])',
    '[class*="reviewer"]',
    '[class*="customer"]',
    'cite',
    '.name',
    'footer',
    'figcaption'
  ];

  let author = '';
  for (const selector of authorSelectors) {
    const found = $(el).find(selector).first().text().trim();
    if (found && found.length > 1 && found.length < 60) {
      author = found;
      break;
    }
  }

  const rating = extractStarRating($, el);

  return {
    text: text.replace(/\s+/g, ' '),
    author: author || 'Customer',
    rating
  };
}

/**
 * Enhanced star rating extraction with multiple detection methods
 */
function extractStarRating($, el) {
  const $el = $(el);

  // Method 1: Aria labels (most reliable)
  const ariaLabel = $el.find('[aria-label*="star"], [aria-label*="rating"]').attr('aria-label') ||
                    $el.attr('aria-label');
  if (ariaLabel) {
    const match = ariaLabel.match(/(\d+(?:\.\d+)?)\s*(?:out of|stars?)?/i);
    if (match) return parseFloat(match[1]);
  }

  // Method 2: Data attributes
  const dataAttrs = ['data-rating', 'data-stars', 'data-score', 'data-value'];
  for (const attr of dataAttrs) {
    const value = $el.find(`[${attr}]`).first().attr(attr) || $el.attr(attr);
    if (value) {
      const parsed = parseFloat(value);
      if (parsed >= 0 && parsed <= 5) return parsed;
    }
  }

  // Method 3: Class patterns (star-5, rating-4, etc.)
  const classPatterns = [/star[s-]?(\d)/i, /rating[s-]?(\d)/i, /(\d)-star/i];
  const classString = $el.find('[class*="star"], [class*="rating"]').attr('class') ||
                      $el.attr('class') || '';

  for (const pattern of classPatterns) {
    const match = classString.match(pattern);
    if (match) return parseInt(match[1]);
  }

  // Method 4: Count filled star icons (multiple selectors)
  const filledSelectors = [
    '.fa-star:not(.fa-star-o):not(.far)',
    '.fas.fa-star',
    '[class*="star-filled"]',
    '[class*="star-active"]',
    '.star.active',
    '[class*="star"][class*="full"]'
  ];

  for (const sel of filledSelectors) {
    const count = $el.find(sel).length;
    if (count > 0 && count <= 5) return count;
  }

  // Method 5: SVG stars
  const svgStars = $el.find('svg[class*="star"], [class*="star"] svg').length;
  if (svgStars > 0 && svgStars <= 5) return svgStars;

  // Method 6: Text patterns
  const text = $el.text() + ' ' + $el.find('[class*="rating"]').text();
  const textPatterns = [
    /(\d+(?:\.\d+)?)\s*\/\s*5/i,
    /(\d+(?:\.\d+)?)\s*out\s*of\s*5/i,
    /(\d+(?:\.\d+)?)\s*stars?/i
  ];

  for (const pattern of textPatterns) {
    const match = text.match(pattern);
    if (match) {
      const rating = parseFloat(match[1]);
      if (rating >= 0 && rating <= 5) return rating;
    }
  }

  return null;
}

/**
 * Extract detailed author information from a testimonial element
 */
function extractAuthorDetails($, el) {
  const $el = $(el);
  const result = { name: '', company: '', role: '', location: '' };

  // Name selectors in order of priority
  const nameSelectors = [
    '[class*="author-name"]', '[class*="reviewer-name"]',
    '[class*="name"]:not([class*="company"])',
    '[class*="author"]', 'cite', 'strong:first', 'b:first'
  ];

  for (const sel of nameSelectors) {
    const $name = $el.find(sel).first();
    if ($name.length && $name.text().trim().length > 1 && $name.text().trim().length < 60) {
      result.name = $name.text().trim();
      break;
    }
  }

  // Company selectors
  const companySelectors = ['[class*="company"]', '[class*="business"]', '[class*="org"]', '[class*="employer"]'];
  for (const sel of companySelectors) {
    const $company = $el.find(sel).first();
    if ($company.length && $company.text().trim()) {
      result.company = $company.text().trim();
      break;
    }
  }

  // Role/title selectors
  const roleSelectors = ['[class*="title"]', '[class*="role"]', '[class*="position"]', '[class*="job"]'];
  for (const sel of roleSelectors) {
    const $role = $el.find(sel).first();
    if ($role.length && $role.text().trim().length < 60) {
      result.role = $role.text().trim();
      break;
    }
  }

  // Location selectors
  const locationSelectors = ['[class*="location"]', '[class*="city"]', '[class*="place"]'];
  for (const sel of locationSelectors) {
    const $loc = $el.find(sel).first();
    if ($loc.length && $loc.text().trim()) {
      result.location = $loc.text().trim();
      break;
    }
  }

  // Fallback: parse "Name, Role at Company" pattern from footer/cite
  if (!result.name) {
    const footer = $el.find('footer, cite, figcaption, [class*="attribution"]').first().text().trim();
    const match = footer.match(/^([^,]+),?\s*(.+)?$/);
    if (match) {
      result.name = match[1].trim();
      if (match[2]) {
        const rc = match[2].match(/(.+?)\s+(?:at|@|from)\s+(.+)/i);
        if (rc) {
          result.role = rc[1].trim();
          result.company = rc[2].trim();
        }
      }
    }
  }

  // Clean up dash/em-dash prefixes
  if (result.name.startsWith('—') || result.name.startsWith('-')) {
    result.name = result.name.slice(1).trim();
  }

  return result;
}

/**
 * Extract structured data from JSON-LD scripts (Schema.org)
 * Supports LocalBusiness, Organization, Restaurant, and other common types
 */
function extractStructuredData($) {
  const structuredData = {
    rating: null,
    reviewCount: null,
    priceRange: null,
    openingHours: null,
    schemaAddress: null,
    schemaPhone: null,
    schemaEmail: null,
    schemaName: null,
    schemaDescription: null,
    schemaServices: [],
    schemaReviews: []
  };

  // Find all JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (!jsonText) return;

      const data = JSON.parse(jsonText);

      // Handle @graph arrays (common in WordPress/Yoast)
      const items = data['@graph'] ? data['@graph'] : [data];

      for (const item of items) {
        parseSchemaItem(item, structuredData);
      }
    } catch (error) {
      // Invalid JSON-LD, skip
      log.debug('Failed to parse JSON-LD', { error: error.message });
    }
  });

  return structuredData;
}

/**
 * Parse individual schema item and extract relevant data
 */
function parseSchemaItem(item, result) {
  if (!item || typeof item !== 'object') return;

  const type = item['@type'];
  if (!type) return;

  // Normalize type to array for easier handling
  const types = Array.isArray(type) ? type : [type];

  // Business types we care about
  const businessTypes = [
    'LocalBusiness', 'Organization', 'Restaurant', 'Store',
    'ProfessionalService', 'LegalService', 'MedicalBusiness',
    'HomeAndConstructionBusiness', 'Plumber', 'Electrician',
    'RealEstateAgent', 'Dentist', 'Attorney', 'FinancialService'
  ];

  const isBusinessType = types.some(t => businessTypes.includes(t));

  if (isBusinessType) {
    // Extract business name
    if (item.name && !result.schemaName) {
      result.schemaName = item.name;
    }

    // Extract description
    if (item.description && !result.schemaDescription) {
      result.schemaDescription = item.description;
    }

    // Extract aggregate rating
    if (item.aggregateRating) {
      result.rating = parseFloat(item.aggregateRating.ratingValue) || null;
      result.reviewCount = parseInt(item.aggregateRating.reviewCount || item.aggregateRating.ratingCount) || null;
    }

    // Extract price range
    if (item.priceRange) {
      result.priceRange = item.priceRange;
    }

    // Extract opening hours
    if (item.openingHours) {
      result.openingHours = Array.isArray(item.openingHours)
        ? item.openingHours.join(', ')
        : item.openingHours;
    } else if (item.openingHoursSpecification) {
      result.openingHours = formatOpeningHours(item.openingHoursSpecification);
    }

    // Extract address
    if (item.address) {
      result.schemaAddress = formatAddress(item.address);
    }

    // Extract phone
    if (item.telephone && !result.schemaPhone) {
      result.schemaPhone = item.telephone;
    }

    // Extract email
    if (item.email && !result.schemaEmail) {
      result.schemaEmail = item.email;
    }

    // Extract services offered
    if (item.hasOfferCatalog && item.hasOfferCatalog.itemListElement) {
      const services = item.hasOfferCatalog.itemListElement;
      for (const service of services) {
        if (service.name && !result.schemaServices.includes(service.name)) {
          result.schemaServices.push(service.name);
        }
      }
    }

    // Extract makesOffer services
    if (item.makesOffer) {
      const offers = Array.isArray(item.makesOffer) ? item.makesOffer : [item.makesOffer];
      for (const offer of offers) {
        const serviceName = offer.itemOffered?.name || offer.name;
        if (serviceName && !result.schemaServices.includes(serviceName)) {
          result.schemaServices.push(serviceName);
        }
      }
    }
  }

  // Extract reviews (can be on business or separate Review type)
  if (types.includes('Review') && item.reviewBody) {
    result.schemaReviews.push({
      text: item.reviewBody,
      author: item.author?.name || item.author || 'Customer',
      rating: item.reviewRating?.ratingValue || null,
      date: item.datePublished || null
    });
  }

  // Reviews array on business entity
  if (item.review) {
    const reviews = Array.isArray(item.review) ? item.review : [item.review];
    for (const review of reviews) {
      if (review.reviewBody) {
        result.schemaReviews.push({
          text: review.reviewBody,
          author: review.author?.name || review.author || 'Customer',
          rating: review.reviewRating?.ratingValue || null,
          date: review.datePublished || null
        });
      }
    }
  }
}

/**
 * Format PostalAddress schema to string
 */
function formatAddress(address) {
  if (typeof address === 'string') return address;

  const parts = [];
  if (address.streetAddress) parts.push(address.streetAddress);
  if (address.addressLocality) parts.push(address.addressLocality);
  if (address.addressRegion) parts.push(address.addressRegion);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.addressCountry) {
    const country = typeof address.addressCountry === 'string'
      ? address.addressCountry
      : address.addressCountry.name;
    if (country) parts.push(country);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Format OpeningHoursSpecification to readable string
 */
function formatOpeningHours(specs) {
  if (!Array.isArray(specs)) specs = [specs];

  const dayMap = {
    'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed',
    'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun',
    'https://schema.org/Monday': 'Mon', 'https://schema.org/Tuesday': 'Tue',
    'https://schema.org/Wednesday': 'Wed', 'https://schema.org/Thursday': 'Thu',
    'https://schema.org/Friday': 'Fri', 'https://schema.org/Saturday': 'Sat',
    'https://schema.org/Sunday': 'Sun'
  };

  const formatted = [];
  for (const spec of specs) {
    const days = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];
    const dayNames = days.map(d => dayMap[d] || d).filter(Boolean);
    const opens = spec.opens || '';
    const closes = spec.closes || '';

    if (dayNames.length > 0 && opens && closes) {
      formatted.push(`${dayNames.join(', ')}: ${opens}-${closes}`);
    }
  }

  return formatted.length > 0 ? formatted.join('; ') : null;
}

function detectLanguage($, html) {
  // 1. Check HTML lang attribute (most reliable)
  const htmlLang = $('html').attr('lang');
  if (htmlLang) {
    const lang = htmlLang.split('-')[0].toLowerCase();
    log.debug('Language detected from HTML lang attr', { lang });
    return lang;
  }

  // 2. Check meta tags
  const metaLang = $('meta[http-equiv="content-language"]').attr('content') ||
                   $('meta[name="language"]').attr('content');
  if (metaLang) {
    const lang = metaLang.split('-')[0].toLowerCase();
    log.debug('Language detected from meta tag', { lang });
    return lang;
  }

  // 3. Simple content-based detection for common languages
  const text = $('body').text().toLowerCase();
  const langIndicators = {
    nl: ['diensten', 'welkom', 'onze', 'contacteer', 'meer informatie', 'lees meer', 'over ons', 'werkzaamheden'],
    de: ['willkommen', 'dienstleistungen', 'über uns', 'kontakt', 'mehr erfahren', 'unsere'],
    fr: ['bienvenue', 'services', 'contactez', 'notre', 'en savoir plus', 'à propos'],
    es: ['bienvenido', 'servicios', 'contacto', 'nuestro', 'sobre nosotros', 'más información'],
    it: ['benvenuto', 'servizi', 'contatto', 'nostro', 'chi siamo', 'scopri di più']
  };

  for (const [lang, indicators] of Object.entries(langIndicators)) {
    const matches = indicators.filter(word => text.includes(word)).length;
    if (matches >= 2) {
      log.debug('Language detected from content analysis', { lang, matches });
      return lang;
    }
  }

  // Default to English
  log.debug('Language defaulting to English');
  return 'en';
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

/**
 * Extract trust signals from page content
 * Years in business, licenses, certifications, customer counts, awards, guarantees
 */
function extractTrustSignals($, html) {
  const fullText = $('body').text().replace(/\s+/g, ' ');
  const trustSignals = {
    foundedYear: null,
    yearsInBusiness: null,
    licenses: [],
    certifications: [],
    customerCount: null,
    awards: [],
    guarantees: [],
    serviceAreas: []
  };

  // Extract years in business / founded year
  // Patterns: "Since 1987", "Est. 2010", "Established 1995", "Founded in 2000", "25+ years"
  const yearPatterns = [
    /(?:since|est\.?|established|founded(?:\s+in)?)\s*(\d{4})/gi,
    /(\d{4})\s*[-–]\s*(?:present|today|now|\d{4})/gi
  ];

  for (const pattern of yearPatterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const year = parseInt(match[1]);
      if (year >= 1900 && year <= new Date().getFullYear()) {
        trustSignals.foundedYear = year;
        trustSignals.yearsInBusiness = new Date().getFullYear() - year;
        break;
      }
    }
    if (trustSignals.foundedYear) break;
  }

  // "25+ years experience" pattern
  if (!trustSignals.yearsInBusiness) {
    const yearsMatch = fullText.match(/(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|in\s+business|serving|service)/i);
    if (yearsMatch) {
      trustSignals.yearsInBusiness = parseInt(yearsMatch[1]);
    }
  }

  // Extract license numbers
  const licensePatterns = [
    /(?:license|lic|contractor)\s*[#:]?\s*([A-Z0-9][-A-Z0-9]{3,15})/gi,
    /(?:ROC|CBC|CFC|HIC)\s*[#:]?\s*(\d+)/gi
  ];

  for (const pattern of licensePatterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const license = match[1].trim();
      if (license && !trustSignals.licenses.includes(license)) {
        trustSignals.licenses.push(license);
      }
    }
  }

  // Extract certifications (keywords in context)
  const certKeywords = [
    'licensed', 'insured', 'bonded', 'certified', 'accredited',
    'BBB', 'EPA', 'NATE', 'master plumber', 'master electrician',
    'journeyman', 'OSHA', 'ISO', 'LEED', 'Energy Star'
  ];

  for (const keyword of certKeywords) {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    if (regex.test(fullText)) {
      const normalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
      if (!trustSignals.certifications.includes(normalizedKeyword)) {
        trustSignals.certifications.push(normalizedKeyword);
      }
    }
  }

  // Extract customer count
  const customerPatterns = [
    /(\d{1,3}(?:,\d{3})*|\d+)\+?\s*(?:happy\s+)?(?:customers?|clients?|families|homes|projects|jobs)/gi,
    /(?:served|helped|trusted\s+by)\s*(?:over\s+)?(\d{1,3}(?:,\d{3})*|\d+)\+?/gi
  ];

  for (const pattern of customerPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      // Extract just the number
      const numMatch = match[0].match(/(\d{1,3}(?:,\d{3})*|\d+)/);
      if (numMatch) {
        const count = numMatch[1];
        // Only accept reasonable counts (> 10)
        if (parseInt(count.replace(/,/g, '')) >= 10) {
          trustSignals.customerCount = count + '+';
          break;
        }
      }
    }
  }

  // Extract awards
  const awardPatterns = [
    /(?:best\s+of|award[- ]winning|winner|voted\s+(?:best|#1)|top\s+\d+|#1\s+rated)[\w\s]*(?:\d{4})?/gi,
    /(?:angie'?s?\s*list|home\s*advisor|yelp)\s*(?:super\s*service\s*)?award/gi
  ];

  for (const pattern of awardPatterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const award = match[0].trim().substring(0, 50); // Limit length
      if (award && !trustSignals.awards.some(a => a.toLowerCase() === award.toLowerCase())) {
        trustSignals.awards.push(award);
      }
    }
  }

  // Extract guarantees
  const guaranteeKeywords = [
    'satisfaction guarantee', 'money back guarantee', '100% satisfaction',
    'warranty', 'guaranteed', 'no-hassle', 'risk-free', 'free estimates'
  ];

  for (const keyword of guaranteeKeywords) {
    const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
    if (regex.test(fullText)) {
      const normalizedGuarantee = keyword.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      if (!trustSignals.guarantees.includes(normalizedGuarantee)) {
        trustSignals.guarantees.push(normalizedGuarantee);
      }
    }
  }

  // Extract service areas
  const serviceAreaPatterns = [
    /(?:serving|proudly\s+serving|service\s+area[s]?[:\s]+|covering|we\s+serve)\s+([^.!?\n]{5,100}?)(?:\.|,\s*and|$)/gi,
    /(?:serving\s+the)\s+([^.!?\n]{5,50}?)(?:\s+area|\s+region|\s+community)/gi
  ];

  for (const pattern of serviceAreaPatterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const area = match[1].trim()
        .replace(/and surrounding areas?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (area && area.length > 2 && area.length < 100 &&
          !trustSignals.serviceAreas.includes(area)) {
        trustSignals.serviceAreas.push(area);
      }
    }
  }

  return trustSignals;
}

export default { scrapeSiteLite };
