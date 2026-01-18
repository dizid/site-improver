// src/previewValidator.js
// Preview quality validation - detects empty/broken sections before deployment

import logger from './logger.js';
import { hasCliche, validateHeadline } from './contentValidator.js';

const log = logger.child('preview-validator');

/**
 * Issue severity levels
 */
const SEVERITY = {
  CRITICAL: 'critical',  // Blocks deployment
  WARNING: 'warning'     // Flags for review
};

/**
 * Issue type constants
 */
const ISSUE_TYPES = {
  MISSING_HEADLINE: 'missing_headline',
  CLICHE_HEADLINE: 'cliche_headline',
  MISSING_BUSINESS_NAME: 'missing_business_name',
  PLACEHOLDER_BUSINESS_NAME: 'placeholder_business_name',
  NO_CONTACT_INFO: 'no_contact_info',
  WEAK_SUBHEADLINE: 'weak_subheadline',
  FEW_SERVICES: 'few_services',
  FEW_WHY_US_POINTS: 'few_why_us_points',
  NO_HERO_IMAGE: 'no_hero_image',
  BROKEN_HERO_IMAGE: 'broken_hero_image',
  FEW_TESTIMONIALS: 'few_testimonials',
  WEAK_SERVICES: 'weak_services'
};

/**
 * Placeholder business names that should be blocked (exact matches)
 */
const PLACEHOLDER_NAMES_EXACT = [
  'unknown',
  'local business',
  'your business',
  'business name',
  'company name',
  'my company',
  'our team',
  'our company',
  'untitled',
  'new business',
  'test',
  'test business',
  'test company',
  'example',
  'example business',
  'example company',
  'sample',
  'sample business',
  'placeholder',
  'lorem ipsum',
  'acme',
  'acme inc',
  'acme corp'
];

/**
 * Partial matches that indicate placeholder names
 */
const PLACEHOLDER_NAME_PATTERNS = [
  /^your\s/i,           // "Your Business", "Your Company"
  /placeholder/i,       // Contains "placeholder"
  /lorem\s*ipsum/i,     // Lorem ipsum
  /\[.*\]/,             // Contains [brackets]
  /\{.*\}/,             // Contains {braces}
  /^xxx+$/i,            // Just x's
  /^test\s*$/i,         // Just "test"
  /^sample\s*$/i        // Just "sample"
];

/**
 * PreviewValidator - Validates preview quality before deployment
 */
export class PreviewValidator {
  constructor(siteData, slots, industry = 'general') {
    this.siteData = siteData || {};
    this.slots = slots || {};
    this.industry = industry;
    this.issues = [];
    this.warnings = [];
  }

  /**
   * Run all validation checks
   * @returns {{ isValid: boolean, issues: Array, warnings: Array, qualityScore: number }}
   */
  validate() {
    this.issues = [];
    this.warnings = [];

    this.checkHeroSection();
    this.checkServices();
    this.checkContactInfo();
    this.checkWhyUsPoints();
    this.checkTestimonials();

    const qualityScore = this.calculateQuality();
    const isValid = this.issues.length === 0;

    log.info('Preview validation complete', {
      isValid,
      qualityScore,
      issueCount: this.issues.length,
      warningCount: this.warnings.length
    });

    return {
      isValid,
      issues: this.issues,
      warnings: this.warnings,
      qualityScore
    };
  }

