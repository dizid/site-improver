// src/templateBuilder.js
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import CleanCSS from 'clean-css';
import logger from './logger.js';
import { ICONS, getIcon, detectIcon } from '../templates/base/icons.js';
import { resolveSmartFallbacks, isEmptyOrPlaceholder } from './smartFallbacks.js';
import { INDUSTRY_KEYWORDS, SCHEMA_TO_INDUSTRY, SIGNAL_WEIGHTS, CONFIDENCE_THRESHOLDS } from './industryKeywords.js';
import { getDesignSystem, getColorPalette, getFontPairing as getDesignFontPairing, generateDesignCSS, FONT_PAIRINGS as DESIGN_FONT_PAIRINGS } from './designSystem.js';

const log = logger.child('templateBuilder');

// Font pairings for different industries
const FONT_PAIRINGS = {
  modern: {
    name: 'Modern',
    heading: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
    googleFonts: 'family=Inter:wght@400;600;700;800'
  },
  elegant: {
    name: 'Elegant',
    heading: "'Playfair Display', serif",
    body: "'Source Sans Pro', sans-serif",
    googleFonts: 'family=Playfair+Display:wght@400;600;700&family=Source+Sans+Pro:wght@400;600'
  },
  bold: {
    name: 'Bold',
    heading: "'Bebas Neue', sans-serif",
    body: "'Open Sans', sans-serif",
    googleFonts: 'family=Bebas+Neue&family=Open+Sans:wght@400;600;700'
  },
  friendly: {
    name: 'Friendly',
    heading: "'Nunito', sans-serif",
    body: "'Nunito', sans-serif",
    googleFonts: 'family=Nunito:wght@400;600;700;800'
  },
  professional: {
    name: 'Professional',
    heading: "'Montserrat', sans-serif",
    body: "'Roboto', sans-serif",
    googleFonts: 'family=Montserrat:wght@400;600;700;800&family=Roboto:wght@400;500'
  }
};

// Map industries to font pairings
const INDUSTRY_FONTS = {
  // Professional/Elegant industries
  lawyer: 'elegant',
  accountant: 'elegant',
  insurance: 'professional',
  'real-estate': 'professional',
  dentist: 'professional',

  // Bold/Strong industries (trades)
  plumber: 'bold',
  electrician: 'bold',
  hvac: 'bold',
  roofing: 'bold',
  auto: 'bold',
  gym: 'bold',
  'home-services': 'bold',

  // Friendly/Approachable industries
  restaurant: 'friendly',
  retail: 'friendly',
  salon: 'friendly',
  cleaning: 'friendly',
  landscaping: 'friendly',

  // Creative industries
  portfolio: 'modern',
  landing: 'modern',

  // Default
  general: 'modern'
};

// Layout variants for visual diversity
const LAYOUT_VARIANTS = {
  classic: {
    name: 'Classic',
    heroLayout: 'split',           // Image on right, text on left
    cardStyle: 'elevated',         // Cards with shadows
    sectionSpacing: 'normal',      // Standard spacing
    borderRadius: 'rounded',       // 1rem border radius
    colorIntensity: 'normal'       // Standard color saturation
  },
  minimal: {
    name: 'Minimal',
    heroLayout: 'centered',        // Centered text, image below
    cardStyle: 'flat',             // No shadows, subtle borders
    sectionSpacing: 'relaxed',     // More whitespace
    borderRadius: 'subtle',        // 0.5rem border radius
    colorIntensity: 'muted'        // Desaturated colors
  },
  bold: {
    name: 'Bold',
    heroLayout: 'fullwidth',       // Full-width hero with overlay
    cardStyle: 'solid',            // Solid background fills
    sectionSpacing: 'compact',     // Tighter sections
    borderRadius: 'sharp',         // 0.25rem border radius
    colorIntensity: 'vibrant'      // Saturated colors
  },
  elegant: {
    name: 'Elegant',
    heroLayout: 'asymmetric',      // Offset layout
    cardStyle: 'outlined',         // Subtle borders
    sectionSpacing: 'luxurious',   // Extra whitespace
    borderRadius: 'rounded',       // 1rem border radius
    colorIntensity: 'refined'      // Slightly desaturated
  }
};

// Map industries to layout variants
const INDUSTRY_VARIANTS = {
  // Elegant: Asymmetric hero, outlined cards, luxurious spacing
  lawyer: 'elegant',
  accountant: 'elegant',

  // Minimal: Centered hero, flat cards, relaxed spacing
  'real-estate': 'minimal',
  dentist: 'minimal',
  insurance: 'minimal',
  cleaning: 'minimal',
  salon: 'minimal',

  // Bold: Fullwidth hero, solid cards, compact spacing
  restaurant: 'bold',
  plumber: 'bold',
  electrician: 'bold',
  hvac: 'bold',
  roofing: 'bold',
  auto: 'bold',
  gym: 'bold',
  landscaping: 'bold',

  // Classic: Split hero, elevated cards, normal spacing
  retail: 'classic',
  'home-services': 'classic',
  general: 'classic',

  // Creative: Centered hero, minimal styling
  portfolio: 'minimal',
  landing: 'minimal'
};

// Handle both ESM and bundled CJS environments
const __dirname = import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : process.cwd();

// For serverless environments, try multiple possible template locations
function findTemplatesDir() {
  const possiblePaths = [
    path.join(__dirname, '../templates'),           // Development: src/../templates
    path.join(process.cwd(), 'templates'),          // Serverless: process.cwd()/templates
    path.join(__dirname, 'templates'),              // Bundled: same dir as script
    path.join(__dirname, '../../templates'),        // Alternative relative path
  ];

  // Return first path (will validate during init)
  return possiblePaths[0];
}

