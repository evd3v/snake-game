<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [text: string]
}>()

const text = ref('')

function handleSubmit() {
  const trimmed = text.value.trim()
  if (trimmed) {
    emit('submit', trimmed)
  }
}
</script>

<template>
  <form class="sentence-form" @submit.prevent="handleSubmit">
    <label for="sentence-input" class="form-label">Enter an English sentence</label>
    <textarea
      id="sentence-input"
      v-model="text"
      class="form-textarea"
      placeholder="Enter an English sentence from your book..."
      rows="3"
      :disabled="disabled"
    />
    <div class="form-footer">
      <span class="char-count">{{ text.length }} characters</span>
      <button
        type="submit"
        class="submit-btn"
        :disabled="!text.trim() || disabled"
      >
        Analyze
      </button>
    </div>
  </form>
</template>

<style scoped>
.sentence-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 600;
  font-size: 0.95rem;
  color: #374151;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.form-textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-textarea:disabled {
  background: #f9fafb;
  color: #9ca3af;
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-count {
  font-size: 0.8rem;
  color: #9ca3af;
}

.submit-btn {
  padding: 0.6rem 1.5rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.submit-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.submit-btn:disabled {
  background: #c7d2fe;
  cursor: not-allowed;
}
</style>
