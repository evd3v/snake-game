<script setup lang="ts">
import type { ReviewStats } from '@/types/api'

defineProps<{
  stats: ReviewStats
}>()

const emit = defineEmits<{
  restart: []
  goHome: []
}>()

const ratingLabels = [
  { key: 1 as const, label: 'Again', color: '#ef4444' },
  { key: 2 as const, label: 'Hard', color: '#f97316' },
  { key: 3 as const, label: 'Good', color: '#22c55e' },
  { key: 4 as const, label: 'Easy', color: '#2563eb' },
]
</script>

<template>
  <div class="review-summary">
    <h2 class="summary-title">Session Complete</h2>
    <p class="summary-total">{{ stats.total }} cards reviewed</p>

    <div class="rating-breakdown">
      <div
        v-for="r in ratingLabels"
        :key="r.key"
        class="rating-row"
      >
        <span class="rating-indicator" :style="{ background: r.color }" />
        <span class="rating-label">{{ r.label }}</span>
        <span class="rating-count">{{ stats.ratings[r.key] }}</span>
      </div>
    </div>

    <div class="summary-actions">
      <button class="action-btn primary" @click="emit('restart')">Review Again</button>
      <button class="action-btn secondary" @click="emit('goHome')">Back to Dashboard</button>
    </div>
  </div>
</template>

<style scoped>
.review-summary {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 32px;
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.summary-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px;
}

.summary-total {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 24px;
}

.rating-breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.rating-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rating-label {
  font-size: 15px;
  font-weight: 500;
  color: #334155;
  flex: 1;
  text-align: left;
}

.rating-count {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.summary-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.action-btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s;
  border: none;
}

.action-btn:hover {
  filter: brightness(0.95);
}

.action-btn.primary {
  background: #2563eb;
  color: #fff;
}

.action-btn.secondary {
  background: #f1f5f9;
  color: #334155;
}
</style>
