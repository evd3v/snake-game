---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 05-03-PLAN.md
last_updated: "2026-03-09T17:11:54.537Z"
last_activity: 2026-03-09 -- Plan 05-03 executed
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 13
  completed_plans: 13
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** User inputs a real sentence from a book and gets full analysis (translation, grammar, vocabulary, CEFR), with extracted items feeding into spaced repetition -- all in one flow.
**Current focus:** Phase 5: Web Application and Dashboard

## Current Position

Phase: 5 of 5 (Web Application and Dashboard)
Plan: 3 of 3 in current phase (05-03 complete)
Status: Complete
Last activity: 2026-03-09 -- Plan 05-03 executed

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 4min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 9min | 4.5min |
| 02 | 2 | 6min | 3min |

**Recent Trend:**
- Last 5 plans: 01-01 (4min), 01-02 (5min), 02-01 (3min), 02-02 (3min)
- Trend: improving

*Updated after each plan completion*
| Phase 02 P03 | 3min | 2 tasks | 3 files |
| Phase 03 P01 | 3min | 2 tasks | 8 files |
| Phase 03 P02 | 5min | 2 tasks | 5 files |
| Phase 04 P01 | 3min | 2 tasks | 10 files |
| Phase 04 P02 | 5min | 2 tasks | 11 files |
| Phase 04 P03 | 3min | 1 tasks | 5 files |
| Phase 05 P01 | 4min | 2 tasks | 12 files |
| Phase 05 P02 | 3min | 2 tasks | 6 files |
| Phase 05 P03 | 4min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Research: Use FSRS (ts-fsrs) instead of SM-2 for spaced repetition
- Research: Use grammY (not Telegraf) for Telegram bot
- Research: All AI calls go through BullMQ job queue, never in request path
- Research: Two-pass vocabulary extraction (deterministic lemmatizer + LLM for context-dependent units)
- 01-01: Used .ts import extensions with allowImportingTsExtensions for drizzle-kit CJS compatibility
- 01-01: Glob pattern in drizzle.config.ts schema path for reliable drizzle-kit discovery
- 01-01: word_family_id FK enforced via Drizzle relations, not inline reference
- 01-02: BullMQ URL-based connection config to avoid ioredis type mismatch with bundled version
- 01-02: Docker postgres port 5433 to avoid local PG conflict
- 01-02: NODE_OPTIONS='--import tsx' for vitest + @fastify/autoload .ts file compatibility
- 02-01: Adverb lemmatization strips -ly suffix before adjective lookup (wink-lemmatizer has no adverb function)
- 02-01: Custom .d.ts type declaration for wink-lemmatizer CJS package (no @types available)
- 02-02: Upsert words on lemma conflict updates thematicCluster (AI may refine on re-encounter)
- 02-02: Junction table inserts use onConflictDoNothing for idempotent re-submission
- [Phase 02]: Worker concurrency set to 2 to limit parallel AI API calls
- [Phase 02]: Fastify JSON schema validation for input (minLength: 1 on text field)
- 03-01: Bot fetches words via GET /sentences/:sentenceId/words after job completion (job result only has counts)
- 03-01: HTML parse_mode for Telegram messages (avoids MarkdownV2 escaping issues)
- 03-01: API client uses native fetch against API_URL env var
- 03-02: In-memory Map for selection state keyed by chatId:sentenceId (single-instance bot)
- 03-02: Callback data encoding: sel/done/fam prefixes with numeric IDs, all under 64 bytes
- 03-02: Stale callback detection returns friendly expiry message
- 04-01: ts-fsrs scheduler.next(card, now, rating) returns {card, log} directly when given specific rating
- 04-01: FSRS scheduler with request_retention=0.9 and enable_fuzz=true
- 04-01: onConflictDoNothing for idempotent SRS card creation
- 04-02: Check-then-insert for grammar SRS card idempotency (no unique constraint on grammarPatternId)
- 04-02: job-processor.ts extracted from worker for testable multi-job-type routing
- 04-02: fileParallelism disabled in vitest for DB test isolation
- [Phase 04]: In-memory Map for review session state keyed by chatId (consistent with vocabulary handler pattern)
- 05-01: Raw SQL for dashboard aggregations (FILTER, FULL OUTER JOIN) where Drizzle ORM builder would be unwieldy
- 05-01: Vite proxy rewrites /api prefix to forward to bare backend routes on localhost:3000
- 05-01: Removed vite-plugin-vue-devtools to keep build lean
- [Phase 05]: Custom SVG heatmap (52x7 grid) instead of vue3-calendar-heatmap (stale)
- [Phase 05]: CSS flexbox stacked bars for cluster coverage, no charting library
- [Phase 05]: CSS Grid 3fr/2fr layout with single-column breakpoint at 768px
- [Phase 05]: Direct reactive mutation for Vue array items to avoid TS type loss through proxy
- [Phase 05]: AbortController pattern for cancellable polling in Pinia store

### Pending Todos

None yet.

### Blockers/Concerns

- Grammar taxonomy (50-100 patterns for B1-C1) needs definition before Phase 2 prompt engineering
- ~~Deterministic lemmatizer choice for Node.js~~ RESOLVED: wink-lemmatizer selected and implemented in 02-01

## Session Continuity

Last session: 2026-03-09T17:08:03.474Z
Stopped at: Completed 05-03-PLAN.md
Resume file: None
