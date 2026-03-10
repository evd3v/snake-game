import { pgTable, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { words, familiarityEnum } from './words.ts';

export const wordSenses = pgTable('word_senses', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  wordId: integer('word_id').notNull().references(() => words.id),
  partOfSpeech: text('part_of_speech').notNull(),
  translation: text(),
  familiarity: familiarityEnum().default('never_seen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.wordId, t.partOfSpeech),
]);
