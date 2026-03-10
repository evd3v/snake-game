import 'dotenv/config';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
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

describe('collocation SRS card auto-creation', () => {
  it('creates collocation SRS cards when sentence is analyzed', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, 'test-book', mockAnalysisResult);

    const collocationCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'collocation'));

    // Mock data has collocations -- each should get an SRS card
    expect(collocationCards).toHaveLength(mockAnalysisResult.collocations.length);

    // Verify each card has a collocationId
    for (const card of collocationCards) {
      expect(card.collocationId).not.toBeNull();
      expect(card.state).toBe('new');
    }
  });

  it('does not create duplicate collocation SRS cards on re-analysis', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);
    await storeAnalysisResults(db, MOCK_SENTENCE + ' Again.', undefined, mockAnalysisResult);

    const collocationCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'collocation'));

    // Still same count, not doubled
    expect(collocationCards).toHaveLength(mockAnalysisResult.collocations.length);
  });

  it('collocation SRS cards reference correct collocations', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const storedCollocations = await db.select().from(collocations);
    const collocationCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'collocation'));

    const collocationIds = storedCollocations.map((c) => c.id);
    for (const card of collocationCards) {
      expect(collocationIds).toContain(card.collocationId);
    }
  });

  it('does not affect vocabulary or grammar SRS card creation', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);

    const vocabCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'vocabulary'));

    const grammarCards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'grammar'));

    // Vocabulary: 3 B1+ words (matter, account, reluctance)
    expect(vocabCards).toHaveLength(3);
    // Grammar: 1 pattern
    expect(grammarCards).toHaveLength(1);
  });
});
