---
phase: 04-spaced-repetition-exercises
plan: 03
subsystem: bot
tags: [telegram, grammy, review, srs, inline-keyboard, session-state]

# Dependency graph
requires:
  - phase: 04-spaced-repetition-exercises
    provides: Review API routes (GET /review/due, POST /review/:cardId/rate), SRS service, exercise generator
  - phase: 03-telegram-bot-ux
    provides: Bot handlers pattern, api-client, keyboard builders, HTML formatting
provides:
  - /review command handler for Telegram bot
  - Review inline keyboard flow (reveal answer, rate card)
  - Session state management with vocabulary and grammar card display
  - API client methods for getDueCards and rateCard
affects: [05-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [review session state via Map keyed by chatId, card formatting for vocabulary/grammar types]

key-files:
  created:
    - src/bot/handlers/review.ts
    - src/bot/keyboards/review.ts
    - tests/bot-review.test.ts
  modified:
    - src/bot/services/api-client.ts
    - src/bot/index.ts

key-decisions:
  - "In-memory Map for review session state keyed by chatId (consistent with vocabulary handler pattern)"
  - "Exported formatCardFront/formatCardReveal/formatSessionSummary for testability"
  - "Review handlers registered before message:text catch-all to ensure /review command is captured"

patterns-established:
  - "Review session pattern: Map<chatId, ReviewSession> with cards array, currentIndex, revealed flag, and stats"
  - "Card formatting pattern: separate front/reveal functions for vocabulary and grammar card types"

requirements-completed: [SRS-07]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 04 Plan 03: Telegram Bot Review Command Summary

**Telegram /review command with inline keyboard flow for vocabulary and grammar SRS card review, session tracking, and ratings breakdown**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T14:26:38Z
- **Completed:** 2026-03-09T14:29:13Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 5

## Accomplishments
- /review command fetches due cards and presents them one-by-one with reveal/rate inline keyboard flow
- Vocabulary cards show word with CEFR level and original sentence context; grammar cards show cloze fill-in-the-blank
- Session state tracks progress with ratings breakdown (Again/Hard/Good/Easy) and summary on completion
- API client extended with getDueCards and rateCard methods
- 11 unit tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for review keyboards and handler** - `d0f2ea3` (test)
2. **Task 1 GREEN: Review keyboards, handler, and session flow** - `0d0d49b` (feat)

## Files Created/Modified
- `src/bot/keyboards/review.ts` - Inline keyboard builders: buildRevealKeyboard, buildRatingKeyboard, buildEndSessionKeyboard
- `src/bot/handlers/review.ts` - /review command, rv:/rt:/rs callbacks, session state, card formatting helpers
- `src/bot/services/api-client.ts` - Added getDueCards, rateCard, DueCard and RateResult interfaces
- `src/bot/index.ts` - Registered review handlers before text catch-all
- `tests/bot-review.test.ts` - 11 tests covering keyboards, callback data size, card formatting, session summary

## Decisions Made
- In-memory Map for review session state keyed by chatId, consistent with vocabulary handler pattern (single-instance bot)
- Exported pure formatting functions (formatCardFront, formatCardReveal, formatSessionSummary) for unit testability without mocking grammy Bot
- Review handlers registered before message:text handler in bot index to ensure /review command is captured

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete SRS review flow operational: /review -> show card -> reveal answer -> rate -> next card -> summary
- Phase 04 fully complete, ready for Phase 05 (analytics)

---
*Phase: 04-spaced-repetition-exercises*
*Completed: 2026-03-09*
