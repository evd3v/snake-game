<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGrammarStore } from '@/stores/grammar'

const store = useGrammarStore()

const searchInput = ref(store.filters.search)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    store.updateFilters({ search: val })
  }, 300)
})

function onCefrChange(e: Event) {
  store.updateFilters({ cefrLevel: (e.target as HTMLSelectElement).value })
}

function onSrsChange(e: Event) {
  store.updateFilters({ srsState: (e.target as HTMLSelectElement).value })
}
</script>

<template>
  <div class="filters">
    <div class="filter-row">
      <input
        v-model="searchInput"
        type="text"
        placeholder="Search grammar patterns..."
        class="search-input"
      />

      <select :value="store.filters.cefrLevel" class="filter-select" @change="onCefrChange">
        <option value="">All CEFR</option>
        <option value="A1">A1</option>
        <option value="A2">A2</option>
        <option value="B1">B1</option>
        <option value="B2">B2</option>
        <option value="C1">C1</option>
        <option value="C2">C2</option>
      </select>

      <select :value="store.filters.srsState" class="filter-select" @change="onSrsChange">
        <option value="">All SRS</option>
        <option value="new">New</option>
        <option value="learning">Learning</option>
        <option value="review">Review</option>
        <option value="none">Not in review</option>
      </select>

      <button
        v-if="store.filters.search || store.filters.cefrLevel || store.filters.srsState"
        class="clear-btn"
        @click="store.clearFilters()"
      >
        Clear filters
      </button>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-input {
  flex: 1 1 200px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: #3b82f6;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.clear-btn {
  padding: 6px 12px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #fff;
  color: #dc2626;
  font-size: 13px;
  cursor: pointer;
  margin-left: auto;
}

.clear-btn:hover {
  background: #fef2f2;
}
</style>
