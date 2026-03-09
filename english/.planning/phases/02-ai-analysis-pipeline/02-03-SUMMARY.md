---
phase: 02-ai-analysis-pipeline
plan: 03
subsystem: api, workers
tags: [fastify, bullmq, routes, integration-tests, vitest, api]

# Dependency graph
requires:
  - phase: 02-01
    provides: analyzeSentence function for AI analysis
  - phase: 02-02
    provides: storeAnalysisResults service for DB persistence
  - phase: 01-02
    provides: Fastify server with BullMQ queue plugin, autoload routes
provides:
  - POST /sentences endpoint for sentence submission with validation
  - GET /sentences/:jobId/status endpoint for job status polling
  - Updated BullMQ worker with real AI analysis + DB storage pipeline
  - 6 API integration tests covering validation, happy path, error cases
affects: [03-telegram-bot]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-job-submission-202, job-status-polling, fastify-schema-validation]

key-files:
  created:
    - src/routes/sentences.ts
    - tests/sentences-api.test.ts
  modified:
    - src/workers/index.ts

key-decisions:
  - "Worker concurrency set to 2 to limit parallel AI API calls"
  - "Fastify JSON schema validation for input (minLength: 1 on text field)"
  - "Job status returns raw BullMQ state names (waiting, active, completed, failed)"

patterns-established:
  - "Async job pattern: POST returns 202 with jobId, GET polls status until completed"
  - "Route plugin convention: NOT wrapped in fp() since routes are encapsulated by default"
  - "Worker pipeline: extract job data -> analyzeSentence -> storeAnalysisResults -> return result"

requirements-completed: [SENT-03, SENT-04, SENT-05, SENT-06, SENT-07, VOCAB-01, VOCAB-04, VOCAB-05, VOCAB-06, VOCAB-07]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 2 Plan 03: Sentence API Routes and Worker Pipeline Summary

**POST /sentences and GET /sentences/:jobId/status endpoints with Fastify schema validation, BullMQ worker wired to analyzeSentence + storeAnalysisResults pipeline, and 6 API integration tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T11:50:23Z
- **Completed:** 2026-03-09T11:53:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- POST /sentences endpoint accepting text and optional sourceBook, enqueuing BullMQ job, returning 202 with jobId
- GET /sentences/:jobId/status endpoint returning job state (waiting/active/completed/failed) with result or error
- Worker updated from placeholder to real pipeline: analyzeSentence -> storeAnalysisResults with concurrency: 2
- 6 API integration tests covering happy path, validation errors, status polling, and 404 for unknown jobs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sentence API routes and update worker** - `55adfa9` (feat)
2. **Task 2: API integration tests for sentence submission and status** - `4a5bfb2` (test)

## Files Created/Modified
- `src/routes/sentences.ts` - POST /sentences and GET /sentences/:jobId/status Fastify route plugin
- `src/workers/index.ts` - Updated worker with real analyzeSentence + storeAnalysisResults pipeline
- `tests/sentences-api.test.ts` - 6 API integration tests for submission and status endpoints

## Decisions Made
- Worker concurrency set to 2 to limit parallel AI API calls and avoid rate limiting
- Used Fastify JSON schema validation (minLength: 1) rather than manual checks for cleaner error responses
- Job status returns raw BullMQ state names directly, keeping the API simple and transparent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full sentence analysis pipeline is wired end-to-end: HTTP -> Queue -> AI -> DB
- API endpoints ready for Telegram bot integration (Phase 3)
- Worker can be started independently with `tsx src/workers/index.ts`

---
*Phase: 02-ai-analysis-pipeline*
*Completed: 2026-03-09*
