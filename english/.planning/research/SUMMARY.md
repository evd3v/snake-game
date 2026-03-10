# Project Research Summary

**Project:** English Learning App v1.1
**Domain:** Language learning SRS tool -- vocabulary management, web review, schema evolution
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

The v1.1 release transforms the English learning app from a Telegram-centric input tool with a read-only web dashboard into a full web+bot hybrid with vocabulary browsing, web-based SRS review, and streamlined word acquisition. The existing codebase is well-structured: Fastify API with Drizzle ORM, Vue 3 SPA, grammY bot, BullMQ workers, and ts-fsrs for spaced repetition. The review API already exists and works -- the bot consumes it today. Most v1.1 features are frontend builds on top of existing backend infrastructure, with one critical exception: the schema migration for multiple parts of speech.

The recommended approach is to lead with the schema migration (adding `partOfSpeech` to `words`, changing the unique constraint, adding a unique index on `srs_cards`), then build outward. Only one new dependency is needed: `@vueuse/core` for frontend composables (debounce, keyboard shortcuts, localStorage persistence). Everything else uses existing stack primitives. The architecture research confirms that the vocabulary page is a paginated list with JOINs, web review is a stateless card-by-card flow consuming the existing API, and Telegram auto-add is a logic change in the analysis service.

The top risk is the unique lemma constraint migration. Every word upsert, SRS card link, and sentence-word association touches this constraint. Getting the migration wrong corrupts data or breaks the analysis pipeline. Secondary risks include review queue flooding from auto-add (mitigated by CEFR-level filtering) and SRS state conflicts between web and Telegram (mitigated by stateless web review and a staleness guard on the bot). All three critical pitfalls have clear prevention strategies documented in the research.

## Key Findings

### Recommended Stack

The existing stack handles all v1.1 requirements without new backend dependencies. The only addition is `@vueuse/core` on the frontend.

**Core technologies (no changes):**
- **Drizzle ORM** -- provides `ilike`, `eq`, `and`, `limit/offset`, `count` for vocabulary pagination and filtering natively
- **ts-fsrs** -- FSRS Rating enum (1-4) maps directly to web review UI buttons; `createEmptyCard()` used for auto-add
- **Vue 3 + Pinia + vue-router** -- two new stores (vocabulary, review), two new views, ~10 new components

**New addition:**
- **@vueuse/core ^14.0** -- `useDebounceFn` (search), `onKeyStroke` (review keyboard shortcuts), `useLocalStorage` (filter persistence). Tree-shakable, ~2-3KB gzipped for needed composables. Compatible with Vue ^3.5.29.

**Explicitly avoided:** UI component libraries, TanStack Table, Axios, Tailwind CSS, TanStack Query. The app has established patterns (scoped CSS, typed fetch wrappers, Pinia stores) that work. Adding parallel systems creates maintenance burden for zero functional gain.

### Expected Features

**Must have (table stakes):**
- Vocabulary list with search, filtering (familiarity, CEFR, SRS state, thematic cluster), and sorting
- Web SRS review flow for both vocabulary cards and grammar cloze exercises
- Collocation display on sentence analysis page (data already exists in DB, just not rendered)
- Collocation display on vocabulary word detail page

**Should have (differentiators):**
- Multiple POS/translations per lemma -- "run" as verb vs noun tracked separately with independent SRS cards
- Telegram auto-add -- skip manual word selection, auto-create SRS cards for new words
- Keyboard shortcuts for review (1/2/3/4 keys)
- Session progress bar and stats summary in web review
- Thematic cluster and word family browsing on vocabulary page

**Defer (v2+):**
- Card template editor, deck/tag organization, audio/pronunciation
- Gamification, bulk import/export, custom SRS parameter UI
- Collocation SRS cards (show as enrichment only, not as reviewable cards)

### Architecture Approach

The architecture follows a clean separation: Fastify routes call services, services use Drizzle ORM, bot and web share the same API. v1.1 adds 4 new API endpoints (`GET /words`, `GET /words/:id`, `GET /collocations`, `GET /words/:id/collocations`), modifies the analysis service for auto-add and POS-aware upserts, and builds two new Vue views with associated Pinia stores. No new architectural patterns are introduced -- the existing paginated response shape, store-per-view convention, and service layer are extended.

