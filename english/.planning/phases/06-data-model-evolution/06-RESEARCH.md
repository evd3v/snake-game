# Phase 6: Data Model Evolution - Research

**Researched:** 2026-03-10
**Domain:** PostgreSQL schema migration, Drizzle ORM, data model refactoring
**Confidence:** HIGH

## Summary

Phase 6 requires introducing a `word_senses` table to support multiple parts of speech per lemma. Currently, `words` has a `UNIQUE(lemma)` constraint and SRS cards reference `words.word_id` directly. The new model must allow "run" as both verb and noun with separate translations and independent SRS tracking per sense.

The migration is straightforward but requires careful sequencing: create new table, migrate existing data, re-point SRS card foreign keys from `words.word_id` to `word_senses.id`, update the analysis pipeline's upsert logic to use composite `(lemma, partOfSpeech)` uniqueness, and update all query sites that join `srs_cards` to `words`.

**Primary recommendation:** Use a custom SQL migration (not `drizzle-kit push`) to handle data migration atomically in a single transaction. Create `word_senses` table, populate from existing `words` data, add `word_sense_id` to `srs_cards`, backfill it, then drop `words.word_id` from `srs_cards`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Words stored with POS via word_senses table -- one lemma can have multiple senses with different translations | New `word_senses` table with composite unique on (word_id, part_of_speech), analysis pipeline upsert changes |
| DATA-02 | SRS cards linked to word_sense (not word), each sense learns independently | Re-point `srs_cards.word_id` to `srs_cards.word_sense_id`, update all review/dashboard queries |
| DATA-03 | Migration of existing data -- existing words get a sense derived from current POS/translation | Custom SQL migration that creates senses from existing words data using their stored translation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | ORM + schema definition | Already in use, schema-first approach |
| drizzle-kit | ^0.31.9 | Migration generation | Already in use for `db:generate` and `db:migrate` |
| pg | ^8.20.0 | PostgreSQL driver | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ts-fsrs | ^5.2.3 | SRS scheduling | No changes needed -- SRS logic unchanged, only FK target changes |
| wink-lemmatizer | ^3.0.4 | Lemma normalization | Used in analysis pipeline, no changes needed |

### No New Dependencies
This phase requires zero new packages. All changes are schema + service layer modifications using existing tools.

## Architecture Patterns

### Current Schema (Before)
```
words (id, lemma UNIQUE, translation, cefrLevel, familiarity, thematicCluster, wordFamilyId)
  |
  +-- srs_cards (word_id -> words.id)
  +-- sentence_words (word_id -> words.id)
```

### Target Schema (After)
```
words (id, lemma UNIQUE, cefrLevel, thematicCluster, wordFamilyId)
  |
  +-- word_senses (id, word_id -> words.id, partOfSpeech, translation, familiarity)
  |     UNIQUE(word_id, part_of_speech)
  |     |
  |     +-- srs_cards (word_sense_id -> word_senses.id)
  |
  +-- sentence_words (word_id -> words.id)  -- unchanged
```

### Key Design Decisions

**1. Keep `words` table, add `word_senses` as child:**
- `words` remains the lemma-level entity (unique lemma, cefrLevel, thematicCluster, wordFamilyId)
- `word_senses` holds POS-specific data (translation, familiarity, partOfSpeech)
- This preserves the sentence_words linkage and word_family linkage unchanged

**2. Move `translation` and `familiarity` from `words` to `word_senses`:**
- Translation differs per POS ("run" verb = "бежать", "run" noun = "забег")
- Familiarity is per-sense: you might know "run" as verb but not as noun
- `cefrLevel` stays on `words` (CEFR is lemma-level, not sense-level) OR could be on sense -- but keeping on words is simpler and sufficient

**3. Composite unique constraint on `(word_id, part_of_speech)`:**
- Prevents duplicate senses for same word+POS
- Enables `onConflictDoUpdate` in the analysis pipeline

**4. `srs_cards` re-pointed to `word_sense_id`:**
- Drop `word_id` column from `srs_cards` (for vocabulary cards)
- Add `word_sense_id` column referencing `word_senses.id`
- Grammar cards remain unchanged (they reference `grammar_pattern_id`)

### New Schema File: `src/db/schema/word-senses.ts`
```typescript
import { pgTable, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { words, familiarityEnum } from './words.ts';

export const wordSenses = pgTable('word_senses', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  wordId: integer('word_id').notNull().references(() => words.id),
  partOfSpeech: text('part_of_speech').notNull(),
  translation: text(),
  familiarity: familiarityEnum().default('never_seen'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.wordId, t.partOfSpeech),
]);
```

