import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const sentences = pgTable('sentences', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: text().notNull(),
  translation: text(),
  cefrLevel: text('cefr_level'),
  sourceBook: text('source_book'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
