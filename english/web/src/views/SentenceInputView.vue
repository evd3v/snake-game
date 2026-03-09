<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useSentenceStore } from '../stores/sentences'
import SentenceForm from '../components/sentence/SentenceForm.vue'
import AnalysisResult from '../components/sentence/AnalysisResult.vue'
import WordSelector from '../components/sentence/WordSelector.vue'

const store = useSentenceStore()

function handleSubmit(text: string) {
  store.analyze(text)
}

function handleSetFamiliarity(wordId: number, familiarity: string) {
  store.setFamiliarity(wordId, familiarity)
}

function handleCreateCard(wordId: number) {
  store.createSrsCard(wordId)
}

onUnmounted(() => {
  store.reset()
})
</script>

<template>
  <div class="sentence-page">
    <h1 class="page-title">Sentence Analysis</h1>

    <SentenceForm
      :disabled="store.loading"
      @submit="handleSubmit"
    />

    <div v-if="store.polling" class="loading-state">
      <div class="spinner" />
      <span class="loading-text">Analyzing your sentence...</span>
    </div>

    <div v-if="store.error" class="error-box">
      {{ store.error }}
    </div>

    <template v-if="store.result">
      <AnalysisResult :result="store.result" />

      <WordSelector
        :words="store.words"
        @set-familiarity="handleSetFamiliarity"
        @create-card="handleCreateCard"
      />

      <button class="reset-btn" @click="store.reset()">
        New sentence
      </button>
    </template>
  </div>
</template>

<style scoped>
.sentence-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #eef2ff;
  border-radius: 8px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #c7d2fe;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 0.9rem;
  color: #4338ca;
  font-weight: 500;
}

.error-box {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.9rem;
}

.reset-btn {
  align-self: flex-start;
  padding: 0.6rem 1.2rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.reset-btn:hover {
  background: #e5e7eb;
}
</style>
