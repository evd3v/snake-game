<script setup lang="ts">
import { onMounted } from 'vue'
import { useCollocationsStore } from '@/stores/collocations'

const store = useCollocationsStore()

onMounted(() => {
  store.fetchItems()
})
</script>

<template>
  <div class="collocations-page">
    <h1>Collocations</h1>
    <p v-if="store.loading">Loading...</p>
  </div>
</template>
