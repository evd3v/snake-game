import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from '../src/db/index.ts';
import { words, sentenceWords } from '../src/db/schema/words.ts';
import { wordSenses } from '../src/db/schema/word-senses.ts';
import { wordFamilies } from '../src/db/schema/word-families.ts';
import { linkWordFamilies } from '../src/services/word-family.ts';

let db: Database;

beforeAll(() => {
  db = createDb(process.env.DATABASE_URL!);
});

afterEach(async () => {
  // Clean up in correct order (FK constraints)
  await db.delete(sentenceWords).where(sql`1=1`);
  await db.delete(wordSenses).where(sql`1=1`);
  await db.delete(words).where(sql`1=1`);
  await db.delete(wordFamilies).where(sql`1=1`);
});

afterAll(async () => {
  // Final cleanup
  await db.delete(sentenceWords).where(sql`1=1`);
  await db.delete(wordSenses).where(sql`1=1`);
  await db.delete(words).where(sql`1=1`);
  await db.delete(wordFamilies).where(sql`1=1`);
});

describe('linkWordFamilies', () => {
  it('creates new word family and links words', async () => {
    // Insert two words that belong to the same family
    const [w1] = await db
      .insert(words)
      .values({ lemma: 'reluctant', cefrLevel: 'B2' })
      .returning();
    const [w2] = await db
      .insert(words)
      .values({ lemma: 'reluctance', cefrLevel: 'B2' })
      .returning();

    const insertedWords = new Map<string, number>([
      ['reluctant', w1.id],
      ['reluctance', w2.id],
    ]);

    await linkWordFamilies(
      db,
      [{ root: 'reluctant', forms: ['reluctant', 'reluctance'] }],
      insertedWords,
    );

    // Both words should now share the same word_family_id
    const updatedWords = await db
      .select({ id: words.id, lemma: words.lemma, wordFamilyId: words.wordFamilyId })
      .from(words);

    expect(updatedWords).toHaveLength(2);
    expect(updatedWords[0].wordFamilyId).not.toBeNull();
    expect(updatedWords[0].wordFamilyId).toBe(updatedWords[1].wordFamilyId);

    // word_families row should exist
    const families = await db.select().from(wordFamilies);
    expect(families).toHaveLength(1);
    expect(families[0].rootWord).toBe('reluctant');
  });

  it('reuses existing word family when form already linked', async () => {
    // Create a word family first
    const [family] = await db
      .insert(wordFamilies)
      .values({ rootWord: 'reluctant' })
      .returning();

    // Insert word with existing word_family_id
    const [w1] = await db
      .insert(words)
      .values({
        lemma: 'reluctant',
        cefrLevel: 'B2',
        wordFamilyId: family.id,
      })
      .returning();

    // Insert new word without family
    const [w2] = await db
      .insert(words)
      .values({ lemma: 'reluctantly', cefrLevel: 'B2' })
      .returning();

    const insertedWords = new Map<string, number>([
      ['reluctant', w1.id],
      ['reluctantly', w2.id],
    ]);

    await linkWordFamilies(
      db,
      [{ root: 'reluctant', forms: ['reluctant', 'reluctantly'] }],
      insertedWords,
    );

    // Both should share the pre-existing family id
    const updatedWords = await db
      .select({ id: words.id, wordFamilyId: words.wordFamilyId })
      .from(words);

    expect(updatedWords).toHaveLength(2);
    for (const w of updatedWords) {
      expect(w.wordFamilyId).toBe(family.id);
    }

    // No new family created
    const families = await db.select().from(wordFamilies);
    expect(families).toHaveLength(1);
  });
});
