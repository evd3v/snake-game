# Phase 14: Analysis & Learning Flow - Research

**Researched:** 2026-03-15
**Domain:** Reader sentence analysis, vocabulary management, SRS integration, modal UI
**Confidence:** HIGH

## Summary

Phase 14 connects the EPUB reader (Phase 13) to the existing AI analysis pipeline (Phase 2) and vocabulary management system. When a user taps a sentence in the reader, the system calls `analyzeSentence()` via the existing BullMQ queue, stores results in the `sentences` table, and caches the link by adding a `sentence_id` foreign key to `book_sentences`. Re-tapping loads cached results from DB without an AI call (ANAL-02).

The critical design challenge is filtering: the modal must show ONLY new words/collocations/grammar not already in the user's vocabulary (ANAL-03, ANAL-04). This requires cross-referencing AI analysis results against existing `words`, `word_senses`, `collocations`, and `grammar_patterns` tables. The user explicitly decides "learn" (creates SRS card) or "know" (marks familiarity without SRS) for each item -- replacing the current automatic CEFR-based filtering (FLOW-02).

A second challenge is the page-transition mini-report (FLOW-01): tracking how many items were added/marked per page during the reading session, then displaying counts when navigating to the next page.

**Primary recommendation:** Add `sentence_id` nullable FK to `book_sentences` for analysis caching. Create a new `/books/sentences/:bookSentenceId/analyze` endpoint that reuses `analyzeSentence()` + `storeAnalysisResults()` but returns filtered results (only new items). Build an analysis modal component in the reader view with "learn"/"know" buttons. Track page-level stats in frontend state.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANAL-01 | Tap sentence opens modal with AI analysis (translation, words+POS, grammar, collocations) | New API endpoint triggers existing `analyzeSentence()` pipeline; modal component displays structured results |
| ANAL-02 | Re-tap already-analyzed sentence loads cached result from DB without AI call | `book_sentences.sentence_id` FK links to cached analysis in `sentences` table; endpoint checks this before queuing AI |
| ANAL-03 | Modal shows only NEW words (not in vocabulary) with "learn"/"know" buttons | Server-side filtering: cross-reference analysis results against `word_senses` table; "learn" creates SRS card, "know" sets familiarity to `understand_in_context` |
| ANAL-04 | Collocations and grammar patterns also shown with "learn"/"know" buttons | Same filtering pattern for `collocations` and `grammar_patterns` tables; buttons create/skip SRS cards |
| FLOW-01 | Page turn shows mini-report (words learned, marked known, grammar patterns found) | Frontend tracks counters per page in reactive state; overlay/toast shown on goNext() |
| FLOW-02 | A1/A2 filtering removed -- all words shown, user decides via "learn"/"know" | Remove `shouldAutoAddWord()` CEFR gate from reader analysis path; keep it for Telegram bot backward compat |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Existing `analyzeSentence()` | - | AI analysis of sentence text | Already proven, returns structured `SentenceAnalysis` with vocabulary, collocations, grammar |
| Existing `storeAnalysisResults()` | - | Upserts words, senses, collocations, grammar, SRS cards | Already handles deduplication and SRS card creation |
| BullMQ | existing | Async job processing for AI calls | Already wired in project; sentence analysis uses queue pattern |
| ts-fsrs | existing | SRS card creation for "learn" action | Already used for card scheduling |
| Drizzle ORM | existing | DB queries and schema migration | Already used throughout |
| Vue 3 Composition API | existing | Modal component and reactive page state | Already used in reader |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new libraries needed | - | Everything builds on existing stack | - |

## Architecture Patterns

### Database Change: Link book_sentences to sentences

The `book_sentences` table currently has no link to the analysis `sentences` table. Add a nullable FK:

```sql
-- Migration: 0007_analysis_link.sql
ALTER TABLE book_sentences ADD COLUMN sentence_id INTEGER REFERENCES sentences(id);
CREATE INDEX idx_book_sentences_sentence_id ON book_sentences(sentence_id);
```

```typescript
// In src/db/schema/books.ts - add to bookSentences table definition
sentenceId: integer('sentence_id').references(() => sentences.id),
```

This enables ANAL-02 (caching): if `book_sentences.sentence_id` is NOT NULL, the sentence has been analyzed and results can be loaded directly from DB.

### Pattern 1: Synchronous Analysis with Polling (existing pattern)

