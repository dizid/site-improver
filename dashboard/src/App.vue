<template>
  <div class="app">
    <!-- Toast Notification -->
    <Teleport to="body">
      <div v-if="toast" :class="['toast', `toast-${toast.type}`]" role="alert" aria-live="polite">
        <span>{{ toast.message }}</span>
        <button @click="toast = null" aria-label="Dismiss notification">&times;</button>
      </div>
    </Teleport>

    <header class="header">
      <div class="header-content">
        <h1>Site Improver</h1>
        <span class="header-subtitle">Lead Pipeline</span>
        <button
          class="mobile-menu-btn"
          @click="mobileMenuOpen = !mobileMenuOpen"
          :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="mobileMenuOpen"
        >
          <span class="hamburger-icon"></span>
        </button>
      </div>
      <nav :class="['mobile-nav', { open: mobileMenuOpen }]" aria-label="Main navigation">
        <a href="#demo" @click="mobileMenuOpen = false">Demo</a>
        <a href="#find-leads" @click="mobileMenuOpen = false">Find Leads</a>
        <a href="#pipeline" @click="mobileMenuOpen = false">Pipeline</a>
        <a href="#leads" @click="mobileMenuOpen = false">All Leads</a>
      </nav>
    </header>

    <main class="main">
      <div v-if="error" class="error-banner">
        Error loading data: {{ error }}
        <button @click="fetchData">Retry</button>
      </div>

      <!-- Stats Section -->
      <section id="stats" aria-label="Statistics">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.totalLeads || 0 }}</div>
            <div class="stat-label">Total Leads</div>
          </div>
          <div class="stat-card stat-blue">
            <div class="stat-value">{{ stats.byStatus?.deployed || 0 }}</div>
            <div class="stat-label">Deployed</div>
          </div>
          <div class="stat-card stat-yellow">
            <div class="stat-value">{{ stats.byStatus?.emailing || 0 }}</div>
            <div class="stat-label">Emailing</div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-value">{{ stats.byStatus?.converted || 0 }}</div>
            <div class="stat-label">Converted</div>
          </div>
          <div class="stat-card stat-purple">
            <div class="stat-value">{{ stats.conversionRate || 0 }}%</div>
            <div class="stat-label">Conversion Rate</div>
          </div>
          <div class="stat-card stat-money">
            <div class="stat-value">{{ stats.activeDeployments || 0 }}</div>
            <div class="stat-label">Active Sites</div>
          </div>
        </div>
      </section>

      <!-- Pipeline View Section -->
      <section id="pipeline" class="section">
        <div class="section-header">
          <h2>Pipeline Status</h2>
          <button @click="fetchData" class="btn btn-ghost" aria-label="Refresh pipeline">
            &#8635; Refresh
          </button>
        </div>
        <div class="pipeline-view">
          <div class="pipeline-stages">
            <div class="pipeline-stage" v-for="stage in pipelineStages" :key="stage.id">
              <div class="stage-header">
                <span :class="['stage-dot', `stage-${stage.color}`]"></span>
                <span class="stage-name">{{ stage.name }}</span>
                <span class="stage-count">{{ stage.count }}</span>
              </div>
              <div class="stage-leads">
                <div
                  v-for="lead in stage.leads"
                  :key="lead.id"
                  class="pipeline-lead"
                  @click="selectedLead = lead"
                >
                  <div class="lead-name">{{ lead.businessName || 'Unknown' }}</div>
                  <div class="lead-meta">{{ timeAgo(lead.updatedAt) }}</div>
                </div>
                <div v-if="stage.leads.length === 0" class="stage-empty">
                  No leads
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Demo / Process URL Section - Prominent for demos -->
      <section id="demo" class="section demo-section">
        <div class="section-header">
          <h2>🚀 Process Website</h2>
          <span class="section-badge">Demo Mode</span>
        </div>
        <p class="section-description">
          Enter any website URL to see the magic. We'll scrape it, redesign it, and deploy a preview in ~30 seconds.
        </p>
        <form @submit.prevent="handleNewLead" class="demo-form" novalidate>
          <div class="demo-input-group">
            <input
              id="demo-url"
              type="url"
              v-model="newLeadUrl"
              @blur="newLeadUrl && (urlError = validateUrl(newLeadUrl))"
              placeholder="https://example-business.com"
              :aria-describedby="urlError ? 'url-error' : undefined"
              :aria-invalid="!!urlError"
              :class="{ 'input-error': urlError }"
              :disabled="submitting"
              class="demo-input"
            />
            <button
              type="submit"
              class="btn btn-primary btn-large"
              :disabled="submitting"
              :aria-busy="submitting"
            >
              <span v-if="submitting" class="spinner spinner-sm">
                <span class="spinner-circle"></span>
              </span>
              <span>{{ submitting ? 'Building...' : '✨ Transform Site' }}</span>
            </button>
          </div>
          <span v-if="urlError" id="url-error" class="field-error" role="alert">
            {{ urlError }}
          </span>
          <div class="demo-options">
            <label class="checkbox-label">
              <input type="checkbox" v-model="skipEmail" />
              Skip sending outreach email
            </label>
          </div>
        </form>
      </section>

      <!-- Find Leads Section -->
      <section id="find-leads" class="section">
        <div class="section-header">
          <h2>🔍 Find Leads</h2>
        </div>
        <p class="section-description">
          Search for businesses by industry and location. We'll find websites that could use an upgrade.
        </p>
        <form @submit.prevent="handleDiscover" class="discover-form" novalidate>
          <div class="discover-inputs">
            <div class="form-field">
              <label for="discover-query">Industry / Business Type</label>
              <input
                id="discover-query"
                type="text"
                v-model="discoverQuery"
                placeholder="e.g., plumbers, dentists, restaurants"
                :disabled="discovering"
                class="discover-input"
              />
            </div>
            <div class="form-field">
              <label for="discover-location">Location</label>
              <input
                id="discover-location"
                type="text"
                v-model="discoverLocation"
                placeholder="e.g., Denver, CO or Amsterdam, NL"
                :disabled="discovering"
                class="discover-input"
              />
            </div>
            <div class="form-field">
              <label for="discover-limit">Limit</label>
              <select id="discover-limit" v-model="discoverLimit" :disabled="discovering" class="discover-select">
                <option value="5">5 leads</option>
                <option value="10">10 leads</option>
                <option value="20">20 leads</option>
                <option value="50">50 leads</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            class="btn btn-secondary btn-large"
            :disabled="discovering || !discoverQuery"
          >
            <span v-if="discovering" class="spinner spinner-sm">
              <span class="spinner-circle"></span>
            </span>
            <span>{{ discovering ? 'Searching...' : '🔎 Find Leads' }}</span>
          </button>
        </form>
        <div v-if="discoverResults" class="discover-results">
          <div class="discover-summary">
            Found <strong>{{ discoverResults.found }}</strong> leads,
            saved <strong>{{ discoverResults.saved }}</strong> to pipeline
          </div>
        </div>
      </section>

      <!-- Leads Table Section -->
      <section id="leads" class="section">
        <div class="section-header">
          <h2>All Leads</h2>
          <div class="filters">
            <label for="search-leads" class="sr-only">Search leads</label>
            <input
              id="search-leads"
              type="search"
              placeholder="Search..."
              v-model="search"
              class="search-input"
              aria-label="Search leads by name, email, or industry"
            />
            <label for="filter-status" class="sr-only">Filter by status</label>
            <select
              id="filter-status"
              v-model="filter"
              class="filter-select"
              aria-label="Filter leads by status"
            >
              <option value="all">All Status</option>
              <option value="discovered">Discovered</option>
              <option value="qualified">Qualified</option>
              <option value="queued">Queued</option>
              <option value="building">Building</option>
              <option value="deployed">Deployed</option>
              <option value="emailing">Emailing</option>
              <option value="converted">Converted</option>
              <option value="expired">Expired</option>
            </select>
            <button @click="fetchData" class="btn btn-ghost" aria-label="Refresh leads list">
              &#8635; Refresh
            </button>
          </div>
        </div>

        <div v-if="loading" class="loading-state" aria-live="polite">
          <div class="spinner spinner-md">
            <div class="spinner-circle"></div>
          </div>
          <span>Loading leads...</span>
        </div>

        <div v-else-if="filteredLeads.length === 0" class="empty-state">
          <p>No leads found</p>
          <p class="muted">Add a new lead above to get started</p>
        </div>

        <div v-else class="table-container">
          <table class="deployments-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Preview</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="lead in filteredLeads"
                :key="lead.id || lead.siteId"
                :class="{ loading: lead._loading }"
              >
                <td>
                  <div class="business-name">{{ lead.businessName || 'Unknown' }}</div>
                  <div class="business-meta">{{ lead.industry || 'N/A' }}</div>
                </td>
                <td>
                  <span :class="['badge', getBadgeClass(lead.status)]">
                    {{ getStatusLabel(lead.status) }}
                  </span>
                </td>
                <td>
                  <div class="contact-info">
                    <div v-if="lead.email" class="email">{{ lead.email }}</div>
                    <div v-if="lead.phone" class="phone">{{ lead.phone }}</div>
                    <span v-if="!lead.email && !lead.phone" class="muted">No contact</span>
                  </div>
                </td>
                <td>
                  <a
                    v-if="lead.preview"
                    :href="lead.preview"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="preview-link"
                  >
                    View Preview &#8599;
                  </a>
                  <span v-else class="muted">-</span>
                </td>
                <td>
                  <div class="date">{{ timeAgo(lead.updatedAt || lead.createdAt) }}</div>
                </td>
                <td>
                  <div class="actions">
                    <select
                      :value="lead.status"
                      @change="handleStatusChange(lead, $event.target.value)"
                      class="status-select"
                    >
                      <option value="discovered">Discovered</option>
                      <option value="qualified">Qualified</option>
                      <option value="queued">Queued</option>
                      <option value="building">Building</option>
                      <option value="deployed">Deployed</option>
                      <option value="emailing">Emailing</option>
                      <option value="converted">Converted</option>
                      <option value="expired">Expired</option>
                    </select>

                    <button
                      v-if="lead.email && lead.status === 'deployed'"
                      class="btn btn-sm btn-primary"
                      @click="handleSendEmail(lead)"
                      :disabled="lead._loading"
                    >
                      Send Email
                    </button>

                    <!-- Export button for deployed/emailing/converted -->
                    <button
                      v-if="['deployed', 'emailing', 'converted'].includes(lead.status) && lead.preview"
                      class="btn btn-sm btn-secondary"
                      @click="handleExport(lead)"
                      :disabled="lead._loading"
                      title="Download HTML for handover"
                    >
                      ⬇ Export
                    </button>

                    <!-- Convert button for deployed/emailing -->
                    <button
                      v-if="['deployed', 'emailing'].includes(lead.status)"
                      class="btn btn-sm btn-success"
                      @click="handleConvert(lead)"
                      :disabled="lead._loading"
                      title="Mark as converted (paid)"
                    >
                      💰 Convert
                    </button>

                    <button
                      class="btn btn-sm btn-danger"
                      @click="handleDelete(lead)"
                      :disabled="lead._loading"
                      :aria-label="`Delete ${lead.businessName || 'lead'}`"
                    >
                      &times;
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Industry Distribution -->
      <section v-if="stats.byIndustry && Object.keys(stats.byIndustry).length > 0" class="section">
        <div class="section-header">
          <h2>By Industry</h2>
        </div>
        <div class="industry-grid">
          <div v-for="(count, industry) in stats.byIndustry" :key="industry" class="industry-card">
            <div class="industry-name">{{ industry }}</div>
            <div class="industry-count">{{ count }}</div>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>Site Improver Dashboard &bull; {{ new Date().getFullYear() }}</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api, STATUS_INFO, timeAgo as timeAgoFn, validateUrl as validateUrlFn } from './api.js';

