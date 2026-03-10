import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { apiGet } from '@/api/client'
import type {
  GrammarPatternItem,
  GrammarFilters,
  GrammarListResponse,
} from '@/types/api'

export const useGrammarStore = defineStore('grammar', () => {
  const items = ref<GrammarPatternItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(50)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = reactive<GrammarFilters>({
    search: '',
    cefrLevel: '',
    srsState: '',
  })

  async function fetchItems() {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      params.set('page', String(page.value))
      params.set('limit', String(limit.value))
      if (filters.search) params.set('search', filters.search)
      if (filters.cefrLevel) params.set('cefrLevel', filters.cefrLevel)
      if (filters.srsState) params.set('srsState', filters.srsState)

      const data = await apiGet<GrammarListResponse>(`/grammar?${params.toString()}`)
      items.value = data.items
      total.value = data.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load grammar patterns'
    } finally {
      loading.value = false
    }
  }

  function setPage(n: number) {
    page.value = n
    fetchItems()
  }

  function updateFilters(partial: Partial<GrammarFilters>) {
    Object.assign(filters, partial)
    page.value = 1
    fetchItems()
  }

  function clearFilters() {
    Object.assign(filters, {
      search: '',
      cefrLevel: '',
      srsState: '',
    })
    page.value = 1
    fetchItems()
  }

  return {
    items,
    total,
    page,
    limit,
    loading,
    error,
    filters,
    fetchItems,
    setPage,
    updateFilters,
    clearFilters,
  }
})
