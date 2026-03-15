<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiGet, apiPost, apiPut } from '@/api/client'
import AnalysisModal from '@/components/reader/AnalysisModal.vue'
import PageReport from '@/components/reader/PageReport.vue'

interface Highlight {
  word: string
  offset: number
  length: number
  status: 'new' | 'learning' | 'known' | null
  lemma?: string
  senseId?: number
}

interface Sentence {
  id: number
  text: string
  highlights: Highlight[]
}

interface PageResponse {
  bookId: number
  pageNumber: number
  totalPages: number
  savedPosition: number | null
  sentences: Sentence[]
}

interface ReaderAnalysisResult {
  translation: string
  cefrLevel: string
  newWords: Array<{ senseId: number; lemma: string; partOfSpeech: string; translation: string; definition: string; cefrLevel: string }>
  newCollocations: Array<{ collocationId: number; text: string; translation: string; type: string; cefrLevel: string }>
  newGrammarPatterns: Array<{ grammarPatternId: number; pattern: string; description: string; cefrLevel: string }>
  existingWordsCount: number
  existingCollocationsCount: number
  existingGrammarPatternsCount: number
}

interface AnalyzeResponse {
  status: 'completed' | 'queued'
  result?: ReaderAnalysisResult
  jobId?: string
}

interface StatusResponse {
  status: 'completed' | 'failed' | 'waiting' | 'active'
  result?: ReaderAnalysisResult
  error?: string
}

const route = useRoute()
const bookId = Number(route.params.bookId)

const currentPage = ref(0)
const pageData = ref<PageResponse | null>(null)
const openedSentences = ref(new Set<number>())
const darkTheme = ref(localStorage.getItem('reader-theme') === 'dark')
const loading = ref(false)

// Analysis modal state
const analyzingId = ref<number | null>(null)
const modalVisible = ref(false)
const modalLoading = ref(false)
const modalResult = ref<ReaderAnalysisResult | null>(null)
const modalSentenceText = ref('')
const modalError = ref(false)

// Page report state
const pageStats = ref({ wordsLearned: 0, wordsKnown: 0, grammarPatternsFound: 0, collocationsLearned: 0 })
const showReport = ref(false)

const allSentencesOpened = computed(() => {
  if (!pageData.value) return false
  return openedSentences.value.size >= pageData.value.sentences.length
})

async function loadPage(page: number) {
  loading.value = true
  try {
    const data = await apiGet<PageResponse>(`/books/${bookId}/page/${page}`)
    pageData.value = data
    currentPage.value = page
    openedSentences.value = new Set<number>()

    // Save reading position
    await apiPut(`/books/${bookId}/position`, { pageNumber: page })
  } finally {
    loading.value = false
  }
}

async function openSentence(id: number) {
  openedSentences.value.add(id)
  openedSentences.value = new Set(openedSentences.value)

  // Prevent double-tap
  if (analyzingId.value === id) return

  const sentence = pageData.value?.sentences.find(s => s.id === id)
  if (!sentence) return

  modalSentenceText.value = sentence.text
  analyzingId.value = id
  modalVisible.value = true
  modalLoading.value = true
  modalResult.value = null
  modalError.value = false

  try {
    const response = await apiPost<AnalyzeResponse>(`/books/sentences/${id}/analyze`)

    if (response.status === 'completed' && response.result) {
      modalResult.value = response.result
      modalLoading.value = false
    } else if (response.status === 'queued' && response.jobId) {
      await pollForResult(id, response.jobId)
    }
  } catch {
    modalLoading.value = false
    modalError.value = true
  } finally {
    analyzingId.value = null
  }
}

