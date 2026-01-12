// src/pipelineEvents.js
// Real-time pipeline status events via EventEmitter

import { EventEmitter } from 'events';
import logger from './logger.js';

const log = logger.child('pipelineEvents');

// Pipeline stages with progress percentages
export const PIPELINE_STAGES = {
  QUEUED: { name: 'queued', progress: 0, label: 'Starting...' },
  SCRAPING: { name: 'scraping', progress: 10, label: 'Analyzing website...' },
  SCRAPE_FALLBACK: { name: 'scrape_fallback', progress: 15, label: 'Trying alternative scraper...' },
  ANALYZING: { name: 'analyzing', progress: 30, label: 'Understanding content...' },
  GENERATING: { name: 'generating', progress: 50, label: 'Creating new design...' },
  BUILDING: { name: 'building', progress: 70, label: 'Building website...' },
  DEPLOYING: { name: 'deploying', progress: 85, label: 'Deploying preview...' },
  COMPLETE: { name: 'complete', progress: 100, label: 'Preview ready!' },
  ERROR: { name: 'error', progress: 0, label: 'Something went wrong' }
};

class PipelineEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent pipeline subscriptions
    this.activeJobs = new Map(); // Track active pipeline jobs
  }

  /**
   * Emit a status update for a specific pipeline job
   */
  emitStatus(jobId, stage, details = {}) {
    const stageInfo = PIPELINE_STAGES[stage] || PIPELINE_STAGES.ERROR;

    const status = {
      jobId,
      stage: stageInfo.name,
      progress: stageInfo.progress,
      label: details.label || stageInfo.label,
      timestamp: Date.now(),
      ...details
    };

    // Store current status
    this.activeJobs.set(jobId, status);

    // Emit to job-specific listeners
    this.emit(`status:${jobId}`, status);

    // Emit to global listeners (for dashboard overview)
    this.emit('status', status);

    log.debug('Pipeline status', { jobId, stage: stageInfo.name, progress: stageInfo.progress });

    return status;
  }

  /**
   * Emit an error for a pipeline job
   */
  emitError(jobId, error, stage = 'unknown') {
    const status = {
      jobId,
      stage: 'error',
      progress: 0,
      label: 'Pipeline failed',
      error: {
        message: error.message || String(error),
        stage,
        code: error.code || 'PIPELINE_ERROR'
      },
      timestamp: Date.now()
    };

    this.activeJobs.set(jobId, status);
    this.emit(`status:${jobId}`, status);
    this.emit('status', status);
    this.emit('error', { jobId, error: status.error });

    log.error('Pipeline error', { jobId, stage, error: error.message });

    return status;
  }

  /**
   * Get current status of a job
   */
  getStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Clean up completed/old jobs
   */
  cleanup(maxAgeMs = 60 * 60 * 1000) { // Default 1 hour
    const now = Date.now();
    for (const [jobId, status] of this.activeJobs.entries()) {
      if (now - status.timestamp > maxAgeMs) {
        this.activeJobs.delete(jobId);
      }
    }
  }

  /**
   * Create a job tracker helper for cleaner pipeline code
   */
  createJobTracker(jobId) {
    return {
      queued: (details) => this.emitStatus(jobId, 'QUEUED', details),
      scraping: (details) => this.emitStatus(jobId, 'SCRAPING', details),
      scrapeFallback: (details) => this.emitStatus(jobId, 'SCRAPE_FALLBACK', details),
      analyzing: (details) => this.emitStatus(jobId, 'ANALYZING', details),
      generating: (details) => this.emitStatus(jobId, 'GENERATING', details),
      building: (details) => this.emitStatus(jobId, 'BUILDING', details),
      deploying: (details) => this.emitStatus(jobId, 'DEPLOYING', details),
      complete: (details) => this.emitStatus(jobId, 'COMPLETE', details),
      error: (error, stage) => this.emitError(jobId, error, stage)
    };
  }
}

// Singleton instance
export const pipelineEvents = new PipelineEventEmitter();

// Cleanup old jobs every 30 minutes
setInterval(() => pipelineEvents.cleanup(), 30 * 60 * 1000);

export default pipelineEvents;
