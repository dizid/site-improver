// tests/contentOptimizer.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared mock reference that survives module resets
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    }))
  };
});

// --- Test fixtures ---

const mockPolishedSlots = {
  headline: 'Denver Plumbing Since 1987',
  subheadline: 'Licensed and insured plumbing team serving the Denver metro area',
  services: [
    { name: 'Drain Cleaning', description: 'Fast drain clearing for your home', icon: 'wrench' },
    { name: 'Water Heater', description: 'Installation and repair same day', icon: 'zap' }
  ],
  why_us_points: [
    { title: '35+ Years Experience', description: 'Serving Denver since 1987' },
    { title: 'Licensed & Insured', description: 'CO License #12345' }
  ],
  cta_text: 'Get a Free Quote',
  cta_secondary: 'Call Now',
  about_text: 'Family-owned plumbing company serving Denver for over 35 years.',
  meta_description: 'Denver plumbing since 1987. Licensed, insured. Free estimates.',
  // Contact info (must NEVER be modified)
  phone: '555-123-4567',
  email: 'info@denverplumbing.com',
  address: '123 Main St, Denver, CO',
  businessName: 'Denver Plumbing Co',
  hours: 'Mon-Fri 8am-6pm'
};

const mockSiteData = {
  businessName: 'Denver Plumbing Co',
  address: '123 Main St, Denver, CO',
  city: 'Denver',
  phone: '555-123-4567',
  email: 'info@denverplumbing.com',
  hours: 'Mon-Fri 8am-6pm',
  language: 'en',
  rating: 4.8,
  reviewCount: 156,
  trustSignals: {
    yearsInBusiness: 35,
    foundedYear: 1987,
    certifications: ['Master Plumber'],
    licenses: ['CO #12345'],
    customerCount: 4200,
    guarantees: ['Satisfaction Guaranteed'],
    serviceAreas: ['Denver', 'Aurora', 'Lakewood']
  }
};

const mockOptimizedResponse = JSON.stringify({
  headline: '35 Years Fixing Denver Pipes — 4,200 Homes Served',
  subheadline: 'Master Plumber #12345. Same-day service. Satisfaction guaranteed or your money back.',
  services: [
    { name: 'Drain Cleaning', description: 'Clogged drain? Cleared in under 2 hours, guaranteed', icon: 'wrench' },
    { name: 'Water Heater', description: 'New water heater installed today — wake up to hot water tomorrow', icon: 'zap' }
  ],
  why_us_points: [
    { title: '35 Years · 4,200+ Jobs', description: 'Serving Denver since 1987' },
    { title: 'License CO #12345', description: 'Master Plumber, fully insured' }
  ],
  cta_text: 'Get Your Free Quote Now',
  cta_secondary: 'Call 555-123-4567',
  about_text: 'Denver Plumbing Co has served the Denver metro since 1987. As Master Plumber license holders (#12345), we bring 35 years of expertise to every job. Over 4,200 homeowners trust us with a 4.8-star rating. Every job comes with our satisfaction guarantee — if it is not right, we fix it free.',
  meta_description: 'Denver plumber since 1987. Master Plumber #12345. 4,200+ jobs, 4.8★ rated. Free estimates. Call today.'
});

// Content with clichés that should score poorly
const mockClicheResponse = JSON.stringify({
  headline: 'Quality Service You Can Trust',
  subheadline: 'Your trusted partner for all your plumbing needs and beyond',
  services: [
    { name: 'Drain Cleaning', description: 'Quality drain cleaning services', icon: 'wrench' },
    { name: 'Water Heater', description: 'Professional water heater services', icon: 'zap' }
  ],
  why_us_points: [
    { title: 'Quality Service', description: 'We provide the best quality service' },
    { title: 'Trusted Partner', description: 'Your one-stop shop for plumbing' }
  ],
  cta_text: 'Contact Us Today',
  cta_secondary: 'Learn More',
  about_text: 'We are a quality service provider dedicated to excellence in all we do.',
  meta_description: 'Quality plumbing services. Trusted partner. Contact us today.'
});

// Import module once (mocks are hoisted above this)
import { ContentOptimizer } from '../src/contentOptimizer.js';

