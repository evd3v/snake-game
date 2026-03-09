# Technology Stack

**Project:** English Learning App (AI-powered, spaced repetition)
**Researched:** 2026-03-09
**Overall confidence:** HIGH

## Recommended Stack

### Backend Runtime & Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 22 LTS | Runtime | Single language across entire stack (frontend + backend + bot). For this project you are calling AI APIs over HTTP, not training models -- Python's ML ecosystem is irrelevant. Node.js gives better TypeScript integration, shared types between frontend/backend, and simpler Docker setup. | HIGH |
| Fastify | 5.x | HTTP framework | 2x faster than Express in benchmarks. Built-in JSON schema validation, native TypeScript support, plugin architecture. Express is legacy at this point for new projects. | HIGH |
| TypeScript | 5.x | Language | Shared types for API contracts between frontend and backend. Catches bugs at compile time. Non-negotiable for any serious project in 2026. | HIGH |

**Why Node.js over Python:** This app calls AI APIs over HTTP and serves a REST API -- both I/O-bound tasks where Node.js excels. Python would only make sense if you were training models or doing NLP locally. You are not. Keeping the entire stack in TypeScript means shared types for API request/response schemas, one `tsconfig`, one linter config, one mental model.

### Frontend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vue 3 | 3.5+ | UI framework | Specified in constraints. Excellent Composition API, great TypeScript support. Vue 3.5 "Tengen Toppa" is stable. | HIGH |
| Vite | 6.x | Build tool | Official Vue tooling. Fast HMR, native ESM. Vite 6 is stable; Vite 7 is out but 6 is the safer bet for production. | HIGH |
| Pinia | 3.x | State management | Official Vue state library. Replaced Vuex entirely. Simple API, full TypeScript support, Composition API native. No alternatives worth considering. | HIGH |
| Vue Router | 4.x | Routing | Official router. Supports data loading API, view transitions, lazy loading. | HIGH |
| Naive UI | 2.x | UI components | 80+ components, TypeScript-first, no CSS imports needed, built-in dark mode. Good fit for dashboards with data tables, charts, cards. Better TypeScript support than Element Plus. Lighter than Vuetify. | MEDIUM |
| vue-chartjs | 5.x | Charts | Wrapper around Chart.js 4 for Vue 3. Sufficient for progress dashboards, heatmaps, bar/line charts. No need for D3.js complexity. | MEDIUM |

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 16 | Primary database | Specified in constraints. Excellent for relational data (words, sentences, review schedules, relationships). JSONB for flexible AI response storage. Full-text search for dictionary lookups. | HIGH |
| Drizzle ORM | 0.45.x | ORM / query builder | TypeScript-first, SQL-like syntax (not abstracted away), excellent PostgreSQL support, built-in migrations via drizzle-kit. Lighter and more predictable than Prisma. No query engine binary. Schema = TypeScript code. | HIGH |
| node-postgres (pg) | 8.x | PostgreSQL driver | Battle-tested driver. Drizzle uses it under the hood. | HIGH |

**Why Drizzle over Prisma:** Prisma has a separate query engine (Rust binary), generates a heavy client, and its schema language (`.prisma`) is a separate DSL. Drizzle schemas are plain TypeScript, queries look like SQL, migrations are generated from code. For a single-developer project, Drizzle's simplicity wins. No build step for the client.

**Why not an ORM like TypeORM/Sequelize:** Legacy patterns (decorators, class-based). Drizzle is the modern standard for TypeScript + PostgreSQL.

### AI Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @anthropic-ai/sdk | latest | Claude API client | Official TypeScript SDK. Streaming, retries, error handling built in. Claude excels at structured language analysis (grammar parsing, CEFR assessment, collocation extraction). | HIGH |
| Structured outputs (tool_use) | - | Reliable JSON from AI | Use Claude's tool_use / structured output to get typed JSON responses for sentence analysis. No regex parsing of free text. | HIGH |

