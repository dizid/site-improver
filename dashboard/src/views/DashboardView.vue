<template>
  <div class="app">
    <!-- Toast Notification -->
    <AppToast />

    <!-- Onboarding Modal -->
    <OnboardingModal />

    <header class="header">
      <div class="header-content">
        <h1>Site Improver</h1>
        <span class="header-subtitle">Lead Pipeline</span>
        <button
          class="mobile-menu-btn"
          @click="ui.mobileMenuOpen = !ui.mobileMenuOpen"
          :aria-label="ui.mobileMenuOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="ui.mobileMenuOpen"
        >
          <span class="hamburger-icon"></span>
        </button>
      </div>
      <nav :class="['mobile-nav', { open: ui.mobileMenuOpen }]" aria-label="Main navigation">
        <a href="#demo" @click="ui.mobileMenuOpen = false">Demo</a>
        <a href="#find-leads" @click="ui.mobileMenuOpen = false">Find Leads</a>
        <a href="#pipeline" @click="ui.mobileMenuOpen = false">Pipeline</a>
        <a href="#emails" @click="ui.mobileMenuOpen = false">Emails</a>
        <a href="#leads" @click="ui.mobileMenuOpen = false">All Leads</a>
        <router-link to="/billing" @click="ui.mobileMenuOpen = false">Billing</router-link>
        <router-link to="/team" @click="ui.mobileMenuOpen = false">Team</router-link>
      </nav>
    </header>

    <main class="main">
      <div v-if="leadsStore.error" class="error-banner">
        Error loading data: {{ leadsStore.error }}
        <button @click="fetchAllData">Retry</button>
      </div>

      <!-- Stats Section -->
      <StatsGrid :stats="leadsStore.stats" :loading="leadsStore.loading" />

      <!-- Pipeline View Section -->
      <section id="pipeline" class="section">
        <div class="section-header">
          <h2>Pipeline Status</h2>
          <button @click="fetchAllData" class="btn btn-ghost" aria-label="Refresh pipeline">
            &#8635; Refresh
          </button>
        </div>
        <div class="pipeline-view">
          <div class="pipeline-stages">
            <div class="pipeline-stage" v-for="stage in leadsStore.pipelineStages" :key="stage.id">
              <div class="stage-header">
                <span :class="['stage-dot', `stage-${stage.color}`]"></span>
                <span class="stage-name">{{ stage.name }}</span>
                <span class="stage-count">{{ stage.count }}</span>
              </div>
              <div class="stage-leads">
                <LeadCard
                  v-for="lead in stage.leads"
                  :key="lead.id"
                  :lead="lead"
                  :selected="ui.selectedLeadIds.has(lead.id || lead.siteId)"
                  @viewDetails="ui.selectedLead = lead"
                  @process="handleProcessLead"
                  @delete="handleDelete"
                  @toggleSelect="ui.toggleLeadSelection"
                />
                <div v-if="stage.leads.length === 0" class="stage-empty">
                  <p class="muted">Your pipeline is empty</p>
                  <p class="muted" style="font-size: 0.875rem; margin-top: 0.25rem;">Add leads to get started</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Demo / Process URL Section -->
      <section id="demo" class="section demo-section">
        <div class="section-header">
          <h2>Process Website</h2>
          <span class="section-badge">Quick Start</span>
        </div>
        <p class="section-description">
          Enter a website URL to analyze and rebuild. Preview deploys in approximately 30 seconds.
        </p>

        <!-- Pipeline Progress Bar -->
        <PipelineProgress
          :job="pipelineStore.activeJob"
          :stagesConfig="pipelineStore.stagesConfig"
        />

        <form @submit.prevent="handleNewLead" class="demo-form" novalidate>
          <div class="demo-input-group">
            <input
              id="demo-url"
              type="url"
              v-model="pipelineStore.newLeadUrl"
              @blur="pipelineStore.newLeadUrl && (pipelineStore.urlError = validateUrl(pipelineStore.newLeadUrl))"
              placeholder="https://example-business.com"
              :aria-describedby="pipelineStore.urlError ? 'url-error' : undefined"
              :aria-invalid="!!pipelineStore.urlError"
              :class="{ 'input-error': pipelineStore.urlError }"
              :disabled="pipelineStore.submitting"
              class="demo-input"
            />
            <button
              type="submit"
              class="btn btn-primary btn-large"
              :disabled="pipelineStore.submitting"
              :aria-busy="pipelineStore.submitting"
            >
              <span v-if="pipelineStore.submitting" class="spinner spinner-sm">
                <span class="spinner-circle"></span>
              </span>
              <span>{{ pipelineStore.submitting ? 'Building...' : 'Transform Site' }}</span>
            </button>
          </div>
          <span v-if="pipelineStore.urlError" id="url-error" class="field-error" role="alert">
            {{ pipelineStore.urlError }}
          </span>
          <div class="demo-options">
            <label class="checkbox-label">
              <input type="checkbox" v-model="pipelineStore.skipEmail" />
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
                v-model="leadsStore.discoverQuery"
                placeholder="e.g., plumbers, dentists, restaurants"
                :disabled="leadsStore.discovering"
                class="discover-input"
              />
            </div>
            <div class="form-field">
              <label for="discover-location">Location</label>
              <input
                id="discover-location"
                type="text"
                v-model="leadsStore.discoverLocation"
                placeholder="e.g., Denver, CO or Amsterdam, NL"
                :disabled="leadsStore.discovering"
                class="discover-input"
              />
            </div>
            <div class="form-field">
              <label for="discover-limit">Limit</label>
              <select id="discover-limit" v-model="leadsStore.discoverLimit" :disabled="leadsStore.discovering" class="discover-select">
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
            :disabled="leadsStore.discovering || !leadsStore.discoverQuery"
          >
            <span v-if="leadsStore.discovering" class="spinner spinner-sm">
              <span class="spinner-circle"></span>
            </span>
            <span>{{ leadsStore.discovering ? 'Searching...' : 'Find Leads' }}</span>
          </button>
        </form>
        <div v-if="leadsStore.discoverResults" class="discover-results">
          <div class="discover-summary">
            Found <strong>{{ leadsStore.discoverResults.found }}</strong> leads,
            saved <strong>{{ leadsStore.discoverResults.saved }}</strong> to pipeline
          </div>
        </div>
      </section>

      <!-- Email Queue Section -->
      <section id="emails" class="section">
        <div v-if="emailsStore.error" class="error-banner">
          Error loading emails: {{ emailsStore.error }}
          <button @click="emailsStore.fetchAll()">Retry</button>
        </div>

        <div class="section-header">
          <h2>Email Management</h2>
          <div class="email-tabs">
            <button
              :class="['tab-btn', { active: ui.emailTab === 'queue' }]"
              @click="ui.emailTab = 'queue'"
            >
              Queue ({{ emailsStore.queue.length }})
            </button>
            <button
              :class="['tab-btn', { active: ui.emailTab === 'history' }]"
              @click="ui.emailTab = 'history'"
            >
              History
            </button>
            <button
              :class="['tab-btn', { active: ui.emailTab === 'settings' }]"
              @click="ui.emailTab = 'settings'"
            >
              Settings
            </button>
          </div>
        </div>

        <!-- Email Queue Tab -->
        <div v-if="ui.emailTab === 'queue'" class="email-queue">
          <div v-if="emailsStore.queue.length === 0" class="empty-state">
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
                <tr v-for="email in emailsStore.queue" :key="email.id">
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
                      @click="ui.emailPreview = email"
                      title="Preview email"
                    >
                      Preview
                    </button>
                    <button
                      v-if="email.status === 'draft'"
                      class="btn btn-sm btn-primary"
                      @click="handleApproveEmail(email.id)"
                      :disabled="email._loading"
                    >
                      {{ email._loading ? 'Sending...' : 'Approve & Send' }}
                    </button>
                    <button
                      v-if="email.status === 'draft'"
                      class="btn btn-sm btn-danger"
                      @click="handleRejectEmail(email.id)"
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
        <div v-if="ui.emailTab === 'history'" class="email-history">
          <div v-if="emailsStore.history.length === 0" class="empty-state">
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
                <tr v-for="email in emailsStore.history" :key="email.id">
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
        <div v-if="ui.emailTab === 'settings'" class="email-settings">
          <div class="settings-card">
            <h3>Email Configuration</h3>
            <div class="settings-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="emailsStore.config.autoSendEnabled"
                  @change="handleSaveEmailSettings"
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
                  v-model="emailsStore.config.requireApproval"
                  @change="handleSaveEmailSettings"
                />
                <span class="toggle-text">
                  <strong>Require approval</strong>
                  <span class="muted">Queue emails for manual approval before sending</span>
                </span>
              </label>
            </div>
            <div class="settings-info">
              <p><strong>From email:</strong> {{ emailsStore.fromEmail || 'Not configured' }}</p>
              <p><strong>Provider:</strong> Resend {{ emailsStore.resendConfigured ? '(Connected)' : '(Not configured)' }}</p>
            </div>
          </div>
        </div>

        <!-- Email Preview Modal -->
        <EmailPreview
          :email="ui.emailPreview"
          :fromEmail="emailsStore.fromEmail"
          @close="ui.emailPreview = null"
          @approve="(id) => { handleApproveEmail(id); ui.emailPreview = null; }"
          @reject="(id) => { handleRejectEmail(id); ui.emailPreview = null; }"
        />
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
              v-model="leadsStore.search"
              class="search-input"
              aria-label="Search leads by name, email, or industry"
            />
            <label for="filter-status" class="sr-only">Filter by status</label>
            <select
              id="filter-status"
              v-model="leadsStore.filter"
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
            <button @click="fetchAllData" class="btn btn-ghost" aria-label="Refresh leads list">
              &#8635; Refresh
            </button>
          </div>
        </div>

        <div v-if="leadsStore.loading" aria-live="polite">
          <SkeletonLoader type="list" :count="5" />
        </div>

        <div v-else-if="leadsStore.filteredLeads.length === 0" class="empty-state empty-state-enhanced">
          <svg class="empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
            <polyline points="3 9 12 13 21 9"></polyline>
          </svg>
          <h3 class="empty-heading">No leads yet</h3>
          <p class="empty-description">Enter a URL above to transform your first site!</p>
          <button @click="scrollToDemo" class="btn btn-primary" style="margin-top: 1rem;">
            Get Started
          </button>
        </div>

        <template v-else>
          <!-- Mobile card layout -->
          <div class="leads-cards">
            <div
              v-for="lead in leadsStore.filteredLeads"
              :key="lead.id || lead.siteId"
              class="lead-mobile-card"
              :class="{ loading: lead._loading, selected: ui.selectedLeadIds.has(lead.id || lead.siteId) }"
            >
              <div class="mobile-card-header">
                <input
                  type="checkbox"
                  :checked="ui.selectedLeadIds.has(lead.id || lead.siteId)"
                  @change="ui.toggleLeadSelection(lead.id || lead.siteId)"
                  :aria-label="`Select ${lead.businessName || 'lead'}`"
                  class="mobile-checkbox"
                />
                <div class="mobile-business-info">
                  <div class="business-name">{{ lead.businessName || 'Unknown' }}</div>
                  <div class="business-meta">{{ lead.industry || 'N/A' }}</div>
                </div>
                <span :class="['badge', getBadgeClass(lead.status)]">
                  {{ getStatusLabel(lead.status) }}
                </span>
              </div>
              <div class="mobile-card-body">
                <div v-if="lead.email || lead.phone" class="contact-info">
                  <div v-if="lead.email" class="email">{{ lead.email }}</div>
                  <div v-if="lead.phone" class="phone">{{ lead.phone }}</div>
                </div>
                <div class="mobile-actions">
                  <button
                    v-if="['discovered', 'qualified'].includes(lead.status) && lead.url"
                    class="btn btn-sm btn-primary"
                    @click="handleProcessLead(lead)"
                    :disabled="lead._loading || leadsStore.processingLeads.has(lead.id)"
                  >
                    {{ leadsStore.processingLeads.has(lead.id) ? 'Processing...' : 'Process' }}
                  </button>
                  <button
                    v-if="lead.email && lead.status === 'deployed'"
                    class="btn btn-sm btn-primary"
                    @click="handleSendEmail(lead)"
                    :disabled="lead._loading"
                  >
                    Send Email
                  </button>
                  <button
                    v-if="['deployed', 'emailing', 'converted'].includes(lead.status) && lead.preview"
                    class="btn btn-sm btn-secondary"
                    @click="handleExport(lead)"
                    :disabled="lead._loading"
                    title="Download HTML"
                  >
                    Export
                  </button>
                  <button
                    v-if="['deployed', 'emailing'].includes(lead.status)"
                    class="btn btn-sm btn-success"
                    @click="handleConvert(lead)"
                    :disabled="lead._loading"
                    title="Mark as converted"
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
              </div>
            </div>
          </div>

          <!-- Desktop table layout -->
          <div class="table-container">
          <table class="deployments-table">
            <thead>
              <tr>
                <th class="checkbox-col">
                  <input
                    type="checkbox"
                    @change="toggleSelectAll"
                    :checked="allSelected"
                    aria-label="Select all leads"
                  />
                </th>
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
                v-for="lead in leadsStore.filteredLeads"
                :key="lead.id || lead.siteId"
                :class="{ loading: lead._loading, selected: ui.selectedLeadIds.has(lead.id || lead.siteId) }"
              >
                <td class="checkbox-col">
                  <input
                    type="checkbox"
                    :checked="ui.selectedLeadIds.has(lead.id || lead.siteId)"
                    @change="ui.toggleLeadSelection(lead.id || lead.siteId)"
                    :aria-label="`Select ${lead.businessName || 'lead'}`"
                  />
                </td>
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

                    <button
                      v-if="['discovered', 'qualified'].includes(lead.status) && lead.url"
                      class="btn btn-sm btn-primary"
                      @click="handleProcessLead(lead)"
                      :disabled="lead._loading || leadsStore.processingLeads.has(lead.id)"
                    >
                      {{ leadsStore.processingLeads.has(lead.id) ? 'Processing...' : 'Process' }}
                    </button>

                    <button
                      v-if="lead.email && lead.status === 'deployed'"
                      class="btn btn-sm btn-primary"
                      @click="handleSendEmail(lead)"
                      :disabled="lead._loading"
                    >
                      Send Email
                    </button>

                    <button
                      v-if="['deployed', 'emailing', 'converted'].includes(lead.status) && lead.preview"
                      class="btn btn-sm btn-secondary"
                      @click="handleExport(lead)"
                      :disabled="lead._loading"
                      title="Download HTML for handover"
                    >
                      Export
                    </button>

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
        </template>
      </section>

      <!-- Industry Distribution -->
      <section v-if="leadsStore.stats.byIndustry && Object.keys(leadsStore.stats.byIndustry).length > 0" class="section">
        <div class="section-header">
          <h2>By Industry</h2>
        </div>
        <div class="industry-grid">
          <div v-for="(count, industry) in leadsStore.stats.byIndustry" :key="industry" class="industry-card">
            <div class="industry-name">{{ industry }}</div>
            <div class="industry-count">{{ count }}</div>
          </div>
        </div>
      </section>
    </main>

    <!-- Bulk Actions Bar -->
    <BulkActions
      :selectedCount="ui.selectedLeadIds.size"
      @bulkProcess="handleBulkProcess"
      @bulkDelete="handleBulkDelete"
      @clearSelection="ui.clearSelection()"
    />

    <footer class="footer">
      <p>Site Improver Dashboard &bull; {{ new Date().getFullYear() }}</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { STATUS_INFO, timeAgo as timeAgoFn, validateUrl as validateUrlFn } from '../api.js';
