# Roadmap: English Learning App

## Milestones

- <details><summary>v1.0 MVP - Phases 1-5 (shipped)</summary>Sentence analysis, vocabulary, Telegram bot, SRS, web dashboard</details>
- <details><summary>v1.1 UX Polish & Web Features - Phases 6-11 (shipped)</summary>Word senses, auto-add, vocabulary page, web review, collocation SRS, browse pages</details>
- **v2.0 EPUB Reader & LingQ-style Learning** - Phases 12-14 (active)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) - SHIPPED</summary>

- [x] **Phase 1: Foundation and Data Layer** - Database schema, API skeleton, Docker environment, async job queue
- [x] **Phase 2: AI Analysis Pipeline** - Sentence analysis, vocabulary extraction, lemmatization, collocations, grammar patterns
- [x] **Phase 3: Telegram Bot** - Sentence input via bot, word selection, familiarity tagging
- [x] **Phase 4: Spaced Repetition and Exercises** - FSRS engine, flashcard review, cloze exercises, batch generation, bot review
- [x] **Phase 5: Web Application and Dashboard** - Vue SPA with sentence input, dashboard, progress tracking

</details>

<details>
<summary>v1.1 UX Polish & Web Features (Phases 6-11) - SHIPPED</summary>

- [x] **Phase 6: Data Model Evolution** - POS-aware word senses, composite uniqueness, SRS card linkage migration
- [x] **Phase 7: Service Updates & Telegram Auto-Add** - POS-aware upserts, automatic SRS card creation, simplified Telegram flow
- [x] **Phase 8: Vocabulary Page & Collocations UI** - Full vocabulary browser with filters, word detail, collocations display
- [x] **Phase 9: Web SRS Review** - Card-by-card review flow in browser with keyboard shortcuts and session tracking
- [x] **Phase 10: Collocation SRS & Review Enhancement** - Collocations as SRS cards, grammar review shows pattern description and context
- [x] **Phase 11: Grammar & Collocations Browse Pages** - Dedicated pages to browse all grammar patterns and collocations with filters

</details>

### v2.0 EPUB Reader & LingQ-style Learning (Active)

**Milestone Goal:** Users read real EPUB books in the browser with per-sentence AI analysis, word status highlighting, and explicit learn/know decisions feeding into the existing SRS system.

- [x] **Phase 12: EPUB Data Foundation** - Upload, parse, and store EPUB books as structured sentence data in PostgreSQL (completed 2026-03-15)
- [x] **Phase 13: Reader & Word Highlighting** - Paginated reader UI with word status colors, position persistence, and dark theme (completed 2026-03-15)
- [ ] **Phase 14: Analysis & Learning Flow** - Sentence analysis modal with learn/know actions, mandatory analysis enforcement, page completion reports

## Phase Details

### Phase 12: EPUB Data Foundation
**Goal**: Users can upload EPUB books and the system stores them as structured, addressable sentences ready for the reader
**Depends on**: Phase 11 (v1.1 complete)
**Requirements**: EPUB-01, EPUB-02, EPUB-03, EPUB-04
**Success Criteria** (what must be TRUE):
  1. User can upload an EPUB file through the web interface and see it appear in a book library
  2. The system splits the book into chapters and pages of 5-7 sentences, with each sentence individually addressable
  3. User can see all uploaded books with title and cover image, and switch between them
  4. User can delete a book, removing all its associated data (chapters, sentences, reading position)
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Backend: schema, EPUB parser, multipart plugin, book CRUD API, tests
- [ ] 12-02-PLAN.md — Frontend: library view with upload, book list, delete

### Phase 13: Reader & Word Highlighting
**Goal**: Users can read a book page-by-page with words colored by familiarity status, resume where they left off, and switch between light and dark themes
**Depends on**: Phase 12
**Requirements**: READ-01, READ-02, READ-03, READ-04, HIGH-01, HIGH-02
**Success Criteria** (what must be TRUE):
  1. User sees a page of 5-7 sentences and can navigate forward/backward between pages
  2. When user closes and reopens a book, reading resumes at the exact page where they left off
  3. Words in the text are colored by status: blue (new/unknown), yellow (learning), no highlight (known) -- based on existing vocabulary data
  4. User can switch to dark/night theme for comfortable reading
  5. The "next page" button is disabled until user has opened every sentence on the current page
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md — Backend: word highlighter service, page data + position API endpoints, tests
- [ ] 13-02-PLAN.md — Frontend: ReaderView with word highlighting, dark theme, sentence gate, position persistence

### Phase 14: Analysis & Learning Flow
**Goal**: Users tap sentences to get AI analysis and explicitly decide which words to learn, completing the LingQ-style read-and-learn loop
**Depends on**: Phase 13
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04, FLOW-01, FLOW-02
**Success Criteria** (what must be TRUE):
  1. Tapping a sentence opens a modal with AI analysis: translation, new words with POS, grammar patterns, and collocations
  2. Re-tapping an already-analyzed sentence loads the cached result instantly without an AI call
  3. The modal shows only NEW words/collocations (not already in vocabulary) with "learn" and "know" buttons; pressing "learn" creates an SRS card, "know" marks familiarity without SRS
  4. Word highlighting in the reader text updates immediately after closing the analysis modal
  5. When turning to the next page, a mini-report shows counts of words added to "learn", marked "know", and grammar patterns found on the completed page
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Backend: migration, autoCreateSrsCards option, analyze/learn/know endpoints, filtering service
- [ ] 14-02-PLAN.md — Frontend: AnalysisModal with learn/know buttons, PageReport overlay, ReaderView integration

## Progress

**Execution Order:**
Phases execute in order: 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. EPUB Data Foundation | 2/2 | Complete    | 2026-03-15 | - |
| 13. Reader & Word Highlighting | 2/2 | Complete    | 2026-03-15 | - |
| 14. Analysis & Learning Flow | v2.0 | 0/2 | Not started | - |
