<template>
  <div
    :class="['pipeline-lead', { selected }]"
    role="button"
    tabindex="0"
    :aria-label="`View details for ${lead.businessName || 'lead'}`"
    @click="$emit('viewDetails', lead)"
    @keydown.enter="$emit('viewDetails', lead)"
    @keydown.space.prevent="$emit('viewDetails', lead)"
  >
    <div class="lead-card-header">
      <label class="lead-checkbox" @click.stop>
        <input
          type="checkbox"
          :checked="selected"
          @change="$emit('toggleSelect', lead.id || lead.siteId)"
        />
      </label>
      <div class="lead-name">{{ lead.businessName || 'Unknown' }}</div>
    </div>
    <div class="lead-meta">
      <span v-if="lead.industry" class="industry-tag">{{ lead.industry }}</span>
      <span v-if="lead.score !== undefined" class="score-badge">{{ lead.score }}/100</span>
      <span class="time-ago">{{ timeAgo(lead.updatedAt) }}</span>
    </div>
    <div v-if="lead.url" class="lead-url">{{ lead.url || lead.originalUrl }}</div>
    <div class="lead-actions">
      <button
        v-if="canProcess"
        class="btn btn-sm btn-primary"
        @click.stop="$emit('process', lead)"
      >
        Process
      </button>
      <button
        class="btn btn-sm btn-danger"
        @click.stop="$emit('delete', lead)"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { timeAgo } from '../../api.js';

const props = defineProps({
  lead: { type: Object, required: true },
  selected: { type: Boolean, default: false }
});

defineEmits(['process', 'delete', 'viewDetails', 'toggleSelect']);

const canProcess = computed(() => {
  return ['discovered', 'qualified'].includes(props.lead.status) && props.lead.url;
});
</script>

<style scoped>
.pipeline-lead {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pipeline-lead:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
}

.pipeline-lead.selected {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
}

.lead-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.lead-checkbox {
  display: flex;
  align-items: center;
}

.lead-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.lead-name {
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.lead-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.industry-tag {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--accent-color);
  color: var(--text-primary);
  border-radius: 3px;
  font-size: 0.75rem;
}

.score-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--success-color);
  color: white;
  border-radius: 3px;
  font-size: 0.75rem;
}

.time-ago {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.lead-url {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
