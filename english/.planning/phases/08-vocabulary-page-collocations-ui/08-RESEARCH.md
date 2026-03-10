# Phase 8: Vocabulary Page & Collocations UI - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 SPA vocabulary browser + Fastify REST API with Drizzle ORM
**Confidence:** HIGH

## Summary

Phase 8 builds a full vocabulary browser page and surfaces collocations across the web UI. The backend needs new API endpoints for paginated word listing with filtering/sorting/search, a word detail endpoint (with collocations and word family), and endpoints to mark words as "known" or reset to "forgotten". The frontend needs a vocabulary list view with search/filter/sort controls, a word detail panel/page, and collocations displayed on both the sentence analysis result and word detail pages.

The codebase already has all necessary database schema (words, word_senses, srs_cards, collocations, sentence_collocations, word_families, sentence_words). Collocations relate to words **indirectly** through shared sentences -- there is no direct collocation-to-word join table. The existing AnalysisResult component already renders collocations in a `<details>` section (COLL-01 is partially done). The VocabularyView.vue is a placeholder (`<div>Vocabulary</div>`).

**Primary recommendation:** Build backend API endpoints first (vocabulary list with pagination/filter/sort/search, word detail with collocations + word family, mark-known/reset-forgotten), then build the Vue frontend components following existing project patterns (Pinia store, api/client.ts helpers, scoped CSS with the project's design system).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOCPG-01 | Full word list with search by lemma | New GET /vocabulary endpoint with `search` query param using `ilike` on lemma; paginated response |
| VOCPG-02 | Filter by familiarity, SRS state, CEFR, thematic cluster | Same endpoint with query params for each filter; Drizzle `and()` + `eq()`/`inArray()` conditions |
| VOCPG-03 | Sort by alphabet, date added, CEFR level | Same endpoint with `sortBy` + `sortOrder` query params; Drizzle `asc()`/`desc()` on appropriate columns |
| VOCPG-04 | Collocations visible per word | Word detail endpoint joins through sentence_words -> sentence_collocations to find collocations sharing sentences with the word |
| VOCPG-05 | Word family members visible | Word detail endpoint joins words on matching wordFamilyId |
| VOCPG-06 | Group words by thematic cluster | Frontend grouping mode or backend endpoint returning words grouped by thematicCluster |
| VOCPG-07 | Mark word as "known" (remove from review queue) | New PATCH endpoint that deletes the SRS card for the word sense |
| VOCPG-08 | Reset word to "forgotten" (return to queue) | New PATCH endpoint that creates a fresh SRS card (state=new) for the word sense |
| COLL-01 | Collocations on sentence analysis result page | AnalysisResult.vue already renders collocations -- verify data flows from API through store correctly |
| COLL-02 | Collocations on vocabulary word detail page | Word detail component shows collocations fetched from word detail endpoint |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.29 | Frontend framework | Already in project |
| Pinia | ^3.0.4 | State management | Already in project |
| vue-router | ^5.0.3 | Client routing | Already in project, /vocabulary route exists |
| Fastify | ^5.8.2 | Backend API | Already in project |
| Drizzle ORM | ^0.45.1 | Database queries | Already in project |
| PostgreSQL | - | Database | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm (sql template) | ^0.45.1 | Complex joins for collocation lookup | When Drizzle query builder is insufficient for multi-table joins |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side pagination | Client-side pagination | Not viable -- vocabulary can grow to hundreds/thousands of words |
| Direct collocation-word table | Indirect via sentences | Schema already exists this way; adding a direct link would require migration and is unnecessary |
| Separate word detail route | Slide-out panel on list page | Panel is simpler UX for personal tool; avoids extra route |

## Architecture Patterns

### Recommended Project Structure
```
src/routes/
  vocabulary.ts          # New: GET /vocabulary, GET /vocabulary/:id
web/src/
  views/
    VocabularyView.vue   # Main vocabulary page (replace placeholder)
  components/
    vocabulary/
      VocabularyList.vue     # Paginated word list with search/filters
      VocabularyFilters.vue  # Filter/sort controls
      WordDetail.vue         # Word detail panel (collocations, word family, actions)
  stores/
    vocabulary.ts        # New Pinia store for vocabulary state
  types/
    api.ts               # Extend with vocabulary types
```

### Pattern 1: API Route with Pagination + Filters
**What:** Single GET endpoint with query params for page, limit, search, filters, sort
**When to use:** Vocabulary list endpoint
**Example:**
```typescript
// Source: existing project pattern (dashboard.ts, words.ts)
fastify.get<{
  Querystring: {
    page?: string;
    limit?: string;
    search?: string;
    familiarity?: string;
    srsState?: string;
    cefrLevel?: string;
    cluster?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}>('/vocabulary', async (request) => {
  const page = Number(request.query.page ?? 1);
  const limit = Math.min(Number(request.query.limit ?? 50), 100);
  const offset = (page - 1) * limit;

  // Build WHERE conditions dynamically
  const conditions = [];
  if (request.query.search) {
    conditions.push(ilike(words.lemma, `%${request.query.search}%`));
  }
  if (request.query.cefrLevel) {
    conditions.push(eq(words.cefrLevel, request.query.cefrLevel));
  }
  // ... more filters

  const rows = await db
    .select({ /* fields */ })
    .from(words)
    .leftJoin(wordSenses, eq(words.id, wordSenses.wordId))
    .leftJoin(srsCards, eq(wordSenses.id, srsCards.wordSenseId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(/* dynamic sort */)
    .limit(limit)
    .offset(offset);

  // Also get total count for pagination
  const [{ total }] = await db
    .select({ total: sql<number>`count(DISTINCT ${words.id})::int` })
    .from(words)
    .where(conditions.length ? and(...conditions) : undefined);

  return { items: rows, total, page, limit };
});
```

### Pattern 2: Collocation Lookup via Shared Sentences
**What:** Find collocations related to a word by traversing sentence_words -> sentences -> sentence_collocations -> collocations
**When to use:** Word detail endpoint (VOCPG-04)
**Example:**
```typescript
// Source: schema analysis -- collocations link to sentences, words link to sentences
const wordCollocations = await db
  .selectDistinct({
    id: collocations.id,
    text: collocations.text,
    translation: collocations.translation,
    type: collocations.type,
    cefrLevel: collocations.cefrLevel,
  })
  .from(sentenceWords)
  .innerJoin(sentenceCollocations, eq(sentenceWords.sentenceId, sentenceCollocations.sentenceId))
  .innerJoin(collocations, eq(sentenceCollocations.collocationId, collocations.id))
  .where(eq(sentenceWords.wordId, wordId));
```

### Pattern 3: Word Family Lookup
**What:** Find all words sharing the same wordFamilyId
**When to use:** Word detail endpoint (VOCPG-05)
**Example:**
```typescript
// Only if the word has a wordFamilyId
if (word.wordFamilyId) {
  const familyMembers = await db
    .select({ id: words.id, lemma: words.lemma, cefrLevel: words.cefrLevel })
    .from(words)
    .where(and(
      eq(words.wordFamilyId, word.wordFamilyId),
      sql`${words.id} != ${wordId}`,  // exclude self
    ));
}
```

### Pattern 4: Mark Known / Reset Forgotten
**What:** Toggle SRS state for vocabulary management
**When to use:** VOCPG-07 and VOCPG-08
**Example:**
```typescript
// Mark as known: delete the SRS card(s) for all senses of this word
// This removes the word from the review queue entirely
fastify.post('/vocabulary/:wordId/mark-known', async (request) => {
  const wordId = Number(request.params.wordId);
  const senseIds = await db
    .select({ id: wordSenses.id })
    .from(wordSenses)
    .where(eq(wordSenses.wordId, wordId));

  if (senseIds.length > 0) {
    await db
      .delete(srsCards)
      .where(and(
        eq(srsCards.cardType, 'vocabulary'),
        inArray(srsCards.wordSenseId, senseIds.map(s => s.id)),
      ));
  }
  return { success: true };
});

// Reset to forgotten: create fresh SRS card(s) for senses that don't have one
fastify.post('/vocabulary/:wordId/reset', async (request) => {
  const wordId = Number(request.params.wordId);
  // For each word sense without an SRS card, create one
  const senses = await db
    .select({ id: wordSenses.id })
    .from(wordSenses)
    .where(eq(wordSenses.wordId, wordId));

  for (const sense of senses) {
    await createSrsCard(db, 'vocabulary', { wordSenseId: sense.id });
  }
  return { success: true };
});
```

### Pattern 5: Pinia Store with Pagination
**What:** Vue store managing paginated data, filters, and loading state
**When to use:** Vocabulary store
**Example:**
```typescript
// Source: existing pattern from dashboard.ts and sentences.ts stores
export const useVocabularyStore = defineStore('vocabulary', () => {
  const items = ref<VocabWord[]>([]);
  const total = ref(0);
  const page = ref(1);
  const loading = ref(false);
  const filters = ref<VocabFilters>({ search: '', familiarity: null, /* ... */ });
  const selectedWord = ref<WordDetail | null>(null);

  async function fetchWords() {
    loading.value = true;
    const params = new URLSearchParams();
    params.set('page', String(page.value));
    if (filters.value.search) params.set('search', filters.value.search);
    // ... more params
    const data = await apiGet<PaginatedResponse>(`/vocabulary?${params}`);
    items.value = data.items;
    total.value = data.total;
    loading.value = false;
  }

  async function fetchWordDetail(wordId: number) { /* ... */ }
  async function markKnown(wordId: number) { /* ... */ }
  async function resetWord(wordId: number) { /* ... */ }

  return { items, total, page, loading, filters, selectedWord, fetchWords, fetchWordDetail, markKnown, resetWord };
});
```

### Anti-Patterns to Avoid
- **Fetching all words client-side then filtering:** Data will grow; always paginate server-side
- **N+1 queries for word list:** Don't fetch collocations/family per word in the list view; only fetch on detail view
- **Separate routes for each filter combination:** Use one GET endpoint with optional query params
- **Mutating SRS card state fields directly for "mark known":** Delete the card instead -- matches the project's mental model where "known" means "not in review queue"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination math | Custom offset calculation | Simple `(page - 1) * limit` pattern, return total count | Standard pattern, already in Drizzle |
| Debounced search | Custom setTimeout logic | `setTimeout` with clear pattern or a simple `watchDebounced` | Prevent API spam on keystroke |
| CEFR sort order | Alphabetic sort on CEFR strings | CASE expression mapping A1=1, A2=2, B1=3, B2=4, C1=5, C2=6 | A1 < A2 < B1 is not alphabetical (B < C works, but A1/A2 ordering matters) |
| Filter state in URL | Manual query string parsing | vue-router query params sync | Bookmarkable filter state |

## Common Pitfalls

### Pitfall 1: CEFR Level Sorting
**What goes wrong:** Alphabetical sort puts B1 before A2 (B > A), but CEFR ordering is A1 < A2 < B1 < B2 < C1 < C2
**Why it happens:** CEFR levels are strings, not numbers
**How to avoid:** Use a SQL CASE expression or a mapping array for sort order
**Warning signs:** Words at C1 appearing before A2 in sorted view

### Pitfall 2: Collocation-Word Relationship is Indirect
**What goes wrong:** Attempting to JOIN collocations directly to words (no FK exists)
**Why it happens:** Schema links collocations to sentences, words to sentences, but not collocations to words
**How to avoid:** Join through sentence_words -> sentence_collocations path
**Warning signs:** Empty collocation results when direct join attempted

### Pitfall 3: Duplicate Words in List Due to Multiple Senses
**What goes wrong:** A word with 2 senses (noun + verb) appears twice in the list
**Why it happens:** LEFT JOIN on word_senses produces multiple rows per word
**How to avoid:** Use DISTINCT on word.id or aggregate senses into array; for list view, show one row per word with primary sense info
**Warning signs:** Word count in list exceeds actual unique words

### Pitfall 4: SRS State Filter Requires Join Logic
**What goes wrong:** Filtering by "no SRS card" (words without any card) requires IS NULL check on LEFT JOIN
**Why it happens:** Words without SRS cards won't appear in INNER JOIN
**How to avoid:** Use LEFT JOIN on srs_cards and check for NULL to find words not in review
**Warning signs:** "Not in review" filter returns 0 results despite known words existing

### Pitfall 5: Search Debouncing
**What goes wrong:** Every keystroke triggers an API call
**Why it happens:** No debounce on search input
**How to avoid:** Debounce search input by 300ms before triggering fetch
**Warning signs:** Network tab shows dozens of requests while typing

## Code Examples

### Vocabulary List API Response Shape
```typescript
// Expected response format for GET /vocabulary
interface VocabularyListResponse {
  items: Array<{
    id: number;           // word.id
    lemma: string;
    cefrLevel: string | null;
    thematicCluster: string | null;
    createdAt: string;
    senses: Array<{
      id: number;         // wordSense.id
      partOfSpeech: string;
      translation: string | null;
      familiarity: string;
    }>;
    srsState: string | null;  // aggregated: 'new' | 'learning' | 'review' | null (no card)
    hasCard: boolean;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

### Word Detail API Response Shape
```typescript
// Expected response format for GET /vocabulary/:wordId
interface WordDetailResponse {
  id: number;
  lemma: string;
  cefrLevel: string | null;
  thematicCluster: string | null;
  createdAt: string;
  senses: Array<{
    id: number;
    partOfSpeech: string;
    translation: string | null;
    familiarity: string;
    srsCard: {
      id: number;
      state: string;
      due: string;
      reps: number;
    } | null;
  }>;
  collocations: Array<{
    id: number;
    text: string;
    translation: string | null;
    type: string;
    cefrLevel: string | null;
  }>;
  wordFamily: Array<{
    id: number;
    lemma: string;
    cefrLevel: string | null;
  }>;
  sentences: Array<{
    id: number;
    text: string;
  }>;
}
```

### CEFR Sort Expression
```typescript
// Drizzle SQL for CEFR-aware ordering
const cefrOrder = sql`CASE ${words.cefrLevel}
  WHEN 'A1' THEN 1 WHEN 'A2' THEN 2
  WHEN 'B1' THEN 3 WHEN 'B2' THEN 4
  WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
  ELSE 7 END`;
```

### Debounced Search in Vue
```typescript
// Simple debounce pattern without external deps
let searchTimer: ReturnType<typeof setTimeout>;
function onSearchInput(value: string) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filters.value.search = value;
    page.value = 1;
    fetchWords();
  }, 300);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Words stored flat (no POS) | word_senses table with POS-aware storage | Phase 6 (2026-03-10) | Must join word_senses for translation/familiarity |
