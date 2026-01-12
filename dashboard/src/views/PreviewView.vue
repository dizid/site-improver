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
          <span class="preview-expires" :class="{ urgent: isExpiringSoon }">
            {{ expiresText }}
          </span>
          <span v-if="preview.viewCount" class="preview-views">
            {{ preview.viewCount }} views
          </span>
        </div>
      </header>

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
