// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sql } from 'drizzle-orm';
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

describe('GET /review/due - grammar cards with exampleSentence', () => {
  it('returns grammar card with exampleSentence from linked sentence', async () => {
    const [sentence] = await app.db.insert(sentences).values({
      text: 'If I had known, I would have stayed.',
      translation: 'Если бы я знал, я бы остался.',
      cefrLevel: 'B2',
    }).returning();

    const [pattern] = await app.db.insert(grammarPatterns).values({
      pattern: 'third conditional',
      description: 'Hypothetical past situations',
      cefrLevel: 'B2',
    }).returning();

    await app.db.insert(sentenceGrammarPatterns).values({
      sentenceId: sentence.id,
      grammarPatternId: pattern.id,
    });

    await app.db.insert(srsCards).values({
      cardType: 'grammar',
      grammarPatternId: pattern.id,
      state: 'new',
      due: new Date(Date.now() - 60000),
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
      pattern: 'third conditional',
      description: 'Hypothetical past situations',
    });
    expect(grammarCard.exampleSentence).toBe('If I had known, I would have stayed.');
  });

  it('returns grammar card without exampleSentence when no sentence linked', async () => {
    const [pattern] = await app.db.insert(grammarPatterns).values({
      pattern: 'passive voice',
      description: 'Subject receives action',
      cefrLevel: 'A2',
    }).returning();

    await app.db.insert(srsCards).values({
      cardType: 'grammar',
      grammarPatternId: pattern.id,
      state: 'new',
      due: new Date(Date.now() - 60000),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/review/due',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const grammarCard = body.find((c: any) => c.cardType === 'grammar');
    expect(grammarCard).toBeDefined();
    expect(grammarCard.exampleSentence).toBeUndefined();
  });
});
