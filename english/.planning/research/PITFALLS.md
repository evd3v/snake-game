# Domain Pitfalls: v1.1 Feature Addition

**Domain:** Adding vocabulary management UI, web SRS review, multiple POS/translations, Telegram auto-add, and collocations visibility to existing language learning app
**Researched:** 2026-03-10
**Scope:** Pitfalls specific to ADDING these features to the existing codebase (not general app pitfalls)

## Critical Pitfalls

Mistakes that cause data corruption, rewrites, or major regressions.

### Pitfall 1: Unique Lemma Constraint Blocks Multiple POS

**What goes wrong:** The `words` table has `UNIQUE("lemma")` (line 83 of genesis migration). The word "run" as a noun and "run" as a verb cannot coexist. Adding multi-POS support requires changing this fundamental constraint, which ripples through every piece of code that touches words.

**Why it happens:** The original schema assumed one word = one lemma. This is baked into:
- `analysis.ts`: `onConflictDoUpdate({ target: words.lemma })` -- upsert assumes lemma is the identity
- `sentence_words`: composite PK `(sentence_id, word_id)` -- if a word appears as both noun and verb in one sentence, the same `word_id` is used
- `srs_cards.wordId`: references the unified word row. Splitting a word into senses means deciding which SRS card belongs to which sense
- `normalizeLemma()`: collapses adverbs to adjective form (`normalizeLemma('quickly', 'adverb')` returns `'quick'`), so the adverb "quick" collides with the adjective "quick"

**Consequences:**
- Naive migration (add `pos` column, change unique to `(lemma, pos)`) without backfilling `pos` on existing rows creates a `(lemma, NULL)` uniqueness that still collapses senses
- Existing `srs_cards` linked by `wordId` become ambiguous if word rows are split
- The `onConflictDoUpdate` target must change from `words.lemma` to `[words.lemma, words.pos]`, or all upserts break
- Existing data where "run" has only one row with translation "бежать" loses the noun meaning "забег" permanently

**Prevention:**
1. Add `pos` column as nullable, backfill existing words using stored `partOfSpeech` from AI analysis (re-extract from sentence_words contexts if needed)
2. Change unique constraint to `(lemma, pos)` only AFTER backfill is complete
3. Fix `normalizeLemma()` to preserve adverbs as distinct lemmas -- stop collapsing to adjective root
4. Update `onConflictDoUpdate` target to composite key
5. Keep existing `srs_cards` linked to existing word IDs -- do NOT split/delete existing word rows. Only create new rows for genuinely new POS encounters going forward
6. For translations: use a `word_translations` table or jsonb array rather than overwriting the single text field

**Detection:** Insert a sentence containing "run" as a verb when "run" as a noun already exists. If it silently overwrites the translation, the bug is present.

**Phase to address:** FIRST -- before any UI work. Schema migration must be the foundation.

---

### Pitfall 2: SRS State Conflict Between Web and Telegram Reviews

**What goes wrong:** Both Telegram bot and web app call the same `rateCard()` on the same `srs_cards` rows. The Telegram bot pre-fetches 20 cards into an in-memory `reviewSessions` Map at session start. If the user then reviews some of those cards on the web, the Telegram session holds stale card state. Rating the card again in Telegram calls `rateCard()` which reads current DB state -- but the Telegram UI still shows a card that was already reviewed, leading to a double-review.

**Why it happens:** `reviewSessions` in `bot/handlers/review.ts` is `new Map<number, ReviewSession>()` -- purely in-memory, populated once at `/review` command. There is no staleness check. The `rateCard()` function in `services/srs.ts` always reads current DB state before computing FSRS, so the scheduling math is correct, but the user reviews a card they already reviewed, which wastes time and distorts the review log.

