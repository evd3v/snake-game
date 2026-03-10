// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sentences } from '../src/db/schema/sentences.ts';
import { words, sentenceWords } from '../src/db/schema/words.ts';
import { wordSenses } from '../src/db/schema/word-senses.ts';
import { wordFamilies } from '../src/db/schema/word-families.ts';
import { srsCards } from '../src/db/schema/srs-cards.ts';
import { collocations, sentenceCollocations } from '../src/db/schema/collocations.ts';
import { eq, inArray, sql } from 'drizzle-orm';

let app: FastifyInstance;

// Seed IDs
let sentenceId: number;
let wordIds: number[];
let senseIds: number[];
let familyId: number;
let collocationId: number;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

beforeEach(async () => {
  // Create word family
  const [family] = await app.db
    .insert(wordFamilies)
    .values({ rootWord: 'run' })
    .returning();
  familyId = family.id;

  // Seed words: varying CEFR, clusters, some in same family
  const insertedWords = await app.db
    .insert(words)
    .values([
      { lemma: `cat_${Date.now()}`, cefrLevel: 'A1', thematicCluster: 'animals', wordFamilyId: familyId },
      { lemma: `run_${Date.now()}`, cefrLevel: 'B1', thematicCluster: 'actions', wordFamilyId: familyId },
      { lemma: `elaborate_${Date.now()}`, cefrLevel: 'B2', thematicCluster: 'actions' },
      { lemma: `dog_${Date.now()}`, cefrLevel: 'A1', thematicCluster: 'animals' },
    ])
    .returning();
  wordIds = insertedWords.map((w) => w.id);

  // Seed word senses - cat has 2 senses (noun + verb), others have 1
  const insertedSenses = await app.db
    .insert(wordSenses)
    .values([
      { wordId: wordIds[0], partOfSpeech: 'noun', translation: 'кот', familiarity: 'never_seen' },
      { wordId: wordIds[0], partOfSpeech: 'verb', translation: 'каталогизировать', familiarity: 'seen_unsure' },
      { wordId: wordIds[1], partOfSpeech: 'verb', translation: 'бежать', familiarity: 'understand_in_context' },
      { wordId: wordIds[2], partOfSpeech: 'adjective', translation: 'сложный', familiarity: 'never_seen' },
      { wordId: wordIds[3], partOfSpeech: 'noun', translation: 'собака', familiarity: 'seen_unsure' },
    ])
    .returning();
  senseIds = insertedSenses.map((s) => s.id);

  // SRS cards: cat-noun has a 'new' card, run-verb has a 'learning' card, others have none
  await app.db.insert(srsCards).values([
    { cardType: 'vocabulary', wordSenseId: senseIds[0], state: 'new' },
    { cardType: 'vocabulary', wordSenseId: senseIds[2], state: 'learning' },
  ]);

  // Sentence linked to cat and run
  const [sentence] = await app.db
    .insert(sentences)
    .values({ text: 'The cat runs fast.' })
    .returning();
  sentenceId = sentence.id;

  await app.db.insert(sentenceWords).values([
    { sentenceId, wordId: wordIds[0], position: 1 },
    { sentenceId, wordId: wordIds[1], position: 2 },
  ]);

  // Collocation linked to the sentence
  const [coll] = await app.db
    .insert(collocations)
    .values({ text: `run fast_${Date.now()}`, translation: 'бежать быстро', type: 'collocation', cefrLevel: 'B1' })
    .returning();
  collocationId = coll.id;

  await app.db.insert(sentenceCollocations).values([
    { sentenceId, collocationId: coll.id },
  ]);
});

afterEach(async () => {
  // Clean up in correct order
  await app.db.delete(srsCards).where(sql`1=1`);
  await app.db.delete(sentenceCollocations).where(sql`1=1`);
  await app.db.delete(sentenceWords).where(sql`1=1`);
  await app.db.delete(wordSenses).where(sql`1=1`);
  await app.db.delete(collocations).where(sql`1=1`);
  await app.db.delete(words).where(inArray(words.id, wordIds));
  await app.db.delete(sentences).where(sql`1=1`);
  await app.db.delete(wordFamilies).where(eq(wordFamilies.id, familyId));
});

