<script setup lang="ts">
import { useVocabularyStore } from '@/stores/vocabulary'

const store = useVocabularyStore()

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

async function handleMarkKnown() {
  if (!store.selectedWord) return
  await store.markKnown(store.selectedWord.id)
}

async function handleReset() {
  if (!store.selectedWord) return
  await store.resetWord(store.selectedWord.id)
}

function selectFamilyWord(wordId: number) {
  store.fetchWordDetail(wordId)
}
</script>

<template>
  <div class="detail-overlay" @click.self="store.closeDetail()">
    <div class="detail-panel">
      <button class="close-btn" @click="store.closeDetail()">&times;</button>

      <div v-if="store.detailLoading" class="detail-loading">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>

      <template v-else-if="store.selectedWord">
        <div class="detail-header">
          <h2 class="detail-lemma">{{ store.selectedWord.lemma }}</h2>
          <span
            v-if="store.selectedWord.cefrLevel"
            class="cefr-badge"
            :style="{ background: cefrColor(store.selectedWord.cefrLevel) }"
          >
            {{ store.selectedWord.cefrLevel }}
          </span>
          <span v-if="store.selectedWord.thematicCluster" class="cluster-tag">
            {{ store.selectedWord.thematicCluster }}
          </span>
        </div>

        <!-- Actions -->
        <div class="actions">
          <template v-for="sense in store.selectedWord.senses" :key="sense.id">
            <template v-if="sense.srsCard">
              <button class="action-btn mark-known-btn" @click="handleMarkKnown()">
                Mark as known
              </button>
            </template>
          </template>
          <button
            v-if="!store.selectedWord.senses.some((s) => s.srsCard)"
            class="action-btn reset-btn"
            @click="handleReset()"
          >
            Reset to queue
          </button>
        </div>

        <!-- Senses -->
        <section class="detail-section">
          <h3 class="section-title">Senses</h3>
          <ul class="sense-list">
            <li v-for="sense in store.selectedWord.senses" :key="sense.id" class="sense-item">
              <div class="sense-main">
                <span class="pos-tag">{{ sense.partOfSpeech }}</span>
                <span v-if="sense.translation" class="sense-translation">{{ sense.translation }}</span>
              </div>
              <div class="sense-meta">
                <span class="familiarity-label">{{ sense.familiarity.replace(/_/g, ' ') }}</span>
                <template v-if="sense.srsCard">
                  <span class="srs-info">
                    SRS: {{ sense.srsCard.state }} | Due: {{ formatDate(sense.srsCard.due) }} | Reps: {{ sense.srsCard.reps }}
                  </span>
                </template>
              </div>
            </li>
          </ul>
        </section>

        <!-- Collocations -->
        <section class="detail-section">
          <h3 class="section-title">Collocations</h3>
          <div v-if="store.selectedWord.collocations.length === 0" class="empty-section">
            No collocations found
          </div>
          <ul v-else class="collocation-list">
            <li v-for="col in store.selectedWord.collocations" :key="col.id" class="collocation-item">
              <div class="collocation-main">
                <strong>{{ col.text }}</strong>
                <span v-if="col.translation" class="collocation-translation">{{ col.translation }}</span>
              </div>
              <div class="collocation-meta">
                <span class="type-badge">{{ col.type }}</span>
                <span
                  v-if="col.cefrLevel"
                  class="cefr-badge cefr-small"
                  :style="{ background: cefrColor(col.cefrLevel) }"
                >
                  {{ col.cefrLevel }}
                </span>
              </div>
            </li>
          </ul>
        </section>

        <!-- Word Family -->
        <section v-if="store.selectedWord.wordFamily.length > 0" class="detail-section">
          <h3 class="section-title">Word Family</h3>
          <ul class="family-list">
            <li
              v-for="member in store.selectedWord.wordFamily"
              :key="member.id"
              class="family-item"
              @click="selectFamilyWord(member.id)"
            >
              <span class="family-lemma">{{ member.lemma }}</span>
              <span
                v-if="member.cefrLevel"
                class="cefr-badge cefr-small"
                :style="{ background: cefrColor(member.cefrLevel) }"
              >
                {{ member.cefrLevel }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Sentences -->
        <section v-if="store.selectedWord.sentences.length > 0" class="detail-section">
          <h3 class="section-title">Sentences</h3>
          <ul class="sentence-list">
            <li v-for="s in store.selectedWord.sentences" :key="s.id" class="sentence-item">
              {{ s.text }}
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.detail-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.detail-panel {
  width: 100%;
  max-width: 420px;
  background: #fff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  padding: 24px;
  overflow-y: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
}

.close-btn:hover {
  color: #334155;
}

.detail-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
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

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.detail-lemma {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.cefr-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  color: white;
  font-weight: 700;
  font-size: 12px;
}

.cefr-small {
  padding: 1px 6px;
  font-size: 10px;
}

.cluster-tag {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 3px 10px;
  border-radius: 999px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.mark-known-btn {
  background: #22c55e;
  color: white;
}

.mark-known-btn:hover {
  background: #16a34a;
}

.reset-btn {
  background: #3b82f6;
  color: white;
}

.reset-btn:hover {
  background: #2563eb;
}

.detail-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;
}

.empty-section {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

.sense-list,
.collocation-list,
.family-list,
.sentence-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sense-item {
  padding: 8px 0;
  border-bottom: 1px solid #f8fafc;
}

.sense-item:last-child {
  border-bottom: none;
}

.sense-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pos-tag {
  font-size: 11px;
  color: #94a3b8;
  padding: 1px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  flex-shrink: 0;
}

.sense-translation {
  font-size: 14px;
  color: #334155;
}

.sense-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.familiarity-label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: capitalize;
}

.srs-info {
  font-size: 11px;
  color: #64748b;
}

.collocation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f8fafc;
}

.collocation-item:last-child {
  border-bottom: none;
}

.collocation-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collocation-translation {
  font-size: 12px;
  color: #64748b;
}

.collocation-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-badge {
  font-size: 10px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.family-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  cursor: pointer;
}

.family-item:hover {
  color: #3b82f6;
}

.family-lemma {
  font-size: 14px;
  color: #334155;
}

.family-item:hover .family-lemma {
  color: #3b82f6;
}

.sentence-item {
  padding: 8px 0;
  font-size: 13px;
  color: #475569;
  border-bottom: 1px solid #f8fafc;
  line-height: 1.5;
}

.sentence-item:last-child {
  border-bottom: none;
}
</style>
