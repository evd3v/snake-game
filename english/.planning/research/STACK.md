# Stack Research: v1.1 Additions

**Domain:** Feature additions to existing English learning app
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

The v1.1 features (vocabulary browsing/filtering, web SRS review, multiple POS/translations, collocations display, Telegram auto-add) require **one new frontend dependency** (`@vueuse/core`) and **zero new backend dependencies**. The existing stack already provides all primitives needed: Drizzle ORM handles pagination/filtering with built-in operators, the SRS review API already exists, and schema evolution for word senses uses the existing migration workflow. This document focuses exclusively on what changes -- everything else stays as-is.

## Existing Stack (DO NOT change)

Already validated and working in v1.0. Listed for reference only:

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Vue 3 + Pinia + vue-router | ^3.5.29 / ^3.0.4 / ^5.0.3 |
| Build | Vite | ^7.3.1 |
| Backend | Fastify | ^5.8.2 |
| ORM | Drizzle ORM + drizzle-kit | ^0.45.1 / ^0.31.9 |
| Database | PostgreSQL (via pg) | ^8.20.0 |
| SRS | ts-fsrs | ^5.2.3 |
| Jobs | BullMQ + ioredis | ^5.70.4 / ^5.10.0 |
| Bot | grammY | ^1.41.1 |
| AI | Vercel AI SDK + @ai-sdk/anthropic + @ai-sdk/openai | ^6.0.116 |
| NLP | wink-lemmatizer | ^3.0.4 |
| Validation | Zod | ^4.3.6 |
| Styling | Scoped CSS (no framework) | -- |

## Recommended Addition

### @vueuse/core (frontend only)

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @vueuse/core | ^14.0 | Composable utilities for UI interactions | Provides battle-tested composables that would otherwise be hand-written. Tree-shakable -- only imported functions ship to bundle (~2-3KB gzipped for what we need). |

**Specific composables needed for v1.1:**

| Composable | Feature | What It Does |
|------------|---------|-------------|
| `useDebounceFn` | Vocabulary search | Debounces search input to avoid firing API requests per keystroke. 300ms delay is standard. |
| `onKeyStroke` | SRS review | Maps keyboard keys 1/2/3/4 to FSRS ratings (Again/Hard/Good/Easy) for fast review without mouse. |
| `useLocalStorage` | Vocabulary filters | Persists filter selections (familiarity level, CEFR filter, sort order) across page reloads. Single-user app, no need for server-side preference storage. |
| `useIntersectionObserver` | Vocabulary list | Optional: enables "load more" pagination pattern if infinite-scroll UX is preferred over page buttons. |

**Version compatibility:** VueUse 14+ requires Vue 3.5+. The project uses Vue ^3.5.29, so this is compatible.

## Installation

```bash
cd /Users/evd3v/Projects/Personal/english/web
npm install @vueuse/core
```

That is the complete list of new dependencies for v1.1.

## What is NOT Needed (and Why)

These are libraries that might seem relevant but would be counterproductive:

| Avoided Library | Why Not Needed | What to Do Instead |
|-----------------|----------------|-------------------|
| **UI component library** (PrimeVue, Naive UI, Vuetify) | App already has a consistent custom design system using scoped CSS (~500+ lines across components). Adding a framework means either migrating existing styles or running two systems. Bundle cost: 100-300KB. The vocabulary table and SRS cards are simple components. | Continue with scoped CSS. Write `<style scoped>` per component as established. |
| **TanStack Table / ag-Grid** | Vocabulary list is for a single user with hundreds to low-thousands of words. Full table framework is overkill and adds configuration complexity. | Simple `v-for` with server-side pagination from Drizzle (`limit`/`offset`). |
| **Virtual scroll library** | Server-side pagination means the DOM holds 20-50 items at most. Virtual scrolling solves a problem that pagination already solves. | Paginate on server. 20-50 items per page. |
| **Axios / ofetch** | Existing `web/src/api/client.ts` is 34 lines of typed `fetch` wrappers (`apiGet`, `apiPost`, `apiPatch`). Works perfectly. Axios adds 13KB for no benefit. | Extend existing client with `apiDelete` if needed. |
| **CSS animation library** (GSAP, Motion) | SRS card flip/reveal is a simple CSS transition. Vue's built-in `<Transition>` component handles enter/leave animations natively. | Use `<Transition name="flip">` with CSS transform. |
| **TanStack Query / SWR** | Query caching layer adds complexity. Single-user app with Pinia stores already follows a clean `loading`/`error`/`data` pattern (see `dashboard.ts` store). | Continue with Pinia stores + fetch on mount. |
| **Form validation** (VeeValidate, FormKit) | v1.1 has no complex forms. Vocabulary page is read/filter. SRS review is button clicks. | Backend Zod validation (already present) is sufficient. |
| **Tailwind CSS** | Adding Tailwind to an existing app with established scoped CSS means running two styling systems or migrating everything. Migration cost is high for no functional gain in v1.1. | Keep scoped CSS. Consistent with existing codebase. |

