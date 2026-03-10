# Phase 11: Grammar & Collocations Browse Pages - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 browse pages with Fastify API, Drizzle ORM queries, filtering/search
**Confidence:** HIGH

## Summary

Phase 11 adds two new browse pages (`/grammar` and `/collocations`) that follow the exact same architectural pattern already established by Phase 8's `/vocabulary` page. The data models (`grammar_patterns`, `collocations`) already exist with CEFR levels, and junction tables (`sentence_grammar_patterns`, `sentence_collocations`) already link them to sentences. SRS cards already reference `grammarPatternId`; Phase 10 will add `collocation` to `cardTypeEnum` and a `collocationId` column to `srs_cards`.

The implementation is straightforward: two new API endpoints with pagination/filter/search, two Pinia stores mirroring the vocabulary store pattern, two Vue views with filter/list components, and two new routes + nav links.

**Primary recommendation:** Clone the vocabulary page pattern exactly (route file, Pinia store, View + Filters + List components) for both grammar and collocations pages. The only new query complexity is fetching example sentences via junction tables, which is a simple join already used elsewhere in the codebase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BROWSE-01 | /grammar page -- list all grammar patterns with CEFR, description, SRS status, example sentences | Grammar patterns schema exists with pattern, description, cefrLevel. SRS cards link via grammarPatternId. Example sentences available via sentenceGrammarPatterns join. Vocabulary page pattern provides exact template. |
| BROWSE-02 | /collocations page -- list all collocations with CEFR, type, translation, example sentences | Collocations schema has text, translation, type (collocation/phrasal_verb/idiom), cefrLevel. Example sentences via sentenceCollocations join. After Phase 10, SRS cards will link via collocationId. |
| BROWSE-03 | Filtering and search on both pages (by CEFR, type, text) | Vocabulary page already implements CEFR filter, text search (ilike), and SRS state filter. Same pattern applies with type filter for collocations and pattern text search for grammar. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | 3.x | Frontend SPA framework | Already used across all views |
| Pinia | latest | State management | Already used for vocabulary, review, dashboard stores |
| vue-router | 4.x | Client-side routing | Already configured, just add routes |
| Fastify | 4.x | Backend API framework | All routes use this pattern |
| Drizzle ORM | 0.x | Database queries | All existing queries use Drizzle select/where/join |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm (operators) | - | ilike, eq, and, asc, desc, inArray, sql | Filter/sort/pagination queries |

### Alternatives Considered
None -- the entire stack is already established. No new libraries needed.

## Architecture Patterns

### Recommended Project Structure
```
src/routes/
  grammar.ts              # GET /grammar (list with filters)
  collocations.ts         # GET /collocations (list with filters)

web/src/
  views/
    GrammarView.vue       # /grammar page
    CollocationsView.vue  # /collocations page
  stores/
    grammar.ts            # Pinia store (clone of vocabulary pattern)
    collocations.ts       # Pinia store (clone of vocabulary pattern)
  components/
    grammar/
      GrammarFilters.vue  # CEFR filter, SRS state filter, text search
      GrammarList.vue     # Paginated list with CEFR badge, description, SRS status
    collocations/
      CollocationFilters.vue  # CEFR filter, type filter, text search
      CollocationList.vue     # Paginated list with CEFR badge, type, translation
  types/
    api.ts                # Add Grammar/Collocation list types
```

### Pattern 1: Paginated List API with Filters (clone vocabulary.ts)
**What:** Backend route that accepts query params for page, limit, search, filters, returns paginated items + total
**When to use:** Both /grammar and /collocations endpoints
**Example:**
```typescript
// Source: existing src/routes/vocabulary.ts pattern
fastify.get<{
  Querystring: {
    page?: string;
    limit?: string;
    search?: string;
    cefrLevel?: string;
    srsState?: string;
    type?: string; // collocations only
  };
}>('/grammar', async (request) => {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 50));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) conditions.push(ilike(grammarPatterns.pattern, `%${search}%`));
  if (cefrLevel) conditions.push(eq(grammarPatterns.cefrLevel, cefrLevel));
  // SRS state filter via exists/notExists subquery on srsCards

  const items = await fastify.db
    .select(...)
    .from(grammarPatterns)
    .where(and(...conditions))
    .orderBy(...)
    .limit(limit)
    .offset(offset);

  // Batch-fetch example sentences via sentenceGrammarPatterns
  // Batch-fetch SRS card states
  return { items, total, page, limit };
});
```

