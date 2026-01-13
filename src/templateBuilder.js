// src/templateBuilder.js
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { ICONS, getIcon, detectIcon } from '../templates/base/icons.js';

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
  lawyer: 'elegant',
  'real-estate': 'professional',
  restaurant: 'friendly',
  retail: 'friendly',
  plumber: 'bold',
  electrician: 'bold',
  'home-services': 'bold',
  dentist: 'professional',
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
  lawyer: 'elegant',
  'real-estate': 'minimal',
  restaurant: 'bold',
  retail: 'classic',
  plumber: 'bold',
  electrician: 'bold',
  'home-services': 'classic',
  dentist: 'minimal',
  general: 'classic'
};

// Handle both ESM and bundled CJS environments
const __dirname = import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : process.cwd();

export class TemplateBuilder {
  constructor(templatesDir = null) {
    this.templatesDir = templatesDir || path.join(__dirname, '../templates');
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
    } catch (error) {
      log.warn('Could not load components', { error: error.message });
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
    } catch (error) {
      log.warn('Could not load industry configs', { error: error.message });
    }

    this.initialized = true;
  }

  detectIndustry(siteData) {
    const text = [
      siteData.businessName || '',
      ...(siteData.headlines || []),
      ...(siteData.paragraphs || []),
      siteData.title || '',
      siteData.description || ''
    ].join(' ').toLowerCase();

    let bestMatch = { industry: 'general', score: 0 };

    for (const [industry, config] of Object.entries(this.industryConfigs)) {
      const matches = (config.keywords || []).filter(kw => text.includes(kw.toLowerCase()));
      if (matches.length > bestMatch.score) {
        bestMatch = { industry, score: matches.length };
      }
    }

    return bestMatch.industry;
  }

  mapSlots(siteData, config) {
    const mapped = {};
    const slots = config.slots || {};

    for (const [slotName, slotConfig] of Object.entries(slots)) {
      let value = null;

      // Try to get from source path
      if (slotConfig.source) {
        value = this.getByPath(siteData, slotConfig.source);
      }

      // Apply fallback if needed
      if (!value || (Array.isArray(value) && value.length === 0)) {
        value = this.interpolateFallback(slotConfig.fallback, siteData);
      }

      // Truncate if needed
      if (slotConfig.maxLength && typeof value === 'string') {
        value = value.slice(0, slotConfig.maxLength);
      }

      mapped[slotName] = value;
      mapped[`${slotName}_aiEnhance`] = slotConfig.aiEnhance || false;
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
    const colorMapping = config.colorMapping || {};
    const fallback = colorMapping.fallback || {
      primary: '#1e40af',
      secondary: '#3b82f6',
      accent: '#f97316'
    };

    const palette = {};
    for (const [name, source] of Object.entries(colorMapping)) {
      if (name === 'fallback') continue;
      palette[name] = this.getByPath({ colors }, source) || fallback[name];
    }

    // Ensure we have all colors
    palette.primary = palette.primary || fallback.primary;
    palette.secondary = palette.secondary || fallback.secondary;
    palette.accent = palette.accent || fallback.accent;

    // Get font pairing
    const fonts = this.getFontPairing(industry);

    return `
      :root {
        --color-primary: ${palette.primary};
        --color-secondary: ${palette.secondary};
        --color-accent: ${palette.accent};
        --color-text: #1f2937;
        --color-text-light: #6b7280;
        --color-background: #ffffff;
        --color-surface: #f9fafb;
        --font-heading: ${fonts.heading};
        --font-body: ${fonts.body};
      }
      body {
        font-family: var(--font-body);
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-heading);
      }
    `;
  }

  async build(siteData) {
    await this.init();

    const industry = this.detectIndustry(siteData);
    const config = this.industryConfigs[industry] || this.industryConfigs['general'] || { sections: [], slots: {} };
    const slots = this.mapSlots(siteData, config);

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

    return resolved;
  }

  async buildWithSlots(siteData, polishedSlots) {
    await this.init();

    const industry = siteData.industry || this.detectIndustry(siteData);
    const config = this.industryConfigs[industry] || this.industryConfigs['general'] || { sections: [], slots: {} };

    // Resolve icon names to actual SVG HTML
    const slotsWithIcons = this.resolveIcons(polishedSlots);

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

    // Get the appropriate Google Fonts URL for this industry
    const fonts = this.getFontPairing(industry);
    const googleFontsUrl = `https://fonts.googleapis.com/css2?${fonts.googleFonts}&display=swap`;

    // Get layout variant CSS
    const variant = this.getLayoutVariant(industry);
    const variantCSS = this.generateVariantCSS(variant);

    // Get hero image for fullwidth variant background
    const heroImage = siteData.images?.[0]?.src;
    const heroStyle = variant.heroLayout === 'fullwidth' && heroImage
      ? `style="background-image: url('${heroImage}');"`
      : '';

    // Add variant class to body for additional styling hooks
    const variantClass = `variant-${variant.name.toLowerCase()}`;

    // Generate JSON-LD structured data
    const jsonLd = this.generateStructuredData(siteData, slots);

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}" rel="stylesheet">
  <style>
${baseCSS}
${customCSS}
${variantCSS}
  </style>
  ${jsonLd}
</head>
<body class="${variantClass}">
<main id="main-content">
${sections.join('\n').replace('<section class="hero"', `<section class="hero" ${heroStyle}`)}
</main>
${this.getMobileMenuScript()}
${this.getScrollAnimationScript()}
</body>
</html>`;
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
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Add fade-in-up class to animatable elements
  const animatableSelectors = [
    '.service-card',
    '.why-us-item',
    '.testimonial',
    '.contact-info',
    '.contact-form'
  ];

  animatableSelectors.forEach(function(selector) {
    document.querySelectorAll(selector).forEach(function(el) {
      el.classList.add('fade-in-up');
    });
  });

  // Intersection Observer for scroll animations
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll('.fade-in-up').forEach(function(el) {
    observer.observe(el);
  });

  // Add pulse effect to primary CTA after delay
  setTimeout(function() {
    const heroCta = document.querySelector('.hero .btn-primary');
    if (heroCta) {
      heroCta.classList.add('pulse');
    }
  }, 3000);
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
