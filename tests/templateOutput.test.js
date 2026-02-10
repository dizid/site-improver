// tests/templateOutput.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import TemplateBuilder from '../src/templateBuilder.js';

describe('Template Output', () => {
  let builder;

  beforeEach(async () => {
    builder = new TemplateBuilder();
    await builder.init();
  });

  describe('plumber template', () => {
    it('should include emergency or urgency-related content', async () => {
      const siteData = {
        businessName: "Bob's Plumbing",
        headline: "Denver's Trusted Plumber",
        subheadline: "24/7 Emergency Service",
        phone: '303-555-1234',
        address: '123 Main St, Denver, CO 80202',
        services: ['Drain Cleaning', 'Water Heater Repair', 'Emergency Plumbing'],
        trustSignals: {
          rating: 4.9,
          reviewCount: 187,
          yearsInBusiness: 15
        },
        industry: 'plumber',
        images: [{ src: 'https://example.com/plumber.jpg', alt: 'Plumbing service' }]
      };

      const result = await builder.build(siteData);

      // Should detect as plumber industry
      expect(result.industry).toBe('plumber');

      // HTML should contain emergency/urgency indicators
      expect(result.html).toMatch(/24\/7|emergency|urgent|fast|quick/i);

      // Should include business name
      expect(result.html).toContain("Bob's Plumbing");
    });
  });

  describe('restaurant template', () => {
    it('should include menu-related section', async () => {
      const siteData = {
        businessName: "Joe's Diner",
        headline: "Classic American Food",
        subheadline: "Breakfast, Lunch, and Dinner",
        phone: '303-555-5678',
        address: '456 Oak St, Denver, CO 80203',
        services: ['Breakfast Menu', 'Lunch Specials', 'Dinner Service', 'Takeout'],
        trustSignals: {
          rating: 4.7,
          reviewCount: 342
        },
        industry: 'restaurant',
        images: [{ src: 'https://example.com/restaurant.jpg', alt: 'Restaurant interior' }]
      };

      const result = await builder.build(siteData);

      expect(result.industry).toBe('restaurant');

      // Should include menu-related content
      expect(result.html).toMatch(/menu|food|dining|cuisine|breakfast|lunch|dinner/i);

      // Should include business name
      expect(result.html).toContain("Joe's Diner");
    });
  });

  describe('lawyer template', () => {
    it('should include case results or legal expertise section', async () => {
      const siteData = {
        businessName: "Smith & Associates Law",
        headline: "Experienced Trial Attorneys",
        subheadline: "Protecting Your Rights Since 2005",
        phone: '303-555-9999',
        address: '789 Court St, Denver, CO 80204',
        services: ['Personal Injury', 'Criminal Defense', 'Family Law', 'Business Law'],
        trustSignals: {
          rating: 5.0,
          reviewCount: 156,
          yearsInBusiness: 18
        },
        industry: 'lawyer',
        images: [{ src: 'https://example.com/lawyer.jpg', alt: 'Law office' }]
      };

      const result = await builder.build(siteData);

      expect(result.industry).toBe('lawyer');

      // Should include legal/case results content
      expect(result.html).toMatch(/case|legal|attorney|lawyer|experience|expertise|results/i);

      // Should include business name
      expect(result.html).toContain("Smith & Associates Law");
    });
  });

  describe('HTML structure', () => {
    it('should produce valid HTML with DOCTYPE', async () => {
      const siteData = {
        businessName: "Test Business",
        headline: "Welcome",
        phone: '555-1234',
        services: ['Service 1', 'Service 2'],
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toMatch(/^<!DOCTYPE html>/i);
      expect(result.html).toContain('<html');
      expect(result.html).toContain('</html>');
    });

    it('should include viewport meta tag for mobile', async () => {
      const siteData = {
        businessName: "Test Business",
        headline: "Welcome",
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('<meta name="viewport"');
      expect(result.html).toContain('width=device-width');
    });

    it('should include meta description', async () => {
      const siteData = {
        businessName: "Test Business",
        headline: "Welcome",
        subheadline: "We provide excellent service",
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('<meta name="description"');
    });

    it('should include title tag with business name', async () => {
      const siteData = {
        businessName: "Acme Plumbing",
        headline: "Best Plumbers in Town",
        industry: 'plumber'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('<title>');
      expect(result.html).toContain('Acme Plumbing');
    });
  });

  describe('industry-specific content', () => {
    it('should include trust signals when available', async () => {
      const siteData = {
        businessName: "Reliable Services",
        headline: "Quality Work",
        trustSignals: {
          rating: 4.8,
          reviewCount: 250,
          yearsInBusiness: 20
        },
        industry: 'general'
      };

      const result = await builder.build(siteData);

      // Should include rating or review count
      expect(result.html).toMatch(/4\.8|250|20/);
    });

    it('should include phone number in output', async () => {
      const siteData = {
        businessName: "Call Us Business",
        phone: '(303) 555-1234',
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('303');
      expect(result.html).toContain('555');
      expect(result.html).toContain('1234');
    });

    it('should include services in output', async () => {
      const siteData = {
        businessName: "Multi-Service Co",
        headline: "Professional Services",
        subheadline: "Complete business solutions",
        services: [
          { name: 'Web Design', description: 'Custom website design' },
          { name: 'SEO', description: 'Search engine optimization' },
          { name: 'Marketing', description: 'Digital marketing services' }
        ],
        industry: 'general',
        phone: '555-1234'
      };

      const result = await builder.build(siteData);

      // Check that services section or service-related content exists
      const hasServicesSection = result.html.match(/services|what we (do|offer)/i);
      expect(hasServicesSection).toBeTruthy();
    });
  });

  describe('dentist template', () => {
    it('should include dental services and professional styling', async () => {
      const siteData = {
        businessName: "Bright Smile Dental",
        headline: "Your Family Dentist",
        subheadline: "Gentle Care for All Ages",
        phone: '303-555-4321',
        address: '321 Dental Ave, Denver, CO 80205',
        services: ['Cleanings', 'Whitening', 'Implants', 'Emergency Dental'],
        trustSignals: {
          rating: 4.9,
          reviewCount: 423
        },
        industry: 'dentist',
        images: [{ src: 'https://example.com/dental.jpg', alt: 'Dental office' }]
      };

      const result = await builder.build(siteData);

      expect(result.industry).toBe('dentist');

      // Should include dental-related content
      expect(result.html).toMatch(/dental|teeth|smile|cleaning|whitening/i);
      expect(result.html).toContain("Bright Smile Dental");
    });
  });

  describe('real-estate template', () => {
    it('should include property listings or realtor expertise', async () => {
      const siteData = {
        businessName: "Denver Homes Realty",
        headline: "Find Your Dream Home",
        subheadline: "Expert Realtors Serving Denver Since 2010",
        phone: '303-555-7890',
        address: '555 Real Estate Blvd, Denver, CO 80206',
        services: ['Buyer Representation', 'Seller Services', 'Property Management', 'Investment Properties'],
        trustSignals: {
          rating: 4.8,
          reviewCount: 289
        },
        industry: 'real-estate',
        images: [{ src: 'https://example.com/house.jpg', alt: 'Beautiful home' }]
      };

      const result = await builder.build(siteData);

      expect(result.industry).toBe('real-estate');

      // Should include real estate content
      expect(result.html).toMatch(/home|house|property|realtor|real estate|listing/i);
      expect(result.html).toContain("Denver Homes Realty");
    });
  });

  describe('CSS and styling', () => {
    it('should include CSS styles', async () => {
      const siteData = {
        businessName: "Styled Business",
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('<style>');
      expect(result.html).toContain('</style>');
    });

    it('should include Google Fonts', async () => {
      const siteData = {
        businessName: "Font Test",
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('fonts.googleapis.com');
      expect(result.html).toContain('fonts.gstatic.com');
    });
  });

  describe('salon template', () => {
    it('should include styling and beauty services', async () => {
      const siteData = {
        businessName: "Glamour Studio",
        headline: "Beauty & Hair Salon",
        subheadline: "Transform Your Look",
        phone: '303-555-2468',
        services: ['Haircuts', 'Coloring', 'Manicure', 'Pedicure', 'Facial Treatments'],
        trustSignals: {
          rating: 4.9,
          reviewCount: 567
        },
        industry: 'salon',
        images: [{ src: 'https://example.com/salon.jpg', alt: 'Salon interior' }]
      };

      const result = await builder.build(siteData);

      expect(result.industry).toBe('salon');
      expect(result.html).toMatch(/hair|beauty|salon|style|color|nails/i);
      expect(result.html).toContain("Glamour Studio");
    });
  });

  describe('structured data', () => {
    it('should include JSON-LD schema markup', async () => {
      const siteData = {
        businessName: "Schema Test",
        phone: '555-1234',
        email: 'test@example.com',
        address: '123 Main St',
        industry: 'general'
      };

      const result = await builder.build(siteData);

      expect(result.html).toContain('application/ld+json');
      expect(result.html).toContain('schema.org');
      expect(result.html).toContain('LocalBusiness');
    });
  });
});
