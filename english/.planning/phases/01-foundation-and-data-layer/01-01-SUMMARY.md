---
phase: 01-foundation-and-data-layer
plan: 01
subsystem: infra, database
tags: [docker, postgres, redis, drizzle-orm, typescript, fastify, bullmq]

# Dependency graph
requires: []
provides:
  - Docker Compose dev environment (PostgreSQL + Redis + app)
  - Drizzle ORM schema for all domain entities (9 tables, 4 enums)
  - Initial migration SQL for database setup
  - Project scaffolding with all production and dev dependencies
affects: [01-02, 02-01, 02-02]

# Tech tracking
tech-stack:
  added: [fastify, drizzle-orm, drizzle-kit, pg, bullmq, ioredis, dotenv, tsx, vitest, typescript]
  patterns: [identity-columns, pgEnum, barrel-exports, drizzle-relations, docker-healthchecks]

key-files:
  created:
    - package.json
    - tsconfig.json
    - docker-compose.yml
    - Dockerfile
    - .env.example
    - drizzle.config.ts
    - src/db/schema/sentences.ts
    - src/db/schema/words.ts
    - src/db/schema/collocations.ts
    - src/db/schema/grammar-patterns.ts
    - src/db/schema/word-families.ts
    - src/db/schema/srs-cards.ts
    - src/db/schema/index.ts
    - src/db/relations.ts
    - src/db/index.ts
  modified: []

key-decisions:
  - "Used .ts import extensions with allowImportingTsExtensions for drizzle-kit CJS compatibility"
  - "Used glob pattern in drizzle.config.ts schema path instead of barrel file for drizzle-kit"
  - "word_family_id FK on words table defined as plain integer column, relationship enforced via Drizzle relations"

patterns-established:
  - "Identity columns (generatedAlwaysAsIdentity) for all PKs -- PostgreSQL standard"
  - "Barrel export pattern for schema (schema/index.ts re-exports all tables and enums)"
  - "Junction tables with composite primary keys for M:N relationships"
  - "Drizzle relations defined separately from schema in relations.ts"

requirements-completed: [INFRA-01, INFRA-05]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 1 Plan 01: Project Scaffolding and Database Schema Summary

**Docker dev environment with PostgreSQL/Redis, plus complete Drizzle ORM schema covering 9 tables (6 domain + 3 junction) with 4 pgEnums and generated migration SQL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T11:07:38Z
- **Completed:** 2026-03-09T11:11:16Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Project scaffolding with ESM, all npm scripts, production and dev dependencies
- Docker Compose with PostgreSQL 16, Redis 7, and app service with healthchecks
- Complete Drizzle ORM schema: sentences, words, collocations, grammar_patterns, word_families, srs_cards plus 3 junction tables
- Drizzle relations defining all entity relationships
- Initial migration SQL generated successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffolding and Docker environment** - `9fcd2e8` (feat)
2. **Task 2: Database schema and Drizzle migration** - `36fde77` (feat)

## Files Created/Modified
- `package.json` - Project manifest with ESM, all deps and scripts
- `tsconfig.json` - TypeScript config (ES2022, strict, bundler resolution, allowImportingTsExtensions)
- `docker-compose.yml` - PostgreSQL + Redis + app services with healthchecks
- `Dockerfile` - Dev container (node:22-alpine, tsx watch)
- `.env.example` - DATABASE_URL and REDIS_URL defaults
- `.gitignore` - Excludes node_modules, dist, .env, migration SQL
- `drizzle.config.ts` - Drizzle Kit config with glob schema path
- `src/db/schema/sentences.ts` - Sentences table (id, text, translation, cefr_level, source_book)
- `src/db/schema/words.ts` - Words table + familiarity enum + sentence_words junction
- `src/db/schema/collocations.ts` - Collocations table + collocation_type enum + sentence_collocations junction
- `src/db/schema/grammar-patterns.ts` - Grammar patterns table + sentence_grammar_patterns junction
- `src/db/schema/word-families.ts` - Word families table
- `src/db/schema/srs-cards.ts` - SRS cards table + card_type/card_state enums (FSRS fields)
- `src/db/schema/index.ts` - Barrel export of all tables and enums
- `src/db/relations.ts` - Drizzle relations for all entities
- `src/db/index.ts` - createDb factory function and Database type

## Decisions Made
- Used `.ts` import extensions with `allowImportingTsExtensions` because drizzle-kit internally uses CJS require which cannot resolve `.js` extensions for `.ts` files. tsx handles `.ts` imports natively.
- Changed drizzle.config.ts schema from barrel file to glob pattern (`./src/db/schema/*.ts`) for more reliable drizzle-kit schema discovery.
- Removed `outDir`, `declaration`, `sourceMap` from tsconfig since `noEmit` is required for `allowImportingTsExtensions` and we use tsx for runtime (not tsc emit).
- Defined `word_family_id` as a plain integer column on words table without inline FK reference; relationship enforced via Drizzle relations in relations.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed drizzle-kit CJS module resolution for .js extensions**
- **Found during:** Task 2 (Drizzle migration generation)
- **Issue:** drizzle-kit uses CJS require internally and cannot resolve `.js` extensions to `.ts` files
- **Fix:** Changed all schema imports to use `.ts` extensions, added `allowImportingTsExtensions` and `noEmit` to tsconfig.json, changed drizzle.config.ts schema to glob pattern
- **Files modified:** All schema files, tsconfig.json, drizzle.config.ts
- **Verification:** `npx tsc --noEmit` passes, `drizzle-kit generate` succeeds with all 9 tables
- **Committed in:** 36fde77 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to make drizzle-kit work with TypeScript schema files. No scope creep.

## Issues Encountered
None beyond the drizzle-kit CJS resolution issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All schema tables defined and migration generated, ready for Plan 02 (Fastify server + BullMQ worker)
- Docker Compose ready to bring up dev environment
- Database connection factory (createDb) ready for Fastify plugin integration

---
*Phase: 01-foundation-and-data-layer*
*Completed: 2026-03-09*
