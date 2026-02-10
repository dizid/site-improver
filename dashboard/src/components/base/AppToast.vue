<template>
  <Teleport to="body">
    <div v-if="ui.toast" :class="['toast', `toast-${ui.toast.type}`]" role="alert" aria-live="polite">
      <span>{{ ui.toast.message }}</span>
      <button @click="ui.hideToast()" aria-label="Dismiss notification">&times;</button>
    </div>
  </Teleport>
</template>

<script setup>
import { useUiStore } from '../../stores/ui.js';

const ui = useUiStore();
</script>
