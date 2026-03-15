# Project Research Summary

**Project:** English Learning App v2.0 -- EPUB Reader with LingQ-style Word Tracking
**Domain:** Language learning / EPUB reader integration
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

This project adds an EPUB book reader with LingQ-style word tracking to an existing English learning app that already has AI sentence analysis, FSRS-based SRS, vocabulary management, and a Telegram bot. The critical architectural decision -- validated unanimously across all research -- is to reject client-side EPUB rendering libraries (epub.js, foliate-js) in favor of server-side EPUB parsing with custom Vue 3 sentence rendering. The app's requirement for mandatory sentence-by-sentence interaction with per-word familiarity highlighting is fundamentally incompatible with iframe-based EPUB renderers. Instead, EPUBs are parsed on upload, split into individually addressable sentences stored in PostgreSQL, and served as structured JSON to a custom reader component.

The recommended approach requires only 3-4 new backend dependencies (EPUB parsing, HTML extraction, sentence boundary detection, concurrency control) and zero new frontend libraries. The existing stack -- Fastify, BullMQ, Drizzle, Vercel AI SDK, wink-lemmatizer, Vue 3, @vueuse/core -- handles everything else. The reader reuses the existing `analyzeSentence` pipeline with one modification: disabling auto SRS card creation so users explicitly choose "learn" or "know" for each word. Word status highlighting maps directly to the existing `word_senses.familiarity` enum with no new status dimension needed.

The top risks are: (1) lemma mismatch between reader-side tokenization and existing vocabulary entries, which can make the highlight system untrustworthy; (2) EPUB HTML structure variance breaking sentence boundary detection; and (3) AI cost explosion if analysis is triggered eagerly rather than on-demand. All three are preventable with upfront design decisions: a centralized lemma-matching function with contraction handling, testing sentence splitting against 5+ real EPUBs before building UI, and implementing on-demand analysis with next-page pre-fetch instead of eager processing.

## Key Findings

### Recommended Stack

The existing stack is validated and sufficient. Only 3-4 small backend libraries are needed. No new frontend dependencies.

**Core new technologies:**
- `epub2` (^3.0.2): Server-side EPUB parsing -- extracts metadata, chapters, and HTML content. Fallback: `@lingo-reader/epub-parser` if EPUB3 issues arise
- `cheerio` (^1.2.0): HTML-to-text extraction from EPUB chapter XHTML -- lighter and faster than jsdom for static HTML parsing
- `sbd` (^1.0.19): Sentence boundary detection -- handles abbreviations, ellipsis, and dialogue in literary English text
- `p-limit` (^6.2.0): Concurrency control for batch AI calls during next-page pre-fetch
- `@fastify/multipart`: File upload handling for EPUB uploads

**Explicitly rejected:** epub.js (iframe rendering, last meaningful update 4 years ago), foliate-js (author warns API will break), winkNLP/compromise/natural (overkill -- AI already does linguistic analysis), jsdom (too heavy for static HTML), separate file storage services (single user, disk is fine).

Note: ARCHITECTURE.md recommends `@smoores/epub` + `@stdlib/nlp-sentencize` while STACK.md recommends `epub2` + `sbd`. Both pairs are valid. Start with `epub2` + `sbd` (more battle-tested, 47 dependents) and switch if issues arise with specific EPUB3 features.

### Expected Features

**Must have (table stakes):**
- EPUB upload with server-side parsing and sentence storage
- Book library view with cover, title, and reading progress
- Paginated reader (5-7 sentences per page) with sentence-level tap interaction
- Sentence analysis modal reusing existing AI pipeline with caching
- Word status highlighting (blue=new, yellow=learning, no highlight=known)
- Word status assignment via learn/know buttons in modal
- Reading position persistence (resume where you left off)
- Page navigation with swipe and button support

**Should have (differentiators):**
- Mandatory sentence analysis before page turn (enforced learning -- PROJECT.md requirement)
- Mini-report on page completion (new words, collocations, grammar found)
- No A1/A2 filtering -- user decides via learn/know buttons (PROJECT.md requirement)
- Night mode / dark theme with 3 options (light, sepia, dark)
- Analysis caching (sentence analyzed once, reused forever, even across books)

**Defer to v2.1+:**
- Collocation highlighting in text (multi-token span matching is genuinely hard)
- Per-book vocabulary statistics
- Keyboard shortcuts for desktop
- Grammar pattern badges on sentences
- Table of contents / chapter navigation
- Font size / font family controls

### Architecture Approach

