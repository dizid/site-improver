// src/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import * as db from './db.js';
import * as tenantDb from './db/tenantDb.js';
import {
  initSentry,
  isSentryConfigured,
  captureException,
  setUser as setSentryUser,
  sentryRequestHandler,
  sentryErrorHandler
} from './sentry.js';
import {
  ROLES,
  createTenant as createTenantRecord,
  getTenant as getTenantRecord,
  getUserByAuthId,
  createUser,
  getTenantUsers,
  createInvitation,
  acceptInvitation,
  getTenantInvitations,
  revokeInvitation,
  hasPermission
} from './db/tenants.js';
import { OutreachManager } from './outreach.js';
import logger from './logger.js';
import { CONFIG, validateStartup } from './config.js';
import { validateUrl, validateEmail } from './utils.js';
import { pipelineEvents, PIPELINE_STAGES } from './pipelineEvents.js';
import {
  initClerkMiddleware,
  requireAuth,
  optionalAuth,
  getUserContext,
  generalLimiter,
  pipelineLimiter,
  discoveryLimiter,
  emailLimiter,
  initAuditLog,
  logAudit,
  AUDIT_ACTIONS,
  isAuthConfigured
} from './auth/index.js';
import {
  isStripeConfigured,
  getAvailablePlans,
  startCheckout,
  getBillingPortal,
  getSubscriptionInfo,
  cancelTenantSubscription,
  createTenant,
  getTenant,
  handleWebhook,
  METRICS,
  incrementUsage,
  enforceQuota,
  getUsageSummary
} from './billing/index.js';

const log = logger.child('server');

// ==================== ERROR HANDLING ====================

