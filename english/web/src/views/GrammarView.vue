<script setup lang="ts">
import { onMounted } from 'vue'
import { useGrammarStore } from '@/stores/grammar'

const store = useGrammarStore()

onMounted(() => {
  store.fetchItems()
})
</script>

<template>
  <div class="grammar-page">
    <h1>Grammar Patterns</h1>
    <p v-if="store.loading">Loading...</p>
  </div>
</template>
