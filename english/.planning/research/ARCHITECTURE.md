# Architecture Research: v1.1 Feature Integration

**Domain:** English learning app -- vocabulary management, web SRS review, multiple POS/translations, collocations UI
**Researched:** 2026-03-10
**Confidence:** HIGH (based on full codebase analysis, no external dependencies to verify)

## Existing Architecture Snapshot

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  ┌──────────────┐        ┌──────────────────────────────┐        │
│  │ Telegram Bot  │        │ Vue 3 SPA (web/)             │        │
│  │ grammY        │        │ Pinia stores, vue-router     │        │
│  │ handlers/     │        │ views/ components/ api/      │        │
│  └──────┬───────┘        └──────────────┬───────────────┘        │
│         │  HTTP (api-client.ts)          │  HTTP (client.ts)     │
├─────────┴───────────────────────────────┴────────────────────────┤
│                    Fastify API (autoloaded routes/)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │
│  │sentences │  │ words    │  │ review   │  │ dashboard    │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘     │
│       │              │             │               │             │
├───────┴──────────────┴─────────────┴───────────────┴─────────────┤
│                    Services Layer                                 │
│  ┌────────────┐  ┌─────────┐  ┌───────────────────┐              │
│  │ analysis   │  │ srs     │  │ exercise-generator│              │
│  └────────────┘  └─────────┘  └───────────────────┘              │
├──────────────────────────────────────────────────────────────────┤
│              BullMQ Workers (sentence-analysis queue)             │
├──────────────────────────────────────────────────────────────────┤
│                    Drizzle ORM + PostgreSQL                       │
│  words | sentences | srs_cards | collocations | grammar_patterns │
│  sentence_words | sentence_collocations | review_logs            │
│  grammar_exercises | word_families                               │
└──────────────────────────────────────────────────────────────────┘
```

## Feature-by-Feature Integration Analysis

### 1. Vocabulary Page (/vocabulary)

**Current state:** VocabularyView.vue is a stub (`<div>Vocabulary</div>`). Words route only serves `GET /sentences/:sentenceId/words` (scoped to a sentence) and `PATCH /words/:id/familiarity`.

**What needs to change:**

| Layer | Change Type | Details |
|-------|-------------|---------|
| API route | NEW endpoint | `GET /words` -- paginated word list with filters (familiarity, cluster, CEFR, search) |
| API route | NEW endpoint | `GET /words/:id` -- single word detail with sentences, collocations, SRS state |
| Pinia store | NEW | `stores/vocabulary.ts` -- word list state, filters, pagination |
| Vue view | REWRITE | `VocabularyView.vue` -- table/list with filters, search, word detail drawer |
| Vue components | NEW | `WordCard.vue`, `VocabularyFilters.vue`, `WordDetail.vue` |

**New API endpoint design:**

```
GET /words?page=1&limit=50&familiarity=never_seen&cluster=emotions&search=happi&cefr=B2&sort=created_at
```

Response should include SRS card state (joined from srs_cards) and sentence count. Use Drizzle's `sql` template for the aggregation:

```typescript
// In new words route handler
const wordList = await db
  .select({
    id: words.id,
    lemma: words.lemma,
    partOfSpeech: words.partOfSpeech,
    translation: words.translation,
    cefrLevel: words.cefrLevel,
    familiarity: words.familiarity,
    thematicCluster: words.thematicCluster,
    createdAt: words.createdAt,
    srsState: srsCards.state,
    sentenceCount: sql<number>`count(distinct ${sentenceWords.sentenceId})::int`,
  })
  .from(words)
  .leftJoin(srsCards, and(eq(srsCards.wordId, words.id), eq(srsCards.cardType, 'vocabulary')))
  .leftJoin(sentenceWords, eq(sentenceWords.wordId, words.id))
  .where(/* dynamic filters */)
  .groupBy(words.id, srsCards.state)
  .orderBy(/* dynamic sort */)
  .limit(limit)
  .offset((page - 1) * limit);