## Backend: Zero New Dependencies

### Vocabulary Pagination & Filtering

Drizzle ORM ^0.45.1 already has all operators needed:

```typescript
import { ilike, eq, sql, asc, desc, and } from 'drizzle-orm';

// All of these are built into drizzle-orm, no additional packages
// ilike() -- case-insensitive search
// eq() -- exact filter match
// limit().offset() -- pagination
// sql<number>`count(*)` -- total count for pagination UI
// asc() / desc() -- sorting
// and() -- combining multiple filters
```

New route needed: `GET /words` with query params `search`, `familiarity`, `cefrLevel`, `page`, `pageSize`, `sortBy`. Pure Drizzle, no new libraries.

### Multiple POS / Word Senses

Current schema has `words.translation` as a single text field and no POS column. Fix is a **schema migration** (Drizzle), not a new library:

```typescript
// New table via drizzle-kit generate + migrate
export const posEnum = pgEnum('pos', [
  'noun', 'verb', 'adjective', 'adverb', 'preposition',
  'conjunction', 'pronoun', 'interjection', 'determiner',
]);

export const wordSenses = pgTable('word_senses', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  wordId: integer('word_id').notNull().references(() => words.id),
  pos: posEnum(),
  translation: text().notNull(),
  definition: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Why a separate table instead of JSONB on words:** You will want to create SRS cards per sense (e.g., "run" as verb and "run" as noun are different cards). A relational table makes this queryable and joinable with `srs_cards`. JSONB would require extracting and re-inserting on every operation.

**Migration strategy:** Keep `words.translation` as the "primary/default" translation for backward compatibility. New senses go into `word_senses`. Existing words can be backfilled lazily (when AI re-analyzes a sentence containing them).

### SRS Review API

Already implemented in `src/routes/review.ts`:
- `GET /review/due` -- fetches due cards with enriched word/grammar data
- `POST /review/:cardId/rate` -- rates a card (1-4 scale matching FSRS)
- `POST /words/:wordId/srs-card` -- creates SRS card for a word

The web UI simply consumes these endpoints. No backend changes needed for basic web review.

### Collocations API

Tables exist (`collocations`, `sentence_collocations`). One new route needed:

`GET /words/:wordId/collocations` -- join through `sentence_words` and `sentence_collocations` to find collocations that appear in the same sentences as the word. Pure Drizzle query, no new libraries.

### Telegram Auto-Add

Logic change only: remove the familiarity selection step from the grammY conversation flow. Auto-set `familiarity: 'never_seen'` and auto-create SRS cards via the existing `createSrsCard()` service function. Zero new dependencies.

## Stack Patterns by Feature

| Feature | Backend Changes | Frontend Changes | New Dependencies |
|---------|----------------|-----------------|-----------------|
| Vocabulary page | New `GET /words` route with filtering/pagination | New Pinia store, list component with search/filter UI | @vueuse/core (debounce, localStorage) |
| Web SRS review | None (API exists) | New `/review` route + ReviewView, card components, keyboard shortcuts | @vueuse/core (onKeyStroke) |
| Multiple POS | New `word_senses` table migration, update AI pipeline | Display senses grouped under word entries | None |
| Collocations display | New `GET /words/:wordId/collocations` route | Collocation chips/badges in vocabulary and sentence views | None |
| Telegram auto-add | Remove familiarity prompt, auto-create SRS cards | None | None |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @vueuse/core@^14.0 | Vue ^3.5.0 | VueUse 14+ requires Vue 3.5+. Project has Vue ^3.5.29. Compatible. |
| drizzle-orm@^0.45.1 | drizzle-kit@^0.31.9 | Already working together. New `word_senses` migration uses existing `drizzle-kit generate` + `drizzle-kit migrate` workflow. |
| ts-fsrs@^5.2.3 | srs_cards schema | FSRS Rating enum (1-4) maps directly to web UI buttons. No version concerns. |

## Sources

- [VueUse official site](https://vueuse.org/) -- v14.0+ requires Vue 3.5+, tree-shakable, 200+ composables
- [VueUse GitHub](https://github.com/vueuse/vueuse) -- active maintenance, MIT license
- [Drizzle ORM docs](https://orm.drizzle.team/) -- confirmed ilike, limit, offset, count operators in ^0.45.x
- Codebase analysis -- `package.json`, `web/package.json`, schema files, routes, API client, Vue components reviewed directly

---
*Stack research for: English learning app v1.1 feature additions*
*Researched: 2026-03-10*
