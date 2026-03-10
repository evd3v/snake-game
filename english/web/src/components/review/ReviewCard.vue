<script setup lang="ts">
import type { DueCard } from '@/types/api'

defineProps<{
  card: DueCard
  revealed: boolean
}>()

const cefrColors: Record<string, string> = {
  A1: '#22c55e',
  A2: '#84cc16',
  B1: '#eab308',
  B2: '#f97316',
  C1: '#ef4444',
  C2: '#dc2626',
}
</script>

<template>
  <div class="review-card">
    <!-- Vocabulary card -->
    <template v-if="card.cardType === 'vocabulary'">
      <div class="card-front">
        <div class="lemma">{{ card.word?.lemma }}</div>
        <div class="badges">
          <span v-if="card.word?.partOfSpeech" class="badge pos-badge">{{ card.word.partOfSpeech }}</span>
          <span
            v-if="card.word?.cefrLevel"
            class="badge cefr-badge"
            :style="{ background: cefrColors[card.word.cefrLevel] || '#94a3b8' }"
          >{{ card.word.cefrLevel }}</span>
        </div>
        <p v-if="card.sentence" class="context-sentence">{{ card.sentence }}</p>
      </div>

      <template v-if="revealed">
        <div class="divider" />
        <div class="card-back">
          <p class="translation">{{ card.word?.translation || '---' }}</p>
        </div>
      </template>

      <p v-if="!revealed" class="reveal-hint">Press Space or Enter to reveal</p>
    </template>

    <!-- Grammar card -->
    <template v-else-if="card.cardType === 'grammar'">
      <template v-if="card.exercise">
        <div class="card-front">
          <p class="cloze-sentence">{{ card.exercise.sentence }}</p>
          <p v-if="card.exercise.hint" class="exercise-hint">{{ card.exercise.hint }}</p>
        </div>

        <template v-if="revealed">
          <div class="divider" />
          <div class="card-back">
            <p class="exercise-answer">{{ card.exercise.answer }}</p>
            <p v-if="card.pattern?.description" class="pattern-description">{{ card.pattern.description }}</p>
            <p v-if="card.exampleSentence" class="example-sentence">"{{ card.exampleSentence }}"</p>
          </div>
        </template>

        <p v-if="!revealed" class="reveal-hint">Press Space or Enter to reveal</p>
      </template>

      <template v-else>
        <div class="card-front">
          <div class="pattern-title">{{ card.pattern?.pattern }}</div>
          <p v-if="card.pattern?.description" class="pattern-description">{{ card.pattern.description }}</p>
          <p v-if="card.exampleSentence" class="example-sentence">"{{ card.exampleSentence }}"</p>
          <p class="no-exercise">No exercises available -- rate based on your knowledge of this pattern</p>
        </div>
      </template>
    </template>

    <!-- Collocation card -->
    <template v-else-if="card.cardType === 'collocation'">
      <div class="card-front">
        <div class="collocation-text">{{ card.collocation?.text }}</div>
        <div class="badges">
          <span v-if="card.collocation?.type" class="badge type-badge">{{ card.collocation.type.replace('_', ' ') }}</span>
          <span v-if="card.collocation?.cefrLevel" class="badge cefr-badge" :style="{ background: cefrColors[card.collocation.cefrLevel] || '#94a3b8' }">{{ card.collocation.cefrLevel }}</span>
        </div>
        <p v-if="card.sentence" class="context-sentence">{{ card.sentence }}</p>
      </div>
      <template v-if="revealed">
        <div class="divider" />
        <div class="card-back">
          <p class="translation">{{ card.collocation?.translation || '---' }}</p>
        </div>
      </template>
      <p v-if="!revealed" class="reveal-hint">Press Space or Enter to reveal</p>
    </template>
  </div>
</template>

<style scoped>
.review-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 32px;
  max-width: 600px;
  margin: 0 auto;
}

.card-front {
  text-align: center;
}

.lemma {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.badges {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.pos-badge {
  background: #94a3b8;
}

.context-sentence {
  font-size: 16px;
  font-style: italic;
  color: #475569;
  line-height: 1.6;
}

.divider {
  height: 1px;
  background: #e2e8f0;
  margin: 20px 0;
}

.card-back {
  text-align: center;
}

.translation {
  font-size: 22px;
  font-weight: 600;
  color: #1e293b;
}

.reveal-hint {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  margin-top: 20px;
}

.cloze-sentence {
  font-size: 18px;
  color: #1e293b;
  line-height: 1.6;
}

.exercise-hint {
  font-size: 14px;
  color: #94a3b8;
  margin-top: 8px;
}

.exercise-answer {
  font-size: 22px;
  font-weight: 700;
  color: #22c55e;
}

.pattern-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12px;
}

.no-exercise {
  font-size: 14px;
  color: #94a3b8;
}

.collocation-text {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.type-badge {
  background: #8b5cf6;
}

.pattern-description {
  font-size: 14px;
  color: #64748b;
  margin-top: 8px;
}

.example-sentence {
  font-size: 15px;
  font-style: italic;
  color: #64748b;
  margin-top: 8px;
}
</style>