Server-side EPUB parsing produces structured sentence data in PostgreSQL. The reader frontend loads one page at a time (5-7 sentences) with pre-computed word status annotations. Analysis happens on-demand when the user taps a sentence, with results cached permanently in the existing `sentences` table. The `book_sentences.sentenceId` foreign key links book occurrences to shared analysis results, enabling cross-book deduplication. No modifications to `storeAnalysisResults()` core logic beyond adding an `autoCreateSrsCards` option.

**Major components:**
1. **EPUB Parser Service** -- Accepts uploaded EPUB, extracts metadata/chapters, splits text into sentences, groups into pages, stores in DB
2. **Book/Reader API Routes** -- CRUD for books, paginated page loading with word status overlay, sentence analysis trigger, word marking endpoint
3. **Reader Pinia Store** -- Manages current book/chapter/page state, analysis modal state, page completion tracking
4. **ReaderView Component Tree** -- ReaderPage > ReaderSentence > HighlightedWord hierarchy with AnalysisModal and PageReport overlays
5. **Sentence Analysis Cache** -- Reuses existing `sentences` table; `book_sentences.sentenceId` links occurrence to cached analysis

**New database tables:** `books`, `book_chapters`, `book_sentences`, `reading_positions`. All use existing Drizzle patterns. No schema changes to existing tables.

### Critical Pitfalls

1. **Lemma mismatch between reader and vocabulary DB** -- Build a single `matchSurfaceFormToLemma()` function that generates all candidate lemmas, handle contractions with explicit lookup table, match against ALL POS variants. Test with 50+ real sentences before building UI.

2. **EPUB HTML structure variance** -- Publishers use wildly inconsistent HTML. Extract text at paragraph level then re-segment with sentence splitter. Strip publisher CSS entirely. Test with 5+ EPUBs from different sources before proceeding to UI.

3. **AI cost explosion** -- Analyze on-demand (user taps), not eagerly. Word highlighting requires only lemma lookup against existing DB, NOT AI. Pre-fetch next page in background via BullMQ at lower priority. Cache permanently.

4. **Word status conflicts between reader and Telegram flows** -- Do NOT create a third status dimension. Map reader states directly to existing `word_senses.familiarity`. When user marks "know" in reader, update both familiarity AND SRS card state.

5. **Proper noun flooding** -- Character/place names show as "new" (blue) and clutter the display. Detect proper nouns (capitalized, not at sentence start) and show in neutral style. Add an "ignore" mechanism.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Foundation
**Rationale:** Everything depends on parsed EPUB data in the database. This is the critical path with the highest risk (EPUB variance, sentence splitting quality). Must be validated before any UI work.
**Delivers:** Ability to upload an EPUB and have it parsed into books > chapters > sentences in PostgreSQL. Verifiable via API/curl without any frontend.
**Addresses:** EPUB upload, book management, chapter/sentence storage
**Avoids:** Pitfall #2 (HTML variance), Pitfall #8 (sentence splitter edge cases), Pitfall #15 (page model)
**Stack:** epub2, cheerio, sbd, @fastify/multipart, new Drizzle schema, Fastify upload route
**Validation criteria:** Upload 5+ EPUBs from different sources, spot-check sentence quality

### Phase 2: Analysis Integration
**Rationale:** Connects the parsed book data to the existing AI analysis pipeline. Must be done before the reader UI so the frontend has endpoints to call. Contains the most delicate existing-code modification (`storeAnalysisResults` options).
**Delivers:** API endpoints for page loading with word status annotations, on-demand sentence analysis with caching, learn/know word marking
**Addresses:** Sentence analysis modal (backend), word status highlighting (backend), word status assignment, analysis caching
**Avoids:** Pitfall #1 (lemma mismatch), Pitfall #3 (cost explosion), Pitfall #4 (status conflicts), Pitfall #7 (sentence deduplication)
**Stack:** Existing BullMQ, wink-lemmatizer, Vercel AI SDK. p-limit for batch pre-fetch.
**Validation criteria:** Analyze book sentences via API, verify word statuses match Telegram-created vocabulary, verify learn/know updates familiarity + SRS cards correctly

### Phase 3: Reader UI
**Rationale:** Frontend can only be built once backend API is complete and validated. This is the highest-complexity frontend work (sentence rendering, word highlighting, analysis modal, gesture handling).
**Delivers:** Full reading experience -- book library, paginated reader with word highlights, analysis modal with learn/know, page navigation with mandatory analysis enforcement
**Addresses:** Book library view, paginated reader, sentence analysis modal (frontend), word status highlighting (frontend), mandatory analysis, page mini-report, reading position, page navigation
**Avoids:** Pitfall #5 (touch event conflicts), Pitfall #9 (position persistence), Pitfall #10 (proper noun flooding)
**Stack:** Vue 3, Pinia, @vueuse/core (useSwipe), CSS custom properties

