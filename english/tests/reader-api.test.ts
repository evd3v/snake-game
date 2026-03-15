// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';

const FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'test.epub');

let app: FastifyInstance;
let bookId: number;
let totalPages: number;

beforeAll(async () => {
  app = await buildTestApp();

  // Apply migration for books tables
  const migration = readFileSync(
    path.join(import.meta.dirname, '..', 'drizzle', '0006_books.sql'),
    'utf-8',
  );
  const statements = migration.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await app.db.execute(sql.raw(stmt));
  }

  // Upload a test EPUB to create book with sentences
  const fileContent = readFileSync(FIXTURE_PATH);
  const boundary = '----TestBoundary' + Date.now();
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="test.epub"\r\n` +
    `Content-Type: application/epub+zip\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileContent, footer]);

  const response = await app.inject({
    method: 'POST',
    url: '/books/upload',
    payload: body,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });

  const data = response.json();
  bookId = data.id;
  totalPages = data.totalPages;
});

afterAll(async () => {
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS reading_positions CASCADE'));
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS book_sentences CASCADE'));
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS book_chapters CASCADE'));
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS books CASCADE'));
  await cleanupTestApp(app);
});

describe('Reader API', () => {
  it('GET /books/:id/page/0 returns sentences with highlights', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/books/${bookId}/page/0`,
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.bookId).toBe(bookId);
    expect(data.pageNumber).toBe(0);
    expect(data.totalPages).toBe(totalPages);
    expect(data.savedPosition).toBeNull();
    expect(Array.isArray(data.sentences)).toBe(true);
    expect(data.sentences.length).toBeGreaterThan(0);

    // Each sentence should have id, text, and highlights array
    const sentence = data.sentences[0];
    expect(sentence.id).toBeDefined();
    expect(sentence.text).toBeDefined();
    expect(Array.isArray(sentence.highlights)).toBe(true);
  });

  it('GET /books/:id/page/999 returns empty sentences (no error)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/books/${bookId}/page/999`,
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.sentences).toEqual([]);
    expect(data.pageNumber).toBe(999);
  });

  it('GET /books/999/page/0 returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/books/999/page/0',
    });

    expect(response.statusCode).toBe(404);
  });

  it('PUT /books/:id/position saves reading position', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/books/${bookId}/position`,
      payload: { pageNumber: 5 },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.ok).toBe(true);
  });

  it('GET /books/:id/page/0 returns savedPosition after PUT', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/books/${bookId}/page/0`,
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.savedPosition).toBe(5);
  });

  it('PUT /books/:id/position twice updates (upsert)', async () => {
    // Update position to 10
    await app.inject({
      method: 'PUT',
      url: `/books/${bookId}/position`,
      payload: { pageNumber: 10 },
    });

    // Verify it was updated, not duplicated
    const response = await app.inject({
      method: 'GET',
      url: `/books/${bookId}/page/0`,
    });

    const data = response.json();
    expect(data.savedPosition).toBe(10);

    // Verify only one row exists for this book
    const countResult = await app.db.execute(
      sql.raw(`SELECT COUNT(*) as cnt FROM reading_positions WHERE book_id = ${bookId}`),
    );
    expect(Number(countResult.rows[0].cnt)).toBe(1);
  });
});
