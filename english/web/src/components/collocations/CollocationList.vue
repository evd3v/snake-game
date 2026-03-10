<script setup lang="ts">
import { computed } from 'vue'
import { useCollocationsStore } from '@/stores/collocations'

const store = useCollocationsStore()

const totalPages = computed(() => Math.max(1, Math.ceil(store.total / store.limit)))

function cefrColor(level: string | null): string {
  if (!level) return '#6b7280'
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

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    collocation: 'collocation',
    phrasal_verb: 'phrasal verb',
    idiom: 'idiom',
  }
  return labels[type] ?? type
}
</script>

<template>
  <div class="collocation-list">
    <div v-if="store.loading" class="loading">
      <div class="spinner"></div>
      <p>Loading collocations...</p>
    </div>

    <div v-else-if="store.items.length === 0" class="empty">
      <p class="empty-text">No collocations match your filters</p>
    </div>

    <template v-else>
      <div class="list-header">
        <span class="count">{{ store.total }} collocations</span>
      </div>

      <ul class="list">
        <li
          v-for="item in store.items"
          :key="item.id"
          class="list-item"
        >
          <div class="item-top">
            <div class="item-main">
              <span class="collocation-text">{{ item.text }}</span>
              <span v-if="item.translation" class="translation">{{ item.translation }}</span>
            </div>
            <div class="item-meta">
              <span
                v-if="item.cefrLevel"
                class="cefr-badge"
                :style="{ background: cefrColor(item.cefrLevel) }"
              >
                {{ item.cefrLevel }}
              </span>
              <span class="type-tag">
                {{ typeLabel(item.type) }}
              </span>
            </div>
          </div>
          <div v-if="item.exampleSentences.length > 0" class="examples">
            <p
              v-for="ex in item.exampleSentences.slice(0, 3)"
              :key="ex.id"
              class="example"
            >
              {{ ex.text }}
            </p>
          </div>
        </li>
      </ul>

      <div class="pagination">
        <button
          class="page-btn"
          :disabled="store.page <= 1"
          @click="store.setPage(store.page - 1)"
        >
          Previous
        </button>
        <span class="page-info">Page {{ store.page }} of {{ totalPages }}</span>
        <button
          class="page-btn"
          :disabled="store.page >= totalPages"
          @click="store.setPage(store.page + 1)"
        >
          Next
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.collocation-list {
  min-height: 200px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: #64748b;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty {
  text-align: center;
  padding: 48px 0;
}

.empty-text {
  color: #94a3b8;
  font-size: 15px;
}

.list-header {
  margin-bottom: 8px;
}

.count {
  font-size: 13px;
  color: #64748b;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.list-item {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.list-item:last-child {
  border-bottom: none;
}

.item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collocation-text {
  font-weight: 600;
  font-size: 15px;
  color: #0f172a;
}

.translation {
  font-size: 13px;
  color: #64748b;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cefr-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  color: white;
  font-weight: 700;
  font-size: 11px;
}

.type-tag {
  font-size: 11px;
  color: #94a3b8;
  padding: 2px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.examples {
  margin-top: 6px;
  padding-left: 12px;
  border-left: 2px solid #e2e8f0;
}

.example {
  font-size: 13px;
  color: #64748b;
  font-style: italic;
  margin: 2px 0;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.page-btn {
  padding: 6px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 13px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #f8fafc;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #64748b;
}
</style>
