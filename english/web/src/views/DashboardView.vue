<script setup lang="ts">
import { onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import ProgressCounters from '@/components/dashboard/ProgressCounters.vue'
import WeakSpots from '@/components/dashboard/WeakSpots.vue'
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap.vue'
import ClusterCoverage from '@/components/dashboard/ClusterCoverage.vue'

const store = useDashboardStore()

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1 class="dashboard-title">Dashboard</h1>
      <button class="refresh-btn" :disabled="store.loading" @click="store.fetchAll()">
        <span class="refresh-icon" :class="{ spinning: store.loading }">&#x21bb;</span>
        Refresh
      </button>
    </div>

    <div v-if="store.loading && !store.stats" class="loading">
      <div class="spinner"></div>
      <p>Loading dashboard...</p>
    </div>

    <div v-else-if="store.error" class="error">
      <p class="error-message">{{ store.error }}</p>
      <button class="retry-btn" @click="store.fetchAll()">Retry</button>
    </div>

    <div v-else class="dashboard-grid">
      <section class="grid-full">
        <ProgressCounters v-if="store.stats" :stats="store.stats" />
      </section>

      <section class="grid-left">
        <WeakSpots :spots="store.weakSpots" />
      </section>

      <section class="grid-right">
        <ClusterCoverage :clusters="store.clusters" />
      </section>

      <section class="grid-full">
        <ActivityHeatmap :data="store.activity" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  display: inline-block;
  font-size: 16px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

.error {
  text-align: center;
  padding: 48px 0;
}

.error-message {
  color: #dc2626;
  font-size: 15px;
  margin-bottom: 12px;
}

.retry-btn {
  padding: 8px 20px;
  border: 1px solid #dc2626;
  border-radius: 6px;
  background: #fff;
  color: #dc2626;
  font-size: 14px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #fef2f2;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
}

.grid-full {
  grid-column: 1 / -1;
}

.grid-left {
  grid-column: 1 / 2;
}

.grid-right {
  grid-column: 2 / 3;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .grid-left,
  .grid-right {
    grid-column: 1;
  }
}
</style>
