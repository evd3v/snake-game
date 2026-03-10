# Phase 7: Service Updates & Telegram Auto-Add - Research

**Researched:** 2026-03-10
**Domain:** Telegram bot UX flow refactoring, CEFR-based filtering, SRS card auto-creation
**Confidence:** HIGH

## Summary

Phase 7 eliminates the manual word selection and familiarity rating flow in the Telegram bot. Currently, when a user submits a sentence, the bot shows extracted words with inline keyboard buttons for selecting which words to save and setting familiarity levels. The new behavior automatically creates SRS cards for all extracted words above a CEFR threshold, skipping any words that already have SRS cards.

The changes are well-scoped: the analysis service (`src/services/analysis.ts`) already upserts words and word_senses, and the `createSrsCard` service already uses `onConflictDoNothing` for idempotency. The core work is (1) adding auto-SRS-card creation in the analysis service after word upsert, (2) applying CEFR filtering to prevent A1/A2 words from auto-adding, and (3) simplifying the Telegram bot handler to remove the selection/familiarity UI.

**Primary recommendation:** Move SRS card auto-creation into `storeAnalysisResults()` at the service layer (not bot layer), apply CEFR filtering there, and simplify the bot sentence handler to display results without the word selection keyboard.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TG-01 | All new words automatically get SRS cards when sentence is analyzed | Auto-create SRS cards in `storeAnalysisResults()` after word_sense upsert, using existing `createSrsCard` with `onConflictDoNothing` for idempotency |
| TG-02 | Already known words (have SRS card) are not duplicated | `srsCards` insert already uses `onConflictDoNothing`; the existing `hasSrsCard` field in the words API response confirms deduplication works |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ts-fsrs | existing | FSRS scheduling, `createEmptyCard()` | Already used in `src/services/srs.ts` |
| drizzle-orm | existing | Database operations, upserts | Already used everywhere |
| grammy | existing | Telegram bot framework | Already used in `src/bot/` |

### Supporting
No new libraries needed. This phase only modifies existing code.

## Architecture Patterns

### Current Flow (to be changed)
```
User sends sentence
  -> Bot submits to API (POST /sentences)
  -> Worker processes (storeAnalysisResults)
  -> Bot polls for completion
  -> Bot fetches words (GET /sentences/:id/words)
  -> Bot shows word selection keyboard
  -> User selects words
  -> User sets familiarity for each word
  -> Bot creates SRS cards via API
```

### New Flow (target)
```
User sends sentence
  -> Bot submits to API (POST /sentences)
  -> Worker processes (storeAnalysisResults)
     -> Auto-creates SRS cards for words with CEFR >= B1
     -> Skips words that already have SRS cards (onConflictDoNothing)
  -> Bot polls for completion
  -> Bot fetches words (GET /sentences/:id/words)
  -> Bot shows analysis result (read-only, no selection keyboard)
     -> Marks words as "new" or "known" using hasSrsCard
```

### Pattern 1: Auto-SRS in Analysis Service
**What:** After upserting a word_sense in `storeAnalysisResults()`, immediately create an SRS card for it if the word's CEFR level passes the filter.
**When to use:** Every sentence analysis.
**Example:**
```typescript
// In src/services/analysis.ts, after word_sense upsert:

// Fetch the sense ID for auto-SRS creation
const [sense] = await db
  .select({ id: wordSenses.id })
  .from(wordSenses)
  .where(
    and(
      eq(wordSenses.wordId, upsertedWord.id),
      eq(wordSenses.partOfSpeech, vocab.partOfSpeech),
    ),
  )
  .limit(1);

// Auto-create SRS card if CEFR level qualifies
if (sense && shouldAutoAddWord(vocab.cefrLevel)) {
  await createSrsCard(db, 'vocabulary', { wordSenseId: sense.id });
  // createSrsCard uses onConflictDoNothing -- safe for duplicates
}
```

### Pattern 2: CEFR Threshold Filtering
**What:** A simple function that determines whether a word should auto-get an SRS card based on CEFR level.
**When to use:** During auto-SRS creation.
**Example:**
```typescript
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MIN_CEFR_FOR_AUTO_ADD = 'B1'; // Threshold

export function shouldAutoAddWord(cefrLevel: string | null): boolean {
  if (!cefrLevel) return true; // Unknown CEFR = include (safe default)
  const idx = CEFR_ORDER.indexOf(cefrLevel);
  const minIdx = CEFR_ORDER.indexOf(MIN_CEFR_FOR_AUTO_ADD);
  return idx >= minIdx;
}
```

### Pattern 3: Simplified Bot Handler
**What:** Remove the word selection keyboard and familiarity flow. Show analysis as read-only.
**When to use:** Replace current sentence handler behavior.
**Example:**
```typescript
// In sentence handler, after analysis completes:
// Simply show the formatted result -- no keyboard needed
await ctx.api.editMessageText(
  chatId,
  processingMsg.message_id,
  formatted,
  { parse_mode: 'HTML' },
);
// No initSelection, no buildWordSelectionKeyboard
```