describe('GET /vocabulary (list)', () => {
  it('returns paginated word list with total count', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(4);
  });

  it('search filters by lemma (case-insensitive)', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?search=cat' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.lemma.toLowerCase()).toContain('cat');
    }
  });

  it('filter by familiarity', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?familiarity=never_seen' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    // Each returned word should have at least one sense with never_seen
    for (const item of body.items) {
      const hasMatch = item.senses.some((s: { familiarity: string }) => s.familiarity === 'never_seen');
      expect(hasMatch).toBe(true);
    }
  });

  it('filter by CEFR level', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?cefrLevel=B1' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.cefrLevel).toBe('B1');
    }
  });

  it('filter by thematic cluster', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?cluster=animals' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.thematicCluster).toBe('animals');
    }
  });

  it('filter by SRS state (has card)', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?srsState=new' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.hasCard).toBe(true);
    }
  });

  it('filter by SRS state (no card)', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?srsState=none' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.hasCard).toBe(false);
    }
  });

  it('sort by alphabet asc', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?sortBy=lemma&sortOrder=asc' });
    const body = res.json();
    const lemmas = body.items.map((i: { lemma: string }) => i.lemma);
    const sorted = [...lemmas].sort((a: string, b: string) => a.localeCompare(b));
    expect(lemmas).toEqual(sorted);
  });

  it('sort by CEFR level', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?sortBy=cefr&sortOrder=asc' });
    const body = res.json();
    const cefrOrder: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
    const levels = body.items
      .filter((i: { cefrLevel: string | null }) => i.cefrLevel)
      .map((i: { cefrLevel: string }) => cefrOrder[i.cefrLevel] ?? 7);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it('sort by date added desc', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary?sortBy=date&sortOrder=desc' });
    const body = res.json();
    const dates = body.items.map((i: { createdAt: string }) => new Date(i.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it('does not duplicate words with multiple senses', async () => {
    // cat has 2 senses (noun + verb), should appear once
    const res = await app.inject({ method: 'GET', url: '/vocabulary?search=cat' });
    const body = res.json();
    const catItems = body.items.filter((i: { lemma: string }) => i.lemma.startsWith('cat_'));
    expect(catItems).toHaveLength(1);
    // But it should have 2 senses
    expect(catItems[0].senses).toHaveLength(2);
  });
});

describe('GET /vocabulary/:wordId (detail)', () => {
  it('returns word with senses, collocations, word family, sentences', async () => {
    const res = await app.inject({ method: 'GET', url: `/vocabulary/${wordIds[0]}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('id', wordIds[0]);
    expect(body).toHaveProperty('lemma');
    expect(body).toHaveProperty('senses');
    expect(body).toHaveProperty('collocations');
    expect(body).toHaveProperty('wordFamily');
    expect(body).toHaveProperty('sentences');
    expect(body.senses.length).toBeGreaterThanOrEqual(1);
  });

  it('collocations found via shared sentences', async () => {
    // cat is linked to sentence that has collocation "run fast"
    const res = await app.inject({ method: 'GET', url: `/vocabulary/${wordIds[0]}` });
    const body = res.json();
    expect(body.collocations.length).toBeGreaterThanOrEqual(1);
    expect(body.collocations[0]).toHaveProperty('text');
    expect(body.collocations[0]).toHaveProperty('translation');
  });

  it('word family members returned (excluding self)', async () => {
    // cat and run share the same family
    const res = await app.inject({ method: 'GET', url: `/vocabulary/${wordIds[0]}` });
    const body = res.json();
    expect(body.wordFamily.length).toBeGreaterThanOrEqual(1);
    const familyIds = body.wordFamily.map((w: { id: number }) => w.id);
    expect(familyIds).not.toContain(wordIds[0]);
    expect(familyIds).toContain(wordIds[1]);
  });

  it('returns 404 for non-existent word', async () => {
    const res = await app.inject({ method: 'GET', url: '/vocabulary/999999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /vocabulary/:wordId/mark-known', () => {
  it('deletes SRS cards for all word senses', async () => {
    // cat-noun has an SRS card
    const res = await app.inject({ method: 'POST', url: `/vocabulary/${wordIds[0]}/mark-known` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify cards are deleted
    const remaining = await app.db
      .select()
      .from(srsCards)
      .where(inArray(srsCards.wordSenseId, [senseIds[0], senseIds[1]]));
    expect(remaining).toHaveLength(0);
  });

  it('returns success even if no SRS cards exist', async () => {
    // elaborate has no SRS card
    const res = await app.inject({ method: 'POST', url: `/vocabulary/${wordIds[2]}/mark-known` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });
});

describe('POST /vocabulary/:wordId/reset', () => {
  it('creates fresh SRS cards for senses without one', async () => {
    // elaborate has no card - should create one
    const res = await app.inject({ method: 'POST', url: `/vocabulary/${wordIds[2]}/reset` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(1);

    // Verify card exists
    const cards = await app.db
      .select()
      .from(srsCards)
      .where(eq(srsCards.wordSenseId, senseIds[3]));
    expect(cards).toHaveLength(1);
    expect(cards[0].state).toBe('new');
  });

  it('does not duplicate existing SRS cards', async () => {
    // cat-noun already has a card - should not duplicate
    const res = await app.inject({ method: 'POST', url: `/vocabulary/${wordIds[0]}/reset` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // cat has 2 senses: noun (has card), verb (no card) -> should create 1
    expect(body.created).toBe(1);

    // Verify no duplicate for noun sense
    const cards = await app.db
      .select()
      .from(srsCards)
      .where(eq(srsCards.wordSenseId, senseIds[0]));
    expect(cards).toHaveLength(1);
  });
});
