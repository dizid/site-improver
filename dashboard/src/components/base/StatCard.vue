<template>
  <div :class="['stat-card', colorClass]">
    <div class="stat-value">{{ value }}</div>
    <div class="stat-label">{{ label }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: { type: [String, Number], default: 0 },
  label: { type: String, required: true },
  color: { type: String, default: '' }
});

const colorClass = computed(() => {
  if (!props.color) return '';
  return `stat-${props.color}`;
});
</script>
