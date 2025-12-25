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
  deleteLead: vi.fn()
}));

vi.mock('../src/outreach.js', () => ({
  OutreachManager: vi.fn().mockImplementation(() => ({
    sendInitialOutreach: vi.fn().mockResolvedValue({}),
    sendFollowUp: vi.fn().mockResolvedValue({})
  }))
}));

vi.mock('../src/netlifyDeploy.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    deleteSite: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('server', () => {
  let app;
  let db;

  beforeEach(async () => {
    vi.resetModules();

    db = await import('../src/db.js');
    const { createServer } = await import('../src/server.js');
    app = createServer();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/stats', () => {
    it('should return stats object', async () => {
      const mockStats = {
        totalLeads: 3,
        totalDeployments: 3,
        byStatus: { pending: 1, emailed: 1, converted: 1 },
        byIndustry: { plumbing: 2, hvac: 1 },
        conversionRate: '33.3',
        activeDeployments: 3
      };

      db.getStats.mockResolvedValue(mockStats);

      // Create a mock request/response
      const req = {};
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      // Get the route handler
      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/stats' && r.route.methods.get
      );

      if (route) {
        await route.route.stack[0].handle(req, res);
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

      db.getDeployments.mockResolvedValue(mockDeployments);

      const req = { query: { status: 'pending' } };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments' && r.route.methods.get
      );

      if (route) {
        await route.route.stack[0].handle(req, res);
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

      db.getDeployments.mockResolvedValue(mockDeployments);

      const req = { query: { search: 'plumber' } };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments' && r.route.methods.get
      );

      if (route) {
        await route.route.stack[0].handle(req, res);
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

      db.updateDeployment.mockResolvedValue(updatedDeployment);

      const req = {
        params: { siteId: '1' },
        body: { status: 'converted' }
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments/:siteId' && r.route.methods.patch
      );

      if (route) {
        await route.route.stack[0].handle(req, res);
        expect(db.updateDeployment).toHaveBeenCalledWith('1', { status: 'converted' });
        expect(res.json).toHaveBeenCalledWith(updatedDeployment);
      }
    });
  });

  describe('DELETE /api/deployments/:siteId', () => {
    it('should delete deployment', async () => {
      db.deleteDeployment.mockResolvedValue(undefined);

      const req = {
        params: { siteId: '1' },
        query: {}
      };
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res)
      };

      const route = app._router.stack.find(
        r => r.route && r.route.path === '/api/deployments/:siteId' && r.route.methods.delete
      );

      if (route) {
        await route.route.stack[0].handle(req, res);
        expect(db.deleteDeployment).toHaveBeenCalledWith('1');
        expect(res.json).toHaveBeenCalledWith({ success: true });
      }
    });
  });
});
