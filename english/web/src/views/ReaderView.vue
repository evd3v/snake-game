<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apiGet, apiPut } from '@/api/client'

interface Highlight {
  word: string
  offset: number
  length: number
  status: 'new' | 'learning' | 'known' | null
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

const route = useRoute()
const bookId = Number(route.params.bookId)

const currentPage = ref(0)
const pageData = ref<PageResponse | null>(null)
const openedSentences = ref(new Set<number>())
const darkTheme = ref(localStorage.getItem('reader-theme') === 'dark')
const loading = ref(false)

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

function openSentence(id: number) {
  openedSentences.value.add(id)
  // Trigger reactivity
  openedSentences.value = new Set(openedSentences.value)
}

function goNext() {
  if (allSentencesOpened.value && pageData.value && currentPage.value < pageData.value.totalPages - 1) {
    loadPage(currentPage.value + 1)
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
