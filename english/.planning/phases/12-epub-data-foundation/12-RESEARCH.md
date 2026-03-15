# Phase 12: EPUB Data Foundation - Research

**Researched:** 2026-03-15
**Domain:** EPUB parsing, file upload, sentence splitting, database schema design
**Confidence:** HIGH

## Summary

Phase 12 adds EPUB book upload, parsing, and structured storage to the existing English learning app. The backend (Fastify + PostgreSQL + Drizzle ORM) needs a file upload endpoint, EPUB parsing to extract chapters and text, sentence boundary detection to split text into individually addressable sentences, and pagination into "pages" of 5-7 sentences. The frontend (Vue 3) needs a library view showing uploaded books and a file upload component.

The core technical challenges are: (1) choosing the right EPUB parser that provides structured chapter access with HTML content extraction, (2) reliable sentence boundary detection for English text extracted from EPUB HTML, (3) designing the database schema to support the hierarchical book > chapter > page > sentence structure efficiently, and (4) handling cover image extraction and storage.

**Primary recommendation:** Use `epub2` for EPUB parsing (proven, simple API, works with `getChapter` returning HTML), `cheerio` for HTML-to-text extraction, `sbd` for sentence boundary detection, and `@fastify/multipart` for file upload. Store EPUB files on disk (Docker volume), extracted data in PostgreSQL.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EPUB-01 | User uploads EPUB via web interface | @fastify/multipart for upload endpoint; Vue file input component; disk storage for EPUB files |
| EPUB-02 | System parses EPUB into chapters, pages (5-7 sentences), individual sentences stored in DB | epub2 for chapter extraction, cheerio for HTML-to-text, sbd for sentence splitting, Drizzle schema for books/chapters/sentences |
| EPUB-03 | User sees library of books with title and cover, can switch between them | epub2 metadata extraction (title, creator, cover), API endpoints for book listing |
| EPUB-04 | User can delete a book and all associated data | CASCADE delete on book_chapters and book_sentences foreign keys |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| epub2 | 3.0.2 | Parse EPUB files, extract chapters and metadata | Simple proven API: `getChapter(id)` returns HTML, `flow` gives chapter list, `metadata` gives title/creator. TypeScript support. |
| cheerio | 1.0.x | Extract plain text from EPUB chapter HTML | Industry standard HTML parser for Node.js. `$('body').text()` strips tags cleanly. Handles malformed XHTML gracefully. |
| sbd | 1.0.19 | Split extracted text into sentences | Rule-based sentence boundary detection (~95% accuracy). Handles abbreviations (Mr., Mrs., Dr.), URLs, decimals. Zero dependencies. |
| @fastify/multipart | 9.4.0 | Handle EPUB file upload via multipart form | Official Fastify plugin for file uploads. Already used pattern in the ecosystem. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | 0.45.1 (existing) | Schema definition and queries for new tables | Already in project -- extend with book tables |
| zod | 4.3.6 (existing) | Validate upload parameters | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| epub2 | @smoores/epub 0.1.9 | Newer, actively maintained, but v0.x (unstable API), focused on EPUB creation/editing more than reading. epub2 is simpler for read-only parsing. |
| epub2 | @gxl/epub-parser | TypeScript-first, but less widely used. epub2 has proven track record. |
| sbd | @stdlib/nlp-sentencize | stdlib is well-tested but heavy dependency tree. sbd is lightweight and purpose-built. |
| cheerio | html-to-text | html-to-text produces formatted text with whitespace; cheerio gives more control over element selection. |

**Installation:**
```bash
npm install epub2 cheerio sbd @fastify/multipart
npm install -D @types/sbd
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  db/schema/
    books.ts              # books, book_chapters, book_sentences tables
  routes/
    books.ts              # CRUD endpoints for books, upload
  services/
    epub-parser.ts        # EPUB parsing + sentence splitting logic
  plugins/
    multipart.ts          # Register @fastify/multipart plugin
web/src/
  views/
    LibraryView.vue       # Book library with upload
  api/
    client.ts             # Add upload helper (multipart/form-data)
```

