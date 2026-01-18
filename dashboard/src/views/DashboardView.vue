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
        <a href="#emails" @click="mobileMenuOpen = false">Emails</a>
        <a href="#leads" @click="mobileMenuOpen = false">All Leads</a>
        <router-link to="/billing" @click="mobileMenuOpen = false">Billing</router-link>
        <router-link to="/team" @click="mobileMenuOpen = false">Team</router-link>
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
          <h2>Process Website</h2>
          <span class="section-badge">Quick Start</span>
        </div>
        <p class="section-description">
          Enter a website URL to analyze and rebuild. Preview deploys in approximately 30 seconds.
        </p>

        <!-- Pipeline Progress Bar -->
        <div v-if="pipelineProgress.active" class="pipeline-progress">
          <div class="progress-header">
            <span class="progress-url">{{ pipelineProgress.url }}</span>
            <span class="progress-time">{{ pipelineProgress.elapsed }}s</span>
          </div>
          <div class="progress-stages">
            <div
              v-for="(stage, index) in pipelineStagesConfig"
              :key="stage.id"
              :class="['progress-stage', {
                'completed': pipelineProgress.stageIndex > index,
                'active': pipelineProgress.stageIndex === index,
                'pending': pipelineProgress.stageIndex < index
              }]"
            >
              <div class="stage-icon">
                <span v-if="pipelineProgress.stageIndex > index" class="check-icon">&#10003;</span>
                <span v-else-if="pipelineProgress.stageIndex === index" class="spinner-icon"></span>
                <span v-else class="stage-number">{{ index + 1 }}</span>
              </div>
              <div class="stage-label">{{ stage.label }}</div>
            </div>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: pipelineProgress.percent + '%' }"></div>
          </div>
          <div v-if="pipelineProgress.error" class="progress-error">
            {{ pipelineProgress.error }}
          </div>
          <div v-if="pipelineProgress.previewUrl" class="progress-complete">
            <router-link :to="pipelineProgress.previewUrl" class="btn btn-primary">
              View Preview
            </router-link>
          </div>
        </div>

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
              <span>{{ submitting ? 'Building...' : 'Transform Site' }}</span>
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
          <h2>Find Leads</h2>
        </div>
        <p class="section-description">
          Search for businesses by industry and location to discover potential clients.
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
            <span>{{ discovering ? 'Searching...' : 'Find Leads' }}</span>
          </button>
        </form>
        <div v-if="discoverResults" class="discover-results">
          <div class="discover-summary">
            Found <strong>{{ discoverResults.found }}</strong> leads,
            saved <strong>{{ discoverResults.saved }}</strong> to pipeline
          </div>
        </div>
      </section>

      <!-- Email Queue Section -->
      <section id="emails" class="section">
        <div class="section-header">
          <h2>Email Management</h2>
          <div class="email-tabs">
            <button
              :class="['tab-btn', { active: emailTab === 'queue' }]"
              @click="emailTab = 'queue'"
            >
              Queue ({{ emailQueue.length }})
            </button>
            <button
              :class="['tab-btn', { active: emailTab === 'history' }]"
              @click="emailTab = 'history'"
            >
              History
            </button>
            <button
              :class="['tab-btn', { active: emailTab === 'settings' }]"
              @click="emailTab = 'settings'"
            >
              Settings
            </button>
          </div>
        </div>

        <!-- Email Queue Tab -->
        <div v-if="emailTab === 'queue'" class="email-queue">
          <div v-if="emailQueue.length === 0" class="empty-state">
            <p>No emails pending approval</p>
            <p class="muted">Emails will appear here when leads are processed</p>
          </div>
          <div v-else class="table-container">
            <table class="deployments-table">
              <thead>
                <tr>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="email in emailQueue" :key="email.id">
                  <td>
                    <div class="business-name">{{ email.businessName || 'Unknown' }}</div>
                    <div class="business-meta">{{ email.to }}</div>
                  </td>
                  <td class="email-subject">{{ email.subject }}</td>
                  <td>
                    <span class="badge badge-gray">{{ email.type }}</span>
                  </td>
                  <td>
                    <span :class="['badge', getEmailStatusBadge(email.status)]">
                      {{ email.status }}
                    </span>
                  </td>
                  <td>{{ timeAgo(email.createdAt) }}</td>
                  <td class="actions-cell">
                    <button
                      class="btn btn-sm btn-ghost"
                      @click="previewEmail(email)"
                      title="Preview email"
                    >
                      Preview
                    </button>
                    <button
                      v-if="email.status === 'draft'"
                      class="btn btn-sm btn-primary"
                      @click="approveAndSendEmail(email.id)"
                      :disabled="email._loading"
                    >
                      {{ email._loading ? 'Sending...' : 'Approve & Send' }}
                    </button>
                    <button
                      v-if="email.status === 'draft'"
                      class="btn btn-sm btn-danger"
                      @click="rejectEmail(email.id)"
                      :disabled="email._loading"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Email History Tab -->
        <div v-if="emailTab === 'history'" class="email-history">
          <div v-if="emailHistory.length === 0" class="empty-state">
            <p>No emails sent yet</p>
          </div>
          <div v-else class="table-container">
            <table class="deployments-table">
              <thead>
                <tr>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="email in emailHistory" :key="email.id">
                  <td>
                    <div class="business-name">{{ email.businessName || 'Unknown' }}</div>
                    <div class="business-meta">{{ email.to }}</div>
                  </td>
                  <td class="email-subject">{{ email.subject }}</td>
                  <td>
                    <span class="badge badge-gray">{{ email.type }}</span>
                  </td>
                  <td>
                    <span :class="['badge', email.status === 'sent' ? 'badge-green' : 'badge-red']">
                      {{ email.status }}
                    </span>
                  </td>
                  <td>{{ timeAgo(email.sentAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Email Settings Tab -->
        <div v-if="emailTab === 'settings'" class="email-settings">
          <div class="settings-card">
            <h3>Email Configuration</h3>
            <div class="settings-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="emailConfig.autoSendEnabled"
                  @change="saveEmailSettings"
                />
                <span class="toggle-text">
                  <strong>Auto-send emails</strong>
                  <span class="muted">When enabled, emails send automatically without approval</span>
                </span>
              </label>
            </div>
            <div class="settings-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="emailConfig.requireApproval"
                  @change="saveEmailSettings"
                />
                <span class="toggle-text">
                  <strong>Require approval</strong>
                  <span class="muted">Queue emails for manual approval before sending</span>
                </span>
              </label>
            </div>
            <div class="settings-info">
              <p><strong>From email:</strong> {{ fromEmail || 'Not configured' }}</p>
              <p><strong>Provider:</strong> Resend {{ resendConfigured ? '(Connected)' : '(Not configured)' }}</p>
            </div>
          </div>
        </div>

        <!-- Email Preview Modal with Device Toggle -->
        <Teleport to="body">
          <div v-if="emailPreview" class="modal-overlay" @click.self="emailPreview = null">
            <div class="modal email-preview-modal" :class="{ 'modal-wide': previewDevice === 'desktop' }">
              <div class="modal-header">
                <h3>Email Preview</h3>
                <div class="device-toggle">
                  <button
                    :class="['device-btn', { active: previewDevice === 'desktop' }]"
                    @click="previewDevice = 'desktop'"
                    title="Desktop view"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </button>
                  <button
                    :class="['device-btn', { active: previewDevice === 'mobile' }]"
                    @click="previewDevice = 'mobile'"
                    title="Mobile view"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <button @click="emailPreview = null" class="modal-close">&times;</button>
              </div>
              <div class="modal-body">
                <div class="email-header-fields">
                  <div class="preview-field">
                    <label>To:</label>
                    <span>{{ emailPreview.to }}</span>
                  </div>
                  <div class="preview-field">
                    <label>Subject:</label>
                    <span>{{ emailPreview.subject }}</span>
                  </div>
                </div>
                <div class="device-frame-container">
                  <div :class="['device-frame', `device-${previewDevice}`]">
                    <div class="device-screen">
                      <div class="email-client-header">
                        <div class="email-client-from">
                          <span class="sender-avatar">SI</span>
                          <div class="sender-info">
                            <span class="sender-name">Site Improver</span>
                            <span class="sender-email">{{ fromEmail || 'noreply@siteimprover.com' }}</span>
                          </div>
                        </div>
                        <div class="email-client-date">{{ formatDate(emailPreview.createdAt) }}</div>
                      </div>
                      <div class="email-client-subject">{{ emailPreview.subject }}</div>
                      <div class="email-client-body" v-html="emailPreview.htmlBody"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer" v-if="emailPreview.status === 'draft'">
                <button class="btn btn-ghost" @click="emailPreview = null">Close</button>
                <button class="btn btn-danger" @click="rejectEmail(emailPreview.id); emailPreview = null">
                  Reject
                </button>
                <button class="btn btn-primary" @click="approveAndSendEmail(emailPreview.id); emailPreview = null">
                  Approve & Send
                </button>
              </div>
            </div>
          </div>
        </Teleport>
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
                  <router-link
                    v-if="lead.preview && lead.preview.startsWith('/preview/')"
                    :to="lead.preview"
                    class="preview-link"
                  >
                    View Preview &#8599;
                  </router-link>
                  <a
                    v-else-if="lead.preview"
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

                    <!-- Process button for discovered/qualified leads -->
                    <button
                      v-if="['discovered', 'qualified'].includes(lead.status) && lead.url"
                      class="btn btn-sm btn-primary"
                      @click="handleProcessLead(lead)"
                      :disabled="lead._loading || processingLeads.has(lead.id)"
                    >
                      {{ processingLeads.has(lead.id) ? 'Processing...' : 'Process' }}
                    </button>

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
                      Export
                    </button>

                    <!-- Convert button for deployed/emailing -->
                    <button
                      v-if="['deployed', 'emailing'].includes(lead.status)"
                      class="btn btn-sm btn-success"
                      @click="handleConvert(lead)"
                      :disabled="lead._loading"
                      title="Mark as converted (paid)"
                    >
                      Convert
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
import { api, STATUS_INFO, timeAgo as timeAgoFn, validateUrl as validateUrlFn } from '../api.js';

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
const processingLeads = ref(new Set());

// Email state
const emailTab = ref('queue');
const emailQueue = ref([]);
const emailHistory = ref([]);
const emailConfig = ref({ autoSendEnabled: false, requireApproval: true });
const emailPreview = ref(null);
const previewDevice = ref('desktop');
const fromEmail = ref('');
const resendConfigured = ref(false);

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

// Pipeline progress state
const pipelineProgress = ref({
  active: false,
  url: '',
  stageIndex: 0,
  percent: 0,
  elapsed: 0,
  error: null,
  previewUrl: null,
  siteId: null
});

// Pipeline stages configuration
const pipelineStagesConfig = [
  { id: 'scraping', label: 'Scraping' },
  { id: 'building', label: 'Building' },
  { id: 'saving', label: 'Saving' },
  { id: 'complete', label: 'Complete' }
];

let progressInterval = null;
let progressPollInterval = null;

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

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

    // Also fetch email data
    await fetchEmailData();
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
      await fetchEmailData();
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

  // Start progress tracking
  startProgress(newLeadUrl.value);

  try {
    console.log('[Pipeline] Starting pipeline for:', newLeadUrl.value);
    const response = await api.post('/api/pipeline', {
      url: newLeadUrl.value,
      skipEmail: skipEmail.value
    });

    console.log('[Pipeline] Response:', response);

    // Check if pipeline completed synchronously (has preview URL)
    if (response && response.success && response.preview) {
      // Pipeline completed! Show success
      pipelineProgress.value.stageIndex = 3; // Complete
      pipelineProgress.value.percent = 100;
      pipelineProgress.value.previewUrl = response.preview;
      showToast(`Preview ready: ${response.businessName || 'Site'}`, 'success');
      stopProgress();
      newLeadUrl.value = '';
      // Refresh data to show new preview
      await fetchData();
      return;
    }

    // Store job ID for SSE subscription (async job flow)
    if (response && response.jobId) {
      pipelineProgress.value.jobId = response.jobId;
      // Subscribe to real-time status updates via SSE
      subscribeToSSE(response.jobId);
    } else {
      // Fallback to polling if no jobId (backwards compatibility)
      startProgressPolling();
    }

    // Store site ID if available
    if (response && response.siteId) {
      pipelineProgress.value.siteId = response.siteId;
    }

    newLeadUrl.value = '';
    showToast('Pipeline started! Processing your lead...', 'success');

  } catch (err) {
    console.error('[Pipeline] Error:', err);
    pipelineProgress.value.error = err.message;
    showToast(err.message, 'error');
    stopProgress();
  } finally {
    submitting.value = false;
  }
}

function startProgress(url) {
  // Reset progress state
  pipelineProgress.value = {
    active: true,
    url: url,
    stageIndex: 0,
    percent: 5,
    elapsed: 0,
    error: null,
    previewUrl: null,
    siteId: null,
    jobId: null,
    eventSource: null,
    stage: 'queued',
    label: 'Starting pipeline...'
  };

  // Start elapsed time counter
  const startTime = Date.now();
  progressInterval = setInterval(() => {
    pipelineProgress.value.elapsed = Math.floor((Date.now() - startTime) / 1000);
  }, 1000);
}

function startProgressPolling() {
  // Poll for status updates every 2 seconds
  progressPollInterval = setInterval(async () => {
    try {
      await fetchData();

      // Check for newly deployed lead matching our URL
      const matchingLead = leads.value.find(l =>
        l.originalUrl === pipelineProgress.value.url ||
        l.siteId === pipelineProgress.value.siteId
      );

      if (matchingLead) {
        updateProgressFromStatus(matchingLead.status, matchingLead);
      }
    } catch (e) {
      console.error('Progress poll error:', e);
    }
  }, 2000);

  // Auto-advance stages for visual feedback while waiting
  setTimeout(() => {
    if (pipelineProgress.value.active && pipelineProgress.value.stageIndex === 0) {
      pipelineProgress.value.stageIndex = 1;
      pipelineProgress.value.percent = 35;
    }
  }, 5000);

  setTimeout(() => {
    if (pipelineProgress.value.active && pipelineProgress.value.stageIndex === 1) {
      pipelineProgress.value.stageIndex = 2;
      pipelineProgress.value.percent = 65;
    }
  }, 15000);
}

function updateProgressFromStatus(status, lead) {
  const statusToStage = {
    'discovered': 0, 'scoring': 0, 'qualified': 0,
    'queued': 0, 'scraping': 0, 'scraped': 1,
    'building': 1, 'deploying': 2,
    'deployed': 3, 'emailing': 3, 'converted': 3
  };

  const stageIndex = statusToStage[status] ?? pipelineProgress.value.stageIndex;
  const percent = Math.min(95, (stageIndex + 1) * 25);

  pipelineProgress.value.stageIndex = stageIndex;
  pipelineProgress.value.percent = percent;

  // Check if complete
  if (status === 'deployed' || status === 'emailing') {
    pipelineProgress.value.stageIndex = 3;
    pipelineProgress.value.percent = 100;
    pipelineProgress.value.previewUrl = lead.preview || lead.previewUrl;
    stopProgress();
    showToast('Site deployed successfully!', 'success');
  }

  // Check for error
  if (status === 'error' || lead.lastError) {
    pipelineProgress.value.error = lead.lastError || 'Pipeline failed';
    stopProgress();
  }
}

function stopProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (progressPollInterval) {
    clearInterval(progressPollInterval);
    progressPollInterval = null;
  }
  // Close SSE connection if active
  if (pipelineProgress.value.eventSource) {
    pipelineProgress.value.eventSource.close();
    pipelineProgress.value.eventSource = null;
  }
}

// Subscribe to real-time pipeline status via Server-Sent Events
function subscribeToSSE(jobId) {
  console.log('[SSE] Subscribing to pipeline status:', jobId);

  const eventSource = new EventSource(`/api/pipeline/${jobId}/status`);
  pipelineProgress.value.eventSource = eventSource;

  eventSource.onmessage = (event) => {
    try {
      const status = JSON.parse(event.data);
      console.log('[SSE] Status update:', status);

      // Update progress based on SSE status
      pipelineProgress.value.stage = status.stage;
      pipelineProgress.value.label = status.label;
      pipelineProgress.value.percent = status.progress;

      // Map stage to stageIndex for UI
      const stageMap = {
        'queued': 0, 'scraping': 0, 'scrape_fallback': 0,
        'analyzing': 1, 'generating': 1,
        'building': 2, 'deploying': 2,
        'complete': 3, 'error': -1
      };
      pipelineProgress.value.stageIndex = stageMap[status.stage] ?? 0;

      // Handle completion
      if (status.stage === 'complete') {
        pipelineProgress.value.percent = 100;
        pipelineProgress.value.stageIndex = 3;
        if (status.preview) {
          pipelineProgress.value.previewUrl = status.preview;
        }
        showToast(`Site deployed! ${status.businessName || 'Preview ready'}`, 'success');
        stopProgress();
        fetchData(); // Refresh leads list
      }

      // Handle error
      if (status.stage === 'error') {
        pipelineProgress.value.error = status.error?.message || 'Pipeline failed';
        showToast(pipelineProgress.value.error, 'error');
        stopProgress();
      }
    } catch (e) {
      console.error('[SSE] Failed to parse status:', e);
    }
  };

  eventSource.onerror = (err) => {
    console.error('[SSE] Connection error:', err);
    // Don't immediately show error - SSE may reconnect
    // Fall back to polling after SSE fails
    eventSource.close();
    pipelineProgress.value.eventSource = null;
    startProgressPolling();
  };
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
    showToast(`Converted! ${amount ? '$' + amount : ''}`, 'success');
  } catch (err) {
    showToast(`Failed to convert: ${err.message}`, 'error');
  } finally {
    lead._loading = false;
  }
}

