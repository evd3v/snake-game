---
phase: 07-service-updates-telegram-auto-add
plan: 01
subsystem: api
tags: [cefr, srs, fsrs, drizzle, tdd]

requires:
  - phase: 06-data-model-evolution
    provides: word_senses table with composite unique on (word_id, part_of_speech)
provides:
  - CEFR filter utility (shouldAutoAddWord) for B1+ threshold
  - Auto-SRS card creation in storeAnalysisResults for vocabulary words
affects: [telegram-bot, web-review, srs]

tech-stack:
  added: []
  patterns: [check-then-insert for SRS dedup, CEFR threshold filtering]

key-files:
  created: [src/services/cefr-filter.ts, tests/cefr-filter.test.ts]
  modified: [src/services/analysis.ts, tests/analysis.test.ts]

key-decisions:
  - "CEFR threshold set to B1 (not B2) -- broader inclusion catches more useful vocabulary"
  - "Null/unknown CEFR levels included by default -- err on side of inclusion per research"
  - "Check-then-insert pattern (not onConflictDoNothing) since srs_cards has no unique constraint on wordSenseId"

patterns-established:
  - "CEFR filtering: use shouldAutoAddWord() for any future auto-add decisions"
  - "Vocabulary SRS creation: mirrors grammar SRS pattern with check-then-insert"

requirements-completed: [TG-01, TG-02]

duration: 2min
completed: 2026-03-10
---

# Phase 7 Plan 1: Auto-SRS with CEFR Filter Summary

**Auto-creates vocabulary SRS cards for CEFR B1+ words during sentence analysis, with idempotent deduplication via check-then-insert**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T06:43:27Z
- **Completed:** 2026-03-10T06:45:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CEFR filter utility that partitions A1/A2 (excluded) from B1+ (included), with safe defaults for null/unknown
- storeAnalysisResults now auto-creates vocabulary SRS cards for qualifying words alongside existing grammar card auto-creation
- Idempotent deduplication: re-analyzing same sentence creates no duplicate cards
- Full TDD: 9 unit tests for CEFR filter, 3 new integration tests for auto-SRS

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CEFR filter utility with tests** - `040a153` (feat)
2. **Task 2: Add auto-SRS creation to storeAnalysisResults with tests** - `53c7bc2` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `src/services/cefr-filter.ts` - CEFR threshold filter with shouldAutoAddWord() and MIN_CEFR_FOR_AUTO_ADD constant
- `tests/cefr-filter.test.ts` - 9 unit tests covering all CEFR levels, null, and invalid inputs
- `src/services/analysis.ts` - Added .returning() on word_senses upsert, auto-SRS creation block with check-then-insert
- `tests/analysis.test.ts` - 3 new tests: auto-create B1+, no-duplicate on re-analysis, grammar cards preserved

## Decisions Made
- CEFR threshold set to B1 (not B2) for broader vocabulary capture -- resolves the blocker noted in STATE.md
- Null/unknown CEFR defaults to inclusion (safe default per research pitfall analysis)
- Used direct check-then-insert (not createSrsCard from srs.ts) because srs_cards table has no unique constraint on wordSenseId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auto-SRS pipeline complete, vocabulary cards created automatically on sentence analysis
- Ready for Phase 07 Plan 02 (Telegram bot updates / web review integration)

## Self-Check: PASSED

- [x] src/services/cefr-filter.ts exists
- [x] tests/cefr-filter.test.ts exists
- [x] src/services/analysis.ts modified
- [x] tests/analysis.test.ts modified
- [x] Commit 040a153 exists
- [x] Commit 53c7bc2 exists
- [x] All 102 tests pass (full suite)

---
*Phase: 07-service-updates-telegram-auto-add*
*Completed: 2026-03-10*