| SRS cards linked to word_id | SRS cards linked to word_sense_id | Phase 6 (2026-03-10) | Mark known/reset must operate per-sense |
| Manual word add to SRS | Auto-add with CEFR filter (B1+) | Phase 7 (2026-03-10) | Most words already have SRS cards |
| Familiarity on words table | Familiarity on word_senses table | Phase 6 (2026-03-10) | Filter by familiarity requires word_senses join |

## Open Questions

1. **List view: one row per word or per sense?**
   - What we know: A word can have multiple senses (e.g., "run" as noun and verb)
   - What's unclear: Should the list show "run" once or twice?
   - Recommendation: Show one row per word in the list; show all senses in the detail panel. This avoids visual clutter and matches user mental model of "I know the word run."

2. **"Mark known" semantics: delete SRS card or set special state?**
   - What we know: Requirements say "remove from review queue". SRS card states are new/learning/review/relearning.
   - What's unclear: Should we delete the card or add a "known" state?
   - Recommendation: Delete the SRS card. This is simplest and reversible via "reset/forgotten" which creates a new card. Adding a state would require schema migration.

3. **Cluster grouping (VOCPG-06): separate view mode or filter?**
   - What we know: Requirement says "group words by thematic cluster"
   - What's unclear: Is this a visual grouping mode or just filtering by cluster?
   - Recommendation: Implement as a filter (select cluster from dropdown) AND optionally show cluster-grouped view. Filter is the MVP; grouped view can be a sortBy=cluster option.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | implicit (package.json script) |
