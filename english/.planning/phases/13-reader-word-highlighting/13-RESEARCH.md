# Phase 13: Reader & Word Highlighting - Research

**Researched:** 2026-03-15
**Domain:** EPUB reader UI, word tokenization and highlighting, reading position persistence, dark theme
**Confidence:** HIGH

## Summary

Phase 13 builds the core reader view on top of Phase 12's EPUB data foundation. The backend already has `books`, `book_chapters`, `book_sentences`, and `reading_positions` tables with pre-computed page numbers. This phase adds: (1) API endpoints to fetch a page of sentences and save/load reading position, (2) a Vue reader view with page navigation, (3) per-word highlighting by matching text tokens against the vocabulary database (`words` + `word_senses` tables), (4) a dark/night theme toggle, and (5) a "sentences opened" gate that disables the "next page" button until the user has opened every sentence.

The word highlighting challenge is the core technical problem. Each sentence's text must be tokenized into words, each word lowercased and looked up in the `words` table (by lemma), and the corresponding `word_senses.familiarity` determines the highlight color: `never_seen` = blue (new), `seen_unsure`/`understand_in_context` with active SRS card = yellow (learning), no word entry or all senses marked known = no highlight. The lookup happens server-side to avoid exposing the entire vocabulary to the client. The lemmatizer (`wink-lemmatizer`) is already in the project.

**Primary recommendation:** Add two new API endpoints (`GET /books/:id/page/:page` returning sentences with per-word highlight data, `PUT /books/:id/position` for saving reading position). Build a `ReaderView.vue` with sentence-level rendering where each word is a `<span>` with a CSS class based on familiarity status. Use CSS custom properties for the dark theme toggle (stored in localStorage).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| READ-01 | User sees page of 5-7 sentences, can navigate forward/backward | `book_sentences` already has `page_number`; new endpoint `GET /books/:id/page/:page` returns sentences for a page; Vue component with prev/next buttons |
| READ-02 | System remembers reading position, resumes on reopen | `reading_positions` table already exists with `bookId` + `pageNumber`; new `PUT /books/:id/position` and reading position returned in `GET /books/:id` |
| READ-03 | User can switch to dark/night theme | CSS custom properties on `:root` / `[data-theme="dark"]`; toggle stored in localStorage; no library needed |
| READ-04 | Next button disabled until every sentence on page opened | Frontend state: `Set<number>` of opened sentence IDs; next button enabled when set size equals sentence count |
| HIGH-01 | Words colored by status: blue (new), yellow (learning), no highlight (known) | Server-side word lookup: tokenize sentence text, match against `words.lemma` + `word_senses.familiarity` + `srs_cards.state`; return highlight map per sentence |
| HIGH-02 | Highlighting updates after closing analysis modal | Phase 14 concern for modal, but Phase 13 must design the data flow: re-fetch page data after modal close to get updated word statuses |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | 3.5.x (existing) | Reader view component | Already in project |
| vue-router | 5.x (existing) | `/read/:bookId` route | Already in project |
| pinia | 3.x (existing) | Reader state management | Already in project |
| wink-lemmatizer | 3.0.4 (existing) | Lemmatize tokens for vocabulary lookup | Already in project, same lemmatizer used during sentence analysis |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | 0.45.1 (existing) | Query sentences, words, word_senses | Already in project |
| fastify | 5.8.x (existing) | API endpoints for page data and position | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side word lookup | Client-side vocabulary cache | Client-side would require downloading all ~1000+ words upfront; server-side is simpler and more accurate |
| CSS custom properties for dark theme | A CSS-in-JS library or Tailwind dark mode | Overkill for a single-user app; CSS vars are zero-dependency and sufficient |
| localStorage for theme preference | Server-side preference storage | Single user, single device primary use; localStorage is simpler |

**Installation:**
```bash
# No new dependencies needed -- all libraries already in the project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  routes/
    books.ts              # Extend with page data + position endpoints
  services/
    word-highlighter.ts   # NEW: tokenize sentence, lookup words, return highlight map
web/src/
  views/
    ReaderView.vue        # NEW: full-screen reader with page navigation
  components/
    reader/
      ReaderPage.vue      # Sentence list with word highlighting
      ReaderSentence.vue  # Single sentence with per-word spans
      ThemeToggle.vue     # Dark/light theme switch
  stores/
    reader.ts             # NEW: reader state (current page, opened sentences, theme)
```

