// Requires: docker compose up -d postgres && npm run db:push
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from '../src/db/index.ts';
import * as schema from '../src/db/schema/index.ts';

let db: Database;

beforeAll(() => {
  db = createDb(process.env.DATABASE_URL!);
});

afterAll(async () => {
  // Clean up any test data
  await db.delete(schema.sentences).where(
    sql`${schema.sentences.sourceBook} = 'test-suite'`,
  );
});

describe('Database connection and schema', () => {
  it('has all expected schema tables', async () => {
    const result = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );

    const tableNames = result.rows.map((r: Record<string, unknown>) => r.table_name);

    const expectedTables = [
      'collocations',
      'grammar_patterns',
      'sentence_collocations',
      'sentence_grammar_patterns',
      'sentence_words',
      'sentences',
      'srs_cards',
      'word_families',
      'words',
    ];

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('can insert and query a sentence', async () => {
    const inserted = await db
      .insert(schema.sentences)
      .values({
        text: 'The quick brown fox jumps over the lazy dog.',
        translation: 'Test translation',
        cefrLevel: 'B1',
        sourceBook: 'test-suite',
      })
      .returning();

    expect(inserted).toHaveLength(1);
    expect(inserted[0].text).toBe('The quick brown fox jumps over the lazy dog.');
    expect(inserted[0].cefrLevel).toBe('B1');

    const found = await db
      .select()
      .from(schema.sentences)
      .where(sql`${schema.sentences.id} = ${inserted[0].id}`);

    expect(found).toHaveLength(1);
    expect(found[0].translation).toBe('Test translation');
  });
});