**Major changes by layer:**
1. **Schema** -- add `partOfSpeech` column to `words`, composite unique constraint `(lemma, partOfSpeech)`, partial unique indexes on `srs_cards`
2. **Analysis service** -- change upsert target to composite key, auto-create SRS cards for new words
3. **API routes** -- new vocabulary and collocations endpoints with paginated, filtered responses
4. **Vue frontend** -- vocabulary view (table + filters + word detail), review view (card UI + rating buttons + session summary)
5. **Telegram bot** -- simplify sentence flow (remove word selection keyboard), add staleness guard to review

### Critical Pitfalls

1. **Unique lemma constraint blocks multiple POS** -- The `UNIQUE("lemma")` constraint and `onConflictDoUpdate({ target: words.lemma })` must both change. Migration must be additive: add nullable `pos` column, backfill, then change constraint. Never delete or split existing word rows. Do this FIRST.

2. **SRS state conflict between web and Telegram** -- Telegram caches 20 cards in memory at session start. If user reviews on web, those cards become stale. Prevention: web review fetches one card at a time (stateless). Add staleness guard to Telegram `rateCard()` -- check `lastReview` against session start time.

3. **Auto-add floods review queue with known words** -- Without filtering, every word from every sentence gets an SRS card, including A1 basics. Prevention: filter by CEFR level (only auto-create cards for B2+ words), provide a "mark as known" bulk action.

4. **Duplicate SRS cards from missing unique constraint** -- `srs_cards` has no unique index on `(card_type, word_id)`. Auto-add will create duplicates. Prevention: add partial unique indexes before enabling auto-add.

5. **Collocations not linkable to individual words** -- Only sentence-level linking exists. Word-level lookup requires text matching (`ILIKE`), which is unreliable. For v1.1, ILIKE on the small dataset is acceptable; junction table can be added later if quality degrades.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Schema Migration and Data Model

**Rationale:** Every other feature depends on the correct word data model. The POS column, unique constraint change, and SRS card unique index must exist before any UI or service logic is built on top.
**Delivers:** `partOfSpeech` column on words, composite unique `(lemma, partOfSpeech)`, partial unique indexes on `srs_cards`, updated Drizzle schema.
**Addresses:** Multiple POS/translations (schema foundation).
**Avoids:** Pitfall 1 (constraint migration), Pitfall 5 (duplicate SRS cards).

### Phase 2: Analysis Service Updates + Telegram Auto-Add

**Rationale:** The analysis service upsert logic must change to use the composite key before any new words are processed. Auto-add (creating SRS cards automatically) is a service-level change that should be in place before the vocabulary UI is built, so the UI displays real auto-added data from day one.
**Delivers:** POS-aware word upserts, automatic SRS card creation with CEFR filtering, simplified Telegram sentence flow.
**Addresses:** Telegram auto-add, analysis pipeline update.
**Avoids:** Pitfall 3 (queue flooding via CEFR filter), Pitfall 5 (duplicates blocked by index from Phase 1).

### Phase 3: Vocabulary Page

**Rationale:** With schema and service changes stable, the vocabulary page can be built on correct data. This is the highest-impact UI feature -- it transforms the web app from a dashboard into a usable vocabulary tool.
**Delivers:** Paginated word list, search, filters (familiarity, CEFR, SRS state, cluster, POS), sort options, word detail view with sentences and collocations.
**Addresses:** Vocabulary list, filtering, sorting, collocation display on word detail, thematic cluster browsing, word family links.
**Avoids:** Pitfall 4 (N+1 queries -- uses single paginated query with JOINs).

### Phase 4: Web SRS Review

**Rationale:** Independent of vocabulary page. The API already exists. This is a pure frontend build. Can potentially overlap with Phase 3 since they touch different files.
**Delivers:** Web review flow (vocab cards + grammar cloze), keyboard shortcuts, progress bar, session summary.
**Addresses:** Web SRS review, keyboard shortcuts, session stats.
**Avoids:** Pitfall 2 (stateless fetch-rate-fetch pattern), Pitfall 7 (no client-side session to lose on refresh).