**Why Claude over OpenAI for this project:** Both work. Claude tends to produce more nuanced linguistic analysis and follows complex structured output instructions more reliably. However, the architecture should be provider-agnostic (see Architecture notes below).

**Provider abstraction strategy:** Define an `AIService` interface with methods like `analyzeSentence()`, `generateExercises()`, `classifyCEFR()`. Implement `ClaudeAIService` first. If you ever want to swap to OpenAI, implement `OpenAIAIService`. Keep the interface narrow.

### Telegram Bot

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| grammY | 1.41.x | Telegram bot framework | TypeScript-first, excellent plugin ecosystem, supports conversations (multi-step dialogs), middleware pattern. The standard choice for Node.js Telegram bots in 2025-2026. Actively maintained. | HIGH |

**Why grammY over Telegraf:** Telegraf was the old standard but development slowed. grammY was built by a former Telegraf contributor with better TypeScript support, better docs, and active maintenance. 352 dependent packages on npm vs Telegraf's stagnating ecosystem.

### Spaced Repetition

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom SM-2 implementation | - | Spaced repetition scheduling | SM-2 is ~50 lines of code. Implement it yourself rather than pulling in a dependency. You need custom behavior anyway (different card types: vocabulary flashcards vs grammar fill-in-the-blank have different grading). The `supermemo` npm package exists but is unmaintained and inflexible. | HIGH |

**SM-2 core formula (for reference):**
```typescript
interface ReviewCard {
  interval: number;      // days until next review
  repetition: number;    // consecutive correct answers
  easeFactor: number;    // starts at 2.5
  nextReviewDate: Date;
}

function schedule(card: ReviewCard, grade: number): ReviewCard {
  // grade: 0-5 (0-2 = fail, 3-5 = pass)
  let { interval, repetition, easeFactor } = card;

  if (grade < 3) {
    repetition = 0;
    interval = 1;
  } else {
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetition++;
  }

  easeFactor = Math.max(1.3,
    easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  );

  return {
    interval,
    repetition,
    easeFactor,
    nextReviewDate: addDays(new Date(), interval),
  };
}
```

### Infrastructure & DevOps

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Docker | latest | Containerization | Specified in constraints. Consistent dev/prod environments. | HIGH |
| Docker Compose | v2 | Multi-container orchestration | Single `docker-compose.yml` for app + PostgreSQL + bot. Simple, no K8s needed for single-user app. | HIGH |
| Nginx | latest | Reverse proxy | Serve Vue SPA, proxy API requests to Fastify, TLS termination. Lightweight. | HIGH |
| GitHub Actions | - | CI (optional) | Lint + type-check on push. Free for personal repos. | LOW |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Runtime validation | Validate API request bodies, AI response parsing, environment variables. Works with Drizzle schemas. |
| date-fns | 3.x | Date manipulation | Review scheduling, dashboard date calculations. Tree-shakeable (unlike moment.js). |
| pino | 9.x | Logging | Fastify's default logger. JSON structured logs. |
| dotenv | 16.x | Environment config | Load `.env` files. Standard practice. |
| tsx | 4.x | TypeScript execution | Run TypeScript directly in dev. Replaces ts-node. |
| vitest | 2.x | Testing | Vite-native test runner. Works for both frontend (component tests) and backend (unit tests). One test tool for the whole monorepo. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend runtime | Node.js | Python (FastAPI) | No ML training needed. Would split the codebase into two languages, two type systems, two Docker images. Overhead not justified. |
| HTTP framework | Fastify | Express | Express is slower, no built-in validation, no native TypeScript. Legacy choice. |
| HTTP framework | Fastify | NestJS | Over-engineered for a single-user personal tool. Angular-style decorators and DI are unnecessary complexity. |
| ORM | Drizzle | Prisma | Prisma's separate query engine binary, generated client, and `.prisma` DSL add complexity. Drizzle is lighter and more transparent. |
| ORM | Drizzle | TypeORM | Legacy decorator-based API. Poor TypeScript inference. |
| Telegram bot | grammY | Telegraf | Telegraf development has stagnated. grammY has better TypeScript support and active maintenance. |
| Telegram bot | grammY | node-telegram-bot-api | Low-level, no middleware system, poor TypeScript support. |
| UI library | Naive UI | Vuetify 3 | Heavier, Material Design opinionated (not necessarily what you want for a learning tool). |
| UI library | Naive UI | Element Plus | Decent but less TypeScript-native. Enterprise-focused design language. |
| UI library | Naive UI | Tailwind + Headless UI | More work for dashboard-heavy app. Naive UI gives you data tables, trees, modals out of the box. |
| Charts | vue-chartjs | ECharts / Apache ECharts Vue | ECharts is more powerful but heavier. Chart.js is sufficient for progress dashboards. |
| State management | Pinia | Vuex | Vuex is in maintenance mode. Pinia is the official successor. |
| Spaced repetition | Custom SM-2 | FSRS algorithm | FSRS (used in Anki 23+) is more accurate but significantly more complex. SM-2 is good enough to start. Can migrate later if needed. |