export class TemplateBuilder {
  constructor(templatesDir = null) {
    this.templatesDir = templatesDir || findTemplatesDir();
    this.possibleTemplatesPaths = [
      path.join(__dirname, '../templates'),
      path.join(process.cwd(), 'templates'),
      path.join(__dirname, 'templates'),
      path.join(__dirname, '../../templates'),
    ];
    this.components = {};
    this.industryConfigs = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Register Handlebars helpers
    Handlebars.registerHelper('if', function(conditional, options) {
      if (conditional) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Try to find a valid templates directory
    for (const tryPath of this.possibleTemplatesPaths) {
      try {
        await fs.access(path.join(tryPath, 'base/components'));
        this.templatesDir = tryPath;
        log.info('Found templates directory', { path: tryPath });
        break;
      } catch {
        log.debug('Templates not found at', { path: tryPath });
      }
    }

    // Load all components
    const componentsDir = path.join(this.templatesDir, 'base/components');
    try {
      const files = await fs.readdir(componentsDir);

      for (const file of files) {
        if (!file.endsWith('.html')) continue;
        const name = file.replace('.html', '');
        const content = await fs.readFile(path.join(componentsDir, file), 'utf-8');
        this.components[name] = Handlebars.compile(content);
      }
      log.info('Loaded components', { count: Object.keys(this.components).length });
    } catch (error) {
      log.warn('Could not load components', { error: error.message, path: componentsDir });
    }

    // Load industry configs
    const industriesDir = path.join(this.templatesDir, 'industries');
    try {
      const industries = await fs.readdir(industriesDir);

      for (const industry of industries) {
        const configPath = path.join(industriesDir, industry, 'template.json');
        try {
          const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
          this.industryConfigs[industry] = config;
        } catch (error) {
          log.debug(`Skipping industry ${industry} - no config or invalid JSON`);
        }
      }
      log.info('Loaded industry configs', { count: Object.keys(this.industryConfigs).length });
    } catch (error) {
      log.warn('Could not load industry configs', { error: error.message });
    }

    this.initialized = true;
  }

  /**
   * Detect industry using multi-signal weighted scoring
   * Returns { industry, confidence, signals } for informed template decisions
   */
  detectIndustry(siteData) {
    const scores = {};
    const signalLog = {};

    // Prepare text sources for analysis
    const businessName = (siteData.businessName || '').toLowerCase();
    const url = (siteData.url || siteData.original || '').toLowerCase();
    const headlines = (siteData.headlines || []).join(' ').toLowerCase();
    const title = (siteData.title || '').toLowerCase();
    const description = (siteData.description || '').toLowerCase();
    const paragraphs = (siteData.paragraphs || []).join(' ').toLowerCase();
    const services = (siteData.services || []).map(s =>
      typeof s === 'string' ? s : s.name || s.title || ''
    ).join(' ').toLowerCase();

    // Extract domain from URL
    let domain = '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = urlObj.hostname.replace('www.', '').split('.')[0];
    } catch (e) {
      domain = url.replace(/^https?:\/\//, '').replace('www.', '').split(/[./]/)[0];
    }

    // Initialize scores for all industries
    for (const industry of Object.keys(INDUSTRY_KEYWORDS)) {
      scores[industry] = 0;
      signalLog[industry] = [];
    }

    // 1. Schema.org signals (highest weight - 3x)
    const schemaType = this.extractSchemaType(siteData);
    if (schemaType && SCHEMA_TO_INDUSTRY[schemaType]) {
      const industry = SCHEMA_TO_INDUSTRY[schemaType];
      scores[industry] += SIGNAL_WEIGHTS.schemaType;
      signalLog[industry].push(`schema:${schemaType}`);
    }

    // 2. Check each industry's keywords
    for (const [industry, config] of Object.entries(INDUSTRY_KEYWORDS)) {
      if (industry === 'general') continue;

      // Check for negative keywords first (strong penalty)
      for (const negative of config.negative || []) {
        const negLower = negative.toLowerCase();
        if (paragraphs.includes(negLower) || headlines.includes(negLower)) {
          scores[industry] += SIGNAL_WEIGHTS.negativeKeyword;
          signalLog[industry].push(`negative:${negative}`);
        }
      }

      // Business name signals (2x weight)
      for (const keyword of config.primary || []) {
        if (businessName.includes(keyword.toLowerCase())) {
          scores[industry] += SIGNAL_WEIGHTS.businessName;
          signalLog[industry].push(`name:${keyword}`);
        }
      }

      // URL/Domain signals (2x weight)
      for (const pattern of config.urlPatterns || []) {
        if (domain.includes(pattern.toLowerCase())) {
          scores[industry] += SIGNAL_WEIGHTS.urlDomain;
          signalLog[industry].push(`url:${pattern}`);
        }
      }

      // Primary keywords in headlines/title (1.5x weight)
      for (const keyword of config.primary || []) {
        const kwLower = keyword.toLowerCase();
        if (headlines.includes(kwLower) || title.includes(kwLower)) {
          scores[industry] += SIGNAL_WEIGHTS.headlineKeyword;
          signalLog[industry].push(`headline:${keyword}`);
        }
      }

      // Primary keywords in services (1.5x weight)
      for (const keyword of config.primary || []) {
        if (services.includes(keyword.toLowerCase())) {
          scores[industry] += SIGNAL_WEIGHTS.serviceKeyword;
          signalLog[industry].push(`service:${keyword}`);
        }
      }

      // Primary keywords in body (2x weight)
      for (const keyword of config.primary || []) {
        const kwLower = keyword.toLowerCase();
        if (paragraphs.includes(kwLower) || description.includes(kwLower)) {
          scores[industry] += SIGNAL_WEIGHTS.primaryKeyword;
          signalLog[industry].push(`primary:${keyword}`);
        }
      }

      // Secondary keywords in any text (1x weight)
      for (const keyword of config.secondary || []) {
        const kwLower = keyword.toLowerCase();
        const allText = `${businessName} ${headlines} ${paragraphs} ${services}`;
        if (allText.includes(kwLower)) {
          scores[industry] += SIGNAL_WEIGHTS.secondaryKeyword;
          signalLog[industry].push(`secondary:${keyword}`);
        }
      }
    }

    // Find best match
    let bestIndustry = 'general';
    let bestScore = 0;

    for (const [industry, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestIndustry = industry;
      }
    }

    // Calculate confidence (normalize score to 0-1 range)
    // A score of 10+ is considered very high confidence
    const maxPossibleScore = 15; // Approximate max realistic score
    const confidence = Math.min(1, Math.max(0, bestScore / maxPossibleScore));

    // Log detection for debugging
    const topSignals = signalLog[bestIndustry] || [];
    log.info('Industry detected', {
      industry: bestIndustry,
      confidence: confidence.toFixed(2),
      score: bestScore.toFixed(1),
      signals: topSignals.slice(0, 5),
      businessName: siteData.businessName
    });

    // Store detection result on siteData for later use
    siteData.detectedIndustry = {
      industry: bestIndustry,
      confidence,
      score: bestScore,
      signals: topSignals
    };

    return bestIndustry;
  }

  /**
   * Extract Schema.org @type from siteData
   */
  extractSchemaType(siteData) {
    // Check direct schema property
    if (siteData.schema) {
      const schema = siteData.schema;
      if (typeof schema === 'string') return schema;
      if (schema['@type']) return schema['@type'];
      if (Array.isArray(schema) && schema[0]?.['@type']) return schema[0]['@type'];
    }

    // Check structured data from scraper
    if (siteData.structuredData) {
      for (const item of siteData.structuredData) {
        if (item['@type'] && SCHEMA_TO_INDUSTRY[item['@type']]) {
          return item['@type'];
        }
      }
    }

    return null;
  }

  mapSlots(siteData, config) {
    const mapped = {};
    const slots = config.slots || {};

    // Get smart fallbacks for this industry
    const industry = config.id || siteData.industry || 'general';
    const smartFallbacks = resolveSmartFallbacks(siteData, industry);

    for (const [slotName, slotConfig] of Object.entries(slots)) {
      let value = null;

      // Try to get from source path
      if (slotConfig.source) {
        value = this.getByPath(siteData, slotConfig.source);
      }

      // Apply smart fallback if value is empty or placeholder-like
      if (isEmptyOrPlaceholder(value)) {
        // Prefer smart fallback over config fallback
        if (smartFallbacks[slotName]) {
          value = smartFallbacks[slotName];
        } else {
          value = this.interpolateFallback(slotConfig.fallback, siteData);
        }
      }

      // Truncate if needed
      if (slotConfig.maxLength && typeof value === 'string') {
        value = value.slice(0, slotConfig.maxLength);
      }

      mapped[slotName] = value;
      mapped[`${slotName}_aiEnhance`] = slotConfig.aiEnhance || false;
    }

    // Merge ALL smart fallbacks as defaults for any missing slots
    // Smart fallbacks include: headline, subheadline, cta_text, services, why_us_points,
    // section_services, services_subtitle, section_why_us, testimonials_title,
    // section_contact, cta_help, cta_ready, form_name, form_email, form_phone,
    // form_message, btn_send, business_name
    for (const [key, value] of Object.entries(smartFallbacks)) {
      if (mapped[key] === undefined || mapped[key] === null || mapped[key] === '') {
        mapped[key] = value;
      }
      // Handle empty arrays
      if (Array.isArray(mapped[key]) && mapped[key].length === 0 && Array.isArray(value) && value.length > 0) {
        mapped[key] = value;
      }
    }

    return mapped;
  }

  getByPath(obj, pathStr) {
    if (!pathStr) return null;
    // Handle paths like "headlines[0]" or "images[0].src"
    const parts = pathStr.match(/[^.\[\]]+/g);
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }

    return current;
  }

  interpolateFallback(fallback, data) {
    if (typeof fallback !== 'string') return fallback;

    return fallback.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] || key;
    });
  }

  /**
   * Get font pairing for an industry
   */
  getFontPairing(industry) {
    const fontStyle = INDUSTRY_FONTS[industry] || INDUSTRY_FONTS.general;
    return FONT_PAIRINGS[fontStyle] || FONT_PAIRINGS.modern;
  }

  /**
   * Get layout variant for an industry
   */
  getLayoutVariant(industry) {
    const variantName = INDUSTRY_VARIANTS[industry] || INDUSTRY_VARIANTS.general;
    return LAYOUT_VARIANTS[variantName] || LAYOUT_VARIANTS.classic;
  }

  /**
   * Generate variant-specific CSS
   */
  generateVariantCSS(variant) {
    const spacingMap = {
      compact: { section: '3rem', gap: '1.5rem' },
      normal: { section: '5rem', gap: '2rem' },
      relaxed: { section: '6rem', gap: '2.5rem' },
      luxurious: { section: '8rem', gap: '3rem' }
    };

    const radiusMap = {
      sharp: '0.25rem',
      subtle: '0.5rem',
      rounded: '1rem'
    };

    const spacing = spacingMap[variant.sectionSpacing] || spacingMap.normal;
    const radius = radiusMap[variant.borderRadius] || radiusMap.rounded;

    let css = `
      /* Layout Variant: ${variant.name} */
      :root {
        --section-padding: ${spacing.section};
        --grid-gap: ${spacing.gap};
        --border-radius: ${radius};
        --border-radius-lg: calc(${radius} * 1.5);
      }
    `;

    // Hero layout variants
    if (variant.heroLayout === 'centered') {
      css += `
        .hero .container {
          grid-template-columns: 1fr;
          text-align: center;
          max-width: 800px;
        }
        .hero-content { order: 1; }
        .hero-image { order: 2; margin-top: 2rem; }
        .hero h1 { font-size: 3.5rem; }
        .hero p { margin-left: auto; margin-right: auto; }
      `;
    } else if (variant.heroLayout === 'fullwidth') {
      css += `
        .hero {
          position: relative;
          min-height: 80vh;
          display: flex;
          align-items: center;
          background-size: cover;
          background-position: center;
        }
        .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%);
        }
        .hero .container {
          position: relative;
          z-index: 1;
          grid-template-columns: 1fr;
          max-width: 900px;
        }
        .hero h1, .hero p { color: white; }
        .hero h1 { font-size: 4rem; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .hero-image { display: none; }
      `;
    } else if (variant.heroLayout === 'asymmetric') {
      css += `
        .hero .container {
          grid-template-columns: 1.2fr 0.8fr;
          gap: 6rem;
        }
        .hero-image img {
          transform: translateY(2rem);
          box-shadow: -20px 20px 60px rgba(0,0,0,0.15);
        }
      `;
    }

    // Card style variants
    if (variant.cardStyle === 'flat') {
      css += `
        .service-card {
          background: transparent;
          border: 1px solid var(--color-text-light);
          border-opacity: 0.2;
        }
        .service-card:hover {
          transform: none;
          box-shadow: none;
          border-color: var(--color-primary);
        }
      `;
    } else if (variant.cardStyle === 'solid') {
      css += `
        .service-card {
          background: var(--color-primary);
          color: white;
        }
        .service-card p { color: rgba(255,255,255,0.85); }
        .service-card:hover {
          transform: scale(1.02);
        }
      `;
    } else if (variant.cardStyle === 'outlined') {
      css += `
        .service-card {
          background: white;
          border: 2px solid var(--color-surface);
          transition: border-color 0.3s;
        }
        .service-card:hover {
          border-color: var(--color-primary);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
      `;
    }

    // Color intensity variants
    if (variant.colorIntensity === 'muted') {
      css += `
        :root {
          --color-primary: color-mix(in srgb, var(--color-primary) 70%, gray);
        }
        .testimonials-section {
          background: var(--color-surface);
          color: var(--color-text);
        }
      `;
    } else if (variant.colorIntensity === 'vibrant') {
      css += `
        .btn-primary {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
        }
        .cta-banner {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
          color: white;
        }
        .cta-banner h2, .cta-banner p { color: white; }
      `;
    } else if (variant.colorIntensity === 'refined') {
      css += `
        .hero { background: linear-gradient(180deg, var(--color-surface) 0%, white 100%); }
        .service-card { background: white; }
        .testimonials-section {
          background: linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 80%, black) 100%);
        }
      `;
    }

    return css;
  }

  generateCSS(colors, config, industry = 'general') {
    // The design system now provides default colors and typography
    // This method only adds overrides for scraped brand colors when available
    let css = '';

    // If site has scraped colors, use them to override design system defaults
    // This preserves brand identity when the original site had clear branding
    if (colors && typeof colors === 'object') {
      const overrides = [];

      // Only override if we have actual scraped color values
      if (colors.primary && colors.primary !== '#000000') {
        overrides.push(`--color-primary: ${colors.primary}`);
      }
      if (colors.secondary) {
        overrides.push(`--color-secondary: ${colors.secondary}`);
      }
      if (colors.accent) {
        overrides.push(`--color-accent: ${colors.accent}`);
      }

      if (overrides.length > 0) {
        css += `
          /* Scraped brand color overrides */
          :root {
            ${overrides.join(';\n            ')};
          }
        `;
      }
    }

    // Apply typography from design system
    css += `
      body {
        font-family: var(--font-body);
        line-height: var(--line-height-body);
        letter-spacing: var(--letter-spacing-body);
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-heading);
        line-height: var(--line-height-heading);
        letter-spacing: var(--letter-spacing-heading);
      }
    `;

    return css;
  }

  async build(siteData) {
    await this.init();

    const industry = this.detectIndustry(siteData);
    const config = this.industryConfigs[industry] || this.industryConfigs['general'] || { sections: [], slots: {} };
    const slots = this.mapSlots(siteData, config);

    // Get design system personality for this industry
    const designSystem = getDesignSystem(industry);
    const personality = designSystem.selectPersonality(siteData);
    const designConfig = designSystem.personalities[personality] || designSystem.personalities[designSystem.defaultPersonality];

    // Apply design system to slots
    slots.heroVariant = designConfig.heroStyle || 'split';
    slots.cardStyle = designConfig.cardStyle || 'bordered';
    slots.sectionDivider = designConfig.sectionDivider || 'wave';
    slots.buttonStyle = designConfig.buttonStyle || 'solid';
    slots.animationStyle = designConfig.animations || 'professional';
    slots.spacingStyle = designConfig.spacing || 'normal';
    slots.shadowStyle = designConfig.shadows || 'medium';
    slots.personality = personality;
    slots.variantName = personality;
    slots.year = new Date().getFullYear();

    // Emergency service flag for urgency indicators in hero
    const EMERGENCY_INDUSTRIES = ['plumber', 'electrician', 'hvac', 'roofing', 'home-services'];
    slots.isEmergencyService = EMERGENCY_INDUSTRIES.includes(industry);

    // Store design config for CSS generation
    siteData._designConfig = designConfig;
    siteData._personality = personality;

    // Build HTML from sections
    const sections = (config.sections || []).map(section => {
      const component = this.components[section];
      if (!component) return '';
      try {
        return component({ ...siteData, ...slots });
      } catch (error) {
        log.debug(`Failed to render section ${section}`, { error: error.message });
        return '';
      }
    });

    // Generate CSS with industry-specific fonts
    const customCSS = this.generateCSS(siteData.colors || [], config, industry);

    // Load base CSS
    let baseCSS = '';
    try {
      baseCSS = await fs.readFile(path.join(this.templatesDir, 'base/styles.css'), 'utf-8');
    } catch (error) {
      log.debug('Using default CSS - base styles.css not found');
      baseCSS = this.getDefaultCSS();
    }

    // Assemble final HTML with font pairing
    const html = this.assembleHTML(siteData, slots, sections, baseCSS, customCSS, industry);

    return {
      html,
      industry,
      slots,
      needsAiPolish: Object.entries(slots)
        .filter(([k]) => slots[`${k}_aiEnhance`])
        .map(([k]) => k)
    };
  }

  /**
   * Resolve icon names to actual SVG HTML in slots
   */
  resolveIcons(slots) {
    const resolved = { ...slots };

    // Process services array - resolve icon names to SVG
    if (Array.isArray(resolved.services)) {
      resolved.services = resolved.services.map(service => {
        if (typeof service === 'object') {
          const iconName = service.icon || detectIcon(service.name);
          return {
            ...service,
            icon: getIcon(iconName) // Replace icon name with actual SVG
          };
        }
        return {
          name: service,
          icon: getIcon(detectIcon(service))
        };
      });
    }

    // Process why_us_points array
    if (Array.isArray(resolved.why_us_points)) {
      resolved.why_us_points = resolved.why_us_points.map(point => {
        const iconName = point.icon || detectIcon(point.title);
        return {
          ...point,
          icon: getIcon(iconName)
        };
      });
    }

    // Flatten trust signals for template access
    const trust = resolved.trustSignals || {};
    if (trust.yearsInBusiness && !resolved.years_in_business) {
      resolved.years_in_business = trust.yearsInBusiness;
    }
    if (trust.customerCount && !resolved.customer_count) {
      resolved.customer_count = trust.customerCount;
    }

    // Process testimonials - add initials and relative dates for display
    if (Array.isArray(resolved.testimonials)) {
      const relativeDates = ['2 weeks ago', '1 month ago', '3 weeks ago', '1 week ago', '2 months ago'];
      resolved.testimonials = resolved.testimonials.map((t, i) => {
        const author = t.author || 'Customer';
        const initial = author.charAt(0).toUpperCase();
        return {
          ...t,
          initial,
          relative_date: t.relative_date || relativeDates[i % relativeDates.length]
        };
      });
    }

    return resolved;
  }

  async buildWithSlots(siteData, polishedSlots) {
    await this.init();

    const industry = siteData.industry || this.detectIndustry(siteData);
    const config = this.industryConfigs[industry] || this.industryConfigs['general'] || { sections: [], slots: {} };

    // Get design system personality for this industry
    const designSystem = getDesignSystem(industry);
    const personality = siteData._personality || designSystem.selectPersonality(siteData);
    const designConfig = siteData._designConfig || designSystem.personalities[personality] || designSystem.personalities[designSystem.defaultPersonality];

    // Emergency service flag for urgency indicators in hero
    const EMERGENCY_INDUSTRIES = ['plumber', 'electrician', 'hvac', 'roofing', 'home-services'];

    // Helper function to check for emergency keywords in scraped content
    const checkEmergencyKeywords = (siteData) => {
      const text = [
        siteData.headline || '',
        siteData.subheadline || '',
        siteData.aboutText || '',
        ...(siteData.services || []).map(s => typeof s === 'string' ? s : s.name || '')
      ].join(' ').toLowerCase();
      return /24\s*\/?\s*7|emergency|after.hours|urgent|same.day/i.test(text);
    };

    // Helper to check for Licensed & Insured mention
    const checkLicensedAndInsured = (siteData) => {
      const text = [
        siteData.headline || '',
        siteData.subheadline || '',
        siteData.aboutText || '',
        ...(siteData.services || []).map(s => typeof s === 'string' ? s : s.name || ''),
        ...(siteData.paragraphs || [])
      ].join(' ').toLowerCase();
      return /licen[sc]ed|insured|bonded/i.test(text);
    };

    // Data availability flags for conditional template sections
    const dataFlags = {
      hasCaseResults: !!(siteData.caseResults?.length || siteData.trustSignals?.settlements),
      hasMenuItems: !!(siteData.menuItems?.length),
      hasBeforeAfterImages: !!(siteData.beforeAfterImages?.length || siteData.smile_cases?.length),
      isVerifiedEmergency: checkEmergencyKeywords(siteData),
      hasRealEstateListings: !!(siteData.listings?.length),
      hasSalonPortfolio: !!(siteData.portfolio_items?.length),
      isLicensedAndInsured: checkLicensedAndInsured(siteData)
    };

    // Resolve icon names to actual SVG HTML and add design system info with layout tokens
    const slotsWithIcons = {
      ...this.resolveIcons(polishedSlots),
      ...dataFlags,
      heroVariant: designConfig.heroStyle || 'split',
      cardStyle: designConfig.cardStyle || 'bordered',
      sectionDivider: designConfig.sectionDivider || 'wave',
      buttonStyle: designConfig.buttonStyle || 'solid',
      animationStyle: designConfig.animations || 'professional',
      spacingStyle: designConfig.spacing || 'normal',
      shadowStyle: designConfig.shadows || 'medium',
      // Layout differentiation tokens
      heroLayout: designConfig.heroLayout || 'centered',
      cardStyleVariant: designConfig.cardStyleVariant || 'elevated',
      buttonStyleVariant: designConfig.buttonStyleVariant || 'solid',
      animationIntensity: designConfig.animationIntensity || 'moderate',
      sectionSpacing: designConfig.sectionSpacing || 'normal',
      personality,
      variantName: personality,
      isEmergencyService: EMERGENCY_INDUSTRIES.includes(industry)
    };

    // Store for CSS generation
    siteData._designConfig = designConfig;
    siteData._personality = personality;

    // Build HTML from sections with resolved icons
    const sections = (config.sections || []).map(section => {
      const component = this.components[section];
      if (!component) return '';
      try {
        return component({ ...siteData, ...slotsWithIcons });
      } catch (error) {
        log.debug(`Failed to render section ${section}`, { error: error.message });
        return '';
      }
    });

    // Generate CSS with industry-specific fonts
    const customCSS = this.generateCSS(siteData.colors || [], config, industry);

    // Load base CSS
    let baseCSS = '';
    try {
      baseCSS = await fs.readFile(path.join(this.templatesDir, 'base/styles.css'), 'utf-8');
    } catch (error) {
      log.debug('Using default CSS - base styles.css not found');
      baseCSS = this.getDefaultCSS();
    }

    return this.assembleHTML(siteData, polishedSlots, sections, baseCSS, customCSS, industry);
  }

  assembleHTML(siteData, slots, sections, baseCSS, customCSS, industry = 'general') {
    const title = slots.business_name || siteData.businessName || 'Website Preview';
    const description = slots.subheadline || siteData.description || '';
    const language = siteData.language || 'en';

    // Get design system configuration
    const designSystem = getDesignSystem(industry);
    const personality = siteData._personality || designSystem.defaultPersonality;
    const designConfig = siteData._designConfig || designSystem.personalities[personality];

    // Generate design system CSS with colors, typography, and design tokens
    const designSystemCSS = generateDesignCSS(industry, personality);

    // Get the font pairing from the design system
    const fonts = getDesignFontPairing(designConfig.typography);
    const googleFontsUrl = `https://fonts.googleapis.com/css2?${fonts.googleFonts}&display=swap`;

    // Get hero image for hero backgrounds
    const heroImage = siteData.images?.[0]?.src || '';
    const heroVariant = designConfig.heroStyle || slots.heroVariant || 'split';
    const heroNeedsBackground = ['fullwidth', 'fullwidth-dark', 'diagonal-split', 'stacked'].includes(heroVariant);
    const heroStyle = heroNeedsBackground && heroImage
      ? `style="--hero-bg-image: url('${heroImage}')"`
      : '';

    // Build body classes for design system hooks with layout variants
    const heroLayout = designConfig.heroLayout || 'centered';
    const cardStyleVariant = designConfig.cardStyleVariant || 'elevated';
    const buttonStyleVariant = designConfig.buttonStyleVariant || 'solid';
    const animationIntensity = designConfig.animationIntensity || 'moderate';
    const sectionSpacing = designConfig.sectionSpacing || 'normal';

    const bodyClasses = [
      `hero-${heroVariant}`,
      `hero--${heroLayout}`,
      `card-${designConfig.cardStyle || 'bordered'}`,
      `card-${cardStyleVariant}`,
      `spacing-${designConfig.spacing || 'normal'}`,
      `shadows-${designConfig.shadows || 'medium'}`,
      `animations-${designConfig.animations || 'professional'}`,
      `divider-${designConfig.sectionDivider || 'wave'}`,
      `btn-style-${designConfig.buttonStyle || 'solid'}`,
      `btn-style-${buttonStyleVariant}`,
      `personality-${personality}`
    ].join(' ');

    // Build data attributes for CSS hooks
    const bodyDataAttrs = `data-hero-layout="${heroLayout}" data-card-style="${cardStyleVariant}" data-btn-style="${buttonStyleVariant}" data-animation="${animationIntensity}" data-spacing="${sectionSpacing}"`;

    // Generate JSON-LD structured data
    const jsonLd = this.generateStructuredData(siteData, slots);

    // Generate social meta tags (OG, Twitter, canonical)
    const socialMeta = this.generateSocialMeta(siteData, slots, heroImage);

    // Combine and minify CSS for performance
    // Order: base CSS → design system CSS (overrides) → custom CSS (specific overrides)
    const combinedCSS = `${baseCSS}\n${designSystemCSS}\n${customCSS}`;
    const minifiedCSS = this.minifyCSS(combinedCSS);

    // Build sticky mobile CTA HTML
    const phone = siteData.phone || slots.phone || '';
    const ctaText = slots.cta_text || 'Get a Quote';
    const stickyCta = phone ? `
<div class="mobile-sticky-cta" aria-label="Quick contact">
  <a href="tel:${phone.replace(/[^+\d]/g, '')}" class="sticky-phone">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
    ${phone}
  </a>
  <a href="#contact" class="sticky-cta-btn">${ctaText}</a>
</div>` : '';

    // Add section dividers between sections
    const sectionDividerType = designConfig.sectionDivider || 'wave';
    const sectionsHtml = this.addSectionDividers(sections.join('\n'), sectionDividerType);

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${socialMeta}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}" rel="stylesheet">
  <style>${minifiedCSS}</style>
  ${jsonLd}
