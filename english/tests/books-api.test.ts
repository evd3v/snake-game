// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';

const FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'test.epub');

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();

  // Apply migration for books tables
  const migration = readFileSync(
    path.join(import.meta.dirname, '..', 'drizzle', '0006_books.sql'),
    'utf-8',
  );

  // Split by statement and execute each (skip empty)
  const statements = migration.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await app.db.execute(sql.raw(stmt));
  }
});

afterAll(async () => {
  // Clean up tables
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS reading_positions CASCADE'));
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS book_sentences CASCADE'));
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS book_chapters CASCADE'));
  await app.db.execute(sql.raw('DROP TABLE IF EXISTS books CASCADE'));
  await cleanupTestApp(app);
});

function createMultipartPayload(filePath: string, filename: string, mimetype: string) {
  const fileContent = readFileSync(filePath);
  const boundary = '----TestBoundary' + Date.now();
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileContent, footer]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Books API', () => {
  let uploadedBookId: number;

  it('POST /books/upload returns 201 with book data', async () => {
    const { body, contentType } = createMultipartPayload(
      FIXTURE_PATH,
      'test.epub',
      'application/epub+zip',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/books/upload',
      payload: body,
      headers: { 'content-type': contentType },
    });

    expect(response.statusCode).toBe(201);
    const data = response.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Test Book');
    expect(data.totalPages).toBeGreaterThan(0);
    uploadedBookId = data.id;
  });

  it('POST /books/upload rejects non-EPUB files', async () => {
    const { body, contentType } = createMultipartPayload(
      FIXTURE_PATH,
      'test.txt',
      'text/plain',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/books/upload',
      payload: body,
      headers: { 'content-type': contentType },
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /books returns array with uploaded book', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/books',
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    const book = data.find((b: { id: number }) => b.id === uploadedBookId);
    expect(book).toBeDefined();
    expect(book.title).toBe('Test Book');
    expect(book.author).toBe('Test Author');
    expect(book.totalPages).toBeGreaterThan(0);
  });

  it('sentences have correct page numbers (groups of ~6)', async () => {
    const rows = await app.db.execute(
      sql.raw(`SELECT page_number, COUNT(*) as cnt FROM book_sentences WHERE book_id = ${uploadedBookId} GROUP BY page_number ORDER BY page_number`),
    );

    // Each page should have roughly 6 sentences (except possibly merged final pages)
    for (const row of rows.rows) {
      const count = Number(row.cnt);
      // Pages should have between 1 and 9 sentences (6 + up to 3 merged from short final page)
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(9);
    }
  });

  it('DELETE /books/:id returns 204 and removes book', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/books/${uploadedBookId}`,
    });

    expect(response.statusCode).toBe(204);

    // Verify book is gone
    const listResponse = await app.inject({
      method: 'GET',
      url: '/books',
    });

    const data = listResponse.json();
    const book = data.find((b: { id: number }) => b.id === uploadedBookId);
    expect(book).toBeUndefined();
  });

  it('DELETE /books/:id returns 404 for non-existent book', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/books/99999',
    });

    expect(response.statusCode).toBe(404);
  });
});