// State
const leads = ref([]);
const stats = ref({
  totalLeads: 0,
  totalDeployments: 0,
  byStatus: {},
  byIndustry: {},
  conversionRate: 0,
  activeDeployments: 0
});
const filter = ref('all');
const search = ref('');
const loading = ref(true);
const error = ref(null);
const toast = ref(null);
const mobileMenuOpen = ref(false);
const selectedLead = ref(null);

// Form state
const newLeadUrl = ref('');
const skipEmail = ref(false);
const submitting = ref(false);
const urlError = ref('');

// Discovery state
const discoverQuery = ref('');
const discoverLocation = ref('');
const discoverLimit = ref('10');
const discovering = ref(false);
const discoverResults = ref(null);

// Computed
const filteredLeads = computed(() => {
  let result = leads.value;

  if (filter.value !== 'all') {
    result = result.filter(l => l.status === filter.value);
  }

  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(l =>
      (l.businessName || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.industry || '').toLowerCase().includes(q)
    );
  }

  return result;
});

const pipelineStages = computed(() => {
  const stages = [
    { id: 'discovery', name: 'Discovery', color: 'blue', statuses: ['discovered', 'scoring', 'qualified'] },
    { id: 'processing', name: 'Processing', color: 'yellow', statuses: ['queued', 'scraping', 'scraped', 'building', 'deploying'] },
    { id: 'deployed', name: 'Deployed', color: 'green', statuses: ['deployed'] },
    { id: 'outreach', name: 'Outreach', color: 'green', statuses: ['emailing', 'follow_up_1', 'follow_up_2', 'last_chance'] },
    { id: 'final', name: 'Final', color: 'purple', statuses: ['converted', 'expired', 'deleted'] }
  ];

  return stages.map(stage => ({
    ...stage,
    leads: leads.value.filter(l => stage.statuses.includes(l.status)),
    count: leads.value.filter(l => stage.statuses.includes(l.status)).length
  }));
});