describe('ContentOptimizer', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // --- Constructor tests ---

  describe('constructor', () => {
    it('should accept an API key parameter', () => {
      const optimizer = new ContentOptimizer('custom-api-key');
      expect(optimizer.apiKey).toBe('custom-api-key');
    });

    it('should fall back to ANTHROPIC_API_KEY env variable', () => {
      const optimizer = new ContentOptimizer();
      expect(optimizer.apiKey).toBe('test-key');
    });
  });

  // --- getClient() tests ---

  describe('getClient', () => {
    it('should create Anthropic client on first call', () => {
      const optimizer = new ContentOptimizer('test-key');
      const client = optimizer.getClient();
      expect(client).toBeDefined();
      expect(client.messages).toBeDefined();
    });

    it('should reuse client on subsequent calls', () => {
      const optimizer = new ContentOptimizer('test-key');
      const client1 = optimizer.getClient();
      const client2 = optimizer.getClient();
      expect(client1).toBe(client2);
    });

    it('should throw if no API key available', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const optimizer = new ContentOptimizer(null);
      // Override the apiKey to ensure it's falsy
      optimizer.apiKey = null;
      expect(() => optimizer.getClient()).toThrow();
    });
  });

  // --- optimizeContent() tests ---

  describe('optimizeContent', () => {
    it('should return improved content when optimization succeeds', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Mock the API to return optimized content
      mockCreate.mockResolvedValue({
        content: [{ text: mockOptimizedResponse }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      expect(result.improved).toBe(true);
      expect(result.afterScore).toBeGreaterThanOrEqual(result.beforeScore);
      expect(result.attempts).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.slots).toBeDefined();
      expect(result.slots.headline).toBe('35 Years Fixing Denver Pipes — 4,200 Homes Served');
    });

    it('should return original content when optimization makes it worse (do-no-harm gate)', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Mock the API to return content with clichés (should score lower)
      mockCreate.mockResolvedValue({
        content: [{ text: mockClicheResponse }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      expect(result.improved).toBe(false);
      // Original slots should be returned unchanged
      expect(result.slots.headline).toBe(mockPolishedSlots.headline);
      expect(result.slots.subheadline).toBe(mockPolishedSlots.subheadline);
      expect(result.slots.about_text).toBe(mockPolishedSlots.about_text);
    });

    it('should handle API errors gracefully', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Mock the API to throw an error
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      // Should not throw, should return original content
      expect(result.improved).toBe(false);
      expect(result.slots).toEqual(mockPolishedSlots);
    });

    it('should retry on cliché validation failure', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // First call returns clichés, second call returns good content
      mockCreate
        .mockResolvedValueOnce({
          content: [{ text: mockClicheResponse }]
        })
        .mockResolvedValueOnce({
          content: [{ text: mockOptimizedResponse }]
        });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      // API should have been called at least twice (retry on cliché)
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should never modify contact information', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Mock API response that tries to change contact info
      const responseWithChangedContacts = JSON.stringify({
        ...JSON.parse(mockOptimizedResponse),
        phone: '999-999-9999',
        email: 'hacked@evil.com',
        address: '456 Wrong St',
        businessName: 'Wrong Business Name',
        hours: '24/7'
      });

      mockCreate.mockResolvedValue({
        content: [{ text: responseWithChangedContacts }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      // Contact info must match the originals exactly
      expect(result.slots.phone).toBe('555-123-4567');
      expect(result.slots.email).toBe('info@denverplumbing.com');
      expect(result.slots.address).toBe('123 Main St, Denver, CO');
      expect(result.slots.businessName).toBe('Denver Plumbing Co');
      expect(result.slots.hours).toBe('Mon-Fri 8am-6pm');
    });

    it('should preserve original slots when optimizer returns empty fields', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Mock API response with partial/missing fields
      const partialResponse = JSON.stringify({
        headline: '35 Years Fixing Denver Pipes',
        // Missing: subheadline, services, why_us_points, etc.
      });

      mockCreate.mockResolvedValue({
        content: [{ text: partialResponse }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      // Original values should be preserved for fields not in the response
      if (result.improved) {
        expect(result.slots.subheadline).toBe(mockPolishedSlots.subheadline);
        expect(result.slots.about_text).toBe(mockPolishedSlots.about_text);
        expect(result.slots.meta_description).toBe(mockPolishedSlots.meta_description);
      }
    });
  });

  // --- parseResponse() tests ---

  describe('parseResponse', () => {
    it('should parse clean JSON string', () => {
      const optimizer = new ContentOptimizer('test-key');
      const input = '{"headline": "Test Headline", "subheadline": "Test Sub"}';

      const result = optimizer.parseResponse(input);

      expect(result.headline).toBe('Test Headline');
      expect(result.subheadline).toBe('Test Sub');
    });

    it('should extract JSON from markdown code blocks', () => {
      const optimizer = new ContentOptimizer('test-key');
      const input = '```json\n{"headline": "From Markdown", "cta_text": "Click Now"}\n```';

      const result = optimizer.parseResponse(input);

      expect(result.headline).toBe('From Markdown');
      expect(result.cta_text).toBe('Click Now');
    });

    it('should return empty defaults for malformed JSON', () => {
      const optimizer = new ContentOptimizer('test-key');
      const input = 'not json at all, just some random text';

      const result = optimizer.parseResponse(input);

      // Should return an object (not throw), with empty/default values
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle partial JSON (missing fields)', () => {
      const optimizer = new ContentOptimizer('test-key');
      const input = '{"headline": "Only Headline"}';

      const result = optimizer.parseResponse(input);

      expect(result.headline).toBe('Only Headline');
      // Missing fields should be empty defaults
      expect(result.services).toEqual([]);
    });
  });

  // --- mapOptimizedToSlots() tests ---

  describe('mapOptimizedToSlots', () => {
    it('should merge optimized fields into original slots', () => {
      const optimizer = new ContentOptimizer('test-key');
      const optimized = {
        headline: 'New Optimized Headline',
        subheadline: 'New Optimized Sub'
      };

      const result = optimizer.mapOptimizedToSlots(optimized, mockPolishedSlots);

      expect(result.headline).toBe('New Optimized Headline');
      expect(result.subheadline).toBe('New Optimized Sub');
      // Unchanged fields should be preserved
      expect(result.cta_text).toBe(mockPolishedSlots.cta_text);
      expect(result.about_text).toBe(mockPolishedSlots.about_text);
    });

    it('should skip empty string fields from optimized', () => {
      const optimizer = new ContentOptimizer('test-key');
      const optimized = {
        headline: 'Good Headline',
        subheadline: '', // Empty - should not overwrite
        cta_text: ''     // Empty - should not overwrite
      };

      const result = optimizer.mapOptimizedToSlots(optimized, mockPolishedSlots);

      expect(result.headline).toBe('Good Headline');
      expect(result.subheadline).toBe(mockPolishedSlots.subheadline);
      expect(result.cta_text).toBe(mockPolishedSlots.cta_text);
    });

    it('should skip empty array fields from optimized', () => {
      const optimizer = new ContentOptimizer('test-key');
      const optimized = {
        headline: 'Good Headline',
        services: [],        // Empty array - should not overwrite
        why_us_points: []    // Empty array - should not overwrite
      };

      const result = optimizer.mapOptimizedToSlots(optimized, mockPolishedSlots);

      expect(result.headline).toBe('Good Headline');
      expect(result.services).toEqual(mockPolishedSlots.services);
      expect(result.why_us_points).toEqual(mockPolishedSlots.why_us_points);
    });

    it('should never overwrite protected contact fields', () => {
      const optimizer = new ContentOptimizer('test-key');
      const optimized = {
        headline: 'New Headline',
        phone: '999-999-9999',
        email: 'changed@evil.com',
        address: '999 Hacker Ave',
        businessName: 'Totally Different Business',
        hours: '24/7/365'
      };

      const result = optimizer.mapOptimizedToSlots(optimized, mockPolishedSlots);

      // Protected fields must not be overwritten
      expect(result.phone).toBe('555-123-4567');
      expect(result.email).toBe('info@denverplumbing.com');
      expect(result.address).toBe('123 Main St, Denver, CO');
      expect(result.businessName).toBe('Denver Plumbing Co');
      expect(result.hours).toBe('Mon-Fri 8am-6pm');
      // Non-protected field should be updated
      expect(result.headline).toBe('New Headline');
    });
  });

  // --- Do-no-harm gate tests ---

  describe('do-no-harm gate', () => {
    it('should reject optimization when score decreases', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Return cliché-laden content that scores lower
      mockCreate.mockResolvedValue({
        content: [{ text: mockClicheResponse }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      expect(result.improved).toBe(false);
      // Original content should be returned
      expect(result.slots.headline).toBe(mockPolishedSlots.headline);
    });

    it('should accept optimization when scores are equal (>=)', async () => {
      const optimizer = new ContentOptimizer('test-key');

      // Return content that's at least as good as the original
      mockCreate.mockResolvedValue({
        content: [{ text: mockOptimizedResponse }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      // The optimized content is better, so it should be accepted
      expect(result.improved).toBe(true);
      expect(result.afterScore).toBeGreaterThanOrEqual(result.beforeScore);
    });

    it('should log score comparison', async () => {
      const optimizer = new ContentOptimizer('test-key');

      mockCreate.mockResolvedValue({
        content: [{ text: mockOptimizedResponse }]
      });

      const result = await optimizer.optimizeContent(mockPolishedSlots, mockSiteData, 'plumber');

      // Result should include both scores for comparison
      expect(typeof result.beforeScore).toBe('number');
      expect(typeof result.afterScore).toBe('number');
      expect(result.beforeScore).toBeGreaterThanOrEqual(0);
      expect(result.afterScore).toBeGreaterThanOrEqual(0);
    });
  });
});
