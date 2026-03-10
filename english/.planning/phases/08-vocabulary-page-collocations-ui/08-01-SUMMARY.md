---
phase: 08-vocabulary-page-collocations-ui
plan: 01
subsystem: api
tags: [fastify, drizzle, rest-api, vocabulary, srs, pagination]

requires:
  - phase: 06-word-senses-schema
    provides: word_senses table with composite unique (word_id, part_of_speech)
  - phase: 07-service-updates
    provides: SRS auto-add with CEFR filtering, check-then-insert dedup pattern
provides:
  - Vocabulary list API with search, filter (familiarity, CEFR, cluster, SRS state), sort (lemma, date, CEFR)
  - Word detail API with collocations via shared sentences, word family, sentences
  - Mark-known action (delete SRS cards) and reset action (create fresh SRS cards)
affects: [08-02-vocabulary-frontend]

tech-stack:
  added: []
  patterns: [batch-fetch-then-assemble for avoiding N+1, EXISTS subquery for SRS state filtering, CASE expression for CEFR ordering]

key-files:
  created:
    - src/routes/vocabulary.ts
    - tests/vocabulary-api.test.ts
  modified: []

key-decisions:
  - "Batch-fetch strategy: query words first with filters/pagination, then batch-fetch senses and SRS cards for the page"
  - "SRS state filtering uses EXISTS/NOT EXISTS subqueries for correctness with vocabulary card type"
  - "Collocations fetched via indirect path: sentenceWords -> sentenceCollocations -> collocations with selectDistinct"
  - "Word detail, mark-known, and reset implemented together in same route plugin file"

patterns-established:
  - "Batch-fetch-then-assemble: avoid JOINs that multiply rows, query entity IDs first, then batch related data"
  - "CEFR sort via SQL CASE expression mapping A1=1 through C2=6"

requirements-completed: [VOCPG-01, VOCPG-02, VOCPG-03, VOCPG-04, VOCPG-05, VOCPG-06, VOCPG-07, VOCPG-08]

duration: 3min
completed: 2026-03-10
---

# Phase 08 Plan 01: Vocabulary API Summary

**REST API for vocabulary list (paginated, searchable, filterable, sortable), word detail with collocations/family/sentences, and mark-known/reset SRS actions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T08:07:56Z
- **Completed:** 2026-03-10T08:10:49Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- GET /vocabulary with pagination, search (ilike), and filters for familiarity, CEFR level, thematic cluster, and SRS state
- GET /vocabulary/:wordId returns word detail with senses (including SRS card data), collocations via shared sentences, word family siblings, and linked sentences
- POST mark-known deletes vocabulary SRS cards; POST reset creates fresh cards for senses missing them
- 19 integration tests covering all endpoints, filters, sorting, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs for vocabulary API** - `de0a2c2` (test)
2. **Task 2: Implement vocabulary list API endpoint** - `5f620fd` (feat)
3. **Task 3: Implement word detail, mark-known, and reset endpoints** - included in `5f620fd` (all endpoints implemented together in same route plugin)

## Files Created/Modified
- `src/routes/vocabulary.ts` - Fastify plugin with GET /vocabulary, GET /vocabulary/:wordId, POST mark-known, POST reset
- `tests/vocabulary-api.test.ts` - 19 integration tests with seed data covering list, detail, mark-known, reset

## Decisions Made
- Batch-fetch strategy avoids N+1: query word IDs with filters first, then batch senses and SRS cards for the page
- SRS state filtering uses EXISTS/NOT EXISTS subqueries scoped to vocabulary card type
- Collocations fetched via indirect join path through sentenceWords and sentenceCollocations with selectDistinct
- All endpoints implemented in single route plugin since they share the same /vocabulary prefix

## Deviations from Plan

None - plan executed exactly as written. Task 3 code was combined with Task 2 commit since all endpoints belong to the same route plugin file.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vocabulary API fully operational, ready for frontend consumption in Plan 02
- All 115 tests in full suite pass (19 vocabulary + 96 existing)

---
*Phase: 08-vocabulary-page-collocations-ui*
*Completed: 2026-03-10*
