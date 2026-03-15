<script setup lang="ts">
import { ref, computed } from 'vue'

interface WordItem {
  senseId: number
  lemma: string
  partOfSpeech: string
  translation: string
  definition: string
  cefrLevel: string
}

interface CollocationItem {
  collocationId: number
  text: string
  translation: string
  type: string
  cefrLevel: string
}

interface GrammarItem {
  grammarPatternId: number
  pattern: string
  description: string
  cefrLevel: string
}

interface ReaderAnalysisResult {
  translation: string
  cefrLevel: string
  newWords: WordItem[]
  newCollocations: CollocationItem[]
  newGrammarPatterns: GrammarItem[]
  existingWordsCount: number
  existingCollocationsCount: number
  existingGrammarPatternsCount: number
}

const props = defineProps<{
  result: ReaderAnalysisResult | null
  sentenceText: string
  loading: boolean
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  learn: [type: 'word' | 'collocation' | 'grammar', id: number]
  know: [type: 'word' | 'collocation' | 'grammar', id: number]
}>()

const actedOn = ref(new Set<string>())
const actedStatus = ref(new Map<string, 'learn' | 'know'>())

function handleLearn(type: 'word' | 'collocation' | 'grammar', id: number) {
  const key = `${type}-${id}`
  if (actedOn.value.has(key)) return
  actedOn.value.add(key)
  actedOn.value = new Set(actedOn.value)
  actedStatus.value.set(key, 'learn')
  actedStatus.value = new Map(actedStatus.value)
  emit('learn', type, id)
}

function handleKnow(type: 'word' | 'collocation' | 'grammar', id: number) {
  const key = `${type}-${id}`
  if (actedOn.value.has(key)) return
  actedOn.value.add(key)
  actedOn.value = new Set(actedOn.value)
  actedStatus.value.set(key, 'know')
  actedStatus.value = new Map(actedStatus.value)
  emit('know', type, id)
}

function isActed(type: string, id: number): boolean {
  return actedOn.value.has(`${type}-${id}`)
}

function getStatus(type: string, id: number): 'learn' | 'know' | null {
  return actedStatus.value.get(`${type}-${id}`) ?? null
}

const hasNewItems = computed(() => {
  if (!props.result) return false
  return (
    props.result.newWords.length > 0 ||
    props.result.newCollocations.length > 0 ||
    props.result.newGrammarPatterns.length > 0
  )
})

const existingSummaryParts = computed(() => {
  if (!props.result) return []
  const parts: string[] = []
  if (props.result.existingWordsCount > 0)
    parts.push(`${props.result.existingWordsCount} word${props.result.existingWordsCount > 1 ? 's' : ''}`)
  if (props.result.existingCollocationsCount > 0)
    parts.push(`${props.result.existingCollocationsCount} collocation${props.result.existingCollocationsCount > 1 ? 's' : ''}`)
  if (props.result.existingGrammarPatternsCount > 0)
    parts.push(`${props.result.existingGrammarPatternsCount} grammar pattern${props.result.existingGrammarPatternsCount > 1 ? 's' : ''}`)
  return parts
})

function onBackdropClick() {
  emit('close')
}

function onContentClick(e: Event) {
  e.stopPropagation()
}

