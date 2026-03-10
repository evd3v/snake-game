<script setup lang="ts">
withDefaults(defineProps<{
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  rate: [rating: number]
}>()

const buttons = [
  { rating: 1, label: 'Again', key: '1', color: '#ef4444' },
  { rating: 2, label: 'Hard', key: '2', color: '#f97316' },
  { rating: 3, label: 'Good', key: '3', color: '#22c55e' },
  { rating: 4, label: 'Easy', key: '4', color: '#2563eb' },
]
</script>

<template>
  <div class="rating-buttons">
    <button
      v-for="btn in buttons"
      :key="btn.rating"
      class="rating-btn"
      :style="{ '--btn-color': btn.color }"
      :disabled="disabled"
      @click="emit('rate', btn.rating)"
    >
      {{ btn.label }} <span class="key-hint">[{{ btn.key }}]</span>
    </button>
  </div>
</template>

<style scoped>
.rating-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.rating-btn {
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: var(--btn-color);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s;
}

.rating-btn:hover:not(:disabled) {
  filter: brightness(0.9);
}

.rating-btn:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.key-hint {
  font-weight: 400;
  font-size: 12px;
  opacity: 0.8;
}
</style>
