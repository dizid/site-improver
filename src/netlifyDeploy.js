// src/netlifyDeploy.js
import { NetlifyAPI } from 'netlify';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { slugify } from './utils.js';

const log = logger.child('netlifyDeploy');

export class NetlifyDeployer {
  constructor(authToken) {
    this.client = new NetlifyAPI(authToken);
    this.sitePrefix = 'preview';
  }

  slugify(businessName) {
    return slugify(businessName);
  }

  generateSiteId(businessName) {
    const slug = this.slugify(businessName);
    const hash = crypto.randomBytes(4).toString('hex');
    return `${this.sitePrefix}-${slug}-${hash}`;
  }

  async createSite(businessName) {
    const siteName = this.generateSiteId(businessName);

    try {
      const site = await this.client.createSite({
        body: {
          name: siteName,
          custom_domain: null
        }
      });

      return site;
    } catch (error) {
      if (error.status === 422) {
        // Name taken, try with different hash
        return this.createSite(businessName);
      }
      throw error;
    }
  }

  async prepareDeployDir(html, assets = {}) {
    const deployDir = path.join('/tmp', `deploy-${Date.now()}`);
    await fs.mkdir(deployDir, { recursive: true });

    // Write main HTML
    await fs.writeFile(path.join(deployDir, 'index.html'), html);

    // Write _redirects for clean URLs
    await fs.writeFile(
      path.join(deployDir, '_redirects'),
      '/* /index.html 200'
    );

    // Write any additional assets
    for (const [filename, content] of Object.entries(assets)) {
      const filePath = path.join(deployDir, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      if (Buffer.isBuffer(content)) {
        await fs.writeFile(filePath, content);
      } else {
        await fs.writeFile(filePath, content);
      }
    }

    return deployDir;
  }

  async getFilesRecursive(dir, base = dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this.getFilesRecursive(fullPath, base));
      } else {
        files.push({
          path: fullPath,
          relative: '/' + path.relative(base, fullPath)
        });
      }
    }

    return files;
  }

  async deployFiles(siteId, deployDir) {
    const files = await this.getFilesRecursive(deployDir);

    // Create file digest for Netlify
    const filesDigest = {};
    const fileHashes = new Map();

    for (const file of files) {
      const content = await fs.readFile(file.path);
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      filesDigest[file.relative] = hash;
      fileHashes.set(hash, file);
    }

    // Create deploy
    const deploy = await this.client.createSiteDeploy({
      site_id: siteId,
      body: {
        files: filesDigest,
        draft: false,
        production: true
      }
    });

    // Upload required files
    const required = deploy.required || [];

    for (const hash of required) {
      const file = fileHashes.get(hash);
      if (file) {
        const content = await fs.readFile(file.path);
        await this.client.uploadDeployFile({
          deploy_id: deploy.id,
          path: file.relative,
          body: content
        });
      }
    }

    return deploy;
  }

  async waitForDeploy(deployId, maxWait = CONFIG.timeouts.deployMax) {
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const deploy = await this.client.getDeploy({ deploy_id: deployId });

      if (deploy.state === 'ready') {
        return deploy;
      }

      if (deploy.state === 'error') {
        throw new Error(`Deploy failed: ${deploy.error_message}`);
      }

      await new Promise(r => setTimeout(r, CONFIG.timeouts.deployPoll));
    }

    throw new Error('Deploy timeout');
  }

  async deploy(html, businessName, assets = {}) {
    log.info(`Creating Netlify site for ${businessName}...`);

    // Create new site
    const site = await this.createSite(businessName);
    log.info(`Site created: ${site.name}`);

    // Prepare files
    const deployDir = await this.prepareDeployDir(html, assets);

    // Deploy
    log.info('Deploying...');
    const deploy = await this.deployFiles(site.id, deployDir);

    // Cleanup temp directory
    await fs.rm(deployDir, { recursive: true });

    // Wait for deploy to be ready
    await this.waitForDeploy(deploy.id);

    return {
      siteId: site.id,
      siteName: site.name,
      url: `https://${site.name}.netlify.app`,
      adminUrl: site.admin_url,
      deployId: deploy.id
    };
  }

  async deleteSite(siteId) {
    await this.client.deleteSite({ site_id: siteId });
  }

  async listPreviewSites() {
    const sites = await this.client.listSites();
    return sites.filter(s => s.name.startsWith(this.sitePrefix));
  }

  async cleanupOldSites(maxAgeDays = CONFIG.cleanup.maxAgeDays) {
    const sites = await this.listPreviewSites();
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

    const deleted = [];
    for (const site of sites) {
      const createdAt = new Date(site.created_at).getTime();
      if (createdAt < cutoff) {
        await this.deleteSite(site.id);
        deleted.push(site.name);
      }
    }

    return deleted;
  }
}

export default NetlifyDeployer;
