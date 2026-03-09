import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const wordFamilies = pgTable('word_families', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  rootWord: text('root_word').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
