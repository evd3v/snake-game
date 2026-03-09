import type { SentenceAnalysis } from '../../src/lib/ai/schemas.ts';

export const MOCK_SENTENCE =
  'He would have taken the matter into account if he had known about the reluctance.';

export const mockAnalysisResult: SentenceAnalysis = {
  translation:
    'Он бы принял это во внимание, если бы знал о нежелании.',
  cefrLevel: 'B2',
  vocabulary: [
    {
      word: 'taken',
      lemma: 'take',
      translation: 'брать, принимать',
      partOfSpeech: 'verb',
      cefrLevel: 'A2',
      thematicCluster: 'actions',
    },
    {
      word: 'matter',
      lemma: 'matter',
      translation: 'дело, вопрос',
      partOfSpeech: 'noun',
      cefrLevel: 'B1',
      thematicCluster: 'abstract_concepts',
    },
    {
      word: 'account',
      lemma: 'account',
      translation: 'счёт, учёт',
      partOfSpeech: 'noun',
      cefrLevel: 'B1',
      thematicCluster: 'business',
    },
    {
      word: 'known',
      lemma: 'know',
      translation: 'знать',
      partOfSpeech: 'verb',
      cefrLevel: 'A1',
      thematicCluster: 'cognition',
    },
    {
      word: 'reluctance',
      lemma: 'reluctance',
      translation: 'нежелание, неохота',
      partOfSpeech: 'noun',
      cefrLevel: 'B2',
      thematicCluster: 'emotions',
    },
  ],
  collocations: [
    {
      text: 'take into account',
      translation: 'принимать во внимание',
      type: 'collocation',
      cefrLevel: 'B2',
    },
  ],
  grammarPatterns: [
    {
      pattern: 'would have + V3',
      description:
        'Third conditional / past unreal: expresses an imagined outcome in the past',
      cefrLevel: 'B2',
    },
  ],
  wordFamilies: [
    {
      root: 'reluctant',
      forms: ['reluctant', 'reluctance', 'reluctantly'],
    },
  ],
};
