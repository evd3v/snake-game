import { relations } from 'drizzle-orm';
import { sentences } from './schema/sentences.ts';
import { words, sentenceWords } from './schema/words.ts';
import { collocations, sentenceCollocations } from './schema/collocations.ts';
import { grammarPatterns, sentenceGrammarPatterns } from './schema/grammar-patterns.ts';
import { wordFamilies } from './schema/word-families.ts';
import { srsCards } from './schema/srs-cards.ts';
import { wordSenses } from './schema/word-senses.ts';

export const sentencesRelations = relations(sentences, ({ many }) => ({
  sentenceWords: many(sentenceWords),
  sentenceCollocations: many(sentenceCollocations),
  sentenceGrammarPatterns: many(sentenceGrammarPatterns),
}));

export const wordsRelations = relations(words, ({ one, many }) => ({
  wordFamily: one(wordFamilies, {
    fields: [words.wordFamilyId],
    references: [wordFamilies.id],
  }),
  sentenceWords: many(sentenceWords),
  wordSenses: many(wordSenses),
}));

export const collocationsRelations = relations(collocations, ({ many }) => ({
  sentenceCollocations: many(sentenceCollocations),
  srsCards: many(srsCards),
}));

export const grammarPatternsRelations = relations(grammarPatterns, ({ many }) => ({
  sentenceGrammarPatterns: many(sentenceGrammarPatterns),
  srsCards: many(srsCards),
}));

export const wordFamiliesRelations = relations(wordFamilies, ({ many }) => ({
  words: many(words),
}));

export const wordSensesRelations = relations(wordSenses, ({ one, many }) => ({
  word: one(words, {
    fields: [wordSenses.wordId],
    references: [words.id],
  }),
  srsCards: many(srsCards),
}));

export const srsCardsRelations = relations(srsCards, ({ one }) => ({
  wordSense: one(wordSenses, {
    fields: [srsCards.wordSenseId],
    references: [wordSenses.id],
  }),
  grammarPattern: one(grammarPatterns, {
    fields: [srsCards.grammarPatternId],
    references: [grammarPatterns.id],
  }),
  collocation: one(collocations, {
    fields: [srsCards.collocationId],
    references: [collocations.id],
  }),
}));

export const sentenceWordsRelations = relations(sentenceWords, ({ one }) => ({
  sentence: one(sentences, {
    fields: [sentenceWords.sentenceId],
    references: [sentences.id],
  }),
  word: one(words, {
    fields: [sentenceWords.wordId],
    references: [words.id],
  }),
}));

export const sentenceCollocationsRelations = relations(sentenceCollocations, ({ one }) => ({
  sentence: one(sentences, {
    fields: [sentenceCollocations.sentenceId],
    references: [sentences.id],
  }),
  collocation: one(collocations, {
    fields: [sentenceCollocations.collocationId],
    references: [collocations.id],
  }),
}));

export const sentenceGrammarPatternsRelations = relations(sentenceGrammarPatterns, ({ one }) => ({
  sentence: one(sentences, {
    fields: [sentenceGrammarPatterns.sentenceId],
    references: [sentences.id],
  }),
  grammarPattern: one(grammarPatterns, {
    fields: [sentenceGrammarPatterns.grammarPatternId],
    references: [grammarPatterns.id],
  }),
}));