/**
 * Custom API error class with status code
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new ApiError(message, 400, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(message, 404, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new ApiError(message, 500, code);
  }
}

/**
 * Wrap async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Handle both ESM and bundled CJS environments
const __dirname = import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : process.cwd();

export function createServer(config = {}) {
  const app = express();

  // Initialize Sentry error tracking (if configured)
  const sentryEnabled = initSentry();
  if (sentryEnabled) {
    // Sentry request handler must be the first middleware
    app.use(sentryRequestHandler());
    log.info('Sentry error tracking enabled');
  }

  // CORS configuration - restrict to known origins
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (CONFIG.server.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        log.warn('CORS blocked request from:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
  app.use(cors(corsOptions));
  app.use(express.json());

  // Initialize authentication (Clerk)
  app.use(initClerkMiddleware());

  // Initialize audit logging
  initAuditLog();

  // Apply general rate limiting to all API routes
  app.use('/api/', generalLimiter);

  // Serve static dashboard files
  app.use(express.static(path.join(__dirname, '../dashboard/dist')));

  // ==================== PUBLIC ROUTES (no auth) ====================
  // Health check and preview routes remain public

  // API Routes (protected)
  
  // Get all deployments with optional filters
  // Protected: requires auth for tenant isolation
  app.get('/api/deployments', optionalAuth(), async (req, res) => {
    try {
      const { status, search, sort = 'createdAt', order = 'desc' } = req.query;
      const context = getUserContext(req);

      // Use tenant-aware query if authenticated
      let deployments;
      if (context.tenantId) {
        deployments = await tenantDb.getDeployments(context);
      } else {
        deployments = await db.getDeployments();
      }

      // Filter by status
      if (status && status !== 'all') {
        deployments = deployments.filter(d => d.status === status);
      }

      // Search
      if (search) {
        const s = search.toLowerCase();
        deployments = deployments.filter(d =>
          d.businessName?.toLowerCase().includes(s) ||
          d.email?.toLowerCase().includes(s) ||
          d.industry?.toLowerCase().includes(s)
        );
      }

      // Sort
      deployments.sort((a, b) => {
        const aVal = a[sort] || '';
        const bVal = b[sort] || '';
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === 'desc' ? -cmp : cmp;
      });

      res.json(deployments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get stats (uses new db.getStats if available)
  // Protected: requires auth for tenant isolation
  app.get('/api/stats', optionalAuth(), async (req, res) => {
    try {
      const context = getUserContext(req);

      // Get tenant-specific deployments
      let deployments;
      if (context.tenantId) {
        deployments = await tenantDb.getDeployments(context);
      } else if (db.getStats) {
        // Try the new stats function for global stats
        const stats = await db.getStats();
        res.json(stats);
        return;
      } else {
        deployments = await db.getDeployments();
      }

      const stats = {
        totalLeads: deployments.length,
        totalDeployments: deployments.length,
        byStatus: {},
        byIndustry: {},
        conversionRate: 0,
        activeDeployments: deployments.filter(d => d.status !== 'deleted' && d.status !== 'expired').length
      };

      // Count by status
      deployments.forEach(d => {
        const status = d.status || 'pending';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        const ind = d.industry || 'unknown';
        stats.byIndustry[ind] = (stats.byIndustry[ind] || 0) + 1;
      });

      // Calculate conversion rate
      const converted = stats.byStatus.converted || 0;
      stats.conversionRate = deployments.length > 0
        ? ((converted / deployments.length) * 100).toFixed(1)
        : 0;

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get pipeline errors
  app.get('/api/errors', async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      const errors = await db.getPipelineErrors(parseInt(limit));
      res.json(errors);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== LEADS API ====================

  // Get all leads
  // Protected: requires auth for tenant isolation
  app.get('/api/leads', optionalAuth(), async (req, res) => {
    try {
      const { status, industry, search, limit } = req.query;
      const context = getUserContext(req);
      const filters = {};

      if (status && status !== 'all') filters.status = status;
      if (industry) filters.industry = industry;
      if (limit) filters.limit = parseInt(limit);

      // Use tenant-aware query if authenticated
      let leads;
      if (context.tenantId) {
        leads = await tenantDb.getLeads(context, filters);
      } else {
        leads = await db.getLeads(filters);
      }

      // Search filter (applied after db query for flexibility)
      if (search) {
        const s = search.toLowerCase();
        leads = leads.filter(l =>
          (l.businessName || '').toLowerCase().includes(s) ||
          (l.email || '').toLowerCase().includes(s) ||
          (l.industry || '').toLowerCase().includes(s) ||
          (l.url || '').toLowerCase().includes(s)
        );
      }

      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single lead
  // Protected: requires auth for tenant isolation
  app.get('/api/leads/:leadId', optionalAuth(), async (req, res) => {
    try {
      const context = getUserContext(req);

      // Use tenant-aware query if authenticated
      let lead;
      if (context.tenantId) {
        lead = await tenantDb.getLead(context, req.params.leadId);
      } else {
        lead = await db.getLead(req.params.leadId);
      }

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create lead (for manual entry)
  // Protected: requires auth for tenant association
  app.post('/api/leads', optionalAuth(), async (req, res) => {
    try {
      const { url, businessName, email, phone, industry, country } = req.body;
      const context = getUserContext(req);

      // Validate URL
      const urlResult = validateUrl(url);
      if (!urlResult.valid) {
        return res.status(400).json({ error: urlResult.error });
      }

      // Validate email if provided
      if (email) {
        const emailResult = validateEmail(email);
        if (!emailResult.valid) {
          return res.status(400).json({ error: emailResult.error });
        }
      }

      // Use tenant-aware save if authenticated
      let lead;
      if (context.tenantId) {
        lead = await tenantDb.saveLead(context, {
          url: urlResult.normalized,
          businessName,
          email,
          phone,
          industry,
          country
        });
      } else {
        lead = await db.createLead({
          url: urlResult.normalized,
          businessName,
          email,
          phone,
          industry,
          country
        });
      }

      res.status(201).json(lead);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update lead
  // Protected: requires auth + tenant isolation
  app.patch('/api/leads/:leadId', requireAuth(), async (req, res) => {
    try {
      const { status, notes, businessName, email, phone, industry } = req.body;
      const context = getUserContext(req);
      const updates = {};

      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (businessName) updates.businessName = businessName;
      if (email) updates.email = email;
      if (phone) updates.phone = phone;
      if (industry) updates.industry = industry;

      logAudit(AUDIT_ACTIONS.LEAD_UPDATE, req, {
        resource: 'lead',
        resourceId: req.params.leadId,
        metadata: updates
      });

      // Use tenant-aware update
      const lead = await tenantDb.updateLead(context, req.params.leadId, updates);
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete lead
  // Protected: requires auth + audit + tenant isolation
  app.delete('/api/leads/:leadId', requireAuth(), async (req, res) => {
    try {
      const context = getUserContext(req);

      logAudit(AUDIT_ACTIONS.LEAD_DELETE, req, {
        resource: 'lead',
        resourceId: req.params.leadId
      });

      // Use tenant-aware delete
      await tenantDb.deleteLead(context, req.params.leadId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send email for lead
  // Protected: requires auth + email rate limit + quota
  app.post('/api/leads/:leadId/send-email', requireAuth(), emailLimiter, async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const context = getUserContext(req);

      // Check email quota
      const tenant = await getTenant(context.tenantId);
      const planId = tenant?.planId || 'starter';
      try {
        await enforceQuota(context.tenantId, METRICS.EMAILS_SENT, planId);
      } catch (quotaError) {
        if (quotaError.code === 'QUOTA_EXCEEDED') {
          return res.status(402).json({
            error: quotaError.message,
            code: 'QUOTA_EXCEEDED',
            quota: quotaError.quota
          });
        }
        throw quotaError;
      }

      const lead = await db.getLead(req.params.leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      logAudit(AUDIT_ACTIONS.EMAIL_SEND, req, {
        resource: 'lead',
        resourceId: req.params.leadId,
        metadata: { to: lead.email }
      });

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      await outreach.sendInitialOutreach(lead);

      // Increment usage
      await incrementUsage(context.tenantId, METRICS.EMAILS_SENT);

      // Update lead status
      await db.updateLead(req.params.leadId, { status: 'emailing' });

      const updated = await db.getLead(req.params.leadId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single deployment
  // Protected: requires auth for tenant isolation
  app.get('/api/deployments/:siteId', optionalAuth(), async (req, res) => {
    try {
      const context = getUserContext(req);

      // Use tenant-aware query if authenticated
      let deployment;
      if (context.tenantId) {
        deployment = await tenantDb.getDeployment(context, req.params.siteId);
      } else {
        deployment = await db.getDeployment(req.params.siteId);
      }

      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update deployment status
  // Protected: requires auth + tenant isolation
  app.patch('/api/deployments/:siteId', requireAuth(), async (req, res) => {
    try {
      const { status, notes } = req.body;
      const context = getUserContext(req);
      const updates = {};

      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      logAudit(AUDIT_ACTIONS.DEPLOYMENT_UPDATE, req, {
        resource: 'deployment',
        resourceId: req.params.siteId,
        metadata: updates
      });

      // Use tenant-aware update
      const deployment = await tenantDb.updateDeployment(context, req.params.siteId, updates);
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete deployment
  // Protected: requires auth + audit + tenant isolation
  app.delete('/api/deployments/:siteId', requireAuth(), async (req, res) => {
    try {
      const context = getUserContext(req);

      logAudit(AUDIT_ACTIONS.DEPLOYMENT_DELETE, req, {
        resource: 'deployment',
        resourceId: req.params.siteId
      });

      // Use tenant-aware delete
      await tenantDb.deleteDeployment(context, req.params.siteId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send outreach email
  // Protected: requires auth + email rate limit + quota
  app.post('/api/deployments/:siteId/send-email', requireAuth(), emailLimiter, async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const context = getUserContext(req);

      // Check email quota
      const tenant = await getTenant(context.tenantId);
      const planId = tenant?.planId || 'starter';
      try {
        await enforceQuota(context.tenantId, METRICS.EMAILS_SENT, planId);
      } catch (quotaError) {
        if (quotaError.code === 'QUOTA_EXCEEDED') {
          return res.status(402).json({
            error: quotaError.message,
            code: 'QUOTA_EXCEEDED',
            quota: quotaError.quota
          });
        }
        throw quotaError;
      }

      const deployment = await db.getDeployment(req.params.siteId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      logAudit(AUDIT_ACTIONS.EMAIL_SEND, req, {
        resource: 'deployment',
        resourceId: req.params.siteId,
        metadata: { to: deployment.email }
      });

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      await outreach.sendInitialOutreach(deployment);

      // Increment usage
      await incrementUsage(context.tenantId, METRICS.EMAILS_SENT);

      const updated = await db.getDeployment(req.params.siteId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send follow-up email
  // Protected: requires auth + email rate limit + quota
  app.post('/api/deployments/:siteId/send-followup', requireAuth(), emailLimiter, async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const context = getUserContext(req);
      const { attempt = 1 } = req.body;

      // Check email quota
      const tenant = await getTenant(context.tenantId);
      const planId = tenant?.planId || 'starter';
      try {
        await enforceQuota(context.tenantId, METRICS.EMAILS_SENT, planId);
      } catch (quotaError) {
        if (quotaError.code === 'QUOTA_EXCEEDED') {
          return res.status(402).json({
            error: quotaError.message,
            code: 'QUOTA_EXCEEDED',
            quota: quotaError.quota
          });
        }
        throw quotaError;
      }

      const deployment = await db.getDeployment(req.params.siteId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      logAudit(AUDIT_ACTIONS.EMAIL_SEND, req, {
        resource: 'deployment',
        resourceId: req.params.siteId,
        metadata: { type: 'followup', attempt, to: deployment.email }
      });

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      await outreach.sendFollowUp(deployment, attempt);

      // Increment usage
      await incrementUsage(context.tenantId, METRICS.EMAILS_SENT);

      const updated = await db.getDeployment(req.params.siteId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== EMAIL QUEUE ====================

  // Get email queue
  app.get('/api/emails/queue', async (req, res) => {
    try {
      const { status, limit } = req.query;
      const queue = await db.getEmailQueue({
        status: status || undefined,
        limit: limit ? parseInt(limit) : 50
      });
      res.json(queue);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get email history
  app.get('/api/emails/history', async (req, res) => {
    try {
      const { status, limit } = req.query;
      const history = await db.getEmailHistory({
        status: status || undefined,
        limit: limit ? parseInt(limit) : 50
      });
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single email (for preview)
  app.get('/api/emails/:emailId', async (req, res) => {
    try {
      const email = await db.getEmailDraft(req.params.emailId);
      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }
      res.json(email);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Approve email
  // Protected: requires auth + email rate limit + audit + quota
  app.post('/api/emails/:emailId/approve', requireAuth(), emailLimiter, async (req, res) => {
    try {
      const { sendNow } = req.body;
      const context = getUserContext(req);

      // Audit log email approval
      logAudit(AUDIT_ACTIONS.EMAIL_APPROVE, req, {
        resource: 'email',
        resourceId: req.params.emailId,
        metadata: { sendNow }
      });

      // Pass user context for audit trail
      const email = await db.approveEmail(req.params.emailId, context);

      // Optionally send immediately after approval
      if (sendNow) {
        if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
          return res.status(400).json({ error: 'Email not configured' });
        }

        // Check email quota before sending
        const tenant = await getTenant(context.tenantId);
        const planId = tenant?.planId || 'starter';
        try {
          await enforceQuota(context.tenantId, METRICS.EMAILS_SENT, planId);
        } catch (quotaError) {
          if (quotaError.code === 'QUOTA_EXCEEDED') {
            return res.status(402).json({
              error: quotaError.message,
              code: 'QUOTA_EXCEEDED',
              quota: quotaError.quota,
              approved: true,
              sent: false
            });
          }
          throw quotaError;
        }

        const outreach = new OutreachManager({
          resendApiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.FROM_EMAIL
        });

        await outreach.sendFromQueue(req.params.emailId);

        // Increment usage
        await incrementUsage(context.tenantId, METRICS.EMAILS_SENT);

        logAudit(AUDIT_ACTIONS.EMAIL_SEND, req, {
          resource: 'email',
          resourceId: req.params.emailId
        });
        return res.json({ approved: true, sent: true });
      }

      res.json({ approved: true, email });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reject email
  // Protected: requires auth + audit
  app.post('/api/emails/:emailId/reject', requireAuth(), async (req, res) => {
    try {
      const { reason } = req.body;
      const context = getUserContext(req);

      logAudit(AUDIT_ACTIONS.EMAIL_REJECT, req, {
        resource: 'email',
        resourceId: req.params.emailId,
        metadata: { reason }
      });

      // Pass user context for audit trail
      const email = await db.rejectEmail(req.params.emailId, reason, context);
      res.json({ rejected: true, email });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send approved email from queue
  // Protected: requires auth + email rate limit + audit + quota
  app.post('/api/emails/:emailId/send', requireAuth(), emailLimiter, async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const context = getUserContext(req);

      // Check email quota
      const tenant = await getTenant(context.tenantId);
      const planId = tenant?.planId || 'starter';
      try {
        await enforceQuota(context.tenantId, METRICS.EMAILS_SENT, planId);
      } catch (quotaError) {
        if (quotaError.code === 'QUOTA_EXCEEDED') {
          return res.status(402).json({
            error: quotaError.message,
            code: 'QUOTA_EXCEEDED',
            quota: quotaError.quota
          });
        }
        throw quotaError;
      }

      logAudit(AUDIT_ACTIONS.EMAIL_SEND, req, {
        resource: 'email',
        resourceId: req.params.emailId
      });

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      const result = await outreach.sendFromQueue(req.params.emailId);

      // Increment usage
      await incrementUsage(context.tenantId, METRICS.EMAILS_SENT);

      res.json({ sent: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get email config
  app.get('/api/config/email', async (req, res) => {
    try {
      const config = await db.getEmailConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update email config
  // Protected: requires auth + audit (admin action)
  app.patch('/api/config/email', requireAuth(), async (req, res) => {
    try {
      const { autoSendEnabled, requireApproval } = req.body;

      // Audit log config change
      logAudit(AUDIT_ACTIONS.CONFIG_UPDATE, req, {
        resource: 'config',
        resourceId: 'email',
        metadata: { autoSendEnabled, requireApproval }
      });

      const config = await db.saveEmailConfig({
        autoSendEnabled,
        requireApproval
      });
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== FOLLOW-UP SEQUENCE API ====================

  // Get follow-up sequence for current tenant
  app.get('/api/settings/follow-up-sequence', requireAuth(), asyncHandler(async (req, res) => {
    const context = req.user;
    const sequence = await db.getFollowUpSequence(context.tenantId);
    res.json(sequence);
  }));

  // Update follow-up sequence for current tenant
  app.put('/api/settings/follow-up-sequence', requireAuth(), asyncHandler(async (req, res) => {
    const context = req.user;
    const { steps, expireDays, enabled } = req.body;

    // Audit log the change
    logAudit(AUDIT_ACTIONS.CONFIG_UPDATE, req, {
      resource: 'config',
      resourceId: 'follow-up-sequence',
      metadata: { steps: steps?.length, expireDays, enabled }
    });

    const sequence = await db.setFollowUpSequence(context.tenantId, {
      steps,
      expireDays,
      enabled
    });

    res.json(sequence);
  }));

  // Reset follow-up sequence to defaults
  app.post('/api/settings/follow-up-sequence/reset', requireAuth(), asyncHandler(async (req, res) => {
    const context = req.user;

    // Audit log the reset
    logAudit(AUDIT_ACTIONS.CONFIG_UPDATE, req, {
      resource: 'config',
      resourceId: 'follow-up-sequence',
      metadata: { action: 'reset' }
    });

    // Get default sequence and save it
    const defaultSequence = await db.getFollowUpSequence(null);
    const sequence = await db.setFollowUpSequence(context.tenantId, defaultSequence);

    res.json(sequence);
  }));

  // ==================== PREVIEW API ====================

  // Get preview metadata by slug
  app.get('/api/preview/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const preview = await db.getPreviewBySlug(slug);

    if (!preview) {
      throw ApiError.notFound('Preview not found');
    }

    // Check expiration
    if (preview.expiresAt && new Date(preview.expiresAt) < new Date()) {
      return res.status(410).json({
        error: 'Preview expired',
        expired: true
      });
    }

    // Increment view count (don't await - fire and forget)
    db.incrementViewCount(slug).catch(err => {
      log.debug('Failed to increment view count', { error: err.message });
    });

    // Return metadata without full HTML to reduce payload
    const { html, siteData, slots, ...metadata } = preview;
    res.json(metadata);
  }));

  // Get preview raw HTML (for iframe)
  app.get('/api/preview/:slug/html', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const preview = await db.getPreviewBySlug(slug);

    if (!preview) {
      return res.status(404).type('html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>Not Found</title></head>
        <body style="font-family: system-ui; padding: 4rem; text-align: center;">
          <h1>Preview Not Found</h1>
          <p>This preview doesn't exist or has been removed.</p>
        </body>
        </html>
      `);
    }

    // Check expiration
    if (preview.expiresAt && new Date(preview.expiresAt) < new Date()) {
      return res.status(410).type('html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>Expired</title></head>
        <body style="font-family: system-ui; padding: 4rem; text-align: center;">
          <h1>Preview Expired</h1>
          <p>This preview has expired. Contact us if you'd like to see it again.</p>
        </body>
        </html>
      `);
    }

    res.type('html').send(preview.html);
  }));

  // Get all previews (admin)
  app.get('/api/previews', asyncHandler(async (req, res) => {
    const { status, limit } = req.query;
    const previews = await db.getPreviews({
      status,
      limit: limit ? parseInt(limit) : 50
    });

    // Return without full HTML
    const summarized = previews.map(p => {
      const { html, siteData, slots, ...rest } = p;
      return rest;
    });

    res.json(summarized);
  }));

  // Delete preview by slug
  app.delete('/api/preview/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    await db.deletePreview(slug);
    res.json({ success: true });
  }));

  // Cleanup expired previews
  app.post('/api/previews/cleanup', asyncHandler(async (req, res) => {
    const deleted = await db.cleanupExpiredPreviews();
    res.json({ deleted });
  }));

  // ==================== PREVIEW ANALYTICS ====================

  // Record analytics event
  app.post('/api/preview/:slug/event', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { type, data, sessionId } = req.body;

    if (!type) {
      throw ApiError.badRequest('Event type is required');
    }

    const validTypes = ['pageview', 'scroll', 'click', 'form', 'time'];
    if (!validTypes.includes(type)) {
      throw ApiError.badRequest(`Invalid event type. Must be one of: ${validTypes.join(', ')}`);
    }

    const event = await db.recordAnalyticsEvent(slug, {
      type,
      data: data || {},
      sessionId: sessionId || null,
      userAgent: req.get('User-Agent') || null
    });

    res.json({ success: true, event });
  }));

  // Get preview analytics
  app.get('/api/preview/:slug/analytics', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const preview = await db.getPreviewBySlug(slug);

    if (!preview) {
      throw ApiError.notFound('Preview not found');
    }

    const analytics = await db.getPreviewAnalytics(slug);
    res.json(analytics);
  }));

  // ==================== PUBLIC PREVIEW PAGE ====================

  // Public preview page - serves HTML directly at /preview/:slug
  app.get('/preview/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const preview = await db.getPreviewBySlug(slug);

    if (!preview) {
      return res.status(404).type('html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>Not Found</title></head>
        <body style="font-family: system-ui; padding: 4rem; text-align: center;">
          <h1>Preview Not Found</h1>
          <p>This preview doesn't exist or has been removed.</p>
        </body>
        </html>
      `);
    }

    // Check expiration
    if (preview.expiresAt && new Date(preview.expiresAt) < new Date()) {
      return res.status(410).type('html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>Expired</title></head>
        <body style="font-family: system-ui; padding: 4rem; text-align: center;">
          <h1>Preview Expired</h1>
          <p>This preview has expired. Contact us if you'd like to see it again.</p>
        </body>
        </html>
      `);
    }

    // Increment view count
    await db.incrementViewCount(slug);

    res.type('html').send(preview.html);
  }));

  // ==================== HANDOVER / EXPORT ====================

  // Export site HTML for handover
  app.get('/api/deployments/:siteId/export', asyncHandler(async (req, res) => {
    const deployment = await db.getDeployment(req.params.siteId);
    if (!deployment) {
      throw ApiError.notFound('Deployment not found');
    }

    if (!deployment.url) {
      throw ApiError.badRequest('Deployment has no preview URL');
    }

    log.info('Exporting site for handover', { siteId: req.params.siteId, url: deployment.url });

    // Fetch HTML from deployed site
    const response = await fetch(deployment.url, {
      headers: {
        'User-Agent': 'SiteImprover-Export/1.0'
      }
    });

    if (!response.ok) {
      throw ApiError.internal(`Failed to fetch site: ${response.status}`);
    }

    const html = await response.text();

    // Determine filename
    const safeName = (deployment.businessName || 'website')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Set headers for download
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-redesign.html"`);
    res.setHeader('Content-Length', Buffer.byteLength(html, 'utf8'));

    res.send(html);
  }));

  // Get export info (preview before download)
  app.get('/api/deployments/:siteId/export-info', asyncHandler(async (req, res) => {
    const deployment = await db.getDeployment(req.params.siteId);
    if (!deployment) {
      throw ApiError.notFound('Deployment not found');
    }

    res.json({
      siteId: deployment.siteId,
      businessName: deployment.businessName,
      previewUrl: deployment.url,
      canExport: !!deployment.url,
      exportUrl: `/api/deployments/${req.params.siteId}/export`,
      handoverInfo: {
        instructions: [
          '1. Download the HTML file using the export button',
          '2. The file contains all CSS inline - no additional files needed',
          '3. Host on any web server or upload to their existing hosting',
          '4. Update any placeholder content if needed'
        ],
        notes: deployment.notes || null
      }
    });
  }));

  // Mark as converted (customer paid)
  // Protected: requires auth + audit
  app.post('/api/deployments/:siteId/convert', requireAuth(), asyncHandler(async (req, res) => {
    const { amount, notes } = req.body;

    const deployment = await db.getDeployment(req.params.siteId);
    if (!deployment) {
      throw ApiError.notFound('Deployment not found');
    }

    // Audit log conversion
    logAudit(AUDIT_ACTIONS.DEPLOYMENT_CONVERT, req, {
      resource: 'deployment',
      resourceId: req.params.siteId,
      metadata: { amount, businessName: deployment.businessName }
    });

    const updates = {
      status: 'converted',
      convertedAt: new Date().toISOString()
    };

    if (amount) updates.paymentAmount = amount;
    if (notes) updates.notes = (deployment.notes || '') + '\n' + notes;

    const updated = await db.updateDeployment(req.params.siteId, updates);
    log.info('Deployment converted!', { siteId: req.params.siteId, amount });

    res.json(updated);
  }));

  // ==================== BILLING ====================

  // Get available plans
  app.get('/api/billing/plans', (req, res) => {
    res.json(getAvailablePlans());
  });

  // Get subscription status for current tenant
  app.get('/api/billing/subscription', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const info = await getSubscriptionInfo(context.tenantId);
    res.json(info);
  }));

  // Get usage summary for current tenant
  app.get('/api/billing/usage', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const tenant = await getTenant(context.tenantId);
    const planId = tenant?.planId || 'starter';
    const usage = await getUsageSummary(context.tenantId, planId);
    res.json(usage);
  }));

  // Start checkout for a plan
  app.post('/api/billing/checkout', requireAuth(), asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
      throw ApiError.badRequest('Billing not configured');
    }

    const { planId } = req.body;
    if (!planId) {
      throw ApiError.badRequest('Plan ID is required');
    }

    const context = getUserContext(req);

    // Ensure tenant exists
    let tenant = await getTenant(context.tenantId);
    if (!tenant) {
      tenant = await createTenant(
        context.tenantId,
        req.auth?.sessionClaims?.email || 'unknown@example.com',
        req.auth?.sessionClaims?.name || 'Unknown'
      );
    }

    const returnUrl = req.headers.origin || 'http://localhost:5173';
    const checkout = await startCheckout(context.tenantId, planId, `${returnUrl}/dashboard`);

    res.json(checkout);
  }));

  // Get billing portal URL
  app.get('/api/billing/portal', requireAuth(), asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
      throw ApiError.badRequest('Billing not configured');
    }

    const context = getUserContext(req);
    const returnUrl = req.headers.origin || 'http://localhost:5173';
    const portalUrl = await getBillingPortal(context.tenantId, `${returnUrl}/dashboard`);

    res.json({ url: portalUrl });
  }));

  // Cancel subscription
  app.post('/api/billing/cancel', requireAuth(), asyncHandler(async (req, res) => {
    if (!isStripeConfigured()) {
      throw ApiError.badRequest('Billing not configured');
    }

    const { immediately = false } = req.body;
    const context = getUserContext(req);

    logAudit(AUDIT_ACTIONS.CONFIG_UPDATE, req, {
      resource: 'subscription',
      metadata: { action: 'cancel', immediately }
    });

    const tenant = await cancelTenantSubscription(context.tenantId, immediately);
    res.json({ status: tenant.status });
  }));

  // Get spending summary (usage + overages + cap status)
  app.get('/api/billing/spending', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const tenant = await getTenant(context.tenantId);
    const planId = tenant?.planId || 'starter';

    const { getSpendingSummary } = await import('./billing/usage.js');
    const summary = await getSpendingSummary(context.tenantId, planId);
    res.json(summary);
  }));

  // Get/set spending cap
  app.get('/api/billing/spending-cap', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const { getSpendingCap, checkSpendingCap } = await import('./billing/usage.js');

    const tenant = await getTenant(context.tenantId);
    const planId = tenant?.planId || 'starter';

    const cap = await getSpendingCap(context.tenantId);
    const status = await checkSpendingCap(context.tenantId, planId);

    res.json({
      capCents: cap,
      capDollars: cap / 100,
      ...status
    });
  }));

  app.post('/api/billing/spending-cap', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const { capDollars, capCents } = req.body;

    if (capDollars === undefined && capCents === undefined) {
      throw ApiError.badRequest('capDollars or capCents is required');
    }

    const cap = capCents || Math.round(capDollars * 100);

    if (cap < 0) {
      throw ApiError.badRequest('Cap must be positive');
    }

    logAudit(AUDIT_ACTIONS.CONFIG_UPDATE, req, {
      resource: 'spending_cap',
      metadata: { capCents: cap, capDollars: cap / 100 }
    });

    const { setSpendingCap } = await import('./billing/usage.js');
    await setSpendingCap(context.tenantId, cap);

    res.json({ success: true, capCents: cap, capDollars: cap / 100 });
  }));

  // Get spending alerts
  app.get('/api/billing/alerts', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const tenant = await getTenant(context.tenantId);
    const planId = tenant?.planId || 'starter';

    const { checkSpendingAlerts, getPendingAlerts } = await import('./billing/usage.js');

    // Check for new alerts
    const newAlerts = await checkSpendingAlerts(context.tenantId, planId);
    const pendingAlerts = await getPendingAlerts(context.tenantId);

    res.json({
      newAlerts,
      pendingAlerts
    });
  }));

  // Stripe webhook endpoint (no auth - uses signature verification)
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      throw ApiError.badRequest('Missing Stripe signature');
    }

    const result = await handleWebhook(req.body, signature);
    res.json(result);
  }));

  // Resend webhook endpoint for email delivery tracking (no auth - uses signature verification)
  app.post('/api/webhooks/resend', express.json(), asyncHandler(async (req, res) => {
    const { verifyWebhookSignature, handleResendWebhook } = await import('./webhooks/resend.js');
    const db = await import('./db.js');

    const signature = req.headers['resend-signature'];
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret && !verifyWebhookSignature(rawBody, signature, secret)) {
      throw new ApiError('Invalid webhook signature', 401, 'UNAUTHORIZED');
    }

    // Process the webhook
    const result = await handleResendWebhook(req.body, db);

    if (!result.success && result.reason !== 'email_not_found') {
      log.warn('Resend webhook processing failed', result);
    }

    res.json(result);
  }));

  // Get email delivery statistics
  app.get('/api/email/stats', requireAuth(), asyncHandler(async (req, res) => {
    const { getEmailDeliveryStats } = await import('./webhooks/resend.js');
    const db = await import('./db.js');
    const context = getUserContext(req);

    const stats = await getEmailDeliveryStats(db, context.tenantId);
    res.json(stats || { error: 'Failed to fetch stats' });
  }));

  // ==================== TEAM MANAGEMENT ====================

  // Get current tenant info
  app.get('/api/team', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const tenant = await getTenantRecord(context.tenantId);

    if (!tenant) {
      // Create tenant on first access
      const newTenant = await createTenantRecord({
        name: context.email?.split('@')[0] || 'My Team',
        plan: 'free'
      });

      // Create user as owner
      await createUser({
        tenantId: newTenant.id,
        email: context.email,
        name: context.name,
        role: ROLES.OWNER,
        authProviderId: context.userId
      });

      return res.json(newTenant);
    }

    res.json(tenant);
  }));

  // Update tenant settings
  app.patch('/api/team', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const { name, settings } = req.body;

    // Check permission
    const user = await getUserByAuthId(context.userId);
    if (!user || !hasPermission(user.role, 'settings')) {
      throw new ApiError('Permission denied', 403, 'FORBIDDEN');
    }

    const updates = {};
    if (name) updates.name = name;
    if (settings) updates.settings = settings;

    logAudit(AUDIT_ACTIONS.CONFIG_UPDATE, req, {
      resource: 'team',
      metadata: updates
    });

    const { updateTenant: updateTenantInfo } = await import('./db/tenants.js');
    const tenant = await updateTenantInfo(context.tenantId, updates);
    res.json(tenant);
  }));

  // Get team members
  app.get('/api/team/members', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const users = await getTenantUsers(context.tenantId);
    res.json(users);
  }));

  // Invite team member
  app.post('/api/team/invite', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const { email, role = ROLES.MEMBER } = req.body;

    if (!email) {
      throw ApiError.badRequest('Email is required');
    }

    // Check permission
    const user = await getUserByAuthId(context.userId);
    if (!user || !hasPermission(user.role, 'invite')) {
      throw new ApiError('Permission denied', 403, 'FORBIDDEN');
    }

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      throw ApiError.badRequest('Invalid role');
    }

    // Cannot invite owners
    if (role === ROLES.OWNER) {
      throw ApiError.badRequest('Cannot invite as owner');
    }

    logAudit(AUDIT_ACTIONS.TEAM_INVITE, req, {
      resource: 'invitation',
      metadata: { email, role }
    });

    const invitation = await createInvitation({
      tenantId: context.tenantId,
      email,
      role,
      invitedBy: user.id
    });

    // TODO: Send invitation email via Resend

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt
      }
    });
  }));

  // Get pending invitations
  app.get('/api/team/invitations', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);

    // Check permission
    const user = await getUserByAuthId(context.userId);
    if (!user || !hasPermission(user.role, 'invite')) {
      throw new ApiError('Permission denied', 403, 'FORBIDDEN');
    }

    const invitations = await getTenantInvitations(context.tenantId);
    res.json(invitations);
  }));

  // Revoke invitation
  app.delete('/api/team/invitations/:invitationId', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);

    // Check permission
    const user = await getUserByAuthId(context.userId);
    if (!user || !hasPermission(user.role, 'invite')) {
      throw new ApiError('Permission denied', 403, 'FORBIDDEN');
    }

    logAudit(AUDIT_ACTIONS.TEAM_INVITE_REVOKE, req, {
      resource: 'invitation',
      resourceId: req.params.invitationId
    });

    await revokeInvitation(req.params.invitationId);
    res.json({ success: true });
  }));

  // Accept invitation (public - uses token)
  app.post('/api/team/accept-invite', asyncHandler(async (req, res) => {
    const { token, name, authProviderId } = req.body;

    if (!token) {
      throw ApiError.badRequest('Invitation token is required');
    }

    const user = await acceptInvitation(token, {
      name,
      authProviderId
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    });
  }));

  // Update team member role
  app.patch('/api/team/members/:userId', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);
    const { role } = req.body;

    // Check permission (only owner/admin can change roles)
    const currentUser = await getUserByAuthId(context.userId);
    if (!currentUser || !hasPermission(currentUser.role, 'settings')) {
      throw new ApiError('Permission denied', 403, 'FORBIDDEN');
    }

    // Cannot change owner role
    if (role === ROLES.OWNER) {
      throw ApiError.badRequest('Cannot assign owner role');
    }

    const { updateUser: updateUserInfo, getUser: getUserInfo } = await import('./db/tenants.js');
    const targetUser = await getUserInfo(req.params.userId);

    if (!targetUser || targetUser.tenantId !== context.tenantId) {
      throw ApiError.notFound('User not found');
    }

    // Cannot modify owner
    if (targetUser.role === ROLES.OWNER) {
      throw ApiError.badRequest('Cannot modify owner');
    }

    logAudit(AUDIT_ACTIONS.TEAM_ROLE_CHANGE, req, {
      resource: 'user',
      resourceId: req.params.userId,
      metadata: { oldRole: targetUser.role, newRole: role }
    });

    const updated = await updateUserInfo(req.params.userId, { role });
    res.json(updated);
  }));

  // Remove team member
  app.delete('/api/team/members/:userId', requireAuth(), asyncHandler(async (req, res) => {
    const context = getUserContext(req);

    // Check permission
    const currentUser = await getUserByAuthId(context.userId);
    if (!currentUser || !hasPermission(currentUser.role, 'settings')) {
      throw new ApiError('Permission denied', 403, 'FORBIDDEN');
    }

    const { deleteUser: deleteUserInfo, getUser: getUserInfo } = await import('./db/tenants.js');
    const targetUser = await getUserInfo(req.params.userId);

    if (!targetUser || targetUser.tenantId !== context.tenantId) {
      throw ApiError.notFound('User not found');
    }

    // Cannot remove owner
    if (targetUser.role === ROLES.OWNER) {
      throw ApiError.badRequest('Cannot remove owner');
    }

    // Cannot remove yourself
    if (targetUser.id === currentUser.id) {
      throw ApiError.badRequest('Cannot remove yourself');
    }

    logAudit(AUDIT_ACTIONS.TEAM_MEMBER_REMOVE, req, {
      resource: 'user',
      resourceId: req.params.userId
    });

    await deleteUserInfo(req.params.userId);
    res.json({ success: true });
  }));

  // ==================== DISCOVERY ====================

  // Discover leads by industry + location
  // Protected: requires auth + stricter rate limit (external API costs) + quota
  app.post('/api/discover', requireAuth(), discoveryLimiter, asyncHandler(async (req, res) => {
    const { query, location, limit = 10, autoProcess = false } = req.body;
    const context = getUserContext(req);

    if (!query) {
      throw ApiError.badRequest('Query is required (e.g., "plumbers", "restaurants")');
    }

    // Check quota before discovery
    const tenant = await getTenant(context.tenantId);
    const planId = tenant?.planId || 'starter';
    try {
      await enforceQuota(context.tenantId, METRICS.LEADS_DISCOVERED, planId);
    } catch (quotaError) {
      if (quotaError.code === 'QUOTA_EXCEEDED') {
        throw new ApiError(quotaError.message, 402, 'QUOTA_EXCEEDED');
      }
      throw quotaError;
    }

    // Audit log discovery start
    logAudit(AUDIT_ACTIONS.DISCOVERY_START, req, {
      resource: 'discovery',
      metadata: { query, location, limit }
    });

    log.info('Starting lead discovery', { query, location, limit });

    // Try to load lead finder (Outscraper)
    let leads = [];
    const searchLocation = location || 'Denver, CO';

    try {
      const { default: LeadFinder } = await import('./leadFinder.js');
      const finder = new LeadFinder();
      leads = await finder.search(query, searchLocation, parseInt(limit));
    } catch (err) {
      log.warn('LeadFinder (Outscraper) failed, trying Google Places', { error: err.message });

      // Fallback to Google Places
      try {
        const { default: GooglePlacesLeadFinder } = await import('./googlePlaces.js');
        const places = new GooglePlacesLeadFinder();
        leads = await places.search(query, searchLocation, { limit: parseInt(limit) });
      } catch (placesErr) {
        throw ApiError.badRequest(`Discovery failed: Outscraper: ${err.message}. Google Places: ${placesErr.message}`);
      }
    }

    // Qualify leads
    let qualifiedLeads = leads;
    try {
      const { LeadQualifier } = await import('./leadQualifier.js');
      const qualifier = new LeadQualifier({ requireContact: false });
      qualifiedLeads = leads.map(lead => ({
        ...lead,
        qualification: qualifier.qualifyLead(lead)
      }));
    } catch (err) {
      log.warn('Qualification failed', { error: err.message });
    }

    // Save leads to database
    const savedLeads = [];
    for (const lead of qualifiedLeads) {
      try {
        const saved = await db.createLead({
          url: lead.website || lead.url,
          businessName: lead.name || lead.businessName,
          email: lead.email,
          phone: lead.phone,
          industry: query,
          country: location,
          status: 'discovered',
          score: lead.qualification?.score,
          qualified: lead.qualification?.qualified
        });
        savedLeads.push(saved);
      } catch (err) {
        log.debug('Failed to save lead', { error: err.message });
      }
    }

    // Increment usage based on leads found
    if (savedLeads.length > 0) {
      await incrementUsage(context.tenantId, METRICS.LEADS_DISCOVERED, savedLeads.length);
    }

    log.info('Discovery complete', {
      found: leads.length,
      saved: savedLeads.length
    });

    res.json({
      success: true,
      query,
      location,
      found: leads.length,
      saved: savedLeads.length,
      leads: savedLeads
    });
  }));

  // ==================== PIPELINE SSE STATUS ====================

  // SSE endpoint for real-time pipeline status updates
  app.get('/api/pipeline/:jobId/status', (req, res) => {
    const { jobId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial status if job exists
    const currentStatus = pipelineEvents.getStatus(jobId);
    if (currentStatus) {
      res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);
    } else {
      // Job not found yet, send waiting status
      res.write(`data: ${JSON.stringify({ jobId, stage: 'waiting', progress: 0, label: 'Waiting for pipeline...' })}\n\n`);
    }

    // Handler for status updates
    const sendStatus = (status) => {
      try {
        res.write(`data: ${JSON.stringify(status)}\n\n`);

        // Close connection on completion or error
        if (status.stage === 'complete' || status.stage === 'error') {
          setTimeout(() => res.end(), 1000); // Give client time to receive final message
        }
      } catch (err) {
        log.debug('SSE write failed, client disconnected', { jobId });
      }
    };

    // Subscribe to job status events
    pipelineEvents.on(`status:${jobId}`, sendStatus);

    // Cleanup on disconnect
    req.on('close', () => {
      pipelineEvents.off(`status:${jobId}`, sendStatus);
      log.debug('SSE client disconnected', { jobId });
    });

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (err) {
        clearInterval(keepAlive);
      }
    }, 30000);

    req.on('close', () => clearInterval(keepAlive));
  });

  // Run pipeline for a URL (async with real-time status)
  // Protected: requires auth + stricter rate limit + quota enforcement
  app.post('/api/pipeline', requireAuth(), pipelineLimiter, async (req, res) => {
    try {
      const { url, skipPolish, skipEmail } = req.body;
      const context = getUserContext(req);

      // Check quota before running pipeline
      const tenant = await getTenant(context.tenantId);
      const planId = tenant?.planId || 'starter';
      try {
        await enforceQuota(context.tenantId, METRICS.PIPELINE_RUNS, planId);
      } catch (quotaError) {
        if (quotaError.code === 'QUOTA_EXCEEDED') {
          return res.status(402).json({
            error: quotaError.message,
            code: 'QUOTA_EXCEEDED',
            quota: quotaError.quota
          });
        }
        throw quotaError;
      }

      // Generate unique job ID for tracking
      const jobId = randomUUID();

      // Audit log pipeline start
      logAudit(AUDIT_ACTIONS.PIPELINE_START, req, {
        resource: 'pipeline',
        resourceId: jobId,
        metadata: { url, skipPolish, skipEmail }
      });

      // Increment usage
      await incrementUsage(context.tenantId, METRICS.PIPELINE_RUNS);

      log.info('=== PIPELINE REQUEST RECEIVED ===');
      log.info(`JobId: ${jobId}`);
      log.info(`URL: ${url}`);
      log.info(`skipPolish: ${skipPolish}, skipEmail: ${skipEmail}`);

      // Validate URL
      const urlResult = validateUrl(url);
      if (!urlResult.valid) {
        log.warn('Pipeline rejected: Invalid URL', { error: urlResult.error });
        return res.status(400).json({ error: urlResult.error });
      }

      const validatedUrl = urlResult.normalized;

      // Create job tracker for status updates
      const tracker = pipelineEvents.createJobTracker(jobId);
      tracker.queued({ url: validatedUrl });

      // Return immediately with jobId for SSE subscription
      log.info('Returning response to client with jobId for SSE tracking...');
      res.json({
        message: 'Pipeline started',
        url: validatedUrl,
        jobId, // Client can use this to subscribe to /api/pipeline/:jobId/status
        status: 'processing'
      });

      // Run pipeline in background
      log.info('Importing pipeline module...');
      const { rebuildAndDeploy } = await import('./pipeline.js');

      log.info('Starting rebuildAndDeploy with job tracker...');
      rebuildAndDeploy(validatedUrl, { skipPolish, jobId, tracker })
        .then(async result => {
          log.info('=== PIPELINE COMPLETE ===');
          log.info(`Business: ${result.siteData?.businessName}`);
          log.info(`Industry: ${result.industry}`);
          log.info(`Preview: ${result.preview}`);
          log.info(`Duration: ${result.duration}s`);

          // Emit completion status
          tracker.complete({
            preview: result.preview,
            businessName: result.siteData?.businessName,
            industry: result.industry
          });

          // Update lead status to deployed if lead exists
          try {
            const lead = await db.getLeadByUrl(validatedUrl);
            if (lead) {
              await db.updateLead(lead.id, {
                status: 'deployed',
                siteId: result.siteId,
                preview: result.preview
              });
              log.info('Lead status updated to deployed', { leadId: lead.id });
            }
          } catch (err) {
            log.warn('Failed to update lead status', { error: err.message });
          }

          // Optionally send email
          if (!skipEmail && result.siteData.email && process.env.RESEND_API_KEY) {
            log.info('Sending outreach email...');
            const outreach = new OutreachManager({
              resendApiKey: process.env.RESEND_API_KEY,
              fromEmail: process.env.FROM_EMAIL
            });
            const deployment = await db.getDeployment(result.siteId);
            if (deployment) {
              await outreach.sendInitialOutreach(deployment);
              log.info('Email sent!');
            }
          }
        })
        .catch(async error => {
          log.error('=== PIPELINE FAILED ===');
          log.error(`URL: ${validatedUrl}`);
          log.error(`Error: ${error.message}`);
          log.error(`Stack: ${error.stack}`);

          // Emit error status
          tracker.error(error, error.step || 'unknown');

          // Log error to database
          try {
            await db.logPipelineError({
              url: validatedUrl,
              error: error.message,
              stack: error.stack,
              step: error.step || 'unknown'
            });

            // Update lead status to error if lead exists
            const lead = await db.getLeadByUrl(validatedUrl);
            if (lead) {
              await db.updateLead(lead.id, {
                status: 'error',
                lastError: error.message
              });
            }
          } catch (dbError) {
            log.error('Failed to log pipeline error to database', { error: dbError.message });
          }
        });

    } catch (error) {
      log.error('Pipeline endpoint error:', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ERROR MIDDLEWARE ====================

  // Sentry error handler (must be before other error handlers)
  if (isSentryConfigured()) {
    app.use(sentryErrorHandler());
  }

  // Centralized error handler
  app.use((err, req, res, next) => {
    // Log the error
    log.error('Request error', {
      path: req.path,
      method: req.method,
      error: err.message,
      code: err.code,
      stack: err.stack
    });

    // Capture to Sentry with context (if not already handled by sentryErrorHandler)
    captureException(err, {
      tags: {
        path: req.path,
        method: req.method
      },
      extra: {
        statusCode: err.statusCode,
        code: err.code
      },
      user: req.user ? {
        id: req.user.userId,
        email: req.user.email,
        tenantId: req.user.tenantId
      } : undefined
    });

    // Determine status code
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';

    res.status(statusCode).json({
      error: err.message,
      code
    });
  });

  // Fallback to dashboard for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
  });

  return app;
}

// Start server if run directly
const isMain = import.meta.url && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { config } = await import('dotenv');
  config();

  // Validate startup configuration
  const { features } = validateStartup(log);

  const port = process.env.PORT || CONFIG.server.defaultPort;
  const app = createServer({ features });

  app.listen(port, () => {
    log.info(`Dashboard running at http://localhost:${port}`);
  });
}

export default createServer;