### Pattern 1: Server-Side Word Highlighting
**What:** The API returns sentences with a `highlights` map for each sentence -- a mapping from word position to familiarity status.
**When to use:** This phase -- every page load needs word status data.
**Why:** The vocabulary database is server-side. Sending raw vocabulary to the client is wasteful and insecure (though single-user). Server computes highlights in one efficient query.
```typescript
// GET /books/:id/page/:pageNum response shape
interface PageResponse {
  bookId: number
  pageNumber: number
  totalPages: number
  currentPosition: number  // saved reading position
  sentences: Array<{
    id: number
    text: string
    highlights: Array<{
      word: string       // original token from text
      offset: number     // char offset in sentence
      length: number     // char length
      status: 'new' | 'learning' | 'known' | null  // null = not in vocab (punctuation, etc.)
    }>
  }>
}
```

### Pattern 2: Token-Level Rendering
**What:** Each sentence is rendered as a series of `<span>` elements, one per token, with CSS classes for highlight status.
**When to use:** Reader view -- every word needs individual styling.
**Why:** Simple, accessible, and CSS-only highlighting. No canvas or complex rendering needed.
```vue
<!-- ReaderSentence.vue -->
<template>
  <p class="sentence" :class="{ opened }" @click="$emit('open', sentence.id)">
    <span
      v-for="(token, i) in sentence.highlights"
      :key="i"
      :class="tokenClass(token.status)"
    >{{ token.word }}</span>
  </p>
</template>
```

### Pattern 3: Reading Position as Upsert
**What:** Save reading position with INSERT ... ON CONFLICT UPDATE (upsert pattern).
**When to use:** Every page navigation -- save automatically.
**Why:** The `reading_positions` table has a unique constraint on `bookId`. Upsert avoids checking if a row exists before inserting.
```typescript
// Save position on every page change
await db.insert(readingPositions)
  .values({ bookId, pageNumber })
  .onConflictDoUpdate({
    target: readingPositions.bookId,
    set: { pageNumber, updatedAt: new Date() },
  });
```

### Pattern 4: Dark Theme with CSS Custom Properties
**What:** Define all colors as CSS custom properties, toggle by adding `data-theme="dark"` attribute to the reader container or `<html>`.
**When to use:** Reader view and potentially app-wide.
**Why:** Zero dependencies, instant toggle, works with scoped styles.
```css
:root {
  --reader-bg: #ffffff;
  --reader-text: #1e293b;
  --highlight-new: #dbeafe;       /* blue-100 */
  --highlight-learning: #fef3c7;  /* amber-100 */
}

[data-theme="dark"] {
  --reader-bg: #1a1a2e;
  --reader-text: #e2e8f0;
  --highlight-new: #1e3a5f;       /* dark blue */
  --highlight-learning: #4a3728;  /* dark amber */
}
```

### Anti-Patterns to Avoid
- **Fetching all vocabulary to client:** Wasteful and slow. Let the server compute highlights.
- **Rendering entire book at once:** Only render current page. Pages are pre-computed in DB.
- **Complex client-side tokenization:** Keep tokenization simple (split on whitespace/punctuation). The server does the heavy lifting of lemma matching.
- **Storing theme preference in DB:** Overkill for single-user. localStorage is sufficient.
- **Re-implementing sentence opening tracking on server:** This is purely UI state (which sentences the user clicked on this page). Keep in frontend store only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Word lemmatization | Custom stemmer | wink-lemmatizer (existing) | Already in project, consistent with how words were originally stored |
| Dark theme system | Custom theme engine | CSS custom properties + data attribute | Native browser feature, zero JS needed for the actual styling |
| Reading position persistence | Custom session tracking | Upsert to `reading_positions` table (existing) | Table already exists from Phase 12 schema |
| Page data loading | Custom pagination logic | Query by `page_number` column (existing) | Pre-computed in Phase 12 |

