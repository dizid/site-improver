<template>
  <section id="stats" aria-label="Statistics">
    <div class="stats-grid">
      <template v-if="loading">
        <SkeletonLoader type="stats" :count="6" />
      </template>
      <template v-else>
        <StatCard :value="stats.totalLeads || 0" label="Total Leads" />
        <StatCard :value="stats.byStatus?.deployed || 0" label="Deployed" color="blue" />
        <StatCard :value="stats.byStatus?.emailing || 0" label="Emailing" color="yellow" />
        <StatCard :value="stats.byStatus?.converted || 0" label="Converted" color="green" />
        <StatCard :value="`${stats.conversionRate || 0}%`" label="Conversion Rate" color="purple" />
        <StatCard :value="stats.activeDeployments || 0" label="Active Sites" color="money" />
      </template>
    </div>
  </section>
</template>

<script setup>
import StatCard from '../base/StatCard.vue';
import SkeletonLoader from '../base/SkeletonLoader.vue';

defineProps({
  stats: { type: Object, required: true },
  loading: { type: Boolean, default: false }
});
</script>
