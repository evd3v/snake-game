import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseEpub } from '../src/services/epub-parser.ts';

const FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'test.epub');

describe('parseEpub', () => {
  it('extracts title and author from EPUB metadata', async () => {
    const result = await parseEpub(FIXTURE_PATH);
    expect(result.title).toBe('Test Book');
    expect(result.author).toBe('Test Author');
  });

  it('extracts chapters in spine order, skipping short ones', async () => {
    const result = await parseEpub(FIXTURE_PATH);
    // The "short" chapter (< 20 chars) should be skipped
    // Only chapter1 and chapter2 should remain
    expect(result.chapters.length).toBe(2);
  });

  it('assigns sequential order to chapters', async () => {
    const result = await parseEpub(FIXTURE_PATH);
    expect(result.chapters[0].order).toBe(0);
    expect(result.chapters[1].order).toBe(1);
  });

  it('extracts non-empty sentences from each chapter', async () => {
    const result = await parseEpub(FIXTURE_PATH);
    for (const chapter of result.chapters) {
      expect(chapter.sentences.length).toBeGreaterThan(0);
      for (const sentence of chapter.sentences) {
        expect(typeof sentence).toBe('string');
        expect(sentence.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('has a reasonable number of total sentences (~15)', async () => {
    const result = await parseEpub(FIXTURE_PATH);
    const total = result.chapters.reduce((sum, ch) => sum + ch.sentences.length, 0);
    // Our test EPUB has ~15 sentences across 2 chapters
    expect(total).toBeGreaterThanOrEqual(10);
    expect(total).toBeLessThanOrEqual(25);
  });

  it('normalizes whitespace (no non-breaking spaces)', async () => {
    const result = await parseEpub(FIXTURE_PATH);
    for (const chapter of result.chapters) {
      for (const sentence of chapter.sentences) {
        expect(sentence).not.toContain('\u00A0');
      }
    }
  });
});
