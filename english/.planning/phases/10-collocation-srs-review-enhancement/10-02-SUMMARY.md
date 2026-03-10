---
phase: 10-collocation-srs-review-enhancement
plan: 02
subsystem: api, ui, bot
tags: [review, srs, collocations, grammar, vue, telegram]

requires:
  - phase: 10-collocation-srs-review-enhancement/01
    provides: collocation SRS schema (collocationId on srs_cards, cardType='collocation')
provides:
  - Collocation card enrichment in review route
  - Grammar card exampleSentence enrichment (CSRS-03)
  - Collocation card rendering in web and bot
  - Dashboard 3-category stats (words, grammar, collocations)
  - SRS state filtering on collocations browse page
affects: []

tech-stack:
  added: []
  patterns: [collocation-review-enrichment, grammar-example-sentence, three-category-dashboard]

key-files:
  created:
    - tests/collocation-review.test.ts
    - tests/grammar-review-enhanced.test.ts
  modified:
    - src/routes/review.ts
    - src/routes/dashboard.ts
    - src/routes/collocations.ts
    - web/src/types/api.ts
    - web/src/components/review/ReviewCard.vue
    - web/src/components/dashboard/ProgressCounters.vue
    - web/src/stores/collocations.ts
    - web/src/components/collocations/CollocationFilters.vue
    - src/bot/services/api-client.ts
    - src/bot/handlers/review.ts

key-decisions:
  - "Collocation cards require reveal before rating (like vocabulary), not auto-show rating (like exercise-less grammar)"
  - "Grammar exampleSentence fetched via sentenceGrammarPatterns junction to show user's own text"
  - "Dashboard collocations added as third category in stats result object"

patterns-established:
  - "Collocation review enrichment: fetch collocation data + context sentence via sentenceCollocations junction"
  - "SRS state filtering pattern reused from vocabulary (EXISTS/NOT EXISTS subqueries) for collocations"

requirements-completed: [CSRS-02, CSRS-03]

duration: 5min
completed: 2026-03-10
---

# Phase 10 Plan 02: Collocation Review UI & Enrichment Summary

**Collocation cards wired into web/bot review with enriched data, grammar backs enhanced with description + example sentence, dashboard shows 3-category stats**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T15:42:41Z
- **Completed:** 2026-03-10T15:47:59Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Collocation cards appear in review with text, translation, type, CEFR level, and context sentence
- Grammar card backs now show pattern description and example sentence from user's texts
- Dashboard stats return 3 categories: words, grammar, collocations
- Collocations browse page supports SRS state filtering (new, learning, known, no_card)
- Bot can display and rate collocation cards with proper formatting

## Task Commits

Each task was committed atomically:

1. **Task 1: Review route enrichment and dashboard fix** - `2d25c13` (feat)
2. **Task 2: Frontend and bot updates for collocation review** - `5c104f2` (feat)

## Files Created/Modified
- `src/routes/review.ts` - Added collocation enrichment case and grammar exampleSentence fetch
- `src/routes/dashboard.ts` - 3-category stats mapping (words, grammar, collocations)
- `src/routes/collocations.ts` - SRS state filtering with EXISTS/NOT EXISTS subqueries + srsState in response
- `web/src/types/api.ts` - Extended DueCard with collocation/exampleSentence, ProgressStats with collocations
- `web/src/components/review/ReviewCard.vue` - Collocation card template + grammar back enhancements
- `web/src/components/dashboard/ProgressCounters.vue` - Added collocations group
- `web/src/stores/collocations.ts` - Added srsState filter to query params
- `web/src/components/collocations/CollocationFilters.vue` - Added SRS state dropdown
- `src/bot/services/api-client.ts` - Extended DueCard type with collocation fields
- `src/bot/handlers/review.ts` - Collocation front/reveal formatting + grammar description/example
- `tests/collocation-review.test.ts` - Tests for collocation card enrichment
- `tests/grammar-review-enhanced.test.ts` - Tests for grammar exampleSentence enrichment

## Decisions Made
- Collocation cards follow vocabulary pattern (require reveal before rating) since the default `shouldShowRating()` returns false for non-grammar types
- Grammar exampleSentence fetched via sentenceGrammarPatterns junction to show sentences from user's own texts
- SRS state filtering reuses the EXISTS/NOT EXISTS subquery pattern established in Phase 8 for vocabulary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added collocations to ProgressCounters dashboard component**
- **Found during:** Task 2
- **Issue:** Plan mentioned extending ProgressStats type but not the ProgressCounters.vue component that renders the stats
- **Fix:** Added collocationsTotal computed + third group block in template
- **Files modified:** web/src/components/dashboard/ProgressCounters.vue
- **Verification:** vue-tsc --noEmit passes
- **Committed in:** 5c104f2

**2. [Rule 2 - Missing Critical] Added srsState to CollocationFilters type and store**
- **Found during:** Task 2
- **Issue:** CollocationFilters interface and store missing srsState field needed for filter dropdown
- **Fix:** Added srsState to CollocationFilters type, store defaults, query params, and clear logic
- **Files modified:** web/src/types/api.ts, web/src/stores/collocations.ts, web/src/components/collocations/CollocationFilters.vue
- **Verification:** vue-tsc --noEmit passes
- **Committed in:** 5c104f2

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for complete functionality. The plan's task 2 covered the filter backend but not the full frontend plumbing.

## Issues Encountered
- Docker not running so integration tests could not execute against database. Verified with tsc/vue-tsc type checking instead. Pre-existing issue affecting all tests equally.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 complete: collocation SRS cards created automatically (plan 01) and reviewable in web + bot (plan 02)
- All collocation review features wired end-to-end

---
*Phase: 10-collocation-srs-review-enhancement*
*Completed: 2026-03-10*