import { useLeadsStore } from '../stores/leads.js';
import { useEmailsStore } from '../stores/emails.js';
import { useUiStore } from '../stores/ui.js';
import { usePipelineStore } from '../stores/pipeline.js';
import AppToast from '../components/base/AppToast.vue';
import SkeletonLoader from '../components/base/SkeletonLoader.vue';
import StatsGrid from '../components/stats/StatsGrid.vue';
import PipelineProgress from '../components/pipeline/PipelineProgress.vue';
import LeadCard from '../components/leads/LeadCard.vue';
import BulkActions from '../components/leads/BulkActions.vue';
import EmailPreview from '../components/email/EmailPreview.vue';
import OnboardingModal from '../components/onboarding/OnboardingModal.vue';

// Stores
const leadsStore = useLeadsStore();
const emailsStore = useEmailsStore();
const ui = useUiStore();
const pipelineStore = usePipelineStore();

// Computed
const allSelected = computed(() => {
  const leads = leadsStore.filteredLeads;
  if (leads.length === 0) return false;
  return leads.every(l => ui.selectedLeadIds.has(l.id || l.siteId));
});

// Methods
function timeAgo(date) {
  return timeAgoFn(date);
}

function validateUrl(url) {
  return validateUrlFn(url);
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

async function fetchAllData() {
  await Promise.all([
    leadsStore.fetchLeads(),
    emailsStore.fetchAll()
  ]);
}

async function handleNewLead() {
  const err = validateUrl(pipelineStore.newLeadUrl);
  if (err) {
    pipelineStore.urlError = err;
    return;
  }

  pipelineStore.urlError = '';

  try {
    const response = await pipelineStore.startPipeline(
      pipelineStore.newLeadUrl,
      pipelineStore.skipEmail
    );

    if (response && response.success && response.preview) {
      ui.showToast(`Preview ready: ${response.businessName || 'Site'}`, 'success');
      pipelineStore.newLeadUrl = '';
      await fetchAllData();
      return;
    }

    pipelineStore.newLeadUrl = '';
    ui.showToast('Pipeline started! Processing your lead...', 'success');
  } catch (err) {
    ui.showToast(err.message, 'error');
  }
}

async function handleDiscover() {
  try {
    const result = await leadsStore.discover();
    ui.showToast(`Found ${result.found} leads, saved ${result.saved} to pipeline`, 'success');
  } catch (err) {
    ui.showToast(`Discovery failed: ${err.message}`, 'error');
  }
}

async function handleStatusChange(lead, newStatus) {
  try {
    await leadsStore.updateLeadStatus(lead, newStatus);
  } catch (err) {
    ui.showToast(`Failed to update status: ${err.message}`, 'error');
  }
}

async function handleDelete(lead) {
  if (!confirm('Delete this lead and its deployment?')) return;

  try {
    await leadsStore.deleteLead(lead);
    ui.showToast('Lead deleted', 'success');
  } catch (err) {
    ui.showToast(`Failed to delete: ${err.message}`, 'error');
  }
}

async function handleSendEmail(lead) {
  try {
    await leadsStore.sendEmail(lead);
    ui.showToast('Email sent successfully', 'success');
  } catch (err) {
    ui.showToast(`Failed to send email: ${err.message}`, 'error');
  }
}

function handleExport(lead) {
  try {
    leadsStore.exportLead(lead);
    ui.showToast('Downloading site HTML...', 'success');
  } catch (err) {
    ui.showToast(err.message, 'error');
  }
}

async function handleConvert(lead) {
  const amount = prompt('Enter payment amount (optional):', '1000');
  if (amount === null) return;

  try {
    await leadsStore.convertLead(lead, amount);
    ui.showToast(`Converted! ${amount ? '$' + amount : ''}`, 'success');
  } catch (err) {
    ui.showToast(`Failed to convert: ${err.message}`, 'error');
  }
}

async function handleProcessLead(lead) {
  try {
    await leadsStore.processLead(lead);
    ui.showToast(`Processing started for ${lead.businessName || 'lead'}`, 'success');
  } catch (err) {
    ui.showToast(`Failed to process: ${err.message}`, 'error');
  }
}

async function handleApproveEmail(emailId) {
  try {
    await emailsStore.approveSend(emailId);
    ui.showToast('Email approved and sent', 'success');
  } catch (err) {
    ui.showToast(`Failed to send email: ${err.message}`, 'error');
  }
}

async function handleRejectEmail(emailId) {
  try {
    await emailsStore.reject(emailId);
    ui.showToast('Email rejected', 'success');
  } catch (err) {
    ui.showToast(`Failed to reject email: ${err.message}`, 'error');
  }
}

async function handleSaveEmailSettings() {
  try {
    await emailsStore.updateConfig();
    ui.showToast('Email settings saved', 'success');
  } catch (err) {
    ui.showToast(`Failed to save settings: ${err.message}`, 'error');
  }
}

function scrollToDemo() {
  const demoSection = document.getElementById('demo');
  if (demoSection) {
    demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    ui.clearSelection();
  } else {
    const ids = leadsStore.filteredLeads.map(l => l.id || l.siteId);
    ui.selectAllLeads(ids);
  }
}

async function handleBulkProcess() {
  if (!confirm(`Process ${ui.selectedLeadIds.size} selected leads?`)) return;

  try {
    const results = await leadsStore.bulkProcess([...ui.selectedLeadIds]);
    ui.showToast(`Bulk process: ${results.success} started, ${results.failed} failed`, 'success');
    ui.clearSelection();
  } catch (err) {
    ui.showToast(`Bulk process failed: ${err.message}`, 'error');
  }
}

async function handleBulkDelete() {
  if (!confirm(`Delete ${ui.selectedLeadIds.size} selected leads?`)) return;

  try {
    const results = await leadsStore.bulkDelete([...ui.selectedLeadIds]);
    ui.showToast(`Bulk delete: ${results.success} deleted, ${results.failed} failed`, 'success');
    ui.clearSelection();
  } catch (err) {
    ui.showToast(`Bulk delete failed: ${err.message}`, 'error');
  }
}

// Lifecycle
let refreshInterval;
const REFRESH_INTERVAL = 60000;

onMounted(() => {
  fetchAllData();
  refreshInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchAllData();
    }
  }, REFRESH_INTERVAL);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  pipelineStore.cleanup();
});
</script>