**Key insight:** Phase 12 already built the data foundation (pages, sentences, reading positions). Phase 13 is primarily about the frontend reader view and the word-to-vocabulary matching service.

## Common Pitfalls

### Pitfall 1: Tokenization Mismatch with Stored Lemmas
**What goes wrong:** Words in the reader text don't match the lemmas stored in the vocabulary database.
**Why it happens:** The reader tokenizes raw text (e.g., "running" -> lowercase "running"), but the vocabulary stores lemmas (e.g., "run"). Without lemmatization, no match is found.
**How to avoid:** Use `wink-lemmatizer` on each token with a POS guess. For highlighting, try all POS variants (noun, verb, adjective) and pick the first match found in the DB. This is a brute-force but reliable approach since the word list is queried in bulk.
**Warning signs:** All words show as "new" (blue) even though many are in the vocabulary.

### Pitfall 2: Punctuation Attached to Words
**What goes wrong:** Tokenizing "Hello," produces "Hello," instead of "Hello" + ","
**Why it happens:** Naive whitespace splitting keeps punctuation attached to words.
**How to avoid:** Strip leading/trailing punctuation from each token before lookup, but preserve original text for display. Use regex: `token.replace(/^[^\w]+|[^\w]+$/g, '')` to get the clean word for lookup.
**Warning signs:** Words at end of sentences never match vocabulary.