| Quick run command | `npm test -- --reporter=verbose tests/vocabulary-api.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOCPG-01 | GET /vocabulary returns paginated words, search filters by lemma | integration | `npm test -- tests/vocabulary-api.test.ts -t "list"` | No -- Wave 0 |
| VOCPG-02 | Filters: familiarity, SRS state, CEFR, cluster | integration | `npm test -- tests/vocabulary-api.test.ts -t "filter"` | No -- Wave 0 |
| VOCPG-03 | Sort by alphabet, date, CEFR | integration | `npm test -- tests/vocabulary-api.test.ts -t "sort"` | No -- Wave 0 |
| VOCPG-04 | Word detail includes collocations | integration | `npm test -- tests/vocabulary-api.test.ts -t "collocation"` | No -- Wave 0 |
| VOCPG-05 | Word detail includes word family | integration | `npm test -- tests/vocabulary-api.test.ts -t "family"` | No -- Wave 0 |
| VOCPG-06 | Cluster filter works | integration | `npm test -- tests/vocabulary-api.test.ts -t "cluster"` | No -- Wave 0 |
| VOCPG-07 | Mark known deletes SRS card | integration | `npm test -- tests/vocabulary-api.test.ts -t "mark-known"` | No -- Wave 0 |
| VOCPG-08 | Reset creates fresh SRS card | integration | `npm test -- tests/vocabulary-api.test.ts -t "reset"` | No -- Wave 0 |
| COLL-01 | Sentence analysis result shows collocations | manual-only | Verify AnalysisResult.vue renders collocations section | N/A (already renders) |
| COLL-02 | Vocabulary word detail shows collocations | manual-only | Visual verification in word detail panel | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- tests/vocabulary-api.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `tests/vocabulary-api.test.ts` -- covers VOCPG-01 through VOCPG-08
- [ ] Test data seeding for collocations linked to words via sentences (shared sentence linking pattern)

## Sources

### Primary (HIGH confidence)
- Project codebase analysis -- schema files, existing routes, Vue components, stores, test patterns
- `src/db/schema/*.ts` -- all database table definitions
- `src/routes/words.ts`, `src/routes/dashboard.ts` -- existing query patterns
- `web/src/stores/*.ts` -- Pinia store patterns
- `web/src/api/client.ts` -- API client pattern
- `web/src/components/sentence/AnalysisResult.vue` -- collocations already rendered
- `tests/words-api.test.ts` -- test pattern with buildTestApp/cleanupTestApp

### Secondary (MEDIUM confidence)
- Drizzle ORM documentation -- `ilike`, `and()`, `inArray()`, pagination with `limit`/`offset`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies needed
- Architecture: HIGH -- follows established project patterns exactly
- Pitfalls: HIGH -- identified from direct schema/code analysis
- Collocation linking: HIGH -- verified from schema that relationship is indirect via sentences

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal project, no external API changes)