// Methods
function timeAgo(date) {
  return timeAgoFn(date);
}

function validateUrl(url) {
  return validateUrlFn(url);
}

function showToast(message, type = 'info') {
  toast.value = { message, type };
  setTimeout(() => {
    toast.value = null;
  }, 5000);
}

function getBadgeClass(status) {
  const info = STATUS_INFO[status] || STATUS_INFO.pending;
  const colorMap = {
    blue: 'badge-blue',
    yellow: 'badge-yellow',
    green: 'badge-green',
    purple: 'badge-purple',
    red: 'badge-red',
    orange: 'badge-yellow',
    gray: 'badge-gray'
  };
  return colorMap[info.color] || 'badge-gray';
}

function getStatusLabel(status) {
  const info = STATUS_INFO[status];
  return info ? info.label : status;
}

async function fetchData() {
  try {
    const params = new URLSearchParams();
    if (filter.value !== 'all') params.set('status', filter.value);
    if (search.value) params.set('search', search.value);

    const [leadsData, statsData] = await Promise.all([
      api.get(`/api/leads?${params}`),
      api.get('/api/stats')
    ]);

    leads.value = leadsData;
    stats.value = statsData;
    error.value = null;
  } catch (err) {
    error.value = err.message;
    // Try legacy endpoints if new ones fail
    try {
      const [deploymentsData, legacyStats] = await Promise.all([
        api.get('/api/deployments'),
        api.get('/api/stats')
      ]);
      leads.value = deploymentsData;
      stats.value = legacyStats;
      error.value = null;
    } catch (legacyErr) {
      console.error('Both API versions failed:', legacyErr);
    }
  } finally {
    loading.value = false;
  }
}

