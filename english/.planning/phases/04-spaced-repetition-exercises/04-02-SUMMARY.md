---
phase: 04-spaced-repetition-exercises
plan: 02
subsystem: api
tags: [fsrs, review-api, bullmq, srs-cards, cloze, fastify, drizzle]

# Dependency graph
requires:
  - phase: 04-spaced-repetition-exercises
    provides: SRS service (createSrsCard, rateCard, getDueCards), exercise generator, grammar_exercises table
  - phase: 03-telegram-bot-ux
    provides: vocabulary handler with familiarity flow, api-client
provides:
  - Review API routes (GET /review/due, POST /review/:cardId/rate, POST /words/:wordId/srs-card)
  - Enriched due cards with word data, sentence context, and grammar exercises
  - Auto-creation of grammar SRS cards during sentence analysis
  - Exercise generation BullMQ job type (generate-exercises)
  - Bot vocabulary hook that creates SRS cards on familiarity save
affects: [04-03, 05-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [review API with enriched card data, job-processor module for multi-job-type workers, idempotent check-then-insert for SRS cards]

key-files:
  created:
    - src/routes/review.ts
    - src/workers/job-processor.ts
    - tests/review-api.test.ts
    - tests/exercise-worker.test.ts
  modified:
    - src/bot/services/api-client.ts
    - src/bot/handlers/vocabulary.ts
    - src/workers/index.ts
    - src/services/analysis.ts
    - tests/analysis.test.ts
    - vitest.config.ts

key-decisions:
  - "Check-then-insert pattern for grammar SRS card idempotency (no unique constraint on srsCards.grammarPatternId)"
  - "Job-processor module extracted from worker for testable job routing"
  - "fileParallelism disabled in vitest to prevent shared DB state conflicts between integration tests"

patterns-established:
  - "Review API pattern: getDueCards + enrichment queries per card type (vocabulary joins words+sentences, grammar joins patterns+exercises)"
  - "Worker job routing: job-processor.ts switches on job.name, worker delegates to processJob"

requirements-completed: [SRS-02, SRS-04, SRS-05]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 04 Plan 02: Review API, SRS Hooks, and Exercise Worker Summary

**Review API returning enriched due cards with sentence context and cloze exercises, grammar SRS card auto-creation during analysis, and exercise generation BullMQ job routing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T14:18:48Z
- **Completed:** 2026-03-09T14:24:02Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Review API routes: GET /review/due returns vocabulary cards with word data and original sentence text, grammar cards with unused cloze exercises ordered by difficulty
- POST /review/:cardId/rate with FSRS scheduling update and grammar exercise marking
- POST /words/:wordId/srs-card for idempotent vocabulary SRS card creation
- storeAnalysisResults auto-creates grammar SRS cards and queues exercise generation for new patterns
- Bot vocabulary handler calls createSrsCard after familiarity is set
- 12 new integration tests (9 review API + 3 exercise worker) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Review API routes with vocabulary context and SRS card creation hooks** - `c95f5a3` (feat)
2. **Task 2: Exercise generation BullMQ worker job and auto-creation of grammar SRS cards** - `aa14769` (feat)

## Files Created/Modified
- `src/routes/review.ts` - Review API: GET /review/due, POST /review/:cardId/rate, POST /words/:wordId/srs-card
- `src/workers/job-processor.ts` - Extracted job routing (sentence-analysis, generate-exercises) for testability
- `src/workers/index.ts` - Refactored to delegate to job-processor
- `src/services/analysis.ts` - Auto-creates grammar SRS cards and queues exercise generation
- `src/bot/services/api-client.ts` - Added createSrsCard(wordId) API call
- `src/bot/handlers/vocabulary.ts` - Calls createSrsCard after familiarity save
- `tests/review-api.test.ts` - 9 tests covering review due, rating, and SRS card creation
- `tests/exercise-worker.test.ts` - 3 tests covering grammar SRS auto-creation and job routing
- `tests/analysis.test.ts` - Updated cleanup to handle new srsCards FK dependency
- `vitest.config.ts` - Disabled fileParallelism for DB test isolation

## Decisions Made
- Used check-then-insert pattern for grammar SRS card idempotency because srsCards table lacks a unique constraint on grammarPatternId (adding a unique index would require a schema migration)
- Extracted job-processor.ts from worker to make job routing testable without starting a BullMQ Worker
- Disabled vitest fileParallelism to prevent shared DB state conflicts between integration test files that use broad cleanup (delete where 1=1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SRS card idempotency without unique constraint**
- **Found during:** Task 2 (grammar SRS card auto-creation)
- **Issue:** srsCards table has no unique constraint on grammarPatternId, so onConflictDoNothing has no conflict target for deduplication
- **Fix:** Used SELECT-before-INSERT pattern: check if card exists for grammarPatternId before inserting
- **Files modified:** src/services/analysis.ts
- **Verification:** exercise-worker.test.ts "does not duplicate SRS cards on re-analysis" passes
- **Committed in:** aa14769

**2. [Rule 3 - Blocking] Test cleanup FK constraint violations**
- **Found during:** Task 2 (full suite regression check)
- **Issue:** review-api test cleanup deleted from tables in wrong order causing FK violations; analysis tests didn't clean srsCards created by updated storeAnalysisResults
- **Fix:** Added proper cleanup order (reviewLogs, grammarExercises, srsCards before grammarPatterns/words), added fileParallelism: false
- **Files modified:** tests/review-api.test.ts, tests/analysis.test.ts, vitest.config.ts
- **Verification:** All 70 tests pass across 13 files
- **Committed in:** aa14769

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness and test stability. No scope creep.

## Issues Encountered
None beyond the auto-fixed issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Review API ready for Telegram bot /review command (04-03)
- Exercise generation pipeline complete: analysis -> SRS card -> BullMQ job -> AI exercises
- All 70 tests green, no regressions

---
*Phase: 04-spaced-repetition-exercises*
*Completed: 2026-03-09*