### Pattern 1: Synchronous Processing (not queue-based)
**What:** Process EPUB immediately during upload request, not via BullMQ
**When to use:** EPUB parsing is fast (seconds for a typical book), no AI calls needed
**Why:** Unlike sentence analysis which calls AI (slow, expensive), EPUB parsing is pure computation -- unzipping, HTML parsing, sentence splitting. A 300-page book processes in under 5 seconds. Queue adds complexity without benefit here.
```typescript
// POST /books/upload -- synchronous processing
fastify.post('/books/upload', async (request, reply) => {
  const file = await request.file();
  const buffer = await file.toBuffer();

  // Save EPUB to disk
  const filePath = path.join(UPLOAD_DIR, `${bookId}.epub`);
  await fs.writeFile(filePath, buffer);

  // Parse synchronously -- fast operation
  const { metadata, chapters, sentences } = await parseEpub(buffer);

  // Store in DB
  await db.transaction(async (tx) => {
    const [book] = await tx.insert(books).values({ ... }).returning();
    // ... insert chapters and sentences
  });

  return reply.status(201).send({ bookId: book.id, title: metadata.title });
});
```

### Pattern 2: Hierarchical Data with Computed Pages
**What:** Store sentences with chapter + order position; compute pages (groups of 5-7) at query time or store page_number on each sentence
**When to use:** This phase -- pages are just groups of sequential sentences
**Why:** Storing page_number directly on sentences is simpler than a separate pages table. A page is just `WHERE book_id = ? AND page_number = ? ORDER BY order_in_chapter`.
```typescript
// Pre-compute page numbers during parsing
let globalSentenceOrder = 0;
let currentPage = 0;
let sentencesOnPage = 0;

for (const sentence of chapterSentences) {
  if (sentencesOnPage >= PAGE_SIZE) { // PAGE_SIZE = 6 (target 5-7)
    currentPage++;
    sentencesOnPage = 0;
  }
  // Store with page_number for fast lookup
  sentenceRows.push({
    bookId, chapterId, text: sentence,
    orderInChapter: globalSentenceOrder++,
    pageNumber: currentPage,
  });
  sentencesOnPage++;
}
```

### Pattern 3: Cover Image as Base64 in DB
**What:** Extract cover image from EPUB and store as base64 string in the books table
**When to use:** Single-user app, covers are small (typically <200KB)
**Why:** Avoids file serving complexity. A cover image base64-encoded adds ~300KB to the DB row -- trivial for PostgreSQL. The library view loads all book covers at once (small library, single user).
```typescript
// Extract cover from EPUB
const coverId = epub.metadata.cover; // cover image manifest ID
if (coverId) {
  const [imageBuffer, mimeType] = await epub.getImageAsync(coverId);
  coverBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
}
```

### Anti-Patterns to Avoid
- **Separate pages table:** Over-engineering. Pages are just sentence groups -- store page_number on sentences.
- **Storing full EPUB HTML in DB:** Only store extracted plain text sentences. HTML is throwaway after parsing.
- **Queue-based processing for EPUB parsing:** Unnecessary complexity. Parsing is fast, no AI involved.
- **Client-side EPUB rendering (epub.js):** Already decided against in REQUIREMENTS.md -- incompatible with per-sentence interaction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EPUB zip extraction | Custom zip parsing | epub2 library | EPUB is a complex zip-based format with OPF manifests, NCX/nav, content negotiation |
| Sentence boundary detection | Regex split on `.` | sbd library | Abbreviations (Mr., Dr., U.S.), decimal numbers, URLs, ellipsis, quotes after periods |
| HTML to text | Regex strip tags | cheerio | Nested elements, entities (&amp;, &nbsp;), self-closing tags, malformed XHTML |
| Multipart upload parsing | Manual body parsing | @fastify/multipart | Boundary detection, encoding, large file streaming, content-type validation |

**Key insight:** Sentence splitting looks trivial but has dozens of edge cases. `sbd` handles ~95% correctly out of the box. Rolling your own regex will fail on "Dr. Smith went to Washington. He arrived at 3 p.m." (splitting on "Dr." and "p.m.").

## Common Pitfalls

