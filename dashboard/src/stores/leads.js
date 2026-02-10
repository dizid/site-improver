import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useLeadsStore = defineStore('leads', {
  state: () => ({
    leads: [],
    stats: {
      totalLeads: 0,
      totalDeployments: 0,
      byStatus: {},
      byIndustry: {},
      conversionRate: 0,
      activeDeployments: 0
    },
    loading: true,
    error: null,
    filter: 'all',
    search: '',
    processingLeads: new Set(),
    // Discovery state
    discoverQuery: '',
    discoverLocation: '',
    discoverLimit: '10',
    discovering: false,
    discoverResults: null
  }),

  getters: {
    filteredLeads(state) {
      let result = state.leads;

      if (state.filter !== 'all') {
        result = result.filter(l => l.status === state.filter);
      }

      if (state.search) {
        const q = state.search.toLowerCase();
        result = result.filter(l =>
          (l.businessName || '').toLowerCase().includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          (l.industry || '').toLowerCase().includes(q)
        );
      }

      return result;
    },

    pipelineStages(state) {
      const stages = [
        { id: 'discovery', name: 'Discovery', color: 'blue', statuses: ['discovered', 'scoring', 'qualified'] },
        { id: 'processing', name: 'Processing', color: 'yellow', statuses: ['queued', 'scraping', 'scraped', 'building', 'deploying'] },
        { id: 'deployed', name: 'Deployed', color: 'green', statuses: ['deployed'] },
        { id: 'outreach', name: 'Outreach', color: 'green', statuses: ['emailing', 'follow_up_1', 'follow_up_2', 'last_chance'] },
        { id: 'final', name: 'Final', color: 'purple', statuses: ['converted', 'expired', 'deleted'] }
      ];

      return stages.map(stage => ({
        ...stage,
        leads: state.leads.filter(l => stage.statuses.includes(l.status)),
        count: state.leads.filter(l => stage.statuses.includes(l.status)).length
      }));
    },

    leadsByIndustry(state) {
      return state.stats.byIndustry || {};
    }
  },

  actions: {
    async fetchLeads() {
      try {
        const params = new URLSearchParams();
        if (this.filter !== 'all') params.set('status', this.filter);
        if (this.search) params.set('search', this.search);

        const [leadsData, statsData] = await Promise.all([
          api.get(`/api/leads?${params}`),
          api.get('/api/stats')
        ]);

        this.leads = leadsData;
        this.stats = statsData;
        this.error = null;
      } catch (err) {
        this.error = err.message;
        // Try legacy endpoints if new ones fail
        try {
          const [deploymentsData, legacyStats] = await Promise.all([
            api.get('/api/deployments'),
            api.get('/api/stats')
          ]);
          this.leads = deploymentsData;
          this.stats = legacyStats;
          this.error = null;
        } catch (legacyErr) {
          console.error('Both API versions failed:', legacyErr);
        }
      } finally {
        this.loading = false;
      }
    },

    async processLead(lead) {
      if (!lead.url) {
        throw new Error('Lead has no URL to process');
      }

      this.processingLeads.add(lead.id);
      try {
        await api.post('/api/pipeline', { url: lead.url });
        // Refresh after a moment to show status change
        setTimeout(() => this.fetchLeads(), 2000);
      } finally {
        this.processingLeads.delete(lead.id);
      }
    },

    async deleteLead(lead) {
      lead._loading = true;
      try {
        const endpoint = lead.id
          ? `/api/leads/${lead.id}?deleteNetlify=true`
          : `/api/deployments/${lead.siteId}?deleteNetlify=true`;
        await api.delete(endpoint);
        await this.fetchLeads();
      } finally {
        lead._loading = false;
      }
    },

    async updateLeadStatus(lead, newStatus) {
      lead._loading = true;
      try {
        const endpoint = lead.id
          ? `/api/leads/${lead.id}`
          : `/api/deployments/${lead.siteId}`;
        await api.patch(endpoint, { status: newStatus });
        await this.fetchLeads();
      } finally {
        lead._loading = false;
      }
    },

    async sendEmail(lead) {
      lead._loading = true;
      try {
        const endpoint = lead.id
          ? `/api/leads/${lead.id}/send-email`
          : `/api/deployments/${lead.siteId}/send-email`;
        await api.post(endpoint);
        await this.fetchLeads();
      } finally {
        lead._loading = false;
      }
    },

    async convertLead(lead, amount) {
      lead._loading = true;
      try {
        const siteId = lead.siteId || lead.id;
        await api.post(`/api/deployments/${siteId}/convert`, {
          amount: amount ? parseFloat(amount) : null,
          notes: `Converted on ${new Date().toLocaleDateString()}`
        });
        await this.fetchLeads();
      } finally {
        lead._loading = false;
      }
    },

    exportLead(lead) {
      const siteId = lead.siteId || lead.id;
      if (!siteId) {
        throw new Error('No site ID found for export');
      }
      const exportUrl = `/api/deployments/${siteId}/export`;
      window.open(exportUrl, '_blank');
    },

    async discover() {
      if (!this.discoverQuery) {
        throw new Error('Please enter an industry or business type');
      }

      this.discovering = true;
      this.discoverResults = null;

      try {
        const result = await api.post('/api/discover', {
          query: this.discoverQuery,
          location: this.discoverLocation || 'Denver, CO',
          limit: parseInt(this.discoverLimit)
        });

        this.discoverResults = result;
        await this.fetchLeads();
        return result;
      } finally {
        this.discovering = false;
      }
    },

    async bulkProcess(ids) {
      const results = { success: 0, failed: 0 };
      const promises = ids.map(async (id) => {
        const lead = this.leads.find(l => (l.id || l.siteId) === id);
        if (lead && lead.url) {
          try {
            // Direct API call without fetchLeads() inside processLead
            await api.post('/api/pipeline', { url: lead.url });
            return { status: 'success' };
          } catch {
            return { status: 'failed' };
          }
        }
        return { status: 'skipped' };
      });

      const outcomes = await Promise.allSettled(promises);
      outcomes.forEach((outcome) => {
        if (outcome.status === 'fulfilled' && outcome.value.status === 'success') {
          results.success++;
        } else if (outcome.status === 'fulfilled' && outcome.value.status === 'failed') {
          results.failed++;
        } else if (outcome.status === 'rejected') {
          results.failed++;
        }
      });

      await this.fetchLeads();
      return results;
    },

    async bulkDelete(ids) {
      const results = { success: 0, failed: 0 };
      const promises = ids.map(async (id) => {
        const lead = this.leads.find(l => (l.id || l.siteId) === id);
        if (lead) {
          try {
            // Direct API call without fetchLeads()
            const endpoint = lead.id
              ? `/api/leads/${lead.id}?deleteNetlify=true`
              : `/api/deployments/${lead.siteId}?deleteNetlify=true`;
            await api.delete(endpoint);
            return { status: 'success' };
          } catch {
            return { status: 'failed' };
          }
        }
        return { status: 'skipped' };
      });

      const outcomes = await Promise.allSettled(promises);
      outcomes.forEach((outcome) => {
        if (outcome.status === 'fulfilled' && outcome.value.status === 'success') {
          results.success++;
        } else if (outcome.status === 'fulfilled' && outcome.value.status === 'failed') {
          results.failed++;
        } else if (outcome.status === 'rejected') {
          results.failed++;
        }
      });

      await this.fetchLeads();
      return results;
    }
  }
});
