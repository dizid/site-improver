<template>
  <div class="skeleton-container">
    <div
      v-for="index in count"
      :key="index"
      :class="['skeleton-item', `skeleton-${type}`]"
    >
      <div v-if="type === 'card'" class="skeleton-card">
        <div class="skeleton-shimmer skeleton-title"></div>
        <div class="skeleton-shimmer skeleton-text"></div>
        <div class="skeleton-shimmer skeleton-text short"></div>
      </div>

      <div v-else-if="type === 'list'" class="skeleton-list">
        <div class="skeleton-shimmer skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton-shimmer skeleton-title"></div>
          <div class="skeleton-shimmer skeleton-text short"></div>
        </div>
      </div>

      <div v-else-if="type === 'stats'" class="skeleton-stats">
        <div class="skeleton-shimmer skeleton-stat-value"></div>
        <div class="skeleton-shimmer skeleton-stat-label"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'card',
    validator: (value) => ['card', 'list', 'stats'].includes(value)
  },
  count: {
    type: Number,
    default: 1
  }
});
</script>

<style scoped>
.skeleton-container {
  display: contents;
}

.skeleton-item {
  animation: fadeIn 0.3s ease-in;
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--bg-card) 0%,
    var(--bg-hover) 50%,
    var(--bg-card) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.skeleton-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-title {
  height: 1.25rem;
  width: 60%;
  max-width: 200px;
}

.skeleton-text {
  height: 0.875rem;
  width: 100%;
}

.skeleton-text.short {
  width: 80%;
}

.skeleton-list {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-stats {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-stat-value {
  height: 2rem;
  width: 50%;
  max-width: 80px;
}

.skeleton-stat-label {
  height: 0.75rem;
  width: 70%;
  max-width: 100px;
}

@media (max-width: 768px) {
  .skeleton-card {
    padding: 1rem;
  }

  .skeleton-stats {
    padding: 1rem;
  }
}
</style>