### Updated `srs_cards` Schema
```typescript
// Add word_sense_id, remove word_id (for vocabulary cards)
export const srsCards = pgTable('srs_cards', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cardType: cardTypeEnum('card_type').notNull(),
  wordSenseId: integer('word_sense_id'),  // NEW: replaces word_id for vocabulary
  grammarPatternId: integer('grammar_pattern_id'),
  // ... rest unchanged
});
```

### Updated Relations
```typescript
export const wordSensesRelations = relations(wordSenses, ({ one, many }) => ({
  word: one(words, {
    fields: [wordSenses.wordId],
    references: [words.id],
  }),
  srsCards: many(srsCards),
}));

export const srsCardsRelations = relations(srsCards, ({ one }) => ({
  wordSense: one(wordSenses, {
    fields: [srsCards.wordSenseId],
    references: [wordSenses.id],
  }),
  grammarPattern: one(grammarPatterns, {
    fields: [srsCards.grammarPatternId],
    references: [grammarPatterns.id],
  }),
}));
```

### Updated Analysis Pipeline (`storeAnalysisResults`)
```typescript
// Current: upsert on words.lemma unique
// New: upsert word on lemma, then upsert word_sense on (word_id, part_of_speech)

const [upsertedWord] = await db
  .insert(words)
  .values({
    lemma: normalizedLemma,
    cefrLevel: vocab.cefrLevel,
    thematicCluster: vocab.thematicCluster,
  })
  .onConflictDoUpdate({
    target: words.lemma,
    set: { thematicCluster: vocab.thematicCluster },
  })
  .returning({ id: words.id });

const [upsertedSense] = await db
  .insert(wordSenses)
  .values({
    wordId: upsertedWord.id,
    partOfSpeech: vocab.partOfSpeech,
    translation: vocab.translation,
  })
  .onConflictDoUpdate({
    target: [wordSenses.wordId, wordSenses.partOfSpeech],
    set: { translation: vocab.translation },
  })
  .returning({ id: wordSenses.id });
```

### Anti-Patterns to Avoid
- **Don't store POS on the words table itself:** This would still make it one-POS-per-word, defeating the purpose
- **Don't remove `word_id` from `srs_cards` without backfilling `word_sense_id` first:** Would orphan existing vocabulary cards
- **Don't use `drizzle-kit push` for data migration:** Push only syncs schema, it cannot move data between tables

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration execution | Custom migration runner | `drizzle-kit migrate` with custom SQL file | Drizzle tracks applied migrations via journal |
| Composite unique constraints | Raw SQL constraints | Drizzle's `unique().on(col1, col2)` | Type-safe, auto-generates migration |
| Data backfill | Manual INSERT scripts | Single SQL migration with INSERT...SELECT | Atomic, runs in transaction |

## Common Pitfalls

### Pitfall 1: Adverb Lemmatization POS Collision
**What goes wrong:** `normalizeLemma("quickly", "adverb")` returns `"quick"` (adjective root). If the word "quick" also appears as an adjective, both would map to lemma "quick" in words table. Then creating senses for "quick" + "adverb" and "quick" + "adjective" would work, but the POS stored in word_senses for the adverb case is "adverb" while the underlying lemma was collapsed.
**Why it happens:** The lemmatizer intentionally collapses adverbs to adjective roots (see `lemmatizer.ts` line 7).
**How to avoid:** This is actually fine for the new schema. The `word_senses` table uses `(word_id, part_of_speech)` composite unique. The adverb "quickly" maps to lemma "quick" with POS "adverb", while "quick" the adjective maps to lemma "quick" with POS "adjective". Two different senses, no collision. The STATE.md concern is resolved by the new schema design.
**Warning signs:** None -- this is a non-issue with the new model.

### Pitfall 2: Existing SRS Cards Without POS Data
**What goes wrong:** Existing `srs_cards` rows have `word_id` but no POS information. During migration, we need to create a `word_sense` for each existing word and link the SRS card to it.
**Why it happens:** The current schema doesn't store POS on the word itself.
**How to avoid:** During data migration, create one sense per existing word using a default POS. Since the AI analysis schema always provides `partOfSpeech`, the issue is that we didn't store it. Options:
  1. Use `'unknown'` as default POS for migrated senses (simplest, but inaccurate)
  2. Infer POS from the lemma using wink-lemmatizer heuristics (unreliable)
  3. Accept that migrated words get a single sense with POS `'unknown'` and will get proper POS senses on re-encounter
**Recommendation:** Use `'unknown'` as fallback POS for migration. When the word is re-encountered through analysis, a new sense with the correct POS will be created. The old `'unknown'` sense can be cleaned up later or left as-is.