**Consequences:**
- `review_logs` accumulates duplicate reviews (same card rated twice in quick succession)
- User reviews 10 cards on web, starts Telegram `/review`, gets shown the same 10 cards they just did (they're no longer "due" in DB but the Telegram session has a cached list)
- FSRS stability gets boosted by double-reviewing, making intervals too long

**Prevention:**
1. Add a `source` column to `review_logs` (`'web' | 'telegram'`) for debugging
2. Web review: fetch one card at a time (stateless). After rating, fetch the next due card from API. No client-side batch caching
3. Telegram: keep the batch approach (fine for chat UI) but add a guard in the rate handler -- before calling `rateCard()`, re-check if `srs_cards.lastReview` is newer than session start time. If yes, skip with "Already reviewed" message and advance to next card
4. Alternative: share a "last fetched at" timestamp, pass it to `rateCard()` as an optimistic lock

**Detection:** Start `/review` in Telegram, rate 2 cards on web, then try to rate those same cards in Telegram. If Telegram lets you rate them without skipping, the bug is present.

**Phase to address:** Web review implementation phase.

---

### Pitfall 3: Removing Familiarity Flow Floods Review Queue

**What goes wrong:** Currently, SRS cards are created only when user manually selects words and sets familiarity in Telegram. The v1.1 plan calls for "auto-add words without manual familiarity selection." If every word from every analyzed sentence automatically gets an SRS card, the review queue explodes with common words the user already knows (articles are skipped, but words like "go", "make", "time" at A1 level will flood in).

**Why it happens:** The current flow is a deliberate filter: user picks which words matter -> sets familiarity -> SRS card created. Auto-add removes this filter entirely.

**Consequences:**
- User enters 10 sentences, gets 50+ new SRS cards including basic words they know perfectly
- Review sessions become tedious, filled with "Easy" taps on known words
- The `familiarity` column becomes dead weight (all new words are `never_seen` forever since no one sets it)
- Vocabulary page filters by familiarity become misleading (old words have it, new ones don't)

**Prevention:**
1. Auto-add with CEFR filtering: only create SRS cards for words at or above user's current level. User is B1-B2, so auto-create cards for B2+ words. A1-B1 words get added to vocabulary but NOT to SRS
2. Add a "known words" mechanism: let user mark words as "known" (no more reviews). Provide a one-time bulk-mark for common words (top 3000 frequency list)
3. Replace `familiarity` enum with SRS-derived status: if word has SRS card -> its `state` (new/learning/review) IS the familiarity. If word has no SRS card -> it's either "known" or "not tracked"
4. Keep backward compatibility: existing words with `familiarity` set retain their values for display, but new code reads SRS card state instead

**Detection:** Enable auto-add, enter 5 sentences from a simple text. Count new SRS cards created. If >30, the filtering is insufficient.

**Phase to address:** Auto-add implementation, BEFORE vocabulary page (so the page never depends on stale familiarity data).

---

## Moderate Pitfalls

### Pitfall 4: Vocabulary Page N+1 Query Performance

**What goes wrong:** The current API has no endpoint for "all words with their metadata." The existing `/sentences/:sentenceId/words` fetches words per sentence. A vocabulary page showing all words with SRS status, sentence contexts, collocations, CEFR level, and thematic clusters needs joins across 5+ tables. A naive implementation: fetch words -> loop to fetch SRS status -> loop to fetch sentences -> loop to fetch collocations.

**Prevention:**
- Build a dedicated `/vocabulary` endpoint with a single paginated query using LEFT JOINs for SRS card state, sentence count, and latest sentence text
- Use cursor-based pagination (by `words.id` or `words.createdAt`) since words are continuously added -- offset pagination drifts as new words are inserted
- Add index on `sentence_words(word_id)` for reverse lookup (currently only used in the `sentence_id` direction)
- Consider a materialized/cached aggregate: sentence count per word, last review date, next due date

**Detection:** Load vocabulary page with 500+ words. If page load takes >500ms, the query needs optimization.

---

### Pitfall 5: Duplicate SRS Cards From Missing Unique Constraint

**What goes wrong:** `srs_cards` has NO unique constraint on `(card_type, word_id)`. The `createSrsCard()` function uses `onConflictDoNothing()` but there's no conflict to detect -- the insert always succeeds. If auto-add calls `createSrsCard()` every time a known word appears in a new sentence, duplicate SRS cards accumulate.

**Why it happens:** The grammar card path in `analysis.ts` (line 159-168) does a manual check-then-insert pattern. But `createSrsCard()` in `srs.ts` relies on `onConflictDoNothing()` which has no conflict target defined on the schema.

**Prevention:**
1. Add partial unique indexes in PostgreSQL:
   ```sql
   CREATE UNIQUE INDEX srs_cards_vocabulary_word_idx ON srs_cards(word_id) WHERE card_type = 'vocabulary' AND word_id IS NOT NULL;
   CREATE UNIQUE INDEX srs_cards_grammar_pattern_idx ON srs_cards(grammar_pattern_id) WHERE card_type = 'grammar' AND grammar_pattern_id IS NOT NULL;
   ```
2. Update `createSrsCard()` to use `onConflictDoNothing()` with explicit conflict target after adding the index
3. Run a deduplication query on existing data before adding the constraint

**Detection:** `SELECT word_id, COUNT(*) FROM srs_cards WHERE card_type = 'vocabulary' GROUP BY word_id HAVING COUNT(*) > 1` -- any results mean duplicates exist.

---

### Pitfall 6: Collocations Cannot Be Linked to Individual Words

**What goes wrong:** Collocations are linked to sentences via `sentence_collocations`, but there's no link between a collocation and the words it contains. Showing "collocations containing this word" on the vocabulary page requires text matching (`WHERE text LIKE '%run%'`) which is unreliable ("running" won't match, "overrun" falsely matches).

**Prevention:**
- Add a `collocation_words` junction table: `(collocation_id, word_id)`
- Populate during `storeAnalysisResults()` by matching collocation component words against inserted word IDs
- Enables: "show all collocations containing word X" on vocabulary detail and "which words does this collocation relate to" on collocation display

---

### Pitfall 7: Web Review Loses State on Page Refresh

**What goes wrong:** If web review mimics Telegram's batch approach (fetch 20 cards, iterate client-side), a page refresh loses the session. User rates 10 cards, refreshes, gets 10 new cards. Session stats (Again: 2, Good: 8) are lost.

**Prevention:**
- Make web review stateless: fetch next due card -> display -> user rates -> POST rating -> fetch next card. No client-side session
- Compute session stats from `review_logs WHERE reviewed_at > session_start_time` rather than tracking client-side
- Or: store session_id in URL/localStorage, compute stats server-side from review_logs grouped by session

---

### Pitfall 8: Multiple Translations Overwrite Each Other

**What goes wrong:** `words.translation` is a single `text` field. When "run" appears as "бежать" in one sentence and "управлять" in another, the current `onConflictDoUpdate` does NOT update translation (only updates `thematicCluster`). So the first translation wins and all subsequent context-dependent meanings are silently lost.

**Prevention:**
- Option A (recommended): Add `word_translations` table with `(id, word_id, translation, source_sentence_id, created_at)`. Keep `words.translation` as "primary" for display
- Option B (simpler): Change `words.translation` to jsonb array. Loses sentence-context linkage but simpler schema
- Either way: update `storeAnalysisResults()` to append translations rather than ignore-or-overwrite

---

## Minor Pitfalls

### Pitfall 9: In-Memory Selection State Leaks

**What goes wrong:** `selectionStates` in `bot/handlers/vocabulary.ts` is an in-memory Map. If user starts word selection but never finishes (closes Telegram), state persists in memory forever. Over months of uptime, this accumulates.

**Prevention:** Add TTL cleanup (delete entries older than 30 minutes). Low priority for single-user but prevents memory growth in long-running process.

---

### Pitfall 10: Exercise Exhaustion for Frequently-Reviewed Grammar

**What goes wrong:** Grammar exercises have a `used` boolean. Once all 6 pre-generated exercises for a pattern are used, the review card shows "No exercises available" (visible in `bot/handlers/review.ts` line 33). With web review adding more review sessions, exercises will exhaust faster.

**Prevention:** Track exercise exhaustion and trigger re-generation when unused count drops below 2. Or: reset `used` flag on all exercises when they're all consumed (allow re-use after a full cycle).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema migration (POS, translations) | Pitfall 1: unique constraint migration corrupts word-SRS links | Additive migration: new column -> backfill -> constraint change. Never delete/split existing rows |
| Auto-add words in Telegram | Pitfall 3: queue floods with known words; Pitfall 5: duplicate SRS cards | Add unique index on srs_cards FIRST. Implement CEFR-based filtering before enabling auto-add |
| Vocabulary page UI | Pitfall 4: N+1 queries; Pitfall 6: collocations not linkable to words | Build paginated API with proper JOINs. Add collocation_words junction table in schema migration |
| Web SRS review | Pitfall 2: state conflict with Telegram; Pitfall 7: refresh loses session | Stateless fetch-rate-fetch pattern. Add staleness guard to rateCard() |
| Collocations display | Pitfall 6: no word-collocation linkage | Add junction table in schema phase, populate during analysis |
| Remove familiarity flow | Pitfall 3: orphaned data, inconsistent vocabulary page | Migrate UI to use SRS card state before removing manual flow |

## Recommended Phase Ordering Based on Pitfalls

1. **Schema migration first** -- POS column, unique indexes on srs_cards, collocation_words table, word_translations table. Every other feature depends on correct schema
2. **Auto-add + familiarity deprecation** -- after schema is stable, before vocabulary UI, so the UI never depends on stale familiarity data
3. **Vocabulary page** -- needs schema + auto-add working to display real data with proper filters
4. **Web review** -- independent of vocabulary page, but needs the concurrency guard on rateCard()
5. **Collocations UI** -- last, since it needs junction table from step 1 and vocabulary page infrastructure from step 3

## Sources

- Direct codebase analysis: `src/db/schema/words.ts` -- unique lemma constraint
- Direct codebase analysis: `src/services/analysis.ts` -- onConflictDoUpdate targets, word upsert logic, grammar SRS card creation pattern
- Direct codebase analysis: `src/services/srs.ts` -- createSrsCard() onConflictDoNothing without schema constraint, rateCard() reads current state
- Direct codebase analysis: `src/bot/handlers/vocabulary.ts` -- in-memory selection state, familiarity flow coupling
- Direct codebase analysis: `src/bot/handlers/review.ts` -- in-memory review sessions, no staleness check
- Direct codebase analysis: `src/lib/lemmatizer.ts` -- adverb-to-adjective collapsing in normalizeLemma()
- Direct codebase analysis: `drizzle/0000_true_genesis.sql` -- schema constraints, no unique index on srs_cards
- ts-fsrs: FSRS scheduling depends on accurate card state; double-reviewing distorts stability (HIGH confidence)
- PostgreSQL partial unique indexes: standard feature for nullable column uniqueness (HIGH confidence)
