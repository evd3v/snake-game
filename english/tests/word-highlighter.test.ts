import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';
import { tokenize, highlightSentences } from '../src/services/word-highlighter.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();

  // Insert test words and senses
  await app.db.execute(sql.raw(`
    INSERT INTO words (lemma) VALUES ('hello') ON CONFLICT DO NOTHING;
    INSERT INTO words (lemma) VALUES ('run') ON CONFLICT DO NOTHING;
    INSERT INTO words (lemma) VALUES ('beautiful') ON CONFLICT DO NOTHING;
  `));

  // Get word IDs
  const helloRow = await app.db.execute(sql.raw(`SELECT id FROM words WHERE lemma = 'hello'`));
  const runRow = await app.db.execute(sql.raw(`SELECT id FROM words WHERE lemma = 'run'`));
  const beautifulRow = await app.db.execute(sql.raw(`SELECT id FROM words WHERE lemma = 'beautiful'`));

  const helloId = helloRow.rows[0].id;
  const runId = runRow.rows[0].id;
  const beautifulId = beautifulRow.rows[0].id;

  // hello: never_seen (status = "new")
  await app.db.execute(sql.raw(`
    INSERT INTO word_senses (word_id, part_of_speech, familiarity)
    VALUES (${helloId}, 'noun', 'never_seen')
    ON CONFLICT (word_id, part_of_speech) DO UPDATE SET familiarity = 'never_seen'
  `));

  // run: has active SRS card (status = "learning")
  await app.db.execute(sql.raw(`
    INSERT INTO word_senses (word_id, part_of_speech, familiarity)
    VALUES (${runId}, 'verb', 'seen_unsure')
    ON CONFLICT (word_id, part_of_speech) DO UPDATE SET familiarity = 'seen_unsure'
  `));
  const runSenseRow = await app.db.execute(sql.raw(`SELECT id FROM word_senses WHERE word_id = ${runId}`));
  const runSenseId = runSenseRow.rows[0].id;
  await app.db.execute(sql.raw(`
    INSERT INTO srs_cards (card_type, word_sense_id, state)
    VALUES ('vocabulary', ${runSenseId}, 'learning')
  `));

  // beautiful: known (understand_in_context, no active SRS)
  await app.db.execute(sql.raw(`
    INSERT INTO word_senses (word_id, part_of_speech, familiarity)
    VALUES (${beautifulId}, 'adjective', 'understand_in_context')
    ON CONFLICT (word_id, part_of_speech) DO UPDATE SET familiarity = 'understand_in_context'
  `));
});

afterAll(async () => {
  // Clean up test data
  await app.db.execute(sql.raw(`DELETE FROM srs_cards WHERE word_sense_id IN (SELECT id FROM word_senses WHERE word_id IN (SELECT id FROM words WHERE lemma IN ('hello', 'run', 'beautiful')))`));
  await app.db.execute(sql.raw(`DELETE FROM word_senses WHERE word_id IN (SELECT id FROM words WHERE lemma IN ('hello', 'run', 'beautiful'))`));
  await app.db.execute(sql.raw(`DELETE FROM words WHERE lemma IN ('hello', 'run', 'beautiful')`));
  await cleanupTestApp(app);
});

describe('tokenize', () => {
  it('splits words and punctuation with correct offsets', () => {
    const tokens = tokenize('Hello, world!');
    const wordTokens = tokens.filter(t => t.isWord);
    expect(wordTokens).toHaveLength(2);
    expect(wordTokens[0].word).toBe('Hello');
    expect(wordTokens[0].offset).toBe(0);
    expect(wordTokens[1].word).toBe('world');
    expect(wordTokens[1].offset).toBe(7);
  });

  it('handles contractions as word tokens', () => {
    const tokens = tokenize("don't stop");
    const wordTokens = tokens.filter(t => t.isWord);
    expect(wordTokens).toHaveLength(2);
    expect(wordTokens[0].word).toBe("don't");
  });
});

describe('highlightSentences', () => {
  it('returns status "new" for never_seen word', async () => {
    const sentences = [{ id: 1, text: 'Hello there.' }];
    const result = await highlightSentences(app.db, sentences);
    const highlights = result.get(1)!;
    const helloHighlight = highlights.find(h => h.word.toLowerCase() === 'hello');
    expect(helloHighlight).toBeDefined();
    expect(helloHighlight!.status).toBe('new');
  });

  it('returns status "learning" for word with active SRS card', async () => {
    const sentences = [{ id: 2, text: 'I run fast.' }];
    const result = await highlightSentences(app.db, sentences);
    const highlights = result.get(2)!;
    const runHighlight = highlights.find(h => h.word.toLowerCase() === 'run');
    expect(runHighlight).toBeDefined();
    expect(runHighlight!.status).toBe('learning');
  });

  it('returns status "known" for understood word without active SRS', async () => {
    const sentences = [{ id: 3, text: 'A beautiful day.' }];
    const result = await highlightSentences(app.db, sentences);
    const highlights = result.get(3)!;
    const beautifulHighlight = highlights.find(h => h.word.toLowerCase() === 'beautiful');
    expect(beautifulHighlight).toBeDefined();
    expect(beautifulHighlight!.status).toBe('known');
  });

  it('returns status null for word not in vocabulary', async () => {
    const sentences = [{ id: 4, text: 'Xylophone plays.' }];
    const result = await highlightSentences(app.db, sentences);
    const highlights = result.get(4)!;
    const xyloHighlight = highlights.find(h => h.word.toLowerCase() === 'xylophone');
    expect(xyloHighlight).toBeDefined();
    expect(xyloHighlight!.status).toBeNull();
  });

  it('returns status null for punctuation tokens', async () => {
    const sentences = [{ id: 5, text: 'Hello, world!' }];
    const result = await highlightSentences(app.db, sentences);
    const highlights = result.get(5)!;
    // Only word tokens are returned (punctuation is excluded)
    for (const h of highlights) {
      expect(h.word).toMatch(/\w/);
    }
  });

  it('batches multiple sentences in one call', async () => {
    const sentences = [
      { id: 10, text: 'Hello there.' },
      { id: 11, text: 'I run fast.' },
      { id: 12, text: 'A beautiful day.' },
    ];
    const result = await highlightSentences(app.db, sentences);
    expect(result.size).toBe(3);
    expect(result.get(10)).toBeDefined();
    expect(result.get(11)).toBeDefined();
    expect(result.get(12)).toBeDefined();

    // Verify correct statuses across sentences
    const helloH = result.get(10)!.find(h => h.word.toLowerCase() === 'hello');
    expect(helloH!.status).toBe('new');
    const runH = result.get(11)!.find(h => h.word.toLowerCase() === 'run');
    expect(runH!.status).toBe('learning');
    const beautifulH = result.get(12)!.find(h => h.word.toLowerCase() === 'beautiful');
    expect(beautifulH!.status).toBe('known');
  });
});