### Pitfall 3: Breaking Dashboard Raw SQL Queries
**What goes wrong:** The dashboard uses raw SQL (`sql` tagged templates) that directly reference `srs_cards.word_id` and join to `words`. After migration, these must join through `word_senses`.
**Why it happens:** Raw SQL queries bypass Drizzle's relation system and hardcode column names.
**How to avoid:** Update all raw SQL queries in `dashboard.ts` to join `srs_cards -> word_senses -> words`. There are 4 queries to update: stats, weak-spots, activity, clusters.

### Pitfall 4: Review Route Enrichment Queries
**What goes wrong:** `GET /review/due` enriches vocabulary cards by joining `words` via `srs_cards.word_id`. After migration, it must join via `word_senses`.
**Why it happens:** The review route builds card display data using word data.
**How to avoid:** Update the query to: `srs_cards -> word_senses -> words` and also include `word_senses.translation` and `word_senses.partOfSpeech` in the response.

### Pitfall 5: Bot API Client DueCard Type
**What goes wrong:** The `DueCard` interface in `api-client.ts` has `word?: { lemma, translation, cefrLevel }`. After migration, translation comes from `word_senses`, not `words`.
**Why it happens:** The type was built for the old schema.
**How to avoid:** Update the API response shape to include POS info and source translation from word_sense. Update `DueCard` type to match.

## Code Examples

### Migration SQL (Custom Migration File)
```sql
-- 1. Create word_senses table
CREATE TABLE "word_senses" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "word_id" integer NOT NULL REFERENCES "words"("id"),
  "part_of_speech" text NOT NULL,
  "translation" text,
  "familiarity" "familiarity" DEFAULT 'never_seen',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "word_senses_word_id_part_of_speech_unique" UNIQUE("word_id", "part_of_speech")
);

-- 2. Migrate existing words to word_senses
INSERT INTO "word_senses" ("word_id", "part_of_speech", "translation", "familiarity")
SELECT "id", 'unknown', "translation", "familiarity"
FROM "words";

-- 3. Add word_sense_id to srs_cards
ALTER TABLE "srs_cards" ADD COLUMN "word_sense_id" integer REFERENCES "word_senses"("id");

-- 4. Backfill word_sense_id from word_id
UPDATE "srs_cards" sc
SET "word_sense_id" = ws.id
FROM "word_senses" ws
WHERE sc."word_id" = ws."word_id"
  AND sc."card_type" = 'vocabulary';

-- 5. Drop old word_id column from srs_cards
ALTER TABLE "srs_cards" DROP COLUMN "word_id";

-- 6. Drop translation and familiarity from words (now on word_senses)
ALTER TABLE "words" DROP COLUMN "translation";
ALTER TABLE "words" DROP COLUMN "familiarity";
```

### Migration Strategy: Drizzle Custom Migration
```bash
# 1. Update schema files first (word-senses.ts, words.ts, srs-cards.ts)
# 2. Generate migration
npm run db:generate
# 3. The generated SQL won't include data migration -- edit the generated .sql file
#    to add INSERT...SELECT and UPDATE statements between the schema changes
# 4. Run migration
npm run db:migrate
```

**Alternative (safer):** Write the migration SQL manually in a new file under `drizzle/`, update `drizzle/meta/_journal.json` to include it, and run `npm run db:migrate`. This gives full control over ordering.

### Updated Analysis Pipeline Upsert
```typescript
// In storeAnalysisResults, replace the word upsert block:
for (let i = 0; i < analysis.vocabulary.length; i++) {
  const vocab = analysis.vocabulary[i];
  const normalizedLemma = normalizeLemma(vocab.lemma, vocab.partOfSpeech);

  // Upsert word (lemma-level)
  const [upsertedWord] = await db
    .insert(words)
    .values({
      lemma: normalizedLemma,
      cefrLevel: vocab.cefrLevel,
      thematicCluster: vocab.thematicCluster,
    })
    .onConflictDoUpdate({
      target: words.lemma,
      set: { thematicCluster: vocab.thematicCluster },
    })
    .returning({ id: words.id });

  // Upsert word sense (POS-level)
  const [upsertedSense] = await db
    .insert(wordSenses)
    .values({
      wordId: upsertedWord.id,
      partOfSpeech: vocab.partOfSpeech,
      translation: vocab.translation,
    })
    .onConflictDoUpdate({
      target: [wordSenses.wordId, wordSenses.partOfSpeech],
      set: { translation: vocab.translation },
    })
    .returning({ id: wordSenses.id });

  insertedWordsMap.set(normalizedLemma, upsertedWord.id);
  wordsInserted++;

  // Link sentence-words (still word-level)
  await db.insert(sentenceWords).values({
    sentenceId,
    wordId: upsertedWord.id,
    position: i,
  }).onConflictDoNothing();
}
```