<style scoped>
/* Checkbox column styling for bulk selection */
.checkbox-col {
  width: 40px;
  text-align: center;
}

.checkbox-col input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent-blue);
}

tr.selected {
  background: rgba(59, 130, 246, 0.08);
}

/* Responsive leads table */
.leads-cards {
  display: none;
}

.table-container {
  display: block;
}

@media (max-width: 768px) {
  .leads-cards {
    display: block;
  }

  .table-container {
    display: none;
  }

  .lead-mobile-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1rem;
    margin-bottom: 0.75rem;
    transition: all var(--transition-fast);
  }

  .lead-mobile-card.selected {
    border-color: var(--accent-blue);
    background: rgba(59, 130, 246, 0.08);
  }

  .lead-mobile-card.loading {
    opacity: 0.6;
  }

  .mobile-card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .mobile-checkbox {
    flex-shrink: 0;
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--accent-blue);
  }

  .mobile-business-info {
    flex: 1;
    min-width: 0;
  }

  .mobile-business-info .business-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .mobile-business-info .business-meta {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .mobile-card-body .contact-info {
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
  }

  .mobile-card-body .contact-info .email,
  .mobile-card-body .contact-info .phone {
    font-size: 0.875rem;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .mobile-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
}

/* Mobile bottom padding for tab bar */
@media (max-width: 768px) {
  .main {
    padding-bottom: 5rem;
  }
}
</style>
