---
phase: 02-ai-analysis-pipeline
plan: 02
subsystem: database, services
tags: [drizzle, upsert, dedup, word-families, integration-tests, vitest]

# Dependency graph
requires:
  - phase: 02-01
    provides: AI SDK schemas (SentenceAnalysis type), normalizeLemma function
  - phase: 01-01
    provides: Database schema tables (sentences, words, collocations, grammar_patterns, word_families, junction tables)
provides:
  - storeAnalysisResults service for persisting AI analysis to DB with deduplication
  - linkWordFamilies service for word family detection and linking
  - Mock AI analysis fixture for tests
  - Collocation unique constraint for dedup
  - 10 integration tests covering all storage and dedup scenarios
affects: [02-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [upsert-with-onConflictDoUpdate, junction-table-onConflictDoNothing, word-family-linking]

key-files:
  created:
    - src/services/analysis.ts
    - src/services/word-family.ts
    - tests/fixtures/analysis-result.ts
    - tests/analysis.test.ts
    - tests/word-family.test.ts
  modified:
    - src/db/schema/collocations.ts

key-decisions:
  - "Upsert words on lemma conflict updates thematicCluster (AI may refine on re-encounter)"
  - "Upsert collocations on text conflict updates translation only"
  - "Junction table inserts use onConflictDoNothing for idempotent re-submission"

patterns-established:
  - "Upsert pattern: insert().onConflictDoUpdate() with .returning() for ID retrieval"
  - "Junction insert pattern: onConflictDoNothing() on composite PK tables"
  - "Word family linking: check existing words first, reuse family ID if found, create new otherwise"

requirements-completed: [SENT-04, SENT-06, SENT-07, VOCAB-04, VOCAB-05, VOCAB-06, VOCAB-07]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 2 Plan 02: Analysis Storage and Word Family Linking Summary

**Analysis storage service with word/collocation/grammar deduplication via upserts, word family linking service, and 10 integration tests verifying all storage and dedup scenarios**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T11:44:52Z
- **Completed:** 2026-03-09T11:48:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- storeAnalysisResults service orchestrating sentence, words, collocations, grammar patterns, and word families into DB with full deduplication
- linkWordFamilies service detecting and linking related word forms via shared word_family_id
- Collocation unique constraint enabling onConflictDoUpdate for dedup
- 10 integration tests (8 analysis, 2 word-family) all passing against real database

## Task Commits

Each task was committed atomically:

1. **Task 1: Analysis service, word family service, mock fixture, collocation constraint** - `bb0f6fc` (feat)
2. **Task 2: Integration tests for analysis and word family** - `8603d86` (test)

## Files Created/Modified
- `src/services/analysis.ts` - Main analysis storage orchestrator with upserts and junction linking
- `src/services/word-family.ts` - Word family detection and linking service
- `tests/fixtures/analysis-result.ts` - Mock AI analysis fixture with realistic sentence data
- `tests/analysis.test.ts` - 8 integration tests for storeAnalysisResults
- `tests/word-family.test.ts` - 2 integration tests for linkWordFamilies
- `src/db/schema/collocations.ts` - Added unique constraint on text column

## Decisions Made
- Upsert words on lemma conflict updates thematicCluster field, since AI may provide better cluster assignment on re-encounter of the same word
- Upsert collocations on text conflict updates translation only, preserving the original type and CEFR level
- Junction table inserts use onConflictDoNothing for idempotent behavior when the same sentence-word/collocation/pattern link already exists

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analysis storage service ready for integration with BullMQ worker (Plan 02-03)
- All DB storage and dedup logic tested and verified
- Mock fixture available for future tests

---
*Phase: 02-ai-analysis-pipeline*
*Completed: 2026-03-09*
