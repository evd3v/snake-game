---
phase: 11-grammar-collocations-browse-pages
plan: 01
subsystem: api
tags: [fastify, drizzle, pagination, grammar, collocations, browse]

requires:
  - phase: 08-web-vocabulary-browse
    provides: "Vocabulary route pattern (pagination, filters, batch-fetch)"
provides:
  - "GET /grammar API endpoint with pagination, CEFR filter, text search, SRS state filter, example sentences"
  - "GET /collocations API endpoint with pagination, CEFR filter, type filter, text search, example sentences"
affects: [11-02-frontend-browse-pages, phase-10-collocation-srs]

tech-stack:
  added: []
  patterns: ["batch-fetch example sentences via junction tables", "SRS state filter via exists/notExists subquery"]

key-files:
  created:
    - src/routes/grammar.ts
    - src/routes/collocations.ts
    - tests/grammar-api.test.ts
    - tests/collocations-api.test.ts
  modified: []

key-decisions:
  - "Collocations SRS state filter deferred to Phase 10 (collocationId not yet on srs_cards)"
  - "Grammar search uses OR across pattern and description fields"
  - "Example sentences limited to 3 per item via JS slice after batch-fetch"

patterns-established:
  - "Junction table batch-fetch: query sentenceGrammarPatterns/sentenceCollocations with inArray, group in JS, slice to limit"

requirements-completed: [BROWSE-01, BROWSE-02, BROWSE-03]

duration: 3min
completed: 2026-03-10
---

# Phase 11 Plan 01: Grammar & Collocations Browse API Summary

**GET /grammar and GET /collocations endpoints with pagination, CEFR/type/text filters, SRS state filtering (grammar only), and batch-fetched example sentences**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T11:48:31Z
- **Completed:** 2026-03-10T11:51:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GET /grammar returns paginated grammar patterns with CEFR filter, text search (pattern+description OR), SRS state filter, and up to 3 example sentences per pattern
- GET /collocations returns paginated collocations with CEFR filter, type filter (collocation/phrasal_verb/idiom), text search, and up to 3 example sentences
- Both endpoints follow the established vocabulary route pattern exactly
- 16 integration tests (9 grammar + 7 collocations) all pass, 2 SRS tests skipped pending Phase 10

## Task Commits

Each task was committed atomically:

1. **Task 1: Grammar API route with tests** - `93de6e7` (test) + `036c38f` (feat)
2. **Task 2: Collocations API route with tests** - `4391db3` (test) + `e5be8be` (feat)

_TDD tasks have separate test and implementation commits._

## Files Created/Modified
- `src/routes/grammar.ts` - GET /grammar endpoint with pagination, filters, example sentences
- `src/routes/collocations.ts` - GET /collocations endpoint with pagination, filters, example sentences
- `tests/grammar-api.test.ts` - 9 integration tests for grammar API
- `tests/collocations-api.test.ts` - 9 integration tests (7 active, 2 skipped) for collocations API

## Decisions Made
- Collocations SRS state filter deferred: srs_cards lacks collocationId column and 'collocation' cardType (Phase 10 prerequisite). Route has TODO comment; tests use it.skip.
- Grammar search uses OR across pattern and description fields to catch matches in either.
- Example sentences limited to 3 per item via JS grouping after batch-fetch (not SQL LIMIT per group) -- same approach as vocabulary route.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test cleanup required clearing sentence_collocations and sentence_words before sentences due to FK constraints. Fixed cleanup order in afterEach.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both API endpoints ready for frontend browse pages (Phase 11 Plan 02)
- Collocations SRS filtering ready to enable once Phase 10 completes schema migration

## Self-Check: PASSED

All 4 files verified present. All 4 commit hashes verified in git log.

---
*Phase: 11-grammar-collocations-browse-pages*
*Completed: 2026-03-10*
