# Phase 10: Collocation SRS & Review Enhancement - Research

**Researched:** 2026-03-10
**Domain:** SRS schema extension, review UI enrichment, analysis pipeline modification
**Confidence:** HIGH

## Summary

Phase 10 extends the existing SRS system to support collocation cards and enriches grammar card review with richer context. The codebase already has well-established patterns for both vocabulary and grammar SRS cards -- collocation cards follow the exact same pattern with a new `cardType='collocation'` and a new `collocationId` column on `srs_cards`.

Three changes are needed: (1) schema migration to add `collocation` to `cardTypeEnum` and `collocationId` column to `srs_cards`, (2) auto-creation of collocation SRS cards in the analysis pipeline (mirroring grammar card creation), and (3) review route + frontend updates to handle the new card type and show richer grammar card backs.

**Primary recommendation:** Follow the exact grammar SRS card pattern -- check-then-insert dedup, same FSRS scheduling, and extend the review enrichment switch/case. The collocations route already has TODO comments marking where SRS state filtering should be added.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CSRS-01 | Collocations automatically get SRS cards when sentence is analyzed | Schema migration (add `collocation` to cardTypeEnum, add `collocationId` to srs_cards) + analysis.ts extension following grammar card pattern |
| CSRS-02 | Collocation cards appear in /review with front=collocation+context, back=translation+type | Review route enrichment (new case in GET /review/due) + ReviewCard.vue new template section + DueCard type extension |
| CSRS-03 | Grammar cards show pattern description and example sentence on back side | Review route modification (fetch description + sentence via sentenceGrammarPatterns) + ReviewCard.vue grammar back enhancement |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Schema definition, queries, migrations | Already used for all DB access |
| drizzle-kit | existing | Migration generation (`npm run db:generate`) | Project standard for schema changes |
| ts-fsrs | existing | FSRS algorithm for SRS scheduling | Already integrated in src/services/srs.ts |
| Vue 3 + Pinia | existing | Frontend components and state | Already used for review UI |
| Fastify | existing | API routes | Already used for review endpoint |

### No New Dependencies Required

This phase requires zero new libraries. All changes extend existing patterns.

## Architecture Patterns

### Schema Extension Pattern

The `srs_cards` table uses a polymorphic FK pattern:
- `wordSenseId` for vocabulary cards
- `grammarPatternId` for grammar cards
- `collocationId` (new) for collocation cards

The `cardTypeEnum` must be extended from `['vocabulary', 'grammar']` to `['vocabulary', 'grammar', 'collocation']`.

**Migration approach:**
```sql
-- Add 'collocation' to card_type enum
ALTER TYPE card_type ADD VALUE 'collocation';

-- Add collocationId column
ALTER TABLE srs_cards ADD COLUMN collocation_id INTEGER REFERENCES collocations(id);
```

Note: Drizzle Kit generates migrations via `npm run db:generate` after modifying the schema file.

### Analysis Pipeline Pattern (CSRS-01)

Grammar SRS card creation in `src/services/analysis.ts` (lines 204-234) follows:
1. Upsert entity (grammar pattern)
2. Link to sentence (sentenceGrammarPatterns)
3. Check-then-insert SRS card (idempotent)