### Phase 5: Collocations UI + Polish

**Rationale:** Collocations display is most useful alongside the vocabulary page (Phase 3) and benefits from the word detail component already existing. This phase also covers any integration polish.
**Delivers:** Collocations on sentence analysis view, collocations API endpoint, review nav link, any cross-feature polish.
**Addresses:** Collocation display on sentence analysis, collocation display on vocabulary page (if not done in Phase 3).
**Avoids:** Pitfall 6 (uses ILIKE for now, acceptable for dataset size).

### Phase Ordering Rationale

- Schema first because the unique constraint change ripples through every word-touching codepath. Building UI on the old schema means rework.
- Service changes before UI because auto-add populates real data that the vocabulary page will display. Building the page first means testing with manually-added data that does not reflect the final flow.
- Vocabulary page before review because it is the higher-impact table-stakes feature. Users need to see their words before they review them on web.
- Collocations last because they are enrichment on top of existing views, not standalone functionality.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Schema Migration):** The `normalizeLemma()` adverb-to-adjective collapsing needs investigation -- it may cause unexpected POS collisions. Test with real data before finalizing the migration.
- **Phase 2 (Auto-Add):** The CEFR filtering threshold needs validation. Decide whether B1 words should get auto-added or only B2+. This depends on the user's actual level.

Phases with standard patterns (skip research):
- **Phase 3 (Vocabulary Page):** Standard paginated list with filters. Well-documented Drizzle patterns. No unknowns.
- **Phase 4 (Web SRS Review):** The API exists and is tested. The UI follows the universal Anki/Mochi flashcard pattern. No unknowns.
- **Phase 5 (Collocations UI):** Simple component rendering data already available from the API. No unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Full codebase analyzed. Only one new dependency with verified compatibility. |
| Features | HIGH | Based on direct codebase analysis + established SRS app patterns (Anki, LingQ). Feature scope is well-defined. |
| Architecture | HIGH | All integration points mapped from actual code. No external API dependencies or unknowns. |
| Pitfalls | HIGH | Every pitfall traced to specific lines of code (schema constraints, upsert targets, in-memory state). Prevention strategies are concrete. |

**Overall confidence:** HIGH

### Gaps to Address

- **CEFR auto-add threshold:** Research identifies the need for CEFR-based filtering but does not determine the exact cutoff. User's current level (B1-B2) suggests B2+ for auto-SRS, but this needs validation with real sentence data.
- **normalizeLemma() adverb collapsing:** The lemmatizer collapses adverbs to adjective form ("quickly" -> "quick"). With POS-aware uniqueness, this creates a collision between adjective "quick" and adverb "quickly" (both normalize to "quick"). Needs a fix or explicit decision during Phase 1.
- **Exercise exhaustion rate:** With web review adding sessions, grammar exercises (6 per pattern, `used` boolean) may exhaust faster. Monitor during Phase 4 and add re-generation if needed.
- **Collocation-word linking accuracy:** ILIKE text matching is a known approximation. Track false positives/negatives during Phase 5 to decide if a junction table is warranted for v1.2.

## Sources

### Primary (HIGH confidence)
- Full codebase analysis: schema files, route handlers, services, bot handlers, Vue stores and components
- [Drizzle ORM docs](https://orm.drizzle.team/) -- ilike, limit, offset, count operators confirmed for ^0.45.x
- [Anki official docs](https://docs.ankiweb.net/preferences.html) -- review UI patterns, rating buttons
- ts-fsrs library -- FSRS scheduling, createEmptyCard(), Rating enum
- PostgreSQL partial unique indexes -- standard feature for nullable column uniqueness

### Secondary (MEDIUM confidence)
- [VueUse](https://vueuse.org/) -- v14.0+ composables, Vue 3.5+ requirement
- [LingQ vocabulary filtering](https://forum.lingq.com/t/how-and-why-to-filter-your-vocabulary-list-like-a-pro/6858) -- vocabulary page filter patterns
- [Lemma-based dictionary design](https://bierfeldt.com/posts/2022-10-06-designing-dataset-lemma-translation-dictionary/) -- GlobalSense model for multi-sense words

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