async function handleProcessLead(lead) {
  if (!lead.url) {
    showToast('Lead has no URL to process', 'error');
    return;
  }

  processingLeads.value.add(lead.id);
  try {
    await api.post('/api/pipeline', { url: lead.url });
    showToast(`Processing started for ${lead.businessName || 'lead'}`, 'success');
    // Refresh after a moment to show status change
    setTimeout(fetchData, 2000);
  } catch (err) {
    showToast(`Failed to process: ${err.message}`, 'error');
  } finally {
    processingLeads.value.delete(lead.id);
  }
}

// Email management functions
async function fetchEmailData() {
  try {
    const [queueData, historyData, configData] = await Promise.all([
      api.get('/api/emails/queue'),
      api.get('/api/emails/history?limit=50'),
      api.get('/api/config/email')
    ]);
    emailQueue.value = queueData;
    emailHistory.value = historyData;
    emailConfig.value = configData;
  } catch (err) {
    console.error('Failed to fetch email data:', err);
  }
}

function getEmailStatusBadge(status) {
  const badges = {
    draft: 'badge-yellow',
    approved: 'badge-blue',
    sending: 'badge-blue',
    sent: 'badge-green',
    rejected: 'badge-red',
    failed: 'badge-red'
  };
  return badges[status] || 'badge-gray';
}

