<script setup lang="ts">
import type { ExtractedWord } from '../../stores/sentences'

defineProps<{
  words: ExtractedWord[]
}>()

const emit = defineEmits<{
  'set-familiarity': [wordId: number, familiarity: string]
  'create-card': [wordId: number]
}>()

const familiarityOptions = [
  { value: 'never_seen', label: 'Never seen' },
  { value: 'seen_unsure', label: 'Seen but unsure' },
  { value: 'understand_in_context', label: 'Understand in context' },
] as const

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
  <div class="word-selector">
    <h3 class="selector-title">Extracted Words ({{ words.length }})</h3>

    <div v-if="!words.length" class="empty">No words extracted.</div>

    <div v-for="word in words" :key="word.id" class="word-card">
      <div class="word-header">
        <span class="word-lemma">{{ word.lemma }}</span>
        <span
          class="word-cefr"
          :style="{ background: cefrColor(word.cefrLevel) }"
        >
          {{ word.cefrLevel }}
        </span>
        <span v-if="word.thematicCluster" class="word-cluster">{{ word.thematicCluster }}</span>
      </div>

      <div class="word-translation">{{ word.translation }}</div>

      <div class="familiarity-row">
        <button
          v-for="opt in familiarityOptions"
          :key="opt.value"
          class="fam-btn"
          :class="{ active: word.familiarity === opt.value }"
          @click="emit('set-familiarity', word.id, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="card-action">
        <span v-if="word.srsCardCreated" class="card-created">
          Added to review
        </span>
        <button
          v-else
          class="add-card-btn"
          @click="emit('create-card', word.id)"
        >
          Add to review
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.word-selector {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.selector-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}

.empty {
  color: #9ca3af;
  font-size: 0.9rem;
}

.word-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.word-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.word-lemma {
  font-weight: 700;
  font-size: 1.05rem;
  color: #111827;
}

.word-cefr {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
}

.word-cluster {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.word-translation {
  font-size: 0.9rem;
  color: #4b5563;
}

.familiarity-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.fam-btn {
  padding: 0.3rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
  color: #4b5563;
}

.fam-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.fam-btn.active {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
}

.card-action {
  display: flex;
  align-items: center;
}

.add-card-btn {
  padding: 0.35rem 0.8rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.add-card-btn:hover {
  background: #059669;
}

.card-created {
  font-size: 0.8rem;
  color: #10b981;
  font-weight: 600;
}
</style>
