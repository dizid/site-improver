// src/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import * as db from './db.js';
import { OutreachManager } from './outreach.js';
import logger from './logger.js';
import { CONFIG, validateStartup } from './config.js';
import { validateUrl, validateEmail } from './utils.js';
import { pipelineEvents, PIPELINE_STAGES } from './pipelineEvents.js';

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
  
  app.use(cors());
  app.use(express.json());
  
  // Serve static dashboard files
  app.use(express.static(path.join(__dirname, '../dashboard/dist')));

  // API Routes
  
  // Get all deployments with optional filters
  app.get('/api/deployments', async (req, res) => {
    try {
      const { status, search, sort = 'createdAt', order = 'desc' } = req.query;
      let deployments = await db.getDeployments();
      
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
  app.get('/api/stats', async (req, res) => {
    try {
      // Try the new stats function first
      if (db.getStats) {
        const stats = await db.getStats();
        res.json(stats);
        return;
      }

      // Fallback to legacy stats calculation
      const deployments = await db.getDeployments();

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
  app.get('/api/leads', async (req, res) => {
    try {
      const { status, industry, search, limit } = req.query;
      const filters = {};

      if (status && status !== 'all') filters.status = status;
      if (industry) filters.industry = industry;
      if (limit) filters.limit = parseInt(limit);

      let leads = await db.getLeads(filters);

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
  app.get('/api/leads/:leadId', async (req, res) => {
    try {
      const lead = await db.getLead(req.params.leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create lead (for manual entry)
  app.post('/api/leads', async (req, res) => {
    try {
      const { url, businessName, email, phone, industry, country } = req.body;

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

      const lead = await db.createLead({
        url: urlResult.normalized,
        businessName,
        email,
        phone,
        industry,
        country
      });

      res.status(201).json(lead);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update lead
  app.patch('/api/leads/:leadId', async (req, res) => {
    try {
      const { status, notes, businessName, email, phone, industry } = req.body;
      const updates = {};

      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (businessName) updates.businessName = businessName;
      if (email) updates.email = email;
      if (phone) updates.phone = phone;
      if (industry) updates.industry = industry;

      const lead = await db.updateLead(req.params.leadId, updates);
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete lead
  app.delete('/api/leads/:leadId', async (req, res) => {
    try {
      await db.deleteLead(req.params.leadId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send email for lead
  app.post('/api/leads/:leadId/send-email', async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const lead = await db.getLead(req.params.leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      await outreach.sendInitialOutreach(lead);

      // Update lead status
      await db.updateLead(req.params.leadId, { status: 'emailing' });

      const updated = await db.getLead(req.params.leadId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single deployment
  app.get('/api/deployments/:siteId', async (req, res) => {
    try {
      const deployment = await db.getDeployment(req.params.siteId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update deployment status
  app.patch('/api/deployments/:siteId', async (req, res) => {
    try {
      const { status, notes } = req.body;
      const updates = {};
      
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      
      const deployment = await db.updateDeployment(req.params.siteId, updates);
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete deployment
  app.delete('/api/deployments/:siteId', async (req, res) => {
    try {
      await db.deleteDeployment(req.params.siteId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send outreach email
  app.post('/api/deployments/:siteId/send-email', async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }
      
      const deployment = await db.getDeployment(req.params.siteId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      
      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });
      
      await outreach.sendInitialOutreach(deployment);
      
      const updated = await db.getDeployment(req.params.siteId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send follow-up email
  app.post('/api/deployments/:siteId/send-followup', async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const { attempt = 1 } = req.body;

      const deployment = await db.getDeployment(req.params.siteId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      await outreach.sendFollowUp(deployment, attempt);

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
  app.post('/api/emails/:emailId/approve', async (req, res) => {
    try {
      const { sendNow } = req.body;

      const email = await db.approveEmail(req.params.emailId);

      // Optionally send immediately after approval
      if (sendNow) {
        if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
          return res.status(400).json({ error: 'Email not configured' });
        }

        const outreach = new OutreachManager({
          resendApiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.FROM_EMAIL
        });

        await outreach.sendFromQueue(req.params.emailId);
        return res.json({ approved: true, sent: true });
      }

      res.json({ approved: true, email });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reject email
  app.post('/api/emails/:emailId/reject', async (req, res) => {
    try {
      const { reason } = req.body;
      const email = await db.rejectEmail(req.params.emailId, reason);
      res.json({ rejected: true, email });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send approved email from queue
  app.post('/api/emails/:emailId/send', async (req, res) => {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(400).json({ error: 'Email not configured' });
      }

      const outreach = new OutreachManager({
        resendApiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL
      });

      const result = await outreach.sendFromQueue(req.params.emailId);
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
  app.patch('/api/config/email', async (req, res) => {
    try {
      const { autoSendEnabled, requireApproval } = req.body;
      const config = await db.saveEmailConfig({
        autoSendEnabled,
        requireApproval
      });
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

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
  app.post('/api/deployments/:siteId/convert', asyncHandler(async (req, res) => {
    const { amount, notes } = req.body;

    const deployment = await db.getDeployment(req.params.siteId);
    if (!deployment) {
      throw ApiError.notFound('Deployment not found');
    }

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

  // ==================== DISCOVERY ====================

  // Discover leads by industry + location
  app.post('/api/discover', asyncHandler(async (req, res) => {
    const { query, location, limit = 10, autoProcess = false } = req.body;

    if (!query) {
      throw ApiError.badRequest('Query is required (e.g., "plumbers", "restaurants")');
    }

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
  app.post('/api/pipeline', async (req, res) => {
    try {
      const { url, skipPolish, skipEmail } = req.body;

      // Generate unique job ID for tracking
      const jobId = randomUUID();

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
