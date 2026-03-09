# Phase 1: Foundation and Data Layer - Research

**Researched:** 2026-03-09
**Domain:** Node.js/TypeScript backend infrastructure (PostgreSQL, Fastify, BullMQ, Docker)
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield infrastructure setup: TypeScript monorepo with Fastify API server, PostgreSQL via Drizzle ORM, BullMQ job queue backed by Redis, all orchestrated by Docker Compose. No business logic -- only the skeleton that Phase 2+ builds upon.

The stack is well-established and heavily documented. Drizzle ORM (stable 0.45.x) provides type-safe schema definitions with zero-dep overhead. Fastify v5 is the current major release with first-class TypeScript support. BullMQ v5 is the standard Redis-backed queue for Node.js. All three have mature Docker integration patterns.

**Primary recommendation:** Use `drizzle-orm` 0.45.x (stable) with `pg` driver, `fastify` 5.x with `@fastify/autoload` for route organization, `bullmq` 5.x with `ioredis`, and `vitest` for testing. Structure as a single-package monolith with clear folder separation (not a multi-package monorepo -- unnecessary for a personal tool).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- user delegated all implementation decisions to best practices.

### Claude's Discretion
User delegated all implementation decisions to best practices. Claude has full flexibility on:
- Project structure (monorepo vs separate packages, folder organization)
- Data model (table relationships, grammar pattern storage, index strategy)
- API contract (response format, error format, endpoint naming, validation)
- Docker and environment (dev vs prod configs, hot reload, env vars, health checks)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | PostgreSQL database with Drizzle ORM | Drizzle 0.45.x + pg driver; schema tables for sentences, words, collocations, grammar_patterns, word_families, srs_cards; migrations via drizzle-kit |
| INFRA-02 | Fastify REST API backend (TypeScript) | Fastify 5.x with TypeScript; @fastify/autoload for routes; health-check endpoint |
| INFRA-05 | Docker Compose deployment configuration | postgres:16-alpine + redis:7-alpine + app service; volume mounts for hot reload; health checks |
| INFRA-06 | Async AI processing (queue-based, non-blocking) | BullMQ 5.x + ioredis; Queue + Worker pattern; Redis connection with maxRetriesPerRequest: null |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.7 | HTTP server framework | Fastest Node.js framework, first-class TS, plugin architecture |
| drizzle-orm | ^0.45 | Type-safe SQL ORM | Zero deps, 7.4kb, types inferred from schema, no codegen |
| drizzle-kit | ^0.30 | Schema migrations CLI | Official companion for generate/push/migrate commands |
| pg | ^8.13 | PostgreSQL driver | Stable node-postgres driver, recommended by Drizzle docs |
| bullmq | ^5.70 | Job queue | Standard Redis-backed queue for Node.js, written in TS |
| ioredis | ^5.4 | Redis client | Required by BullMQ, full Redis feature support |
| dotenv | ^16.4 | Env var loading | Standard .env file loading |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/autoload | ^6.3 | Auto-register routes/plugins | Always -- keeps route registration clean |
| @fastify/sensible | ^6.0 | HTTP error helpers | Always -- adds httpErrors, to, assert utilities |
| @fastify/cors | ^5.0 | CORS headers | Always -- needed for web frontend in Phase 5 |
| vitest | ^3.0 | Test framework | All testing -- fast, ESM-native, TS-native |
| tsx | ^4.19 | TS execution runtime | Dev mode execution, scripts |
| typescript | ^5.7 | Type checking | Compile-time safety |
| @types/pg | ^8.11 | PG type definitions | TypeScript support for pg driver |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg (node-postgres) | postgres (postgres.js) | postgres.js is faster but pg is more battle-tested and has broader ecosystem support; Drizzle supports both |
| vitest | node:test (built-in) | node:test has no deps but vitest has better DX, watch mode, coverage integration |
| @fastify/autoload | manual register | Manual is fine for <5 routes but autoload scales better |

**Installation:**
```bash
# Production dependencies
npm install fastify @fastify/autoload @fastify/sensible @fastify/cors drizzle-orm pg bullmq ioredis dotenv

# Development dependencies
npm install -D typescript @types/node @types/pg drizzle-kit tsx vitest
```

## Architecture Patterns