function previewEmail(email) {
  emailPreview.value = email;
}

async function approveAndSendEmail(emailId) {
  const email = emailQueue.value.find(e => e.id === emailId);
  if (email) email._loading = true;

  try {
    await api.post(`/api/emails/${emailId}/approve`, { sendNow: true });
    showToast('Email approved and sent', 'success');
    await fetchEmailData();
  } catch (err) {
    showToast(`Failed to send email: ${err.message}`, 'error');
  } finally {
    if (email) email._loading = false;
  }
}

async function rejectEmail(emailId) {
  const email = emailQueue.value.find(e => e.id === emailId);
  if (email) email._loading = true;

  try {
    await api.post(`/api/emails/${emailId}/reject`);
    showToast('Email rejected', 'success');
    await fetchEmailData();
  } catch (err) {
    showToast(`Failed to reject email: ${err.message}`, 'error');
  } finally {
    if (email) email._loading = false;
  }
}

async function saveEmailSettings() {
  try {
    await api.patch('/api/config/email', {
      autoSendEnabled: emailConfig.value.autoSendEnabled,
      requireApproval: emailConfig.value.requireApproval
    });
    showToast('Email settings saved', 'success');
  } catch (err) {
    showToast(`Failed to save settings: ${err.message}`, 'error');
  }
}

// Lifecycle
let refreshInterval;
const REFRESH_INTERVAL = 60000; // 60 seconds - less aggressive to avoid flicker

onMounted(() => {
  fetchData();
  // Refresh only when page is visible to avoid jarring updates
  refreshInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchData();
    }
  }, REFRESH_INTERVAL);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>
