<template>
  <div v-if="job.active" class="pipeline-progress">
    <div class="progress-header">
      <span class="progress-url">{{ job.url }}</span>
      <span class="progress-time">{{ job.elapsed }}s</span>
    </div>
    <div class="progress-stages">
      <div
        v-for="(stage, index) in stagesConfig"
        :key="stage.id"
        :class="['progress-stage', {
          'completed': job.stageIndex > index,
          'active': job.stageIndex === index,
          'pending': job.stageIndex < index
        }]"
      >
        <div class="stage-icon">
          <span v-if="job.stageIndex > index" class="check-icon">&#10003;</span>
          <span v-else-if="job.stageIndex === index" class="spinner-icon"></span>
          <span v-else class="stage-number">{{ index + 1 }}</span>
        </div>
        <div class="stage-label">{{ stage.label }}</div>
      </div>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: job.percent + '%' }"></div>
    </div>
    <div v-if="job.error" class="progress-error">
      {{ job.error }}
    </div>
    <div v-if="job.previewUrl" class="progress-complete">
      <router-link :to="job.previewUrl" class="btn btn-primary">
        View Preview
      </router-link>
    </div>
  </div>
</template>

<script setup>
defineProps({
  job: { type: Object, required: true },
  stagesConfig: { type: Array, required: true }
});
</script>
