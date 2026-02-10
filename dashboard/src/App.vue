<template>
  <Transition name="page" mode="out-in">
    <router-view />
  </Transition>
  <MobileTabBar />
</template>

<script setup>
import MobileTabBar from './components/base/MobileTabBar.vue';
</script>

<style>
.page-enter-active {
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.page-leave-active {
  transition: all 200ms ease-out;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
