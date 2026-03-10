<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'

const store = useVocabularyStore()

const searchInput = ref(store.filters.search)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    store.updateFilters({ search: val })
  }, 300)
})

function onFamiliarityChange(e: Event) {
  store.updateFilters({ familiarity: (e.target as HTMLSelectElement).value })
}

function onCefrChange(e: Event) {
  store.updateFilters({ cefrLevel: (e.target as HTMLSelectElement).value })
}

function onSrsChange(e: Event) {
  store.updateFilters({ srsState: (e.target as HTMLSelectElement).value })
}

function onClusterChange(e: Event) {
  store.updateFilters({ cluster: (e.target as HTMLSelectElement).value })
}

function onSortByChange(e: Event) {
  store.updateFilters({ sortBy: (e.target as HTMLSelectElement).value })
}

function toggleSortOrder() {
  store.updateFilters({ sortOrder: store.filters.sortOrder === 'asc' ? 'desc' : 'asc' })
}

const uniqueClusters = ref<string[]>([])

watch(
  () => store.items,
  (items) => {
    const clusters = new Set<string>()
    for (const item of items) {
      if (item.thematicCluster) clusters.add(item.thematicCluster)
    }
    uniqueClusters.value = [...clusters].sort()
  },
  { immediate: true },
)
</script>

<template>
  <div class="filters">
    <div class="filter-row">
      <input
        v-model="searchInput"
        type="text"
        placeholder="Search words..."
        class="search-input"
      />

      <select :value="store.filters.familiarity" class="filter-select" @change="onFamiliarityChange">
        <option value="">All familiarity</option>
        <option value="never_seen">Never seen</option>
        <option value="seen_unsure">Seen but unsure</option>
        <option value="understand_in_context">Understand in context</option>
      </select>

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

      <select :value="store.filters.cluster" class="filter-select" @change="onClusterChange">
        <option value="">All clusters</option>
        <option v-for="c in uniqueClusters" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div class="sort-row">
      <label class="sort-label">Sort:</label>
      <select :value="store.filters.sortBy" class="filter-select" @change="onSortByChange">
        <option value="lemma">Alphabetical</option>
        <option value="date">Date added</option>
        <option value="cefr">CEFR level</option>
      </select>
      <button class="sort-order-btn" @click="toggleSortOrder">
        {{ store.filters.sortOrder === 'asc' ? 'A-Z' : 'Z-A' }}
      </button>
      <button v-if="store.filters.search || store.filters.familiarity || store.filters.cefrLevel || store.filters.srsState || store.filters.cluster" class="clear-btn" @click="store.clearFilters()">
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

.sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.sort-order-btn {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
  min-width: 44px;
}

.sort-order-btn:hover {
  background: #f8fafc;
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
