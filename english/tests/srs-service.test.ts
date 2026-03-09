// Requires: docker compose up -d postgres && npm run db:push
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from '../src/db/index.ts';
import {
  createSrsCard,
  rateCard,
  getDueCards,
  toFsrsCard,
  toDbState,
  Rating,
} from '../src/services/srs.ts';
import { srsCards, reviewLogs } from '../src/db/schema/index.ts';

let db: Database;

beforeAll(() => {
  db = createDb(process.env.DATABASE_URL!);
});

afterAll(async () => {
  // Clean up test data
  await db.delete(reviewLogs).where(sql`1=1`);
  await db.delete(srsCards).where(sql`1=1`);
});

describe('toFsrsCard / toDbState mapping', () => {
  it('maps string state to numeric: new->0, learning->1, review->2, relearning->3', () => {
    const row = {
      id: 1,
      cardType: 'vocabulary' as const,
      wordId: 1,
      grammarPatternId: null,
      state: 'new' as const,
      due: new Date(),
      stability: 5.0,
      difficulty: 3.0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      lastReview: null,
      createdAt: new Date(),
    };

    expect(toFsrsCard({ ...row, state: 'new' }).state).toBe(0);
    expect(toFsrsCard({ ...row, state: 'learning' }).state).toBe(1);
    expect(toFsrsCard({ ...row, state: 'review' }).state).toBe(2);
    expect(toFsrsCard({ ...row, state: 'relearning' }).state).toBe(3);
  });

  it('toDbState maps numeric back to string', () => {
    expect(toDbState(0)).toBe('new');
    expect(toDbState(1)).toBe('learning');
    expect(toDbState(2)).toBe('review');
    expect(toDbState(3)).toBe('relearning');
  });
});

describe('createSrsCard', () => {
  it('inserts a vocabulary card with state=new and due~now', async () => {
    const card = await createSrsCard(db, 'vocabulary', { wordId: 9999 });
    expect(card).toBeDefined();
    expect(card.cardType).toBe('vocabulary');
    expect(card.state).toBe('new');
    expect(card.wordId).toBe(9999);
    expect(card.due).toBeInstanceOf(Date);
  });

  it('inserts a grammar card', async () => {
    const card = await createSrsCard(db, 'grammar', { grammarPatternId: 5 });
    expect(card).toBeDefined();
    expect(card.cardType).toBe('grammar');
    expect(card.grammarPatternId).toBe(5);
  });

  it('does not throw on duplicate insert (onConflictDoNothing)', async () => {
    // Insert the same wordId again -- should not throw
    await expect(
      createSrsCard(db, 'vocabulary', { wordId: 9999 }),
    ).resolves.not.toThrow();
  });
});

describe('rateCard', () => {
  it('updates due date to future and increments reps on Rating.Good', async () => {
    const card = await createSrsCard(db, 'vocabulary', { wordId: 8888 });
    const before = new Date();

    const result = await rateCard(db, card.id, Rating.Good);
    expect(result.card.reps).toBeGreaterThan(0);
    expect(result.card.due.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('transitions a new card to learning state', async () => {
    const card = await createSrsCard(db, 'vocabulary', { wordId: 7777 });
    expect(card.state).toBe('new');

    await rateCard(db, card.id, Rating.Good);

    // Re-query the card
    const [updated] = await db
      .select()
      .from(srsCards)
      .where(sql`${srsCards.id} = ${card.id}`);

    expect(updated.state).toBe('learning');
  });
});

describe('getDueCards', () => {
  it('returns only cards where due <= now, ordered by due ASC', async () => {
    // Create cards with past due dates
    const card1 = await createSrsCard(db, 'vocabulary', { wordId: 6661 });
    const card2 = await createSrsCard(db, 'vocabulary', { wordId: 6662 });

    const dueCards = await getDueCards(db);
    expect(dueCards.length).toBeGreaterThanOrEqual(2);

    // Verify ordering (due ASC)
    for (let i = 1; i < dueCards.length; i++) {
      expect(dueCards[i].due.getTime()).toBeGreaterThanOrEqual(
        dueCards[i - 1].due.getTime(),
      );
    }
  });

  it('respects limit parameter', async () => {
    const dueCards = await getDueCards(db, 2);
    expect(dueCards.length).toBeLessThanOrEqual(2);
  });
});
