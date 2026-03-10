---
phase: 06-data-model-evolution
plan: 01
subsystem: database
tags: [drizzle, postgres, migration, schema, word-senses, pos]

# Dependency graph
requires:
  - phase: 05-srs-review
    provides: "srs_cards table with word_id column"
provides:
  - "word_senses table with composite unique on (word_id, part_of_speech)"
  - "Two-step word/sense upsert in analysis pipeline"
  - "srs_cards linked to word_senses instead of words"
affects: [06-02-consumer-updates, 07-auto-add, 08-web-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-step-upsert, pos-aware-senses]

key-files:
  created:
    - src/db/schema/word-senses.ts
    - drizzle/0003_word_senses.sql
    - drizzle/meta/0003_snapshot.json
  modified:
    - src/db/schema/words.ts
    - src/db/schema/srs-cards.ts
    - src/db/schema/index.ts
    - src/db/relations.ts
    - src/services/analysis.ts
    - drizzle/meta/_journal.json

key-decisions:
  - "word_senses uses composite unique on (word_id, part_of_speech) -- not on lemma+POS"
  - "Existing words migrated with POS 'unknown' to preserve data"
  - "familiarityEnum kept in words.ts but column moved to word_senses"

patterns-established:
  - "Two-step upsert: word first (lemma-level), then word_sense (POS-level)"
  - "Migration order: CREATE table, INSERT data, ADD column, UPDATE backfill, DROP old columns"

requirements-completed: [DATA-01, DATA-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 6 Plan 01: Word Senses Schema Summary

**word_senses table with composite unique on (word_id, part_of_speech), data migration from words, and two-step analysis upsert**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T04:54:29Z
- **Completed:** 2026-03-10T04:58:27Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created word_senses table enabling POS-aware vocabulary tracking
- Migrated existing word translations/familiarity into word_senses with POS 'unknown'
- Rewired srs_cards from word_id to word_sense_id with data backfill
- Updated analysis pipeline to two-step upsert (word then word_sense)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create word_senses schema and update existing schemas** - `7a2c64a` (feat)
2. **Task 2: Write migration SQL, run migration, update analysis pipeline** - `7230de9` (feat)

## Files Created/Modified
- `src/db/schema/word-senses.ts` - New table: word_senses with composite unique
- `src/db/schema/words.ts` - Removed translation and familiarity columns
- `src/db/schema/srs-cards.ts` - Replaced wordId with wordSenseId
- `src/db/schema/index.ts` - Added wordSenses export
- `src/db/relations.ts` - Added wordSensesRelations, updated words/srsCards relations
- `src/services/analysis.ts` - Two-step upsert: word then word_sense
- `drizzle/0003_word_senses.sql` - Custom migration with data backfill
- `drizzle/meta/0003_snapshot.json` - Drizzle schema snapshot
- `drizzle/meta/_journal.json` - Updated migration journal

## Decisions Made
- Used composite unique on (word_id, part_of_speech) rather than (lemma, part_of_speech) -- allows same lemma to exist once in words table while having multiple POS senses
- Kept familiarityEnum defined in words.ts since word-senses.ts imports it from there
- Existing words migrated with POS 'unknown' -- actual POS will be set on re-encounter through analysis

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Drizzle migrations table was empty despite schema being applied**
- **Found during:** Task 2 (running migration)
- **Issue:** drizzle.__drizzle_migrations had 0 rows but all previous migrations were already applied to the database, causing drizzle-kit migrate to attempt re-running all migrations
- **Fix:** Manually inserted migration records for 0000, 0001, 0002 into drizzle.__drizzle_migrations
- **Files modified:** None (database-only fix)
- **Verification:** drizzle-kit migrate ran successfully after fix
- **Committed in:** Part of 7230de9

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary to run migration. No scope creep.

## Issues Encountered
- drizzle-kit generate requires interactive input for column rename detection -- used `expect` to automate the prompt selection

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for POS-aware features
- Downstream consumers (routes/words.ts, routes/review.ts, routes/dashboard.ts, services/srs.ts, tests) have expected type errors -- to be fixed in plan 06-02
- normalizeLemma() adverb collapsing concern noted in STATE.md still applies

---
*Phase: 06-data-model-evolution*
*Completed: 2026-03-10*
