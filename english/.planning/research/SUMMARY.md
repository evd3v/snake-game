# Project Research Summary

**Project:** English Learning App
**Domain:** AI-powered reading-based language acquisition (Telegram bot + web SPA)
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

This is a personal AI-powered English learning tool built around a single core loop: the user reads English text, submits sentences via Telegram bot, receives AI-powered linguistic analysis (translation, vocabulary, collocations, grammar patterns, CEFR level), and reviews extracted material through spaced repetition. The expert-recommended approach is a TypeScript monorepo with a Fastify REST API serving both a Vue 3 SPA and a grammY Telegram bot, backed by PostgreSQL and a BullMQ/Redis job queue for asynchronous AI processing. This is a modular monolith -- not microservices -- because it is a single-user personal tool where deployment simplicity matters more than horizontal scaling.

The recommended stack is well-established and high-confidence: Node.js 22 + Fastify 5 + Drizzle ORM + Vue 3 + grammY + PostgreSQL 16. The key architectural decision is that all AI calls (Claude API) go through a background job queue, never in the request path. This prevents UI blocking, enables automatic retries, and makes token cost management tractable. The spaced repetition engine should use FSRS (not SM-2) -- it is trained on 700M+ reviews, produces 20-30% fewer reviews for the same retention, and is the default in modern Anki. The `ts-fsrs` npm package provides a production-ready TypeScript implementation.

The top risks are: (1) inconsistent AI analysis output corrupting learning data -- mitigated by structured output schemas, fixed grammar taxonomies, temperature=0, and Zod validation; (2) unbounded token costs spiraling beyond a personal budget -- mitigated by prompt caching, model routing (Sonnet for analysis, Haiku for validation), and batched exercise generation; (3) lemmatization failures creating duplicate vocabulary and losing phrasal verb distinctions -- mitigated by a two-pass extraction (deterministic lemmatizer + LLM for context-dependent units) and strict deduplication at insertion time.

## Key Findings

### Recommended Stack

Full TypeScript monorepo using npm workspaces with four packages: `shared` (types), `server` (Fastify API), `web` (Vue 3 SPA), `bot` (grammY Telegram bot). No need for Turborepo/Nx at this scale. Docker Compose orchestrates app + PostgreSQL + Redis in production.

**Core technologies:**
- **Node.js 22 LTS + Fastify 5 + TypeScript 5**: Single-language stack, shared types across all packages, 2x faster than Express with built-in validation
- **Vue 3.5 + Pinia 3 + Naive UI 2**: Composition API, TypeScript-first UI library with 80+ components suited for dashboards
- **PostgreSQL 16 + Drizzle ORM**: TypeScript-native ORM with SQL-like syntax, no query engine binary (unlike Prisma), built-in migrations
- **grammY 1.41**: TypeScript-first Telegram bot framework, active maintenance, superior to Telegraf
- **@anthropic-ai/sdk**: Claude API with structured output via tool_use for reliable JSON responses
- **BullMQ + Redis**: Job queue for async AI processing with retries and priorities
- **ts-fsrs**: Production-ready FSRS implementation for spaced repetition (replaces SM-2)
- **Zod 3**: Runtime validation for AI responses, API inputs, and environment config

### Expected Features

**Must have (table stakes):**
- Sentence input via Telegram bot with AI analysis (translation, vocabulary, CEFR level)
- Vocabulary extraction with lemmatization and deduplication
- Vocabulary list with 3-level status tracking (new / learning / known)
- FSRS-based flashcard review with original sentence context
- Basic progress dashboard (word counts, daily activity)
- Web UI for vocabulary management and review sessions

**Should have (differentiators):**
- Collocation and phrasal verb extraction as first-class learning units
- Grammar pattern extraction and mastery tracking across encounters
- Word family linking (reluctance / reluctant / reluctantly)
- AI-generated cloze exercises in batches
- Thematic vocabulary clusters with gap analysis
- Review streak and heat map

**Defer (v2+):**
- Grammar pattern mastery progression scores (needs 100+ sentences of data)
- Adaptive exercise difficulty (needs exercise history to calibrate)
- Exercise type variety beyond cloze (sentence reordering, error correction)
- Telegram bot inline review sessions (complex UX in chat)

