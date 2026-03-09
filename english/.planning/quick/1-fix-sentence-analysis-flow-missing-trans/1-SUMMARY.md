---
phase: quick-1
plan: 01
subsystem: bot, api
tags: [telegram, grammy, drizzle, html-formatting]

requires:
  - phase: 03-telegram-bot
    provides: "Sentence handler, API client, format utilities"
  - phase: 04-srs
    provides: "SRS cards table for known/new word detection"
provides:
  - "GET /sentences/:id/details endpoint (translation, collocations, grammar)"
  - "hasSrsCard boolean on word list endpoint"
  - "Full analysis message format in bot"
affects: []

tech-stack:
  added: []
  patterns: ["Parallel fetch pattern for sentence details + words"]

key-files:
  created: []
  modified:
    - src/routes/sentences.ts
    - src/routes/words.ts
    - src/bot/services/api-client.ts
    - src/bot/format.ts
    - src/bot/handlers/sentence.ts
    - tests/bot-vocabulary.test.ts

key-decisions:
  - "Promise.all for parallel fetching of words and sentence details"
  - "HTML parse_mode with escapeHtml for all user content"

patterns-established:
  - "Parallel API fetch pattern: Promise.all([getWords, getDetails])"

requirements-completed: [QUICK-1]

duration: 2min
completed: 2026-03-09
---

# Quick Task 1: Fix Sentence Analysis Flow Summary

**Full sentence analysis in one Telegram message: translation, vocabulary with known/new SRS markers, collocations with translations, grammar with descriptions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T18:28:54Z
- **Completed:** 2026-03-09T18:31:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- New GET /sentences/:id/details endpoint returns sentence translation, collocations (with translations, types, CEFR), and grammar patterns (with descriptions, CEFR)
- Word list endpoint now includes hasSrsCard boolean via SRS cards table lookup
- Bot message reformatted to show original sentence, translation, vocabulary with checkmark/NEW markers and counts, collocations section, and grammar section

## Task Commits

Each task was committed atomically:

1. **Task 1: Add API endpoints for sentence details and word SRS status** - `d369278` (feat)
2. **Task 2: Update API client types and format function, wire into sentence handler** - `28cb7e0` (feat)

## Files Created/Modified
- `src/routes/sentences.ts` - Added GET /sentences/:id/details endpoint with joins to collocations and grammar_patterns
- `src/routes/words.ts` - Added hasSrsCard boolean via srsCards table lookup with inArray query
- `src/bot/services/api-client.ts` - Added SentenceDetails, CollocationInfo, GrammarPatternInfo types and getSentenceDetails function
- `src/bot/format.ts` - Rewrote formatAnalysisResult to render full analysis with emoji markers
- `src/bot/handlers/sentence.ts` - Parallel fetch of words + details, updated formatAnalysisResult call
- `tests/bot-vocabulary.test.ts` - Added hasSrsCard field to test fixtures

## Decisions Made
- Used Promise.all to fetch words and sentence details in parallel (reduces latency)
- Used Unicode escape sequences for emoji in format.ts for clarity
- Kept sentenceText parameter separate from details.text to use raw user input in display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test fixtures for new hasSrsCard field**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** tests/bot-vocabulary.test.ts had WordInfo fixtures missing the new hasSrsCard field
- **Fix:** Added hasSrsCard: false/true to sample word fixtures
- **Files modified:** tests/bot-vocabulary.test.ts
- **Verification:** npx vitest run tests/bot-vocabulary.test.ts -- 8 tests pass
- **Committed in:** 28cb7e0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for type compatibility. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in src/services/srs.ts (ts-fsrs type mismatch) -- not related to this task, not fixed
- Pre-existing test failures in DB-dependent tests -- not related to this task, not fixed

## User Setup Required
None - no external service configuration required.

---
*Quick Task: 1-fix-sentence-analysis-flow-missing-trans*
*Completed: 2026-03-09*
