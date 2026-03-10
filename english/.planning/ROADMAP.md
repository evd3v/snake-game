# Roadmap: English Learning App

## Milestones

- **v1.0 MVP** - Phases 1-5 (shipped)
- **v1.1 UX Polish & Web Features** - Phases 6-11 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) - SHIPPED</summary>

- [x] **Phase 1: Foundation and Data Layer** - Database schema, API skeleton, Docker environment, async job queue
- [x] **Phase 2: AI Analysis Pipeline** - Sentence analysis, vocabulary extraction, lemmatization, collocations, grammar patterns
- [x] **Phase 3: Telegram Bot** - Sentence input via bot, word selection, familiarity tagging
- [x] **Phase 4: Spaced Repetition and Exercises** - FSRS engine, flashcard review, cloze exercises, batch generation, bot review
- [x] **Phase 5: Web Application and Dashboard** - Vue SPA with sentence input, dashboard, progress tracking

</details>

**Phase Numbering:**
- Integer phases (6, 7, 8, 9): Planned v1.1 work
- Decimal phases (7.1, 7.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 6: Data Model Evolution** - POS-aware word senses, composite uniqueness, SRS card linkage migration (completed 2026-03-10)
- [ ] **Phase 7: Service Updates & Telegram Auto-Add** - POS-aware upserts, automatic SRS card creation, simplified Telegram flow
- [ ] **Phase 8: Vocabulary Page & Collocations UI** - Full vocabulary browser with filters, word detail, collocations display across all views
- [x] **Phase 9: Web SRS Review** - Card-by-card review flow in browser with keyboard shortcuts and session tracking (completed 2026-03-10)

## Phase Details

### Phase 6: Data Model Evolution
**Goal**: Words support multiple parts of speech with independent translations and SRS tracking per sense
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A word like "run" can exist as both verb and noun with different translations, without constraint violations
  2. Each word sense has its own SRS card -- reviewing "run (verb)" does not affect "run (noun)"
  3. All existing words have been migrated to the new schema with a sense derived from their current POS/translation
  4. The analysis pipeline continues to work after migration -- submitting a sentence produces correct word entries
**Plans:** 3/3 plans complete

Plans:
- [ ] 06-00-PLAN.md -- Wave 0: test stubs for word senses (Nyquist prerequisite)
- [ ] 06-01-PLAN.md -- Schema + migration + analysis pipeline (word_senses table, data migration, two-step upsert)
- [ ] 06-02-PLAN.md -- Consumer updates (routes, dashboard, SRS service, bot types, tests)

### Phase 7: Service Updates & Telegram Auto-Add
**Goal**: New words from sentence analysis are automatically added with SRS cards, no manual selection required
**Depends on**: Phase 6
**Requirements**: TG-01, TG-02
**Success Criteria** (what must be TRUE):
  1. When user submits a sentence in Telegram, all new words automatically get SRS cards without prompting for familiarity selection
  2. Words that already have SRS cards are not duplicated when encountered in a new sentence
  3. The review queue is not flooded with trivial words -- CEFR-based filtering prevents basic vocabulary from auto-adding
**Plans:** 2 plans

Plans:
- [ ] 07-01-PLAN.md -- Auto-SRS creation in analysis service with CEFR filtering
- [ ] 07-02-PLAN.md -- Simplify Telegram bot (remove word selection/familiarity flow)

### Phase 8: Vocabulary Page & Collocations UI
**Goal**: Users can browse, search, filter, and manage their entire vocabulary through the web app, with collocations visible everywhere
**Depends on**: Phase 7
**Requirements**: VOCPG-01, VOCPG-02, VOCPG-03, VOCPG-04, VOCPG-05, VOCPG-06, VOCPG-07, VOCPG-08, COLL-01, COLL-02
**Success Criteria** (what must be TRUE):
  1. User can see all saved words in a paginated list and search by lemma
  2. User can filter words by familiarity level, SRS state, CEFR level, and thematic cluster -- and sort by alphabet, date added, or CEFR level
  3. User can view word detail showing associated collocations and word family members
  4. User can mark a word as "known" (removing it from review queue) or reset it to "forgotten" (returning it to queue)
  5. Collocations are displayed on the sentence analysis result page and on the vocabulary word detail page
**Plans:** 2 plans

Plans:
- [ ] 08-01-PLAN.md -- Vocabulary API backend (list with pagination/filter/sort, word detail, mark-known/reset)
- [ ] 08-02-PLAN.md -- Frontend vocabulary page (Vue components, Pinia store, collocations UI)

### Phase 9: Web SRS Review
**Goal**: Users can complete full review sessions in the browser with the same quality as Telegram review
**Depends on**: Phase 6
**Requirements**: WREV-01, WREV-02, WREV-03, WREV-04, WREV-05, WREV-06
**Success Criteria** (what must be TRUE):
  1. User can review vocabulary flashcards (with original book sentence as context) and grammar cloze exercises in the browser
  2. User can rate cards using Again/Hard/Good/Easy buttons or keyboard shortcuts (1-4)
  3. User sees a progress bar during the session and a summary screen after completion showing counts per rating
  4. Reviewing on web does not corrupt Telegram review state -- staleness guard prevents conflicts
**Plans:** 2/2 plans complete

Plans:
- [ ] 09-01-PLAN.md -- Staleness guard + review types, Pinia store, and route setup
- [ ] 09-02-PLAN.md -- Review UI components (card display, rating, progress, summary)

- [ ] **Phase 10: Collocation SRS & Review Enhancement** - Collocations as SRS cards, grammar review shows pattern description and context sentence
- [x] **Phase 11: Grammar & Collocations Browse Pages** - Dedicated pages to browse all grammar patterns and collocations with filters (completed 2026-03-10)

## Phase Details (continued)

### Phase 10: Collocation SRS & Review Enhancement
**Goal**: Collocations become reviewable SRS items and grammar review cards show richer context
**Depends on**: Phase 9
**Requirements**: CSRS-01, CSRS-02, CSRS-03
**Success Criteria** (what must be TRUE):
  1. When a sentence is analyzed, collocations automatically get SRS cards (new cardType='collocation')
  2. Collocation cards appear in /review — front shows collocation text + context sentence, back shows translation + type (collocation/phrasal_verb/idiom)
  3. Grammar cards in /review show pattern description and an example sentence from user's texts on the back side
**Plans**: TBD

### Phase 11: Grammar & Collocations Browse Pages
**Goal**: Users can browse, search, and filter all grammar patterns and collocations they've encountered
**Depends on**: Phase 10
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03
**Success Criteria** (what must be TRUE):
  1. User can see all grammar patterns on /grammar page with CEFR level, description, SRS status, and example sentences
  2. User can see all collocations on /collocations page with CEFR level, type, translation, and example sentences
  3. Both pages support filtering by CEFR level, type, and text search
**Plans:** 2/2 plans complete

Plans:
- [ ] 11-01-PLAN.md -- Grammar and collocations API routes with tests (pagination, filters, search, example sentences)
- [ ] 11-02-PLAN.md -- Frontend views, stores, components, routing, and navigation

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9
Note: Phase 9 depends on Phase 6 (not Phase 8), so Phases 8 and 9 could potentially overlap.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Data Model Evolution | 3/3 | Complete   | 2026-03-10 | - |
| 7. Service Updates & Telegram Auto-Add | v1.1 | 0/2 | Not started | - |
| 8. Vocabulary Page & Collocations UI | v1.1 | 0/2 | Not started | - |
| 9. Web SRS Review | v1.1 | Complete    | 2026-03-10 | - |
| 10. Collocation SRS & Review Enhancement | v1.1 | 0/? | Not started | - |
| 11. Grammar & Collocations Browse Pages | 2/2 | Complete    | 2026-03-10 | - |
