# Technology Stack

**Project:** English Learning App - EPUB Reader & LingQ-style Learning (v2.0)
**Researched:** 2026-03-15
**Scope:** NEW libraries only. Existing stack (Vue 3, Fastify, Drizzle, PostgreSQL, BullMQ, ts-fsrs, wink-lemmatizer, Vercel AI SDK, grammY, @vueuse/core) is validated and not re-researched.

## Critical Architecture Decision: No epub.js on Frontend

**Do NOT use epub.js (epubjs) for rendering.** The project requires "pages of 5-7 sentences with mandatory click-through of each sentence" -- this is fundamentally incompatible with epub.js's rendering model (iframe-based, page-flow oriented). epub.js is designed for reading books as-is, not for learning-oriented sentence-by-sentence interaction.

**Instead:** Parse EPUB server-side, extract sentences, store in PostgreSQL, serve as structured JSON to a custom Vue 3 reader component. This gives full control over sentence highlighting, word status coloring, click handlers, and modal triggers.

## Recommended Stack Additions

### Backend: EPUB Parsing & Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `epub2` | ^3.0.2 | Server-side EPUB parsing | Extracts chapter HTML, metadata, TOC, images. Mature (47 dependents), simple API: `parse()` then `getChapter(id)`. Works with Node.js. UTF-8 EPUBs (covers English books). |
| `cheerio` | ^1.2.0 | HTML-to-text extraction from EPUB chapters | EPUB chapters are XHTML. Cheerio parses static HTML without browser overhead (unlike jsdom). jQuery-like API for extracting `<p>` tags, stripping formatting, preserving structure. Industry standard (80k+ GitHub stars). |
| `sbd` | ^1.0.19 | Sentence boundary detection | "Sentence Boundary Detection" -- splits text into sentences handling abbreviations (Mr., Dr., U.S.), decimal numbers, ellipsis. Lightweight, no dependencies. Better than naive regex splitting for book text with dialogue and abbreviations. |

**Confidence:** MEDIUM for epub2 specifically -- it's stable but last published 2 years ago. If issues arise with specific EPUB3 features, `@lingo-reader/epub-parser` (v0.4.5, published 2 months ago, EPUB 3.3 compliant) is the fallback.

### Backend: Batch AI Concurrency

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `p-limit` | ^6.2.0 | Concurrency control for parallel AI calls | Limits concurrent API calls (e.g., 3 at a time) when pre-analyzing a page of sentences. Tiny, well-maintained. Preferable to manual semaphore implementation. |

### Frontend: Custom Book Reader

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No new libraries needed | -- | Custom Vue 3 components | The reader UI is a sentence-list with word-level spans. Standard Vue 3 reactivity + CSS handles this. `@vueuse/core` (already installed from v1.1) provides touch gesture composables if swipe navigation is desired. |

**Rationale:** The "reader" is not a paginated book viewer -- it's a list of 5-7 sentences where each sentence is clickable, words are color-coded by familiarity status, and clicking opens an analysis modal. This is a standard Vue component rendering server-provided sentence data, not an ebook rendering problem.

### Word Tokenization & Matching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No new library needed | -- | Word tokenization for vocabulary matching | Simple regex tokenization (`/\b[a-zA-Z'-]+\b/g`) is sufficient for English word extraction from clean EPUB text. The app already has `wink-lemmatizer` for lemmatization. Match extracted tokens against the `words` table by lemma. |

**Rationale:** NLP libraries (winkNLP, compromise, natural) are overkill. The AI already provides POS and lemma in its analysis output. For word-status highlighting in the reader, we only need to: (1) split sentence text into tokens, (2) lemmatize each token with existing `wink-lemmatizer`, (3) look up lemma in `words` table to get familiarity status. No NLP pipeline needed.

### Batch AI Analysis

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No new library needed | -- | Batch sentence analysis | BullMQ already handles job queuing. Extend existing `sentence-analysis` queue to accept batch jobs. The Vercel AI SDK's `generateObject()` already handles single-sentence analysis -- batch = loop with concurrency control via `p-limit`. |

## What NOT to Add (and Why)

