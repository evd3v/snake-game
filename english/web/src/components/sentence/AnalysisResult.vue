<script setup lang="ts">
import type { AnalysisResult } from '../../stores/sentences'

defineProps<{
  result: AnalysisResult
}>()

function cefrColor(level: string): string {
  const colors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#86efac',
    B1: '#f59e0b',
    B2: '#f97316',
    C1: '#ef4444',
    C2: '#991b1b',
  }
  return colors[level] ?? '#6b7280'
}
</script>

<template>
  <div class="analysis-result">
    <div class="translation-box">
      <span class="translation-label">Translation</span>
      <p class="translation-text">{{ result.translation }}</p>
    </div>

    <div class="meta-row">
      <span
        class="cefr-badge"
        :style="{ background: cefrColor(result.cefrLevel) }"
      >
        {{ result.cefrLevel }}
      </span>
      <span class="word-count">{{ result.words }} words extracted</span>
    </div>

    <details v-if="result.grammarPatterns.length" class="section" open>
      <summary class="section-title">Grammar Patterns ({{ result.grammarPatterns.length }})</summary>
      <ul class="pattern-list">
        <li v-for="gp in result.grammarPatterns" :key="gp.pattern" class="pattern-item">
          <strong>{{ gp.pattern }}</strong>
          <span class="pattern-desc">{{ gp.description }}</span>
        </li>
      </ul>
    </details>

    <details v-if="result.collocations?.length" class="section">
      <summary class="section-title">Collocations ({{ result.collocations.length }})</summary>
      <ul class="pattern-list">
        <li v-for="col in result.collocations" :key="col.text" class="pattern-item">
          <strong>{{ col.text }}</strong>
          <span class="pattern-desc">{{ col.translation }}</span>
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.analysis-result {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.translation-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 1rem;
}

.translation-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #16a34a;
  letter-spacing: 0.05em;
}

.translation-text {
  margin: 0.25rem 0 0;
  font-size: 1.05rem;
  color: #15803d;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cefr-badge {
  display: inline-block;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
}

.word-count {
  font-size: 0.85rem;
  color: #6b7280;
}

.section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.section-title {
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: #374151;
  cursor: pointer;
  background: #f9fafb;
}

.section-title:hover {
  background: #f3f4f6;
}

.pattern-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pattern-item {
  padding: 0.6rem 1rem;
  border-top: 1px solid #f3f4f6;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.pattern-desc {
  font-size: 0.85rem;
  color: #6b7280;
}
</style>
