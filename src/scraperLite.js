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
 * Extract star rating from an element
 */
function extractStarRating($, el) {
  // Method 1: Aria labels
  const ariaLabel = $(el).find('[aria-label*="star"], [aria-label*="rating"]').attr('aria-label');
  if (ariaLabel) {
    const match = ariaLabel.match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }

  // Method 2: Data attributes
  const dataRating = $(el).find('[data-rating], [data-stars]').first().attr('data-rating') ||
                    $(el).find('[data-rating], [data-stars]').first().attr('data-stars');
  if (dataRating) return parseFloat(dataRating);

  // Method 3: Count star icons
  const filledStars = $(el).find('[class*="star-filled"], [class*="star-active"], .fa-star:not(.fa-star-o), .fas.fa-star').length;
  if (filledStars > 0 && filledStars <= 5) return filledStars;

  // Method 4: SVG stars
  const svgStars = $(el).find('svg[class*="star"], [class*="star"] svg').length;
  if (svgStars > 0 && svgStars <= 5) return svgStars;

  // Method 5: Text-based rating
  const ratingText = $(el).find('[class*="rating"]').text();
  const textMatch = ratingText.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*5|out of 5|stars?)/i);
  if (textMatch) return parseFloat(textMatch[1]);

  return null;
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

export default { scrapeSiteLite };