## Project Structure

```
english/
  packages/
    shared/          # Shared TypeScript types (API contracts, domain models)
      src/
        types/       # ReviewCard, Sentence, Word, etc.
    server/          # Fastify backend
      src/
        routes/      # API routes
        services/    # Business logic (AI, SRS, dictionary)
        db/          # Drizzle schema + migrations
    web/             # Vue 3 SPA
      src/
        views/
        components/
        composables/
    bot/             # grammY Telegram bot
      src/
        handlers/
        conversations/
  docker-compose.yml
  tsconfig.base.json
```

**Why monorepo with packages:** Shared types between server, web, and bot. One `docker-compose.yml` at the root. Use TypeScript project references (`tsconfig.base.json` + per-package `tsconfig.json`). No need for Turborepo/Nx -- simple `npm workspaces` is sufficient.

## Installation

```bash
# Initialize monorepo
npm init -w packages/shared -w packages/server -w packages/web -w packages/bot

# Shared
npm install -w packages/shared zod

# Server
npm install -w packages/server fastify @fastify/cors @fastify/static drizzle-orm pg @anthropic-ai/sdk zod pino date-fns
npm install -D -w packages/server drizzle-kit @types/pg tsx vitest typescript

# Web
npm install -w packages/web vue vue-router pinia naive-ui vue-chartjs chart.js
npm install -D -w packages/web vite @vitejs/plugin-vue typescript vitest @vue/test-utils

# Bot
npm install -w packages/bot grammy drizzle-orm pg zod
npm install -D -w packages/bot tsx typescript vitest @types/pg

# Root dev dependencies
npm install -D typescript
```

## Version Pinning Strategy

Pin major versions in `package.json` using `^` (e.g., `"fastify": "^5.0.0"`). For a single-developer project, staying on latest patches is fine. Lock file (`package-lock.json`) ensures reproducible builds in Docker.

## Sources

- [Fastify official site](https://fastify.dev/) -- v5.8.2 confirmed
- [Drizzle ORM docs](https://orm.drizzle.team/) -- v0.45.x, PostgreSQL support
- [grammY official docs](https://grammy.dev/) -- v1.41.x
- [Pinia docs](https://pinia.vuejs.org/) -- v3, official Vue state management
- [Naive UI](https://www.naiveui.com/) -- v2.43.x, 80+ components
- [Vue.js 2025 in Review](https://vueschool.io/articles/news/vue-js-2025-in-review-and-a-peek-into-2026/) -- Vue 3.5 stable, 3.6 with reactivity refactor
- [Anthropic SDK npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- official TypeScript SDK
- [supermemo npm](https://www.npmjs.com/package/supermemo) -- SM-2 reference (recommend custom implementation instead)
- [vue-chartjs](https://vue-chartjs.org/) -- Chart.js 4 wrapper for Vue 3
