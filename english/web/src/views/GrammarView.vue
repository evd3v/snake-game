<script setup lang="ts">
import { onMounted } from 'vue'
import { useGrammarStore } from '@/stores/grammar'
import GrammarFilters from '@/components/grammar/GrammarFilters.vue'
import GrammarList from '@/components/grammar/GrammarList.vue'

const store = useGrammarStore()

onMounted(() => {
  store.fetchItems()
})
</script>

<template>
  <div class="grammar-page">
    <div class="grammar-header">
      <h1 class="grammar-title">Grammar Patterns</h1>
    </div>

    <div v-if="store.error" class="error-banner">
      <p class="error-text">{{ store.error }}</p>
      <button class="retry-btn" @click="store.fetchItems()">Retry</button>
    </div>

    <GrammarFilters />

    <div class="grammar-content">
      <GrammarList />
    </div>
  </div>
</template>

<style scoped>
.grammar-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px;
}

.grammar-header {
  margin-bottom: 20px;
}

.grammar-title {
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

.grammar-content {
  min-height: 300px;
}
</style>