```

**Word detail endpoint** (`GET /words/:id`) should return:
- Word data + SRS card state
- All sentences containing this word (via sentenceWords join)
- Collocations containing this word (ILIKE search on collocation text)
- Word family members (via wordFamilyId)

### 2. Web SRS Review Flow

**Current state:** Review API exists (`GET /review/due`, `POST /review/:cardId/rate`). Bot already uses it via api-client.ts. Web has no review view or store.

**What needs to change:**

| Layer | Change Type | Details |
|-------|-------------|---------|
| API route | NO CHANGE | `/review/due` and `/review/:cardId/rate` already work |
| API route | MINOR ENHANCE | Add collocations to vocabulary card enrichment in `/review/due` |
| Router | ADD route | `/review` path in vue-router |
| Pinia store | NEW | `stores/review.ts` -- due cards queue, current card, answer state |
| Vue view | NEW | `ReviewView.vue` -- card flip UI for vocabulary, cloze input for grammar |
| Vue components | NEW | `VocabCard.vue`, `GrammarExercise.vue`, `RatingButtons.vue`, `ReviewSummary.vue` |
| Nav | MODIFY | Add "Review" link to App.vue nav |

**Review flow data:**

The existing `/review/due` response already has everything needed:
- Vocabulary cards: lemma, translation, cefrLevel, one sentence context
- Grammar cards: pattern, description, exercise (sentence with cloze, answer, hint)

The web review store should:
1. Fetch due cards batch on mount
2. Present one card at a time (flip card for vocab, text input for grammar cloze)
3. On rating, POST to `/review/:cardId/rate`, advance to next card
4. Show session summary when batch is done (cards reviewed, avg score)

**No schema changes needed for this feature.**

### 3. Multiple Translations / POS Support

**Current state:** `words.lemma` is `UNIQUE`. The lemmatizer normalizes by POS (e.g., `normalizeLemma("running", "noun")` vs `normalizeLemma("running", "verb")`). However, same base lemma with different POS collide on the unique constraint. A word like "run" as noun and verb maps to the same lemma "run" and only stores one translation.

**The problem:** `words` table has a single `translation` text field. When AI extracts "run" as verb (translation: "бежать") and later "run" as noun (translation: "забег"), the upsert in `storeAnalysisResults` overwrites `thematicCluster` but keeps the first `translation`. The word only exists once.

**Schema change required:**

Option A (recommended): Add `partOfSpeech` column to `words`, change unique constraint from `lemma` to `(lemma, partOfSpeech)`.

Option B: Create a separate `word_translations` table with multiple translations per word.

**Recommendation: Option A** because it is simpler, the AI already returns POS, and the lemmatizer already accepts POS. A word used as different POS genuinely IS a different vocabulary item to learn (different SRS cards, different familiarity).

| Layer | Change Type | Details |
|-------|-------------|---------|
| Schema | MODIFY | Add `partOfSpeech` to `words` table, change unique to `(lemma, partOfSpeech)` |
| Schema | MIGRATION | Backfill existing words -- set POS from most recent sentence analysis or default to null |
| Service | MODIFY | `analysis.ts` -- upsert key changes from `lemma` to `(lemma, partOfSpeech)` |
| Lemmatizer | NO CHANGE | Already accepts POS |
| SRS | MINOR | SRS card creation already links by `wordId`, no change needed |
| API | MODIFY | Word endpoints return POS, vocabulary page filters by POS |
| AI schema | NO CHANGE | Already returns `partOfSpeech` per vocabulary item |
| Bot | MODIFY | Display POS in word selection keyboard |

**Migration approach:**

```sql
ALTER TABLE words ADD COLUMN part_of_speech text;
ALTER TABLE words DROP CONSTRAINT words_lemma_unique;
ALTER TABLE words ADD CONSTRAINT words_lemma_pos_unique UNIQUE (lemma, part_of_speech);
```

Drizzle schema change:

```typescript
export const words = pgTable('words', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  lemma: text().notNull(),
  partOfSpeech: text('part_of_speech'),
  translation: text(),
  cefrLevel: text('cefr_level'),
  familiarity: familiarityEnum().default('never_seen'),
  thematicCluster: text('thematic_cluster'),
  wordFamilyId: integer('word_family_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.lemma, t.partOfSpeech),
]);
```

**Impact on `storeAnalysisResults`:**

```typescript
// Current: onConflictDoUpdate target: words.lemma
// New: onConflictDoUpdate target: [words.lemma, words.partOfSpeech]
const [upsertedWord] = await db
  .insert(words)
  .values({
    lemma: normalizedLemma,
    partOfSpeech: vocab.partOfSpeech,  // NEW
    translation: vocab.translation,
    cefrLevel: vocab.cefrLevel,
    thematicCluster: vocab.thematicCluster,
  })
  .onConflictDoUpdate({
    target: [words.lemma, words.partOfSpeech],  // CHANGED
    set: { thematicCluster: vocab.thematicCluster },
  })
  .returning({ id: words.id });