function closeModal() {
  actedOn.value = new Set()
  actedStatus.value = new Map()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click="onBackdropClick">
      <div class="modal-content" @click="onContentClick">
        <div class="modal-header">
          <p class="sentence-text">{{ sentenceText }}</p>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>

        <div v-if="loading" class="modal-loading">
          <div class="spinner"></div>
          <span>Analyzing...</span>
        </div>

        <div v-else-if="result" class="modal-body">
          <div class="translation-box">
            {{ result.translation }}
          </div>

          <template v-if="hasNewItems">
            <div v-if="result.newWords.length > 0" class="section">
              <h3 class="section-title">New Words</h3>
              <div v-for="w in result.newWords" :key="w.senseId" class="item-row">
                <div class="item-info">
                  <span class="item-main">{{ w.lemma }} <span class="pos-badge">{{ w.partOfSpeech }}</span></span>
                  <span class="item-translation">{{ w.translation }}</span>
                  <span class="item-definition">{{ w.definition }}</span>
                </div>
                <div class="item-actions">
                  <template v-if="!isActed('word', w.senseId)">
                    <button class="btn-learn" @click="handleLearn('word', w.senseId)">Learn</button>
                    <button class="btn-know" @click="handleKnow('word', w.senseId)">Know</button>
                  </template>
                  <span v-else class="status-label" :class="getStatus('word', w.senseId) === 'learn' ? 'status-learn' : 'status-know'">
                    {{ getStatus('word', w.senseId) === 'learn' ? 'Added to SRS' : 'Marked known' }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="result.newCollocations.length > 0" class="section">
              <h3 class="section-title">New Collocations</h3>
              <div v-for="c in result.newCollocations" :key="c.collocationId" class="item-row">
                <div class="item-info">
                  <span class="item-main">{{ c.text }} <span class="type-badge">{{ c.type }}</span></span>
                  <span class="item-translation">{{ c.translation }}</span>
                </div>
                <div class="item-actions">
                  <template v-if="!isActed('collocation', c.collocationId)">
                    <button class="btn-learn" @click="handleLearn('collocation', c.collocationId)">Learn</button>
                    <button class="btn-know" @click="handleKnow('collocation', c.collocationId)">Know</button>
                  </template>
                  <span v-else class="status-label" :class="getStatus('collocation', c.collocationId) === 'learn' ? 'status-learn' : 'status-know'">
                    {{ getStatus('collocation', c.collocationId) === 'learn' ? 'Added to SRS' : 'Marked known' }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="result.newGrammarPatterns.length > 0" class="section">
              <h3 class="section-title">Grammar Patterns</h3>
              <div v-for="g in result.newGrammarPatterns" :key="g.grammarPatternId" class="item-row">
                <div class="item-info">
                  <span class="item-main">{{ g.pattern }}</span>
                  <span class="item-definition">{{ g.description }}</span>
                </div>
                <div class="item-actions">
                  <template v-if="!isActed('grammar', g.grammarPatternId)">
                    <button class="btn-learn" @click="handleLearn('grammar', g.grammarPatternId)">Learn</button>
                    <button class="btn-know" @click="handleKnow('grammar', g.grammarPatternId)">Know</button>
                  </template>
                  <span v-else class="status-label" :class="getStatus('grammar', g.grammarPatternId) === 'learn' ? 'status-learn' : 'status-know'">
                    {{ getStatus('grammar', g.grammarPatternId) === 'learn' ? 'Added to SRS' : 'Marked known' }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="empty-message">
            Nothing new in this sentence
          </div>

          <div v-if="existingSummaryParts.length > 0" class="existing-summary">
            {{ existingSummaryParts.join(', ') }} already in your vocabulary
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: var(--bg, #ffffff);
  color: var(--text, #1e293b);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  max-width: 560px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

.sentence-text {
  margin: 0;
  font-size: 14px;
  opacity: 0.6;
  line-height: 1.5;
  flex: 1;
  font-family: Georgia, 'Times New Roman', serif;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text, #1e293b);
  opacity: 0.5;
  padding: 0 0 0 12px;
  line-height: 1;
}

.close-btn:hover {
  opacity: 1;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  font-size: 14px;
  opacity: 0.6;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border, #e2e8f0);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-body {
  padding: 16px 20px 20px;
}

.translation-box {
  background: var(--sentence-hover, #f1f5f9);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.5;
  margin-bottom: 16px;
  font-style: italic;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin: 0 0 8px;
  font-weight: 600;
}

.item-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

.item-row:last-child {
  border-bottom: none;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.item-main {
  font-size: 15px;
  font-weight: 500;
}

.pos-badge,
.type-badge {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.5;
  text-transform: uppercase;
  margin-left: 4px;
}

.item-translation {
  font-size: 13px;
  opacity: 0.7;
}

.item-definition {
  font-size: 12px;
  opacity: 0.5;
  line-height: 1.4;
}

.item-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.btn-learn,
.btn-know {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
}

.btn-learn {
  background: #2563eb;
  color: #fff;
}

.btn-learn:hover {
  background: #1d4ed8;
}

.btn-know {
  background: transparent;
  color: var(--text, #1e293b);
  border-color: var(--border, #e2e8f0);
}

.btn-know:hover {
  background: var(--sentence-hover, #f1f5f9);
}

.status-label {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.status-learn {
  background: var(--word-learning-bg, #fef3c7);
  color: var(--word-learning-color, #92400e);
}

.status-know {
  opacity: 0.5;
}

.empty-message {
  text-align: center;
  padding: 20px;
  font-size: 14px;
  opacity: 0.6;
}

.existing-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e2e8f0);
  font-size: 13px;
  opacity: 0.5;
  text-align: center;
}
</style>
