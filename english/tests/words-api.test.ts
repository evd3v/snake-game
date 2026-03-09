// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sentences } from '../src/db/schema/sentences.ts';
import { words, sentenceWords } from '../src/db/schema/words.ts';
import { eq } from 'drizzle-orm';

let app: FastifyInstance;
let sentenceId: number;
let wordIds: number[];

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

beforeEach(async () => {
  // Seed data: a sentence with linked words
  const [sentence] = await app.db
    .insert(sentences)
    .values({ text: 'The cat sat on the mat.' })
    .returning();
  sentenceId = sentence.id;

  const insertedWords = await app.db
    .insert(words)
    .values([
      { lemma: `cat_${sentenceId}`, translation: 'кот', cefrLevel: 'A1', familiarity: 'never_seen', thematicCluster: 'animals' },
      { lemma: `sit_${sentenceId}`, translation: 'сидеть', cefrLevel: 'A1', familiarity: 'never_seen', thematicCluster: 'actions' },
    ])
    .returning();
  wordIds = insertedWords.map((w) => w.id);

  await app.db.insert(sentenceWords).values([
    { sentenceId, wordId: wordIds[0], position: 1 },
    { sentenceId, wordId: wordIds[1], position: 2 },
  ]);
});

afterEach(async () => {
  // Clean up in correct order (junction first, then words, then sentences)
  if (sentenceId) {
    await app.db.delete(sentenceWords).where(eq(sentenceWords.sentenceId, sentenceId));
  }
  for (const wId of wordIds ?? []) {
    await app.db.delete(words).where(eq(words.id, wId));
  }
  if (sentenceId) {
    await app.db.delete(sentences).where(eq(sentences.id, sentenceId));
  }
});

describe('GET /sentences/:sentenceId/words', () => {
  it('returns words linked to a sentence', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/sentences/${sentenceId}/words`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      id: expect.any(Number),
      lemma: expect.any(String),
      translation: expect.any(String),
      cefrLevel: expect.any(String),
      familiarity: 'never_seen',
      thematicCluster: expect.any(String),
    });
    // Ordered by position
    expect(body[0].lemma).toContain('cat');
    expect(body[1].lemma).toContain('sit');
  });

  it('returns empty array for non-existent sentence', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/sentences/999999/words',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual([]);
  });
});

describe('PATCH /words/:id/familiarity', () => {
  it('updates familiarity and returns updated word', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/words/${wordIds[0]}/familiarity`,
      payload: { familiarity: 'seen_unsure' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(wordIds[0]);
    expect(body.familiarity).toBe('seen_unsure');
  });

  it('returns 404 for non-existent word', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/words/999999/familiarity',
      payload: { familiarity: 'seen_unsure' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 for invalid familiarity value', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/words/${wordIds[0]}/familiarity`,
      payload: { familiarity: 'invalid_value' },
    });

    expect(response.statusCode).toBe(400);
  });
});