```

### 4. Collocations Display in Web UI

**Current state:** Collocations are stored and linked to sentences via `sentence_collocations`. The `GET /sentences/:id/details` endpoint already returns collocations. But there is no standalone collocations browsing, and collocations are not shown on word detail pages.

**What needs to change:**

| Layer | Change Type | Details |
|-------|-------------|---------|
| API route | NEW endpoint | `GET /collocations` -- browsable list with type filter |
| API route | NEW endpoint | `GET /words/:id/collocations` -- collocations containing a specific word |
| Vue components | NEW | `CollocationList.vue` -- used in word detail and sentence analysis |
| Vue view | MODIFY | `VocabularyView.vue` word detail shows related collocations |
| Sentence analysis | MODIFY | `AnalysisResult.vue` -- render collocations section (data already available) |

**Finding collocations for a word** requires a text search because collocations are stored as free text (e.g., "take a break"). There is no `collocation_words` junction table. Two approaches:

Approach A (simple, good enough): SQL `ILIKE` search for the word lemma within collocation text.

```typescript
// GET /words/:id/collocations
const word = await db.select().from(words).where(eq(words.id, wordId));
const related = await db
  .select()
  .from(collocations)
  .where(sql`${collocations.text} ILIKE ${'%' + word.lemma + '%'}`);
```

Approach B (normalized): Add a `collocation_words` junction table linking collocations to their component words.

**Recommendation: Approach A** for now. The dataset is personal (hundreds, not millions of collocations). ILIKE on a small table is fast enough. Add a junction table later if search quality becomes an issue.

**Collocations in sentence analysis UI:** The data is already returned by `/sentences/:id/details` -- the `AnalysisResult.vue` component just needs to render the `collocations` array that comes from the store's `result.collocations`.

### 5. Telegram Auto-Add Words

**Current state:** After analysis, bot shows word selection keyboard. User manually selects words, then sets familiarity for each. Only selected words get SRS cards.

**What needs to change:**

| Layer | Change Type | Details |
|-------|-------------|---------|
| Service | MODIFY | `analysis.ts` `storeAnalysisResults` -- auto-create SRS cards for all words |
| Bot handler | MODIFY | `sentence.ts` -- skip word selection flow, show analysis only |
| Bot handler | SIMPLIFY | `vocabulary.ts` -- selection states no longer needed for new sentences |
| Config | OPTIONAL | Add setting to toggle auto-add behavior |

**Implementation:** In `storeAnalysisResults`, after upserting each word, automatically create an SRS card (same pattern grammar patterns already use):

```typescript
// After word upsert, auto-create SRS card
const [existingCard] = await db
  .select({ id: srsCards.id })
  .from(srsCards)
  .where(and(
    eq(srsCards.cardType, 'vocabulary'),
    eq(srsCards.wordId, upsertedWord.id),
  ))
  .limit(1);

if (!existingCard) {
  const emptyCard = createEmptyCard();
  await db.insert(srsCards).values({
    cardType: 'vocabulary',
    wordId: upsertedWord.id,
    state: 'new',
    due: emptyCard.due,
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsedDays: emptyCard.elapsed_days,
    scheduledDays: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
  });
}
```

The familiarity field stays at `never_seen` by default. The user can still change familiarity from the web vocabulary page. The bot flow simplifies to: send sentence -> see analysis result -> done.

**Word selection keyboard becomes optional.** Keep the code but do not show it by default. The user can still manually manage familiarity via the web vocabulary page.

## Schema Changes Summary

Only ONE migration is needed:

```sql
-- Add part_of_speech to words table
ALTER TABLE words ADD COLUMN part_of_speech text;

-- Replace unique constraint: lemma -> (lemma, part_of_speech)
ALTER TABLE words DROP CONSTRAINT words_lemma_unique;
ALTER TABLE words ADD CONSTRAINT words_lemma_pos_unique UNIQUE (lemma, part_of_speech);
```

No other tables need changes. The existing schema supports all other features.

## New Components Map

### Backend (src/)

```
src/
├── routes/
│   ├── words.ts           # MODIFY: add GET /words (paginated), GET /words/:id
│   ├── review.ts          # MINOR: add collocations to vocab card enrichment
│   ├── collocations.ts    # NEW: GET /collocations, GET /words/:id/collocations
│   ├── sentences.ts       # NO CHANGE
│   └── dashboard.ts       # NO CHANGE
├── services/
│   ├── analysis.ts        # MODIFY: auto-create SRS cards, use (lemma, POS) upsert
│   └── srs.ts             # NO CHANGE
├── db/schema/
│   └── words.ts           # MODIFY: add partOfSpeech, change unique constraint
└── bot/handlers/
    ├── sentence.ts        # MODIFY: skip word selection, show analysis only
    └── vocabulary.ts      # SIMPLIFY: remove selection flow for auto-add mode
