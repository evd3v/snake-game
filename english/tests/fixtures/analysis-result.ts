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
      definition: 'To accept or receive something; in this context, to consider or deal with something.',
      partOfSpeech: 'verb',
      cefrLevel: 'A2',
      thematicCluster: 'actions',
    },
    {
      word: 'matter',
      lemma: 'matter',
      translation: 'дело, вопрос',
      definition: 'A subject or situation that is being dealt with or considered.',
      partOfSpeech: 'noun',
      cefrLevel: 'B1',
      thematicCluster: 'abstract_concepts',
    },
    {
      word: 'account',
      lemma: 'account',
      translation: 'счёт, учёт',
      definition: 'A record or consideration of something; used in "take into account" meaning to consider.',
      partOfSpeech: 'noun',
      cefrLevel: 'B1',
      thematicCluster: 'business',
    },
    {
      word: 'known',
      lemma: 'know',
      translation: 'знать',
      definition: 'To be aware of something through observation, inquiry, or information.',
      partOfSpeech: 'verb',
      cefrLevel: 'A1',
      thematicCluster: 'cognition',
    },
    {
      word: 'reluctance',
      lemma: 'reluctance',
      translation: 'нежелание, неохота',
      definition: 'Unwillingness or hesitation to do something, often due to doubt or discomfort.',
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
