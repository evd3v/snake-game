<script setup lang="ts">
import { onMounted } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import VocabularyFilters from '@/components/vocabulary/VocabularyFilters.vue'
import VocabularyList from '@/components/vocabulary/VocabularyList.vue'
import WordDetail from '@/components/vocabulary/WordDetail.vue'

const store = useVocabularyStore()

onMounted(() => {
  store.fetchWords()
})
</script>

<template>
  <div class="vocabulary-page">
    <div class="vocabulary-header">
      <h1 class="vocabulary-title">Vocabulary</h1>
    </div>

    <div v-if="store.error" class="error-banner">
      <p class="error-text">{{ store.error }}</p>
      <button class="retry-btn" @click="store.fetchWords()">Retry</button>
    </div>

    <VocabularyFilters />

    <div class="vocabulary-content">
      <VocabularyList />
    </div>

    <WordDetail v-if="store.selectedWord || store.detailLoading" />
  </div>
</template>

<style scoped>
.vocabulary-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px;
}

.vocabulary-header {
  margin-bottom: 20px;
}

.vocabulary-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  margin-bottom: 16px;
}

.error-text {
  margin: 0;
  color: #dc2626;
  font-size: 14px;
  flex: 1;
}

.retry-btn {
  padding: 6px 14px;
  border: 1px solid #dc2626;
  border-radius: 6px;
  background: #fff;
  color: #dc2626;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}

.retry-btn:hover {
  background: #fef2f2;
}

.vocabulary-content {
  min-height: 300px;
}
</style>