```

### Frontend (web/src/)

```
web/src/
├── router/index.ts        # MODIFY: add /review route
├── views/
│   ├── VocabularyView.vue # REWRITE: full vocabulary list with filters
│   └── ReviewView.vue     # NEW: SRS review session
├── stores/
│   ├── vocabulary.ts      # NEW: word list, filters, pagination
│   └── review.ts          # NEW: review session state
├── components/
│   ├── vocabulary/
│   │   ├── WordTable.vue           # NEW: sortable word table
│   │   ├── VocabularyFilters.vue   # NEW: filter controls
│   │   └── WordDetail.vue          # NEW: detail drawer/modal
│   ├── review/
│   │   ├── VocabCard.vue           # NEW: flip card for vocabulary
│   │   ├── GrammarExercise.vue     # NEW: cloze input for grammar
│   │   ├── RatingButtons.vue       # NEW: Again/Hard/Good/Easy buttons
│   │   └── ReviewSummary.vue       # NEW: session end summary
│   ├── collocations/
│   │   └── CollocationList.vue     # NEW: reusable collocation display
│   └── sentence/
│       └── AnalysisResult.vue      # MODIFY: render collocations section
└── App.vue                # MODIFY: add Review nav link
```

## Data Flow: New Flows

### Vocabulary Browse Flow

```
User opens /vocabulary
    |
    v
VocabularyView mounts -> vocabulary store fetches
    |
    v
GET /words?page=1&limit=50&sort=created_at
    |
    v
words route -> Drizzle query (words LEFT JOIN srs_cards LEFT JOIN sentence_words)
    |
    v
Response: { items: Word[], total: number, page: number }
    |
    v
User clicks word -> GET /words/:id (detail + sentences + collocations)
    |
    v
WordDetail drawer opens with full context
```

### Web Review Flow

```
User opens /review
    |
    v
ReviewView mounts -> review store fetches
    |
    v
GET /review/due?limit=20  (existing endpoint, no change)
    |
    v
Store queues cards, shows first card
    |
    v
Vocabulary: show lemma -> user thinks -> flip -> see translation + sentence context
Grammar: show cloze sentence -> user types answer -> reveal correct answer
    |
    v
User rates (Again=1, Hard=2, Good=3, Easy=4)
    |
    v
POST /review/:cardId/rate { rating }  (existing endpoint)
    |
    v
Store advances to next card (or shows summary if done)
```

### Auto-Add Flow (Telegram)

```
User sends sentence in Telegram
    |
    v
Bot handler -> POST /sentences { text }
    |
    v
BullMQ job -> AI analysis -> storeAnalysisResults
    |
    v
For each word: upsert word -> auto-create SRS card (NEW)
    |
    v
Bot shows analysis result (translation, grammar, collocations)
    |
    v
NO word selection keyboard (CHANGED)
```

## Architectural Patterns

### Pattern 1: Paginated List Endpoint

**What:** Standard offset pagination for word lists.
**When to use:** Any list endpoint that could grow beyond ~100 items.

```typescript
// Consistent pagination response shape
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

Use offset pagination (not cursor) because the dataset is small (personal app, <10k words) and offset is simpler for random page access.

### Pattern 2: Filter Builder

**What:** Dynamic Drizzle `where` clause construction from query params.
**When to use:** Vocabulary endpoint with multiple optional filters.

```typescript
function buildWordFilters(query: WordQueryParams) {
  const conditions = [];
  if (query.familiarity) conditions.push(eq(words.familiarity, query.familiarity));
  if (query.cluster) conditions.push(eq(words.thematicCluster, query.cluster));
  if (query.cefr) conditions.push(eq(words.cefrLevel, query.cefr));
  if (query.search) conditions.push(ilike(words.lemma, `%${query.search}%`));
  if (query.pos) conditions.push(eq(words.partOfSpeech, query.pos));
  return conditions.length > 0 ? and(...conditions) : undefined;
}
```

### Pattern 3: Review Session State Machine

**What:** Client-side state machine for review flow (idle -> reviewing -> rating -> next/summary).
**When to use:** Review view only.

```typescript
// In review store
type ReviewPhase = 'loading' | 'showing' | 'revealed' | 'summary';
const phase = ref<ReviewPhase>('loading');
const currentIndex = ref(0);
const cards = ref<DueCard[]>([]);
const sessionStats = ref({ reviewed: 0, ratings: [] as number[] });
```

No need for a state machine library -- a simple ref with explicit transitions is sufficient for this linear flow.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching All Words Without Pagination

