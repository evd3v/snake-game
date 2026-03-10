<script setup lang="ts">
defineProps<{
  progress: number
  current: number
  total: number
}>()
</script>

<template>
  <div class="review-progress">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progress * 100}%` }" />
    </div>
    <span class="progress-text">{{ current }} / {{ total }}</span>
  </div>
</template>

<style scoped>
.review-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
}
</style>
