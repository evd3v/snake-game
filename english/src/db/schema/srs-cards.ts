import { pgTable, integer, text, timestamp, real, pgEnum } from 'drizzle-orm/pg-core';

export const cardTypeEnum = pgEnum('card_type', [
  'vocabulary',
  'grammar',
]);

export const cardStateEnum = pgEnum('card_state', [
  'new',
  'learning',
  'review',
  'relearning',
]);

export const srsCards = pgTable('srs_cards', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cardType: cardTypeEnum('card_type').notNull(),
  wordId: integer('word_id'),
  grammarPatternId: integer('grammar_pattern_id'),
  state: cardStateEnum().default('new'),
  due: timestamp().defaultNow().notNull(),
  stability: real().default(0),
  difficulty: real().default(0),
  elapsedDays: integer('elapsed_days').default(0),
  scheduledDays: integer('scheduled_days').default(0),
  reps: integer().default(0),
  lapses: integer().default(0),
  lastReview: timestamp('last_review'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