### Phase 4: Polish
**Rationale:** Enhancement layer that improves the experience but is not required for core functionality. Can be shipped incrementally.
**Delivers:** Dark/sepia theme, pre-fetch optimization for smoother reading, upload progress feedback, edge case handling
**Addresses:** Night mode, batch pre-fetch, upload UX, EPUB edge cases (images, tables, footnotes)

### Phase Ordering Rationale

- Phases 1-2-3 follow a strict dependency chain: parsed data > API endpoints > UI rendering. No parallelization possible between phases.
- Phase 1 is isolated from existing code (all new tables and services), making it low-risk to the working system.
- Phase 2 touches one existing function (`storeAnalysisResults`) with a backward-compatible option -- this is the riskiest integration point.
- Phase 3 is pure frontend addition with no changes to existing views.
- Phase 4 items are independent of each other and can be done in any order.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Sentence splitting quality needs empirical validation with real EPUBs. The choice between `sbd` and `@stdlib/nlp-sentencize` should be tested, not assumed. Contraction and abbreviation handling needs a test suite.
- **Phase 3:** Mobile gesture handling (tap vs swipe vs long-press) needs a prototype before committing to interaction patterns. Bottom sheet modal behavior on iOS Safari needs testing.

Phases with standard patterns (skip research-phase):
- **Phase 2:** All patterns are well-documented -- BullMQ job types, Drizzle queries, REST endpoints. The `storeAnalysisResults` modification is straightforward.
- **Phase 4:** CSS custom properties for theming -- standard patterns with no unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Minimal new dependencies, all well-maintained. Minor disagreement between researchers on specific EPUB parser (epub2 vs @smoores/epub) -- both viable. |
| Features | HIGH | Clear feature set driven by PROJECT.md requirements and LingQ reference. Good separation of must-have vs defer. |
| Architecture | HIGH | Full codebase analysis performed. Clean integration with existing pipeline. Reuses existing tables and services. |
| Pitfalls | HIGH | 15 pitfalls identified with concrete prevention strategies. Based on real library issues (epub.js GitHub), existing codebase analysis, and domain knowledge. |

**Overall confidence:** HIGH

### Gaps to Address

- **EPUB parser choice:** STACK.md recommends `epub2`, ARCHITECTURE.md recommends `@smoores/epub`. Both are valid. Resolve by testing both with 2-3 real EPUBs during Phase 1 planning. epub2 has more dependents but is older; @smoores/epub is newer with EPUB 3 support.
- **Sentence splitter choice:** STACK.md recommends `sbd`, ARCHITECTURE.md recommends `@stdlib/nlp-sentencize`. Test both with literary English text (dialogue, abbreviations, ellipsis) during Phase 1.
- **Proper noun handling:** No researcher proposed a complete solution. The "ignore" mechanism needs design -- separate table? localStorage blocklist? Decide during Phase 3 planning.
- **Prompt versioning:** Pitfall #13 suggests adding `prompt_version` to cached analyses. Not addressed in architecture. Low priority but should be considered during Phase 2.
- **Variable page length:** Pitfall #15 notes that fixed 5-7 sentences creates uneven page lengths. May need word-count-based pagination instead. Test with real book content during Phase 1.

## Sources

### Primary (HIGH confidence)
- Full codebase analysis: schema files, route handlers, services, bot handlers, Vue stores and components
- epub2 npm registry -- v3.0.2, 47 dependents, EPUB parsing
- cheerio npm registry -- v1.2.0, 80k+ GitHub stars, HTML parsing
- sbd npm registry -- v1.0.19, sentence boundary detection
- epub.js GitHub -- evaluated and rejected (iframe rendering, large chapter performance issues #714, #913)

### Secondary (MEDIUM confidence)
- LingQ 5.0 blog and support docs -- reader UI patterns, word status model (blue/yellow/white)
- Readlang features page -- click-to-translate, auto-flashcard reference
- @smoores/epub npm and announcement -- modern EPUB 3 parser alternative
- @lingo-reader/epub-parser npm -- EPUB 3.3 compliant fallback option

### Tertiary (LOW confidence)
- Sentence splitting best practices (Grammarly engineering blog, Towards Data Science) -- general patterns, not library-specific
- OpenAI Batch API docs -- 50% cost reduction option, not yet validated for this use case
- compromise NLP library -- lightweight POS tagging alternative if wink-lemmatizer proves insufficient

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
