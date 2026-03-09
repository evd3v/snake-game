<script setup lang="ts">
import type { ClusterStats } from '@/types/api'

defineProps<{ clusters: ClusterStats[] }>()
</script>

<template>
  <div class="cluster-coverage">
    <h3 class="title">Cluster Coverage</h3>
    <div v-if="clusters.length === 0" class="empty">No vocabulary clusters yet</div>
    <div v-else class="clusters">
      <div v-for="cluster in clusters" :key="cluster.cluster" class="cluster-row">
        <span class="cluster-name">{{ cluster.cluster }}</span>
        <div class="bar-container">
          <div class="bar">
            <div
              v-if="cluster.known > 0"
              class="segment segment--known"
              :style="{ width: (cluster.known / cluster.total * 100) + '%' }"
            >
              <span v-if="cluster.known / cluster.total > 0.12" class="segment-label">{{ cluster.known }}</span>
            </div>
            <div
              v-if="cluster.learning > 0"
              class="segment segment--learning"
              :style="{ width: (cluster.learning / cluster.total * 100) + '%' }"
            >
              <span v-if="cluster.learning / cluster.total > 0.12" class="segment-label">{{ cluster.learning }}</span>
            </div>
            <div
              v-if="cluster.new > 0"
              class="segment segment--new"
              :style="{ width: (cluster.new / cluster.total * 100) + '%' }"
            >
              <span v-if="cluster.new / cluster.total > 0.12" class="segment-label">{{ cluster.new }}</span>
            </div>
          </div>
        </div>
        <span class="cluster-total">{{ cluster.total }}</span>
      </div>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch legend-swatch--known"></span> Known</span>
        <span class="legend-item"><span class="legend-swatch legend-swatch--learning"></span> Learning</span>
        <span class="legend-item"><span class="legend-swatch legend-swatch--new"></span> New</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cluster-coverage {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}

.empty {
  color: #94a3b8;
  text-align: center;
  padding: 24px;
  font-size: 14px;
}

.cluster-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.cluster-name {
  width: 100px;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 0;
}

.bar-container {
  flex: 1;
  min-width: 0;
}

.bar {
  display: flex;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  background: #f1f5f9;
}

.segment {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  transition: width 0.3s ease;
}

.segment--known {
  background: #16a34a;
  color: #fff;
}

.segment--learning {
  background: #d97706;
  color: #fff;
}

.segment--new {
  background: #2563eb;
  color: #fff;
}

.segment-label {
  font-size: 11px;
  font-weight: 600;
}

.cluster-total {
  width: 36px;
  text-align: right;
  font-size: 13px;
  color: #64748b;
  flex-shrink: 0;
}

.legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
}

.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-swatch--known {
  background: #16a34a;
}

.legend-swatch--learning {
  background: #d97706;
}

.legend-swatch--new {
  background: #2563eb;
}
</style>