### Anti-Patterns to Avoid
- **Moving auto-add to bot layer:** The bot calls the API, which calls the worker. Auto-adding at the bot level would create race conditions and duplicate the logic for web clients. Keep it in `storeAnalysisResults()`.
- **Deleting vocabulary handler entirely:** The callback handlers should be removed from bot registration, but the API endpoints (setFamiliarity, createSrsCard) should remain for web UI use.
- **Filtering on the word itself instead of word_sense:** SRS cards are tied to word_senses, not words. Always create cards per sense.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRS card deduplication | Custom duplicate-check logic | Existing `onConflictDoNothing` in `createSrsCard` | Already handles idempotency at DB level |
| FSRS card initialization | Custom card state | `createEmptyCard()` from ts-fsrs | Correct initial state for FSRS algorithm |
| Word sense lookup after upsert | Separate query | Use `.returning()` on word_sense upsert | Single query instead of two |

**Key insight:** The existing `createSrsCard` service already handles idempotency via `onConflictDoNothing`. TG-02 (no duplicates) is essentially free -- the only work is calling `createSrsCard` at the right place.

## Common Pitfalls

### Pitfall 1: Word Sense ID Not Available After Upsert
**What goes wrong:** The current `storeAnalysisResults()` upserts word_senses but does not capture the sense ID from the result (upsert uses `onConflictDoUpdate` but no `.returning()`).
**Why it happens:** The word_sense upsert was written before SRS auto-creation was needed.
**How to avoid:** Add `.returning({ id: wordSenses.id })` to the word_sense upsert in `storeAnalysisResults()`.
**Warning signs:** SRS cards not being created for re-encountered words whose senses already exist.

### Pitfall 2: CEFR Threshold Decision
**What goes wrong:** Setting the threshold too high (B2+) means useful intermediate words are skipped. Too low (A2+) floods the queue with trivial words.
**Why it happens:** No empirical data yet on word distribution.
**How to avoid:** Use B1 as the threshold (per STATE.md notes suggesting "B1+ vs B2+"). B1 words like "evidence", "crucial" are worth learning. A1/A2 words like "the", "is", "have" are trivially known.
**Warning signs:** Too many or too few words auto-added per sentence.

### Pitfall 3: Null CEFR Level Handling
**What goes wrong:** AI sometimes returns words without a CEFR level. If these are excluded, potentially interesting words are missed.
**Why it happens:** CEFR classification is AI-generated and not always reliable.
**How to avoid:** Treat null CEFR as "include" (err on the side of adding). Users can always mark words as known later (VOCPG-07 in Phase 8).

### Pitfall 4: Removing Bot Selection Without Updating Tests
**What goes wrong:** Tests for vocabulary keyboard handlers and selection state break.
**Why it happens:** Significant bot code is being removed/simplified.
**How to avoid:** Update `tests/bot-vocabulary.test.ts` to test the new simplified flow. Remove tests for selection/familiarity keyboards.

### Pitfall 5: Familiarity Default for Auto-Added Words
**What goes wrong:** Auto-added words need a sensible default familiarity since the user no longer selects it.
**Why it happens:** The old flow required user selection; the new flow must pick a default.
**How to avoid:** Use `never_seen` as the default (already the schema default in `word_senses.familiarity`). This is the correct SRS starting point.

## Code Examples

### Modifying storeAnalysisResults for Auto-SRS
```typescript
// In src/services/analysis.ts, inside the vocabulary loop:

// Step 2: Upsert word sense (POS-level, with translation)
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

// Step 3: Auto-create SRS card if CEFR qualifies
if (shouldAutoAddWord(vocab.cefrLevel)) {
  const emptyCard = createEmptyCard();
  await db
    .insert(srsCards)
    .values({
      cardType: 'vocabulary',
      wordSenseId: upsertedSense.id,
      state: 'new',
      due: emptyCard.due,
      stability: emptyCard.stability,
      difficulty: emptyCard.difficulty,
      elapsedDays: emptyCard.elapsed_days,
      scheduledDays: emptyCard.scheduled_days,
      reps: emptyCard.reps,
      lapses: emptyCard.lapses,
    })
    .onConflictDoNothing(); // Idempotent -- TG-02
```