### Architecture Approach

Modular monolith: single Fastify process behind Nginx, with a separate BullMQ worker process for AI batch jobs. The Telegram bot operates in webhook mode as a thin client that calls the same service layer as the Vue SPA. PostgreSQL stores all persistent data; Redis backs the job queue. AI calls are always asynchronous -- the API enqueues a job and returns immediately, the worker processes it and stores results.

**Major components:**
1. **REST API (Fastify)** -- request handling, validation, routing for both web and bot clients
2. **Domain Services** -- business logic for sentences, words, collocations, grammar patterns, word families
3. **AI Service Layer** -- provider-agnostic abstraction over Claude/OpenAI with structured output and cost tracking
4. **Background Worker (BullMQ)** -- processes AI analysis and batch exercise generation asynchronously
5. **SRS Engine (FSRS)** -- scheduling, review session management, card progression
6. **Vue 3 SPA** -- vocabulary management, review sessions, progress dashboard
7. **Telegram Bot (grammY)** -- sentence input during reading, compact analysis results with inline keyboards

### Critical Pitfalls

1. **Inconsistent AI analysis output** -- Use structured output schemas with fixed enums for grammar patterns and CEFR levels. Set temperature=0 for analysis. Validate every response with Zod before storing. Define a canonical grammar taxonomy upfront; do not let the LLM invent labels.

2. **Unbounded token costs** -- Use prompt caching (90% cost reduction on static portions), model routing (Sonnet for analysis, Haiku for validation), batched exercise generation (10-20 per call), explicit max_tokens caps, and per-call cost tracking in the database with daily/monthly ceilings.

3. **Lemmatization failures and vocabulary duplicates** -- Two-pass extraction: deterministic lemmatizer for standard forms, LLM for phrasal verbs and collocations in context. Deduplicate at insertion time by lemma + POS. Store surface forms alongside lemmas. Maintain a curated phrasal verb dictionary.

4. **SM-2 algorithm deficiencies** -- Use FSRS instead. SM-2 has documented problems with low-interval traps and overdue card bias. FSRS handles both correctly and requires fewer reviews. The `ts-fsrs` package is production-ready.

5. **Telegram bot UX as a wall of text** -- After sentence submission, return only translation + compact summary with inline keyboard buttons for details on demand. Use message editing for drill-down. Keep the bot focused on input and quick reviews; deep analysis belongs in the web app.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Data Layer
**Rationale:** Everything depends on the database schema and API skeleton. Getting the schema right early is critical because retrofitting vocabulary deduplication and collocation support is expensive. The schema must support phrasal verbs, collocations, and polymorphic SRS cards from day one.
**Delivers:** PostgreSQL schema with all core tables, Drizzle ORM setup with migrations, Fastify API skeleton with typed routes, shared TypeScript types package, Docker Compose for dev environment.
**Addresses:** Vocabulary list with status tracking, project structure, database foundation.
**Avoids:** Pitfall 4 (lemmatization) by designing schema for phrasal verbs and collocations upfront.

### Phase 2: AI Analysis Pipeline
**Rationale:** This is the foundational capability -- all extraction (vocabulary, grammar, collocations) flows from AI analysis. Must be built before either UI because both bot and web depend on it. The async job queue pattern is an architectural decision that must be in place from the start.
**Delivers:** AI provider abstraction (ClaudeProvider), BullMQ + Redis job queue, background worker process, sentence analysis with structured output, Zod validation pipeline, cost tracking per API call, prompt caching setup.
**Addresses:** Sentence input + AI analysis, vocabulary extraction with lemmas, CEFR level estimation, collocation extraction foundation.
**Avoids:** Pitfall 1 (inconsistent AI output) via structured schemas and fixed taxonomy; Pitfall 5 (token costs) via caching and model routing from the start.

