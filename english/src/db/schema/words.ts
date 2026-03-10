import { pgTable, integer, text, timestamp, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { sentences } from './sentences.ts';

export const familiarityEnum = pgEnum('familiarity', [
  'never_seen',
  'seen_unsure',
  'understand_in_context',
]);

export const words = pgTable('words', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  lemma: text().notNull().unique(),
  cefrLevel: text('cefr_level'),
  thematicCluster: text('thematic_cluster'),
  wordFamilyId: integer('word_family_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sentenceWords = pgTable('sentence_words', {
  sentenceId: integer('sentence_id').notNull().references(() => sentences.id),
  wordId: integer('word_id').notNull().references(() => words.id),
  position: integer(),
}, (t) => [
  primaryKey({ columns: [t.sentenceId, t.wordId] }),
]);
