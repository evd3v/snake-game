---
phase: 13-reader-word-highlighting
plan: 01
subsystem: api
tags: [tokenization, vocabulary-lookup, drizzle, batch-query, reading-position]

requires:
  - phase: 12-epub-data-foundation
    provides: books/bookSentences/readingPositions schema and EPUB upload pipeline
provides:
  - Word highlighter service (tokenize + batch vocabulary status lookup)
  - GET /books/:id/page/:pageNum endpoint with per-word highlights
  - PUT /books/:id/position upsert endpoint
affects: [14-reader-ui, reader-frontend]

tech-stack:
  added: []
  patterns: [batch-lemma-lookup, tokenize-then-highlight, upsert-reading-position]

key-files:
  created:
    - src/services/word-highlighter.ts
    - tests/word-highlighter.test.ts
    - tests/reader-api.test.ts
  modified:
    - src/routes/books.ts

key-decisions:
  - "Raw SQL batch query for vocabulary lookup (words + word_senses + srs_cards JOIN) for simplicity and performance"
  - "Status priority: learning > new > known -- most actionable status wins when word has multiple senses"
  - "Only word tokens returned in highlights array (punctuation excluded)"

patterns-established:
  - "Batch vocabulary lookup: collect all unique lemmas, one SQL query, map back to tokens"
  - "Page endpoint returns savedPosition alongside sentences for reader state restoration"

requirements-completed: [READ-01, READ-02, HIGH-01, HIGH-02]

duration: 3min
completed: 2026-03-15
---

# Phase 13 Plan 01: Reader Backend API Summary

**Word highlighter service with batch vocabulary lookup and page/position API endpoints**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T06:58:59Z
- **Completed:** 2026-03-15T07:02:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Word highlighter service tokenizes sentences and batch-queries vocabulary status (new/learning/known/null) in one DB call
- GET /books/:id/page/:pageNum returns sentences with per-word highlight data and saved reading position
- PUT /books/:id/position upserts reading position with onConflictDoUpdate
- 14 new tests (8 unit + 6 integration) all passing, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Word highlighter service with unit tests** - `cea01e1` (feat)
2. **Task 2: Page data and position API endpoints with integration tests** - `f8cee06` (feat)

_Both tasks used TDD: RED (failing tests) -> GREEN (implementation) -> verified_

## Files Created/Modified
- `src/services/word-highlighter.ts` - Tokenization, lemma generation, batch vocabulary lookup, highlight mapping
- `src/routes/books.ts` - Added GET /books/:id/page/:pageNum and PUT /books/:id/position endpoints
- `tests/word-highlighter.test.ts` - Unit tests for tokenize() and highlightSentences()
- `tests/reader-api.test.ts` - Integration tests for page and position endpoints

## Decisions Made
- Used raw SQL for the batch vocabulary join query (words + word_senses + srs_cards) -- simpler than chaining Drizzle query builder for a three-table join with left join
- Status priority logic: if a word has multiple senses, the most actionable status wins (learning > new > known)
- Punctuation tokens are excluded from highlights array -- only word tokens are returned

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Page data API ready for reader UI (Plan 02) to consume
- Position persistence ready for reading progress tracking
- Highlight data structure (word, offset, length, status) designed for frontend rendering

---
*Phase: 13-reader-word-highlighting*
*Completed: 2026-03-15*