### Phase 3: Telegram Bot
**Rationale:** The bot is the primary input method (user reads a book, quickly sends sentences). Building it before the web UI validates the entire backend flow: input -> AI analysis -> stored results. Testing with real reading sessions exposes prompt and UX issues early.
**Delivers:** grammY bot with webhook mode, sentence input handler, compact analysis response with inline keyboards, async "thinking..." pattern for AI processing, persistent conversation state.
**Addresses:** Telegram bot for sentence input, context display.
**Avoids:** Pitfall 6 (bot UX) by designing information hierarchy and using inline keyboards from day one.

### Phase 4: SRS Engine and Review
**Rationale:** SRS is a pure algorithm that depends on the data layer but not on AI. Building it after Phase 2 means there is vocabulary data to review. FSRS is well-documented and `ts-fsrs` handles the math.
**Delivers:** FSRS integration via ts-fsrs, review scheduling queries, review session flow (get due cards, present, grade, reschedule), review history logging.
**Addresses:** FSRS-based flashcard review, context display during review.
**Avoids:** Pitfall 2 (SM-2 issues) by using FSRS instead.

### Phase 5: Exercise Generation
**Rationale:** Depends on both AI pipeline (Phase 2) and SRS cards (Phase 4). Exercises need existing vocabulary and grammar patterns to target. Batch generation requires the job queue already in place.
**Delivers:** Exercise generation prompts, batch generation background job, self-consistency validation pass, exercise storage with used/verified flags, exercise-to-card linking.
**Addresses:** AI-generated cloze exercises, collocation matching exercises.
**Avoids:** Pitfall 3 (wrong exercises) by implementing validation pipeline and "report problem" mechanism from day one.

### Phase 6: Web Application
**Rationale:** Built last because the entire backend is validated via bot and API tests by this point. No wasted UI work on unstable APIs. The web app is the rich interface for review sessions, vocabulary management, and progress tracking.
**Delivers:** Vue 3 SPA with Naive UI, vocabulary list with search/filter/status changes, review session UI, progress dashboard (word counts, streaks, heat map), sentence analysis viewer.
**Addresses:** Web UI for vocabulary list, review sessions, progress dashboard, thematic clusters visualization.
**Avoids:** Pitfall (dashboard empty states) by designing all states from zero to 1000+ data points.

### Phase 7: Advanced Features
**Rationale:** These features require accumulated data and a stable core system. Grammar pattern mastery needs 100+ analyzed sentences. Adaptive difficulty needs exercise history. Word families and thematic clusters enhance existing functionality.
**Delivers:** Word family linking, grammar pattern progression and mastery scores, thematic vocabulary clusters with gap analysis, adaptive exercise difficulty.
**Addresses:** All P2 and P3 features from the feature prioritization matrix.

### Phase Ordering Rationale

- **Data layer first** because schema changes after data exists require migrations and potential data loss. Getting vocabulary deduplication, collocation support, and polymorphic SRS cards right upfront saves weeks of refactoring.
- **AI pipeline before any UI** because it is the core value proposition. Without reliable analysis, neither the bot nor the web app delivers value.
- **Bot before web** because the bot is the primary input method during reading and validates the full backend flow with minimal UI effort. Real reading sessions are the best test.
- **SRS before exercises** because FSRS is a pure algorithm that can be built and tested independently. Exercises depend on SRS cards existing.
- **Web app near the end** because it is the most expensive to change and benefits from a stable API. Dashboard is meaningless without data.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (AI Analysis Pipeline):** Prompt engineering for reliable structured output across diverse sentence types. Grammar taxonomy definition requires linguistic expertise. Collocation deduplication strategy needs testing with real data.
- **Phase 5 (Exercise Generation):** LLM exercise quality (~75% well-formedness rate) requires a validation pipeline. Exercise type design and difficulty progression need careful prompt engineering.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard PostgreSQL + Drizzle + Fastify setup. Well-documented patterns.
- **Phase 3 (Telegram Bot):** grammY has excellent documentation and examples. Webhook pattern is standard.
- **Phase 4 (SRS Engine):** ts-fsrs is a drop-in library. Review session flow is well-understood.
- **Phase 6 (Web Application):** Standard Vue 3 + Pinia + Naive UI. Component library provides most UI needs out of the box.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are mature, well-documented, and actively maintained. Version recommendations are based on official sources. |
| Features | HIGH | Feature landscape well-researched against competitors (LingQ, Anki, Readlang). Clear MVP definition with justified prioritization. |
| Architecture | HIGH | Modular monolith with async AI processing is a well-established pattern. Build order follows clear dependency chain. |
| Pitfalls | MEDIUM-HIGH | Pitfalls are well-documented in the AI/NLP and SRS communities. Some mitigation strategies (collocation deduplication, exercise validation) need real-world testing to confirm effectiveness. |

