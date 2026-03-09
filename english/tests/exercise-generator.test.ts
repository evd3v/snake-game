import 'dotenv/config';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from '../src/db/index.ts';
import { clozeExerciseSchema } from '../src/lib/ai/cloze-schemas.ts';
import { CLOZE_SYSTEM_PROMPT, buildClozePrompt } from '../src/lib/ai/cloze-prompts.ts';
import { grammarExercises, grammarPatterns } from '../src/db/schema/index.ts';

// Mock the AI module before importing exercise-generator
vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn((opts: unknown) => opts),
  },
}));

vi.mock('../src/lib/ai/provider.ts', () => ({
  getModel: vi.fn(() => 'mock-model'),
}));

import { generateText } from 'ai';
import { generateClozeExercises } from '../src/services/exercise-generator.ts';

const mockedGenerateText = vi.mocked(generateText);

let db: Database;
let testPatternId: number;

beforeAll(async () => {
  db = createDb(process.env.DATABASE_URL!);

  // Create a test grammar pattern
  const [pattern] = await db
    .insert(grammarPatterns)
    .values({
      pattern: 'test_would_have_V3',
      description: 'Third conditional',
      cefrLevel: 'B2',
    })
    .onConflictDoNothing()
    .returning();

  if (pattern) {
    testPatternId = pattern.id;
  } else {
    // Already exists, query it
    const [existing] = await db
      .select()
      .from(grammarPatterns)
      .where(sql`${grammarPatterns.pattern} = 'test_would_have_V3'`);
    testPatternId = existing.id;
  }
});

afterAll(async () => {
  await db.delete(grammarExercises).where(
    sql`${grammarExercises.grammarPatternId} = ${testPatternId}`,
  );
  await db.delete(grammarPatterns).where(
    sql`${grammarPatterns.pattern} = 'test_would_have_V3'`,
  );
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('clozeExerciseSchema', () => {
  it('validates a correct exercise object', () => {
    const valid = {
      exercises: [
        { sentence: 'She ___ gone to the store.', answer: 'would have', difficulty: 1 },
        { sentence: 'If I ___ known, I would have helped.', answer: 'had', difficulty: 2, hint: 'past perfect' },
      ],
    };

    const result = clozeExerciseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects difficulty outside 1-3 range', () => {
    const invalid = {
      exercises: [
        { sentence: 'Test ___', answer: 'test', difficulty: 5 },
      ],
    };

    const result = clozeExerciseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects difficulty of 0', () => {
    const invalid = {
      exercises: [
        { sentence: 'Test ___', answer: 'test', difficulty: 0 },
      ],
    };

    const result = clozeExerciseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('cloze prompts', () => {
  it('CLOZE_SYSTEM_PROMPT mentions B1-B2 level and difficulty levels', () => {
    expect(CLOZE_SYSTEM_PROMPT).toContain('B1-B2');
    expect(CLOZE_SYSTEM_PROMPT).toContain('difficulty');
  });

  it('buildClozePrompt includes pattern and count', () => {
    const prompt = buildClozePrompt('would have + V3', 'Third conditional', 6);
    expect(prompt).toContain('would have + V3');
    expect(prompt).toContain('6');
    expect(prompt).toContain('Third conditional');
  });
});

describe('generateClozeExercises', () => {
  it('generates exercises and stores them in DB', async () => {
    const mockExercises = {
      exercises: [
        { sentence: 'She ___ gone to the party.', answer: 'would have', difficulty: 1 },
        { sentence: 'If he ___ studied harder, he would have passed.', answer: 'had', difficulty: 2, hint: 'past perfect' },
        { sentence: 'They ___ been surprised if she had arrived on time.', answer: 'would have', difficulty: 3 },
      ],
    };

    mockedGenerateText.mockResolvedValueOnce({
      output: mockExercises,
      text: '',
      reasoning: undefined,
      reasoningDetails: [],
      sources: [],
      files: [],
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { id: 'test', timestamp: new Date(), modelId: 'test', headers: {} },
      request: {},
      steps: [],
      experimental_providerMetadata: undefined,
      providerMetadata: undefined,
    } as any);

    const count = await generateClozeExercises(
      db,
      testPatternId,
      'would have + V3',
      'Third conditional',
      3,
    );

    expect(count).toBe(3);
    expect(mockedGenerateText).toHaveBeenCalledOnce();

    // Verify exercises are in DB
    const stored = await db
      .select()
      .from(grammarExercises)
      .where(sql`${grammarExercises.grammarPatternId} = ${testPatternId}`);

    expect(stored.length).toBe(3);
    expect(stored.some((e) => e.difficultyLevel === 1)).toBe(true);
    expect(stored.some((e) => e.difficultyLevel === 2)).toBe(true);
    expect(stored.some((e) => e.difficultyLevel === 3)).toBe(true);

    // Verify sentence contains blank
    for (const ex of stored) {
      expect(ex.sentence).toContain('___');
      expect(ex.clozeAnswer).toBeTruthy();
    }
  });

  it('throws when AI returns no exercises', async () => {
    mockedGenerateText.mockResolvedValueOnce({
      output: { exercises: [] },
      text: '',
      reasoning: undefined,
      reasoningDetails: [],
      sources: [],
      files: [],
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { id: 'test', timestamp: new Date(), modelId: 'test', headers: {} },
      request: {},
      steps: [],
      experimental_providerMetadata: undefined,
      providerMetadata: undefined,
    } as any);

    await expect(
      generateClozeExercises(db, testPatternId, 'test', 'test', 3),
    ).rejects.toThrow('AI returned no exercises');
  });
});
