# Architecture Patterns

**Domain:** EPUB Reader with LingQ-style Word Tracking (integration into existing English learning app)
**Researched:** 2026-03-15
**Confidence:** HIGH (full codebase analysis + library research)

## Existing Architecture Recap

Current system: Fastify REST API + BullMQ worker + Telegram bot, all separate Docker containers. PostgreSQL + Drizzle ORM. Vue 3 SPA served via nginx. AI analysis via Vercel AI SDK (OpenAI/Anthropic). Key tables: `sentences`, `words`, `word_senses`, `collocations`, `grammar_patterns`, `srs_cards`. Analysis flow: POST sentence -> BullMQ job -> AI analysis -> `storeAnalysisResults()` upserts everything. The `word_senses` table already tracks POS-aware vocabulary with `familiarity` enum (`never_seen`, `seen_unsure`, `understand_in_context`).

## Recommended Architecture

### High-Level Data Flow

```
EPUB Upload -> Server parses EPUB -> Stores book metadata + chapter HTML in DB
                                  -> Splits chapters into pages (5-7 sentences each)

Reader View  -> Loads page of sentences with word status overlay
             -> User taps sentence -> Check cache -> If miss: queue AI analysis
             -> Analysis modal shows translation, words, collocations, grammar
             -> User marks words "learn" / "know" -> Updates word_senses.familiarity
             -> Page complete -> Mini-report -> Next page
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **EPUB Upload API** (new route) | Accepts .epub file, triggers server-side parsing | EPUB Parser service |
| **EPUB Parser Service** (new service) | Extracts metadata, chapters, splits into sentences/pages | Database (books, chapters, book_sentences) |
| **Book/Chapter Routes** (new routes) | CRUD for books, paginated chapter reading | Database, Analysis queue |
| **Sentence Analysis Cache** | Deduplicates AI calls for same sentence text | Existing `sentences` table (reuse) |
| **Reader Store** (new Pinia store) | Current book, page, reading position, word statuses | Book API, existing vocabulary store |
| **ReaderView** (new Vue view) | Renders sentences with word highlighting, sentence tap modal | Reader store, analysis API |
| **AnalysisModal** (new/reused component) | Shows AI analysis with learn/know buttons | Existing word/collocation APIs |

## 1. EPUB Storage Strategy

**Recommendation: Parse on upload, store structured data in PostgreSQL. Keep original EPUB file on filesystem as backup.**

Rationale:
- The reader needs sentences split and individually addressable (for analysis caching, word highlighting)
- Rendering raw EPUB in-browser (epub.js/foliate-js) would fight against the sentence-by-sentence interaction model
- Server-side parsing with `@smoores/epub` gives full control over HTML extraction
- Original file stored at `uploads/books/{bookId}.epub` (Docker volume) for re-parsing if needed

Why NOT epub.js/foliate-js in browser:
- epub.js renders EPUB as paginated iframes -- you cannot intercept individual sentences, inject word-status highlighting, or attach click handlers per sentence
- foliate-js requires WebKitGTK for full compatibility, tested mainly in Chromium/Firefox but not designed for fine-grained sentence-level interaction
- The LingQ-style flow requires sentence-level granularity that client-side EPUB renderers do not provide
- Server-side parsing is a one-time cost per book; reading is many times

Why NOT DB blob:
- EPUB files are 0.5-5MB typically, no benefit to storing binary in PostgreSQL
- Filesystem is simpler for backup/restore

### Server-Side Parsing Pipeline

```
1. Upload EPUB file via multipart form
2. Save to filesystem: uploads/books/{id}.epub
3. Parse with @smoores/epub: extract metadata (title, author, cover)
4. Iterate chapters in spine order
5. For each chapter: extract HTML content, strip tags to plain text
6. Split plain text into sentences using sentence boundary detection
7. Group sentences into pages (5-7 per page)
8. Store: book record, chapter records, book_sentences with page assignments
```

### Sentence Splitting Approach

Use `@stdlib/nlp-sentencize` for sentence boundary detection. It handles English edge cases (Mr., Mrs., Dr., U.S.A., ellipsis, quotes) correctly. Book prose is well-structured English, so a rule-based splitter works reliably here.

```typescript
import sentencize from '@stdlib/nlp-sentencize';

