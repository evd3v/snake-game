import { pgTable, integer, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { sentences } from './sentences.ts';

export const grammarPatterns = pgTable('grammar_patterns', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  pattern: text().notNull().unique(),
  description: text(),
  cefrLevel: text('cefr_level'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sentenceGrammarPatterns = pgTable('sentence_grammar_patterns', {
  sentenceId: integer('sentence_id').notNull().references(() => sentences.id),
  grammarPatternId: integer('grammar_pattern_id').notNull().references(() => grammarPatterns.id),
}, (t) => [
  primaryKey({ columns: [t.sentenceId, t.grammarPatternId] }),
]);