### Simplified Sentence Handler
```typescript
// src/bot/handlers/sentence.ts -- simplified, no selection flow
if (status.status === 'completed' && status.result) {
  const sentenceId = status.result.sentenceId;
  const [words, details] = await Promise.all([
    apiClient.getSentenceWords(sentenceId),
    apiClient.getSentenceDetails(sentenceId),
  ]);
  const formatted = formatAnalysisResult(text, details, words);

  // Auto-add summary
  const autoAdded = words.filter(w => !w.hasSrsCard).length;
  const known = words.filter(w => w.hasSrsCard).length;
  const summary = autoAdded > 0
    ? `\n\nAdded ${autoAdded} new word(s) to SRS.`
    : '';

  await ctx.api.editMessageText(
    processingMsg.chat.id,
    processingMsg.message_id,
    formatted + summary,
    { parse_mode: 'HTML' },
  );
  return;
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/services/analysis.ts` | Add `.returning()` to word_sense upsert, add SRS card auto-creation with CEFR filter |
| `src/bot/handlers/sentence.ts` | Remove `initSelection` and keyboard logic, show read-only result |
| `src/bot/handlers/vocabulary.ts` | Remove or gut the selection/familiarity callback handlers |
| `src/bot/keyboards/analysis.ts` | Remove `buildWordSelectionKeyboard` and `buildFamiliarityKeyboard` (or keep if web needs them) |
| `src/bot/index.ts` | Remove `registerVocabularyHandlers(bot)` call |
| `src/bot/format.ts` | Possibly add auto-add summary line |
| `tests/bot-vocabulary.test.ts` | Update to match new simplified flow |
| `tests/analysis.test.ts` | Add test for auto-SRS creation with CEFR filtering |

### Files NOT to Modify
| File | Reason |
|------|--------|
| `src/routes/words.ts` | API endpoints stay for web UI |
| `src/routes/review.ts` | SRS card creation endpoint stays for web UI |
| `src/services/srs.ts` | Service layer is already correct |
| `src/db/schema/*` | No schema changes needed |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual word selection in Telegram | Auto-add all qualifying words | Phase 7 | Eliminates 3-step interaction (select, confirm, set familiarity) |
| Per-word familiarity setting | Default to `never_seen` | Phase 7 | Simplified UX; user can adjust later via web (Phase 8) |
| Bot creates SRS cards | Service layer creates SRS cards | Phase 7 | Consistent behavior across Telegram and web |

## Open Questions

1. **CEFR Threshold: B1 or B2?**
   - What we know: STATE.md says "B1+ vs B2+" is TBD. A1/A2 words are trivially known (articles, common verbs).
   - What's unclear: Exact distribution of CEFR levels in typical book sentences.
   - Recommendation: Start with B1 (include B1, B2, C1, C2). B1 words like "evidence", "crucial", "approach" are useful for intermediate learners. Can be adjusted later via a constant.

2. **Should the bot still show new/known markers?**
   - What we know: `formatAnalysisResult` already uses `hasSrsCard` to show new vs known markers.
   - Recommendation: Keep the markers. After auto-add, re-fetch words so `hasSrsCard` reflects the newly created cards. Or note that `hasSrsCard` will show `false` for just-added words since cards were created during analysis (before the bot fetches). Actually, since auto-add happens in `storeAnalysisResults()` (worker), by the time the bot fetches words, cards already exist. So `hasSrsCard` will correctly show `true` for auto-added words and words from previous sentences.

3. **What about the web UI sentence analysis?**
   - What we know: Web UI uses the same API endpoints. If auto-add is in the service layer, web gets it too.
   - Recommendation: This is desirable behavior -- both Telegram and web should auto-add. The web vocabulary page (Phase 8) will provide tools to manage/remove words.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | vitest.config.ts (implicit, uses package.json script) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TG-01 | Words auto-get SRS cards during analysis | unit | `npm test -- tests/analysis.test.ts -t "auto-create SRS"` | Partial (analysis.test.ts exists, needs new tests) |
| TG-01 | CEFR filtering prevents A1/A2 auto-add | unit | `npm test -- tests/analysis.test.ts -t "CEFR filter"` | No |
| TG-02 | Duplicate SRS cards not created | unit | `npm test -- tests/analysis.test.ts -t "duplicate"` | No |
| TG-01 | Bot shows analysis without selection keyboard | unit | `npm test -- tests/bot-vocabulary.test.ts` | Yes (needs update) |

### Sampling Rate
- **Per task commit:** `npm test -- tests/analysis.test.ts tests/bot-vocabulary.test.ts -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `tests/analysis.test.ts` -- needs new test cases for auto-SRS creation and CEFR filtering
- [ ] `tests/bot-vocabulary.test.ts` -- needs update to reflect removal of selection flow

## Sources

### Primary (HIGH confidence)
- Project codebase -- direct reading of all relevant source files
- `src/services/analysis.ts` -- current word processing pipeline
- `src/services/srs.ts` -- `createSrsCard` with `onConflictDoNothing` idempotency
- `src/bot/handlers/sentence.ts` -- current bot flow
- `src/bot/handlers/vocabulary.ts` -- selection/familiarity flow to be removed
- `src/db/schema/srs-cards.ts` -- card schema, no unique constraint on wordSenseId (uses `onConflictDoNothing`)
- `src/db/schema/word-senses.ts` -- composite unique on (wordId, partOfSpeech)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` -- CEFR threshold decision note ("B1+ vs B2+, decide during Phase 7")

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing code
- Architecture: HIGH - straightforward refactor of existing patterns
- Pitfalls: HIGH - derived from direct code reading, clear edge cases
- CEFR threshold: MEDIUM - B1 is reasonable but may need tuning

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal project, no external dependencies changing)
