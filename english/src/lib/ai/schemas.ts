import { z } from 'zod';

const cefrLevelEnum = z
  .enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  .describe('CEFR proficiency level');

export const sentenceAnalysisSchema = z.object({
  translation: z
    .string()
    .describe('Russian translation of the entire sentence'),
  cefrLevel: cefrLevelEnum.describe('Overall CEFR level of the sentence'),
  vocabulary: z
    .array(
      z.object({
        word: z
          .string()
          .describe('The word exactly as it appears in the sentence'),
        lemma: z.string().describe('Base/dictionary form of the word'),
        translation: z.string().describe('Russian translation of the word'),
        partOfSpeech: z
          .enum([
            'noun',
            'verb',
            'adjective',
            'adverb',
            'preposition',
            'conjunction',
            'pronoun',
            'determiner',
            'interjection',
          ])
          .describe('Part of speech category'),
        cefrLevel: cefrLevelEnum,
        thematicCluster: z
          .string()
          .describe(
            'Thematic group the word belongs to, e.g. "emotions", "business", "nature", "academic", "daily_life"',
          ),
      }),
    )
    .describe(
      'All content words extracted from the sentence (skip articles, common pronouns)',
    ),
  collocations: z
    .array(
      z.object({
        text: z
          .string()
          .describe('The collocation, phrasal verb, or idiom as a unit'),
        translation: z
          .string()
          .describe('Russian translation of the collocation'),
        type: z
          .enum(['collocation', 'phrasal_verb', 'idiom'])
          .describe('Type of multi-word unit'),
        cefrLevel: cefrLevelEnum,
      }),
    )
    .describe('Collocations, phrasal verbs, and idioms found in the sentence'),
  grammarPatterns: z
    .array(
      z.object({
        pattern: z
          .string()
          .describe(
            'Grammar pattern notation, e.g. "would have + V3", "to-V", "modal + V1"',
          ),
        description: z
          .string()
          .describe('Brief explanation of the grammar pattern'),
        cefrLevel: cefrLevelEnum,
      }),
    )
    .describe('Grammar patterns identified in the sentence'),
  wordFamilies: z
    .array(
      z.object({
        root: z
          .string()
          .describe('Root/base word of the word family'),
        forms: z
          .array(z.string())
          .describe(
            'All known forms of this word family (e.g. "act", "action", "active", "actively")',
          ),
      }),
    )
    .describe('Word families grouped by shared root'),
});

export type SentenceAnalysis = z.infer<typeof sentenceAnalysisSchema>;
