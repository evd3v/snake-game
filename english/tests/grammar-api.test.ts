// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sentences } from '../src/db/schema/sentences.ts';
import { grammarPatterns, sentenceGrammarPatterns } from '../src/db/schema/grammar-patterns.ts';
import { srsCards } from '../src/db/schema/srs-cards.ts';
import { sql } from 'drizzle-orm';

let app: FastifyInstance;

// Seed IDs
let patternIds: number[];
let sentenceIds: number[];

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

beforeEach(async () => {
  // Seed grammar patterns with varying CEFR levels
  const insertedPatterns = await app.db
    .insert(grammarPatterns)
    .values([
      { pattern: `present_perfect_${Date.now()}`, description: 'Used for experiences and unfinished time', cefrLevel: 'B1' },
      { pattern: `past_simple_${Date.now()}`, description: 'Completed actions in the past', cefrLevel: 'A2' },
      { pattern: `third_conditional_${Date.now()}`, description: 'Hypothetical past situations', cefrLevel: 'B2' },
      { pattern: `passive_voice_${Date.now()}`, description: 'Subject receives the action', cefrLevel: 'B1' },
    ])
    .returning();
  patternIds = insertedPatterns.map((p) => p.id);

  // Seed sentences
  const insertedSentences = await app.db
    .insert(sentences)
    .values([
      { text: 'I have visited Paris twice.' },
      { text: 'She has never been to Japan.' },
      { text: 'They have lived here since 2020.' },
      { text: 'He went to the store yesterday.' },
    ])
    .returning();
  sentenceIds = insertedSentences.map((s) => s.id);

  // Link sentences to grammar patterns via junction
  // Pattern 0 (present_perfect) gets 3 sentences, pattern 1 (past_simple) gets 1
  await app.db.insert(sentenceGrammarPatterns).values([
    { sentenceId: sentenceIds[0], grammarPatternId: patternIds[0] },
    { sentenceId: sentenceIds[1], grammarPatternId: patternIds[0] },
    { sentenceId: sentenceIds[2], grammarPatternId: patternIds[0] },
    { sentenceId: sentenceIds[3], grammarPatternId: patternIds[1] },
  ]);

  // SRS cards: pattern 0 has a 'new' card, pattern 1 has a 'learning' card
  await app.db.insert(srsCards).values([
    { cardType: 'grammar', grammarPatternId: patternIds[0], state: 'new' },
    { cardType: 'grammar', grammarPatternId: patternIds[1], state: 'learning' },
  ]);
});

afterEach(async () => {
  // Clean up in FK-safe order, scoped to seeded data
  await app.db.delete(srsCards).where(sql`1=1`);
  await app.db.delete(sentenceGrammarPatterns).where(sql`1=1`);
  await app.db.execute(sql`DELETE FROM sentence_collocations`);
  await app.db.execute(sql`DELETE FROM sentence_words`);
  await app.db.delete(grammarPatterns).where(sql`1=1`);
  await app.db.delete(sentences).where(sql`1=1`);
});

describe('GET /grammar (list)', () => {
  it('returns paginated grammar pattern list with correct shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(4);

    // Check item shape
    const item = body.items.find((i: any) => i.id === patternIds[0]);
    expect(item).toBeDefined();
    expect(item).toHaveProperty('pattern');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('cefrLevel');
    expect(item).toHaveProperty('srsState');
    expect(item).toHaveProperty('exampleSentences');
  });

  it('search filters by pattern text (case-insensitive)', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?search=perfect' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      const matchesPattern = item.pattern.toLowerCase().includes('perfect');
      const matchesDescription = item.description?.toLowerCase().includes('perfect');
      expect(matchesPattern || matchesDescription).toBe(true);
    }
  });

  it('search filters by description text', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?search=experiences' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    // present_perfect has "experiences" in description
    const match = body.items.find((i: any) => i.id === patternIds[0]);
    expect(match).toBeDefined();
  });

  it('filter by CEFR level', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?cefrLevel=B1' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.cefrLevel).toBe('B1');
    }
  });

  it('filter by SRS state (has card)', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?srsState=new' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.srsState).toBe('new');
    }
  });

  it('filter by SRS state (no card)', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?srsState=none' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.srsState).toBeNull();
    }
  });

  it('pagination works correctly', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?page=1&limit=2' });
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
    expect(body.total).toBeGreaterThanOrEqual(4);
  });

  it('example sentences included and limited to 3 per pattern', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar' });
    const body = res.json();

    // Pattern 0 has 3 sentences linked
    const pattern0 = body.items.find((i: any) => i.id === patternIds[0]);
    expect(pattern0).toBeDefined();
    expect(pattern0.exampleSentences.length).toBeLessThanOrEqual(3);
    expect(pattern0.exampleSentences.length).toBeGreaterThanOrEqual(1);

    // Each sentence has id and text
    for (const s of pattern0.exampleSentences) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('text');
    }
  });

  it('empty result returns correct shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/grammar?search=zzz_nonexistent_zzz' });
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
  });
});