### Pitfall 1: EPUB Chapter Order
**What goes wrong:** Chapters appear in wrong order in the reader
**Why it happens:** EPUB manifest order differs from spine order. The `spine` defines reading order, `manifest` is just a file list.
**How to avoid:** Use `epub.flow` (epub2) which gives spine-ordered chapters, not manifest order.
**Warning signs:** Table of contents doesn't match page sequence.

### Pitfall 2: Empty/Non-Text Chapters
**What goes wrong:** Blank pages or error pages in the reader
**Why it happens:** EPUBs include non-text spine items: cover pages, title pages, copyright pages, dedication pages with only images.
**How to avoid:** After extracting text, skip chapters that produce fewer than 1-2 actual sentences. Filter out chapters where `text.trim().length < 20`.
**Warning signs:** First few "pages" are blank or have single words.

### Pitfall 3: HTML Entity and Encoding Issues
**What goes wrong:** Sentences contain `&amp;`, `&nbsp;`, `&#x2019;` instead of actual characters
**Why it happens:** EPUB content is XHTML; cheerio `.text()` decodes most entities but `&nbsp;` becomes `\u00A0` (non-breaking space) which looks like a space but isn't.
**How to avoid:** After `.text()`, normalize whitespace: `text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim()`.
**Warning signs:** Double spaces, text comparison failures, weird spacing in the reader.

### Pitfall 4: Sentence Splitting on Dialogue
**What goes wrong:** `"Hello," she said. "How are you?"` splits incorrectly
**Why it happens:** Sentence splitters can break on dialogue tags mid-sentence
**How to avoid:** Use `sbd` with default options -- it handles most dialogue patterns. Accept that ~5% of edge cases will have imperfect splits. This is acceptable for a reading app.
**Warning signs:** Very short "sentences" (1-2 words like `"she said."`).

### Pitfall 5: Page Boundaries at Chapter Boundaries
**What goes wrong:** Last page of a chapter has 1-2 sentences, next chapter starts a new page
**Why it happens:** Each chapter resets page counting independently
**How to avoid:** Make page counting chapter-aware: if last page of chapter has fewer than 3 sentences, merge with previous page (make it 8-9 sentences) rather than having a stub page.
**Warning signs:** Many pages with just 1-2 sentences.

### Pitfall 6: File Size Limits
**What goes wrong:** Server crashes or times out on large EPUB uploads
**Why it happens:** Default @fastify/multipart limits are too small for books (typically 1-20MB)
**How to avoid:** Configure `limits: { fileSize: 50 * 1024 * 1024 }` (50MB). Typical EPUB is 1-5MB, but image-heavy ones can be 20MB+.
**Warning signs:** Upload silently fails or times out.

## Code Examples

### EPUB Parsing Service
```typescript
// src/services/epub-parser.ts
import EPub from 'epub2';
import * as cheerio from 'cheerio';
import sbd from 'sbd';

interface ParsedBook {
  title: string;
  author: string | null;
  coverBase64: string | null;
  chapters: ParsedChapter[];
}

interface ParsedChapter {
  id: string;
  title: string;
  order: number;
  sentences: string[];
}

export async function parseEpub(filePath: string): Promise<ParsedBook> {
  const epub = await EPub.createAsync(filePath);

  // Extract metadata
  const title = epub.metadata.title || 'Untitled';
  const author = epub.metadata.creator || null;

  // Extract cover
  let coverBase64: string | null = null;
  const coverId = epub.metadata.cover;
  if (coverId) {
    try {
      const [data, mimeType] = await epub.getImageAsync(coverId);
      coverBase64 = `data:${mimeType};base64,${data.toString('base64')}`;
    } catch { /* no cover available */ }
  }

  // Extract chapters from spine order
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < epub.flow.length; i++) {
    const chapter = epub.flow[i];
    try {
      const html = await epub.getChapterAsync(chapter.id);
      const $ = cheerio.load(html);
      const text = $('body').text()
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length < 20) continue; // Skip empty/cover chapters

      const sentences = sbd.sentences(text, { newline_boundaries: true });
      if (sentences.length === 0) continue;

      chapters.push({
        id: chapter.id,
        title: chapter.title || `Chapter ${chapters.length + 1}`,
        order: chapters.length,
        sentences,
      });
    } catch { /* skip unreadable chapters */ }
  }

  return { title, author, coverBase64, chapters };
}
```

