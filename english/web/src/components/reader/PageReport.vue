<script setup lang="ts">
import { watch, ref } from 'vue'

interface PageStats {
  wordsLearned: number
  wordsKnown: number
  grammarPatternsFound: number
  collocationsLearned: number
}

const props = defineProps<{
  visible: boolean
  stats: PageStats
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const timer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    timer.value = setTimeout(() => emit('dismiss'), 3000)
  } else if (timer.value) {
    clearTimeout(timer.value)
    timer.value = null
  }
})

function onClick() {
  if (timer.value) {
    clearTimeout(timer.value)
    timer.value = null
  }
  emit('dismiss')
}

const lines = ref<string[]>([])

watch(() => [props.visible, props.stats] as const, ([v, s]) => {
  if (!v) return
  const parts: string[] = []
  if (s.wordsLearned > 0) parts.push(`+${s.wordsLearned} to learn`)
  if (s.wordsKnown > 0) parts.push(`${s.wordsKnown} marked known`)
  if (s.grammarPatternsFound > 0) parts.push(`${s.grammarPatternsFound} grammar pattern${s.grammarPatternsFound > 1 ? 's' : ''}`)
  if (s.collocationsLearned > 0) parts.push(`${s.collocationsLearned} collocation${s.collocationsLearned > 1 ? 's' : ''}`)
  lines.value = parts
}, { deep: true })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="report-overlay" @click="onClick">
      <div class="report-card">
        <div class="report-title">Page complete!</div>
        <div v-if="lines.length > 0" class="report-stats">
          <span v-for="(line, i) in lines" :key="i" class="stat-line">{{ line }}</span>
        </div>
        <div v-else class="report-empty">No new items on this page.</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.report-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  cursor: pointer;
}

.report-card {
  background: var(--bg, #ffffff);
  color: var(--text, #1e293b);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  padding: 20px 28px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.report-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.report-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-line {
  font-size: 14px;
  opacity: 0.7;
}

.report-empty {
  font-size: 14px;
  opacity: 0.5;
}
</style>