</head>
<body class="${bodyClasses}" ${bodyDataAttrs}>
<main id="main-content">
${sectionsHtml.replace('<section class="hero"', `<section class="hero hero--${heroLayout}" ${heroStyle}`)}
</main>
${stickyCta}
${this.getMobileMenuScript()}
${this.getScrollAnimationScript()}
${this.getGalleryLightboxScript()}
${this.getAnalyticsScript()}
</body>
</html>`;
  }

  /**
   * Add section divider classes between sections for smooth visual transitions
   * Uses wave dividers for most transitions, diagonal before CTA sections
   */
  addSectionDividers(sectionsHtml, dividerType = 'wave') {
    // Map of section classes to the divider type they should use
    const dividerMap = {
      'cta-banner': 'diagonal',
      'contact-section': 'wave',
      'testimonials-section': 'curve',
      'services-section': 'wave',
      'why-us-section': 'wave',
      'pricing-section': 'wave',
      'faq-section': 'wave',
      'gallery-section': 'wave',
      'team-section': 'wave',
      'locations-section': 'wave'
    };

    // Add divider class to sections that precede another section
    // We insert the divider on the preceding section so the transition flows into the next
    return sectionsHtml.replace(
      /(<section\s+class="([^"]*)")/g,
      (match, fullTag, classes) => {
        // Don't add divider to hero, footer, or sections that already have dividers
        if (classes.includes('hero') || classes.includes('site-footer') || classes.includes('section-divider')) {
          return match;
        }
        // Use divider type from map or the default
        const sectionType = Object.keys(dividerMap).find(key => classes.includes(key));
        const chosenDivider = sectionType ? dividerMap[sectionType] : dividerType;
        return `<section class="${classes} section-divider--${chosenDivider}"`;
      }
    );
  }

  /**
   * Generate Schema.org LocalBusiness structured data
   */
  generateStructuredData(siteData, slots) {
    const businessName = slots.business_name || siteData.businessName || '';
    const description = slots.subheadline || siteData.description || '';
    const phone = siteData.phone || slots.phone || '';
    const email = siteData.email || slots.email || '';
    const address = siteData.address || slots.address || '';
    const hours = siteData.hours || slots.hours || '';
    const heroImage = siteData.images?.[0]?.src || '';
    const url = siteData.originalUrl || '';

    // Build services array for JSON-LD (filter nullish values first)
    const services = (slots.services || siteData.services || [])
      .filter(s => s != null)
      .map(s => typeof s === 'string' ? s : s.name)
      .filter(Boolean);

    const schema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": businessName,
      "description": description
    };

    if (url) schema.url = url;
    if (phone) schema.telephone = phone;
    if (email) schema.email = email;
    if (heroImage) schema.image = heroImage;
    if (address) {
      schema.address = {
        "@type": "PostalAddress",
        "streetAddress": address
      };
    }
    if (hours) {
      schema.openingHours = hours;
    }
    if (services.length > 0) {
      schema.makesOffer = services.map(service => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": service
        }
      }));
    }

    // Add aggregate rating if available
    if (siteData.rating || slots.rating) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": siteData.rating || slots.rating,
        "reviewCount": siteData.review_count || slots.review_count || "50"
      };
    }

    // Escape </script> sequences to prevent XSS attacks
    // Replace </ with <\/ which is valid JSON and prevents script tag injection
    const safeJson = JSON.stringify(schema, null, 2)
      .replace(/<\//g, '<\\/');

    return `<script type="application/ld+json">
