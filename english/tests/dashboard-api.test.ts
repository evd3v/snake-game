// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { sql } from 'drizzle-orm';
import { sentences } from '../src/db/schema/sentences.ts';
import { words, sentenceWords } from '../src/db/schema/words.ts';
import { srsCards } from '../src/db/schema/srs-cards.ts';
import { wordSenses } from '../src/db/schema/word-senses.ts';
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

describe('GET /dashboard/stats', () => {
  it('returns zero counts when no data exists', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/stats',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual({
      words: { new: 0, learning: 0, known: 0 },
      grammar: { new: 0, learning: 0, known: 0 },
    });
  });

  it('returns correct counts grouped by card type and state', async () => {
    // Create words and senses
    const [w1] = await app.db.insert(words).values({ lemma: 'stat_w1' }).returning();
    const [w2] = await app.db.insert(words).values({ lemma: 'stat_w2' }).returning();
    const [w3] = await app.db.insert(words).values({ lemma: 'stat_w3_no_card' }).returning();

    const [ws1] = await app.db.insert(wordSenses).values({ wordId: w1.id, partOfSpeech: 'noun' }).returning();
    const [ws2] = await app.db.insert(wordSenses).values({ wordId: w2.id, partOfSpeech: 'noun' }).returning();
    await app.db.insert(wordSenses).values({ wordId: w3.id, partOfSpeech: 'noun' });

    // Create grammar patterns
    const [g1] = await app.db.insert(grammarPatterns).values({ pattern: 'stat_g1' }).returning();

    // Create SRS cards
    await app.db.insert(srsCards).values([
      { cardType: 'vocabulary' as const, wordSenseId: ws1.id, state: 'new' as const, due: new Date() },
      { cardType: 'vocabulary' as const, wordSenseId: ws2.id, state: 'review' as const, due: new Date() },
      { cardType: 'grammar' as const, grammarPatternId: g1.id, state: 'learning' as const, due: new Date() },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/stats',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // w3 has no SRS card, counted as "new"
    expect(body.words.new).toBe(2); // w1 (state=new) + w3 (no card)
    expect(body.words.learning).toBe(0);
    expect(body.words.known).toBe(1); // w2 (state=review => known)
    expect(body.grammar.new).toBe(0);
    expect(body.grammar.learning).toBe(1); // g1
    expect(body.grammar.known).toBe(0);
  });
});

