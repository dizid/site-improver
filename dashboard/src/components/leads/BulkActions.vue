<template>
  <Teleport to="body">
    <transition name="slide-up">
      <div v-if="selectedCount > 0" class="bulk-actions-bar">
        <div class="bulk-actions-content">
          <span class="bulk-count">{{ selectedCount }} lead{{ selectedCount !== 1 ? 's' : '' }} selected</span>
          <div class="bulk-buttons">
            <button class="btn btn-sm btn-primary" @click="$emit('bulkProcess')" :disabled="loading">
              Process Selected
            </button>
            <button class="btn btn-sm btn-danger" @click="$emit('bulkDelete')" :disabled="loading">
              Delete Selected
            </button>
            <button class="btn btn-sm btn-ghost" @click="$emit('clearSelection')">
              Clear
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
defineProps({
  selectedCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false }
});

defineEmits(['bulkProcess', 'bulkDelete', 'bulkExport', 'clearSelection']);
</script>

<style scoped>
.bulk-actions-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--accent-blue);
  padding: 0.75rem 2rem;
  z-index: 200;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
}

.bulk-actions-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.bulk-count {
  font-weight: 600;
  color: var(--accent-blue);
}

.bulk-buttons {
  display: flex;
  gap: 0.5rem;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
