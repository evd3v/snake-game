import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql, eq, and } from 'drizzle-orm';
import { createDb, type Database } from '../src/db/index.ts';
import {
  sentences,
  words,
  sentenceWords,
  collocations,
  sentenceCollocations,
  grammarPatterns,
  sentenceGrammarPatterns,
  wordFamilies,
  wordSenses,
  srsCards,
  grammarExercises,
  reviewLogs,
} from '../src/db/schema/index.ts';
import { storeAnalysisResults } from '../src/services/analysis.ts';
import { mockAnalysisResult, MOCK_SENTENCE } from './fixtures/analysis-result.ts';

let db: Database;

beforeAll(() => {
  db = createDb(process.env.DATABASE_URL!);
});

async function cleanAll() {
  await db.delete(reviewLogs).where(sql`1=1`);
  await db.delete(grammarExercises).where(sql`1=1`);
  await db.delete(srsCards).where(sql`1=1`);
  await db.delete(wordSenses).where(sql`1=1`);
  await db.delete(sentenceWords).where(sql`1=1`);
  await db.delete(sentenceCollocations).where(sql`1=1`);
  await db.delete(sentenceGrammarPatterns).where(sql`1=1`);
  await db.delete(words).where(sql`1=1`);
  await db.delete(collocations).where(sql`1=1`);
  await db.delete(grammarPatterns).where(sql`1=1`);
  await db.delete(wordFamilies).where(sql`1=1`);
  await db.delete(sentences).where(sql`1=1`);
}

afterEach(async () => {
  await cleanAll();
});

afterAll(async () => {
  await cleanAll();
});

describe('storeAnalysisResults', () => {
  it('stores sentence with translation and CEFR level', async () => {
    const result = await storeAnalysisResults(db, MOCK_SENTENCE, 'test-book', mockAnalysisResult);

    const stored = await db
      .select()
      .from(sentences)
      .where(eq(sentences.id, result.sentenceId));

    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe(MOCK_SENTENCE);
    expect(stored[0].translation).toBe(mockAnalysisResult.translation);
    expect(stored[0].cefrLevel).toBe('B2');
    expect(stored[0].sourceBook).toBe('test-book');
  });

  it('stores words as normalized lemmas linked to sentence', async () => {
    const result = await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const storedWords = await db.select().from(words);
    expect(storedWords.length).toBe(mockAnalysisResult.vocabulary.length);

    // Check lemmas are stored (normalizeLemma should process them)
    const lemmas = storedWords.map((w) => w.lemma);
    expect(lemmas).toContain('take'); // normalized from 'take' via verb lemmatizer
    expect(lemmas).toContain('matter');
    expect(lemmas).toContain('know');
    expect(lemmas).toContain('reluctance');

    // Check junction entries
    const junctions = await db
      .select()
      .from(sentenceWords)
      .where(eq(sentenceWords.sentenceId, result.sentenceId));

    expect(junctions.length).toBe(mockAnalysisResult.vocabulary.length);
  });

  it('assigns thematic clusters to words', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const storedWords = await db.select().from(words);
    for (const w of storedWords) {
      expect(w.thematicCluster).toBeTruthy();
    }
  });

  it('deduplicates words on re-submission', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);
    await storeAnalysisResults(db, MOCK_SENTENCE + ' Again.', undefined, mockAnalysisResult);

    const storedWords = await db.select().from(words);
    // Should still be same count, not doubled
    expect(storedWords.length).toBe(mockAnalysisResult.vocabulary.length);
  });

  it('stores collocations as independent units', async () => {
    const result = await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const storedCollocations = await db.select().from(collocations);
    expect(storedCollocations.length).toBe(mockAnalysisResult.collocations.length);
    expect(storedCollocations[0].text).toBe('take into account');
    expect(storedCollocations[0].type).toBe('collocation');

    // Junction
    const junctions = await db
      .select()
      .from(sentenceCollocations)
      .where(eq(sentenceCollocations.sentenceId, result.sentenceId));

    expect(junctions.length).toBe(mockAnalysisResult.collocations.length);
  });

  it('deduplicates collocations on re-submission', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);
    await storeAnalysisResults(db, MOCK_SENTENCE + ' Again.', undefined, mockAnalysisResult);

    const storedCollocations = await db.select().from(collocations);
    expect(storedCollocations.length).toBe(mockAnalysisResult.collocations.length);
  });

  it('stores grammar patterns with upsert', async () => {
    const result = await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const storedPatterns = await db.select().from(grammarPatterns);
    expect(storedPatterns.length).toBe(mockAnalysisResult.grammarPatterns.length);
    expect(storedPatterns[0].pattern).toBe('would have + V3');
    expect(storedPatterns[0].description).toBeTruthy();

    // Junction
    const junctions = await db
      .select()
      .from(sentenceGrammarPatterns)
      .where(eq(sentenceGrammarPatterns.sentenceId, result.sentenceId));

    expect(junctions.length).toBe(mockAnalysisResult.grammarPatterns.length);
  });

  it('auto-creates SRS cards for words with CEFR >= B1', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    // Should create vocabulary SRS cards for B1+ words only
    // matter (B1), account (B1), reluctance (B2) = 3 cards
    // take (A2), know (A1) = 0 cards
    const vocabCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'vocabulary'));

    expect(vocabCards).toHaveLength(3);

    // Verify no cards for A1/A2 words by checking word senses
    const knowWord = await db.select().from(words).where(eq(words.lemma, 'know'));
    const takeWord = await db.select().from(words).where(eq(words.lemma, 'take'));

    if (knowWord.length > 0) {
      const knowSenses = await db
        .select()
        .from(wordSenses)
        .where(eq(wordSenses.wordId, knowWord[0].id));
      for (const sense of knowSenses) {
        const knowCards = await db
          .select()
          .from(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              eq(srsCards.wordSenseId, sense.id),
            ),
          );
        expect(knowCards).toHaveLength(0);
      }
    }

    if (takeWord.length > 0) {
      const takeSenses = await db
        .select()
        .from(wordSenses)
        .where(eq(wordSenses.wordId, takeWord[0].id));
      for (const sense of takeSenses) {
        const takeCards = await db
          .select()
          .from(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              eq(srsCards.wordSenseId, sense.id),
            ),
          );
        expect(takeCards).toHaveLength(0);
      }
    }
  });

  it('does not duplicate SRS cards on re-analysis', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);
    await storeAnalysisResults(db, MOCK_SENTENCE + ' Again.', undefined, mockAnalysisResult);

    const vocabCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'vocabulary'));

    // Still exactly 3 vocabulary cards, not 6
    expect(vocabCards).toHaveLength(3);
  });

  it('preserves grammar SRS card auto-creation', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const grammarCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'grammar'));

    // 1 grammar pattern in mock data = 1 grammar SRS card
    expect(grammarCards).toHaveLength(1);
  });

  it('links word families', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    // reluctance should have a word_family_id
    const storedWords = await db
      .select()
      .from(words)
      .where(eq(words.lemma, 'reluctance'));

    expect(storedWords).toHaveLength(1);
    expect(storedWords[0].wordFamilyId).not.toBeNull();

    // word_families should have a row
    const families = await db.select().from(wordFamilies);
    expect(families.length).toBeGreaterThanOrEqual(1);
  });
});
