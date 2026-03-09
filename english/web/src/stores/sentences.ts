import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiGet, apiPost, apiPatch } from '../api/client'

export interface AnalysisResult {
  sentenceId: number
  translation: string
  cefrLevel: string
  grammarPatterns: Array<{ pattern: string; description: string }>
  words: number
  collocations?: Array<{ text: string; translation: string }>
}

export interface ExtractedWord {
  id: number
  lemma: string
  translation: string
  cefrLevel: string
  familiarity: string
  thematicCluster: string
  srsCardCreated?: boolean
}

interface JobStatusResponse {
  status: 'completed' | 'failed' | 'waiting' | 'active'
  result?: AnalysisResult
  error?: string
}

const POLL_INTERVAL = 1500

export const useSentenceStore = defineStore('sentences', () => {
  const text = ref('')
  const loading = ref(false)
  const polling = ref(false)
  const error = ref<string | null>(null)
  const result = ref<AnalysisResult | null>(null)
  const words = ref<ExtractedWord[]>([])
  const sentenceId = ref<number | null>(null)

  let abortController: AbortController | null = null

  async function analyze(inputText: string) {
    // Cancel any existing polling
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    const signal = abortController.signal

    text.value = inputText
    loading.value = true
    polling.value = true
    error.value = null
    result.value = null
    words.value = []
    sentenceId.value = null

    try {
      const { jobId } = await apiPost<{ jobId: string }>('/sentences', { text: inputText })

      // Poll for completion
      while (!signal.aborted) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, POLL_INTERVAL)
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
          }, { once: true })
        })

        if (signal.aborted) break

        const status = await apiGet<JobStatusResponse>(`/sentences/${jobId}/status`)

        if (status.status === 'completed' && status.result) {
          result.value = status.result
          sentenceId.value = status.result.sentenceId

          // Fetch extracted words
          const fetchedWords = await apiGet<ExtractedWord[]>(
            `/sentences/${status.result.sentenceId}/words`,
          )
          words.value = fetchedWords.map((w) => ({ ...w, srsCardCreated: false }))

          loading.value = false
          polling.value = false
          return
        }

        if (status.status === 'failed') {
          error.value = status.error ?? 'Analysis failed'
          loading.value = false
          polling.value = false
          return
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      error.value = err instanceof Error ? err.message : 'An error occurred'
      loading.value = false
      polling.value = false
    }
  }

  async function setFamiliarity(wordId: number, familiarity: string) {
    await apiPatch<ExtractedWord>(`/words/${wordId}/familiarity`, { familiarity })
    const word = words.value.find((w) => w.id === wordId)
    if (word) {
      word.familiarity = familiarity
    }
  }

  async function createSrsCard(wordId: number) {
    await apiPost(`/words/${wordId}/srs-card`)
    const word = words.value.find((w) => w.id === wordId)
    if (word) {
      word.srsCardCreated = true
    }
  }

  function reset() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    text.value = ''
    loading.value = false
    polling.value = false
    error.value = null
    result.value = null
    words.value = []
    sentenceId.value = null
  }

  return {
    text,
    loading,
    polling,
    error,
    result,
    words,
    sentenceId,
    analyze,
    setFamiliarity,
    createSrsCard,
    reset,
  }
})