${safeJson}
</script>`;
  }

  /**
   * Generate Open Graph, Twitter Card, and other social meta tags
   */
  generateSocialMeta(siteData, slots, heroImage) {
    const businessName = slots.business_name || siteData.businessName || '';
    const description = slots.subheadline || siteData.description || '';
    const tagline = slots.headline || siteData.headline || '';
    const originalUrl = siteData.originalUrl || '';
    const previewUrl = siteData.previewUrl || '';
    const primaryColor = siteData.colors?.primary || '#2563eb';

    // Escape values for HTML attributes
    const escapeAttr = (str) => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const ogTitle = escapeAttr(tagline ? `${businessName} - ${tagline}` : businessName);
    const ogDescription = escapeAttr(description);
    const ogImage = escapeAttr(heroImage);
    const ogUrl = escapeAttr(previewUrl || originalUrl);
    const siteName = escapeAttr(businessName);
    const canonical = escapeAttr(originalUrl);
    const themeColor = escapeAttr(primaryColor);

    const tags = [];

    // Open Graph tags
    tags.push(`<meta property="og:type" content="website">`);
    if (ogTitle) tags.push(`<meta property="og:title" content="${ogTitle}">`);
    if (ogDescription) tags.push(`<meta property="og:description" content="${ogDescription}">`);
    if (ogImage) tags.push(`<meta property="og:image" content="${ogImage}">`);
    if (ogUrl) tags.push(`<meta property="og:url" content="${ogUrl}">`);
    if (siteName) tags.push(`<meta property="og:site_name" content="${siteName}">`);

    // Twitter Card tags
    tags.push(`<meta name="twitter:card" content="summary_large_image">`);
    if (ogTitle) tags.push(`<meta name="twitter:title" content="${ogTitle}">`);
    if (ogDescription) tags.push(`<meta name="twitter:description" content="${ogDescription}">`);
    if (ogImage) tags.push(`<meta name="twitter:image" content="${ogImage}">`);

    // Canonical URL
    if (canonical) tags.push(`<link rel="canonical" href="${canonical}">`);

    // Theme color for mobile browsers
    if (themeColor) tags.push(`<meta name="theme-color" content="${themeColor}">`);

    // Robots meta (allow indexing)
    tags.push(`<meta name="robots" content="index, follow">`);

    return tags.join('\n  ');
  }

  /**
   * Minify CSS for production output
   * Reduces file size by ~60-70% typically
   */
  minifyCSS(css) {
    try {
      const cleanCSS = new CleanCSS({
        level: {
          1: {
            specialComments: 0  // Remove all comments
          },
          2: {
            mergeMedia: true,   // Merge @media rules
            mergeIntoShorthands: true,
            mergeNonAdjacentRules: true,
            removeDuplicateRules: true
          }
        }
      });

      const result = cleanCSS.minify(css);

      if (result.errors && result.errors.length > 0) {
        log.warn('CSS minification errors', { errors: result.errors });
        return css; // Return original on error
      }

      const savings = css.length - result.styles.length;
      const savingsPercent = ((savings / css.length) * 100).toFixed(1);
      log.debug('CSS minified', {
        original: `${(css.length / 1024).toFixed(1)}KB`,
        minified: `${(result.styles.length / 1024).toFixed(1)}KB`,
        savings: `${savingsPercent}%`
      });

      return result.styles;
    } catch (error) {
      log.warn('CSS minification failed, using original', { error: error.message });
      return css;
    }
  }

  /**
   * Generate mobile menu JavaScript
   */
  getMobileMenuScript() {
    return `<script>
