---
phase: 14-analysis-learning-flow
plan: 01
subsystem: api
tags: [bullmq, drizzle, srs, reader, analysis, fastify]

requires:
  - phase: 12-epub-upload-parse
    provides: book_sentences table and EPUB processing pipeline
  - phase: 13-reader-word-highlighting
    provides: word-highlighter service and reader page API
provides:
  - sentence_id FK on book_sentences linking to analysis results
  - autoCreateSrsCards option for storeAnalysisResults
  - getFilteredAnalysis service returning new-only vocabulary items
  - Reader analyze/learn/know API endpoints
affects: [14-02-reader-analysis-ui, reader-frontend]

tech-stack:
  added: []
  patterns: [cache-or-queue analysis pattern, filtered analysis for reader context]

key-files:
  created:
    - drizzle/0007_analysis_link.sql
    - src/services/reader-analysis.ts
  modified:
    - src/db/schema/books.ts
    - src/services/analysis.ts
    - src/workers/job-processor.ts
    - src/routes/books.ts

key-decisions:
  - "Raw SQL for getFilteredAnalysis following word-highlighter pattern for batch efficiency"
  - "autoCreateSrsCards default true preserves backward compatibility for sentence input and Telegram flows"

patterns-established:
  - "Cache-or-queue: check sentence_id FK, return cached filtered results or queue new analysis"
  - "Reader learn/know split: learn creates SRS card + sets familiarity, know sets familiarity only"

requirements-completed: [ANAL-01, ANAL-02, ANAL-03, ANAL-04, FLOW-02]

duration: 3min
completed: 2026-03-15
---

# Phase 14 Plan 01: Analysis Learning Flow Backend Summary

**Reader sentence analysis API with cache-or-queue pattern, filtered new-only results, and learn/know actions for words, collocations, and grammar**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T07:29:19Z
- **Completed:** 2026-03-15T07:32:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Migration linking book_sentences to analysis sentences via sentence_id FK
- storeAnalysisResults now supports autoCreateSrsCards option (disabled for reader flow, enabled for sentence input)
- getFilteredAnalysis service returns only new words/collocations/grammar not already in user vocabulary
- Full set of learn/know endpoints for words, collocations, and grammar patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration, schema update, and autoCreateSrsCards option** - `da63762` (feat)
2. **Task 2: Reader analysis service and API endpoints** - `7c687e7` (feat)

## Files Created/Modified
- `drizzle/0007_analysis_link.sql` - Adds sentence_id FK column to book_sentences
- `src/db/schema/books.ts` - bookSentences schema updated with sentenceId column
- `src/services/analysis.ts` - autoCreateSrsCards option wrapping SRS card creation blocks
- `src/workers/job-processor.ts` - Handles bookSentenceId, links book_sentences after analysis
- `src/services/reader-analysis.ts` - Batch queries for filtered new-only analysis results
- `src/routes/books.ts` - 8 new endpoints: analyze, status, learn/know for words/collocations/grammar

## Decisions Made
- Used raw SQL for getFilteredAnalysis (consistent with word-highlighter pattern, efficient batch queries)
- autoCreateSrsCards defaults to true for full backward compatibility with existing flows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Migration file blocked by .gitignore `drizzle/*.sql` pattern, required force-add (consistent with prior migrations)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend API complete for reader analysis flow
- Ready for 14-02: reader analysis UI (frontend panel showing analysis results with learn/know buttons)

---
*Phase: 14-analysis-learning-flow*
*Completed: 2026-03-15*
