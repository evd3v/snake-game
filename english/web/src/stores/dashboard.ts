import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiGet } from '@/api/client'
import type { ProgressStats, WeakSpot, DayActivity, ClusterStats } from '@/types/api'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<ProgressStats | null>(null)
  const weakSpots = ref<WeakSpot[]>([])
  const activity = ref<DayActivity[]>([])
  const clusters = ref<ClusterStats[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const [statsData, weakSpotsData, activityData, clustersData] = await Promise.all([
        apiGet<ProgressStats>('/dashboard/stats'),
        apiGet<WeakSpot[]>('/dashboard/weak-spots'),
        apiGet<DayActivity[]>('/dashboard/activity'),
        apiGet<ClusterStats[]>('/dashboard/clusters'),
      ])
      stats.value = statsData
      weakSpots.value = weakSpotsData
      activity.value = activityData
      clusters.value = clustersData
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load dashboard data'
    } finally {
      loading.value = false
    }
  }

  return { stats, weakSpots, activity, clusters, loading, error, fetchAll }
})