### Database Schema
```typescript
// src/db/schema/books.ts
import { pgTable, integer, text, timestamp, serial } from 'drizzle-orm/pg-core';

export const books = pgTable('books', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  author: text(),
  coverBase64: text('cover_base64'),
  filePath: text('file_path'), // path to stored .epub file
  totalPages: integer('total_pages').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookChapters = pgTable('book_chapters', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookSentences = pgTable('book_sentences', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').notNull().references(() => bookChapters.id, { onDelete: 'cascade' }),
  text: text().notNull(),
  orderInChapter: integer('order_in_chapter').notNull(),
  pageNumber: integer('page_number').notNull(), // pre-computed page group
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const readingPositions = pgTable('reading_positions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }).unique(),
  pageNumber: integer('page_number').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### File Upload Endpoint
```typescript
// src/routes/books.ts
import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { books, bookChapters, bookSentences, readingPositions } from '../db/schema/books.ts';
import { parseEpub } from '../services/epub-parser.ts';

const PAGE_SIZE = 6; // target 5-7 sentences per page

const booksRoute: FastifyPluginAsync = async (fastify) => {
  // Upload EPUB
  fastify.post('/books/upload', async (request, reply) => {
    const file = await request.file();
    if (!file || file.mimetype !== 'application/epub+zip') {
      return reply.badRequest('EPUB file required');
    }

    const buffer = await file.toBuffer();
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file to disk
    const fileName = `${Date.now()}-${file.filename}`;
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);

    // Parse EPUB
    const parsed = await parseEpub(filePath);

    // Store in DB within transaction
    const result = await fastify.db.transaction(async (tx) => {
      const [book] = await tx.insert(books).values({
        title: parsed.title,
        author: parsed.author,
        coverBase64: parsed.coverBase64,
        filePath,
      }).returning();

      let totalPages = 0;
      for (const chapter of parsed.chapters) {
        const [dbChapter] = await tx.insert(bookChapters).values({
          bookId: book.id,
          title: chapter.title,
          orderIndex: chapter.order,
        }).returning();

        let sentencesOnPage = 0;
        for (let i = 0; i < chapter.sentences.length; i++) {
          if (sentencesOnPage >= PAGE_SIZE) {
            totalPages++;
            sentencesOnPage = 0;
          }
          await tx.insert(bookSentences).values({
            bookId: book.id,
            chapterId: dbChapter.id,
            text: chapter.sentences[i],
            orderInChapter: i,
            pageNumber: totalPages,
          });
          sentencesOnPage++;
        }
        if (sentencesOnPage > 0) totalPages++; // count last partial page
      }

      await tx.update(books).set({ totalPages }).where(eq(books.id, book.id));

      return { id: book.id, title: book.title, totalPages };
    });

    return reply.status(201).send(result);
  });

  // List all books
  fastify.get('/books', async () => {
    return fastify.db.select({
      id: books.id,
      title: books.title,
      author: books.author,
      coverBase64: books.coverBase64,
      totalPages: books.totalPages,
      createdAt: books.createdAt,
    }).from(books).orderBy(books.createdAt);
  });

  // Delete book (CASCADE handles chapters, sentences, reading position)
  fastify.delete<{ Params: { id: string } }>('/books/:id', async (request, reply) => {
    const bookId = Number(request.params.id);
    const [book] = await fastify.db.select({ filePath: books.filePath })
      .from(books).where(eq(books.id, bookId));

    if (!book) return reply.notFound();

    // Delete DB records (CASCADE)
    await fastify.db.delete(books).where(eq(books.id, bookId));

    // Delete file from disk
    if (book.filePath) {
      await fs.unlink(book.filePath).catch(() => {});
    }

    return reply.status(204).send();
  });
};

export default booksRoute;
```

### Multipart Plugin Registration
```typescript
// src/plugins/multipart.ts
import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';