### Recommended Project Structure
```
english/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── drizzle/                  # Generated migration SQL files
├── src/
│   ├── server.ts             # Fastify instance creation + plugin registration
│   ├── main.ts               # Entry point: starts server
│   ├── db/
│   │   ├── index.ts          # Database connection (drizzle instance)
│   │   ├── schema/
│   │   │   ├── index.ts      # Re-exports all schema tables
│   │   │   ├── sentences.ts
│   │   │   ├── words.ts
│   │   │   ├── collocations.ts
│   │   │   ├── grammar-patterns.ts
│   │   │   ├── word-families.ts
│   │   │   └── srs-cards.ts
│   │   └── relations.ts      # Drizzle relations definitions
│   ├── routes/
│   │   └── health.ts         # GET /health endpoint
│   ├── plugins/
│   │   ├── db.ts             # Fastify plugin: decorates with db instance
│   │   └── queue.ts          # Fastify plugin: decorates with BullMQ queue
│   ├── workers/
│   │   └── index.ts          # BullMQ worker process entry
│   └── lib/
│       └── redis.ts          # Shared Redis/IORedis connection config
└── tests/
    ├── health.test.ts
    ├── db.test.ts
    ├── queue.test.ts
    └── helpers/
        └── setup.ts          # Test utilities (app builder, cleanup)
```

### Pattern 1: Fastify Server Factory
**What:** Export a function that builds and returns a configured Fastify instance.
**When to use:** Always -- enables testing via inject() without starting HTTP listener.
**Example:**
```typescript
// src/server.ts
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import path from 'node:path';

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(sensible);
  await app.register(cors);

  // Auto-load plugins (db, queue)
  await app.register(autoload, {
    dir: path.join(import.meta.dirname, 'plugins'),
  });

  // Auto-load routes
  await app.register(autoload, {
    dir: path.join(import.meta.dirname, 'routes'),
  });

  return app;
}
```

### Pattern 2: Drizzle Database Plugin
**What:** Fastify plugin that creates db connection and decorates the Fastify instance.
**When to use:** For accessing the database from route handlers.
**Example:**
```typescript
// src/plugins/db.ts
import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/index.js';

export default fp(async (fastify) => {
  const db = drizzle(process.env.DATABASE_URL!, { schema });
  fastify.decorate('db', db);
});
```

### Pattern 3: BullMQ Queue + Separate Worker
**What:** Queue instance registered as Fastify plugin; Worker runs as separate process.
**When to use:** Always -- workers should be independent processes for reliability.
**Example:**
```typescript
// src/plugins/queue.ts
import fp from 'fastify-plugin';
import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

export default fp(async (fastify) => {
  const analysisQueue = new Queue('sentence-analysis', {
    connection: redisConnection,
  });
  fastify.decorate('analysisQueue', analysisQueue);
  fastify.addHook('onClose', () => analysisQueue.close());
});

// src/lib/redis.ts
import IORedis from 'ioredis';

export const redisConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Required for BullMQ
});

// src/workers/index.ts
import { Worker } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

const worker = new Worker('sentence-analysis', async (job) => {
  console.log(`Processing job ${job.id}:`, job.data);
  // Phase 2+ will add actual AI processing here
  return { status: 'completed' };
}, { connection: redisConnection });

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err));
```

