import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { apiGet, apiPost } from '@/api/client'
import type {
  VocabWord,
  VocabFilters,
  VocabularyListResponse,
  WordDetailResponse,
} from '@/types/api'

export const useVocabularyStore = defineStore('vocabulary', () => {
  const items = ref<VocabWord[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(50)
  const loading = ref(false)
  const detailLoading = ref(false)
  const selectedWord = ref<WordDetailResponse | null>(null)
  const error = ref<string | null>(null)

  const filters = reactive<VocabFilters>({
    search: '',
    familiarity: '',
    cefrLevel: '',
    cluster: '',
    srsState: '',
    sortBy: 'lemma',
    sortOrder: 'asc',
  })

  async function fetchWords() {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      params.set('page', String(page.value))
      params.set('limit', String(limit.value))
      if (filters.search) params.set('search', filters.search)
      if (filters.familiarity) params.set('familiarity', filters.familiarity)
      if (filters.cefrLevel) params.set('cefrLevel', filters.cefrLevel)
      if (filters.cluster) params.set('cluster', filters.cluster)
      if (filters.srsState) params.set('srsState', filters.srsState)
      params.set('sortBy', filters.sortBy)
      params.set('sortOrder', filters.sortOrder)

      const data = await apiGet<VocabularyListResponse>(`/vocabulary?${params.toString()}`)
      items.value = data.items
      total.value = data.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load vocabulary'
    } finally {
      loading.value = false
    }
  }

  async function fetchWordDetail(wordId: number) {
    detailLoading.value = true
    try {
      selectedWord.value = await apiGet<WordDetailResponse>(`/vocabulary/${wordId}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load word details'
    } finally {
      detailLoading.value = false
    }
  }

  async function markKnown(wordId: number) {
    await apiPost<{ success: boolean }>(`/vocabulary/${wordId}/mark-known`)
    // Update item in list optimistically
    const item = items.value.find((w) => w.id === wordId)
    if (item) {
      item.hasCard = false
      item.srsState = null
    }
    // Refresh detail if open
    if (selectedWord.value?.id === wordId) {
      await fetchWordDetail(wordId)
    }
  }

  async function resetWord(wordId: number) {
    await apiPost<{ success: boolean; created: number }>(`/vocabulary/${wordId}/reset`)
    // Update item in list
    const item = items.value.find((w) => w.id === wordId)
    if (item) {
      item.hasCard = true
      item.srsState = 'new'
    }
    // Refresh detail if open
    if (selectedWord.value?.id === wordId) {
      await fetchWordDetail(wordId)
    }
  }

  function setPage(n: number) {
    page.value = n
    fetchWords()
  }

  function updateFilters(partial: Partial<VocabFilters>) {
    Object.assign(filters, partial)
    page.value = 1
    fetchWords()
  }

  function clearFilters() {
    Object.assign(filters, {
      search: '',
      familiarity: '',
      cefrLevel: '',
      cluster: '',
      srsState: '',
      sortBy: 'lemma',
      sortOrder: 'asc',
    })
    page.value = 1
    fetchWords()
  }

  function closeDetail() {
    selectedWord.value = null
  }

  return {
    items,
    total,
    page,
    limit,
    loading,
    detailLoading,
    selectedWord,
    error,
    filters,
    fetchWords,
    fetchWordDetail,
    markKnown,
    resetWord,
    setPage,
    updateFilters,
    clearFilters,
    closeDetail,
  }
})