(function() {
  // Mobile menu toggle
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const mobileNav = document.querySelector('.mobile-nav');
  const closeBtn = document.querySelector('.mobile-nav-close');

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function() {
      mobileNav.classList.add('active');
      mobileNav.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });

    function closeMenu() {
      mobileNav.classList.remove('active');
      mobileNav.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    // Close on backdrop click
    mobileNav.addEventListener('click', function(e) {
      if (e.target === mobileNav) {
        closeMenu();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
        closeMenu();
      }
    });

    // Close on nav link click
    mobileNav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
</script>`;
  }

  /**
   * Generate scroll animation JavaScript
   */
  getScrollAnimationScript() {
    return `<script>
(function() {
  // Check for reduced motion preference
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // --- Staggered Scroll Animations ---
  var staggerContainers = [
    { parent: '.services-grid', child: '.service-card' },
    { parent: '.why-us-grid', child: '.why-us-item' },
    { parent: '.testimonials-grid', child: '.testimonial' },
    { parent: '.team-grid', child: '.team-card' },
    { parent: '.gallery-grid', child: '.gallery-item' },
    { parent: '.pricing-grid', child: '.pricing-card' },
    { parent: '.faq-list', child: '.faq-item' },
    { parent: '.locations-grid', child: '.location-card' },
    { parent: '.menu-grid', child: '.menu-item' },
    { parent: '.results-stats', child: '.stat-card' },
    { parent: '.ba-grid', child: '.ba-card' },
    { parent: '.portfolio-grid', child: '.portfolio-item' },
    { parent: '.listings-grid', child: '.listing-card' }
  ];

  // Apply stagger-child class with delay custom properties
  staggerContainers.forEach(function(cfg) {
    document.querySelectorAll(cfg.parent).forEach(function(container) {
      var children = container.querySelectorAll(cfg.child);
      children.forEach(function(child, i) {
        child.classList.add('stagger-child');
        child.style.setProperty('--stagger-delay', (i * 0.1) + 's');
      });
    });
  });

  // Standalone elements that fade in without stagger
  var standAloneSelectors = [
    '.contact-info',
    '.contact-form',
    '.cta-banner .container',
    '.about-content',
    '.portfolio-item',
    '.trust-stack',
    '.social-proof-counters'
  ];
  standAloneSelectors.forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el) {
      if (!el.classList.contains('stagger-child')) {
        el.classList.add('scroll-fade-up');
      }
    });
  });

  // Section headings and subtitles get scroll reveal
  document.querySelectorAll(
    '.services-section h2, .why-us-section h2, .testimonials-section h2, ' +
    '.contact-section h2, .team-section h2, .gallery-section h2, ' +
    '.pricing-section h2, .faq-section h2, .locations-section h2, ' +
    '.section-subtitle'
  ).forEach(function(el) {
    el.classList.add('scroll-fade-up');
  });

  // Legacy: also add fade-in-up for backward compat
  var legacySelectors = [
    '.service-card', '.why-us-item', '.testimonial',
    '.contact-info', '.contact-form', '.team-card',
    '.gallery-item', '.pricing-card', '.faq-item', '.location-card'
  ];
  legacySelectors.forEach(function(selector) {
    document.querySelectorAll(selector).forEach(function(el) {
      el.classList.add('fade-in-up');
    });
  });

  // --- IntersectionObserver for all scroll-triggered elements ---
  var scrollObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        entry.target.classList.add('visible');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll(
    '.scroll-fade-up, .scroll-slide-left, .scroll-slide-right, ' +
    '.scroll-scale-in, .scroll-reveal, .stagger-child, .fade-in-up, .stat-counter'
  ).forEach(function(el) {
    scrollObserver.observe(el);
  });

  // --- Stat Number Counter Animation ---
  function animateCounter(el) {
    var text = el.textContent.trim();
    var match = text.match(/^([\\$]?)(\\d+)(\\+|%|\\s|$|K|\\+?\\s*Years?|\\+?\\s*Customers?)/i);
    if (!match) return;

    var prefix = match[1] || '';
    var target = parseInt(match[2], 10);
    var suffix = match[3] || '';
    var rest = text.slice(match[0].length);

    if (isNaN(target) || target <= 0) return;

    el.textContent = prefix + '0' + suffix + rest;

    var duration = Math.min(2000, Math.max(800, target * 20));
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(eased * target);
      el.textContent = prefix + current + suffix + rest;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = prefix + target + suffix + rest;
      }
    }

    requestAnimationFrame(step);
  }

  var statObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.why-us-item h3, .stat-number, [data-counter]').forEach(function(el) {
    if (/^[\\$]?\\d+/.test(el.textContent.trim())) {
      el.classList.add('stat-counter');
      statObserver.observe(el);
    }
  });

  // --- Parallax Scroll Effect for Hero ---
  var heroImages = document.querySelectorAll('.hero-image img');
  var heroSection = document.querySelector('.hero');

  if (heroImages.length > 0 && heroSection) {
    var parallaxTicking = false;
    function updateParallax() {
      var scrollY = window.scrollY || window.pageYOffset;
      var heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
      if (scrollY < heroBottom) {
        var rate = scrollY * 0.3;
        heroImages.forEach(function(el) {
          el.style.transform = 'translateY(' + rate + 'px) scale(1.05)';
        });
      }
      parallaxTicking = false;
    }

    window.addEventListener('scroll', function() {
      if (!parallaxTicking) {
        requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    }, { passive: true });
  }

  // --- Sticky Mobile CTA ---
  var stickyCta = document.querySelector('.mobile-sticky-cta');
  if (stickyCta && heroSection) {
    var stickyObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          stickyCta.classList.remove('is-visible');
          document.body.classList.remove('has-sticky-cta');
        } else {
          stickyCta.classList.add('is-visible');
          document.body.classList.add('has-sticky-cta');
        }
      });
    }, { threshold: 0 });

    stickyObserver.observe(heroSection);
  }

  // --- Button Ripple Effect ---
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn-primary, .contact-form button, .sticky-cta-btn');
    if (!btn) return;

    var rect = btn.getBoundingClientRect();
    var ripple = document.createElement('span');
    var size = Math.max(rect.width, rect.height) * 2;

    ripple.style.cssText = 'position:absolute;border-radius:50%;background:rgba(255,255,255,0.3);pointer-events:none;' +
      'width:' + size + 'px;height:' + size + 'px;' +
      'left:' + (e.clientX - rect.left - size / 2) + 'px;' +
      'top:' + (e.clientY - rect.top - size / 2) + 'px;' +
      'transform:scale(0);animation:rippleExpand 0.6s ease-out forwards;';

    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);

    setTimeout(function() {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 700);
  });

  // --- CTA Pulse after delay ---
  setTimeout(function() {
    var heroCta = document.querySelector('.hero .btn-primary');
    if (heroCta) {
      heroCta.classList.add('pulse');
    }
  }, 3000);
})();
</script>`;
  }

  /**
   * Generate gallery lightbox JavaScript
   */
  getGalleryLightboxScript() {
    return `<script>
