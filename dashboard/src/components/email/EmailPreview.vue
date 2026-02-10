<template>
  <Teleport to="body">
    <div v-if="email" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal email-preview-modal" :class="{ 'modal-wide': device === 'desktop' }">
        <div class="modal-header">
          <h3>Email Preview</h3>
          <div class="device-toggle">
            <button
              :class="['device-btn', { active: device === 'desktop' }]"
              @click="device = 'desktop'"
              title="Desktop view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </button>
            <button
              :class="['device-btn', { active: device === 'mobile' }]"
              @click="device = 'mobile'"
              title="Mobile view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </button>
          </div>
          <button @click="$emit('close')" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="email-header-fields">
            <div class="preview-field">
              <label>To:</label>
              <span>{{ email.to }}</span>
            </div>
            <div class="preview-field">
              <label>Subject:</label>
              <span>{{ email.subject }}</span>
            </div>
          </div>
          <div class="device-frame-container">
            <div :class="['device-frame', `device-${device}`]">
              <div class="device-screen">
                <div class="email-client-header">
                  <div class="email-client-from">
                    <span class="sender-avatar">SI</span>
                    <div class="sender-info">
                      <span class="sender-name">Site Improver</span>
                      <span class="sender-email">{{ fromEmail || 'noreply@siteimprover.com' }}</span>
                    </div>
                  </div>
                  <div class="email-client-date">{{ formatDate(email.createdAt) }}</div>
                </div>
                <div class="email-client-subject">{{ email.subject }}</div>
                <iframe
                  v-if="email.htmlBody"
                  :srcdoc="email.htmlBody"
                  sandbox="allow-same-origin"
                  class="email-client-body-iframe"
                  title="Email preview"
                ></iframe>
                <div v-else class="email-client-body">{{ email.textBody || 'No content' }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer" v-if="email.status === 'draft'">
          <button class="btn btn-ghost" @click="$emit('close')">Close</button>
          <button class="btn btn-danger" @click="$emit('reject', email.id)">
            Reject
          </button>
          <button class="btn btn-primary" @click="$emit('approve', email.id)">
            Approve & Send
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  email: { type: Object, default: null },
  fromEmail: { type: String, default: '' }
});

defineEmits(['close', 'approve', 'reject']);

const device = ref('desktop');

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
</script>