describe('GET /dashboard/weak-spots', () => {
  it('returns empty array when no reviews exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/weak-spots',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns items with highest fail rates (>= 2 reviews)', async () => {
    const [w1] = await app.db.insert(words).values({ lemma: 'weak_w1' }).returning();
    const [ws1] = await app.db.insert(wordSenses).values({ wordId: w1.id, partOfSpeech: 'noun', translation: 'translation1' }).returning();
    const [card1] = await app.db.insert(srsCards).values({
      cardType: 'vocabulary', wordSenseId: ws1.id, state: 'review', due: new Date(),
    }).returning();

    // 3 reviews: 2 fails (rating 1,2), 1 pass (rating 3) => failRate = 2/3
    await app.db.insert(reviewLogs).values([
      { srsCardId: card1.id, rating: 1, elapsedDays: 1, scheduledDays: 1, state: 'review' },
      { srsCardId: card1.id, rating: 2, elapsedDays: 1, scheduledDays: 1, state: 'review' },
      { srsCardId: card1.id, rating: 3, elapsedDays: 1, scheduledDays: 1, state: 'review' },
    ]);

    const [g1] = await app.db.insert(grammarPatterns).values({ pattern: 'weak_g1', description: 'desc1' }).returning();
    const [card2] = await app.db.insert(srsCards).values({
      cardType: 'grammar', grammarPatternId: g1.id, state: 'review', due: new Date(),
    }).returning();

    // 2 reviews: 2 fails => failRate = 1.0
    await app.db.insert(reviewLogs).values([
      { srsCardId: card2.id, rating: 1, elapsedDays: 1, scheduledDays: 1, state: 'review' },
      { srsCardId: card2.id, rating: 2, elapsedDays: 1, scheduledDays: 1, state: 'review' },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/weak-spots',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.length).toBe(2);

    // Grammar pattern should be first (higher fail rate)
    expect(body[0].name).toBe('weak_g1');
    expect(body[0].type).toBe('grammar');
    expect(body[0].failRate).toBe(1);
    expect(body[0].totalReviews).toBe(2);
    expect(body[0].description).toBe('desc1');

    expect(body[1].name).toBe('weak_w1');
    expect(body[1].type).toBe('vocabulary');
    expect(body[1].translation).toBe('translation1');
    expect(body[1].totalReviews).toBe(3);
  });

  it('excludes items with fewer than 2 reviews', async () => {
    const [w1] = await app.db.insert(words).values({ lemma: 'weak_single' }).returning();
    const [ws1] = await app.db.insert(wordSenses).values({ wordId: w1.id, partOfSpeech: 'noun' }).returning();
    const [card1] = await app.db.insert(srsCards).values({
      cardType: 'vocabulary', wordSenseId: ws1.id, state: 'review', due: new Date(),
    }).returning();

    // Only 1 review
    await app.db.insert(reviewLogs).values({
      srsCardId: card1.id, rating: 1, elapsedDays: 1, scheduledDays: 1, state: 'review',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/weak-spots',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});

describe('GET /dashboard/activity', () => {
  it('returns empty array when no activity exists', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/activity',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns combined review and sentence counts per day', async () => {
    // Create a card for review logs
    const [card] = await app.db.insert(srsCards).values({
      cardType: 'vocabulary', wordSenseId: null, state: 'new', due: new Date(),
    }).returning();

    const today = new Date();
    today.setHours(10, 0, 0, 0);

    // 2 reviews today
    await app.db.insert(reviewLogs).values([
      { srsCardId: card.id, rating: 3, elapsedDays: 0, scheduledDays: 1, state: 'new', reviewedAt: today },
      { srsCardId: card.id, rating: 4, elapsedDays: 0, scheduledDays: 1, state: 'new', reviewedAt: today },
    ]);

    // 1 sentence added today
    await app.db.insert(sentences).values({
      text: 'Activity test sentence',
      createdAt: today,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/activity',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.length).toBeGreaterThanOrEqual(1);

    const todayStr = today.toISOString().slice(0, 10);
    const todayEntry = body.find((d: any) => d.date === todayStr);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.reviews).toBe(2);
    expect(todayEntry.additions).toBe(1);
  });
});

describe('GET /dashboard/clusters', () => {
  it('returns empty array when no clustered words exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/clusters',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns words grouped by thematic cluster with SRS state breakdown', async () => {
    const [w1] = await app.db.insert(words).values({ lemma: 'cluster_w1', thematicCluster: 'animals' }).returning();
    const [w2] = await app.db.insert(words).values({ lemma: 'cluster_w2', thematicCluster: 'animals' }).returning();
    const [w3] = await app.db.insert(words).values({ lemma: 'cluster_w3', thematicCluster: 'food' }).returning();
    // w4 has no cluster - should be excluded
    await app.db.insert(words).values({ lemma: 'cluster_w4_no_cluster' });

    const [ws1] = await app.db.insert(wordSenses).values({ wordId: w1.id, partOfSpeech: 'noun' }).returning();
    await app.db.insert(wordSenses).values({ wordId: w2.id, partOfSpeech: 'noun' });
    const [ws3] = await app.db.insert(wordSenses).values({ wordId: w3.id, partOfSpeech: 'noun' }).returning();

    // w1 has SRS card in review state (known), w2 no card (new), w3 card in learning
    await app.db.insert(srsCards).values([
      { cardType: 'vocabulary' as const, wordSenseId: ws1.id, state: 'review' as const, due: new Date() },
      { cardType: 'vocabulary' as const, wordSenseId: ws3.id, state: 'learning' as const, due: new Date() },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/clusters',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.length).toBe(2);

    // animals has 2 words, food has 1 -- ordered by total DESC
    const animals = body.find((c: any) => c.cluster === 'animals');
    expect(animals).toBeDefined();
    expect(animals.total).toBe(2);
    expect(animals.new).toBe(1); // w2 no card
    expect(animals.known).toBe(1); // w1 review
    expect(animals.learning).toBe(0);

    const food = body.find((c: any) => c.cluster === 'food');
    expect(food).toBeDefined();
    expect(food.total).toBe(1);
    expect(food.learning).toBe(1); // w3
    expect(food.new).toBe(0);
    expect(food.known).toBe(0);
  });
});