(function() {
  var lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  var lightboxImg = document.getElementById('lightbox-image');
  var lightboxCaption = document.getElementById('lightbox-caption');
  var galleryItems = document.querySelectorAll('.gallery-item');
  var currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    var item = galleryItems[index];
    var img = item.querySelector('img');
    var caption = item.querySelector('.gallery-caption');

    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = caption ? caption.textContent : '';

    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % galleryItems.length;
    openLightbox(currentIndex);
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    openLightbox(currentIndex);
  }

  // Click handlers
  galleryItems.forEach(function(item, index) {
    item.addEventListener('click', function() {
      openLightbox(index);
    });
  });

  var closeBtn = lightbox.querySelector('.lightbox-close');
  var prevBtn = lightbox.querySelector('.lightbox-prev');
  var nextBtn = lightbox.querySelector('.lightbox-next');

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', showPrev);
  if (nextBtn) nextBtn.addEventListener('click', showNext);

  // Close on backdrop click
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });
})();
</script>`;
  }

  /**
   * Generate analytics tracking script
   * Tracks pageviews, scroll depth, CTA clicks, form interactions, time on page
   */
  getAnalyticsScript() {
    return `<script>
(function() {
  // Extract slug from URL path
  var pathMatch = window.location.pathname.match(/\\/preview\\/([^/]+)/);
  if (!pathMatch) return;
  var slug = pathMatch[1];

  // Generate session ID
  var sessionId = sessionStorage.getItem('_si_session');
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('_si_session', sessionId);
  }

  var startTime = Date.now();
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };

  function sendEvent(type, data) {
    fetch('/api/preview/' + slug + '/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, data: data, sessionId: sessionId })
    }).catch(function() {});
  }

  // Track pageview
  sendEvent('pageview', { referrer: document.referrer });

  // Track scroll depth
  function trackScroll() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var scrollPercent = Math.round((scrollTop / docHeight) * 100);

    [25, 50, 75, 100].forEach(function(milestone) {
      if (scrollPercent >= milestone && !scrollMilestones[milestone]) {
        scrollMilestones[milestone] = true;
        sendEvent('scroll', { depth: milestone });
      }
    });
  }

  var scrollTimeout;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(trackScroll, 100);
  });

  // Track CTA clicks
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a, button');
    if (!target) return;

    var clickData = {};
    var href = target.getAttribute('href') || '';

    if (href.startsWith('tel:')) {
      clickData = { target: 'phone', href: href };
    } else if (href.startsWith('mailto:')) {
      clickData = { target: 'email', href: href };
    } else if (target.classList.contains('btn-primary') || target.classList.contains('header-cta')) {
      clickData = { target: 'cta', text: target.textContent.trim().slice(0, 50) };
    } else if (target.closest('.main-nav, .mobile-nav-links')) {
      clickData = { target: 'nav', href: href };
    }

    if (clickData.target) {
      sendEvent('click', clickData);
    }
  });

  // Track form interactions
  var contactForm = document.querySelector('form[name="contact"], .contact-form form');
  if (contactForm) {
    var formFocused = false;
    contactForm.addEventListener('focusin', function() {
      if (!formFocused) {
        formFocused = true;
        sendEvent('form', { action: 'focus' });
      }
    });
    contactForm.addEventListener('submit', function() {
      sendEvent('form', { action: 'submit' });
    });
  }

  // Track time on page
  function sendTimeOnPage() {
    var seconds = Math.round((Date.now() - startTime) / 1000);
    if (seconds > 0) {
      navigator.sendBeacon('/api/preview/' + slug + '/event',
        JSON.stringify({ type: 'time', data: { seconds: seconds }, sessionId: sessionId })
      );
    }
  }

  window.addEventListener('beforeunload', sendTimeOnPage);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') sendTimeOnPage();
  });
})();
</script>`;
  }

  getDefaultCSS() {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Nunito', 'Quicksand', system-ui, -apple-system, sans-serif;
  color: var(--color-text, #292524);
  line-height: 1.7;
  background: var(--color-background, #fffbf7);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Header */
.site-header {
  padding: 1rem 0;
  position: sticky;
  top: 0;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  z-index: 100;
}

.site-header .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo img {
  height: 40px;
  width: auto;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.main-nav {
  display: flex;
  gap: 2rem;
}

.main-nav a {
  color: var(--color-text);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.main-nav a:hover {
  color: var(--color-primary);
}

.header-cta {
  background: var(--color-primary);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.2s, box-shadow 0.2s;
}

.header-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* Hero */
.hero {
  padding: 5rem 0;
  background: var(--color-surface);
}

.hero .container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.hero h1 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-text);
  line-height: 1.2;
}

.hero p {
  font-size: 1.25rem;
  color: var(--color-text-light);
  margin-bottom: 2rem;
  max-width: 600px;
}

.hero-image img {
  width: 100%;
  height: auto;
  border-radius: 1rem;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.btn-primary {
  display: inline-block;
  background: var(--color-primary);
  color: white;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* Services Grid */
.services-section {
  padding: 5rem 0;
}

.services-section h2 {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 1rem;
}

.services-section > p {
  text-align: center;
  color: var(--color-text-light);
  margin-bottom: 3rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.service-card {
  padding: 2rem;
  background: var(--color-surface);
  border-radius: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.service-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}

.service-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.service-card h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.service-card p {
  color: var(--color-text-light);
}

/* Testimonials */
.testimonials-section {
  padding: 5rem 0;
  background: var(--color-primary);
  color: white;
}

.testimonials-section h2 {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 3rem;
}

.testimonials-slider {
  max-width: 700px;
  margin: 0 auto;
}

.testimonial {
  text-align: center;
  padding: 2rem;
}

.testimonial p {
  font-size: 1.25rem;
  font-style: italic;
  margin-bottom: 1.5rem;
  line-height: 1.8;
}

.testimonial cite {
  font-style: normal;
  font-weight: 600;
  opacity: 0.9;
}

/* Contact */
.contact-section {
  padding: 5rem 0;
}

.contact-section h2 {
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  max-width: 900px;
  margin: 0 auto;
}

.contact-info p {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* CTA Banner */
.cta-banner {
  padding: 4rem 0;
  background: var(--color-surface);
  text-align: center;
}

.cta-banner h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.cta-banner p {
  color: var(--color-text-light);
  margin-bottom: 2rem;
}

/* Footer */
.site-footer {
  padding: 3rem 0;
  background: var(--color-text);
  color: white;
}

.site-footer .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-links {
  display: flex;
  gap: 2rem;
}

.footer-links a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
}

.footer-links a:hover {
  color: white;
}

/* Mobile-first: base styles are mobile, larger screens scale up */
.hero .container { grid-template-columns: 1fr; }
.hero-image { order: -1; }
.main-nav { display: none; }
.contact-grid { grid-template-columns: 1fr; }
.site-footer .container { flex-direction: column; gap: 1rem; text-align: center; }

@media (min-width: 768px) {
  .hero h1 { font-size: 3rem; }
  .hero .container { grid-template-columns: 1fr 1fr; }
  .hero-image { order: initial; }
  .main-nav { display: flex; }
  .contact-grid { grid-template-columns: 1fr 1fr; }
  .site-footer .container { flex-direction: row; text-align: left; }
}
    `;
  }
}

export default TemplateBuilder;
