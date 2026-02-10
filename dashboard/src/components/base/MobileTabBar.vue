<template>
  <nav class="mobile-tab-bar" aria-label="Mobile navigation">
    <a
      href="#pipeline"
      :class="['tab-item', { active: activeTab === 'pipeline' }]"
      @click="handleTabClick('pipeline', $event)"
      aria-label="Pipeline"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span class="tab-label">Pipeline</span>
    </a>

    <a
      href="#leads"
      :class="['tab-item', { active: activeTab === 'leads' }]"
      @click="handleTabClick('leads', $event)"
      aria-label="Leads"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span class="tab-label">Leads</span>
    </a>

    <a
      href="#emails"
      :class="['tab-item', { active: activeTab === 'emails' }]"
      @click="handleTabClick('emails', $event)"
      aria-label="Emails"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      <span class="tab-label">Emails</span>
    </a>

    <a
      href="#demo"
      :class="['tab-item', { active: activeTab === 'demo' }]"
      @click="handleTabClick('demo', $event)"
      aria-label="Settings"
    >
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"></path>
      </svg>
      <span class="tab-label">Demo</span>
    </a>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const activeTab = ref('pipeline');

function handleTabClick(tab, event) {
  event.preventDefault();
  activeTab.value = tab;
  const element = document.getElementById(tab);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateActiveTab() {
  const hash = window.location.hash.slice(1);
  if (hash && ['pipeline', 'leads', 'emails', 'demo'].includes(hash)) {
    activeTab.value = hash;
  }
}

onMounted(() => {
  updateActiveTab();
  window.addEventListener('hashchange', updateActiveTab);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', updateActiveTab);
});
</script>

<style scoped>
.mobile-tab-bar {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 0.5rem 0;
  z-index: 100;
  backdrop-filter: blur(8px);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
}

.mobile-tab-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex: 1;
  padding: 0.5rem;
  min-height: 48px;
  color: var(--text-muted);
  text-decoration: none;
  transition: all var(--transition-fast);
  position: relative;
  border-radius: var(--radius-md);
}

.tab-item:active {
  background: var(--bg-hover);
}

.tab-item.active {
  color: var(--accent-blue);
}

.tab-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan));
  border-radius: 0 0 3px 3px;
}

.tab-icon {
  width: 22px;
  height: 22px;
  stroke-width: 2;
}

.tab-label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

@media (min-width: 769px) {
  .mobile-tab-bar {
    display: none !important;
  }
}

@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex;
  }
}
</style>