**What people do:** `GET /words` returning the entire word table.
**Why it is wrong:** Grows unbounded. At 5000+ words, response becomes slow and UI freezes.
**Do this instead:** Always paginate. Default limit=50, max limit=100.

### Anti-Pattern 2: Separate API Calls for Related Data on List Pages

**What people do:** Fetch word list, then N separate calls for SRS state per word.
**Why it is wrong:** N+1 query pattern. 50 words = 51 API calls.
**Do this instead:** JOIN srs_cards in the word list query. Return srsState alongside each word.

### Anti-Pattern 3: Storing Review Session State on Server

**What people do:** Create a "review session" entity in the database.
**Why it is wrong:** Unnecessary complexity for a single-user app. Session state is ephemeral.
**Do this instead:** Keep session state in Pinia store. Fetch due cards, iterate client-side, POST ratings individually.

### Anti-Pattern 4: Adding a collocation_words Junction Table Prematurely

**What people do:** Normalize collocations by linking individual words to collocations via a junction table.
**Why it is wrong:** Over-engineering for a personal app with hundreds of collocations. ILIKE search is fast enough and simpler to implement and maintain.
**Do this instead:** Use ILIKE text matching on the collocations.text column. Revisit if search quality becomes a real problem.

### Anti-Pattern 5: Making POS a Separate Table

**What people do:** Create a `word_senses` or `word_translations` table with POS and translation as child records.
**Why it is wrong:** Adds a JOIN to every query, complicates the upsert logic, and is unnecessary when POS is 1:1 with the vocabulary item concept (a noun "run" and verb "run" are genuinely different things to learn).
**Do this instead:** Add POS as a column on the words table with a composite unique constraint.

## Build Order (Dependency-Aware)

The features have dependencies that dictate optimal build order:

```
1. Multiple POS schema migration     (no deps, blocks everything else)
    |
    v
2. Auto-add in Telegram + analysis   (depends on POS upsert logic change)
   service changes
    |
    v
3. Vocabulary page (GET /words API   (depends on POS column existing)
   + Vue components)
    |
    v
4. Collocations display              (depends on vocabulary page for word detail)

5. Web SRS review                    (independent -- can run in parallel with 2-4)
```

**Rationale:**
- POS migration MUST be first because it changes the words table unique constraint, which affects all upsert logic in `storeAnalysisResults`.
- Auto-add changes the analysis service which also needs the POS upsert change, so it naturally follows the migration.
- Vocabulary page depends on POS being in the schema so the word list shows POS correctly from day one.
- Collocations display is most useful alongside the vocabulary word detail page.
- Web SRS review is fully independent -- the API already exists. It can be built in parallel with items 2-4.

**Parallel opportunity:** Web SRS review (item 5) can be built simultaneously with items 2-4 since it only touches new frontend files and the existing review API.

## Integration Points

### Existing Services Impact

| Service | Impact | Risk |
|---------|--------|------|
| `analysis.ts` storeAnalysisResults | MODIFY upsert key + auto-SRS | MEDIUM -- must update carefully, test with existing data |
| `srs.ts` | NO CHANGE | NONE |
| `exercise-generator.ts` | NO CHANGE | NONE |
| `word-family.ts` | NO CHANGE | NONE |
| `lemmatizer.ts` | NO CHANGE | NONE |

### Bot / Web Shared API

| Endpoint | Used By | Change |
|----------|---------|--------|
| `GET /review/due` | Bot + Web (new) | None needed |
| `POST /review/:cardId/rate` | Bot + Web (new) | None needed |
| `GET /sentences/:id/words` | Bot + Web | None needed |
| `GET /sentences/:id/details` | Bot + Web | None needed |
| `PATCH /words/:id/familiarity` | Bot + Web | None needed |
| `POST /words/:wordId/srs-card` | Bot + Web | None needed (auto-add makes this less used) |
| `GET /words` | Web only (new) | New endpoint |
| `GET /words/:id` | Web only (new) | New endpoint |
| `GET /collocations` | Web only (new) | New endpoint |
| `GET /words/:id/collocations` | Web only (new) | New endpoint |

The bot and web share the same Fastify API. No CORS changes needed (web already configured). No new authentication concerns (single-user app).

## Sources

- Full codebase analysis of `src/` (routes, services, db/schema, bot/handlers, workers)
- Full codebase analysis of `web/src/` (stores, views, components, api, router)
- Drizzle ORM schema files for current table structure
- Existing route handlers for current API contract
- ts-fsrs integration in `services/srs.ts`
- AI analysis schema in `lib/ai/schemas.ts`

---
*Architecture research for: English learning app v1.1 feature integration*
*Researched: 2026-03-10*