| Technology | Why Not |
|------------|---------|
| `epubjs` / `epub.js` | Iframe-based rendering incompatible with sentence-level interaction. Would require fighting the library at every step. Last meaningful update 4 years ago. |
| `foliate-js` | Author explicitly warns "expect it to break and the API to change at any time." Same rendering-oriented approach as epub.js. |
| `vue-reader` / `vue-epub-reader` | Wrappers around epub.js -- inherit all its limitations for custom interaction. |
| `winkNLP` / `compromise` / `natural` | Overkill for word tokenization. AI already does linguistic analysis. We only need string splitting + lemma lookup, which existing `wink-lemmatizer` handles. |
| `jsdom` | Heavier than cheerio for static HTML parsing. Emulates full browser DOM -- unnecessary for extracting text from EPUB XHTML. Cheerio is 5-10x faster for this use case. |
| Separate file storage (S3, MinIO) | Single user, few books. Disk storage in Docker volume is simpler and sufficient. |
| `sentence-splitter` (npm) | AST-based, more complex than needed. `sbd` is simpler, focused on English sentence boundaries in prose text. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| EPUB parsing | `epub2` | `@lingo-reader/epub-parser` v0.4.5 | epub2 is more battle-tested with 47 dependents; lingo-reader is newer (v0.4.x) but follows EPUB 3.3 spec. Keep as fallback if epub2 has issues with specific files. |
| HTML parsing | `cheerio` | `jsdom` | jsdom emulates full browser DOM -- unnecessary overhead for extracting text from static XHTML. cheerio is faster and lighter. |
| Sentence splitting | `sbd` | `@stdlib/nlp-sentencize` | sbd handles English abbreviations and dialogue better. stdlib version is less mature for prose text. |
| Concurrency | `p-limit` | Manual Promise queue | p-limit is tiny, well-tested, handles edge cases. Not worth reimplementing. |
| Frontend reader | Custom Vue 3 components | epub.js + custom hooks | Cannot achieve sentence-level mandatory click-through, word-level status coloring, or custom pagination (5-7 sentences) with epub.js without extensive hacking. |

## Installation

```bash
# Backend - new dependencies (from project root)
npm install epub2 cheerio sbd p-limit

# Type definitions (sbd doesn't ship types)
npm install -D @types/sbd
```

No new frontend dependencies needed.

## New Database Tables (PostgreSQL + Drizzle)

No new database technology. New tables via Drizzle schema + migration:

| Table | Purpose |
|-------|---------|
| `books` | EPUB metadata: title, author, cover image path, total chapters, file path |
| `book_chapters` | Chapter content: raw HTML, extracted plain text, order index, book FK |
| `book_sentences` | Individual sentences per chapter: text, position index, chapter FK |
| `sentence_analyses` (extend existing) | Link book_sentences to existing `sentences` table for cached AI analysis |
| `reading_progress` | Current position: book_id, chapter_index, sentence_index |

EPUB binary files stored on disk (Docker volume at `/data/books/`), not in database. Only metadata and extracted text content in PostgreSQL.

## Integration Points with Existing Stack

### EPUB Upload Flow
```
Fastify multipart route → save .epub to /data/books/
→ epub2.parse() extracts metadata + chapter list
→ For each chapter: cheerio extracts <p> text
→ sbd splits paragraphs into sentences
→ Drizzle inserts into books → book_chapters → book_sentences
```

### Reader Page Request
```
GET /api/books/:id/page?chapter=X&from=Y
→ Fastify returns 5-7 book_sentences with word-status annotations
→ For each sentence: tokenize → lemmatize (wink-lemmatizer) → lookup words table
→ Return: [{text, words: [{token, lemma, status}], analysisId?}]
→ Vue renders custom reader with colored word spans
```

### Sentence Analysis (on click)
```
User clicks sentence → check if analysis cached (sentence_analyses join)
→ If cached: return immediately from DB
→ If not: POST to existing /api/sentences/analyze pipeline
→ Cache result (link book_sentence to sentences table)
→ Modal shows translation, words, collocations, grammar (existing UI pattern)
```

### Batch Pre-analysis (background)
```
On page load → find uncached sentences on current + next page
→ BullMQ batch job with p-limit(3) for concurrent AI calls
→ Each call uses existing analyzeSentence() + storeAnalysisResults()
→ Results cached → ready when user clicks
```

## Sources

- [epub2 on npm](https://www.npmjs.com/package/epub2) -- v3.0.2, 47 dependents, EPUB parsing for Node.js
- [cheerio on npm](https://www.npmjs.com/package/cheerio) -- v1.2.0, published 2 months ago, 80k+ GitHub stars
- [cheerio official site](https://cheerio.js.org/) -- API documentation
- [sbd on npm](https://www.npmjs.com/package/sbd) -- v1.0.19, sentence boundary detection
- [p-limit on npm](https://www.npmjs.com/package/p-limit) -- v6.x, concurrency limiter
- [epub.js GitHub](https://github.com/futurepress/epub.js) -- evaluated and rejected (iframe rendering model)
- [foliate-js GitHub](https://github.com/johnfactotum/foliate-js) -- evaluated, explicitly unstable API
- [@lingo-reader/epub-parser](https://www.npmjs.com/package/@lingo-reader/epub-parser) -- v0.4.5, EPUB 3.3 compliant, backup option
- [winkNLP](https://winkjs.org/wink-nlp/) -- evaluated, overkill for this use case

---
*Stack research for: English learning app v2.0 EPUB Reader milestone*
*Researched: 2026-03-15*