### Pattern 2: Pinia Store with Filters (clone vocabulary store)
**What:** Reactive store managing items, filters, pagination, loading state
**When to use:** Both grammar and collocations stores
**Example:**
```typescript
// Source: existing web/src/stores/vocabulary.ts pattern
export const useGrammarStore = defineStore('grammar', () => {
  const items = ref<GrammarPattern[]>([])
  const total = ref(0)
  const page = ref(1)
  const filters = reactive<GrammarFilters>({
    search: '',
    cefrLevel: '',
    srsState: '',
  })

  async function fetchItems() {
    loading.value = true
    const params = new URLSearchParams()
    // ... same pattern as vocabulary store
    const data = await apiGet<GrammarListResponse>(`/grammar?${params}`)
    items.value = data.items
    total.value = data.total
    loading.value = false
  }
  // updateFilters, clearFilters, setPage -- identical pattern
})
```

### Pattern 3: Example Sentences via Junction Table
**What:** Fetch a limited number of example sentences for each grammar pattern or collocation
**When to use:** Both pages need to show example sentences
**Example:**
```typescript
// Batch-fetch sentences for grammar patterns on current page
const patternIds = pagePatterns.map(p => p.id);
const exampleRows = await fastify.db
  .select({
    grammarPatternId: sentenceGrammarPatterns.grammarPatternId,
    sentenceId: sentences.id,
    sentenceText: sentences.text,
  })
  .from(sentenceGrammarPatterns)
  .innerJoin(sentences, eq(sentenceGrammarPatterns.sentenceId, sentences.id))
  .where(inArray(sentenceGrammarPatterns.grammarPatternId, patternIds));

// Group by pattern ID, limit to 2-3 examples per pattern in JS
```

### Anti-Patterns to Avoid
- **N+1 queries for sentences:** Do NOT fetch sentences per-item in a loop. Batch-fetch all sentences for the page's items in one query, then group in JS.
- **Filtering in JS instead of SQL:** All filters (CEFR, type, text search) must be SQL WHERE clauses, not post-fetch filtering.
- **Separate API for SRS status:** Do NOT make a second API call for SRS status. Join or subquery SRS cards in the main list query (same as vocabulary route pattern).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination | Custom offset logic | Clone vocabulary.ts page/limit/offset pattern | Already proven, handles edge cases |
| Debounced search | Raw setTimeout | Clone VocabularyFilters.vue debounce pattern (300ms) | Already working, tested UX |
| CEFR ordering | Alphabetical sort on CEFR strings | Clone cefrOrderExpr SQL CASE expression from vocabulary.ts | A1 < A2 < B1 correct ordering |
| Filter state management | Component-local state | Pinia store with reactive filters object | Consistent with existing pattern |

**Key insight:** This phase is 95% pattern replication from Phase 8's vocabulary page. The only novel parts are the specific database joins for grammar/collocation data.

## Common Pitfalls

### Pitfall 1: Phase 10 Dependency -- Collocation SRS Cards
**What goes wrong:** Implementing collocation SRS state filter before Phase 10 adds `collocation` to `cardTypeEnum` and `collocationId` to `srs_cards`.
**Why it happens:** Phase 11 depends on Phase 10 which creates collocation SRS cards.
**How to avoid:** Grammar page can filter by SRS state now (srsCards already has grammarPatternId). Collocations page SRS filter requires Phase 10's `collocationId` column in srs_cards -- Phase 10 MUST be complete before implementing collocation SRS filtering.
**Warning signs:** If `cardType = 'collocation'` does not exist in the enum, Phase 10 is not done.

### Pitfall 2: Grammar Pattern Search Field
**What goes wrong:** Searching only in `pattern` field misses patterns whose `description` matches.
**Why it happens:** Grammar patterns have both `pattern` (e.g., "would have + V3") and `description` (longer explanation).
**How to avoid:** Use `OR(ilike(pattern, search), ilike(description, search))` for text search.

### Pitfall 3: Large Example Sentence Sets
**What goes wrong:** A grammar pattern used in 50 sentences returns all 50 in the list view.
**Why it happens:** No limit on sentences fetched per item.
**How to avoid:** After batch-fetching, limit to 2-3 example sentences per item in the response. Use `LIMIT` per group or slice in JS after grouping.

### Pitfall 4: Navigation Overflow
**What goes wrong:** Adding 2 more nav links makes the header nav wrap on mobile.
**Why it happens:** Current nav has 4 items (Dashboard, Sentences, Vocabulary, Review); adding Grammar + Collocations = 6.
**How to avoid:** Consider shorter labels ("Grammar", "Collocations") and test on narrow viewports. May need a hamburger menu or compact layout, but for a personal tool this is likely acceptable.

## Code Examples

### Grammar API Response Shape
```typescript
// Types for grammar browse page
interface GrammarPatternItem {
  id: number
  pattern: string           // e.g. "would have + V3"
  description: string | null
  cefrLevel: string | null
  srsState: string | null   // aggregated from srs_cards where cardType='grammar'
  reps: number              // total review count
  exampleSentences: Array<{ id: number; text: string }>
}

interface GrammarListResponse {
  items: GrammarPatternItem[]
  total: number
  page: number
  limit: number
}
```

