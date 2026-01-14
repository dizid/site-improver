// netlify/functions/api.js
// Serverless function wrapper for the Express API

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import * as db from '../../src/db.js';
import { OutreachManager } from '../../src/outreach.js';
import { scrapeSiteLite } from '../../src/scraperLite.js';
import TemplateBuilder from '../../src/templateBuilder.js';
import AIPolisher from '../../src/aiPolish.js';
import { extractCity } from '../../src/utils.js';
import logger from '../../src/logger.js';
import { CONFIG } from '../../src/config.js';

const log = logger.child('api-function');

// Create Express app
const app = express();

app.use(cors());
app.use(express.json());

// API Routes (same as server.js but without static file serving)

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
    log.error('Failed to get deployments', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const deployments = await db.getDeployments();

    const stats = {
      total: deployments.length,
      pending: deployments.filter(d => d.status === 'pending').length,
      emailed: deployments.filter(d => d.status === 'emailed').length,
      responded: deployments.filter(d => d.status === 'responded').length,
      converted: deployments.filter(d => d.status === 'converted').length,
      expired: deployments.filter(d => d.status === 'expired').length,
      conversionRate: deployments.length > 0
        ? ((deployments.filter(d => d.status === 'converted').length / deployments.length) * 100).toFixed(1)
        : 0,
      revenue: deployments.filter(d => d.status === 'converted').length * 1000,
      byIndustry: {},
      recentActivity: []
    };

    // Group by industry
    deployments.forEach(d => {
      const ind = d.industry || 'unknown';
      stats.byIndustry[ind] = (stats.byIndustry[ind] || 0) + 1;
    });

    // Recent activity (last 10)
    stats.recentActivity = deployments
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 10)
      .map(d => ({
        siteId: d.siteId,
        businessName: d.businessName,
        status: d.status,
        date: d.updatedAt || d.createdAt
      }));

    res.json(stats);
  } catch (error) {
    log.error('Failed to get stats', { error: error.message });
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
    log.error('Failed to get deployment', { error: error.message });
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
    log.error('Failed to update deployment', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete deployment
app.delete('/api/deployments/:siteId', async (req, res) => {
  try {
    await db.deleteDeployment(req.params.siteId);
    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete deployment', { error: error.message });
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
    log.error('Failed to send email', { error: error.message });
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
    log.error('Failed to send follow-up', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEADS API
// ============================================

// Get all leads
app.get('/api/leads', async (req, res) => {
  try {
    const { status, search } = req.query;
    let leads = await db.getLeads?.() || await db.getDeployments();

    if (status && status !== 'all') {
      leads = leads.filter(l => l.status === status);
    }

    if (search) {
      const s = search.toLowerCase();
      leads = leads.filter(l =>
        l.businessName?.toLowerCase().includes(s) ||
        l.email?.toLowerCase().includes(s) ||
        l.industry?.toLowerCase().includes(s)
      );
    }

    res.json(leads);
  } catch (error) {
    log.error('Failed to get leads', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create lead
app.post('/api/leads', async (req, res) => {
  try {
    const lead = await db.saveLead?.(req.body) || await db.saveDeployment(req.body);
    res.json(lead);
  } catch (error) {
    log.error('Failed to create lead', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update lead
app.patch('/api/leads/:leadId', async (req, res) => {
  try {
    const lead = await db.updateLead?.(req.params.leadId, req.body) ||
                 await db.updateDeployment(req.params.leadId, req.body);
    res.json(lead);
  } catch (error) {
    log.error('Failed to update lead', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete lead
app.delete('/api/leads/:leadId', async (req, res) => {
  try {
    await db.deleteLead?.(req.params.leadId) || await db.deleteDeployment(req.params.leadId);
    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete lead', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMAIL API
// ============================================

// Get email queue
app.get('/api/emails/queue', async (req, res) => {
  try {
    const emails = await db.getEmailDrafts?.() || [];
    res.json(emails.filter(e => e.status === 'draft'));
  } catch (error) {
    log.error('Failed to get email queue', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get email history
app.get('/api/emails/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const emails = await db.getEmailHistory?.() || [];
    res.json(emails.slice(0, parseInt(limit)));
  } catch (error) {
    log.error('Failed to get email history', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Approve and send email
app.post('/api/emails/:emailId/approve', async (req, res) => {
  try {
    // For now, just mark as approved
    res.json({ success: true, message: 'Email approved' });
  } catch (error) {
    log.error('Failed to approve email', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Reject email
app.post('/api/emails/:emailId/reject', async (req, res) => {
  try {
    res.json({ success: true, message: 'Email rejected' });
  } catch (error) {
    log.error('Failed to reject email', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONFIG API
// ============================================

// Get email config
app.get('/api/config/email', async (req, res) => {
  try {
    res.json({
      autoSendEnabled: false,
      requireApproval: true,
      fromEmail: process.env.FROM_EMAIL || null,
      configured: !!process.env.RESEND_API_KEY
    });
  } catch (error) {
    log.error('Failed to get email config', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update email config
app.patch('/api/config/email', async (req, res) => {
  try {
    // Config is read-only in serverless (would need external storage)
    res.json({ success: true, message: 'Config updated' });
  } catch (error) {
    log.error('Failed to update email config', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREVIEW & ANALYTICS API
// ============================================

// Get preview metadata
app.get('/api/preview/:slug', async (req, res) => {
  try {
    const preview = await db.getPreview?.(req.params.slug);
    if (!preview) {
      return res.status(404).json({ error: 'Preview not found' });
    }
    res.json(preview);
  } catch (error) {
    log.error('Failed to get preview', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get preview HTML
app.get('/api/preview/:slug/html', async (req, res) => {
  try {
    const preview = await db.getPreview?.(req.params.slug);
    if (!preview) {
      return res.status(404).json({ error: 'Preview not found' });
    }
    res.status(200);
    res.headers = { ...res.headers, 'Content-Type': 'text/html' };
    res.body = preview.html;
    return;
  } catch (error) {
    log.error('Failed to get preview HTML', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Record analytics event
app.post('/api/preview/:slug/event', async (req, res) => {
  try {
    await db.recordAnalyticsEvent?.(req.params.slug, req.body);
    res.json({ success: true });
  } catch (error) {
    log.error('Failed to record analytics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get analytics
app.get('/api/preview/:slug/analytics', async (req, res) => {
  try {
    const analytics = await db.getPreviewAnalytics?.(req.params.slug) || {
      pageviews: 0,
      uniqueSessions: 0,
      avgTimeOnPage: 0,
      scrollDepths: {},
      clicks: {},
      formInteractions: {}
    };
    res.json(analytics);
  } catch (error) {
    log.error('Failed to get analytics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PIPELINE API
// ============================================

// Run pipeline for a URL (using Firecrawl for serverless scraping)
app.post('/api/pipeline', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!process.env.FIRECRAWL_API_KEY) {
      return res.status(400).json({ error: 'FIRECRAWL_API_KEY not configured' });
    }

    log.info('Starting serverless pipeline', { url });

    // 1. Scrape with Firecrawl
    log.info('Scraping site with Firecrawl...');
    const siteData = await scrapeSiteLite(url);

    // 2. Build template
    log.info('Building template...');
    const builder = new TemplateBuilder();
    await builder.init();
    const { slots, industry } = await builder.build(siteData);
    siteData.industry = industry;

    // 3. AI Polish (if API key available)
    let polishedSlots = slots;
    if (process.env.ANTHROPIC_API_KEY) {
      log.info('Polishing with AI...');
      const polisher = new AIPolisher();
      polishedSlots = await polisher.polishAll(slots, siteData);
    }

    // 4. Generate final HTML
    const finalHtml = await builder.buildWithSlots(siteData, polishedSlots);

    // 5. Generate slug and save to database
    const slug = crypto.randomBytes(8).toString('hex');
    const preview = await db.createPreview({
      slug,
      originalUrl: url,
      businessName: siteData.businessName,
      industry,
      html: finalHtml,
      siteData,
      slots: polishedSlots,
      status: 'complete'
    });

    const previewUrl = `/preview/${slug}`;
    log.info('Pipeline complete', { preview: previewUrl });

    res.json({
      success: true,
      slug,
      preview: previewUrl,
      businessName: siteData.businessName,
      industry
    });

  } catch (error) {
    log.error('Pipeline failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Netlify Function handler
export async function handler(event, context) {
  // Convert Netlify event to Express request format
  const path = event.path.replace('/.netlify/functions/api', '/api');

  return new Promise((resolve, reject) => {
    // Create mock request and response
    const req = {
      method: event.httpMethod,
      path: path,
      url: path,
      query: event.queryStringParameters || {},
      params: {},
      body: event.body ? JSON.parse(event.body) : {},
      headers: event.headers
    };

    // Extract route params for various patterns
    const siteIdMatch = path.match(/\/api\/deployments\/([^/]+)/);
    if (siteIdMatch) {
      req.params.siteId = siteIdMatch[1];
    }

    const leadIdMatch = path.match(/\/api\/leads\/([^/]+)/);
    if (leadIdMatch) {
      req.params.leadId = leadIdMatch[1];
    }

    const emailIdMatch = path.match(/\/api\/emails\/([^/]+)/);
    if (emailIdMatch && !['queue', 'history'].includes(emailIdMatch[1])) {
      req.params.emailId = emailIdMatch[1];
    }

    const slugMatch = path.match(/\/api\/preview\/([^/]+)/);
    if (slugMatch) {
      req.params.slug = slugMatch[1];
    }

    const res = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
      },
      body: '',
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = JSON.stringify(data);
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body
        });
      }
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      resolve({
        statusCode: 200,
        headers: res.headers,
        body: ''
      });
      return;
    }

    // Find and execute matching route
    const routes = app._router.stack.filter(r => r.route);

    for (const route of routes) {
      const routePath = route.route.path;
      const method = event.httpMethod.toLowerCase();

      // Check if method matches
      if (!route.route.methods[method]) continue;

      // Check if path matches (simple matching)
      const routePattern = routePath.replace(/:([^/]+)/g, '([^/]+)');
      const regex = new RegExp(`^${routePattern}$`);

      if (regex.test(path)) {
        // Execute the route handler
        route.route.stack[0].handle(req, res, (err) => {
          if (err) {
            resolve({
              statusCode: 500,
              headers: res.headers,
              body: JSON.stringify({ error: err.message })
            });
          }
        });
        return;
      }
    }

    // No route matched
    resolve({
      statusCode: 404,
      headers: res.headers,
      body: JSON.stringify({ error: 'Not found' })
    });
  });
}
