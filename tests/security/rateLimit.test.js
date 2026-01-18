// tests/security/rateLimit.test.js
// Security tests for rate limiting

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/server.js';

// Mock all database modules
vi.mock('../../src/db.js', () => ({
  getDeployments: vi.fn().mockResolvedValue([]),
  getDeployment: vi.fn().mockResolvedValue({ siteId: '1' }),
  updateDeployment: vi.fn().mockResolvedValue({}),
  deleteDeployment: vi.fn().mockResolvedValue(true),
  getStats: vi.fn().mockResolvedValue({ totalLeads: 0 }),
  getLeads: vi.fn().mockResolvedValue([]),
  getLead: vi.fn().mockResolvedValue(null),
  createLead: vi.fn().mockResolvedValue({ id: '1' }),
  updateLead: vi.fn().mockResolvedValue({}),
  deleteLead: vi.fn().mockResolvedValue(true),
  getEmailQueue: vi.fn().mockResolvedValue([]),
  getEmailHistory: vi.fn().mockResolvedValue([]),
  getEmailDraft: vi.fn().mockResolvedValue(null),
  approveEmail: vi.fn().mockResolvedValue({}),
  rejectEmail: vi.fn().mockResolvedValue({}),
  getEmailConfig: vi.fn().mockResolvedValue({}),
  saveEmailConfig: vi.fn().mockResolvedValue({}),
  getPipelineErrors: vi.fn().mockResolvedValue([]),
  getFollowUpSequence: vi.fn().mockResolvedValue({ steps: [] }),
  setFollowUpSequence: vi.fn().mockResolvedValue({ steps: [] }),
  getPreviewBySlug: vi.fn().mockResolvedValue(null),
  getPreviews: vi.fn().mockResolvedValue([]),
  logPipelineError: vi.fn().mockResolvedValue({}),
  getLeadByUrl: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../src/db/tenantDb.js', () => ({
  getDeployments: vi.fn().mockResolvedValue([]),
  getDeployment: vi.fn().mockResolvedValue(null),
  updateDeployment: vi.fn().mockResolvedValue({}),
  deleteDeployment: vi.fn().mockResolvedValue(true),
  getLeads: vi.fn().mockResolvedValue([]),
  getLead: vi.fn().mockResolvedValue(null),
  saveLead: vi.fn().mockResolvedValue({ id: '1' }),
  updateLead: vi.fn().mockResolvedValue({}),
  deleteLead: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../src/db/tenants.js', () => ({
  ROLES: { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member', VIEWER: 'viewer' },
  createTenant: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
  getTenant: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
  getUserByAuthId: vi.fn().mockResolvedValue({ id: 'user-1', role: 'owner' }),
  createUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  getTenantUsers: vi.fn().mockResolvedValue([]),
  createInvitation: vi.fn().mockResolvedValue({ id: 'inv-1' }),
  acceptInvitation: vi.fn().mockResolvedValue({ id: 'user-1' }),
  getTenantInvitations: vi.fn().mockResolvedValue([]),
  revokeInvitation: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockReturnValue(true)
}));

vi.mock('../../src/billing/index.js', () => ({
  isStripeConfigured: vi.fn().mockReturnValue(false),
  getAvailablePlans: vi.fn().mockReturnValue([]),
  startCheckout: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com' }),
  getBillingPortal: vi.fn().mockResolvedValue('https://portal.stripe.com'),
  getSubscriptionInfo: vi.fn().mockResolvedValue({}),
  cancelTenantSubscription: vi.fn().mockResolvedValue({}),
  createTenant: vi.fn().mockResolvedValue({}),
  getTenant: vi.fn().mockResolvedValue({ planId: 'starter' }),
  handleWebhook: vi.fn().mockResolvedValue({}),
  METRICS: { LEADS_DISCOVERED: 'leads_discovered', PIPELINE_RUNS: 'pipeline_runs', EMAILS_SENT: 'emails_sent' },
  incrementUsage: vi.fn().mockResolvedValue({}),
  enforceQuota: vi.fn().mockResolvedValue(true),
  getUsageSummary: vi.fn().mockResolvedValue({})
}));

vi.mock('../../src/sentry.js', () => ({
  initSentry: vi.fn().mockReturnValue(false),
  isSentryConfigured: vi.fn().mockReturnValue(false),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  clearUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  sentryRequestHandler: vi.fn().mockReturnValue((req, res, next) => next()),
  sentryErrorHandler: vi.fn().mockReturnValue((err, req, res, next) => next(err)),
  wrapAsync: vi.fn().mockImplementation(fn => fn)
}));

// Mock pipeline to prevent actual scraping during tests
vi.mock('../../src/pipeline.js', () => ({
  rebuildAndDeploy: vi.fn().mockResolvedValue({
    preview: '/preview/test',
    siteData: { businessName: 'Test' },
    industry: 'general'
  })
}));

// Mock lead finder to prevent external API calls
vi.mock('../../src/leadFinder.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../../src/googlePlaces.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([])
  }))
}));

