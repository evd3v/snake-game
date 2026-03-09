---
phase: 03-telegram-bot
plan: 01
subsystem: api, bot
tags: [grammy, telegram, fastify, drizzle, html-formatting]

requires:
  - phase: 02-ai-analysis
    provides: sentence analysis pipeline, storeAnalysisResults, word/sentence schemas
provides:
  - GET /sentences/:sentenceId/words API route
  - PATCH /words/:id/familiarity API route
  - grammY bot process with sentence analysis flow
  - API client for bot-to-server communication
  - HTML message formatter for Telegram
affects: [03-02-PLAN (inline keyboards, word selection)]

tech-stack:
  added: [grammy]
  patterns: [bot long polling, submit-poll-display flow, HTML parse_mode for Telegram]

key-files:
  created:
    - src/routes/words.ts
    - src/bot/index.ts
    - src/bot/services/api-client.ts
    - src/bot/format.ts
    - src/bot/handlers/sentence.ts
    - tests/words-api.test.ts
  modified:
    - package.json
    - .env.example

key-decisions:
  - "Bot fetches words via GET /sentences/:sentenceId/words after job completion (job result only has counts)"
  - "HTML parse_mode for Telegram messages (avoids MarkdownV2 escaping issues per research)"
  - "API client uses native fetch against API_URL env var"

patterns-established:
  - "Bot handler pattern: createXHandler() factory returning grammY message handler"
  - "Submit-poll-display: submit job, poll status every 2s (max 30), fetch details, format, edit message"
  - "Word API routes follow same plain export pattern as sentences.ts"

requirements-completed: [INFRA-04, SENT-02]

duration: 3min
completed: 2026-03-09
---

# Phase 3 Plan 1: Word API Routes and Bot Scaffolding Summary

**Word retrieval/familiarity API routes with grammY Telegram bot implementing submit-poll-display sentence analysis flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T12:44:19Z
- **Completed:** 2026-03-09T12:47:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Two new API routes: GET sentence words (with join), PATCH word familiarity (with schema validation)
- Full TDD cycle for word API (5 test cases covering happy paths and error codes)
- grammY bot scaffolding with complete sentence analysis flow (submit -> poll -> fetch words -> format -> reply)
- API client module with 4 methods for bot-to-server communication

## Task Commits

Each task was committed atomically:

1. **Task 1: Word API routes (TDD RED)** - `e200002` (test)
2. **Task 1: Word API routes (TDD GREEN)** - `ad63798` (feat)
3. **Task 2: grammY bot scaffolding** - `c27da33` (feat)

_Note: Task 1 used TDD with separate RED and GREEN commits_

## Files Created/Modified
- `src/routes/words.ts` - GET /sentences/:sentenceId/words and PATCH /words/:id/familiarity endpoints
- `tests/words-api.test.ts` - Integration tests for word API (5 test cases)
- `src/bot/index.ts` - Bot entry point with long polling and graceful shutdown
- `src/bot/services/api-client.ts` - HTTP client with submitSentence, getJobStatus, getSentenceWords, setFamiliarity
- `src/bot/format.ts` - HTML message formatter with escapeHtml and formatAnalysisResult
- `src/bot/handlers/sentence.ts` - Sentence handler with submit-poll-display flow
- `package.json` - Added grammy dependency and "bot" script
- `.env.example` - Added TELEGRAM_BOT_TOKEN and API_URL

## Decisions Made
- Bot fetches word details via GET /sentences/:sentenceId/words after job completion, since job result only returns counts (not full analysis data)
- HTML parse_mode for Telegram formatting, avoiding MarkdownV2 escaping nightmares (per research findings)
- API client uses native fetch() rather than adding axios/got dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Full test suite shows cross-test interference (analysis.test.ts word deduplication count off when run with other test files). Pre-existing issue, not caused by this plan's changes. Word API tests pass in isolation.

## User Setup Required

None - bot requires TELEGRAM_BOT_TOKEN but that is documented in .env.example for user to configure.

## Next Phase Readiness
- Word API routes ready for inline keyboard word selection (Plan 02)
- Bot handler ready for keyboard attachment after analysis display (Plan 02)
- API client already has setFamiliarity method for Plan 02 word saving flow

---
*Phase: 03-telegram-bot*
*Completed: 2026-03-09*
