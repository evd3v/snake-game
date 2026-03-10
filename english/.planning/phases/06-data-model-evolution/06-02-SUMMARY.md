---
phase: 06-data-model-evolution
plan: 02
subsystem: api
tags: [drizzle, postgres, word-senses, routes, bot, srs]

# Dependency graph
requires:
  - phase: 06-01
    provides: "word_senses table, srs_cards.word_sense_id column, updated analysis pipeline"
provides:
  - "All routes query vocabulary through word_senses (not words directly)"
  - "POST /word-senses/:wordSenseId/srs-card endpoint"
  - "Bot types with partOfSpeech and senseId"
  - "Dashboard raw SQL queries join through word_senses"
affects: [07-auto-add, 08-web-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [word-sense-aware-queries, sense-id-propagation]

key-files:
  created: []
  modified:
    - src/services/srs.ts
    - src/routes/review.ts
    - src/routes/words.ts
    - src/routes/dashboard.ts
    - src/bot/services/api-client.ts
    - src/bot/handlers/vocabulary.ts
    - tests/db.test.ts
    - tests/dashboard-api.test.ts
    - tests/review-api.test.ts
    - tests/srs-service.test.ts
    - tests/bot-review.test.ts
    - tests/bot-vocabulary.test.ts
    - tests/words-api.test.ts
    - tests/word-family.test.ts
    - tests/analysis.test.ts
    - tests/exercise-worker.test.ts

key-decisions:
  - "POST /words/:wordId/srs-card renamed to POST /word-senses/:wordSenseId/srs-card"
  - "PATCH /words/:id/familiarity kept for backward compatibility but updates word_senses"
  - "GET /sentences/:sentenceId/words returns senseId field for bot to create SRS cards"

patterns-established:
  - "Vocabulary queries always join through word_senses for translation/familiarity/POS"
  - "SRS card creation requires wordSenseId, not wordId"

requirements-completed: [DATA-02]

# Metrics
duration: 9min
completed: 2026-03-10
---

# Phase 6 Plan 02: Consumer Updates Summary

**All routes, services, bot, and tests rewired from word_id to word_sense_id for vocabulary SRS cards**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-10T05:01:11Z
- **Completed:** 2026-03-10T05:10:30Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Rewired all 4 server routes (review, words, dashboard, srs service) to query vocabulary through word_senses
- Updated bot types to include partOfSpeech and senseId for sense-aware SRS card creation
- Updated all 10 test files to use word_senses schema, all 90 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SRS service, review route, words route, and dashboard queries** - `2a6e667` (feat)
2. **Task 2: Update bot types, vocabulary handler, and tests** - `9a45380` (feat)

## Files Created/Modified
- `src/services/srs.ts` - createSrsCard takes wordSenseId instead of wordId
- `src/routes/review.ts` - Vocabulary cards join srs_cards -> word_senses -> words; endpoint renamed
- `src/routes/words.ts` - LEFT JOINs word_senses for translation/familiarity/POS/senseId
- `src/routes/dashboard.ts` - All 4 raw SQL queries join through word_senses
- `src/bot/services/api-client.ts` - WordInfo and DueCard types updated with partOfSpeech/senseId
- `src/bot/handlers/vocabulary.ts` - createSrsCard passes senseId from word info
- `tests/*.ts` - 10 test files updated for word_senses schema

## Decisions Made
- Renamed SRS card creation endpoint from `/words/:wordId/srs-card` to `/word-senses/:wordSenseId/srs-card` since cards now link to senses
- Kept PATCH `/words/:id/familiarity` endpoint path for backward compatibility but it now updates all word_senses for the given word_id
- Added `senseId` field to GET `/sentences/:sentenceId/words` response so the bot can pass it when creating SRS cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed dashboard stats raw SQL query result extraction**
- **Found during:** Task 2 (running tests)
- **Issue:** `db.execute(sql)` returns `{ rows: [...] }` but code attempted direct destructuring as array
- **Fix:** Extract from `result.rows[0]` with nullish coalescing fallback to 0
- **Files modified:** src/routes/dashboard.ts
- **Verification:** Dashboard stats tests pass
- **Committed in:** 9a45380

**2. [Rule 3 - Blocking] Fixed FK constraint violations in test cleanup**
- **Found during:** Task 2 (running tests)
- **Issue:** Test cleanup functions in analysis.test.ts, exercise-worker.test.ts, and word-family.test.ts didn't delete word_senses before words, causing FK violation
- **Fix:** Added `wordSenses` import and deletion step before words cleanup in all affected test files
- **Files modified:** tests/analysis.test.ts, tests/exercise-worker.test.ts, tests/word-family.test.ts
- **Verification:** All 90 tests pass
- **Committed in:** 9a45380

**3. [Rule 3 - Blocking] Fixed test data using removed schema columns**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Multiple test files (word-family, words-api, review-api, srs-service) inserted `translation`/`familiarity` into words table or `wordId` into srs_cards -- columns removed in plan 06-01
- **Fix:** Updated all test data to use word_senses for translation/familiarity and wordSenseId for srs_cards; created real word_sense records for FK compliance
- **Files modified:** 7 test files
- **Verification:** TypeScript compiles, all tests pass
- **Committed in:** 9a45380

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema migration fully complete -- all consumers use word_senses
- Ready for Phase 7 (auto-add) and Phase 8 (web review)
- normalizeLemma() adverb collapsing concern remains (noted in STATE.md)

---
*Phase: 06-data-model-evolution*
*Completed: 2026-03-10*