async function pollForResult(sentenceId: number, jobId: string) {
  const maxAttempts = 40 // 60 seconds max
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1500))

    // If modal was closed, stop polling
    if (!modalVisible.value) return

    try {
      const status = await apiGet<StatusResponse>(`/books/sentences/${sentenceId}/analyze/status/${jobId}`)

      if (status.status === 'completed' && status.result) {
        modalResult.value = status.result
        modalLoading.value = false
        return
      }

      if (status.status === 'failed') {
        modalLoading.value = false
        modalError.value = true
        return
      }
    } catch {
      modalLoading.value = false
      modalError.value = true
      return
    }
  }

  // Timeout
  modalLoading.value = false
  modalError.value = true
}

function typeToUrlSegment(type: 'word' | 'collocation' | 'grammar'): string {
  if (type === 'word') return 'words'
  if (type === 'collocation') return 'collocations'
  return 'grammar'
}

async function handleLearn(type: 'word' | 'collocation' | 'grammar', id: number) {
  const segment = typeToUrlSegment(type)
  try {
    await apiPost(`/reader/${segment}/${id}/learn`)
  } catch {
    // Silently fail -- button already shows status
  }

  if (type === 'word') {
    pageStats.value.wordsLearned++
    updateHighlightStatus(id, 'learning')
  } else if (type === 'collocation') {
    pageStats.value.collocationsLearned++
  } else {
    pageStats.value.grammarPatternsFound++
  }
}

async function handleKnow(type: 'word' | 'collocation' | 'grammar', id: number) {
  const segment = typeToUrlSegment(type)
  try {
    await apiPost(`/reader/${segment}/${id}/know`)
  } catch {
    // Silently fail
  }

  if (type === 'word') {
    pageStats.value.wordsKnown++
    updateHighlightStatus(id, 'known')
  }
}

function updateHighlightStatus(senseId: number, status: 'learning' | 'known') {
  if (!pageData.value) return
  for (const sentence of pageData.value.sentences) {
    for (const h of sentence.highlights) {
      if (h.senseId === senseId) {
        h.status = status === 'known' ? null : status
      }
    }
  }
}

function closeModal() {
  modalVisible.value = false
  modalResult.value = null
  modalError.value = false
  analyzingId.value = null
}

let reportResolve: (() => void) | null = null

async function goNext() {
  if (!allSentencesOpened.value || !pageData.value || currentPage.value >= pageData.value.totalPages - 1) return

  const hasStats = pageStats.value.wordsLearned > 0 ||
    pageStats.value.wordsKnown > 0 ||
    pageStats.value.grammarPatternsFound > 0 ||
    pageStats.value.collocationsLearned > 0

  if (hasStats) {
    showReport.value = true
    await new Promise<void>(resolve => {
      reportResolve = resolve
    })
    pageStats.value = { wordsLearned: 0, wordsKnown: 0, grammarPatternsFound: 0, collocationsLearned: 0 }
    showReport.value = false
  }

  loadPage(currentPage.value + 1)
}

function handleReportDismiss() {
  if (reportResolve) {
    reportResolve()
    reportResolve = null
  }
}

function goPrev() {
  if (currentPage.value > 0) {
    loadPage(currentPage.value - 1)
  }
}

function toggleTheme() {
  darkTheme.value = !darkTheme.value
  localStorage.setItem('reader-theme', darkTheme.value ? 'dark' : 'light')
}

function highlightClass(status: Highlight['status']): string {
  if (status === 'new') return 'word-new'
  if (status === 'learning') return 'word-learning'
  return ''
}

onMounted(async () => {
  // Load page 0 first to get savedPosition
  const initial = await apiGet<PageResponse>(`/books/${bookId}/page/0`)
  const startPage = initial.savedPosition ?? 0
  if (startPage === 0) {
    pageData.value = initial
    currentPage.value = 0
    openedSentences.value = new Set<number>()
  } else {
    await loadPage(startPage)
  }
})
</script>