### Collocation API Response Shape
```typescript
// Types for collocations browse page
interface CollocationItem {
  id: number
  text: string              // e.g. "take into account"
  translation: string | null
  type: 'collocation' | 'phrasal_verb' | 'idiom'
  cefrLevel: string | null
  srsState: string | null   // from srs_cards where cardType='collocation' (Phase 10)
  exampleSentences: Array<{ id: number; text: string }>
}

interface CollocationListResponse {
  items: CollocationItem[]
  total: number
  page: number
  limit: number
}
```

### SRS State Query for Grammar Patterns
```typescript
// Source: follows vocabulary.ts srsState filter pattern
// Grammar SRS cards use grammarPatternId (not wordSenseId)
if (srsState === 'none') {
  conditions.push(
    notExists(
      fastify.db
        .select({ id: sql`1` })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.grammarPatternId, grammarPatterns.id),
            eq(srsCards.cardType, 'grammar'),
          ),
        ),
    ),
  );
} else if (srsState) {
  conditions.push(
    exists(
      fastify.db
        .select({ id: sql`1` })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.grammarPatternId, grammarPatterns.id),
            eq(srsCards.cardType, 'grammar'),
            eq(srsCards.state, srsState),
          ),
        ),
    ),
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | Phase 8 established the browse+filter pattern | Phase 8 (v1.1) | Template for all browse pages |
| Single cardType enum (vocabulary, grammar) | Phase 10 adds 'collocation' cardType | Phase 10 (upcoming) | Enables collocation SRS filtering |

**Key dependency chain:**
- Phase 10 adds `collocationId` to `srs_cards` and `'collocation'` to `cardTypeEnum`
- Phase 11 uses these to show SRS status on collocations page
- Grammar page SRS filtering works already (grammarPatternId exists on srs_cards)

## Open Questions

1. **Collocation SRS schema after Phase 10**
   - What we know: Phase 10 will add `collocationId` to srs_cards and `'collocation'` to cardTypeEnum (per CSRS-01)
   - What's unclear: Exact column name and whether it will have a foreign key constraint
   - Recommendation: Plan assumes `collocationId` integer column on srs_cards, matching grammarPatternId pattern. Verify after Phase 10 completes.

2. **Grammar reps count**
   - What we know: BROWSE-01 requires "SRS status" display. Current srs_cards has `reps` column.
   - What's unclear: Whether to show total reps or just SRS state badge
   - Recommendation: Show SRS state badge (new/learning/review) same as vocabulary, optionally show reps count. Keep it simple.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts (implied by package.json) |
| Quick run command | `npm test -- --reporter=verbose tests/grammar-api.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | GET /grammar returns patterns with CEFR, description, SRS, sentences | integration | `npm test -- tests/grammar-api.test.ts -x` | Wave 0 |
| BROWSE-02 | GET /collocations returns items with CEFR, type, translation, sentences | integration | `npm test -- tests/collocations-api.test.ts -x` | Wave 0 |
| BROWSE-03 | Both endpoints filter by CEFR, type/text search | integration | `npm test -- tests/grammar-api.test.ts tests/collocations-api.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/grammar-api.test.ts tests/collocations-api.test.ts -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `tests/grammar-api.test.ts` -- covers BROWSE-01, BROWSE-03 (grammar filters)
- [ ] `tests/collocations-api.test.ts` -- covers BROWSE-02, BROWSE-03 (collocation filters)
- Both should use `buildTestApp/cleanupTestApp` helpers from `tests/helpers/setup.ts`

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/db/schema/grammar-patterns.ts` -- grammar_patterns table schema
- Project codebase: `src/db/schema/collocations.ts` -- collocations table schema with type enum
- Project codebase: `src/db/schema/srs-cards.ts` -- srs_cards with grammarPatternId, cardType enum
- Project codebase: `src/db/relations.ts` -- all junction table relationships
- Project codebase: `src/routes/vocabulary.ts` -- complete filter/paginate/batch-fetch pattern
- Project codebase: `web/src/stores/vocabulary.ts` -- Pinia store pattern
- Project codebase: `web/src/components/vocabulary/` -- Filter, List, Detail component patterns
- Project codebase: `web/src/views/VocabularyView.vue` -- View composition pattern

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 10 description -- collocation SRS card additions (not yet implemented)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- identical to existing codebase, no new libraries
- Architecture: HIGH -- direct clone of Phase 8 vocabulary page pattern
- Pitfalls: HIGH -- identified from concrete schema analysis and Phase 10 dependency
- Phase 10 dependency details: MEDIUM -- Phase 10 not yet planned/implemented

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal project, no external dependencies changing)
