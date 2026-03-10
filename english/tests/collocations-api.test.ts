// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sentences } from '../src/db/schema/sentences.ts';
import { collocations, sentenceCollocations } from '../src/db/schema/collocations.ts';
import { sql } from 'drizzle-orm';

let app: FastifyInstance;

// Seed IDs
let collocationIds: number[];
let sentenceIds: number[];

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

beforeEach(async () => {
  // Seed collocations with varying types and CEFR levels
  const insertedCollocations = await app.db
    .insert(collocations)
    .values([
      { text: `take_into_account_${Date.now()}`, translation: 'принимать во внимание', type: 'collocation', cefrLevel: 'B2' },
      { text: `give_up_${Date.now()}`, translation: 'сдаваться', type: 'phrasal_verb', cefrLevel: 'B1' },
      { text: `break_the_ice_${Date.now()}`, translation: 'разрядить обстановку', type: 'idiom', cefrLevel: 'B2' },
      { text: `look_forward_to_${Date.now()}`, translation: 'с нетерпением ждать', type: 'phrasal_verb', cefrLevel: 'A2' },
    ])
    .returning();
  collocationIds = insertedCollocations.map((c) => c.id);

  // Seed sentences
  const insertedSentences = await app.db
    .insert(sentences)
    .values([
      { text: 'We need to take into account all factors.' },
      { text: 'You should take into account the weather.' },
      { text: 'Please take into account the deadline.' },
      { text: 'She decided to give up smoking.' },
    ])
    .returning();
  sentenceIds = insertedSentences.map((s) => s.id);

  // Link sentences to collocations via junction
  // Collocation 0 (take_into_account) gets 3 sentences, collocation 1 (give_up) gets 1
  await app.db.insert(sentenceCollocations).values([
    { sentenceId: sentenceIds[0], collocationId: collocationIds[0] },
    { sentenceId: sentenceIds[1], collocationId: collocationIds[0] },
    { sentenceId: sentenceIds[2], collocationId: collocationIds[0] },
    { sentenceId: sentenceIds[3], collocationId: collocationIds[1] },
  ]);
});

afterEach(async () => {
  // Clean up in FK-safe order
  await app.db.delete(sentenceCollocations).where(sql`1=1`);
  await app.db.execute(sql`DELETE FROM sentence_grammar_patterns`);
  await app.db.execute(sql`DELETE FROM sentence_words`);
  await app.db.delete(collocations).where(sql`1=1`);
  await app.db.delete(sentences).where(sql`1=1`);
});

describe('GET /collocations (list)', () => {
  it('returns paginated collocation list with correct shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(4);

    // Check item shape
    const item = body.items.find((i: any) => i.id === collocationIds[0]);
    expect(item).toBeDefined();
    expect(item).toHaveProperty('text');
    expect(item).toHaveProperty('translation');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('cefrLevel');
    expect(item).toHaveProperty('exampleSentences');
  });

  it('search filters by collocation text (case-insensitive)', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations?search=take_into' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.text.toLowerCase()).toContain('take_into');
    }
  });

  it('filter by CEFR level', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations?cefrLevel=B2' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.cefrLevel).toBe('B2');
    }
  });

  it('filter by collocation type', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations?type=phrasal_verb' });
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.type).toBe('phrasal_verb');
    }
  });

  it('pagination works correctly', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations?page=1&limit=2' });
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
    expect(body.total).toBeGreaterThanOrEqual(4);
  });

  it('example sentences included and limited to 3 per collocation', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations' });
    const body = res.json();

    // Collocation 0 has 3 sentences linked
    const coll0 = body.items.find((i: any) => i.id === collocationIds[0]);
    expect(coll0).toBeDefined();
    expect(coll0.exampleSentences.length).toBeLessThanOrEqual(3);
    expect(coll0.exampleSentences.length).toBeGreaterThanOrEqual(1);

    // Each sentence has id and text
    for (const s of coll0.exampleSentences) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('text');
    }
  });

  it('empty result returns correct shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/collocations?search=zzz_nonexistent_zzz' });
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
  });

  // Enable SRS tests after Phase 10 adds collocation cardType and collocationId to srs_cards
  it.skip('filter by SRS state (has card)', async () => {
    // Requires Phase 10: srsCards.collocationId + cardType='collocation'
  });

  it.skip('filter by SRS state (no card)', async () => {
    // Requires Phase 10: srsCards.collocationId + cardType='collocation'
  });
});