### Pattern 4: Drizzle Schema with Identity Columns
**What:** Use identity columns (PostgreSQL standard) instead of serial.
**When to use:** All new tables -- identity columns are the modern PostgreSQL standard.
**Example:**
```typescript
// src/db/schema/sentences.ts
import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const sentences = pgTable('sentences', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  text: text().notNull(),
  translation: text(),
  cefrLevel: text('cefr_level'),
  sourceBook: text('source_book'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Anti-Patterns to Avoid
- **Fat route handlers:** Keep handlers thin; extract logic to service functions (Phase 2+).
- **Shared Redis instance between Queue and Worker:** Queue and Worker should use separate IORedis connections. BullMQ docs explicitly recommend this.
- **Using `serial` for primary keys:** PostgreSQL identity columns (`generatedAlwaysAsIdentity()`) are the modern standard. Serial is legacy.
- **Importing the Fastify app in workers:** Workers are separate processes. They share the Redis connection config, not the Fastify instance.
- **Skipping `fastify-plugin` (fp) wrapper:** Without fp, plugins create encapsulated contexts. Use fp() for plugins that should decorate the root instance (db, queue).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL migrations | Manual SQL files | `drizzle-kit generate` + `drizzle-kit migrate` | Tracks schema changes, generates migration SQL, handles ordering |
| HTTP error responses | Custom error objects | `@fastify/sensible` (httpErrors) | Standardized error format, proper status codes, serialization |
| Route loading | Manual `app.register()` per file | `@fastify/autoload` | Convention-based, scales with route count, handles prefixes |
| Job queue | Redis pub/sub + custom logic | BullMQ | Retries, backoff, concurrency, rate limiting, event system |
| Request validation | Manual checks | Fastify built-in JSON Schema or Typebox | Compiled validators, auto-generated docs, type inference |
| Process graceful shutdown | Signal handlers | Fastify `app.close()` + BullMQ `worker.close()` | Handles in-flight requests/jobs, cleanup hooks |

**Key insight:** Infrastructure code is deceptively complex. Every "simple" queue or migration system eventually needs retry logic, concurrency control, or rollback -- use libraries that already handle these.

## Common Pitfalls

### Pitfall 1: BullMQ maxRetriesPerRequest
**What goes wrong:** BullMQ hangs or throws errors on Redis commands.
**Why it happens:** ioredis default `maxRetriesPerRequest` is 20, which conflicts with BullMQ's blocking Redis commands (BRPOPLPUSH).
**How to avoid:** Always set `maxRetriesPerRequest: null` on the IORedis connection used with BullMQ.
**Warning signs:** Worker connects but never processes jobs; "Max retries" errors in logs.

### Pitfall 2: Drizzle Schema Not Exported
**What goes wrong:** `drizzle-kit generate` produces empty migrations or misses tables.
**Why it happens:** drizzle.config.ts `schema` path doesn't include all schema files, or schema files don't export their tables.
**How to avoid:** Use a barrel file (`schema/index.ts`) that re-exports all tables. Point drizzle.config.ts to this barrel or use glob `./src/db/schema/*.ts`.
**Warning signs:** Migration files are empty or missing expected tables.

### Pitfall 3: Docker Compose Service Ordering
**What goes wrong:** App starts before PostgreSQL/Redis are ready, crashes on connection.
**Why it happens:** `depends_on` only waits for container start, not service readiness.
**How to avoid:** Use `depends_on` with `condition: service_healthy` and define healthchecks for postgres and redis.
**Warning signs:** Intermittent startup failures, "connection refused" errors.

### Pitfall 4: ESM vs CJS Module Resolution
**What goes wrong:** Import errors, `__dirname` not defined, `.js` extension issues.
**Why it happens:** Mixing ESM and CJS patterns; Node.js ESM requires file extensions in imports.
**How to avoid:** Set `"type": "module"` in package.json. Use `import.meta.dirname` instead of `__dirname`. Use `.js` extensions in imports (even for .ts files) or configure tsx/tsconfig paths.
**Warning signs:** "Cannot find module" errors, "require is not defined" errors.

### Pitfall 5: Fastify Plugin Encapsulation
**What goes wrong:** Database decorator not available in route handlers.
**Why it happens:** Plugins without `fastify-plugin` (fp) wrapper are encapsulated -- their decorators are not visible to sibling plugins.
**How to avoid:** Wrap shared plugins (db, queue) with `fp()` from `fastify-plugin`. Route plugins should NOT use fp (they should be encapsulated).
**Warning signs:** "decorator is not defined" errors at runtime.

## Code Examples

### Database Connection Setup
```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

export function createDb(databaseUrl: string) {
  return drizzle(databaseUrl, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

### Health Check Route
```typescript
// src/routes/health.ts
import type { FastifyPluginAsync } from 'fastify';

const health: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
};

export default health;
```

### Docker Compose Configuration
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: english
      POSTGRES_PASSWORD: english
      POSTGRES_DB: english
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U english"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://english:english@postgres:5432/english
      REDIS_URL: redis://redis:6379
    volumes:
      - ./src:/app/src
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pgdata:
```

### Dockerfile (Development)
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npx", "tsx", "watch", "src/main.ts"]
```

### Drizzle Config
```typescript
// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Example Schema: Words Table
```typescript
// src/db/schema/words.ts
import { pgTable, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sentences } from './sentences.js';

export const familiarityEnum = pgEnum('familiarity', [
  'never_seen',
  'seen_unsure',
  'understand_in_context',
]);

export const words = pgTable('words', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  lemma: text().notNull().unique(),
  translation: text(),
  cefrLevel: text('cefr_level'),
  familiarity: familiarityEnum().default('never_seen'),
  thematicCluster: text('thematic_cluster'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `serial` PK columns | `integer().generatedAlwaysAsIdentity()` | PostgreSQL 10+ / Drizzle convention | Identity columns are SQL standard, serial is PG-specific legacy |
| Fastify v4 | Fastify v5 | Oct 2024 | Dropped deprecated APIs, requires Node.js 20+ |
| `__dirname` (CJS) | `import.meta.dirname` (ESM) | Node.js 21.2+ | ESM is now default for new TS projects |
| Bull (v3/v4) | BullMQ (v5) | 2023+ | Complete rewrite, better TS support, sandboxed processors |
| Drizzle relations v1 | Relations v2 (defineRelations) | v1.0.0-beta.1 | Not yet stable; use v1 relations API with stable 0.45.x |
| nodemon + ts-node | tsx watch | 2024+ | tsx is faster startup, better ESM support |

**Deprecated/outdated:**
- `Bull` (not BullMQ): Legacy package, not maintained. Use BullMQ.
- `ts-node`: Slower than tsx for development. tsx is the current standard.
- Drizzle `relations()` helper: Still works in 0.45.x but will be replaced by `defineRelations()` in v1. Use the current stable `relations()` for now.

## Open Questions

1. **Drizzle stable vs beta for relations**
   - What we know: Stable 0.45.x uses `relations()` helper; beta 1.0.0-beta.x introduces `defineRelations()`.
   - What's unclear: When v1 stable ships. Beta has been iterating rapidly (beta.16 as of March 2026).
   - Recommendation: Use stable 0.45.x with `relations()`. Migration to v1 is straightforward when it ships.

2. **SRS card schema design**
   - What we know: FSRS algorithm (ts-fsrs) needs specific fields: difficulty, stability, due date, reps, lapses, state, last_review.
   - What's unclear: Exact ts-fsrs field requirements (Phase 4 concern but schema must accommodate).
   - Recommendation: Create srs_cards table with FSRS-standard fields as JSONB `scheduling_data` column for flexibility. Can normalize later.

3. **Worker process management in Docker**
   - What we know: Workers should be separate processes from the API server.
   - What's unclear: Whether to use a separate Docker service or run worker alongside API.
   - Recommendation: Single Docker service for dev (run worker via npm script). Can split for production later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0 |
| Config file | vitest.config.ts (Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | PostgreSQL schema created via Drizzle migrations | integration | `npx vitest run tests/db.test.ts` | No -- Wave 0 |
| INFRA-02 | Fastify server responds to health-check | integration | `npx vitest run tests/health.test.ts` | No -- Wave 0 |
| INFRA-05 | Docker Compose brings up full environment | smoke/manual | `docker compose up -d && curl http://localhost:3000/health` | Manual only -- Docker test requires running containers |
| INFRA-06 | BullMQ worker connects and processes test job | integration | `npx vitest run tests/queue.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- framework configuration
- [ ] `tests/helpers/setup.ts` -- shared test utilities (app builder, db cleanup)
- [ ] `tests/health.test.ts` -- covers INFRA-02
- [ ] `tests/db.test.ts` -- covers INFRA-01 (schema existence, migration check)
- [ ] `tests/queue.test.ts` -- covers INFRA-06 (job enqueue + process)
- [ ] Framework install: `npm install -D vitest`

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM official docs](https://orm.drizzle.team/docs/get-started/postgresql-new) -- setup, schema, migrations, column types
- [Drizzle ORM relations v2](https://orm.drizzle.team/docs/relations-v2) -- new relations API (beta only)
- [Drizzle ORM column types](https://orm.drizzle.team/docs/column-types/pg) -- pgEnum, jsonb, arrays
- [Fastify official docs](https://fastify.dev/docs/latest/Reference/TypeScript/) -- TypeScript integration
- [Fastify testing guide](https://fastify.dev/docs/v5.3.x/Guides/Testing/) -- inject() pattern
- [BullMQ quick start](https://docs.bullmq.io/readme-1) -- Queue, Worker setup
- [npm: drizzle-orm](https://www.npmjs.com/package/drizzle-orm) -- version 0.45.1 (stable)
- [npm: fastify](https://www.npmjs.com/package/fastify) -- version 5.7.4
- [npm: bullmq](https://www.npmjs.com/package/bullmq) -- version 5.70.x

### Secondary (MEDIUM confidence)
- [Fastify autoload README](https://github.com/fastify/fastify-autoload) -- directory structure patterns
- [Docker Compose Node.js/PG/Redis patterns](https://dev.to/chandrapantachhetri/docker-postgres-node-typescript-setup-47db) -- service configuration
- [Vitest Fastify testing example](https://github.com/vitest-dev/vitest/blob/main/examples/fastify/test/app.test.ts) -- test setup pattern

### Tertiary (LOW confidence)
- [Drizzle ORM v1 beta status](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2) -- beta.16 latest, stable timeline unclear

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are well-established, versions verified on npm
- Architecture: HIGH -- patterns taken from official docs and standard community practices
- Pitfalls: HIGH -- documented in official docs (BullMQ maxRetries, Fastify plugin encapsulation)
- Data model: MEDIUM -- domain-specific schema design informed by requirements but exact FSRS fields deferred to Phase 4

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable libraries, 30-day window)