**What:** The reader analysis follows the same queue pattern as the existing sentence input page: POST queues a job, frontend polls for completion.
**Why reuse:** The AI call takes 2-5 seconds. The existing queue + poll pattern (POST returns jobId, GET polls status) is already proven and handles failures gracefully.

```
User taps sentence
  -> POST /books/sentences/:bookSentenceId/analyze
     -> Check book_sentences.sentence_id (cached?)
        -> If cached: return analysis immediately (HTTP 200)
        -> If not: queue analyzeSentence job, return jobId (HTTP 202)
  -> Frontend polls GET /books/sentences/:bookSentenceId/analyze/status/:jobId
     -> On complete: returns filtered analysis + updates book_sentences.sentence_id
```

### Pattern 2: Filtered Analysis Response

**What:** The analysis endpoint returns items split into "new" (not in user's vocabulary) and "existing" (already known/learning).
**Why:** The modal (ANAL-03, ANAL-04) must only show actionable items with "learn"/"know" buttons.

```typescript
interface ReaderAnalysisResult {
  translation: string;
  cefrLevel: string;
  // Only items NOT already in user's vocabulary
  newWords: Array<{
    wordId: number;
    senseId: number;
    lemma: string;
    partOfSpeech: string;
    translation: string;
    definition: string;
    cefrLevel: string;
  }>;
  newCollocations: Array<{
    collocationId: number;
    text: string;
    translation: string;
    type: string;
    cefrLevel: string;
  }>;
  newGrammarPatterns: Array<{
    grammarPatternId: number;
    pattern: string;
    description: string;
    cefrLevel: string;
  }>;
  // Counts of existing items (shown as summary, not individually)
  existingWordsCount: number;
  existingCollocationsCount: number;
  existingGrammarPatternsCount: number;
}
```

**Filtering logic (server-side):**

For words: After `storeAnalysisResults()`, query `word_senses` for each word -- if a sense already has an SRS card OR familiarity != 'never_seen', it is "existing". Otherwise it is "new".

For collocations: Check if `srs_cards` row exists with `collocation_id` -- if yes, "existing".

For grammar patterns: Check if `srs_cards` row exists with `grammar_pattern_id` -- if yes, "existing".

### Pattern 3: "Learn" and "Know" Actions

**What:** Two distinct user actions per item in the modal.
**When:** User sees a new word/collocation/grammar pattern and decides.

```
"Learn" button:
  -> POST /reader/words/:senseId/learn
     -> Creates SRS card (if not exists) with state='new'
     -> Sets familiarity to 'seen_unsure'
     -> Returns updated status

"Know" button:
  -> POST /reader/words/:senseId/know
     -> Sets familiarity to 'understand_in_context'
     -> Does NOT create SRS card
     -> Returns updated status
```

Same pattern for collocations (`/reader/collocations/:id/learn|know`) and grammar patterns (`/reader/grammar/:id/learn|know`). The "know" action for collocations/grammar means the SRS card is either not created, or if auto-created by `storeAnalysisResults()`, it should be removed or marked as review-complete.

**Important detail:** The existing `storeAnalysisResults()` auto-creates SRS cards for words >= B1 and ALL collocations/grammar. For the reader flow (FLOW-02), we need a variant that does NOT auto-create SRS cards -- the user decides. Options:

1. **Add a flag to `storeAnalysisResults()`:** `{ autoCreateSrsCards: false }` -- cleanest approach
2. **Delete auto-created cards after the fact** -- wasteful
3. **Fork the function** -- code duplication

**Recommendation:** Option 1 -- add `options.autoCreateSrsCards` parameter (default `true` for backward compat). The v2.0 research already noted this approach: "Reuse existing analyzeSentence pipeline with autoCreateSrsCards option".

### Pattern 4: Page Stats Tracking (Frontend-only)

**What:** Track learn/know/grammar counts per page for the mini-report (FLOW-01).
**Where:** In `ReaderView.vue` reactive state.

```typescript
const pageStats = ref({
  wordsLearned: 0,
  wordsKnown: 0,
  grammarPatternsFound: 0,
  collocationsLearned: 0,
});

// Reset on page navigation
// Show as overlay/toast when goNext() is called
```

No server persistence needed -- stats are transient, shown once on page turn.

### Pattern 5: Highlight Refresh After Modal Close

**What:** After user marks words as "learn" or "know" in the modal, the word highlighting in the reader text must update immediately (HIGH-02, already implemented in Phase 13).
**How:** Re-fetch the page data (GET `/books/:id/page/:pageNum`) after modal close. The `highlightSentences()` service already queries current word statuses from DB, so updated familiarity/SRS status will be reflected.

Alternative (more efficient): Locally update the highlights array in frontend state based on the words marked in the modal, without a full page re-fetch. This avoids an extra API call per modal close.

**Recommendation:** Local update for responsiveness, with lazy re-fetch on next page load as validation.

### Recommended Project Structure
```
src/
  routes/
    books.ts              # Add analyze endpoint + learn/know actions
  services/
    analysis.ts           # Add autoCreateSrsCards option
    reader-analysis.ts    # Filtering logic (new vs existing items)
web/src/
  views/
    ReaderView.vue        # Add modal integration, page stats
  components/
    reader/
      AnalysisModal.vue   # Full analysis display with learn/know buttons
      PageReport.vue      # Mini-report overlay on page turn
drizzle/
  0007_analysis_link.sql  # Add sentence_id to book_sentences
```

### Anti-Patterns to Avoid
- **Eager analysis of all sentences on a page:** Analysis is on-demand (user tap), not pre-fetched. AI calls are expensive (~$0.01-0.05 each).
- **Storing page stats in the database:** Page stats (FLOW-01) are ephemeral UI state. No need for a table.
- **Creating a separate analysis pipeline for the reader:** Reuse `analyzeSentence()` + `storeAnalysisResults()`. Do not fork.
- **Client-side filtering of new vs existing words:** Do this server-side. The client does not have full vocabulary state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence analysis | Custom reader-specific AI prompt | Existing `analyzeSentence()` with same prompt | Already tuned for quality; same structured output |
| SRS card creation | Manual FSRS state initialization | Existing `createEmptyCard()` from ts-fsrs | FSRS has specific initial state requirements |
| Word deduplication | Custom lemma matching | Existing `normalizeLemma()` + upsert logic in `storeAnalysisResults()` | Already handles POS-specific lemmatization |
| Vocabulary status lookup | Custom query per word | Existing `highlightSentences()` batch query pattern | Already optimized for batch lookup |

## Common Pitfalls

### Pitfall 1: Race condition on double-tap
**What goes wrong:** User taps a sentence, analysis starts (queued). User taps again before first analysis completes -- second AI call is wasted.
**Why it happens:** No debouncing or "in-progress" state tracking per sentence.
**How to avoid:** Track `analyzingBookSentenceId` in frontend state. Disable tap on sentences currently being analyzed. Show spinner on the sentence being analyzed.
**Warning signs:** Duplicate sentences in `sentences` table, double SRS cards.

### Pitfall 2: Auto-SRS cards conflict with user choice
**What goes wrong:** `storeAnalysisResults()` auto-creates SRS cards for B1+ words. Then user presses "know" expecting NO SRS card, but one already exists.
**Why it happens:** Current code assumes Telegram-style flow where all words get SRS cards.
**How to avoid:** Pass `autoCreateSrsCards: false` when calling from reader context. Let user decide via learn/know buttons.
**Warning signs:** Words marked "know" still appearing in review queue.

### Pitfall 3: book_sentences text vs sentences text mismatch
**What goes wrong:** The `book_sentences.text` was split by `sbd` during EPUB parsing. The `sentences.text` is stored by `storeAnalysisResults()`. If they differ (whitespace, encoding), deduplication breaks.
**Why it happens:** EPUB text goes through HTML stripping, whitespace normalization before storage.
**How to avoid:** Pass `book_sentences.text` directly to `analyzeSentence()` and use the same text for `storeAnalysisResults()`. The `book_sentences.sentence_id` FK is the authoritative cache link, not text matching.

### Pitfall 4: Modal not reflecting dark theme
**What goes wrong:** Analysis modal uses hardcoded colors, looks wrong in dark reader theme.
**Why it happens:** Reader uses CSS custom properties (`--bg`, `--text`, etc.) set by `.dark` class.
**How to avoid:** Modal component must inherit CSS custom properties from the reader container. Use the same variable names.

### Pitfall 5: Highlight update lag after modal close
**What goes wrong:** User marks a word as "learn", closes modal, but the word still shows as blue (new) instead of yellow (learning).
**Why it happens:** Highlights are fetched from server on page load. After modal close, local state is stale.
**How to avoid:** After modal close, update the `pageData.sentences[n].highlights` array locally based on what was marked. Change status from `null`/`new` to `learning` for "learn" items, and remove highlight for "know" items.

## Code Examples

### Adding autoCreateSrsCards option to storeAnalysisResults

```typescript
// Source: existing src/services/analysis.ts pattern
interface StoreOptions {
  autoCreateSrsCards?: boolean; // default true for backward compat
}

export async function storeAnalysisResults(
  db: Database,
  text: string,
  sourceBook: string | undefined,
  analysis: SentenceAnalysis,
  options: StoreOptions = {},
): Promise<StoreResult> {
  const { autoCreateSrsCards = true } = options;

  // ... existing upsert logic ...

  // Only create SRS cards if option is true
  if (autoCreateSrsCards && shouldAutoAddWord(vocab.cefrLevel)) {
    // existing SRS card creation code
  }
}
```

### Analysis endpoint for reader (cached vs fresh)

```typescript
// Source: pattern derived from existing routes/books.ts + routes/sentences.ts
fastify.post<{ Params: { bookSentenceId: string } }>(
  '/books/sentences/:bookSentenceId/analyze',
  async (request, reply) => {
    const bookSentenceId = Number(request.params.bookSentenceId);

    // 1. Get book sentence
    const [bookSentence] = await db.select()
      .from(bookSentences)
      .where(eq(bookSentences.id, bookSentenceId));

    if (!bookSentence) return reply.notFound();

    // 2. Check cache (ANAL-02)
    if (bookSentence.sentenceId) {
      // Already analyzed -- return filtered results from DB
      const filtered = await getFilteredAnalysis(db, bookSentence.sentenceId);
      return { status: 'completed', result: filtered };
    }

    // 3. Not cached -- queue AI analysis
    const job = await analysisQueue.add('sentence-analysis', {
      text: bookSentence.text,
      bookSentenceId, // to link back after completion
    });
    return reply.status(202).send({ jobId: job.id });
  },
);
```

### Filtering new vs existing items

```typescript
// Source: pattern derived from existing word-highlighter.ts batch query approach
async function getFilteredAnalysis(db: Database, sentenceId: number) {
  // Get all words linked to this sentence
  const allWords = await db.select({
    wordId: words.id,
    senseId: wordSenses.id,
    lemma: words.lemma,
    partOfSpeech: wordSenses.partOfSpeech,
    translation: wordSenses.translation,
    definition: wordSenses.definition,
    cefrLevel: words.cefrLevel,
    familiarity: wordSenses.familiarity,
  })
  .from(sentenceWords)
  .innerJoin(words, eq(sentenceWords.wordId, words.id))
  .innerJoin(wordSenses, eq(wordSenses.wordId, words.id))
  .where(eq(sentenceWords.sentenceId, sentenceId));

  // Check which have SRS cards
  const senseIds = allWords.map(w => w.senseId);
  const existingSrsCards = await db.select({ wordSenseId: srsCards.wordSenseId })
    .from(srsCards)
    .where(and(
      eq(srsCards.cardType, 'vocabulary'),
      inArray(srsCards.wordSenseId, senseIds),
    ));
  const srsSet = new Set(existingSrsCards.map(r => r.wordSenseId));

  // New = no SRS card AND familiarity is 'never_seen'
  const newWords = allWords.filter(w =>
    !srsSet.has(w.senseId) && w.familiarity === 'never_seen'
  );
  const existingCount = allWords.length - newWords.length;

  return { newWords, existingWordsCount: existingCount, /* ... */ };
}
```

### Learn/Know button actions

```typescript
// "Learn" action -- create SRS card
fastify.post<{ Params: { senseId: string } }>(
  '/reader/words/:senseId/learn',
  async (request) => {
    const senseId = Number(request.params.senseId);
    // Update familiarity
    await db.update(wordSenses)
      .set({ familiarity: 'seen_unsure' })
      .where(eq(wordSenses.id, senseId));
    // Create SRS card if not exists
    const [existing] = await db.select({ id: srsCards.id })
      .from(srsCards)
      .where(and(eq(srsCards.cardType, 'vocabulary'), eq(srsCards.wordSenseId, senseId)));
    if (!existing) {
      const emptyCard = createEmptyCard();
      await db.insert(srsCards).values({
        cardType: 'vocabulary',
        wordSenseId: senseId,
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
    return { ok: true };
  },
);

// "Know" action -- mark familiar, no SRS card
fastify.post<{ Params: { senseId: string } }>(
  '/reader/words/:senseId/know',
  async (request) => {
    const senseId = Number(request.params.senseId);
    await db.update(wordSenses)
      .set({ familiarity: 'understand_in_context' })
      .where(eq(wordSenses.id, senseId));
    return { ok: true };
  },
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-add all B1+ words with SRS cards | User explicitly chooses "learn" or "know" per word | Phase 14 (reader flow) | More intentional learning; fewer unwanted SRS cards |
| CEFR filter hides A1/A2 words from analysis | All words shown in reader modal, user decides | Phase 14 (FLOW-02) | User sees complete picture; makes own judgment |
| Sentence analysis only via text input or Telegram | Tap-to-analyze in EPUB reader context | Phase 14 (ANAL-01) | Natural reading-to-learning flow |

## Open Questions

1. **Job completion callback for bookSentenceId linking**
   - What we know: The existing job processor returns `{ sentenceId }` from `storeAnalysisResults()`. We need to also update `book_sentences.sentence_id = sentenceId` after the job completes.
   - What's unclear: Whether to modify the job processor or handle it in the polling endpoint.
   - Recommendation: Pass `bookSentenceId` as job data. In the job processor, after `storeAnalysisResults()`, update `book_sentences.sentence_id`. This keeps the link creation atomic with analysis storage.

2. **Collocation/grammar "know" action behavior**
   - What we know: `storeAnalysisResults()` currently auto-creates SRS cards for ALL collocations and grammar patterns. If we pass `autoCreateSrsCards: false`, they won't be created.
   - What's unclear: If user presses "know" for a collocation, should we still store it in the `collocations` table (yes -- it's upserted by `storeAnalysisResults()`), just skip the SRS card creation? That's already the behavior with `autoCreateSrsCards: false`.
   - Recommendation: "Know" for collocations/grammar simply means no SRS card. The item still exists in DB for reference. This is the natural behavior when `autoCreateSrsCards: false`.

3. **Proper noun flooding**
   - What we know: STATE.md notes "Proper noun flooding in reader (character names show as 'new') -- needs ignore mechanism in Phase 13/14"
   - What's unclear: The AI prompt already says "skip proper nouns and nationality adjectives". If AI still returns them, it's a prompt quality issue.
   - Recommendation: Trust the AI prompt for now (it explicitly excludes proper nouns). If still an issue post-implementation, add a client-side "ignore" button that sets familiarity to `understand_in_context` without user seeing it again.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no automated test framework in project) |
| Config file | none |
| Quick run command | `curl` against API endpoints |
| Full suite command | Manual end-to-end reader testing |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANAL-01 | Tap sentence triggers AI analysis, modal shows results | manual | N/A - requires UI interaction | N/A |
| ANAL-02 | Re-tap cached sentence returns instant result | smoke | `curl POST /books/sentences/:id/analyze` twice, second should be 200 not 202 | No |
| ANAL-03 | Modal shows only new words with learn/know buttons | manual | N/A - requires UI verification | N/A |
| ANAL-04 | Collocations/grammar shown with learn/know buttons | manual | N/A - requires UI verification | N/A |
| FLOW-01 | Page turn shows mini-report with counts | manual | N/A - frontend state only | N/A |
| FLOW-02 | All words shown (no A1/A2 filter) | smoke | Verify analysis results include A1/A2 words | No |

### Sampling Rate
- **Per task commit:** Manual test against running dev server
- **Per wave merge:** Full reader flow test: upload book, read page, tap sentences, mark words, check highlights update, turn page, verify report
- **Phase gate:** All 6 requirements manually verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `drizzle/0007_analysis_link.sql` -- migration to add sentence_id FK to book_sentences
- [ ] No automated test infrastructure needed (project uses manual testing throughout)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/services/analysis.ts`, `src/lib/ai/analyze-sentence.ts`, `src/routes/books.ts`, `src/routes/sentences.ts`, `src/services/word-highlighter.ts` -- complete understanding of current architecture
- Existing codebase: `src/db/schema/*.ts` -- all table definitions and relationships verified
- Phase 12 RESEARCH.md -- prior architectural decisions (sync parsing, epub2, sbd)
- STATE.md -- accumulated decisions including "Reuse existing analyzeSentence pipeline with autoCreateSrsCards option"

### Secondary (MEDIUM confidence)
- v2.0 REQUIREMENTS.md -- requirement definitions for ANAL-01 through FLOW-02

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, entire phase builds on existing proven code
- Architecture: HIGH - patterns directly extend existing codebase (new endpoints, one DB migration, one modal component)
- Pitfalls: HIGH - identified from reading actual code (auto-SRS conflict, race condition, dark theme)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no external dependencies changing)
