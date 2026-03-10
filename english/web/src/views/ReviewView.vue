<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReviewStore } from '@/stores/review'
import ReviewCard from '@/components/review/ReviewCard.vue'
import RatingButtons from '@/components/review/RatingButtons.vue'
import ReviewProgress from '@/components/review/ReviewProgress.vue'
import ReviewSummary from '@/components/review/ReviewSummary.vue'

const store = useReviewStore()
const router = useRouter()

function handleKeydown(e: KeyboardEvent) {
  const tag = (document.activeElement as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  if (!store.revealed) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      store.reveal()
    }
  } else {
    if (['1', '2', '3', '4'].includes(e.key)) {
      store.rate(Number(e.key) as 1 | 2 | 3 | 4)
    }
  }
}

const shouldShowRating = () => {
  const card = store.currentCard
  if (!card) return false
  if (store.revealed) return true
  // Grammar card with no exercise -- always show rating
  if (card.cardType === 'grammar' && !card.exercise) return true
  return false
}

onMounted(() => {
  store.startSession()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (store.sessionActive) {
    store.endSession()
  }
})
</script>

<template>
  <div class="review-page">
    <!-- Loading -->
    <div v-if="store.loading" class="review-state">
      <p class="state-text">Loading review cards...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="review-state">
      <p class="error-text">{{ store.error }}</p>
      <button class="retry-btn" @click="store.startSession()">Try Again</button>
    </div>

    <!-- No cards due -->
    <div v-else-if="!store.sessionActive && store.cards.length === 0" class="review-state">
      <p class="state-text">No cards due for review. Come back later!</p>
      <RouterLink to="/" class="home-link">Back to Dashboard</RouterLink>
    </div>

    <!-- Session complete -->
    <div v-else-if="store.isComplete" class="review-area">
      <ReviewSummary
        :stats="store.stats"
        @restart="store.startSession()"
        @go-home="router.push('/')"
      />
    </div>

    <!-- Active session -->
    <div v-else-if="store.currentCard" class="review-area">
      <ReviewProgress
        :progress="store.progress"
        :current="store.currentIndex + 1"
        :total="store.cards.length"
      />

      <div class="card-container">
        <ReviewCard :card="store.currentCard" :revealed="store.revealed" />
      </div>

      <div v-if="shouldShowRating()" class="rating-container">
        <RatingButtons @rate="(r: number) => store.rate(r as 1 | 2 | 3 | 4)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
  min-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
}

.review-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.state-text {
  font-size: 18px;
  color: #64748b;
}

.error-text {
  font-size: 16px;
  color: #dc2626;
}

.retry-btn {
  padding: 8px 20px;
  border: 1px solid #dc2626;
  border-radius: 8px;
  background: #fff;
  color: #dc2626;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.retry-btn:hover {
  background: #fef2f2;
}

.home-link {
  color: #2563eb;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
}

.home-link:hover {
  text-decoration: underline;
}

.review-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
}

.card-container {
  flex: 1;
  display: flex;
  align-items: center;
}

.rating-container {
  padding-bottom: 24px;
}
</style>
