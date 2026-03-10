// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sql, eq } from 'drizzle-orm';
import { sentences } from '../src/db/schema/sentences.ts';
import { words, sentenceWords } from '../src/db/schema/words.ts';
import { wordSenses } from '../src/db/schema/word-senses.ts';
import { srsCards } from '../src/db/schema/srs-cards.ts';
import { collocations, sentenceCollocations } from '../src/db/schema/collocations.ts';
import { grammarPatterns, sentenceGrammarPatterns } from '../src/db/schema/grammar-patterns.ts';
import { grammarExercises } from '../src/db/schema/grammar-exercises.ts';
import { reviewLogs } from '../src/db/schema/review-logs.ts';

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
  await app.db.delete(wordSenses).where(sql`1=1`);
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

describe('GET /review/due - collocation cards', () => {
  it('returns collocation cards with enriched data', async () => {
    // Seed: sentence, collocation, sentenceCollocations junction, srsCard due in past
    const [sentence] = await app.db.insert(sentences).values({
      text: 'She took into account all the factors.',
      translation: 'Она приняла во внимание все факторы.',
      cefrLevel: 'B1',
    }).returning();

    const [collocation] = await app.db.insert(collocations).values({
      text: 'take into account',
      translation: 'принимать во внимание',
      type: 'collocation',
      cefrLevel: 'B1',
    }).returning();

    await app.db.insert(sentenceCollocations).values({
      sentenceId: sentence.id,
      collocationId: collocation.id,
    });

    await app.db.insert(srsCards).values({
      cardType: 'collocation',
      collocationId: collocation.id,
      state: 'new',
      due: new Date(Date.now() - 60000),
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

    const collCard = body.find((c: any) => c.cardType === 'collocation');
    expect(collCard).toBeDefined();
    expect(collCard.collocation).toMatchObject({
      text: 'take into account',
      translation: 'принимать во внимание',
      type: 'collocation',
      cefrLevel: 'B1',
    });
    expect(collCard.sentence).toBe('She took into account all the factors.');
  });

  it('returns collocation card without sentence when no junction exists', async () => {
    const [collocation] = await app.db.insert(collocations).values({
      text: 'break the ice',
      translation: 'растопить лед',
      type: 'idiom',
      cefrLevel: 'B2',
    }).returning();

    await app.db.insert(srsCards).values({
      cardType: 'collocation',
      collocationId: collocation.id,
      state: 'new',
      due: new Date(Date.now() - 60000),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/review/due',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const collCard = body.find((c: any) => c.cardType === 'collocation');
    expect(collCard).toBeDefined();
    expect(collCard.collocation).toMatchObject({
      text: 'break the ice',
      type: 'idiom',
    });
    expect(collCard.sentence).toBeUndefined();
  });
});