  /**
   * Check hero section (headline, subheadline, business name)
   */
  checkHeroSection() {
    const headline = this.slots.headline || '';
    const subheadline = this.slots.subheadline || '';
    const businessName = this.slots.business_name || this.siteData.businessName || '';

    // CRITICAL: Missing or very short headline
    if (!headline || headline.length < 20) {
      this.issues.push({
        type: ISSUE_TYPES.MISSING_HEADLINE,
        severity: SEVERITY.CRITICAL,
        message: 'Hero section missing headline or headline too short (< 20 chars)',
        actual: headline ? `"${headline}" (${headline.length} chars)` : 'empty'
      });
    }

    // CRITICAL: Headline contains clichés
    if (headline && hasCliche(headline)) {
      const validation = validateHeadline(headline, {
        businessName,
        city: this.siteData.city || this.siteData.address
      });
      const cliches = validation.issues
        .filter(i => i.type === 'cliche')
        .map(i => i.text);

      this.issues.push({
        type: ISSUE_TYPES.CLICHE_HEADLINE,
        severity: SEVERITY.CRITICAL,
        message: 'Headline contains clichés that must be replaced',
        actual: `"${headline}"`,
        cliches: cliches.slice(0, 3) // Show up to 3 clichés found
      });
    }

    // CRITICAL: Missing business name
    if (!businessName || businessName.length < 2) {
      this.issues.push({
        type: ISSUE_TYPES.MISSING_BUSINESS_NAME,
        severity: SEVERITY.CRITICAL,
        message: 'Business name is missing or invalid',
        actual: businessName || 'empty'
      });
    }

    // CRITICAL: Placeholder business name
    const nameLower = (businessName || '').toLowerCase().trim();

    // Check exact matches
    const isExactPlaceholder = PLACEHOLDER_NAMES_EXACT.includes(nameLower);

    // Check pattern matches
    const matchesPattern = PLACEHOLDER_NAME_PATTERNS.some(pattern =>
      pattern.test(businessName)
    );

    if (businessName && (isExactPlaceholder || matchesPattern)) {
      this.issues.push({
        type: ISSUE_TYPES.PLACEHOLDER_BUSINESS_NAME,
        severity: SEVERITY.CRITICAL,
        message: 'Business name appears to be a placeholder',
        actual: `"${businessName}" (detected as placeholder)`
      });
    }

    // WARNING: Weak subheadline
    if (!subheadline || subheadline.length < 30) {
      this.warnings.push({
        type: ISSUE_TYPES.WEAK_SUBHEADLINE,
        severity: SEVERITY.WARNING,
        message: 'Subheadline is weak or missing (< 30 chars)',
        actual: subheadline ? `"${subheadline.slice(0, 50)}..." (${subheadline.length} chars)` : 'empty'
      });
    }

    // Check hero images
    this.checkHeroImages();
  }

  /**
   * Check hero images for availability and validity
   */
  checkHeroImages() {
    const images = this.siteData.images || [];

    // WARNING: No hero image
    if (images.length === 0) {
      this.warnings.push({
        type: ISSUE_TYPES.NO_HERO_IMAGE,
        severity: SEVERITY.WARNING,
        message: 'No hero image available (will use gradient fallback)',
        actual: '0 images'
      });
      return;
    }

    // Check hero image quality
    const heroImage = images[0];

    // CRITICAL: Broken or invalid hero image URL
    if (heroImage) {
      const isValidUrl = this.isValidImageUrl(heroImage.url || heroImage.src || heroImage);
      const isBroken = heroImage.broken === true || heroImage.error;

      if (!isValidUrl || isBroken) {
        this.issues.push({
          type: ISSUE_TYPES.BROKEN_HERO_IMAGE,
          severity: SEVERITY.CRITICAL,
          message: 'Hero image URL is broken or invalid',
          actual: typeof heroImage === 'string'
            ? heroImage.slice(0, 100)
            : (heroImage.url || heroImage.src || 'unknown')
        });
      }

      // WARNING: Low quality hero image (if score available)
      if (heroImage.score && heroImage.score < 20) {
        this.warnings.push({
          type: ISSUE_TYPES.NO_HERO_IMAGE,
          severity: SEVERITY.WARNING,
          message: `Hero image quality is low (score: ${heroImage.score}/100)`,
          actual: `Low quality image: ${heroImage.url || heroImage.src || 'unknown'}`
        });
      }
    }
  }

