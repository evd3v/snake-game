---
phase: quick-3
plan: 01
subsystem: review, bot, ai
tags: [definitions, word-choice, notifications, vocabulary, grammar]
dependency_graph:
  requires: []
  provides: [word-definitions-on-cards, word-choice-exercises, daily-notifications]
  affects: [review-flow, ai-extraction, telegram-bot, web-review]
tech_stack:
  added: []
  patterns: [Intl.DateTimeFormat-for-timezone, dashboard-stats-api-reuse]
key_files:
  created: [drizzle/0005_breezy_wrecking_crew.sql]
  modified:
    - src/db/schema/word-senses.ts
    - src/lib/ai/schemas.ts
    - src/lib/ai/prompts.ts
    - src/lib/ai/cloze-prompts.ts
    - src/services/analysis.ts
    - src/routes/review.ts
    - src/bot/handlers/review.ts
    - src/bot/services/api-client.ts
    - src/bot/notifications/scheduler.ts
    - src/bot/notifications/review-check.ts
    - web/src/types/api.ts
    - web/src/components/review/ReviewCard.vue
    - tests/fixtures/analysis-result.ts
decisions:
  - Word definition stored on word_senses (per-POS), not on words table
  - Notification timezone configurable via NOTIFICATION_TIMEZONE env var, defaults to Europe/Moscow
  - Review-today check uses dashboard/activity endpoint (already available)
metrics:
  duration: 3min
  completed: 2026-03-11
---

# Quick Task 3: Improve Word Reviews with Definitions Summary

Three improvements to the review experience: definitions on vocabulary cards, word-choice grammar exercises, and daily notifications with progress stats.

## One-liner

Word definitions on review cards via AI extraction, grammar exercises refocused on word-choice with hint options, daily 21:00 notifications with known/learning progress report.

## What was built

### Task 1: Word definitions on review cards (a7e22f5)
- Added `definition` text column to `word_senses` schema
- AI extraction schema now includes `definition` field with prompt guidance
- Analysis service saves definition during word sense upsert
- Review API includes definition in vocabulary card response
- Telegram bot shows definition (italic, with book emoji) below translation on reveal
- Web ReviewCard shows definition in muted italic below translation

### Task 2: Word-choice grammar exercises (07becc5)
- Replaced grammar form-filling CLOZE_SYSTEM_PROMPT with word-choice exercise prompt
- Exercises now test which word fits a context rather than what grammatical form to use
- Hints provide 2-3 word options (one correct, others plausible but wrong)
- Difficulty levels redefined: common choices / subtle differences / register-collocation
- buildClozePrompt updated to match word-choice focus

### Task 3: Daily 21:00 notifications with progress (b9c3ab3)
- Scheduler replaced: hourly setInterval with 60-second tick checking for 21:00 in configured timezone
- Uses Intl.DateTimeFormat for timezone-aware time comparison
- Tracks lastNotificationDate to prevent duplicates
- Notification skipped entirely if user reviewed today (checks dashboard/activity endpoint)
- Message includes due card count and progress breakdown (known/learning per category)
- Removed 10-second startup delay notification

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a7e22f5 | Add word definitions to vocabulary review cards |
| 2 | 07becc5 | Rethink grammar exercises for word choice focus |
| 3 | b9c3ab3 | Daily 21:00 notifications with micro progress report |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test fixtures missing definition field**
- **Found during:** Task 1
- **Issue:** tests/fixtures/analysis-result.ts did not have `definition` field, causing TS errors
- **Fix:** Added definition strings to all mock vocabulary items
- **Files modified:** tests/fixtures/analysis-result.ts
- **Commit:** a7e22f5

## Self-Check: PASSED