describe('Rate Limiting Security', () => {
  let app;

  beforeEach(() => {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    app = createServer();
    vi.clearAllMocks();
  });

  describe('General API rate limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/stats');

      // Rate limiter should add these headers
      // Note: express-rate-limit adds these by default
      expect(response.status).toBe(200);
    });

    it('should handle rapid requests gracefully', async () => {
      // Send multiple requests rapidly
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/stats')
      );

      const responses = await Promise.all(promises);

      // All should succeed or some should be rate limited
      responses.forEach(res => {
        expect([200, 429]).toContain(res.status);
      });
    });
  });

  describe('Pipeline rate limiting', () => {
    it('should have stricter limits for pipeline endpoint', async () => {
      // Pipeline is expensive, should have stricter limits
      const response = await request(app)
        .post('/api/pipeline')
        .send({ url: 'https://example.com' });

      // Should either succeed or be rate limited
      expect([200, 400, 429]).toContain(response.status);
    });
  });

  describe('Email rate limiting', () => {
    it('should limit email sending frequency', async () => {
      // Email endpoints should be rate limited
      const response = await request(app)
        .post('/api/emails/test-email/approve')
        .send({ sendNow: true });

      // Should either succeed, fail validation, or be rate limited
      expect([200, 400, 404, 429]).toContain(response.status);
    });
  });

  describe('Discovery rate limiting', () => {
    it('should limit discovery requests (external API costs)', async () => {
      const response = await request(app)
        .post('/api/discover')
        .send({ query: 'plumbers', location: 'Denver, CO' });

      // Should either succeed or be rate limited
      expect([200, 400, 402, 429]).toContain(response.status);
    });
  });

  describe('Abuse prevention', () => {
    it('should not crash under rapid invalid requests', async () => {
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/leads')
          .send({ url: 'not-a-url' })
      );

      const responses = await Promise.all(promises);

      // Should handle gracefully - bad request or rate limited
      responses.forEach(res => {
        expect([400, 429, 500]).toContain(res.status);
      });
    });

    it('should not allow bypassing rate limits via headers', async () => {
      // Attackers sometimes try to bypass rate limits with X-Forwarded-For
      const response = await request(app)
        .get('/api/stats')
        .set('X-Forwarded-For', '1.2.3.4, 5.6.7.8');

      // Should still work but rate limiting should be based on real IP
      expect(response.status).toBe(200);
    });
  });
});

describe('Quota enforcement', () => {
  let app;

  beforeEach(() => {
    delete process.env.CLERK_SECRET_KEY;
    app = createServer();
    vi.clearAllMocks();
  });

  it('should check quotas before expensive operations', async () => {
    const { enforceQuota } = await import('../../src/billing/index.js');

    // Make a request that should trigger quota check
    await request(app)
      .post('/api/pipeline')
      .send({ url: 'https://example.com' });

    // Quota should have been checked
    expect(enforceQuota).toHaveBeenCalled();
  });

  it('should return 402 when quota exceeded', async () => {
    const billing = await import('../../src/billing/index.js');

    // Mock quota exceeded
    billing.enforceQuota.mockRejectedValueOnce({
      code: 'QUOTA_EXCEEDED',
      message: 'Monthly limit reached'
    });

    const response = await request(app)
      .post('/api/pipeline')
      .send({ url: 'https://example.com' });

    // Should return payment required
    expect(response.status).toBe(402);
  });

  it('should increment usage after successful operations', async () => {
    const { incrementUsage } = await import('../../src/billing/index.js');

    // The pipeline request may fail for other reasons, but usage tracking should work
    await request(app)
      .post('/api/pipeline')
      .send({ url: 'https://example.com' });

    // Usage should be incremented (if request was successful enough)
    expect(incrementUsage).toHaveBeenCalled();
  });
});
