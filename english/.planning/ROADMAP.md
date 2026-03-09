# Roadmap: English Learning App

## Overview

This roadmap delivers a personal AI-powered English learning tool in five phases. We start with the data layer and API foundation, then build the AI analysis engine that powers everything. The Telegram bot comes next as the primary input method during reading sessions. Spaced repetition and exercise generation follow once there is vocabulary data to review. Finally, the web application provides the rich interface for review sessions, vocabulary management, and progress dashboards.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Data Layer** - Database schema, API skeleton, Docker environment, async job queue
- [ ] **Phase 2: AI Analysis Pipeline** - Sentence analysis, vocabulary extraction, lemmatization, collocations, grammar patterns
- [ ] **Phase 3: Telegram Bot** - Sentence input via bot, word selection, familiarity tagging
- [ ] **Phase 4: Spaced Repetition and Exercises** - FSRS engine, flashcard review, cloze exercises, batch generation, bot review
- [ ] **Phase 5: Web Application and Dashboard** - Vue SPA with sentence input, vocabulary management, review UI, progress dashboard

## Phase Details

### Phase 1: Foundation and Data Layer
**Goal**: A running development environment with database, API, and job queue ready to accept domain logic
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. PostgreSQL database is running with schema tables for sentences, words, collocations, grammar patterns, word families, and SRS cards created via Drizzle migrations
  2. Fastify API server starts and responds to health-check requests
  3. BullMQ worker process connects to Redis and can process a test job
  4. Docker Compose brings up the full dev environment (app + PostgreSQL + Redis) with one command
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, Docker environment, and database schema
- [x] 01-02-PLAN.md — Fastify server, BullMQ worker, and integration tests

### Phase 2: AI Analysis Pipeline
**Goal**: A sentence submitted via API is analyzed by AI and produces structured vocabulary, collocations, grammar patterns, and word families stored in the database
**Depends on**: Phase 1
**Requirements**: SENT-03, SENT-04, SENT-05, SENT-06, SENT-07, VOCAB-01, VOCAB-04, VOCAB-05, VOCAB-06, VOCAB-07
**Success Criteria** (what must be TRUE):
  1. Submitting a sentence via API returns AI analysis with translation, grammar breakdown, vocabulary list, and CEFR level
  2. Extracted words are stored as lemmas with automatic deduplication -- submitting the same word twice does not create duplicates
  3. Collocations, phrasal verbs, and idioms are extracted and stored as independent learnable units linked to their source sentence
  4. Word families are detected and linked in the database (e.g., submitting "reluctantly" links to existing "reluctant" and "reluctance")
  5. Each extracted word is auto-assigned to a thematic cluster by the AI
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Telegram Bot
**Goal**: User can send English sentences from a book via Telegram and see analysis results with the ability to select words to learn
**Depends on**: Phase 2
**Requirements**: INFRA-04, SENT-02, VOCAB-02, VOCAB-03
**Success Criteria** (what must be TRUE):
  1. User sends a sentence to the Telegram bot and receives a compact analysis (translation, key vocabulary, CEFR level) within seconds
  2. User can select which extracted words to save to their vocabulary via inline keyboard buttons
  3. User can set familiarity level for each saved word ("never seen" / "seen but unsure" / "understand in context")
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Spaced Repetition and Exercises
**Goal**: User can review saved vocabulary and grammar through FSRS-scheduled flashcards and AI-generated cloze exercises
**Depends on**: Phase 3
**Requirements**: SRS-01, SRS-02, SRS-03, SRS-04, SRS-05, SRS-06, SRS-07
**Success Criteria** (what must be TRUE):
  1. Due vocabulary cards appear for review scheduled by FSRS algorithm, with the original book sentence shown as context
  2. Grammar patterns have cloze exercises (AI-generated fill-in-the-blank sentences) that progress from simple to complex variations
  3. Exercises are pre-generated in batches and ready when the user starts a review session -- no waiting for AI
  4. User can complete a quick review session (due cards only) directly in the Telegram bot
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Web Application and Dashboard
**Goal**: User has a full web interface for sentence input, vocabulary browsing, review sessions, and progress tracking
**Depends on**: Phase 4
**Requirements**: INFRA-03, SENT-01, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. User can input sentences via web UI and see full AI analysis with word selection
  2. Dashboard shows overall progress counters (new / learning / known) for words and grammar patterns
  3. Dashboard highlights weak spots -- grammar patterns and words with lowest success rates
  4. Activity streak counter and heatmap show daily review and addition history
  5. Thematic cluster view shows vocabulary coverage gaps across topics
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Data Layer | 2/2 | Complete | 2026-03-09 |
| 2. AI Analysis Pipeline | 0/0 | Not started | - |
| 3. Telegram Bot | 0/0 | Not started | - |
| 4. Spaced Repetition and Exercises | 0/0 | Not started | - |
| 5. Web Application and Dashboard | 0/0 | Not started | - |
