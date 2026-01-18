// tests/server.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing server
vi.mock('../src/db.js', () => ({
  getDeployments: vi.fn(),
  getDeployment: vi.fn(),
  updateDeployment: vi.fn(),
  deleteDeployment: vi.fn(),
  saveDeployment: vi.fn(),
  getStats: vi.fn(),
  getLeads: vi.fn(),
  getLead: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  getPreviewBySlug: vi.fn(),
  incrementViewCount: vi.fn(),
  getPreviews: vi.fn(),
  deletePreview: vi.fn(),
  cleanupExpiredPreviews: vi.fn(),
  recordAnalyticsEvent: vi.fn(),
  getPreviewAnalytics: vi.fn(),
  getEmailQueue: vi.fn(),
  getEmailHistory: vi.fn(),
  getEmailDraft: vi.fn(),
  approveEmail: vi.fn(),
  rejectEmail: vi.fn(),
  getEmailConfig: vi.fn(),
  saveEmailConfig: vi.fn(),
  getPipelineErrors: vi.fn(),
  logPipelineError: vi.fn(),
  getLeadByUrl: vi.fn()
}));

vi.mock('../src/db/tenantDb.js', () => ({
  getTenantId: vi.fn(() => 'test-tenant'),
  getDeployments: vi.fn(),
  getDeployment: vi.fn(),
  saveDeployment: vi.fn(),
  updateDeployment: vi.fn(),
  deleteDeployment: vi.fn(),
  getLeads: vi.fn(),
  getLead: vi.fn(),
  saveLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  getEmails: vi.fn(),
  getEmail: vi.fn(),
  saveEmail: vi.fn(),
  updateEmail: vi.fn(),
  deleteEmail: vi.fn(),
  getAnalytics: vi.fn(),
  saveAnalytics: vi.fn()
}));

