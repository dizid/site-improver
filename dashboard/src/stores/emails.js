import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useEmailsStore = defineStore('emails', {
  state: () => ({
    queue: [],
    history: [],
    config: { autoSendEnabled: false, requireApproval: true },
    loading: false,
    fromEmail: '',
    resendConfigured: false,
    error: null
  }),

  actions: {
    async fetchQueue() {
      this.error = null;
      try {
        this.queue = await api.get('/api/emails/queue');
      } catch (err) {
        this.error = err.message;
        console.error('Failed to fetch email queue:', err);
      }
    },

    async fetchHistory() {
      this.error = null;
      try {
        this.history = await api.get('/api/emails/history?limit=50');
      } catch (err) {
        this.error = err.message;
        console.error('Failed to fetch email history:', err);
      }
    },

    async fetchConfig() {
      this.error = null;
      try {
        const configData = await api.get('/api/config/email');
        this.config = configData;
      } catch (err) {
        this.error = err.message;
        console.error('Failed to fetch email config:', err);
      }
    },

    async fetchAll() {
      await Promise.all([
        this.fetchQueue(),
        this.fetchHistory(),
        this.fetchConfig()
      ]);
    },

    async approveSend(emailId) {
      this.error = null;
      const email = this.queue.find(e => e.id === emailId);
      if (email) email._loading = true;

      try {
        await api.post(`/api/emails/${emailId}/approve`, { sendNow: true });
        await this.fetchAll();
      } catch (err) {
        this.error = err.message;
        throw err;
      } finally {
        if (email) email._loading = false;
      }
    },

    async reject(emailId) {
      this.error = null;
      const email = this.queue.find(e => e.id === emailId);
      if (email) email._loading = true;

      try {
        await api.post(`/api/emails/${emailId}/reject`);
        await this.fetchAll();
      } catch (err) {
        this.error = err.message;
        throw err;
      } finally {
        if (email) email._loading = false;
      }
    },

    async updateConfig() {
      this.error = null;
      try {
        await api.patch('/api/config/email', {
          autoSendEnabled: this.config.autoSendEnabled,
          requireApproval: this.config.requireApproval
        });
      } catch (err) {
        this.error = err.message;
        throw err;
      }
    }
  }
});
