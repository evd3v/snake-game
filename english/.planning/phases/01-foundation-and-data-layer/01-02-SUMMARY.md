---
phase: 01-foundation-and-data-layer
plan: 02
subsystem: infra, api, queue
tags: [fastify, bullmq, ioredis, vitest, autoload, health-check]

# Dependency graph
requires:
  - phase: 01-01
    provides: Drizzle ORM schema, createDb factory, Docker Compose environment
provides:
  - Fastify server factory with autoload for plugins and routes
  - DB and queue plugins decorated on Fastify instance
  - Health check endpoint (GET /health)
  - BullMQ worker process for sentence-analysis queue
  - Integration test suite (health, db, queue)
  - Vitest configuration with tsx loader
affects: [02-01, 02-02, 03-01]

# Tech tracking
tech-stack:
  added: [@fastify/autoload, @fastify/cors, @fastify/sensible, vitest]
  patterns: [fastify-plugin-decorator, autoload-plugins-routes, bullmq-url-config, node-options-tsx-loader]

key-files:
  created:
    - src/server.ts
    - src/main.ts
    - src/lib/redis.ts
    - src/plugins/db.ts
    - src/plugins/queue.ts
    - src/routes/health.ts
    - src/workers/index.ts
    - vitest.config.ts
    - tests/helpers/setup.ts
    - tests/health.test.ts
    - tests/db.test.ts
    - tests/queue.test.ts
  modified:
    - package.json
    - docker-compose.yml
    - .env.example

key-decisions:
  - "Used BullMQ URL-based connection config (host/port) instead of shared IORedis instances to avoid ioredis version mismatch types"
  - "Docker postgres port mapped to 5433 to avoid conflict with local PostgreSQL on 5432"
  - "Added NODE_OPTIONS='--import tsx' to test script for @fastify/autoload .ts file compatibility in vitest"

patterns-established:
  - "Fastify plugin pattern: use fp() wrapper for plugins that decorate instance, plain export for routes"
  - "Autoload pattern: plugins dir for global decorators, routes dir for encapsulated routes"
  - "Test helper pattern: buildTestApp/cleanupTestApp for consistent Fastify test lifecycle"
  - "BullMQ connection pattern: parse URL to host/port config to avoid IORedis type conflicts"

requirements-completed: [INFRA-02, INFRA-06]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 1 Plan 02: Fastify Server, BullMQ Worker, and Integration Tests Summary

**Fastify server with autoload plugins (DB + queue), health endpoint, BullMQ worker process, and vitest integration tests covering health/db/queue**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T11:13:59Z
- **Completed:** 2026-03-09T11:18:45Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Fastify server factory with @fastify/autoload for plugins and routes directories
- DB plugin decorating Fastify with Drizzle instance, queue plugin with BullMQ sentence-analysis queue
- Health check endpoint returning status and timestamp at GET /health
- BullMQ worker process with placeholder processor ready for Phase 2 analysis logic
- Full integration test suite: health endpoint (200 + body), database schema verification + CRUD, BullMQ job enqueue/process cycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Fastify server, plugins, routes, and BullMQ worker** - `1ef50a8` (feat)
2. **Task 2: Vitest configuration and integration tests** - `3e09804` (feat)

## Files Created/Modified
- `src/server.ts` - Fastify server factory with autoload for plugins and routes
- `src/main.ts` - Application entry point (dotenv, listen on port 3000)
- `src/lib/redis.ts` - Redis URL helper and IORedis connection factory
- `src/plugins/db.ts` - Fastify plugin decorating instance with Drizzle DB
- `src/plugins/queue.ts` - Fastify plugin decorating instance with BullMQ queue
- `src/routes/health.ts` - GET /health returning status + timestamp
- `src/workers/index.ts` - BullMQ worker for sentence-analysis queue
- `vitest.config.ts` - Vitest config (node env, 10s timeout)
- `tests/helpers/setup.ts` - buildTestApp/cleanupTestApp helpers
- `tests/health.test.ts` - Health endpoint integration test
- `tests/db.test.ts` - Database schema and CRUD integration test
- `tests/queue.test.ts` - BullMQ job enqueue/process integration test
- `package.json` - Updated test script with NODE_OPTIONS for tsx
- `docker-compose.yml` - Changed postgres port to 5433
- `.env.example` - Updated DATABASE_URL port to 5433

## Decisions Made
- Used BullMQ URL-based connection config (parsing URL to host/port object) instead of passing IORedis instances, because bullmq bundles its own ioredis version causing type incompatibility with the top-level ioredis package.
- Mapped Docker postgres to port 5433 because local PostgreSQL was already occupying port 5432.
- Added `NODE_OPTIONS='--import tsx'` to the test script because `@fastify/autoload` uses native `import()` for `.ts` plugin files, which vitest's internal transform pipeline does not intercept.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed IORedis type mismatch between top-level ioredis and bullmq's bundled ioredis**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** BullMQ bundles its own ioredis, causing `Type 'Redis' is not assignable to type 'ConnectionOptions'` when passing IORedis instances
- **Fix:** Changed queue plugin and worker to parse Redis URL into host/port config object instead of passing IORedis instances
- **Files modified:** src/plugins/queue.ts, src/workers/index.ts, src/lib/redis.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 1ef50a8 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed Docker postgres port conflict with local PostgreSQL**
- **Found during:** Task 2 (running integration tests)
- **Issue:** Local PostgreSQL on port 5432 intercepted connections meant for Docker container, causing "role english does not exist"
- **Fix:** Changed Docker postgres port mapping to 5433:5432, updated .env.example
- **Files modified:** docker-compose.yml, .env.example
- **Verification:** `db:push` and all tests pass via port 5433
- **Committed in:** 3e09804 (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed vitest not resolving .ts files loaded by @fastify/autoload**
- **Found during:** Task 2 (health test failure)
- **Issue:** `@fastify/autoload` uses native `import()` for plugin files, bypassing vitest's transform -- `.ts` extension not recognized
- **Fix:** Added `NODE_OPTIONS='--import tsx'` to test script so tsx loader is registered at Node process level
- **Files modified:** package.json
- **Verification:** All 4 tests pass
- **Committed in:** 3e09804 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for correct compilation and test execution. No scope creep.

## Issues Encountered
- Stale Docker volume from previous postgres instance required `docker compose down -v` to recreate with correct user.

## User Setup Required
None - Docker Compose handles all infrastructure.

## Next Phase Readiness
- Fastify server, BullMQ worker, and full test suite ready for Phase 2
- Health endpoint available for monitoring
- Queue plugin ready to accept sentence-analysis jobs
- Test patterns established for future integration tests

---
*Phase: 01-foundation-and-data-layer*
*Completed: 2026-03-09*