function splitIntoSentences(text: string): string[] {
  return sentencize(text).filter(s => s.trim().length > 0);
}

function groupIntoPages(sentences: string[], perPage: number = 6): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < sentences.length; i += perPage) {
    pages.push(sentences.slice(i, i + perPage));
  }
  return pages;
}
```

## 2. New Database Tables

### books

```typescript
export const books = pgTable('books', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  author: text(),
  coverPath: text('cover_path'),     // filesystem path to extracted cover image
  filePath: text('file_path'),        // path to original .epub file
  totalChapters: integer('total_chapters').default(0),
  totalSentences: integer('total_sentences').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### book_chapters

```typescript
export const bookChapters = pgTable('book_chapters', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  spineIndex: integer('spine_index').notNull(),  // order in EPUB spine
  title: text(),                                  // chapter title if available
  totalPages: integer('total_pages').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### book_sentences

This is the core table. Each sentence from a book is stored individually, linked to a chapter and assigned a page number within that chapter.

```typescript
export const bookSentences = pgTable('book_sentences', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  chapterId: integer('chapter_id').notNull().references(() => bookChapters.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),       // page within chapter (1-based)
  positionOnPage: integer('position_on_page').notNull(), // order on page (0-based)
  text: text().notNull(),                              // raw sentence text
  sentenceId: integer('sentence_id').references(() => sentences.id), // link to analysis cache (null = not yet analyzed)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Key design: `sentenceId` links to existing `sentences` table.** When a sentence is analyzed, the result goes into the existing `sentences` table (with all its word/collocation/grammar linkages), and `book_sentences.sentenceId` points to it. This reuses the entire existing analysis pipeline with zero modifications to `storeAnalysisResults()`.

### reading_positions

```typescript
export const readingPositions = pgTable('reading_positions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }).unique(),
  chapterId: integer('chapter_id').notNull().references(() => bookChapters.id),
  pageNumber: integer('page_number').notNull().default(1),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

Single-user app, so one position per book (unique on `bookId`).

### No separate sentence_analyses cache table needed

The existing `sentences` table already serves as a cache. Before calling AI, check if a sentence with identical `text` already exists in `sentences`. If yes, link `book_sentences.sentenceId` to it. The existing `sentenceWords`, `sentenceCollocations`, `sentenceGrammarPatterns` junction tables already hold all analysis results.

This means: if the same sentence appears in two different books, analysis is done once.

## 3. Sentence Analysis Integration with Existing Pipeline

### Connection to Existing Pipeline

The existing flow is:
```
POST /sentences { text, sourceBook } -> BullMQ job -> analyzeSentence() -> storeAnalysisResults()
```

For EPUB reader, the flow becomes:
```
User taps sentence in reader
  -> Frontend calls POST /reader/sentences/:bookSentenceId/analyze
  -> Backend checks: does book_sentences.sentenceId already exist?
     YES -> Return existing analysis immediately (cache hit)
     NO  -> Check if sentences table has a row with identical text
        YES -> Link book_sentences.sentenceId, return (cross-book cache hit)
        NO  -> Queue BullMQ job (same 'sentence-analysis' job type)
            -> Job completes -> storeAnalysisResults() creates sentence record
            -> Update book_sentences.sentenceId = new sentence.id
            -> Return analysis via job status polling
```

**Zero changes to `storeAnalysisResults()` core logic.** The `sourceBook` parameter already exists on `sentences` table -- populate it with book title. The function already upserts words, word_senses, collocations, grammar_patterns, and creates SRS cards.

### CEFR Filter Change for EPUB Flow

Per PROJECT.md: "remove A1/A2 filtering -- user decides via learn/know buttons."

Currently `storeAnalysisResults()` calls `shouldAutoAddWord(vocab.cefrLevel)` to skip SRS card creation for A1/A2 words. For the EPUB flow, the user interaction model is different:

**EPUB flow: Do NOT auto-create SRS cards during analysis.** In the analysis modal, show ALL extracted words/collocations regardless of CEFR level. User explicitly taps "learn" to create an SRS card, or "know" to update familiarity to `understand_in_context`.

Implementation approach -- add an option to `storeAnalysisResults()`:

```typescript
export async function storeAnalysisResults(
  db: Database,
  text: string,
  sourceBook: string | undefined,
  analysis: SentenceAnalysis,
  options?: { autoCreateSrsCards?: boolean },  // NEW
): Promise<{ sentenceId: number; ... }> {
  const autoSrs = options?.autoCreateSrsCards ?? true; // backward compatible

  // ... existing word/collocation/grammar upsert logic ...

  // Only create SRS cards if autoSrs is true (existing Telegram flow)
  if (autoSrs && shouldAutoAddWord(vocab.cefrLevel)) {
    // ... existing SRS card creation ...
  }
}
```

The Telegram bot flow continues using `autoCreateSrsCards: true` (default). The EPUB reader flow uses `autoCreateSrsCards: false`.

### New Endpoint: Mark Word from Reader Modal

```typescript
// POST /reader/words/:wordSenseId/mark
// Body: { action: 'learn' | 'know' }
//
// 'learn': set familiarity to 'seen_unsure', create SRS card if not exists
// 'know': set familiarity to 'understand_in_context', no SRS card
```

This is similar to the existing `PATCH /words/:id/familiarity` but combines familiarity update with conditional SRS card creation in one call.

## 4. Word Tokenization for Matching Against Existing word_senses

### Problem

Given a sentence like "She had been running for hours", the reader needs to highlight each word based on whether the user knows it. This requires matching surface forms in the text to existing `words` (lemmas) and `word_senses` records.

### Approach: Server-Side Tokenization and Status Lookup

```
1. Client requests page -> server returns sentences
2. Server also computes word statuses for ALL tokens on the page
3. For each sentence, server returns: text + array of { token, lemma, wordSenseId?, familiarity }
4. Client renders each word with appropriate color
```

**Why server-side, not client-side:**
- `wink-lemmatizer` is a Node.js library (not browser-compatible)
- The server already uses it for analysis
- Centralizing lemmatization avoids inconsistency between analysis-time and display-time lemma resolution

### Page Load Response Shape

```typescript
interface PageResponse {
  bookId: number;
  chapterId: number;
  pageNumber: number;
  totalPages: number;
  sentences: Array<{
    id: number;           // book_sentence id
    text: string;
    analyzed: boolean;    // has sentenceId (analysis exists)
    tokens: Array<{
      text: string;       // surface form as it appears
      lemma: string;      // normalized lemma
      wordSenseId: number | null;  // if word exists in word_senses
      familiarity: 'never_seen' | 'seen_unsure' | 'understand_in_context' | 'unknown';
    }>;
  }>;
}
```

The `tokens` array is computed server-side:
1. Split sentence text on whitespace and punctuation (keep punctuation as separate tokens for rendering)
2. For each word token, lemmatize with `normalizeLemma(token, 'verb')` and `normalizeLemma(token, 'noun')` etc.
3. Look up all candidate lemmas in `words` table -> get `word_senses` records
4. If any word_sense exists, return the one with highest familiarity (most known POS)
5. If no word_sense exists, return `familiarity: 'unknown'` (never encountered)

**Performance:** One page = ~50-100 unique tokens. Batch query: `SELECT * FROM words WHERE lemma IN (...) JOIN word_senses`. One DB round trip.

### Word Status Colors (LingQ-inspired)

| Familiarity | Color | Meaning |
|-------------|-------|---------|
| `unknown` (not in DB at all) | Blue background | Completely new word |
| `never_seen` | Blue background | In DB but user never interacted |
| `seen_unsure` | Yellow background | Learning |
| `understand_in_context` | No highlight | Known |

The existing `familiarityEnum` maps perfectly to LingQ's blue/yellow/white model. No schema change needed.

## 5. Frontend Routing and State Management

### New Routes

```typescript
// Add to existing router/index.ts
{
  path: '/books',
  name: 'books',
  component: () => import('../views/BooksView.vue'),
},
{
  path: '/books/:bookId/read',
  name: 'reader',
  component: () => import('../views/ReaderView.vue'),
  meta: { hideNav: true },  // full-screen reader, hide app navigation
},
```

### New Pinia Stores

**`stores/books.ts`** -- Book library management:
```typescript
// State: books list, upload status
// Actions: fetchBooks(), uploadBook(file: File), deleteBook(id: number)
```

**`stores/reader.ts`** -- Active reading session:
```typescript
// State:
//   currentBook: Book | null
//   currentChapterId: number
//   currentPage: number
//   totalPages: number
//   sentences: PageSentence[]     // current page with tokens
//   analysisResult: AnalysisData | null  // for modal
//   analyzingSentenceId: number | null   // loading state
//   pageStats: { newWords: number, markedLearn: number, markedKnow: number }
//
// Actions:
//   loadPage(bookId, chapterId, pageNumber)
//   analyzeSentence(bookSentenceId)  // triggers AI or returns cache
//   markWord(wordSenseId, action: 'learn' | 'know')
//   nextPage() / prevPage()
//   savePosition()
```

### ReaderView Component Structure

```
ReaderView.vue
  +-- ReaderHeader.vue          (book title, chapter, back button)
  +-- ReaderPage.vue            (renders 5-7 sentences)
  |     +-- ReaderSentence.vue  (single sentence with highlighted words, tap handler)
  |           +-- HighlightedWord.vue (individual word span with status-based CSS class)
  +-- AnalysisModal.vue         (bottom sheet: translation, words with learn/know, collocations, grammar)
  +-- PageReport.vue            (overlay on page turn: X new words seen, Y marked as learning)
```

### Mobile-First Design Considerations

The reader is primarily a mobile experience (reading on phone). Key requirements from PROJECT.md:
- Full viewport height, paginated (no scrolling within a page)
- Swipe left/right for page navigation (use `@vueuse/core` `useSwipe()`)
- Tap on sentence opens analysis as bottom sheet modal (not centered popup)
- Dark/night mode via CSS custom properties
- Large touch targets in analysis modal for learn/know buttons

### API Client Extension

Add multipart upload support to `web/src/api/client.ts`:

```typescript
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    // No Content-Type header -- browser sets multipart boundary automatically
  });
  if (!response.ok) {
    throw new Error(`Upload ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

## 6. Batch AI Analysis Strategy

### On-Demand Analysis with Next-Page Pre-fetch

**Do NOT pre-analyze entire books.**

Rationale:
- A typical book has 5,000-10,000 sentences
- At ~$0.01-0.02 per sentence with GPT-5.4 structured output, pre-analyzing costs $50-200 per book
- User may abandon a book after chapter 2
- On-demand means only read sentences incur cost
- The existing `sentences` table acts as a permanent cache -- re-reading is instant

### Queue Integration

Reuse the existing BullMQ `sentence-analysis` queue. Add a batch job type:

```typescript
// New job type in job-processor.ts
case 'batch-sentence-analysis': {
  const { bookSentenceIds, sourceBook } = job.data;
  const results = [];
  for (const bsId of bookSentenceIds) {
    // Load book_sentence, check if already analyzed
    // If not: run analyzeSentence(), storeAnalysisResults(), link
    // Sequential to avoid rate limits
    results.push(await analyzeSingleBookSentence(db, bsId, sourceBook));
  }
  return results;
}
```

### Pre-fetch Strategy

When user is reading page N, queue analysis for unanalyzed sentences on page N+1:

```typescript
// In the page-load route handler:
async function loadPageWithPrefetch(bookId, chapterId, pageNumber) {
  // 1. Return current page data immediately
  const currentPage = await getPageData(chapterId, pageNumber);

  // 2. Asynchronously queue next page pre-analysis
  const nextPageSentences = await getUnanalyzedSentences(chapterId, pageNumber + 1);
  if (nextPageSentences.length > 0) {
    await analysisQueue.add('batch-sentence-analysis', {
      bookSentenceIds: nextPageSentences.map(s => s.id),
      sourceBook: bookTitle,
    }, { priority: 10 }); // lower priority than user-triggered analysis
  }

  return currentPage;
}
```

By the time the user finishes tapping through 5-7 sentences on the current page, the next page is likely pre-analyzed.

### Rate Limiting

The existing worker processes jobs one at a time. For user-triggered analysis (tap on sentence), use priority 1 (highest). For pre-fetch batch, use priority 10. This ensures immediate response when user taps, while pre-fetch runs in background.

## 7. Suggested Build Order

Based on dependency analysis of existing codebase:

### Phase 1: Data Foundation (backend only, no UI)

1. **New DB schema** -- `books`, `book_chapters`, `book_sentences`, `reading_positions` in `src/db/schema/books.ts`
2. **EPUB parser service** -- `src/services/epub-parser.ts` using `@smoores/epub` + `@stdlib/nlp-sentencize`
3. **Book CRUD routes** -- `src/routes/books.ts`: POST /books (multipart upload), GET /books, GET /books/:id, DELETE /books/:id
4. **Page loading route** -- `src/routes/reader.ts`: GET /books/:bookId/chapters/:chapterId/pages/:pageNumber

Dependencies: None on existing code (all new tables and routes).
Testing: Upload an EPUB via curl, verify parsed sentences in DB, load a page.

### Phase 2: Analysis Integration (backend, connects to existing pipeline)

5. **Sentence analysis trigger** -- POST /reader/sentences/:bookSentenceId/analyze
   - Check `book_sentences.sentenceId` (cache)
   - Check `sentences` table for text match (cross-book cache)
   - Queue BullMQ job if cache miss
6. **Word status computation** -- Add token-level word status to page response
   - Server-side lemmatization + word_senses lookup per page
7. **Learn/know endpoint** -- POST /reader/words/:wordSenseId/mark
   - Updates familiarity + conditionally creates SRS card
8. **Modify `storeAnalysisResults()`** -- Add `autoCreateSrsCards` option
   - EPUB flow uses `false`, Telegram flow uses `true` (default, backward compatible)
9. **Batch analysis job** -- Add `batch-sentence-analysis` to `job-processor.ts`

Dependencies: Requires Phase 1 tables. Touches `storeAnalysisResults()` (careful modification).
Testing: Analyze book sentences via API, verify word statuses, verify learn/know flow.

### Phase 3: Reader UI (frontend)

10. **BooksView** -- Library screen: book list, upload button with progress
11. **ReaderView** -- Full-screen page rendering with highlighted words
12. **ReaderSentence + HighlightedWord** -- Per-word color coding based on familiarity
13. **AnalysisModal** -- Bottom sheet with translation, words (learn/know buttons), collocations, grammar
14. **Swipe navigation** -- Page turn with `@vueuse/core` useSwipe
15. **Reading position** -- Save on page turn, restore on book open
16. **PageReport** -- Mini overlay on page turn showing new words encountered

Dependencies: Requires Phase 1+2 API endpoints.
Testing: Full reading flow on mobile browser.

### Phase 4: Polish

17. **Dark mode** for reader (CSS custom properties, toggle in header)
18. **Pre-fetch optimization** -- Queue next page analysis on current page load
19. **Upload progress** -- Show parsing progress for large EPUBs (SSE or polling)
20. **Edge cases** -- Handle EPUB chapters with images, tables, footnotes (strip gracefully)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side EPUB Rendering
**What:** Using epub.js or foliate-js to render EPUB directly in browser.
**Why bad:** Renders into iframes/shadow DOM. Cannot add per-sentence click handlers or per-word highlighting. Would require fighting the library at every step.
**Instead:** Server-side parse into sentences, render as Vue components with full DOM control.

### Anti-Pattern 2: Pre-Analyzing Entire Books
**What:** Running AI analysis on all 5,000+ sentences when book is uploaded.
**Why bad:** Costs $50-200 per book, takes hours, user may not read the whole book. Wastes money and time.
**Instead:** On-demand analysis with next-page pre-fetch. Only analyzed sentences cost money.

### Anti-Pattern 3: Storing Chapter HTML and Using v-html
**What:** Storing raw HTML from EPUB chapters and rendering with `v-html`.
**Why bad:** Cannot attach click handlers to individual sentences in raw HTML. XSS risk from malformed EPUBs. CSS conflicts with app styles.
**Instead:** Store individual sentences as plain text rows. Render each as a dedicated Vue component with full event handling.

### Anti-Pattern 4: Client-Side Lemmatization
**What:** Shipping wink-lemmatizer to the browser for word matching.
**Why bad:** wink-lemmatizer is Node.js only. Even if ported/bundled, adds unnecessary weight. Creates inconsistency risk between server and client lemmatization.
**Instead:** Compute word statuses server-side in the page loading endpoint. One DB query per page.

### Anti-Pattern 5: Separate Analysis Cache Table
**What:** Creating a new `sentence_analyses` table to cache AI results for the EPUB reader.
**Why bad:** The existing `sentences` table with all its junction tables (sentenceWords, sentenceCollocations, sentenceGrammarPatterns) IS the cache. Duplicating this creates data inconsistency and doubles the maintenance burden.
**Instead:** Reuse `sentences` table. `book_sentences.sentenceId` points to it. Same sentence text = same analysis, whether entered via Telegram or encountered in a book.

### Anti-Pattern 6: Loading All Book Sentences Into Memory
**What:** Fetching all sentences for a chapter or book at once.
**Why bad:** A chapter can have hundreds of sentences. The page paradigm exists for a reason -- load one page at a time.
**Instead:** Query by `(chapter_id, page_number)` with an index. Returns exactly 5-7 rows.

## Scalability Considerations

| Concern | At 1 book | At 10 books | At 100 books |
|---------|-----------|-------------|--------------|
| DB rows (book_sentences) | ~5K | ~50K | ~500K |
| Word status lookup | Instant (<5ms) | Instant (indexed) | Instant (words.lemma is UNIQUE) |
| Page load time | <50ms | <50ms | <50ms (indexed by chapter_id + page_number) |
| Analysis queue depth | Negligible | Manageable | May need worker concurrency=2 |
| EPUB file storage | ~2MB | ~20MB | ~200MB (filesystem, trivial) |

Single-user app. None of these scales are concerning. PostgreSQL handles 500K rows trivially.

### Important Indexes

```sql
-- For page loading (most frequent query)
CREATE INDEX idx_book_sentences_chapter_page ON book_sentences(chapter_id, page_number);

-- For sentence cache deduplication (find existing analysis by text)
CREATE INDEX idx_sentences_text_hash ON sentences USING hash(text);
```

The `words.lemma` unique constraint already provides an index for word status lookups.

## Integration Points with Existing Code

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src/db/schema/index.ts` | Export new tables (books, bookChapters, bookSentences, readingPositions) | LOW -- additive |
| `src/services/analysis.ts` | Add `autoCreateSrsCards` option to `storeAnalysisResults()` | MEDIUM -- core function, needs testing |
| `src/workers/job-processor.ts` | Add `batch-sentence-analysis` job type | LOW -- additive switch case |
| `src/server.ts` | Register new routes (books, reader) | LOW -- additive |
| `web/src/router/index.ts` | Add /books and /books/:id/read routes | LOW -- additive |
| `web/src/api/client.ts` | Add `apiUpload()` for multipart file upload | LOW -- additive |
| `web/src/App.vue` | Add "Books" nav link, support `hideNav` meta | LOW |
| `docker-compose.prod.yml` | Add volume mount for book uploads | LOW |

### New Files

| File | Purpose |
|------|---------|
| `src/db/schema/books.ts` | books, book_chapters, book_sentences, reading_positions tables |
| `src/services/epub-parser.ts` | EPUB parsing, sentence splitting, page grouping |
| `src/routes/books.ts` | Book CRUD + file upload endpoint |
| `src/routes/reader.ts` | Page loading with word statuses, sentence analysis trigger, word marking |
| `web/src/stores/books.ts` | Book library Pinia store |
| `web/src/stores/reader.ts` | Reader session Pinia store |
| `web/src/views/BooksView.vue` | Library/shelf view with upload |
| `web/src/views/ReaderView.vue` | Full-screen reader |
| `web/src/components/reader/ReaderHeader.vue` | Book title, chapter, back button |
| `web/src/components/reader/ReaderPage.vue` | Page container (5-7 sentences) |
| `web/src/components/reader/ReaderSentence.vue` | Single sentence with highlighted words |
| `web/src/components/reader/HighlightedWord.vue` | Individual word with familiarity color |
| `web/src/components/reader/AnalysisModal.vue` | Bottom sheet analysis UI |
| `web/src/components/reader/PageReport.vue` | Page turn summary overlay |

### New Dependencies

```bash
# Server-side EPUB parsing (modern, maintained, EPUB 3 support)
npm install @smoores/epub

# Sentence boundary detection
npm install @stdlib/nlp-sentencize

# Multipart file upload for Fastify
npm install @fastify/multipart
```

No new frontend dependencies needed. `@vueuse/core` useSwipe provides swipe gestures if added, but pointer events can also be used directly with no extra dependency.

### Docker Changes

Add a persistent volume for uploaded EPUB files:

```yaml
# docker-compose.prod.yml additions
app:
  volumes:
    - bookdata:/app/uploads

worker:
  volumes:
    - bookdata:/app/uploads  # worker may need access for re-parsing

volumes:
  pgdata:
  bookdata:  # NEW
```

## Sources

- [epub.js - GitHub](https://github.com/futurepress/epub.js) -- Client-side EPUB renderer (evaluated, rejected for sentence-level interaction)
- [foliate-js - GitHub](https://github.com/johnfactotum/foliate-js) -- Browser e-book renderer (evaluated, rejected)
- [@smoores/epub - npm](https://www.npmjs.com/package/@smoores/epub) -- Server-side EPUB 3 parsing (recommended)
- [@smoores/epub announcement](https://smoores.dev/post/announcing_smoores_epub/) -- Motivation: existing Node.js EPUB libraries are unmaintained
- [@stdlib/nlp-sentencize - npm](https://www.npmjs.com/package/@stdlib/nlp-sentencize) -- Sentence boundary detection
- [LingQ 5.0 - Blog](https://www.lingq.com/blog/introducing-lingq-5-0/) -- Reader UI and word status model reference
- [LingQ Overview](https://lingq-support.groovehq.com/help/lingq-overview-how-it-works) -- Blue/yellow/white word highlighting model
- [LingQ Forum - Auto Mode](https://forum.lingq.com/t/how-auto-mode-works/6963) -- How LingQ handles word marking

---
*Architecture research for: English learning app v2.0 EPUB Reader & LingQ-style Learning*
*Researched: 2026-03-15*
