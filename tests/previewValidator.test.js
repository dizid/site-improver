// tests/previewValidator.test.js
import { describe, it, expect } from 'vitest';
import { PreviewValidator, validatePreview } from '../src/previewValidator.js';

describe('PreviewValidator', () => {
  describe('checkHeroSection', () => {
    it('should pass validation with valid headline and business name', () => {
      const siteData = {
        businessName: 'Acme Plumbing Co',
        city: 'Denver',
        phone: '303-555-1234',
        images: [{ url: 'https://cdn.example.com/images/hero.jpg' }]
      };
      const slots = {
        headline: '24/7 Emergency Plumbing Service in Denver',
        subheadline: 'Acme Plumbing - fixing pipes fast since 2010',
        business_name: 'Acme Plumbing Co',
        phone: '303-555-1234'
      };

      const result = validatePreview(siteData, slots, 'plumber');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should flag cliché headlines as CRITICAL', () => {
      const siteData = {
        businessName: 'Test Business',
        city: 'Denver'
      };
      const slots = {
        headline: 'Quality service you can trust',
        subheadline: 'We are here to help with all your needs',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
      const clicheIssue = result.issues.find(i => i.type === 'cliche_headline');
      expect(clicheIssue).toBeDefined();
      expect(clicheIssue.severity).toBe('critical');
    });

    it('should flag "quality services" in headline', () => {
      const siteData = {
        businessName: 'Test Business'
      };
      const slots = {
        headline: 'Professional quality services for your home',
        subheadline: 'Contact us today for a free quote',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
      const clicheIssue = result.issues.find(i => i.type === 'cliche_headline');
      expect(clicheIssue).toBeDefined();
    });

    it('should flag "trusted partner" headline', () => {
      const siteData = {
        businessName: 'Test Business'
      };
      const slots = {
        headline: 'Your trusted partner for all plumbing needs',
        subheadline: 'Serving Denver since 2010',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'plumber');

      expect(result.isValid).toBe(false);
    });
  });

  describe('placeholder business names', () => {
    it('should flag "Unknown" as placeholder', () => {
      const siteData = { businessName: 'Unknown' };
      const slots = {
        headline: '24/7 Emergency Service in Denver - Call Now',
        subheadline: 'Fast response times, fair prices',
        business_name: 'Unknown'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
      const placeholder = result.issues.find(i => i.type === 'placeholder_business_name');
      expect(placeholder).toBeDefined();
    });

    it('should flag "Local Business" as placeholder', () => {
      const siteData = { businessName: 'Local Business' };
      const slots = {
        headline: '24/7 Emergency Service in Denver - Call Now',
        subheadline: 'Fast response times, fair prices',
        business_name: 'Local Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
      const placeholder = result.issues.find(i => i.type === 'placeholder_business_name');
      expect(placeholder).toBeDefined();
    });

    it('should flag "Our Team" as placeholder', () => {
      const siteData = { businessName: 'Our Team' };
      const slots = {
        headline: '24/7 Emergency Service in Denver - Call Now',
        subheadline: 'Fast response times, fair prices',
        business_name: 'Our Team'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
    });

    it('should allow legitimate business names', () => {
      const siteData = {
        businessName: 'Johnson Plumbing LLC',
        phone: '303-555-1234',
        images: [{ url: 'https://cdn.example.com/hero.jpg' }]
      };
      const slots = {
        headline: '24/7 Emergency Plumbing Service in Denver',
        subheadline: 'Johnson Plumbing - serving Denver homes since 2005',
        business_name: 'Johnson Plumbing LLC',
        phone: '303-555-1234'
      };

      const result = validatePreview(siteData, slots, 'plumber');

      expect(result.isValid).toBe(true);
      const placeholder = result.issues.find(i => i.type === 'placeholder_business_name');
      expect(placeholder).toBeUndefined();
    });
  });

  describe('hero image validation', () => {
    it('should warn when no hero image is available', () => {
      const siteData = {
        businessName: 'Test Business',
        images: []
      };
      const slots = {
        headline: '24/7 Emergency Service Available Now in Denver',
        subheadline: 'Licensed professionals ready to help',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      const noImageWarning = result.warnings.find(w => w.type === 'no_hero_image');
      expect(noImageWarning).toBeDefined();
    });

    it('should flag broken hero image as CRITICAL', () => {
      const siteData = {
        businessName: 'Test Business',
        images: [{ url: 'https://example.com/broken.jpg', broken: true }]
      };
      const slots = {
        headline: '24/7 Emergency Service Available Now in Denver',
        subheadline: 'Licensed professionals ready to help',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
      const brokenImage = result.issues.find(i => i.type === 'broken_hero_image');
      expect(brokenImage).toBeDefined();
    });

    it('should flag placeholder image URLs', () => {
      const siteData = {
        businessName: 'Test Business',
        images: [{ url: 'https://example.com/placeholder.png' }]
      };
      const slots = {
        headline: '24/7 Emergency Service Available Now in Denver',
        subheadline: 'Licensed professionals ready to help',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
      const brokenImage = result.issues.find(i => i.type === 'broken_hero_image');
      expect(brokenImage).toBeDefined();
    });

    it('should flag 1x1 tracking pixel images', () => {
      const siteData = {
        businessName: 'Test Business',
        images: [{ url: 'https://example.com/1x1.gif' }]
      };
      const slots = {
        headline: '24/7 Emergency Service Available Now in Denver',
        subheadline: 'Licensed professionals ready to help',
        business_name: 'Test Business'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(false);
    });

    it('should accept valid CDN image URLs', () => {
      const siteData = {
        businessName: 'Denver Repair Co',
        phone: '303-555-1234',
        images: [{ url: 'https://cloudinary.com/images/hero-v123.jpg' }]
      };
      const slots = {
        headline: '24/7 Emergency Service Available Now in Denver',
        subheadline: 'Denver Repair Co - fast response, fair prices since 2010',
        business_name: 'Denver Repair Co',
        phone: '303-555-1234'
      };

      const result = validatePreview(siteData, slots, 'general');

      expect(result.isValid).toBe(true);
    });
  });

  describe('quality score', () => {
    it('should deduct 25 points per critical issue', () => {
      const siteData = {
        businessName: 'Unknown',
        images: []
      };
      const slots = {
        headline: '', // Missing
        subheadline: '',
        business_name: 'Unknown' // Placeholder
      };

      const result = validatePreview(siteData, slots, 'general');

      // Should have at least 2 critical issues
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      // Score should be significantly reduced
      expect(result.qualityScore).toBeLessThan(60);
    });

    it('should award bonus for good content', () => {
      const siteData = {
        businessName: 'Johnson Plumbing LLC',
        phone: '303-555-1234',
        images: [{ url: 'https://cdn.example.com/hero.jpg', score: 80 }],
        testimonials: [
          { text: 'Great service!', rating: 5 },
          { text: 'Highly recommend!', rating: 5 }
        ]
      };
      const slots = {
        headline: '24/7 Emergency Plumbing Service in Denver',
        subheadline: 'Johnson Plumbing - serving Denver homes for 20+ years',
        business_name: 'Johnson Plumbing LLC',
        phone: '303-555-1234',
        services: [
          { name: 'Drain Cleaning', description: 'Clear blocked drains fast' },
          { name: 'Pipe Repair', description: 'Fix leaks and burst pipes' },
          { name: 'Water Heaters', description: 'Installation and repair' },
          { name: 'Emergency Service', description: '24/7 availability' }
        ],
        why_us_points: [
          { title: 'Licensed', description: 'Fully licensed and insured' },
          { title: 'Fast', description: 'Same-day service' },
          { title: 'Fair', description: 'Upfront pricing' }
        ]
      };

      const result = validatePreview(siteData, slots, 'plumber');

      expect(result.isValid).toBe(true);
      expect(result.qualityScore).toBeGreaterThanOrEqual(80);
    });
  });
});
