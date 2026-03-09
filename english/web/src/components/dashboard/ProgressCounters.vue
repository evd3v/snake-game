<script setup lang="ts">
import { computed } from 'vue'
import type { ProgressStats } from '@/types/api'

const props = defineProps<{ stats: ProgressStats }>()

const wordsTotal = computed(() => props.stats.words.new + props.stats.words.learning + props.stats.words.known)
const grammarTotal = computed(() => props.stats.grammar.new + props.stats.grammar.learning + props.stats.grammar.known)
</script>

<template>
  <div class="progress-counters">
    <div class="group">
      <h3 class="group-title">Words</h3>
      <div class="counters">
        <div class="counter counter--new">
          <span class="counter__count">{{ stats.words.new }}</span>
          <span class="counter__label">New</span>
        </div>
        <div class="counter counter--learning">
          <span class="counter__count">{{ stats.words.learning }}</span>
          <span class="counter__label">Learning</span>
        </div>
        <div class="counter counter--known">
          <span class="counter__count">{{ stats.words.known }}</span>
          <span class="counter__label">Known</span>
        </div>
      </div>
      <div class="group-total">Total: {{ wordsTotal }}</div>
    </div>

    <div class="group">
      <h3 class="group-title">Grammar</h3>
      <div class="counters">
        <div class="counter counter--new">
          <span class="counter__count">{{ stats.grammar.new }}</span>
          <span class="counter__label">New</span>
        </div>
        <div class="counter counter--learning">
          <span class="counter__count">{{ stats.grammar.learning }}</span>
          <span class="counter__label">Learning</span>
        </div>
        <div class="counter counter--known">
          <span class="counter__count">{{ stats.grammar.known }}</span>
          <span class="counter__label">Known</span>
        </div>
      </div>
      <div class="group-total">Total: {{ grammarTotal }}</div>
    </div>
  </div>
</template>

<style scoped>
.progress-counters {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.group {
  flex: 1;
  min-width: 240px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.group-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
}

.counters {
  display: flex;
  gap: 12px;
}

.counter {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  border-radius: 6px;
}

.counter--new {
  background: #eff6ff;
  color: #2563eb;
}

.counter--learning {
  background: #fffbeb;
  color: #d97706;
}

.counter--known {
  background: #f0fdf4;
  color: #16a34a;
}

.counter__count {
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.counter__label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-total {
  margin-top: 12px;
  text-align: right;
  font-size: 13px;
  color: #64748b;
}
</style>
