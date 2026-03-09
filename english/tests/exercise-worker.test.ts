// Requires: docker compose up -d postgres redis
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
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
  await db.delete(sentenceWords).where(sql`1=1`);
  await db.delete(sentenceCollocations).where(sql`1=1`);
  await db.delete(sentenceGrammarPatterns).where(sql`1=1`);
  await db.delete(words).where(sql`1=1`);
  await db.delete(collocations).where(sql`1=1`);
  await db.delete(grammarPatterns).where(sql`1=1`);
  await db.delete(sentences).where(sql`1=1`);
}

afterEach(async () => {
  await cleanAll();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await cleanAll();
});

describe('storeAnalysisResults creates grammar SRS cards', () => {
  it('creates an SRS card for each grammar pattern during analysis', async () => {
    const result = await storeAnalysisResults(db, MOCK_SENTENCE, 'test-book', mockAnalysisResult);

    // Should have created SRS cards for grammar patterns
    const cards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'grammar'));

    expect(cards.length).toBe(mockAnalysisResult.grammarPatterns.length);
    expect(cards[0].state).toBe('new');
    expect(cards[0].grammarPatternId).not.toBeNull();
  });

  it('does not duplicate SRS cards on re-analysis of same pattern', async () => {
    await storeAnalysisResults(db, MOCK_SENTENCE, undefined, mockAnalysisResult);
    await storeAnalysisResults(db, MOCK_SENTENCE + ' Again.', undefined, mockAnalysisResult);

    const cards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.cardType, 'grammar'));

    // Should still be 1 (onConflictDoNothing)
    expect(cards.length).toBe(mockAnalysisResult.grammarPatterns.length);
  });
});

describe('worker handles generate-exercises job type', () => {
  it('processJob routes generate-exercises to exercise generator', async () => {
    // Create a grammar pattern in DB for reference
    const [pattern] = await db.insert(grammarPatterns).values({
      pattern: `present_perfect_test_${Date.now()}`,
      description: 'Present perfect tense',
      cefrLevel: 'B1',
    }).returning();

    // Mock the AI-dependent generateText to avoid real API calls
    vi.mock('ai', () => ({
      generateText: vi.fn().mockResolvedValue({
        output: {
          exercises: [
            { sentence: 'I ___ been to Paris.', answer: 'have', difficulty: 1, hint: 'auxiliary verb' },
            { sentence: 'She ___ finished her work.', answer: 'has', difficulty: 1 },
            { sentence: 'They ___ already eaten lunch.', answer: 'have', difficulty: 2 },
            { sentence: 'He ___ never seen such beauty.', answer: 'has', difficulty: 2, hint: 'third person' },
            { sentence: 'We ___ just arrived at the station.', answer: 'have', difficulty: 3 },
            { sentence: 'The committee ___ reached a decision.', answer: 'has', difficulty: 3 },
          ],
        },
      }),
      Output: { object: vi.fn().mockReturnValue({}) },
    }));

    const { processJob } = await import('../src/workers/job-processor.ts');

    const mockJob = {
      name: 'generate-exercises',
      data: {
        grammarPatternId: pattern.id,
        pattern: pattern.pattern,
        description: 'Present perfect tense',
        count: 6,
      },
    };

    const result = await processJob(db, mockJob as any);
    expect(result).toBe(6);

    // Verify exercises were stored in DB
    const exercises = await db
      .select()
      .from(grammarExercises)
      .where(eq(grammarExercises.grammarPatternId, pattern.id));

    expect(exercises.length).toBe(6);
    expect(exercises[0].sentence).toContain('___');
  });
});
