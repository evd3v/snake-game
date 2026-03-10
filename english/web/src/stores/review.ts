import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiGet, apiPost } from '@/api/client'
import type { DueCard, ReviewStats } from '@/types/api'

export const useReviewStore = defineStore('review', () => {
  const cards = ref<DueCard[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const loading = ref(false)
  const sessionActive = ref(false)
  const error = ref<string | null>(null)
  const fetchedAt = ref('')

  const stats = reactive<ReviewStats>({
    total: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
  })

  const currentCard = computed(() => cards.value[currentIndex.value] ?? null)
  const progress = computed(() => (cards.value.length > 0 ? currentIndex.value / cards.value.length : 0))
  const isComplete = computed(() => sessionActive.value && currentIndex.value >= cards.value.length)

  async function startSession() {
    loading.value = true
    error.value = null
    try {
      const data = await apiGet<DueCard[]>('/review/due?limit=20')
      fetchedAt.value = new Date().toISOString()
      cards.value = data
      currentIndex.value = 0
      revealed.value = false
      stats.total = 0
      stats.ratings = { 1: 0, 2: 0, 3: 0, 4: 0 }
      sessionActive.value = data.length > 0
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start review session'
    } finally {
      loading.value = false
    }
  }

  function reveal() {
    revealed.value = true
  }

  async function rate(rating: 1 | 2 | 3 | 4) {
    const card = currentCard.value
    if (!card) return

    try {
      await apiPost(`/review/${card.cardId}/rate`, { rating, fetchedAt: fetchedAt.value })
      stats.ratings[rating]++
      stats.total++
    } catch (e) {
      if (e instanceof Error && e.message.includes('409')) {
        // Stale card -- skip without counting in stats
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to rate card'
        return
      }
    }

    currentIndex.value++
    revealed.value = false
  }

  function endSession() {
    sessionActive.value = false
  }

  return {
    cards,
    currentIndex,
    revealed,
    loading,
    sessionActive,
    error,
    fetchedAt,
    stats,
    currentCard,
    progress,
    isComplete,
    startSession,
    reveal,
    rate,
    endSession,
  }
})
