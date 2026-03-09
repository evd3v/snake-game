import { createEmptyCard, fsrs, type Card, Rating, State } from 'ts-fsrs';
import { eq, lte, asc } from 'drizzle-orm';
import { srsCards } from '../db/schema/srs-cards.ts';
import { reviewLogs } from '../db/schema/review-logs.ts';
import type { Database } from '../db/index.ts';

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true });

const stateStringToNumber: Record<string, number> = {
  new: 0,
  learning: 1,
  review: 2,
  relearning: 3,
};

const stateNumberToString: Record<number, string> = {
  0: 'new',
  1: 'learning',
  2: 'review',
  3: 'relearning',
};

export type CardType = 'vocabulary' | 'grammar';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export function toFsrsCard(row: typeof srsCards.$inferSelect): Card {
  return {
    due: row.due,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: row.elapsedDays ?? 0,
    scheduled_days: row.scheduledDays ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: stateStringToNumber[row.state ?? 'new'] as State,
    last_review: row.lastReview ?? undefined,
  };
}

export function toDbState(fsrsState: number): CardState {
  return (stateNumberToString[fsrsState] ?? 'new') as CardState;
}

export async function createSrsCard(
  db: Database,
  cardType: CardType,
  opts: { wordId?: number; grammarPatternId?: number },
) {
  const emptyCard = createEmptyCard();

  const [inserted] = await db
    .insert(srsCards)
    .values({
      cardType,
      wordId: opts.wordId ?? null,
      grammarPatternId: opts.grammarPatternId ?? null,
      state: 'new',
      due: emptyCard.due,
      stability: emptyCard.stability,
      difficulty: emptyCard.difficulty,
      elapsedDays: emptyCard.elapsed_days,
      scheduledDays: emptyCard.scheduled_days,
      reps: emptyCard.reps,
      lapses: emptyCard.lapses,
    })
    .onConflictDoNothing()
    .returning();

  return inserted;
}

export async function rateCard(
  db: Database,
  cardId: number,
  rating: Rating,
) {
  const [row] = await db
    .select()
    .from(srsCards)
    .where(eq(srsCards.id, cardId));

  if (!row) {
    throw new Error(`SRS card ${cardId} not found`);
  }

  const card = toFsrsCard(row);
  const now = new Date();
  const scheduled = scheduler.next(card, now, rating);

  // Update card in DB
  await db
    .update(srsCards)
    .set({
      state: toDbState(scheduled.card.state),
      due: scheduled.card.due,
      stability: scheduled.card.stability,
      difficulty: scheduled.card.difficulty,
      elapsedDays: scheduled.card.elapsed_days,
      scheduledDays: scheduled.card.scheduled_days,
      reps: scheduled.card.reps,
      lapses: scheduled.card.lapses,
      lastReview: now,
    })
    .where(eq(srsCards.id, cardId));

  // Insert review log
  await db.insert(reviewLogs).values({
    srsCardId: cardId,
    rating,
    elapsedDays: scheduled.card.elapsed_days,
    scheduledDays: scheduled.card.scheduled_days,
    state: row.state ?? 'new',
    reviewedAt: now,
  });

  return scheduled;
}

export async function getDueCards(db: Database, limit = 20) {
  const now = new Date();

  return db
    .select()
    .from(srsCards)
    .where(lte(srsCards.due, now))
    .orderBy(asc(srsCards.due))
    .limit(limit);
}

export { Rating };
