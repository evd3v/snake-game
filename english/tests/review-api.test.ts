// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sql, eq } from 'drizzle-orm';
import { sentences } from '../src/db/schema/sentences.ts';
import { words, sentenceWords } from '../src/db/schema/words.ts';
import { srsCards } from '../src/db/schema/srs-cards.ts';
import { grammarPatterns, sentenceGrammarPatterns } from '../src/db/schema/grammar-patterns.ts';
import { grammarExercises } from '../src/db/schema/grammar-exercises.ts';
import { reviewLogs } from '../src/db/schema/review-logs.ts';
import { collocations, sentenceCollocations } from '../src/db/schema/collocations.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

async function cleanAll() {
  await app.db.delete(reviewLogs).where(sql`1=1`);
  await app.db.delete(grammarExercises).where(sql`1=1`);
  await app.db.delete(srsCards).where(sql`1=1`);
  await app.db.delete(sentenceWords).where(sql`1=1`);
  await app.db.delete(sentenceGrammarPatterns).where(sql`1=1`);
  await app.db.delete(sentenceCollocations).where(sql`1=1`);
  await app.db.delete(words).where(sql`1=1`);
  await app.db.delete(collocations).where(sql`1=1`);
  await app.db.delete(grammarPatterns).where(sql`1=1`);
  await app.db.delete(sentences).where(sql`1=1`);
}

afterEach(async () => {
  await cleanAll();
});

describe('GET /review/due', () => {
  it('returns due vocabulary cards with word data and sentence context', async () => {
    // Seed: sentence, word, sentenceWords junction, srsCard due in the past
    const [sentence] = await app.db.insert(sentences).values({
      text: 'The cat sat on the mat.',
      translation: 'Кот сидел на коврике.',
      cefrLevel: 'A1',
    }).returning();

    const [word] = await app.db.insert(words).values({
      lemma: 'cat_review_test',
      translation: 'кот',
      cefrLevel: 'A1',
    }).returning();

    await app.db.insert(sentenceWords).values({
      sentenceId: sentence.id,
      wordId: word.id,
      position: 0,
    });

    await app.db.insert(srsCards).values({
      cardType: 'vocabulary',
      wordId: word.id,
      state: 'new',
      due: new Date(Date.now() - 60000), // due in the past
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/review/due',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.length).toBeGreaterThanOrEqual(1);

    const vocabCard = body.find((c: any) => c.cardType === 'vocabulary' && c.word?.lemma === 'cat_review_test');
    expect(vocabCard).toBeDefined();
    expect(vocabCard.word).toMatchObject({
      lemma: 'cat_review_test',
      translation: 'кот',
      cefrLevel: 'A1',
    });
    expect(vocabCard.sentence).toBe('The cat sat on the mat.');
  });

  it('returns empty array when no cards are due', async () => {
    // Seed a card with future due date
    await app.db.insert(srsCards).values({
      cardType: 'vocabulary',
      wordId: null,
      state: 'new',
      due: new Date(Date.now() + 86400000), // due tomorrow
      stability: 0,
      difficulty: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/review/due',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('respects limit query parameter', async () => {
    // Insert 3 due cards
    for (let i = 0; i < 3; i++) {
      const [w] = await app.db.insert(words).values({
        lemma: `limit_test_${i}_${Date.now()}`,
      }).returning();
      await app.db.insert(srsCards).values({
        cardType: 'vocabulary',
        wordId: w.id,
        state: 'new',
        due: new Date(Date.now() - 60000),
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/review/due?limit=2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it('returns grammar card with unused cloze exercise', async () => {
    const [pattern] = await app.db.insert(grammarPatterns).values({
      pattern: 'would have + V3',
      description: 'Third conditional',
      cefrLevel: 'B2',
    }).returning();

    await app.db.insert(srsCards).values({
      cardType: 'grammar',
      grammarPatternId: pattern.id,
      state: 'new',
      due: new Date(Date.now() - 60000),
    });

    await app.db.insert(grammarExercises).values({
      grammarPatternId: pattern.id,
      sentence: 'I ___ gone if I had known.',
      clozeAnswer: 'would have',
      difficultyLevel: 1,
      hint: 'third conditional',
      used: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/review/due',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const grammarCard = body.find((c: any) => c.cardType === 'grammar');
    expect(grammarCard).toBeDefined();
    expect(grammarCard.pattern).toMatchObject({
      pattern: 'would have + V3',
      description: 'Third conditional',
    });
    expect(grammarCard.exercise).toMatchObject({
      sentence: 'I ___ gone if I had known.',
      answer: 'would have',
      hint: 'third conditional',
      difficultyLevel: 1,
    });
  });
});

describe('POST /review/:cardId/rate', () => {
  it('updates card scheduling and returns next due date', async () => {
    const [card] = await app.db.insert(srsCards).values({
      cardType: 'vocabulary',
      wordId: null,
      state: 'new',
      due: new Date(Date.now() - 60000),
    }).returning();

    const response = await app.inject({
      method: 'POST',
      url: `/review/${card.id}/rate`,
      payload: { rating: 3 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.nextDue).toBeDefined();
  });

  it('returns 400 for invalid rating', async () => {
    const [card] = await app.db.insert(srsCards).values({
      cardType: 'vocabulary',
      wordId: null,
      state: 'new',
      due: new Date(Date.now() - 60000),
    }).returning();

    const response = await app.inject({
      method: 'POST',
      url: `/review/${card.id}/rate`,
      payload: { rating: 5 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for non-existent card', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/review/999999/rate',
      payload: { rating: 3 },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /words/:wordId/srs-card', () => {
  it('creates an SRS card for a vocabulary word', async () => {
    const [word] = await app.db.insert(words).values({
      lemma: `srs_create_${Date.now()}`,
      translation: 'test',
    }).returning();

    const response = await app.inject({
      method: 'POST',
      url: `/words/${word.id}/srs-card`,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.cardType).toBe('vocabulary');
    expect(body.wordId).toBe(word.id);
    expect(body.state).toBe('new');
  });

  it('is idempotent (second call returns 201 without error)', async () => {
    const [word] = await app.db.insert(words).values({
      lemma: `srs_idempotent_${Date.now()}`,
      translation: 'test',
    }).returning();

    await app.inject({
      method: 'POST',
      url: `/words/${word.id}/srs-card`,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/words/${word.id}/srs-card`,
    });

    expect(response.statusCode).toBe(201);
  });
});
