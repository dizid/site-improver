import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    toast: null,
    activeModal: null,
    mobileMenuOpen: false,
    onboardingComplete: localStorage.getItem('onboardingComplete') === 'true',
    emailTab: 'queue',
    previewDevice: 'desktop',
    emailPreview: null,
    selectedLead: null,
    selectedLeadIds: new Set()
  }),

  actions: {
    showToast(message, type = 'info', duration = 5000) {
      this.toast = { message, type };
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toast = null;
      }, duration);
    },

    hideToast() {
      this.toast = null;
      if (this._toastTimer) clearTimeout(this._toastTimer);
    },

    openModal(name) {
      this.activeModal = name;
    },

    closeModal() {
      this.activeModal = null;
    },

    completeOnboarding() {
      this.onboardingComplete = true;
      localStorage.setItem('onboardingComplete', 'true');
    },

    resetOnboarding() {
      this.onboardingComplete = false;
      localStorage.removeItem('onboardingComplete');
    },

    toggleLeadSelection(id) {
      if (this.selectedLeadIds.has(id)) {
        this.selectedLeadIds.delete(id);
      } else {
        this.selectedLeadIds.add(id);
      }
      // Force reactivity by creating new Set
      this.selectedLeadIds = new Set(this.selectedLeadIds);
    },

    selectAllLeads(ids) {
      this.selectedLeadIds = new Set(ids);
    },

    clearSelection() {
      this.selectedLeadIds = new Set();
    }
  }
});