Collocation card creation should follow identically:
```typescript
// After upserting collocation and linking to sentence (already done, lines 147-173)
// Add: Auto-create SRS card for collocation (idempotent - check first)
const [existingCollCard] = await db
  .select({ id: srsCards.id })
  .from(srsCards)
  .where(
    and(
      eq(srsCards.cardType, 'collocation'),
      eq(srsCards.collocationId, upsertedCollocation.id),
    ),
  )
  .limit(1);

if (!existingCollCard) {
  const emptyCard = createEmptyCard();
  await db.insert(srsCards).values({
    cardType: 'collocation',
    collocationId: upsertedCollocation.id,
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

### Review Route Enrichment Pattern (CSRS-02)

The `GET /review/due` route (src/routes/review.ts) has a switch on `card.cardType`:
- `vocabulary` -> fetches word sense, word, sentence
- `grammar` -> fetches pattern, exercise

Add a third case for `collocation`:
- Fetch collocation text, translation, type from `collocations` table
- Fetch context sentence via `sentenceCollocations` join

### Grammar Card Back Enhancement (CSRS-03)

Currently grammar cards show:
- Front: cloze sentence (if exercise exists) or pattern title (if no exercise)
- Back: just the cloze answer

CSRS-03 requires the back to also show:
- Pattern description (`grammarPatterns.description`)
- An example sentence from the user's texts (via `sentenceGrammarPatterns` -> `sentences`)

The `pattern` object is already fetched in the review route (lines 57-64) and includes `description`. The example sentence needs to be added -- fetch one via `sentenceGrammarPatterns` JOIN `sentences`.

### Files That Need Changes

**Backend:**
1. `src/db/schema/srs-cards.ts` -- add `'collocation'` to cardTypeEnum, add `collocationId` column
2. `src/db/relations.ts` -- add collocation relation to srsCards, add srsCards relation to collocations
3. `src/services/srs.ts` -- extend `CardType` union type with `'collocation'`, extend `createSrsCard` opts
4. `src/services/analysis.ts` -- add collocation SRS card creation after collocation upsert
5. `src/routes/review.ts` -- add `collocation` case in GET /review/due enrichment, add example sentence to grammar enrichment
6. `src/routes/collocations.ts` -- enable SRS state filtering (TODO already marked)

**Frontend:**
7. `web/src/types/api.ts` -- extend DueCard type with `collocation` cardType and collocation fields
8. `web/src/components/review/ReviewCard.vue` -- add collocation card template, enhance grammar card back
9. `web/src/views/ReviewView.vue` -- handle collocation card reveal logic (if different)

**Bot:**
10. `src/bot/services/api-client.ts` -- extend DueCard type with `'collocation'`
11. `src/bot/handlers/review.ts` -- add formatCardFront/formatCardReveal for collocation cards

**Dashboard:**
12. `src/routes/dashboard.ts` -- decide if collocations appear in existing stats or get their own category

**Migration:**
13. New Drizzle migration file via `npm run db:generate`

### Anti-Patterns to Avoid
- **Adding a unique constraint on collocationId in srs_cards:** The project uses check-then-insert pattern (Phase 7 decision), not unique constraints, for SRS card dedup
- **CEFR filtering for collocations:** Unlike vocabulary (which uses B1+ threshold via `shouldAutoAddWord`), collocations should ALL get SRS cards -- they are already curated by AI extraction
- **Separate review queue for collocations:** All card types share the same SRS queue, ordered by due date

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRS scheduling | Custom interval logic | `ts-fsrs` via existing `rateCard()` | Already integrated, handles all state transitions |
| Card dedup | Unique constraints | Check-then-insert pattern (see Phase 7 decision) | Project convention, already established |
| Enum migration | Manual SQL | `drizzle-kit generate` | Handles enum extension automatically |

## Common Pitfalls

### Pitfall 1: Enum Extension in PostgreSQL
**What goes wrong:** PostgreSQL enums cannot be modified in a transaction in some cases. `ALTER TYPE ... ADD VALUE` cannot be rolled back.
**Why it happens:** PG enum extension is not transactional.
**How to avoid:** Drizzle Kit handles this correctly in generated migrations. Run migration outside a transaction if needed.
**Warning signs:** Migration fails with "cannot be executed in a transaction block".

### Pitfall 2: Dashboard Stats Category Mapping
**What goes wrong:** The dashboard currently maps cardType to categories: `vocabulary -> 'words'`, everything else implicitly `'grammar'`. Adding `'collocation'` would incorrectly count collocation cards as grammar.
**Why it happens:** Line 41 in dashboard.ts: `const category = row.cardType === 'vocabulary' ? 'words' : 'grammar'`
**How to avoid:** Update the mapping to handle three categories, or add a separate collocations counter.
**Warning signs:** Grammar stats showing inflated numbers after collocations are added.

### Pitfall 3: Bot DueCard Type Out of Sync
**What goes wrong:** The bot has its own `DueCard` interface in `src/bot/services/api-client.ts` (line 94-103) separate from the web frontend type. Forgetting to update it causes TypeScript errors or silent failures.
**Why it happens:** Two separate type definitions for the same API response.
**How to avoid:** Update both `web/src/types/api.ts` and `src/bot/services/api-client.ts` DueCard interfaces.

### Pitfall 4: Grammar Card Exercise-less Path
**What goes wrong:** Grammar cards without exercises skip reveal (show pattern title + immediate rating). The enhanced back (with description + example sentence) needs to handle both paths.
**Why it happens:** ReviewView.vue line 29-35 has special logic: `shouldShowRating()` returns true immediately for grammar cards without exercises.
**How to avoid:** Ensure the enhanced grammar card back shows description+example regardless of whether an exercise exists.

### Pitfall 5: Collocation Card Reveal Flow
**What goes wrong:** Collocation cards need a reveal step (show collocation text -> reveal translation). Without proper handling in ReviewView.vue, they might skip reveal or show rating prematurely.
**Why it happens:** The `shouldShowRating()` function only knows about 'vocabulary' and 'grammar'. Collocation cards need standard reveal behavior like vocabulary.
**How to avoid:** Collocation cards follow vocabulary pattern: always require reveal before rating.

## Code Examples

### Schema Extension
```typescript
// src/db/schema/srs-cards.ts
export const cardTypeEnum = pgEnum('card_type', [
  'vocabulary',
  'grammar',
  'collocation',  // NEW
]);

