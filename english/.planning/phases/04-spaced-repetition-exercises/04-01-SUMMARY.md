---
phase: 04-spaced-repetition-exercises
plan: 01
subsystem: api
tags: [fsrs, ts-fsrs, spaced-repetition, cloze, ai, drizzle, zod]

# Dependency graph
requires:
  - phase: 01-core-schema-api
    provides: srs_cards table, grammar_patterns table, drizzle schema patterns
  - phase: 02-ai-analysis-pipeline
    provides: AI structured output pattern (generateText + Output.object)
provides:
  - FSRS card lifecycle service (createSrsCard, rateCard, getDueCards)
  - State mapping between DB string enum and ts-fsrs numeric State
  - grammar_exercises table for cloze fill-in-the-blank exercises
  - review_logs table for review analytics
  - AI cloze exercise generation with difficulty levels 1-3
  - Zod schema for cloze exercise validation
affects: [04-02, 05-analytics]

# Tech tracking
tech-stack:
  added: [ts-fsrs]
  patterns: [FSRS scheduling, AI cloze generation, review log tracking]

key-files:
  created:
    - src/services/srs.ts
    - src/services/exercise-generator.ts
    - src/db/schema/grammar-exercises.ts
    - src/db/schema/review-logs.ts
    - src/lib/ai/cloze-schemas.ts
    - src/lib/ai/cloze-prompts.ts
    - tests/srs-service.test.ts
    - tests/exercise-generator.test.ts
  modified:
    - src/db/schema/index.ts
    - package.json

key-decisions:
  - "ts-fsrs scheduler.next(card, now, rating) returns {card, log} directly when given specific rating"
  - "FSRS scheduler configured with request_retention=0.9 and enable_fuzz=true"
  - "onConflictDoNothing for idempotent SRS card creation"

patterns-established:
  - "SRS service pattern: toFsrsCard/toDbState for state enum mapping between DB and ts-fsrs"
  - "Cloze generation pattern: AI structured output with Zod schema validation"

requirements-completed: [SRS-01, SRS-03, SRS-04, SRS-06]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 04 Plan 01: SRS Service and Cloze Generation Summary

**FSRS scheduling service with card lifecycle management and AI-powered cloze exercise generation for grammar patterns**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T14:12:08Z
- **Completed:** 2026-03-09T14:15:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- FSRS card lifecycle (create, rate, query due) with ts-fsrs library integration
- grammar_exercises and review_logs tables with drizzle migration
- AI cloze exercise generation with difficulty levels 1-3 and Zod validation
- 16 unit/integration tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, SRS service, and unit tests** - `401ba97` (feat)
2. **Task 2: Cloze exercise generation service and tests** - `351594f` (feat)

## Files Created/Modified
- `src/services/srs.ts` - FSRS card lifecycle: createSrsCard, rateCard, getDueCards, state mapping
- `src/services/exercise-generator.ts` - AI cloze exercise generation and DB storage
- `src/db/schema/grammar-exercises.ts` - grammar_exercises table (sentence, cloze_answer, difficulty_level, hint)
- `src/db/schema/review-logs.ts` - review_logs table for review history tracking
- `src/lib/ai/cloze-schemas.ts` - Zod schema for cloze exercise AI output validation
- `src/lib/ai/cloze-prompts.ts` - System and user prompts for cloze generation
- `src/db/schema/index.ts` - Added exports for grammarExercises and reviewLogs
- `tests/srs-service.test.ts` - 9 tests covering card CRUD, rating, state transitions, due queries
- `tests/exercise-generator.test.ts` - 7 tests covering schema validation, prompts, and mocked AI generation

## Decisions Made
- ts-fsrs `scheduler.next(card, now, rating)` returns `{card, log}` directly when given a specific rating (not a map of all ratings)
- FSRS scheduler configured with `request_retention: 0.9` and `enable_fuzz: true` for optimal retention
- `onConflictDoNothing` for idempotent SRS card creation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ts-fsrs scheduler.next() API call**
- **Found during:** Task 1 (SRS service implementation)
- **Issue:** Initial implementation passed a filter function as 3rd arg to scheduler.next(), but ts-fsrs expects a Rating value directly
- **Fix:** Changed from `scheduler.next(card, now, (grade) => grade === rating)` to `scheduler.next(card, now, rating)`
- **Files modified:** src/services/srs.ts
- **Verification:** All 9 SRS tests pass
- **Committed in:** 401ba97

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** API usage fix necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed ts-fsrs API issue above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SRS service ready for review API endpoints (04-02)
- Exercise generator ready for bot integration
- grammar_exercises and review_logs tables in sync with DB

---
*Phase: 04-spaced-repetition-exercises*
*Completed: 2026-03-09*
