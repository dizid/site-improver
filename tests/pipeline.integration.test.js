// tests/pipeline.integration.test.js
// Integration test for full pipeline flow
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies BEFORE imports
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate }
  }))
}));

vi.mock('../src/scraperLite.js', () => ({
  scrapeSiteLite: vi.fn()
}));

vi.mock('../src/db.js', () => ({
  saveDeployment: vi.fn().mockResolvedValue({ success: true }),
  createPreview: vi.fn().mockResolvedValue({
    id: 'preview123',
    slug: 'denver-plumbing',
    status: 'complete'
  })
}));

vi.mock('../src/logger.js', () => ({
  default: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      debug: vi.fn()
    })
  }
}));

// Import modules after mocks
import { scrapeSiteLite } from '../src/scraperLite.js';
import { rebuildAndDeploy } from '../src/pipeline.js';
import { createPreview } from '../src/db.js';

describe('Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('full pipeline - passes URL, gets HTML output with business name in title', async () => {
    const mockSiteData = {
      businessName: 'Denver Plumbing Pros',
      phone: '(303) 555-1234',
      email: 'info@denverplumbing.com',
      address: '1234 Main St, Denver, CO 80202',
      city: 'Denver',
      description: 'Professional plumbing services in Denver',
      images: [],
      hours: 'Mon-Fri 8am-6pm',
      testimonials: [
        { name: 'John D.', text: 'Great service!', rating: 5 }
      ],
      trustSignals: {
        yearsInBusiness: 15,
        certifications: ['Licensed', 'Insured'],
        customerCount: 500
      }
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Denver Plumbing Pros - 15+ Years Serving Denver',
          subheadline: 'Licensed & insured plumbers available 24/7 for emergencies',
          services: [
            { name: 'Emergency Repairs', description: '24/7 emergency plumbing', icon: 'wrench' },
            { name: 'Drain Cleaning', description: 'Fast drain cleaning service', icon: 'droplet' }
          ],
          whyUs: [
            'Licensed & insured professionals',
            'Same-day service available',
            '500+ satisfied customers'
          ],
          ctaPrimary: 'Get Free Quote',
          ctaSecondary: 'Call Now',
          aboutSnippet: 'Serving Denver for 15+ years with professional plumbing services.',
          metaDescription: 'Denver Plumbing Pros - 15+ years of licensed plumbing service in Denver, CO. Emergency repairs, drain cleaning, and more.'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://denverplumbing.com', { skipOptimize: true });

    expect(result.html).toBeTruthy();
    expect(result.html).toContain('Denver Plumbing Pros');
    expect(result.businessName).toBe('Denver Plumbing Pros');
    expect(result.industry).toBeTruthy();
    expect(result.preview).toMatch(/\/preview\//);
  });

  it('pipeline with skipPolish - skips AI content generation step', async () => {
    const mockSiteData = {
      businessName: 'Aurora Lawyers',
      phone: '(303) 555-5678',
      email: 'contact@auroralawyers.com',
      address: '789 Main St, Aurora, CO 80012',
      description: 'Legal services'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    const result = await rebuildAndDeploy('https://auroralawyers.com', { skipPolish: true });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.html).toBeTruthy();
    expect(result.html).toContain('Aurora Lawyers');
  });

  it.skip('pipeline with skipOptimize - skips CRO optimization step', async () => {
    const mockSiteData = {
      businessName: 'Mile High Dentist',
      phone: '(720) 555-9999',
      email: 'info@milehighdentist.com',
      address: '321 Oak St, Denver, CO 80203',
      description: 'Dental care'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Mile High Dentist - Gentle Dental Care in Denver',
          subheadline: 'Modern dentistry with a gentle touch',
          services: [{ name: 'Cleanings', description: 'Professional teeth cleaning', icon: 'smile' }],
          whyUs: ['Gentle care', 'Modern equipment'],
          ctaPrimary: 'Book Appointment',
          aboutSnippet: 'Your trusted Denver dentist.'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://milehighdentist.com', { skipOptimize: true });

    expect(result.html).toBeTruthy();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('pipeline graceful degradation - missing ANTHROPIC_API_KEY uses original text', async () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const mockSiteData = {
      businessName: 'Simple Plumbing',
      description: 'We fix pipes',
      headline: 'Simple Plumbing Services',
      subheadline: 'Quality plumbing work'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    const result = await rebuildAndDeploy('https://simpleplumbing.com');

    expect(result.html).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();

    process.env.ANTHROPIC_API_KEY = originalEnv;
  });

  it.skip('pipeline with rich siteData - testimonials, phone, hours appear in output', async () => {
    const mockSiteData = {
      businessName: 'Complete HVAC',
      phone: '(303) 555-4321',
      email: 'service@completehvac.com',
      address: '555 Denver Ave, Denver, CO 80204',
      hours: 'Mon-Sat 7am-7pm',
      testimonials: [
        { name: 'Sarah M.', text: 'Fast and reliable service!', rating: 5 },
        { name: 'Mike K.', text: 'Fixed my AC same day.', rating: 5 }
      ],
      trustSignals: {
        yearsInBusiness: 20,
        certifications: ['NATE Certified', 'EPA Certified']
      }
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Complete HVAC - 20+ Years in Denver',
          subheadline: 'NATE & EPA certified technicians',
          services: [{ name: 'AC Repair', description: 'Fast AC repairs', icon: 'snowflake' }],
          whyUs: ['20+ years experience', 'Certified technicians'],
          ctaPrimary: 'Schedule Service',
          aboutSnippet: '20 years of trusted HVAC service.'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://completehvac.com', { skipOptimize: true });

    expect(result.html).toContain('(303) 555-4321');
    expect(result.html).toContain('Mon-Sat 7am-7pm');
    expect(result.html).toContain('Sarah M.');
    expect(result.html).toContain('Mike K.');
  });

  it('pipeline with empty siteData - no fake content in output', async () => {
    const mockSiteData = {
      businessName: 'Minimal Business',
      description: 'A business'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Minimal Business - Professional Services',
          subheadline: 'Quality service you can trust',
          services: [],
          whyUs: [],
          ctaPrimary: 'Contact Us'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://minimalbiz.com', { skipOptimize: true });

    expect(result.html).not.toContain('$5.2M');
    expect(result.html).not.toContain('500+ Happy Customers');
    expect(result.html).not.toContain('555-0000');
  });

  it('pipeline quality validation - validates content quality before HTML build', async () => {
    const mockSiteData = {
      businessName: 'Quality Test Plumbing',
      city: 'Denver'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Quality Test Plumbing - 10+ Years in Denver',
          subheadline: 'Licensed plumbers serving Denver metro',
          services: [{ name: 'Repairs', description: 'Fast repairs', icon: 'wrench' }],
          whyUs: ['Licensed professionals', '10+ years experience'],
          ctaPrimary: 'Get Free Quote'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://qualitytest.com', { skipOptimize: true });

    expect(result.validation).toBeDefined();
    expect(result.validation.qualityScore).toBeGreaterThan(0);
  });

  it('pipeline industry detection - detects correct industry from keywords', async () => {
    const mockSiteData = {
      businessName: 'Legal Solutions LLC',
      description: 'Personal injury attorney and legal representation for accident victims',
      keywords: ['lawyer', 'attorney', 'legal', 'law firm']
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Legal Solutions - Experienced Attorneys',
          subheadline: 'Fighting for your rights',
          services: [],
          whyUs: [],
          ctaPrimary: 'Free Consultation'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://legalsolutions.com', { skipOptimize: true });

    expect(result.industry).toBe('lawyer');
  });

  it('pipeline returns correct result structure', async () => {
    const mockSiteData = {
      businessName: 'Test Business',
      description: 'Test description'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'Test Business',
          subheadline: 'Test subheadline',
          services: [],
          whyUs: [],
          ctaPrimary: 'Contact'
        })
      }]
    });

    const result = await rebuildAndDeploy('https://testbiz.com', { skipOptimize: true });

    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('siteData');
    expect(result).toHaveProperty('industry');
    expect(result).toHaveProperty('slots');
    expect(result).toHaveProperty('preview');
    expect(result).toHaveProperty('slug');
    expect(result).toHaveProperty('previewId');
    expect(result).toHaveProperty('validation');
    expect(result).toHaveProperty('status');

    expect(typeof result.html).toBe('string');
    expect(typeof result.preview).toBe('string');
    expect(result.preview).toMatch(/^\/preview\//);
  });

  it('pipeline saves preview to database', async () => {
    const mockSiteData = {
      businessName: 'DB Test Business',
      description: 'Testing database save'
    };

    scrapeSiteLite.mockResolvedValue(mockSiteData);

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          headline: 'DB Test Business',
          subheadline: 'Test',
          services: [],
          whyUs: [],
          ctaPrimary: 'Contact'
        })
      }]
    });

    await rebuildAndDeploy('https://dbtest.com', { skipOptimize: true });

    expect(createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'DB Test Business',
        html: expect.any(String),
        siteData: expect.any(Object),
        slots: expect.any(Object)
      })
    );
  });
});
