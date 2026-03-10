import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { apiGet } from '@/api/client'
import type {
  CollocationItem,
  CollocationFilters,
  CollocationListResponse,
} from '@/types/api'

export const useCollocationsStore = defineStore('collocations', () => {
  const items = ref<CollocationItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(50)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = reactive<CollocationFilters>({
    search: '',
    cefrLevel: '',
    type: '',
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
      if (filters.type) params.set('type', filters.type)

      const data = await apiGet<CollocationListResponse>(`/collocations?${params.toString()}`)
      items.value = data.items
      total.value = data.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load collocations'
    } finally {
      loading.value = false
    }
  }

  function setPage(n: number) {
    page.value = n
    fetchItems()
  }

  function updateFilters(partial: Partial<CollocationFilters>) {
    Object.assign(filters, partial)
    page.value = 1
    fetchItems()
  }

  function clearFilters() {
    Object.assign(filters, {
      search: '',
      cefrLevel: '',
      type: '',
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
