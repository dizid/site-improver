<template>
  <div class="preview-page">
    <!-- Loading State -->
    <div v-if="loading" class="preview-loading">
      <div class="spinner-container">
        <div class="spinner"></div>
      </div>
      <p>Loading preview...</p>
    </div>

    <!-- Error/Expired State -->
    <div v-else-if="error" class="preview-error">
      <div class="error-content">
        <div class="error-icon">{{ isExpired ? '⏰' : '🔍' }}</div>
        <h1>{{ isExpired ? 'Preview Expired' : 'Preview Not Found' }}</h1>
        <p v-if="isExpired">
          This preview has expired. Contact us to regenerate it or discuss your new website.
        </p>
        <p v-else>
          The preview you're looking for doesn't exist or may have been removed.
        </p>
        <router-link to="/" class="btn btn-primary">
          ← Back to Dashboard
        </router-link>
      </div>
    </div>

    <!-- Preview Display -->
    <div v-else class="preview-container">
      <!-- Info Bar -->
      <header class="preview-header">
        <div class="preview-info">
          <router-link to="/" class="back-link" title="Back to Dashboard">
            ←
          </router-link>
          <div class="preview-title">
            <h1>{{ preview.businessName }}</h1>
            <span class="preview-industry">{{ preview.industry }}</span>
          </div>
        </div>
        <div class="preview-meta">
          <a
            :href="preview.originalUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost"
          >
            View Original ↗
          </a>
          <button
            class="btn btn-ghost"
            :class="{ active: showAnalytics }"
            @click="toggleAnalytics"
          >
            📊 Analytics
          </button>
          <span class="preview-expires" :class="{ urgent: isExpiringSoon }">
            {{ expiresText }}
          </span>
          <span v-if="preview.viewCount" class="preview-views">
            {{ preview.viewCount }} views
          </span>
          <span v-if="preview.validation" class="quality-badge" :class="qualityClass">
            {{ preview.validation.qualityScore }}%
          </span>
        </div>
      </header>

      <!-- Validation Warnings -->
      <div v-if="hasValidationIssues" class="validation-panel">
        <div v-if="preview.validation.issues.length > 0" class="validation-issues">
          <div class="validation-header critical">
            <span class="validation-icon">!</span>
            <strong>Quality Issues ({{ preview.validation.issues.length }})</strong>
          </div>
          <ul class="validation-list">
            <li v-for="issue in preview.validation.issues" :key="issue.type">
              {{ issue.message }}
              <span v-if="issue.actual" class="validation-actual">{{ issue.actual }}</span>
            </li>
          </ul>
        </div>
        <div v-if="preview.validation.warnings.length > 0" class="validation-warnings">
          <div class="validation-header warning">
            <span class="validation-icon">i</span>
            <strong>Warnings ({{ preview.validation.warnings.length }})</strong>
          </div>
          <ul class="validation-list">
            <li v-for="warning in preview.validation.warnings" :key="warning.type">
              {{ warning.message }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Analytics Panel -->
      <div v-if="showAnalytics" class="analytics-panel">
        <div v-if="analyticsLoading" class="analytics-loading">
          Loading analytics...
        </div>
        <div v-else-if="analytics" class="analytics-grid">
          <div class="analytics-card">
            <div class="analytics-value">{{ analytics.pageviews }}</div>
            <div class="analytics-label">Page Views</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">{{ analytics.uniqueSessions }}</div>
            <div class="analytics-label">Unique Sessions</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">{{ formatTime(analytics.avgTimeOnPage) }}</div>
            <div class="analytics-label">Avg. Time on Page</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">{{ analytics.clicks?.cta || 0 }}</div>
            <div class="analytics-label">CTA Clicks</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">{{ analytics.clicks?.phone || 0 }}</div>
            <div class="analytics-label">Phone Clicks</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">{{ analytics.formInteractions?.submitted || 0 }}</div>
            <div class="analytics-label">Form Submissions</div>
          </div>
          <div class="analytics-card scroll-depth">
            <div class="analytics-label">Scroll Depth</div>
            <div class="scroll-bars">
              <div class="scroll-bar">
                <div class="scroll-progress" :style="{ width: scrollPercent(25) + '%' }"></div>
                <span>25%: {{ analytics.scrollDepths?.['25'] || 0 }}</span>
              </div>
              <div class="scroll-bar">
                <div class="scroll-progress" :style="{ width: scrollPercent(50) + '%' }"></div>
                <span>50%: {{ analytics.scrollDepths?.['50'] || 0 }}</span>
              </div>
              <div class="scroll-bar">
                <div class="scroll-progress" :style="{ width: scrollPercent(75) + '%' }"></div>
                <span>75%: {{ analytics.scrollDepths?.['75'] || 0 }}</span>
              </div>
              <div class="scroll-bar">
                <div class="scroll-progress" :style="{ width: scrollPercent(100) + '%' }"></div>
                <span>100%: {{ analytics.scrollDepths?.['100'] || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="analytics-empty">
          No analytics data yet
        </div>
      </div>

      <!-- Iframe with Generated Site -->
      <div class="preview-frame-container">
        <iframe
          ref="previewFrame"
          :src="`/api/preview/${slug}/html`"
          class="preview-iframe"
          title="Website Preview"
          @load="onFrameLoad"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const slug = route.params.slug;

const preview = ref(null);
const loading = ref(true);
const error = ref('');
const isExpired = ref(false);
const previewFrame = ref(null);
const showAnalytics = ref(false);
const analytics = ref(null);
const analyticsLoading = ref(false);

// Computed
const expiresText = computed(() => {
  if (!preview.value?.expiresAt) return '';

  const expiresAt = new Date(preview.value.expiresAt);
  const now = new Date();
  const diffMs = expiresAt - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Expired';
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays <= 7) return `Expires in ${diffDays} days`;

  return `Expires ${expiresAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })}`;
});

const isExpiringSoon = computed(() => {
  if (!preview.value?.expiresAt) return false;
  const expiresAt = new Date(preview.value.expiresAt);
  const now = new Date();
  const diffDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
});

const hasValidationIssues = computed(() => {
  const v = preview.value?.validation;
  if (!v) return false;
  return (v.issues?.length > 0) || (v.warnings?.length > 0);
});

const qualityClass = computed(() => {
  const score = preview.value?.validation?.qualityScore;
  if (score === undefined) return '';
  if (score >= 80) return 'quality-good';
  if (score >= 60) return 'quality-ok';
  return 'quality-poor';
});

// Methods
async function fetchPreview() {
  try {
    const res = await fetch(`/api/preview/${slug}`);

    if (res.status === 410) {
      isExpired.value = true;
      const data = await res.json();
      error.value = data.error || 'Preview expired';
      return;
    }

    if (res.status === 404) {
      error.value = 'Preview not found';
      return;
    }

    if (!res.ok) {
      throw new Error('Failed to fetch preview');
    }

    preview.value = await res.json();
  } catch (e) {
    error.value = e.message;
    console.error('Failed to fetch preview:', e);
  } finally {
    loading.value = false;
  }
}

function onFrameLoad() {
  // Could add analytics or interaction tracking here
  console.log('Preview frame loaded');
}

async function toggleAnalytics() {
  showAnalytics.value = !showAnalytics.value;
  if (showAnalytics.value && !analytics.value) {
    await fetchAnalytics();
  }
}

async function fetchAnalytics() {
  analyticsLoading.value = true;
  try {
    const res = await fetch(`/api/preview/${slug}/analytics`);
    if (res.ok) {
      analytics.value = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch analytics:', e);
  } finally {
    analyticsLoading.value = false;
  }
}

function formatTime(seconds) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function scrollPercent(milestone) {
  if (!analytics.value?.pageviews || analytics.value.pageviews === 0) return 0;
  const count = analytics.value.scrollDepths?.[milestone] || 0;
  return Math.round((count / analytics.value.pageviews) * 100);
}

// Lifecycle
onMounted(() => {
  fetchPreview();
});
</script>

<style scoped>
.preview-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
}

/* Loading State */
.preview-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  color: #a0a0b0;
}

.spinner-container {
  width: 48px;
  height: 48px;
}

.spinner {
  width: 100%;
  height: 100%;
  border: 3px solid #333;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.preview-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.error-content {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-content h1 {
  font-size: 1.5rem;
  color: #fff;
  margin: 0 0 1rem 0;
}

.error-content p {
  color: #a0a0b0;
  margin: 0 0 2rem 0;
  line-height: 1.6;
}

/* Preview Container */
.preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Header */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a3e;
  flex-shrink: 0;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #252538;
  color: #a0a0b0;
  text-decoration: none;
  font-size: 1.25rem;
  transition: all 0.2s;
}

