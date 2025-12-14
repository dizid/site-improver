// src/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import { OutreachManager } from './outreach.js';
import NetlifyDeployer from './netlifyDeploy.js';
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('server');

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

  // Run pipeline for a URL (async)
  app.post('/api/pipeline', async (req, res) => {
    try {
      const { url, skipPolish, skipEmail } = req.body;

      log.info('=== PIPELINE REQUEST RECEIVED ===');
      log.info(`URL: ${url}`);
      log.info(`skipPolish: ${skipPolish}, skipEmail: ${skipEmail}`);

      if (!url) {
        log.warn('Pipeline rejected: No URL provided');
        return res.status(400).json({ error: 'URL required' });
      }

      // Return immediately, process in background
      log.info('Returning response to client, starting background pipeline...');
      res.json({ message: 'Pipeline started', url, status: 'processing' });

      // Run pipeline in background
      log.info('Importing pipeline module...');
      const { rebuildAndDeploy } = await import('./pipeline.js');

      log.info('Starting rebuildAndDeploy...');
      rebuildAndDeploy(url, { skipPolish })
        .then(async result => {
          log.info('=== PIPELINE COMPLETE ===');
          log.info(`Business: ${result.siteData?.businessName}`);
          log.info(`Industry: ${result.industry}`);
          log.info(`Preview: ${result.preview}`);
          log.info(`Duration: ${result.duration}s`);

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
        .catch(error => {
          log.error('=== PIPELINE FAILED ===');
          log.error(`URL: ${url}`);
          log.error(`Error: ${error.message}`);
          log.error(`Stack: ${error.stack}`);
        });

    } catch (error) {
      log.error('Pipeline endpoint error:', { error: error.message });
      res.status(500).json({ error: error.message });
    }
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
  
  const port = process.env.PORT || CONFIG.server.defaultPort;
  const app = createServer();

  app.listen(port, () => {
    log.info(`Dashboard running at http://localhost:${port}`);
  });
}

export default createServer;
