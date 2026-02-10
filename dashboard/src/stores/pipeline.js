import { defineStore } from 'pinia';
import { api } from '../api.js';

export const usePipelineStore = defineStore('pipeline', {
  state: () => ({
    activeJob: {
      active: false,
      url: '',
      jobId: null,
      stageIndex: 0,
      percent: 0,
      elapsed: 0,
      error: null,
      previewUrl: null,
      siteId: null,
      stage: 'queued',
      label: 'Starting pipeline...'
    },
    _eventSource: null,
    _progressInterval: null,
    _progressPollInterval: null,
    // Form state
    newLeadUrl: '',
    skipEmail: false,
    submitting: false,
    urlError: ''
  }),

  getters: {
    stagesConfig() {
      return [
        { id: 'scraping', label: 'Scraping' },
        { id: 'building', label: 'Building' },
        { id: 'saving', label: 'Saving' },
        { id: 'complete', label: 'Complete' }
      ];
    }
  },

  actions: {
    async startPipeline(url, skipEmail = false) {
      this.submitting = true;
      this._resetProgress(url);

      try {
        const response = await api.post('/api/pipeline', {
          url,
          skipEmail
        });

        // Pipeline completed synchronously
        if (response && response.success && response.preview) {
          this.activeJob.stageIndex = 3;
          this.activeJob.percent = 100;
          this.activeJob.previewUrl = response.preview;
          this._stopProgress();
          return response;
        }

        // Async job flow - subscribe to SSE
        if (response && response.jobId) {
          this.activeJob.jobId = response.jobId;
          this.connectSSE(response.jobId);
        } else {
          this._startPolling();
        }

        if (response && response.siteId) {
          this.activeJob.siteId = response.siteId;
        }

        return response;
      } catch (err) {
        this.activeJob.error = err.message;
        this._stopProgress();
        throw err;
      } finally {
        this.submitting = false;
      }
    },

    connectSSE(jobId) {
      this._eventSource = new EventSource(`/api/pipeline/${jobId}/status`);

      this._eventSource.onmessage = (event) => {
        try {
          const status = JSON.parse(event.data);

          this.activeJob.stage = status.stage;
          this.activeJob.label = status.label;
          this.activeJob.percent = status.progress;

          const stageMap = {
            'queued': 0, 'scraping': 0, 'scrape_fallback': 0,
            'analyzing': 1, 'generating': 1,
            'building': 2, 'deploying': 2,
            'complete': 3, 'error': -1
          };
          this.activeJob.stageIndex = stageMap[status.stage] ?? 0;

          // Handle completion
          if (status.stage === 'complete') {
            this.activeJob.percent = 100;
            this.activeJob.stageIndex = 3;
            if (status.preview) {
              this.activeJob.previewUrl = status.preview;
            }
            this._stopProgress();
          }

          // Handle error
          if (status.stage === 'error') {
            this.activeJob.error = status.error?.message || 'Pipeline failed';
            this._stopProgress();
          }
        } catch (e) {
          console.error('[SSE] Failed to parse status:', e);
        }
      };

      this._eventSource.onerror = () => {
        this.disconnectSSE();
        this._startPolling();
      };
    },

    disconnectSSE() {
      if (this._eventSource) {
        this._eventSource.close();
        this._eventSource = null;
      }
    },

    _resetProgress(url) {
      this._stopProgress();
      this.activeJob = {
        active: true,
        url,
        jobId: null,
        stageIndex: 0,
        percent: 5,
        elapsed: 0,
        error: null,
        previewUrl: null,
        siteId: null,
        stage: 'queued',
        label: 'Starting pipeline...'
      };

      const startTime = Date.now();
      this._progressInterval = setInterval(() => {
        this.activeJob.elapsed = Math.floor((Date.now() - startTime) / 1000);
      }, 1000);
    },

    _startPolling() {
      this._progressPollInterval = setInterval(async () => {
        // Polling is handled by the component via leads store refresh
      }, 2000);

      // Auto-advance stages for visual feedback
      setTimeout(() => {
        if (this.activeJob.active && this.activeJob.stageIndex === 0) {
          this.activeJob.stageIndex = 1;
          this.activeJob.percent = 35;
        }
      }, 5000);

      setTimeout(() => {
        if (this.activeJob.active && this.activeJob.stageIndex === 1) {
          this.activeJob.stageIndex = 2;
          this.activeJob.percent = 65;
        }
      }, 15000);
    },

    updateProgressFromStatus(status, lead) {
      const statusToStage = {
        'discovered': 0, 'scoring': 0, 'qualified': 0,
        'queued': 0, 'scraping': 0, 'scraped': 1,
        'building': 1, 'deploying': 2,
        'deployed': 3, 'emailing': 3, 'converted': 3
      };

      const stageIndex = statusToStage[status] ?? this.activeJob.stageIndex;
      const percent = Math.min(95, (stageIndex + 1) * 25);

      this.activeJob.stageIndex = stageIndex;
      this.activeJob.percent = percent;

      if (status === 'deployed' || status === 'emailing') {
        this.activeJob.stageIndex = 3;
        this.activeJob.percent = 100;
        this.activeJob.previewUrl = lead.preview || lead.previewUrl;
        this._stopProgress();
      }

      if (status === 'error' || lead.lastError) {
        this.activeJob.error = lead.lastError || 'Pipeline failed';
        this._stopProgress();
      }
    },

    _stopProgress() {
      if (this._progressInterval) {
        clearInterval(this._progressInterval);
        this._progressInterval = null;
      }
      if (this._progressPollInterval) {
        clearInterval(this._progressPollInterval);
        this._progressPollInterval = null;
      }
      this.disconnectSSE();
    },

    cleanup() {
      this._stopProgress();
    }
  }
});
