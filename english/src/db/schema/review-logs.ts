import { pgTable, integer, timestamp } from 'drizzle-orm/pg-core';
import { srsCards } from './srs-cards.ts';
import { cardStateEnum } from './srs-cards.ts';

export const reviewLogs = pgTable('review_logs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  srsCardId: integer('srs_card_id').notNull().references(() => srsCards.id),
  rating: integer().notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  state: cardStateEnum().notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
});
