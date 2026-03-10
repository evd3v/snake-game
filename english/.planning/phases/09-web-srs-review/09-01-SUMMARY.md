---
phase: 09-web-srs-review
plan: 01
subsystem: api, ui
tags: [fastify, pinia, vue-router, srs, staleness-guard]

requires:
  - phase: 08-vocabulary-page
    provides: frontend patterns (Pinia store, API client, router)
provides:
  - Staleness guard on POST /review/:cardId/rate (409 on stale fetchedAt)
  - DueCard and ReviewStats TypeScript types
  - useReviewStore Pinia store with session lifecycle
  - /review route registered in vue-router
affects: [09-02-review-ui-components]

tech-stack:
  added: []
  patterns: [staleness guard via fetchedAt timestamp, 409 skip in Pinia store]

key-files:
  created: [web/src/stores/review.ts]
  modified: [src/routes/review.ts, tests/review-api.test.ts, web/src/types/api.ts, web/src/router/index.ts]

key-decisions:
  - "409 skip logic in store: stale cards silently skipped without counting in session stats"
  - "fetchedAt stored once at session start, sent with every rate call for staleness detection"

patterns-established:
  - "Staleness guard: optional fetchedAt field enables multi-client safety without breaking backward compat"
  - "Review store session pattern: start -> reveal -> rate -> complete with stats tracking"

requirements-completed: [WREV-01, WREV-02, WREV-03, WREV-06]

duration: 2min
completed: 2026-03-10
---

# Phase 09 Plan 01: Review API Staleness Guard + Frontend Store Summary

**Staleness guard on rate endpoint (409 on stale review) with Pinia review store, types, and /review route for session management**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T08:43:47Z
- **Completed:** 2026-03-10T08:45:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Staleness guard rejects rate attempts when card was reviewed after fetchedAt timestamp (409)
- Full review session store with start/reveal/rate/end lifecycle and 409 skip logic
- DueCard and ReviewStats types define the API contract for Plan 02 components
- /review route registered for upcoming ReviewView.vue

## Task Commits

Each task was committed atomically:

1. **Task 1: Add staleness guard to rate endpoint + test** - `093c67e` (feat, TDD)
2. **Task 2: Create review types, Pinia store, and route** - `a68bc92` (feat)

## Files Created/Modified
- `src/routes/review.ts` - Added fetchedAt param and staleness guard to rate endpoint
- `tests/review-api.test.ts` - 3 new tests: stale 409, fresh success, backward compat
- `web/src/types/api.ts` - Added DueCard and ReviewStats interfaces
- `web/src/stores/review.ts` - New Pinia store with session lifecycle and 409 skip
- `web/src/router/index.ts` - Added /review route

## Decisions Made
- 409 skip logic: stale cards silently skipped without counting in session stats (avoids user confusion)
- fetchedAt stored once at session start and sent with every rate call (single timestamp for entire batch)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Review store and types ready for Plan 02 UI components (ReviewView.vue, card display, rating buttons)
- Backend staleness guard fully tested and backward compatible with Telegram bot

## Self-Check: PASSED

All files exist, all commits verified, all must_haves artifacts confirmed.

---
*Phase: 09-web-srs-review*
*Completed: 2026-03-10*
