import { pgTable, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { grammarPatterns } from './grammar-patterns.ts';

export const grammarExercises = pgTable('grammar_exercises', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  grammarPatternId: integer('grammar_pattern_id').notNull().references(() => grammarPatterns.id),
  sentence: text().notNull(),
  clozeAnswer: text('cloze_answer').notNull(),
  difficultyLevel: integer('difficulty_level').notNull().default(1),
  hint: text(),
  used: boolean().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