export default fp(async function multipartPlugin(fastify) {
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
      files: 1,
    },
  });
}, { name: 'multipart' });
```

### Frontend Upload (Vue)
```typescript
// web/src/api/client.ts -- add upload helper
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    // Note: do NOT set Content-Type header -- browser sets it with boundary
  });
  if (!response.ok) {
    throw new Error(`Upload ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| epub (original) | epub2 (maintained fork) | 2022 | epub2 adds TypeScript types, Promise API, maintained |
| Custom sentence regex | sbd library | Stable since 2019 | Handles abbreviations, URLs, decimals properly |
| Server-side file serving for images | Base64 in DB for covers | N/A (design choice) | Simpler for single-user app, no static file serving needed |

**Note on @smoores/epub:** Version 0.1.9 (published March 2025) is actively developed and has a cleaner API, but it is still v0.x with a focus on EPUB creation/editing rather than reading. For a read-only use case, epub2 is more proven. If epub2 has issues with specific EPUB files, @smoores/epub is a viable fallback.

## Open Questions

1. **epub2 and modern ESM**
   - What we know: epub2 3.0.2 was published Sep 2023. The project uses `"type": "module"`.
   - What's unclear: Whether epub2 works cleanly with ESM imports or needs `require()` workarounds.
   - Recommendation: Test import during implementation. If ESM issues arise, use `createRequire` from `node:module` as a fallback. Alternatively, switch to @smoores/epub which is ESM-native.

2. **EPUB cover image extraction reliability**
   - What we know: epub2 exposes `metadata.cover` for the cover image manifest ID.
   - What's unclear: Not all EPUBs use the standard `cover` metadata. Some use `<meta name="cover" content="..."/>`, others have cover in the first spine item.
   - Recommendation: Try `metadata.cover` first, fall back to finding an image in the first manifest item whose properties include "cover-image". If no cover found, show a placeholder.

3. **Docker volume for uploads**
   - What we know: Current docker-compose.prod.yml only has `pgdata` volume.
   - What's unclear: Where to store uploaded EPUB files persistently in Docker.
   - Recommendation: Add `uploads:/app/uploads` volume to docker-compose.prod.yml for the `app` service.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --testPathPattern=books` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EPUB-01 | Upload EPUB file via POST /books/upload | integration | `npm test -- tests/books-api.test.ts` | No - Wave 0 |
| EPUB-02 | Parse EPUB into chapters/pages/sentences | unit | `npm test -- tests/epub-parser.test.ts` | No - Wave 0 |
| EPUB-03 | GET /books returns library with title and cover | integration | `npm test -- tests/books-api.test.ts` | No - Wave 0 |
| EPUB-04 | DELETE /books/:id removes book and all data | integration | `npm test -- tests/books-api.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/books-api.test.ts tests/epub-parser.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/epub-parser.test.ts` -- unit tests for EPUB parsing and sentence splitting (EPUB-02)
- [ ] `tests/books-api.test.ts` -- integration tests for book CRUD endpoints (EPUB-01, EPUB-03, EPUB-04)
- [ ] `tests/fixtures/test.epub` -- small test EPUB file for testing (can be programmatically generated or a tiny public domain book)
- [ ] npm install epub2 cheerio sbd @fastify/multipart -- dependencies needed before tests run

## Sources

### Primary (HIGH confidence)
- epub2 npm README -- API for getChapter, flow, metadata, getImage
- @fastify/multipart npm -- file upload plugin for Fastify
- sbd npm/GitHub -- sentence boundary detection API and options
- cheerio npm/GitHub -- HTML parsing and text extraction

### Secondary (MEDIUM confidence)
- @smoores/epub announcement (smoores.dev) -- API examples for Epub.from(), getTitle(), getSpineItems()
- npm publish dates -- epub2 last published Sep 2023, @smoores/epub actively maintained (Mar 2025)

### Tertiary (LOW confidence)
- epub2 ESM compatibility -- not verified, needs testing during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - epub2, cheerio, sbd are well-documented with clear APIs
- Architecture: HIGH - follows existing project patterns (Drizzle schema, Fastify routes, services)
- Pitfalls: HIGH - EPUB format quirks are well-known, sentence splitting edge cases documented
- epub2 ESM compat: MEDIUM - may need workaround for ESM imports

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, libraries mature)
