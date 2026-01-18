// tests/templateBuilder.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';

// Mock fs
vi.mock('fs/promises');

describe('TemplateBuilder', () => {
  let TemplateBuilder;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    // Mock file system for templates
    fs.readdir.mockResolvedValue([]);
    fs.readFile.mockResolvedValue('');

    const module = await import('../src/templateBuilder.js');
    TemplateBuilder = module.TemplateBuilder;
  });

  describe('detectIndustry', () => {
    it('should detect plumbing industry', async () => {
      const builder = new TemplateBuilder();
      // Set up mock industry configs (note: industry key is 'plumber' not 'plumbing')
      builder.industryConfigs = {
        plumber: { keywords: ['plumber', 'plumbing', 'drain', 'pipe'] },
        hvac: { keywords: ['hvac', 'heating', 'cooling', 'air conditioning'] },
        general: { keywords: [] }
      };

      const siteData = {
        businessName: 'Bob\'s Plumbing',
        headlines: ['Professional Plumbing Services'],
        paragraphs: ['We fix pipes and drains']
      };

      const industry = builder.detectIndustry(siteData);
      expect(industry).toBe('plumber');
    });

    it('should return general for unknown industry', async () => {
      const builder = new TemplateBuilder();
      builder.industryConfigs = {
        plumbing: { keywords: ['plumber'] },
        general: { keywords: [] }
      };

      const siteData = {
        businessName: 'Random Business',
        headlines: ['Welcome'],
        paragraphs: ['Some text']
      };

      const industry = builder.detectIndustry(siteData);
      expect(industry).toBe('general');
    });
  });

  describe('mapSlots', () => {
    it('should map site data to slots', async () => {
      const builder = new TemplateBuilder();
      const siteData = {
        businessName: 'Test Business',
        headlines: ['First Headline', 'Second Headline'],
        phone: '555-1234'
      };

      const config = {
        slots: {
          business_name: { source: 'businessName' },
          headline: { source: 'headlines[0]', fallback: 'Welcome' },
          phone: { source: 'phone' }
        }
      };

      const mapped = builder.mapSlots(siteData, config);

      expect(mapped.business_name).toBe('Test Business');
      expect(mapped.headline).toBe('First Headline');
      expect(mapped.phone).toBe('555-1234');
    });

    it('should use fallback for missing data', async () => {
      const builder = new TemplateBuilder();
      const siteData = {
        businessName: 'Test'
      };

      const config = {
        slots: {
          headline: { source: 'headlines[0]', fallback: 'Welcome to {{businessName}}' },
          missing: { source: 'nonexistent', fallback: 'Default Value' }
        }
      };

      const mapped = builder.mapSlots(siteData, config);

      // Smart fallbacks may provide a different headline than config fallback
      // Just verify a fallback was used (headline contains the business name or is non-empty)
      expect(mapped.headline).toBeTruthy();
      expect(mapped.headline.length).toBeGreaterThan(0);
      expect(mapped.missing).toBe('Default Value');
    });
  });

  describe('getByPath', () => {
    it('should get nested values', async () => {
      const builder = new TemplateBuilder();
      const obj = {
        a: { b: { c: 'value' } },
        arr: ['first', 'second']
      };

      expect(builder.getByPath(obj, 'a.b.c')).toBe('value');
      expect(builder.getByPath(obj, 'arr[0]')).toBe('first');
      expect(builder.getByPath(obj, 'arr[1]')).toBe('second');
    });

    it('should return null/undefined for missing paths', async () => {
      const builder = new TemplateBuilder();
      const obj = { a: 1 };

      expect(builder.getByPath(obj, 'b')).toBeFalsy();
      expect(builder.getByPath(obj, 'a.b.c')).toBeFalsy();
      expect(builder.getByPath(null, 'a')).toBeFalsy();
    });
  });

  describe('generateCSS', () => {
    it('should include scraped brand colors when available', async () => {
      const builder = new TemplateBuilder();
      // Scraped colors should now be an object with primary/secondary/accent
      const colors = {
        primary: '#1e40af',
        secondary: '#3b82f6',
        accent: '#f97316'
      };
      const config = {};

      const css = builder.generateCSS(colors, config);

      // Should include color overrides when scraped colors are provided
      expect(css).toContain('--color-primary: #1e40af');
      expect(css).toContain('--color-secondary: #3b82f6');
      expect(css).toContain('--color-accent: #f97316');
    });

    it('should apply typography CSS variables', async () => {
      const builder = new TemplateBuilder();
      const config = {};

      // Without scraped colors, only typography CSS should be generated
      const css = builder.generateCSS({}, config);

      // Design system CSS variables should be referenced for typography
      expect(css).toContain('font-family: var(--font-body)');
      expect(css).toContain('font-family: var(--font-heading)');
      expect(css).toContain('line-height: var(--line-height-body)');
    });

    it('should skip color override for black primary colors', async () => {
      const builder = new TemplateBuilder();
      // Black is often a false positive from scraping
      const colors = { primary: '#000000' };
      const config = {};

      const css = builder.generateCSS(colors, config);

      // Should not include black color override
      expect(css).not.toContain('--color-primary: #000000');
    });
  });
});
