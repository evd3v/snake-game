<script setup lang="ts">
import type { WeakSpot } from '@/types/api'

defineProps<{ spots: WeakSpot[] }>()

function failRateColor(rate: number): string {
  if (rate > 0.7) return '#dc2626'
  if (rate > 0.4) return '#d97706'
  return '#16a34a'
}
</script>

<template>
  <div class="weak-spots">
    <h3 class="title">Weak Spots</h3>
    <div v-if="spots.length === 0" class="empty">No weak spots yet</div>
    <table v-else class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Fail Rate</th>
          <th>Reviews</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="spot in spots" :key="spot.id">
          <td>
            <span class="name">{{ spot.name }}</span>
            <span v-if="spot.type === 'vocabulary' && spot.translation" class="detail">
              {{ spot.translation }}
            </span>
            <span v-if="spot.type === 'grammar' && spot.description" class="detail">
              {{ spot.description }}
            </span>
          </td>
          <td>
            <span class="badge" :class="'badge--' + spot.type">
              {{ spot.type }}
            </span>
          </td>
          <td>
            <span class="fail-rate" :style="{ color: failRateColor(spot.failRate) }">
              {{ Math.round(spot.failRate * 100) }}%
            </span>
          </td>
          <td class="reviews-count">{{ spot.totalReviews }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.weak-spots {
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

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th {
  text-align: left;
  padding: 8px;
  border-bottom: 2px solid #e2e8f0;
  font-weight: 600;
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table td {
  padding: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.name {
  font-weight: 500;
  color: #1e293b;
}

.detail {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge--vocabulary {
  background: #eff6ff;
  color: #2563eb;
}

.badge--grammar {
  background: #faf5ff;
  color: #9333ea;
}

.fail-rate {
  font-weight: 700;
  font-size: 15px;
}

.reviews-count {
  color: #64748b;
  text-align: right;
}
</style>