.back-link:hover {
  background: #3b82f6;
  color: white;
}

.preview-title h1 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #fff;
}

.preview-industry {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: capitalize;
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.preview-expires {
  font-size: 0.8125rem;
  color: #6b7280;
  padding: 0.375rem 0.75rem;
  background: #252538;
  border-radius: 6px;
}

.preview-expires.urgent {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.preview-views {
  font-size: 0.8125rem;
  color: #6b7280;
}

/* Quality Badge */
.quality-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  background: #374151;
  color: #9ca3af;
}

.quality-badge.quality-good {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.quality-badge.quality-ok {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.quality-badge.quality-poor {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* Validation Panel */
.validation-panel {
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a3e;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.validation-issues,
.validation-warnings {
  border-radius: 8px;
  overflow: hidden;
}

.validation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
}

.validation-header.critical {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.validation-header.warning {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.validation-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
}

.validation-header.critical .validation-icon {
  background: #ef4444;
  color: white;
}

.validation-header.warning .validation-icon {
  background: #eab308;
  color: #1a1a2e;
}

.validation-list {
  margin: 0;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  background: #252538;
  list-style: disc;
}

.validation-list li {
  font-size: 0.8125rem;
  color: #a0a0b0;
  margin-bottom: 0.375rem;
}

.validation-list li:last-child {
  margin-bottom: 0;
}

.validation-actual {
  display: inline-block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 0.5rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-ghost {
  background: transparent;
  color: #a0a0b0;
  border: 1px solid #333;
}

.btn-ghost:hover {
  background: #252538;
  color: #fff;
}

.btn-ghost.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

/* Analytics Panel */
.analytics-panel {
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a3e;
  padding: 1rem 1.5rem;
}

.analytics-loading,
.analytics-empty {
  text-align: center;
  color: #6b7280;
  padding: 1rem;
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.analytics-card {
  background: #252538;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.analytics-card.scroll-depth {
  grid-column: span 2;
  text-align: left;
}

.analytics-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #3b82f6;
}

.analytics-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scroll-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.scroll-bar {
  position: relative;
  background: #1a1a2e;
  border-radius: 4px;
  height: 24px;
  overflow: hidden;
}

.scroll-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.scroll-bar span {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 0.75rem;
  font-size: 0.75rem;
  color: #fff;
}

/* Iframe */
.preview-frame-container {
  flex: 1;
  position: relative;
  background: #fff;
}

.preview-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* Responsive */
@media (max-width: 768px) {
  .preview-header {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .preview-info {
    width: 100%;
  }

  .preview-meta {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .preview-title h1 {
    font-size: 1rem;
  }
}
</style>
