---
phase: 05-web-application-and-dashboard
plan: 01
subsystem: infra, api
tags: [vue, vite, pinia, vue-router, fastify, drizzle, dashboard, srs]

requires:
  - phase: 04-spaced-repetition-exercises
    provides: SRS cards, review logs, grammar exercises schema and services
provides:
  - Vue 3 SPA project in web/ with Vite, Router, Pinia
  - API client module with typed fetch wrapper (apiGet, apiPost)
  - Shared TypeScript types for dashboard responses
  - Four dashboard API endpoints (stats, weak-spots, activity, clusters)
affects: [05-02, 05-03]

tech-stack:
  added: [vue@3, vite@7, pinia@3, vue-router@5, vue-tsc]
  patterns: [Vite API proxy to backend, raw SQL for complex aggregations in Fastify routes]

key-files:
  created:
    - web/package.json
    - web/vite.config.ts
    - web/src/api/client.ts
    - web/src/types/api.ts
    - web/src/router/index.ts
    - web/src/App.vue
    - web/src/views/DashboardView.vue
    - web/src/views/SentenceInputView.vue
    - web/src/views/VocabularyView.vue
    - src/routes/dashboard.ts
    - tests/dashboard-api.test.ts
  modified: []

key-decisions:
  - "Raw SQL for dashboard aggregations (FILTER, FULL OUTER JOIN) where Drizzle ORM builder would be unwieldy"
  - "Vite proxy rewrites /api prefix to forward to bare backend routes on localhost:3000"
  - "Removed vite-plugin-vue-devtools to keep build lean"

patterns-established:
  - "Dashboard route pattern: raw SQL queries for complex aggregations, Fastify plugin export"
  - "Vue SPA structure: lazy-loaded routes, typed API client, shared types in types/api.ts"

requirements-completed: [INFRA-03, DASH-01, DASH-02, DASH-03, DASH-04]

duration: 4min
completed: 2026-03-09
---

# Phase 5 Plan 01: Vue SPA Scaffold and Dashboard API Summary

**Vue 3 SPA with Vite proxy and four dashboard API endpoints (stats, weak-spots, activity, clusters) with 9 tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T16:57:13Z
- **Completed:** 2026-03-09T17:01:10Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Vue 3 SPA scaffolded in web/ with TypeScript, vue-router (3 lazy routes), and Pinia
- API client with Vite proxy forwarding /api to localhost:3000 backend
- Shared TypeScript types for all dashboard response shapes
- Four dashboard endpoints: stats (SRS state counts), weak-spots (fail rate ranking), activity (daily review/sentence counts), clusters (thematic grouping with SRS breakdown)
- 9 new tests covering all endpoints with populated and empty state scenarios
- Full test suite passes (90 tests, 0 regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Vue 3 SPA and create API client with shared types** - `ec451d4` (feat)
2. **Task 2 RED: Add failing tests for dashboard API endpoints** - `092f922` (test)
3. **Task 2 GREEN: Implement dashboard API endpoints** - `255a6d7` (feat)

## Files Created/Modified
- `web/package.json` - Vue 3 SPA project configuration
- `web/vite.config.ts` - Vite config with API proxy to localhost:3000
- `web/src/api/client.ts` - Typed fetch wrapper (apiGet, apiPost)
- `web/src/types/api.ts` - Shared TypeScript types (ProgressStats, WeakSpot, DayActivity, ClusterStats)
- `web/src/router/index.ts` - Three lazy-loaded routes (Dashboard, Sentences, Vocabulary)
- `web/src/App.vue` - Root component with nav and router-view
- `web/src/views/DashboardView.vue` - Placeholder dashboard view
- `web/src/views/SentenceInputView.vue` - Placeholder sentence input view
- `web/src/views/VocabularyView.vue` - Placeholder vocabulary view
- `src/routes/dashboard.ts` - Four dashboard API endpoints (Fastify plugin)
- `tests/dashboard-api.test.ts` - 9 tests for all dashboard endpoints

## Decisions Made
- Used raw SQL (with Drizzle sql template) for dashboard aggregations involving FILTER, FULL OUTER JOIN, and HAVING -- Drizzle ORM query builder does not support these cleanly
- Vite proxy rewrites /api prefix so frontend calls /api/dashboard/stats which maps to backend /dashboard/stats
- Removed vite-plugin-vue-devtools from scaffolded project to keep build lean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Vue SPA builds successfully, ready for dashboard UI components (Plan 02)
- All four dashboard API endpoints are tested and autoloaded, ready for frontend consumption
- Shared types can be imported by Vue components for type-safe API calls

---
*Phase: 05-web-application-and-dashboard*
*Completed: 2026-03-09*