export const srsCards = pgTable('srs_cards', {
  // ... existing columns ...
  collocationId: integer('collocation_id').references(() => collocations.id),  // NEW
});
```

### Review Route - Collocation Enrichment
```typescript
// New case in GET /review/due enrichment
if (card.cardType === 'collocation' && card.collocationId) {
  const [collData] = await fastify.db
    .select({
      text: collocations.text,
      translation: collocations.translation,
      type: collocations.type,
      cefrLevel: collocations.cefrLevel,
    })
    .from(collocations)
    .where(eq(collocations.id, card.collocationId))
    .limit(1);

  // Fetch context sentence
  const [sentenceRow] = await fastify.db
    .select({ text: sentences.text })
    .from(sentenceCollocations)
    .innerJoin(sentences, eq(sentenceCollocations.sentenceId, sentences.id))
    .where(eq(sentenceCollocations.collocationId, card.collocationId))
    .limit(1);

  return {
    ...base,
    collocation: collData ?? undefined,
    sentence: sentenceRow?.text ?? undefined,
  };
}
```

### Review Route - Grammar Card Enhancement (CSRS-03)
```typescript
// Add example sentence to grammar enrichment (after existing pattern fetch)
const [exampleRow] = await fastify.db
  .select({ text: sentences.text })
  .from(sentenceGrammarPatterns)
  .innerJoin(sentences, eq(sentenceGrammarPatterns.sentenceId, sentences.id))
  .where(eq(sentenceGrammarPatterns.grammarPatternId, card.grammarPatternId))
  .limit(1);

return {
  ...base,
  pattern: patternData ?? undefined,
  exercise: exercise ?? undefined,
  exampleSentence: exampleRow?.text ?? undefined,  // NEW for CSRS-03
};
```

### DueCard Type Extension
```typescript
// web/src/types/api.ts
export interface DueCard {
  cardId: number
  cardType: 'vocabulary' | 'grammar' | 'collocation'  // EXTENDED
  state: string
  due: string
  word?: { ... }
  sentence?: string
  pattern?: { pattern: string; description: string }
  exercise?: { ... }
  exampleSentence?: string  // NEW for CSRS-03
  collocation?: {           // NEW for CSRS-02
    text: string
    translation: string | null
    type: 'collocation' | 'phrasal_verb' | 'idiom'
    cefrLevel: string | null
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Grammar + Vocabulary only | + Collocation card type | Phase 10 | Third SRS card type, shared queue |
| Grammar back: answer only | + description + example sentence | Phase 10 | Richer context for grammar review |

## Open Questions

1. **Dashboard stats: separate collocations category or group with grammar?**
   - What we know: Dashboard currently has `words` and `grammar` categories
   - What's unclear: Should collocations get their own category (requires frontend ProgressStats type change) or be grouped under a broader label?
   - Recommendation: Add a third `collocations` counter in dashboard stats. It's a small change and provides clearer tracking.

2. **Should collocation cards be filtered by CEFR like vocabulary?**
   - What we know: Vocabulary uses B1+ threshold. Grammar creates cards for all patterns.
   - What's unclear: Should collocations follow vocabulary (filter) or grammar (all) pattern?
   - Recommendation: Create cards for ALL collocations (like grammar). They're already curated by AI extraction from user sentences, so CEFR filtering would be overly restrictive.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CSRS-01 | Collocation SRS cards created during analysis | integration | `npx vitest run tests/collocation-srs.test.ts -x` | No - Wave 0 |
| CSRS-02 | Collocation cards returned with enriched data in /review/due | integration | `npx vitest run tests/collocation-review.test.ts -x` | No - Wave 0 |
| CSRS-03 | Grammar cards include description + example sentence | integration | `npx vitest run tests/grammar-review-enhanced.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `tests/collocation-srs.test.ts` -- covers CSRS-01 (collocation card auto-creation in analysis)
- [ ] `tests/collocation-review.test.ts` -- covers CSRS-02 (collocation card enrichment in review)
- [ ] `tests/grammar-review-enhanced.test.ts` -- covers CSRS-03 (grammar card back enhancement)
- Note: Tests require running PostgreSQL and Redis (`docker compose up -d postgres redis`). Uses existing `buildTestApp/cleanupTestApp` helpers.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all affected files (schema, routes, services, components)
- Existing patterns from grammar SRS card implementation in `src/services/analysis.ts`
- Phase 11 collocation route TODO comments explicitly referencing Phase 10 requirements

### Secondary (MEDIUM confidence)
- PostgreSQL documentation on ALTER TYPE ADD VALUE behavior (enum extension not transactional)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns established in codebase
- Architecture: HIGH - directly follows existing grammar SRS card pattern
- Pitfalls: HIGH - identified from direct code analysis of dashboard, bot, and review components

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal project patterns, no external dependency changes)