**Overall confidence:** HIGH

### Gaps to Address

- **Grammar taxonomy definition:** No canonical taxonomy was produced during research. The list of grammar patterns (e.g., "Third Conditional", "Present Perfect Continuous") needs to be defined before Phase 2 prompt engineering. Recommend creating a curated list of 50-100 patterns relevant to B1-C1 progression.
- **Collocation deduplication strategy:** Research identifies this as the hardest technical challenge but does not resolve which approach works best (LLM similarity judgment vs. normalized string matching). Needs prototyping in Phase 2.
- **FSRS vs SM-2 disagreement:** STACK.md recommends custom SM-2; FEATURES.md and PITFALLS.md recommend FSRS via ts-fsrs. **Resolution: use FSRS.** The evidence strongly favors it -- 20-30% fewer reviews, correct overdue handling, production-ready TypeScript package. SM-2 is 30+ years old with documented deficiencies.
- **Architecture mentions both Telegraf and grammY:** ARCHITECTURE.md references Telegraf in some places while STACK.md recommends grammY. **Resolution: use grammY.** It has better TypeScript support and active maintenance.
- **Background worker necessity for MVP:** BullMQ + Redis adds infrastructure complexity. For MVP with a single user, a simpler in-process async approach (Promise-based) could work initially, upgrading to BullMQ when reliability matters. This is a judgment call during Phase 2 planning.
- **Deterministic lemmatizer choice:** PITFALLS.md recommends spaCy for a first-pass lemmatizer, but spaCy is a Python library. In a Node.js stack, alternatives are `wink-lemmatizer`, `compromise`, or calling spaCy via a Python sidecar. This needs evaluation during Phase 2.

## Sources

### Primary (HIGH confidence)
- [Fastify official docs](https://fastify.dev/) -- v5.8.2 confirmed
- [Drizzle ORM docs](https://orm.drizzle.team/) -- v0.45.x, PostgreSQL support
- [grammY official docs](https://grammy.dev/) -- v1.41.x, TypeScript-first
- [Vue.js 2025 in Review](https://vueschool.io/articles/news/vue-js-2025-in-review-and-a-peek-into-2026/) -- Vue 3.5 stable
- [Anthropic SDK npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- official TypeScript SDK
- [ts-fsrs npm package](https://www.npmjs.com/package/ts-fsrs) -- TypeScript FSRS implementation
- [Pinia docs](https://pinia.vuejs.org/) -- v3, official Vue state management
- [Naive UI](https://www.naiveui.com/) -- v2.43.x, 80+ components

### Secondary (MEDIUM confidence)
- [FSRS vs SM-2 comparison](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/) -- performance benchmarks
- [SM-2 Overdue Card Bias Analysis](https://controlaltbackspace.org/overdue-handling/) -- 13 years of Anki data
- [LLM cloze generation research](https://arxiv.org/abs/2403.02078) -- ~75% well-formedness rate
- [LLM Sensitivity to Prompt Engineering](https://arxiv.org/html/2406.12334) -- up to 76-point accuracy variance
- [LLM Cost Optimization Strategies](https://www.glukhov.org/post/2025/11/cost-effective-llm-applications) -- prompt caching, model routing

### Tertiary (LOW confidence)
- [Collocation extraction approaches](https://en.wikipedia.org/wiki/Collocation_extraction) -- NLP methods, needs validation for LLM-based approach
- Exercise validation via self-consistency check catching ~70% of errors -- cited in PITFALLS.md without primary source

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