## Files That Need Changes

### Schema Files
| File | Change |
|------|--------|
| `src/db/schema/word-senses.ts` | **NEW** -- wordSenses table definition |
| `src/db/schema/words.ts` | Remove `translation`, `familiarity` columns |
| `src/db/schema/srs-cards.ts` | Replace `wordId` with `wordSenseId` |
| `src/db/schema/index.ts` | Export wordSenses |
| `src/db/relations.ts` | Add wordSenses relations, update srsCards relations |

### Service Files
| File | Change |
|------|--------|
| `src/services/analysis.ts` | Two-step upsert (word then word_sense) |
| `src/services/srs.ts` | `createSrsCard` takes `wordSenseId` instead of `wordId` |

### Route Files
| File | Change |
|------|--------|
| `src/routes/review.ts` | Join through word_senses for vocabulary card enrichment; update create-srs-card endpoint |
| `src/routes/words.ts` | Join word_senses for translation/familiarity; update familiarity PATCH |
| `src/routes/dashboard.ts` | Update all 4 raw SQL queries to join through word_senses |

### Bot Files
| File | Change |
|------|--------|
| `src/bot/services/api-client.ts` | Update `WordInfo` and `DueCard` types to include partOfSpeech |
| `src/bot/handlers/vocabulary.ts` | May need updates if it references word translation directly |
| `src/bot/format.ts` | May need to display POS in formatted output |

### Test Files
| File | Change |
|------|--------|
| `tests/db.test.ts` | Add `word_senses` to expected tables list |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One word = one lemma = one translation | One word = one lemma = multiple senses by POS | This phase | Enables proper polysemy handling |
| SRS card -> word | SRS card -> word_sense | This phase | Independent review per POS |
| Unique on lemma only | Unique on lemma (words) + unique on (word_id, POS) (word_senses) | This phase | No constraint violations for multi-POS words |

## Open Questions

1. **Default POS for migrated data**
   - What we know: Existing words have no stored POS. We need a value for migration.
   - What's unclear: Whether `'unknown'` is acceptable or if we should try to infer POS.
   - Recommendation: Use `'unknown'`. It's honest and avoids incorrect guesses. Words will get proper POS senses naturally when re-encountered through analysis. The `'unknown'` senses can optionally be cleaned up later.

2. **Should cefrLevel move to word_senses too?**
   - What we know: CEFR level could differ by POS (e.g., "run" as noun might be more advanced than as verb).
   - What's unclear: Whether this granularity matters for a personal learning app.
   - Recommendation: Keep `cefrLevel` on `words` for simplicity. The AI typically assigns CEFR at word level, and having it per-sense adds complexity without clear benefit for a single-user app. Can be moved later if needed.

3. **Handling re-encountered words with 'unknown' POS sense**
   - What we know: When "run" is encountered as verb, a new sense `(word_id, "verb")` is created alongside the existing `(word_id, "unknown")` sense.
   - What's unclear: Should the `'unknown'` sense's SRS progress be transferred to the first real POS sense?
   - Recommendation: No automatic transfer. The `'unknown'` sense keeps its SRS state. The user may naturally stop seeing it as it ages. This avoids complex merge logic.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Word with multiple POS creates separate senses without constraint violation | integration | `npm test -- tests/word-senses.test.ts` | No -- Wave 0 |
| DATA-02 | SRS cards linked to word_sense, reviewing one sense does not affect another | integration | `npm test -- tests/word-senses.test.ts` | No -- Wave 0 |
| DATA-03 | Migration creates senses from existing words data | integration | `npm test -- tests/db.test.ts` | Partially (db.test.ts exists, needs new assertions) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/word-senses.test.ts` -- covers DATA-01, DATA-02: multi-POS insertion, independent SRS per sense
- [ ] Update `tests/db.test.ts` -- add `word_senses` to expected tables list (DATA-03)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: schema files, service files, route files, bot handlers
- Drizzle ORM v0.45.1 -- composite unique constraint syntax verified from existing codebase patterns (see `grammarPatterns` unique, `sentenceWords` composite PK)
- PostgreSQL -- standard ALTER TABLE, INSERT...SELECT, UPDATE...FROM syntax

### Secondary (MEDIUM confidence)
- Drizzle-kit migration workflow -- based on existing migration files in `drizzle/` and `drizzle.config.ts`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, using existing tools
- Architecture: HIGH - straightforward relational modeling, verified against current schema
- Pitfalls: HIGH - identified from direct code inspection of all affected files
- Migration strategy: MEDIUM - drizzle-kit custom migration editing is less documented but follows standard SQL migration patterns

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, no fast-moving dependencies)