<template>
  <div class="reader" :class="{ dark: darkTheme }">
    <header class="reader-header">
      <router-link to="/library" class="back-btn">Back</router-link>
      <span v-if="pageData" class="page-indicator">
        Page {{ currentPage + 1 }} / {{ pageData.totalPages }}
      </span>
      <button class="theme-btn" @click="toggleTheme">
        {{ darkTheme ? 'Light' : 'Dark' }}
      </button>
    </header>

    <main v-if="loading && !pageData" class="reader-loading">
      Loading...
    </main>

    <main v-else-if="pageData" class="reader-content">
      <div
        v-for="sentence in pageData.sentences"
        :key="sentence.id"
        class="sentence"
        :class="{ opened: openedSentences.has(sentence.id) }"
        @click="openSentence(sentence.id)"
      >
        <span
          v-for="(token, i) in sentence.highlights"
          :key="i"
          :class="highlightClass(token.status)"
        >{{ token.word }}</span>
      </div>
    </main>

    <footer v-if="pageData" class="reader-nav">
      <button
        class="nav-btn"
        :disabled="currentPage === 0"
        @click="goPrev"
      >
        Previous
      </button>
      <button
        class="nav-btn nav-btn-primary"
        :disabled="!allSentencesOpened || currentPage >= pageData.totalPages - 1"
        @click="goNext"
      >
        Next
      </button>
    </footer>

    <AnalysisModal
      :visible="modalVisible"
      :loading="modalLoading"
      :result="modalResult"
      :sentence-text="modalSentenceText"
      @close="closeModal"
      @learn="handleLearn"
      @know="handleKnow"
    />

    <PageReport
      :visible="showReport"
      :stats="pageStats"
      @dismiss="handleReportDismiss"
    />
  </div>
</template>

<style scoped>
.reader {
  --bg: #ffffff;
  --text: #1e293b;
  --header-bg: #f8fafc;
  --border: #e2e8f0;
  --word-new-bg: #dbeafe;
  --word-new-color: #1e40af;
  --word-learning-bg: #fef3c7;
  --word-learning-color: #92400e;
  --sentence-hover: #f1f5f9;
  --sentence-opened-border: #2563eb;
  --nav-bg: #f8fafc;

  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: Georgia, 'Times New Roman', serif;
}

.reader.dark {
  --bg: #1a1a2e;
  --text: #e2e8f0;
  --header-bg: #16213e;
  --border: #334155;
  --word-new-bg: #1e3a5f;
  --word-new-color: #93c5fd;
  --word-learning-bg: #3d2e0a;
  --word-learning-color: #fcd34d;
  --sentence-hover: #1e293b;
  --sentence-opened-border: #3b82f6;
  --nav-bg: #16213e;
}

.reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.back-btn {
  color: #2563eb;
  text-decoration: none;
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.back-btn:hover {
  text-decoration: underline;
}

.page-indicator {
  font-size: 14px;
  color: var(--text);
  opacity: 0.7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.theme-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.theme-btn:hover {
  background: var(--sentence-hover);
}

.reader-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  opacity: 0.6;
}

.reader-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px 100px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.sentence {
  font-size: 18px;
  line-height: 1.8;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-left: 3px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.sentence:hover {
  background: var(--sentence-hover);
}

.sentence.opened {
  border-left-color: var(--sentence-opened-border);
  opacity: 0.85;
}

.word-new {
  background: var(--word-new-bg);
  color: var(--word-new-color);
  border-radius: 3px;
  padding: 1px 2px;
}

.word-learning {
  background: var(--word-learning-bg);
  color: var(--word-learning-color);
  border-radius: 3px;
  padding: 1px 2px;
}

.reader-nav {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--nav-bg);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.nav-btn {
  padding: 10px 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 15px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  transition: background 0.15s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--sentence-hover);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-btn-primary {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.nav-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.nav-btn-primary:disabled {
  background: #93c5fd;
  border-color: #93c5fd;
}

@media (max-width: 640px) {
  .reader-content {
    padding: 20px 16px 100px;
  }

  .sentence {
    font-size: 16px;
  }

  .nav-btn {
    padding: 10px 20px;
    font-size: 14px;
  }
}
</style>
