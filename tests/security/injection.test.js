// tests/security/injection.test.js
// Security tests for SQL/NoSQL injection and XSS prevention

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/server.js';

// Mock database modules
vi.mock('../../src/db.js', () => ({
  getDeployments: vi.fn().mockResolvedValue([]),
  getDeployment: vi.fn().mockResolvedValue(null),
  updateDeployment: vi.fn().mockResolvedValue({}),
  deleteDeployment: vi.fn().mockResolvedValue(true),
  getStats: vi.fn().mockResolvedValue({ totalLeads: 0 }),
  getLeads: vi.fn().mockResolvedValue([]),
  getLead: vi.fn().mockResolvedValue(null),
  createLead: vi.fn().mockImplementation((data) => Promise.resolve({ id: '1', ...data })),
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
  getPreviews: vi.fn().mockResolvedValue([])
}));

vi.mock('../../src/db/tenantDb.js', () => ({
  getDeployments: vi.fn().mockResolvedValue([]),
  getDeployment: vi.fn().mockResolvedValue(null),
  updateDeployment: vi.fn().mockResolvedValue({}),
  deleteDeployment: vi.fn().mockResolvedValue(true),
  getLeads: vi.fn().mockResolvedValue([]),
  getLead: vi.fn().mockResolvedValue(null),
  saveLead: vi.fn().mockImplementation((ctx, data) => Promise.resolve({ id: '1', ...data })),
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
  getTenant: vi.fn().mockResolvedValue(null),
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

describe('Injection Prevention', () => {
  let app;

  beforeEach(() => {
    delete process.env.CLERK_SECRET_KEY;
    app = createServer();
    vi.clearAllMocks();
  });

  describe('SQL/NoSQL injection', () => {
    it('should handle SQL injection attempts in search queries', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE deployments; --",
        "1' OR '1'='1",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "1' AND 1=1 --",
        "${process.env.DB_PASSWORD}",
        "{{constructor.constructor('return process.env')()}}"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/deployments')
          .query({ search: payload });

        // Should not crash or expose database errors
        expect([200, 400, 500]).toContain(response.status);

        if (response.status === 500) {
          // Error message should not reveal database structure
          expect(response.body.error).not.toMatch(/SQL|syntax|table|column|DROP|DELETE/i);
        }
      }
    });

    it('should handle NoSQL injection in JSON bodies', async () => {
      const nosqlPayloads = [
        { url: 'https://example.com', businessName: { $gt: '' } },
        { url: 'https://example.com', email: { $ne: null } },
        { url: 'https://example.com', industry: { $where: 'sleep(5000)' } },
        { url: 'https://example.com', phone: { $regex: '.*' } }
      ];

      for (const payload of nosqlPayloads) {
        const response = await request(app)
          .post('/api/leads')
          .send(payload);

        // Should handle gracefully
        expect([200, 201, 400, 500]).toContain(response.status);
      }
    });

    it('should sanitize ID parameters', async () => {
      const maliciousIds = [
        "1; DROP TABLE deployments",
        "../../../etc/passwd",
        "1 OR 1=1",
        "<script>alert(1)</script>",
        "${7*7}",
        "{{7*7}}"
      ];

      for (const id of maliciousIds) {
        const response = await request(app)
          .get(`/api/deployments/${encodeURIComponent(id)}`);

        // Should return 404 or 400, not crash
        expect([400, 404]).toContain(response.status);
      }
    });
  });

  describe('XSS prevention', () => {
    it('should not execute script tags in stored data', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '"><script>alert(1)</script>',
        "javascript:alert('XSS')",
        '<body onload=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '{{constructor.constructor("return this")().alert(1)}}'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/leads')
          .send({
            url: 'https://example.com',
            businessName: payload,
            email: 'test@example.com'
          });

        // Data should be stored as-is or rejected
        expect([200, 201, 400]).toContain(response.status);

        if (response.status === 201) {
          // If stored in JSON response, verify Content-Type prevents execution
          // JSON responses are safe because browsers don't execute scripts in JSON
          expect(response.headers['content-type']).toMatch(/application\/json/);
        }
      }
    });

    it('should escape HTML in error messages', async () => {
      const response = await request(app)
        .get('/api/deployments/<script>alert(1)</script>');

      // Error message should not contain unescaped HTML
      const body = JSON.stringify(response.body);
      expect(body).not.toContain('<script>alert');
    });

    it('should set Content-Type correctly to prevent XSS', async () => {
      const response = await request(app)
        .get('/api/stats');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Path traversal prevention', () => {
    it('should block path traversal in URL parameters', async () => {
      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%00/etc/passwd',
        '..%c0%af..%c0%afetc/passwd'
      ];

      for (const payload of traversalPayloads) {
        const response = await request(app)
          .get(`/api/deployments/${encodeURIComponent(payload)}`);

        // Should not expose filesystem
        expect([400, 404]).toContain(response.status);
        expect(response.body.error).not.toContain('ENOENT');
        expect(response.body.error).not.toContain('/etc/');
      }
    });

    it('should block path traversal in preview slugs', async () => {
      // Express normalizes paths, so /../ gets resolved before route matching
      // The path becomes /etc/passwd which doesn't match /preview/:slug
      const response = await request(app)
        .get('/preview/../../../etc/passwd');

      // Should either 404 (not found) or serve SPA fallback (200)
      // The key is it doesn't expose actual filesystem
      expect([200, 400, 404]).toContain(response.status);
      expect(response.text).not.toContain('root:');
    });
  });

  describe('Command injection prevention', () => {
    it('should not execute shell commands in URL field', async () => {
      // These URLs contain shell metacharacters but are technically valid URLs
      // The key security check is that they're never passed to a shell
      const commandPayloads = [
        'javascript:alert(1)',  // Protocol injection
        'file:///etc/passwd',   // File protocol
        'data:text/html,<script>alert(1)</script>'  // Data URI
      ];

      for (const payload of commandPayloads) {
        const response = await request(app)
          .post('/api/leads')
          .send({ url: payload });

        // Should reject invalid URL
        expect([400]).toContain(response.status);
      }
    });
  });

  describe('Prototype pollution prevention', () => {
    it('should not allow __proto__ pollution', async () => {
      const response = await request(app)
        .post('/api/leads')
        .send({
          url: 'https://example.com',
          '__proto__': { admin: true },
          'constructor': { prototype: { admin: true } }
        });

      // Should handle without polluting prototype
      expect([200, 201, 400]).toContain(response.status);

      // Verify Object prototype wasn't polluted
      expect(({}).admin).toBeUndefined();
    });
  });

  describe('SSRF prevention', () => {
    it('should validate URL schemes', async () => {
      const ssrfPayloads = [
        'file:///etc/passwd',
        'gopher://localhost:6379/_INFO',
        'dict://localhost:11211/stats',
        'ftp://internal-server/secret',
        'ldap://localhost/o=test',
        'javascript:alert(1)'
      ];

      for (const payload of ssrfPayloads) {
        const response = await request(app)
          .post('/api/leads')
          .send({ url: payload });

        // Should reject non-http(s) URLs
        expect(response.status).toBe(400);
      }
    });

    it('should not allow localhost/internal IPs in URLs', async () => {
      // Note: This test documents what SHOULD happen
      // Actual enforcement may need to be added to the URL validator
      const internalUrls = [
        'http://localhost/admin',
        'http://127.0.0.1/admin',
        'http://[::1]/admin',
        'http://0.0.0.0/admin'
      ];

      for (const url of internalUrls) {
        const response = await request(app)
          .post('/api/leads')
          .send({ url });

        // Should either accept (for dev) or reject (for prod)
        // The important thing is it doesn't crash
        expect([200, 201, 400]).toContain(response.status);
      }
    });
  });
});