vi.mock('../src/db/tenants.js', () => ({
  ROLES: { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member', VIEWER: 'viewer' },
  PERMISSIONS: {},
  createTenant: vi.fn(),
  getTenant: vi.fn(),
  getTenantBySlug: vi.fn(),
  updateTenant: vi.fn(),
  deleteTenant: vi.fn(),
  createUser: vi.fn(),
  getUser: vi.fn(),
  getUserByAuthId: vi.fn(),
  getUserByEmail: vi.fn(),
  getTenantUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  createInvitation: vi.fn(),
  getInvitationByToken: vi.fn(),
  acceptInvitation: vi.fn(),
  getTenantInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
  hasPermission: vi.fn(() => true),
  canAccessTenant: vi.fn(() => true)
}));

vi.mock('../src/outreach.js', () => ({
  OutreachManager: vi.fn().mockImplementation(() => ({
    sendInitialOutreach: vi.fn().mockResolvedValue({}),
    sendFollowUp: vi.fn().mockResolvedValue({})
  }))
}));

/**
 * Helper to run through middleware chain for a route
 * Handles auth middleware that needs `next` function
 */
async function executeRouteWithMiddleware(route, req, res) {
  const handlers = route.route.stack;
  let handlerIndex = 0;

  // Add auth context for dev mode (NODE_ENV=test triggers dev mode in auth)
  req.auth = req.auth || { userId: 'test-user', sessionId: 'test-session' };
  req.ip = req.ip || '127.0.0.1';
  req.get = req.get || (() => 'test-user-agent');

  const next = async (err) => {
    if (err) throw err;
    handlerIndex++;
    if (handlerIndex < handlers.length) {
      await handlers[handlerIndex].handle(req, res, next);
    }
  };

  await handlers[0].handle(req, res, next);
}

describe('server', () => {
  let app;
  let db;
  let tenantDb;

  beforeEach(async () => {
    vi.resetModules();

    db = await import('../src/db.js');
    tenantDb = await import('../src/db/tenantDb.js');
    const { createServer } = await import('../src/server.js');
    app = createServer();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/stats', () => {
    it('should return stats object', async () => {
      const mockDeployments = [
        { siteId: '1', status: 'pending', industry: 'plumbing' },
        { siteId: '2', status: 'emailed', industry: 'plumbing' },
        { siteId: '3', status: 'converted', industry: 'hvac' }
      ];

      // Mock tenantDb for authenticated requests
      tenantDb.getDeployments.mockResolvedValue(mockDeployments);

      // Create a mock request/response with auth context
      const req = {
        auth: { userId: 'test-user', sessionId: 'test-session' },
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      // Get the route handler
      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/stats' && r.route.methods.get
      );

      if (route) {
        await executeRouteWithMiddleware(route, req, res);
        expect(res.json).toHaveBeenCalled();
        const stats = res.json.mock.calls[0][0];
        expect(stats.totalLeads).toBe(3);
        expect(stats.byStatus.pending).toBe(1);
        expect(stats.byStatus.converted).toBe(1);
        expect(stats.byIndustry.plumbing).toBe(2);
      }
    });
  });

  describe('GET /api/deployments', () => {
    it('should return filtered deployments', async () => {
      const mockDeployments = [
        { siteId: '1', status: 'pending', businessName: 'Test A' },
        { siteId: '2', status: 'emailed', businessName: 'Test B' }
      ];

      // Mock tenantDb for authenticated requests
      tenantDb.getDeployments.mockResolvedValue(mockDeployments);

      const req = {
        query: { status: 'pending' },
        auth: { userId: 'test-user', sessionId: 'test-session' },
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments' && r.route.methods.get
      );

      if (route) {
        await executeRouteWithMiddleware(route, req, res);
        expect(res.json).toHaveBeenCalled();
        const deployments = res.json.mock.calls[0][0];
        expect(deployments.length).toBe(1);
        expect(deployments[0].status).toBe('pending');
      }
    });

    it('should search deployments', async () => {
      const mockDeployments = [
        { siteId: '1', businessName: 'Plumber Pro', industry: 'plumbing' },
        { siteId: '2', businessName: 'HVAC Expert', industry: 'hvac' }
      ];

      // Mock tenantDb for authenticated requests
      tenantDb.getDeployments.mockResolvedValue(mockDeployments);

      const req = {
        query: { search: 'plumber' },
        auth: { userId: 'test-user', sessionId: 'test-session' },
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments' && r.route.methods.get
      );

      if (route) {
        await executeRouteWithMiddleware(route, req, res);
        const deployments = res.json.mock.calls[0][0];
        expect(deployments.length).toBe(1);
        expect(deployments[0].businessName).toBe('Plumber Pro');
      }
    });
  });

  describe('PATCH /api/deployments/:siteId', () => {
    it('should update deployment status', async () => {
      const mockDeployment = { siteId: '1', status: 'pending' };
      const updatedDeployment = { ...mockDeployment, status: 'converted' };

      // Mock tenantDb for authenticated requests
      tenantDb.updateDeployment.mockResolvedValue(updatedDeployment);

      const req = {
        params: { siteId: '1' },
        body: { status: 'converted' },
        auth: { userId: 'test-user', sessionId: 'test-session' },
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments/:siteId' && r.route.methods.patch
      );

      if (route) {
        await executeRouteWithMiddleware(route, req, res);
        expect(tenantDb.updateDeployment).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(updatedDeployment);
      }
    });
  });

  describe('DELETE /api/deployments/:siteId', () => {
    it('should delete deployment', async () => {
      // Mock tenantDb for authenticated requests
      tenantDb.deleteDeployment.mockResolvedValue(undefined);

      const req = {
        params: { siteId: '1' },
        query: {},
        auth: { userId: 'test-user', sessionId: 'test-session' },
        ip: '127.0.0.1',
        get: () => 'test-user-agent'
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments/:siteId' && r.route.methods.delete
      );

      if (route) {
        await executeRouteWithMiddleware(route, req, res);
        expect(tenantDb.deleteDeployment).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true });
      }
    });
  });
});
