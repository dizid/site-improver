// netlify/functions/api.js
// Serverless function wrapper for the Express API

import express from 'express';
import cors from 'cors';
import * as db from '../../src/db.js';
import { OutreachManager } from '../../src/outreach.js';
import NetlifyDeployer from '../../src/netlifyDeploy.js';
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
    // Optionally delete from Netlify too
    if (process.env.NETLIFY_AUTH_TOKEN && req.query.deleteNetlify === 'true') {
      const deployer = new NetlifyDeployer(process.env.NETLIFY_AUTH_TOKEN);
      try {
        await deployer.deleteSite(req.params.siteId);
      } catch (e) {
        log.warn('Failed to delete Netlify site', { error: e.message });
      }
    }

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

    if (!process.env.NETLIFY_AUTH_TOKEN) {
      return res.status(400).json({ error: 'NETLIFY_AUTH_TOKEN not configured' });
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

    // 5. Deploy to Netlify
    log.info('Deploying to Netlify...');
    const deployer = new NetlifyDeployer(process.env.NETLIFY_AUTH_TOKEN);
    const deployment = await deployer.deploy(finalHtml, siteData.businessName || 'preview');

    // 6. Save to database
    const city = extractCity(siteData.address);
    await db.saveDeployment({
      siteId: deployment.siteId,
      siteName: deployment.siteName,
      original: url,
      preview: deployment.url,
      businessName: siteData.businessName,
      industry,
      phone: siteData.phone,
      email: siteData.email,
      address: siteData.address,
      city
    });

    log.info('Pipeline complete', { preview: deployment.url });

    res.json({
      success: true,
      siteId: deployment.siteId,
      preview: deployment.url,
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

    // Extract route params for :siteId patterns
    const siteIdMatch = path.match(/\/api\/deployments\/([^/]+)/);
    if (siteIdMatch) {
      req.params.siteId = siteIdMatch[1];
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