async function handleNewLead() {
  const err = validateUrl(newLeadUrl.value);
  if (err) {
    urlError.value = err;
    return;
  }

  submitting.value = true;
  urlError.value = '';

  try {
    console.log('[Pipeline] Starting pipeline for:', newLeadUrl.value);
    await api.post('/api/pipeline', {
      url: newLeadUrl.value,
      skipEmail: skipEmail.value
    });

    newLeadUrl.value = '';
    showToast('Pipeline started! Processing your lead...', 'success');

    // Poll for updates
    setTimeout(fetchData, 5000);
    setTimeout(fetchData, 15000);
    setTimeout(fetchData, 30000);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitting.value = false;
  }
}

async function handleDiscover() {
  if (!discoverQuery.value) {
    showToast('Please enter an industry or business type', 'error');
    return;
  }

  discovering.value = true;
  discoverResults.value = null;

  try {
    const result = await api.post('/api/discover', {
      query: discoverQuery.value,
      location: discoverLocation.value || 'Denver, CO',
      limit: parseInt(discoverLimit.value)
    });

    discoverResults.value = result;
    showToast(`Found ${result.found} leads, saved ${result.saved} to pipeline`, 'success');

    // Refresh the leads list
    fetchData();
  } catch (err) {
    showToast(`Discovery failed: ${err.message}`, 'error');
  } finally {
    discovering.value = false;
  }
}

async function handleStatusChange(lead, newStatus) {
  lead._loading = true;
  try {
    const endpoint = lead.id
      ? `/api/leads/${lead.id}`
      : `/api/deployments/${lead.siteId}`;
    await api.patch(endpoint, { status: newStatus });
    fetchData();
  } catch (err) {
    showToast(`Failed to update status: ${err.message}`, 'error');
  } finally {
    lead._loading = false;
  }
}

async function handleDelete(lead) {
  if (!confirm('Delete this lead and its deployment?')) return;

  lead._loading = true;
  try {
    const endpoint = lead.id
      ? `/api/leads/${lead.id}?deleteNetlify=true`
      : `/api/deployments/${lead.siteId}?deleteNetlify=true`;
    await api.delete(endpoint);
    fetchData();
    showToast('Lead deleted', 'success');
  } catch (err) {
    showToast(`Failed to delete: ${err.message}`, 'error');
  } finally {
    lead._loading = false;
  }
}

async function handleSendEmail(lead) {
  lead._loading = true;
  try {
    const endpoint = lead.id
      ? `/api/leads/${lead.id}/send-email`
      : `/api/deployments/${lead.siteId}/send-email`;
    await api.post(endpoint);
    fetchData();
    showToast('Email sent successfully', 'success');
  } catch (err) {
    showToast(`Failed to send email: ${err.message}`, 'error');
  } finally {
    lead._loading = false;
  }
}