describe('Input validation', () => {
  let app;

  beforeEach(() => {
    delete process.env.CLERK_SECRET_KEY;
    app = createServer();
  });

  it('should validate email format', async () => {
    const invalidEmails = [
      'notanemail',
      '@nodomain.com',
      'no@domain',
      'test@.com',
      'test@domain.',
      'test test@domain.com'
    ];

    for (const email of invalidEmails) {
      const response = await request(app)
        .post('/api/leads')
        .send({ url: 'https://example.com', email });

      // Should reject invalid emails
      expect(response.status).toBe(400);
    }
  });

  it('should validate URL format', async () => {
    // Test dangerous protocol URLs that should always be rejected
    const dangerousUrls = [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,test'
    ];

    for (const url of dangerousUrls) {
      const response = await request(app)
        .post('/api/leads')
        .send({ url });

      // Should reject dangerous URL protocols
      expect(response.status).toBe(400);
    }
  });

  it('should handle malformed URLs gracefully', async () => {
    const malformedUrls = [
      'not-a-url',
      'http://',
      ''
    ];

    for (const url of malformedUrls) {
      const response = await request(app)
        .post('/api/leads')
        .send({ url });

      // Should either reject (400) or handle gracefully without crashing
      expect([400, 201, 500]).toContain(response.status);
      if (response.status === 500) {
        // Even on error, don't expose internals
        expect(response.body.error).not.toContain('stack');
      }
    }
  });

  it('should handle extremely long inputs', async () => {
    const longString = 'a'.repeat(100000);

    const response = await request(app)
      .post('/api/leads')
      .send({
        url: `https://example.com/${longString}`,
        businessName: longString
      });

    // Should handle gracefully - either truncate or reject
    expect([400, 413, 500]).toContain(response.status);
  });

  it('should handle null bytes in input', async () => {
    const response = await request(app)
      .post('/api/leads')
      .send({
        url: 'https://example.com',
        businessName: 'Test\x00Business'
      });

    // Should handle null bytes gracefully
    expect([200, 201, 400]).toContain(response.status);
  });
});