### Pitfall 3: Apostrophes and Contractions
**What goes wrong:** "don't" doesn't match any vocabulary entry.
**Why it happens:** Contractions are stored as expanded forms ("do" + "not") or as the base verb. "don't" as a single token won't match.
**How to avoid:** For highlighting purposes, treat contractions as "known" by default (they're function words). Or split on apostrophe: "don't" -> "do" + "n't", look up "do". Keep it simple -- contractions are not the focus of vocabulary learning.
**Warning signs:** Common words like "don't", "I'm", "they're" showing as blue (new).

### Pitfall 4: Reading Position Race Condition
**What goes wrong:** Position saved before page data loads, resulting in wrong saved page.
**Why it happens:** Saving position on navigation click, but the page hasn't rendered yet.
**How to avoid:** Save position after page data is successfully loaded and rendered. Use `watch` on the current page number, debounce saves.
**Warning signs:** Reopening a book puts you on the wrong page.

### Pitfall 5: Performance with Many Words per Page
**What goes wrong:** Slow page loads because each word requires a DB lookup.
**Why it happens:** N queries for N words on a page (N+1 problem).
**How to avoid:** Batch lookup: collect all unique tokens from all sentences on a page, query the DB once with `WHERE lemma IN (...)`, then map results back to tokens. One query for the entire page.
**Warning signs:** Page loads taking >500ms.

### Pitfall 6: Reader View Hiding App Navigation
**What goes wrong:** The reader should feel like a full-screen reading experience, but the app header takes up space.
**Why it happens:** The reader is rendered inside the normal app layout with sticky header.
**How to avoid:** Use a dedicated layout for the reader route (no header/nav) or hide the header when in reader mode. The reader should have its own back button to return to the library.
**Warning signs:** Too little vertical space for reading on mobile.

## Code Examples

### Word Highlighter Service
```typescript
// src/services/word-highlighter.ts
import { inArray, eq } from 'drizzle-orm';
import { words } from '../db/schema/words.ts';
import { wordSenses } from '../db/schema/word-senses.ts';
import { srsCards } from '../db/schema/srs-cards.ts';
import { normalizeLemma } from '../lib/lemmatizer.ts';

type HighlightStatus = 'new' | 'learning' | 'known';

interface TokenHighlight {
  word: string;      // original text
  offset: number;    // char position in sentence
  length: number;    // char length
  status: HighlightStatus | null;
}

// Tokenize text into word-boundary tokens
function tokenize(text: string): Array<{ word: string; offset: number; isWord: boolean }> {
  const tokens: Array<{ word: string; offset: number; isWord: boolean }> = [];
  // Match word characters or non-word sequences
  const regex = /(\w+(?:'\w+)?)|([^\w]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      offset: match.index,
      isWord: !!match[1],
    });
  }
  return tokens;
}

// Clean token for lookup (strip surrounding punctuation, lowercase)
function cleanToken(token: string): string {
  return token.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
}

export async function highlightSentences(
  db: any,
  sentences: Array<{ id: number; text: string }>,
): Promise<Map<number, TokenHighlight[]>> {
  // 1. Tokenize all sentences, collect unique clean words
  const allTokensBysentence = new Map<number, ReturnType<typeof tokenize>>();
  const uniqueCleanWords = new Set<string>();
  const possibleLemmas = new Set<string>();

  for (const s of sentences) {
    const tokens = tokenize(s.text);
    allTokensBysentence.set(s.id, tokens);
    for (const t of tokens) {
      if (!t.isWord) continue;
      const clean = cleanToken(t.word);
      if (clean.length === 0) continue;
      uniqueCleanWords.add(clean);
      // Try all POS lemmatizations
      for (const pos of ['noun', 'verb', 'adjective']) {
        possibleLemmas.add(normalizeLemma(clean, pos));
      }
      possibleLemmas.add(clean); // also try raw lowercase
    }
  }

  if (possibleLemmas.size === 0) {
    return new Map(sentences.map(s => [s.id, []]));
  }

  // 2. Batch query: get all matching words with their senses and SRS state
  const lemmaArray = Array.from(possibleLemmas);
  const wordRows = await db
    .select({
      lemma: words.lemma,
      familiarity: wordSenses.familiarity,
      cardState: srsCards.state,
    })
    .from(words)
    .innerJoin(wordSenses, eq(wordSenses.wordId, words.id))
    .leftJoin(srsCards, eq(srsCards.wordSenseId, wordSenses.id))
    .where(inArray(words.lemma, lemmaArray));

  // 3. Build lemma -> status map
  //    Logic: if ANY sense is never_seen -> 'new'
  //           if ANY sense has active SRS card (learning/relearning) -> 'learning'
  //           otherwise -> 'known'
  const lemmaStatus = new Map<string, HighlightStatus>();
  for (const row of wordRows) {
    const current = lemmaStatus.get(row.lemma);
    let status: HighlightStatus = 'known';

    if (row.familiarity === 'never_seen') {
      status = 'new';
    } else if (row.cardState === 'new' || row.cardState === 'learning' || row.cardState === 'relearning') {
      status = 'learning';
    }

    // Priority: new > learning > known
    if (!current || status === 'new' || (status === 'learning' && current === 'known')) {
      lemmaStatus.set(row.lemma, status);
    }
  }

  // 4. Map back to tokens
  const result = new Map<number, TokenHighlight[]>();
  for (const s of sentences) {
    const tokens = allTokensBysentence.get(s.id)!;
    const highlights: TokenHighlight[] = tokens.map(t => {
      if (!t.isWord) {
        return { word: t.word, offset: t.offset, length: t.word.length, status: null };
      }
      const clean = cleanToken(t.word);
      if (clean.length === 0) {
        return { word: t.word, offset: t.offset, length: t.word.length, status: null };
      }

      // Check all POS lemmatizations
      let status: HighlightStatus | null = null;
      for (const pos of ['noun', 'verb', 'adjective']) {
        const lemma = normalizeLemma(clean, pos);
        if (lemmaStatus.has(lemma)) {
          status = lemmaStatus.get(lemma)!;
          break;
        }
      }
      // Also check raw form
      if (status === null && lemmaStatus.has(clean)) {
        status = lemmaStatus.get(clean)!;
      }

      // Word not in vocabulary at all -> null (no highlight, treat as unknown/ignore)
      return { word: t.word, offset: t.offset, length: t.word.length, status };
    });
    result.set(s.id, highlights);
  }

  return result;
}
```

### Page Data API Endpoint
```typescript
// In src/routes/books.ts -- new endpoints

// GET /books/:id/page/:pageNum
fastify.get<{ Params: { id: string; pageNum: string } }>(
  '/books/:id/page/:pageNum',
  async (request, reply) => {
    const bookId = Number(request.params.id);
    const pageNum = Number(request.params.pageNum);

    // Get book info
    const [book] = await fastify.db
      .select({ id: books.id, totalPages: books.totalPages })
      .from(books)
      .where(eq(books.id, bookId));

    if (!book) return reply.notFound('Book not found');

    // Get sentences for this page
    const sentences = await fastify.db
      .select({ id: bookSentences.id, text: bookSentences.text })
      .from(bookSentences)
      .where(and(
        eq(bookSentences.bookId, bookId),
        eq(bookSentences.pageNumber, pageNum),
      ))
      .orderBy(bookSentences.orderInChapter);

    // Get word highlights
    const highlightMap = await highlightSentences(fastify.db, sentences);

    // Get saved position
    const [pos] = await fastify.db
      .select({ pageNumber: readingPositions.pageNumber })
      .from(readingPositions)
      .where(eq(readingPositions.bookId, bookId));

    return {
      bookId,
      pageNumber: pageNum,
      totalPages: book.totalPages,
      savedPosition: pos?.pageNumber ?? 0,
      sentences: sentences.map(s => ({
        id: s.id,
        text: s.text,
        highlights: highlightMap.get(s.id) ?? [],
      })),
    };
  },
);

// PUT /books/:id/position
fastify.put<{ Params: { id: string }; Body: { pageNumber: number } }>(
  '/books/:id/position',
  async (request) => {
    const bookId = Number(request.params.id);
    const { pageNumber } = request.body;

    await fastify.db.insert(readingPositions)
      .values({ bookId, pageNumber })
      .onConflictDoUpdate({
        target: readingPositions.bookId,
        set: { pageNumber, updatedAt: new Date() },
      });

    return { ok: true };
  },
);
```

### Reader Vue Component Structure
```vue
<!-- web/src/views/ReaderView.vue (simplified) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiGet, apiPatch } from '@/api/client'

const route = useRoute()
const router = useRouter()
const bookId = computed(() => Number(route.params.bookId))
const currentPage = ref(0)
const pageData = ref<PageResponse | null>(null)
const openedSentences = ref(new Set<number>())
const darkTheme = ref(localStorage.getItem('reader-theme') === 'dark')

const allSentencesOpened = computed(() => {
  if (!pageData.value) return false
  return openedSentences.value.size >= pageData.value.sentences.length
})

async function loadPage(page: number) {
  pageData.value = await apiGet(`/books/${bookId.value}/page/${page}`)
  currentPage.value = page
  openedSentences.value.clear()
  // Save position
  await apiPatch(`/books/${bookId.value}/position`, { pageNumber: page })
}

function openSentence(sentenceId: number) {
  openedSentences.value.add(sentenceId)
  // Phase 14 will add: open analysis modal here
}

function toggleTheme() {
  darkTheme.value = !darkTheme.value
  localStorage.setItem('reader-theme', darkTheme.value ? 'dark' : 'light')
}

onMounted(async () => {
  // Load saved position or start at page 0
  const book = await apiGet(`/books/${bookId.value}`)
  const savedPage = book.savedPosition ?? 0
  await loadPage(savedPage)
})
</script>
```

### Dark Theme CSS
```css
.reader {
  --reader-bg: #ffffff;
  --reader-text: #1e293b;
  --reader-text-muted: #64748b;
  --reader-border: #e2e8f0;
  --highlight-new: rgba(59, 130, 246, 0.15);
  --highlight-new-text: #1e40af;
  --highlight-learning: rgba(245, 158, 11, 0.15);
  --highlight-learning-text: #92400e;
  --reader-nav-bg: #f8fafc;
}

.reader.dark {
  --reader-bg: #1a1a2e;
  --reader-text: #e2e8f0;
  --reader-text-muted: #94a3b8;
  --reader-border: #334155;
  --highlight-new: rgba(59, 130, 246, 0.25);
  --highlight-new-text: #93c5fd;
  --highlight-learning: rgba(245, 158, 11, 0.25);
  --highlight-learning-text: #fcd34d;
  --reader-nav-bg: #16213e;
}

.word-new {
  background: var(--highlight-new);
  color: var(--highlight-new-text);
  border-radius: 2px;
  padding: 0 1px;
}

.word-learning {
  background: var(--highlight-learning);
  color: var(--highlight-learning-text);
  border-radius: 2px;
  padding: 0 1px;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side EPUB rendering (epub.js) | Server-parsed sentences with custom rendering | Project decision (REQUIREMENTS.md) | Enables per-word highlighting and per-sentence interaction |
| Global CSS theme overrides | CSS custom properties with data attribute | Standard since ~2020 | Clean, maintainable, no JS needed for style changes |

**Deprecated/outdated:**
- N/A -- this phase uses existing project patterns and native browser features

## Open Questions

1. **Words not in vocabulary at all (never analyzed)**
   - What we know: When a user hasn't analyzed any sentences yet, no words exist in the vocabulary. All words would have `status: null` (no highlight).
   - What's unclear: Should unknown words (not in DB) be highlighted as "new" (blue)?
   - Recommendation: Words NOT in the vocabulary database get NO highlight (null). Only words that have been encountered through analysis and have `familiarity: 'never_seen'` show as blue. This matches the existing LingQ-like flow where words become known through explicit user action.

2. **Highlight status for words with multiple senses**
   - What we know: A word can have multiple senses (e.g., "run" as noun vs verb), each with its own familiarity.
   - What's unclear: Without knowing POS in context, which sense's familiarity to use?
   - Recommendation: Use the "worst" status across all senses. If any sense is "never_seen", show blue. If any is "learning", show yellow. Only show no highlight if ALL senses are known. This is conservative and encourages the user to learn all usages.

3. **HIGH-02: Highlighting updates after modal close**
   - What we know: Phase 14 adds the analysis modal. When the user marks words as "learn" or "know" in the modal, the highlighting should update.
   - What's unclear: Exact mechanism for Phase 14 integration.
   - Recommendation: Design the page data fetching as a reusable function. Phase 14 will call `loadPage(currentPage)` after modal close to refresh highlights. This is the simplest approach -- no partial updates, just re-fetch.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts (exists) |
| Quick run command | `npm test -- tests/reader-api.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-01 | GET /books/:id/page/:pageNum returns sentences | integration | `npm test -- tests/reader-api.test.ts` | No - Wave 0 |
| READ-02 | PUT /books/:id/position saves and GET loads position | integration | `npm test -- tests/reader-api.test.ts` | No - Wave 0 |
| READ-03 | Dark theme toggle | manual-only | N/A (CSS + localStorage, visual verification) | N/A |
| READ-04 | Next button disabled until all sentences opened | manual-only | N/A (frontend state logic, visual verification) | N/A |
| HIGH-01 | Word highlights returned with correct status | unit | `npm test -- tests/word-highlighter.test.ts` | No - Wave 0 |
| HIGH-02 | Highlights refresh after re-fetch | integration | `npm test -- tests/reader-api.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/reader-api.test.ts tests/word-highlighter.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/word-highlighter.test.ts` -- unit tests for tokenization and vocabulary matching logic (HIGH-01)
- [ ] `tests/reader-api.test.ts` -- integration tests for page data and position endpoints (READ-01, READ-02, HIGH-02)

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/db/schema/books.ts` -- existing schema with reading_positions, book_sentences with page_number
- Project codebase: `src/db/schema/words.ts`, `word-senses.ts`, `srs-cards.ts` -- existing vocabulary data model
- Project codebase: `src/lib/lemmatizer.ts` -- existing wink-lemmatizer integration
- Project codebase: `web/src/views/LibraryView.vue` -- existing Vue patterns (Composition API, script setup)
- Project codebase: `web/src/api/client.ts` -- existing API client with apiGet, apiPost, apiPatch, apiDelete

### Secondary (MEDIUM confidence)
- Vue 3 Composition API documentation -- reactive state, computed, watch patterns
- CSS custom properties for theming -- standard browser feature, widely documented

### Tertiary (LOW confidence)
- None -- this phase uses established project patterns and no new external libraries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing project libraries
- Architecture: HIGH - follows established project patterns (Fastify routes, Drizzle queries, Vue Composition API)
- Pitfalls: HIGH - tokenization/lemmatization challenges are well-understood from existing analysis pipeline
- Word highlighting logic: MEDIUM - the multi-POS lemma matching approach needs validation against real data

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, no external dependencies)
