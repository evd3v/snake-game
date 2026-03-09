import { pgTable, integer, text, timestamp, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { sentences } from './sentences.ts';

export const collocationTypeEnum = pgEnum('collocation_type', [
  'collocation',
  'phrasal_verb',
  'idiom',
]);

export const collocations = pgTable('collocations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: text().notNull().unique(),
  translation: text(),
  type: collocationTypeEnum().notNull(),
  cefrLevel: text('cefr_level'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sentenceCollocations = pgTable('sentence_collocations', {
  sentenceId: integer('sentence_id').notNull().references(() => sentences.id),
  collocationId: integer('collocation_id').notNull().references(() => collocations.id),
}, (t) => [
  primaryKey({ columns: [t.sentenceId, t.collocationId] }),
]);
