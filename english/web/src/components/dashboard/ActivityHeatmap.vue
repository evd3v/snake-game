<script setup lang="ts">
import { computed } from 'vue'
import type { DayActivity } from '@/types/api'

const props = defineProps<{ data: DayActivity[] }>()

const CELL_SIZE = 12
const CELL_GAP = 2
const CELL_STEP = CELL_SIZE + CELL_GAP
const DAYS_LABEL_WIDTH = 30
const MONTH_LABEL_HEIGHT = 16
const WEEKS = 52
const DAYS = 7

const activityMap = computed(() => {
  const map = new Map<string, DayActivity>()
  for (const d of props.data) {
    map.set(d.date, d)
  }
  return map
})

const grid = computed(() => {
  const today = new Date()
  const cells: { x: number; y: number; date: string; count: number; tooltip: string }[] = []

  // Start from 364 days ago
  const start = new Date(today)
  start.setDate(start.getDate() - 363)

  // Adjust to start on a Sunday
  const startDay = start.getDay()
  if (startDay !== 0) {
    start.setDate(start.getDate() - startDay)
  }

  const cursor = new Date(start)
  let week = 0
  let day = 0

  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const activity = activityMap.value.get(dateStr)
    const count = activity ? activity.reviews + activity.additions : 0
    const tooltip = `${dateStr}: ${count > 0 ? `${activity?.reviews ?? 0} reviews, ${activity?.additions ?? 0} additions` : 'No activity'}`

    cells.push({
      x: DAYS_LABEL_WIDTH + week * CELL_STEP,
      y: MONTH_LABEL_HEIGHT + day * CELL_STEP,
      date: dateStr,
      count,
      tooltip,
    })

    day++
    if (day === DAYS) {
      day = 0
      week++
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return cells
})

const maxCount = computed(() => Math.max(...grid.value.map((c) => c.count), 1))

function getColor(count: number): string {
  if (count === 0) return '#ebedf0'
  const ratio = count / maxCount.value
  if (ratio < 0.25) return '#9be9a8'
  if (ratio < 0.5) return '#40c463'
  if (ratio < 0.75) return '#30a14e'
  return '#216e39'
}

const monthLabels = computed(() => {
  const labels: { x: number; label: string }[] = []
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let lastMonth = -1

  for (const cell of grid.value) {
    const month = new Date(cell.date).getMonth()
    if (month !== lastMonth) {
      labels.push({ x: cell.x, label: months[month] ?? '' })
      lastMonth = month
    }
  }

  return labels
})

const dayLabels = [
  { y: MONTH_LABEL_HEIGHT + 1 * CELL_STEP + CELL_SIZE / 2, label: 'Mon' },
  { y: MONTH_LABEL_HEIGHT + 3 * CELL_STEP + CELL_SIZE / 2, label: 'Wed' },
  { y: MONTH_LABEL_HEIGHT + 5 * CELL_STEP + CELL_SIZE / 2, label: 'Fri' },
]

const streak = computed(() => {
  const today = new Date()
  let count = 0
  const cursor = new Date(today)

  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const activity = activityMap.value.get(dateStr)
    if (activity && (activity.reviews > 0 || activity.additions > 0)) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  return count
})

const svgWidth = computed(() => DAYS_LABEL_WIDTH + WEEKS * CELL_STEP + CELL_SIZE)
const svgHeight = MONTH_LABEL_HEIGHT + DAYS * CELL_STEP + CELL_SIZE
</script>

<template>
  <div class="activity-heatmap">
    <div class="header">
      <h3 class="title">Activity</h3>
      <span class="streak" v-if="streak > 0">{{ streak }} day streak</span>
    </div>
    <div class="heatmap-scroll">
      <svg :width="svgWidth" :height="svgHeight" class="heatmap-svg">
        <text
          v-for="(ml, i) in monthLabels"
          :key="'m' + i"
          :x="ml.x"
          :y="12"
          class="month-label"
        >
          {{ ml.label }}
        </text>
        <text
          v-for="(dl, i) in dayLabels"
          :key="'d' + i"
          :x="0"
          :y="dl.y"
          class="day-label"
        >
          {{ dl.label }}
        </text>
        <rect
          v-for="(cell, i) in grid"
          :key="'c' + i"
          :x="cell.x"
          :y="cell.y"
          :width="CELL_SIZE"
          :height="CELL_SIZE"
          :fill="getColor(cell.count)"
          rx="2"
          ry="2"
        >
          <title>{{ cell.tooltip }}</title>
        </rect>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.activity-heatmap {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}

.streak {
  font-size: 13px;
  font-weight: 600;
  color: #16a34a;
}

.heatmap-scroll {
  overflow-x: auto;
}

.heatmap-svg {
  display: block;
}

.month-label {
  font-size: 10px;
  fill: #64748b;
}

.day-label {
  font-size: 10px;
  fill: #64748b;
  dominant-baseline: central;
}
</style>