async function handleExport(lead) {
  const siteId = lead.siteId || lead.id;
  if (!siteId) {
    showToast('No site ID found for export', 'error');
    return;
  }

  // Open export URL in new tab to trigger download
  const exportUrl = `/api/deployments/${siteId}/export`;
  window.open(exportUrl, '_blank');
  showToast('Downloading site HTML...', 'success');
}

async function handleConvert(lead) {
  const amount = prompt('Enter payment amount (optional):', '1000');
  if (amount === null) return; // User cancelled

  lead._loading = true;
  try {
    const siteId = lead.siteId || lead.id;
    await api.post(`/api/deployments/${siteId}/convert`, {
      amount: amount ? parseFloat(amount) : null,
      notes: `Converted on ${new Date().toLocaleDateString()}`
    });
    fetchData();
    showToast(`🎉 Converted! ${amount ? '$' + amount : ''}`, 'success');
  } catch (err) {
    showToast(`Failed to convert: ${err.message}`, 'error');
  } finally {
    lead._loading = false;
  }
}

// Lifecycle
let refreshInterval;

onMounted(() => {
  fetchData();
  // Refresh every 30 seconds
  refreshInterval = setInterval(fetchData, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style>
/* Additional pipeline-specific styles */
.pipeline-view {
  padding: 1.5rem;
  overflow-x: auto;
}

.pipeline-stages {
  display: flex;
  gap: 1rem;
  min-width: 800px;
}

.pipeline-stage {
  flex: 1;
  min-width: 180px;
  background: var(--color-bg);
  border-radius: var(--radius);
  padding: 1rem;
}

.stage-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.stage-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.stage-blue { background: var(--color-primary); }
.stage-yellow { background: var(--color-warning); }
.stage-green { background: var(--color-success); }
.stage-purple { background: var(--color-purple); }
.stage-red { background: var(--color-danger); }

.stage-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.stage-count {
  margin-left: auto;
  background: var(--color-surface);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.stage-leads {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.pipeline-lead {
  background: var(--color-surface);
  padding: 0.75rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: box-shadow 0.15s;
  border: 1px solid var(--color-border);
}

.pipeline-lead:hover {
  box-shadow: var(--shadow-md);
}

.lead-name {
  font-weight: 500;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.lead-meta {
  font-size: 0.75rem;
  color: var(--color-text-light);
}

.stage-empty {
  font-size: 0.75rem;
  color: var(--color-text-light);
  text-align: center;
  padding: 1rem;
}

/* Badge purple for converted */
.badge-purple {
  background: #ede9fe;
  color: #6d28d9;
}

/* Secondary button style (for export) */
.btn-secondary {
  background: #e2e8f0;
  color: #334155;
  border: none;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

/* Success button style (for convert) */
.btn-success {
  background: #059669;
  color: white;
  border: none;
}

.btn-success:hover {
  background: #047857;
}

/* Demo Section Styles */
.demo-section {
  background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
  color: white;
  border-radius: var(--radius);
  padding: 2rem;
}

.demo-section .section-header {
  border-bottom: none;
  margin-bottom: 0.5rem;
}

.demo-section h2 {
  color: white;
}

.section-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.section-description {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.demo-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.demo-input-group {
  display: flex;
  gap: 0.75rem;
}

.demo-input {
  flex: 1;
  padding: 1rem 1.25rem;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.demo-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.demo-input:focus {
  outline: none;
  border-color: white;
  background: rgba(255, 255, 255, 0.15);
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1rem;
}

.demo-options {
  display: flex;
  gap: 1rem;
}

.demo-options .checkbox-label {
  color: rgba(255, 255, 255, 0.8);
}

/* Find Leads Section */
.discover-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.discover-inputs {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr;
  gap: 1rem;
}

.discover-inputs .form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.discover-inputs label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text);
}

.discover-input,
.discover-select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 0.95rem;
  background: var(--color-surface);
}

.discover-input:focus,
.discover-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.discover-results {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--color-bg);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
}

.discover-summary {
  font-size: 0.95rem;
  color: var(--color-text);
}

@media (max-width: 768px) {
  .pipeline-stages {
    flex-direction: column;
    min-width: auto;
  }

  .pipeline-stage {
    min-width: auto;
  }

  .stage-leads {
    max-height: 150px;
  }

  .demo-input-group {
    flex-direction: column;
  }

  .discover-inputs {
    grid-template-columns: 1fr;
  }
}
</style>