  /**
   * Validate image URL format
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Check for common invalid patterns
    const invalidPatterns = [
      /^data:image\/svg/i,  // SVG data URIs are often icons
      /placeholder/i,       // Placeholder images
      /loading/i,           // Loading spinners
      /spinner/i,
      /1x1/,                // Tracking pixels
      /spacer/i,
      /blank/i,
      /default/i,
      /no-image/i,
      /noimage/i,
      /missing/i
    ];

    if (invalidPatterns.some(p => p.test(url))) {
      return false;
    }

    // Check for valid URL format
    try {
      // Allow data URIs for actual images
      if (url.startsWith('data:image/')) {
        return !url.startsWith('data:image/svg');
      }

      // Check for valid URL
      const parsed = new URL(url, 'https://example.com');
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
      const hasValidExtension = validExtensions.some(ext =>
        parsed.pathname.toLowerCase().includes(ext)
      );

      // Allow URLs that look like image URLs even without extension
      // (many CDNs don't use extensions)
      return hasValidExtension ||
        /\/images?\//i.test(url) ||
        /cdn/i.test(url) ||
        /cloudinary/i.test(url) ||
        /imgix/i.test(url) ||
        /unsplash/i.test(url) ||
        /pexels/i.test(url);
    } catch {
      return false;
    }
  }

  /**
   * Check services section
   */
  checkServices() {
    const services = this.slots.services || [];

    // WARNING: Few services
    if (services.length < 3) {
      this.warnings.push({
        type: ISSUE_TYPES.FEW_SERVICES,
        severity: SEVERITY.WARNING,
        message: `Only ${services.length} service(s) found (recommended: 3+)`,
        actual: `${services.length} services`
      });
    }

    // WARNING: Services without descriptions
    const weakServices = services.filter(s =>
      !s.description || s.description.length < 15
    );
    if (weakServices.length > 0 && services.length > 0) {
      this.warnings.push({
        type: ISSUE_TYPES.WEAK_SERVICES,
        severity: SEVERITY.WARNING,
        message: `${weakServices.length} service(s) have weak/missing descriptions`,
        actual: weakServices.map(s => s.name || 'unnamed').join(', ')
      });
    }
  }

  /**
   * Check contact information
   */
  checkContactInfo() {
    const phone = this.slots.phone || this.siteData.phone;
    const email = this.slots.email || this.siteData.email;
    const address = this.slots.address || this.siteData.address;

    // CRITICAL: Missing BOTH phone AND email
    const hasPhone = phone && phone !== 'Unknown' && phone.length > 5;
    const hasEmail = email && email !== 'Unknown' && email.includes('@');

    if (!hasPhone && !hasEmail) {
      this.issues.push({
        type: ISSUE_TYPES.NO_CONTACT_INFO,
        severity: SEVERITY.CRITICAL,
        message: 'No contact information (missing both phone and email)',
        actual: `phone: ${phone || 'none'}, email: ${email || 'none'}`
      });
    }

    // INFO: Address missing is not critical but noted
    if (!address || address === 'Unknown' || address.length < 10) {
      // Just log, not an issue or warning
      log.debug('Address missing or weak', { address: address || 'none' });
    }
  }

  /**
   * Check Why Us / Trust points
   */
  checkWhyUsPoints() {
    const whyUsPoints = this.slots.why_us_points || [];

    // WARNING: Few why_us points
    if (whyUsPoints.length < 3) {
      this.warnings.push({
        type: ISSUE_TYPES.FEW_WHY_US_POINTS,
        severity: SEVERITY.WARNING,
        message: `Only ${whyUsPoints.length} "Why Us" point(s) (recommended: 3-4)`,
        actual: `${whyUsPoints.length} points`
      });
    }
  }

  /**
   * Check testimonials
   */
  checkTestimonials() {
    const testimonials = this.siteData.testimonials || this.slots.testimonials || [];

    // WARNING: Few testimonials
    if (testimonials.length < 2) {
      this.warnings.push({
        type: ISSUE_TYPES.FEW_TESTIMONIALS,
        severity: SEVERITY.WARNING,
        message: `Only ${testimonials.length} testimonial(s) (recommended: 2+)`,
        actual: `${testimonials.length} testimonials`
      });
    }
  }

  /**
   * Calculate overall quality score (0-100)
   */
  calculateQuality() {
    let score = 100;

    // Deduct for critical issues (25 points each)
    score -= this.issues.length * 25;

    // Deduct for warnings (10 points each)
    score -= this.warnings.length * 10;

    // Bonus points for good content
    const services = this.slots.services || [];
    const testimonials = this.siteData.testimonials || [];
    const images = this.siteData.images || [];

    // Bonus for having 4+ services
    if (services.length >= 4) score += 5;

    // Bonus for having testimonials with ratings
    const ratedTestimonials = testimonials.filter(t => t.rating && t.rating >= 4);
    if (ratedTestimonials.length >= 2) score += 5;

    // Bonus for having good hero image
    if (images.length > 0 && images[0].score && images[0].score >= 30) score += 5;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Convenience function to validate a preview
 * @param {Object} siteData - Scraped site data
 * @param {Object} slots - Polished template slots
 * @param {string} industry - Detected industry
 * @returns {{ isValid: boolean, issues: Array, warnings: Array, qualityScore: number }}
 */
export function validatePreview(siteData, slots, industry) {
  const validator = new PreviewValidator(siteData, slots, industry);
  return validator.validate();
}

export default PreviewValidator;
