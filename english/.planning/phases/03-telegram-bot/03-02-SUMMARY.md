---
phase: 03-telegram-bot
plan: 02
subsystem: bot
tags: [grammy, inline-keyboard, callback-query, vocabulary, familiarity]

requires:
  - phase: 03-telegram-bot
    provides: grammY bot scaffolding, sentence handler, API client, word API routes
provides:
  - Inline keyboard word selection flow after analysis
  - Familiarity level setting per selected word
  - In-memory selection state management for callback queries
affects: [04-spaced-repetition (familiarity data feeds into SRS scheduling)]

tech-stack:
  added: []
  patterns: [callback query handlers with regex matching, in-memory state keyed by chatId:sentenceId, InlineKeyboard builder pattern]

key-files:
  created:
    - src/bot/keyboards/analysis.ts
    - src/bot/handlers/vocabulary.ts
    - tests/bot-vocabulary.test.ts
  modified:
    - src/bot/handlers/sentence.ts
    - src/bot/index.ts

key-decisions:
  - "In-memory Map for selection state keyed by chatId:sentenceId (sufficient for single-instance bot)"
  - "Callback data encoding: sel:{sId}:{wId}, done:{sId}, fam:{sId}:{wId}:{code} -- all under 64 bytes"
  - "Stale callback detection returns friendly expiry message instead of error"

patterns-established:
  - "Callback query handler pattern: bot.callbackQuery(regex, handler) with ctx.match for captures"
  - "Keyboard builder pattern: pure functions returning InlineKeyboard, no side effects"
  - "State cleanup on flow completion to prevent memory leaks"

requirements-completed: [VOCAB-02, VOCAB-03]

duration: 5min
completed: 2026-03-09
---

# Phase 3 Plan 2: Word Selection Keyboards and Familiarity Flow Summary

**Inline keyboard word selection with checkmark toggling and per-word familiarity level setting via callback queries**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T12:50:31Z
- **Completed:** 2026-03-09T12:55:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Keyboard builders for word selection (with checkmark toggle) and familiarity level setting (4 options)
- Full callback query handler chain: sel -> done -> fam -> completion message
- Sentence handler now attaches word selection keyboard to analysis result
- 8 unit tests covering keyboard structure, callback data format, and size constraints

## Task Commits

Each task was committed atomically:

1. **Task 1: Keyboard builders and vocabulary handlers (TDD RED)** - `1f8d752` (test)
2. **Task 1: Keyboard builders and vocabulary handlers (TDD GREEN)** - `ea7cebb` (feat)
3. **Task 2: Live bot verification** - auto-approved (checkpoint)

_Note: Task 1 used TDD with separate RED and GREEN commits_

## Files Created/Modified
- `src/bot/keyboards/analysis.ts` - buildWordSelectionKeyboard and buildFamiliarityKeyboard pure functions
- `src/bot/handlers/vocabulary.ts` - registerVocabularyHandlers with sel/done/fam callback handlers and initSelection state setup
- `src/bot/handlers/sentence.ts` - Wires word selection keyboard to analysis result message
- `src/bot/index.ts` - Registers vocabulary handlers before message handlers
- `tests/bot-vocabulary.test.ts` - 8 unit tests for keyboard builders and callback data

## Decisions Made
- In-memory Map for selection state keyed by chatId:sentenceId (sufficient for single-instance bot, no persistence needed)
- Callback data encoding uses compact format (sel/done/fam prefixes with numeric IDs) staying well under Telegram's 64-byte limit
- Stale callbacks handled gracefully with "This selection has expired" message

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed InlineKeyboard trailing empty row from .row() calls**
- **Found during:** Task 1 (TDD GREEN)
- **Issue:** Calling .row() after the last button in a chain creates an empty trailing row in inline_keyboard array
- **Fix:** Used .row() before items (except first) instead of after, removed trailing .row() on familiarity keyboard
- **Files modified:** src/bot/keyboards/analysis.ts
- **Verification:** All 8 tests pass with correct row counts
- **Committed in:** ea7cebb (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API behavior fix. No scope creep.

## Issues Encountered
- Pre-existing cross-test interference in words-api.test.ts (documented in 03-01-SUMMARY.md). Not caused by this plan's changes.

## User Setup Required

None - bot token already configured from Plan 01.

## Next Phase Readiness
- Complete Telegram bot interaction flow: sentence -> analysis -> word selection -> familiarity -> confirmation
- Familiarity data persisted via PATCH /words/:id/familiarity, ready for spaced repetition scheduling
- Phase 3 (Telegram Bot) fully complete

## Self-Check: PASSED

All created files verified. All commit hashes confirmed in git log.

---
*Phase: 03-telegram-bot*
*Completed: 2026-03-09*
