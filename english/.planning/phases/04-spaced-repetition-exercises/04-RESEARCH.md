# Phase 4: Spaced Repetition and Exercises - Research

**Researched:** 2026-03-09
**Domain:** FSRS spaced repetition scheduling, AI-generated cloze exercises, Telegram bot review UX
**Confidence:** HIGH

## Summary

This phase implements the core learning loop: FSRS-scheduled vocabulary flashcards and AI-generated grammar cloze exercises, all accessible through the Telegram bot. The existing `srs_cards` table already has the correct FSRS fields (stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, due). The `ts-fsrs` library provides a pure-function API that maps directly to these fields -- no ORM integration needed, just call `fsrs.next(card, rating)` and persist the returned Card object.

The main technical challenges are: (1) mapping between the database schema and ts-fsrs Card objects, (2) designing a new `grammar_exercises` table for pre-generated cloze sentences, (3) building a BullMQ job for batch exercise generation, and (4) creating an ergonomic Telegram inline-keyboard review flow within the 64-byte callback data limit.

**Primary recommendation:** Use ts-fsrs directly with the existing srs_cards schema. Add a grammar_exercises table for pre-generated cloze sentences. Create a dedicated BullMQ worker job type for batch exercise generation. Build the review flow as a sequential card-by-card Telegram conversation with Again/Hard/Good/Easy rating buttons.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRS-01 | FSRS algorithm for scheduling reviews | ts-fsrs library provides `fsrs()`, `repeat()`, `next()` functions; existing srs_cards schema matches Card fields |
| SRS-02 | Flashcard review for vocabulary (show word, recall translation, rate) | Telegram bot inline keyboard flow: show word + context sentence, reveal translation on tap, rate with 4 buttons |
| SRS-03 | Cloze exercises for grammar patterns (AI-generated sentence with gap) | New grammar_exercises table + AI batch generation via Vercel AI SDK structured output |
| SRS-04 | Exercises pre-generated in batches (not at review time) | BullMQ job type 'generate-exercises' triggered when grammar pattern is first saved or exercise stock runs low |
| SRS-05 | Original book sentence shown as context during word review | Query through sentenceWords junction to get original sentence text |
| SRS-06 | Grammar pattern progression (simple to complex variations) | AI prompt instructs difficulty levels (1-3); exercises stored with difficulty level, served in order |
| SRS-07 | Quick review session available in Telegram bot | /review command fetches due cards, presents them one-by-one with inline keyboards |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ts-fsrs | ^4.x | FSRS scheduling algorithm | Official TypeScript implementation of FSRS; pure functions, no DB coupling |
| ai (Vercel AI SDK) | ^6.0.116 | Structured AI output for cloze generation | Already used in project for sentence analysis |
| bullmq | ^5.70.4 | Async batch exercise generation | Already used for sentence-analysis queue |
| grammy | ^1.41.1 | Telegram bot review interface | Already used for bot |
| drizzle-orm | ^0.45.1 | Database queries | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Schema validation for AI cloze output | Validate AI-generated exercise structure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ts-fsrs | simple-ts-fsrs | Simpler but less maintained; ts-fsrs is the canonical implementation |
| BullMQ batch job | Cron-based generation | BullMQ already in stack, cron adds unnecessary dependency |

**Installation:**
```bash
npm install ts-fsrs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    srs.ts               # FSRS scheduling logic (card creation, rating, due query)
    exercise-generator.ts # AI cloze exercise generation logic
  routes/
    review.ts             # API routes for review sessions
  bot/
    handlers/
      review.ts           # Telegram /review command and rating callbacks
    keyboards/
      review.ts           # Review keyboard builders (reveal, rate)
  db/schema/
    srs-cards.ts          # Already exists -- may need migration for FK constraints
    grammar-exercises.ts  # New: pre-generated cloze exercises
  lib/ai/
    cloze-prompts.ts      # System/user prompts for cloze generation
    cloze-schemas.ts      # Zod schema for cloze AI output
  workers/
    index.ts              # Add 'generate-exercises' job handler alongside existing 'sentence-analysis'
```

### Pattern 1: FSRS Card Lifecycle
**What:** Map between DB rows and ts-fsrs Card objects for scheduling
**When to use:** Every review interaction
**Example:**
```typescript
import { fsrs, createEmptyCard, Rating, type Card } from 'ts-fsrs';

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true });

// DB row -> ts-fsrs Card
function toFsrsCard(row: typeof srsCards.$inferSelect): Card {
  return {
    due: row.due,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: row.elapsedDays ?? 0,
    scheduled_days: row.scheduledDays ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: row.state === 'new' ? 0 : row.state === 'learning' ? 1 : row.state === 'review' ? 2 : 3,
    last_review: row.lastReview ?? undefined,
  };
}

// Rate a card and persist
async function rateCard(db, cardId: number, rating: Rating) {
  const [row] = await db.select().from(srsCards).where(eq(srsCards.id, cardId));
  const card = toFsrsCard(row);
  const result = scheduler.next(card, rating, new Date());
  const updated = result.card;
  await db.update(srsCards).set({
    due: updated.due,
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsedDays: updated.elapsed_days,
    scheduledDays: updated.scheduled_days,
    reps: updated.reps,
    lapses: updated.lapses,
    state: ['new', 'learning', 'review', 'relearning'][updated.state],
    lastReview: updated.last_review,
  }).where(eq(srsCards.id, cardId));
}
```

### Pattern 2: SRS Card Creation on Word Save
**What:** Auto-create srs_cards entry when user saves a word (after familiarity selection)
**When to use:** At the end of vocabulary selection flow (Phase 3 already saves words)
**Example:**
```typescript
// After setFamiliarity succeeds, create SRS card
const card = createEmptyCard();
await db.insert(srsCards).values({
  cardType: 'vocabulary',
  wordId: wordId,
  state: 'new',
  due: card.due,
  stability: card.stability,
  difficulty: card.difficulty,
}).onConflictDoNothing(); // Idempotent
```

### Pattern 3: Batch Exercise Generation via BullMQ
**What:** Generate cloze exercises for grammar patterns in background
**When to use:** When a new grammar pattern is saved or exercise stock is low
**Example:**
```typescript
// In worker: handle 'generate-exercises' job type
worker.on('generate-exercises', async (job) => {
  const { grammarPatternId, pattern, description, count } = job.data;
  const exercises = await generateClozeExercises(pattern, description, count);
  await db.insert(grammarExercises).values(
    exercises.map((ex, i) => ({
      grammarPatternId,
      sentence: ex.sentence,
      clozeAnswer: ex.answer,
      difficultyLevel: ex.difficulty, // 1=simple, 2=medium, 3=complex
      used: false,
    }))
  );
});
```

### Pattern 4: Telegram Review Session State
**What:** In-memory session tracking for active review (like existing vocabulary selection)
**When to use:** During /review command flow
**Example:**
```typescript
interface ReviewSession {
  cards: DueCard[];       // Pre-fetched due cards
  currentIndex: number;   // Current card position
  revealed: boolean;      // Whether answer is shown
}
const reviewSessions = new Map<number, ReviewSession>(); // keyed by chatId

// Callback data format (under 64 bytes):
// "rv:123"     -> reveal card 123
// "rt:123:3"   -> rate card 123 as Good (3)
// "rn"         -> next card
// "rs"         -> skip/end session
```

### Anti-Patterns to Avoid
- **Computing FSRS at review time without caching:** Always use `scheduler.next()` for single rating, not `scheduler.repeat()` for all 4 -- avoids wasted computation
- **Generating exercises on-demand:** Must be pre-generated (SRS-04). Never call AI during review session
- **Storing ts-fsrs state enum as numbers in DB:** The existing schema uses string enum ('new', 'learning', 'review', 'relearning') -- map between numeric and string representations
- **Large callback data payloads:** Telegram limits callback_data to 64 bytes. Use short prefixes and numeric IDs only

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spaced repetition scheduling | Custom interval calculator | ts-fsrs `next()` / `repeat()` | FSRS has 19 optimized parameters; hand-rolling loses years of research |
| Card state machine | Custom state transitions | ts-fsrs State enum | New->Learning->Review->Relearning transitions are non-trivial |
| Fuzz/jitter on intervals | Random offset logic | ts-fsrs `enable_fuzz: true` | Proper fuzz implementation prevents review clustering |
| Cloze sentence generation | Template-based gap filling | AI structured output (Vercel AI SDK) | Grammar patterns need contextually valid sentences |

**Key insight:** ts-fsrs handles ALL scheduling math. The application layer only needs to: (1) convert DB rows to Card objects, (2) call `next(card, rating)`, (3) persist the returned Card back to DB.

## Common Pitfalls

### Pitfall 1: State Enum Mismatch
**What goes wrong:** ts-fsrs uses numeric State enum (0,1,2,3) but the DB schema uses string pgEnum ('new','learning','review','relearning')
**Why it happens:** Schema was created before ts-fsrs integration
**How to avoid:** Create explicit mapping functions `toFsrsState(dbState: string): number` and `toDbState(fsrsState: number): string`
**Warning signs:** Cards stuck in wrong state, reviews not scheduling properly

### Pitfall 2: Missing SRS Card Creation
**What goes wrong:** Words are saved to vocabulary but no srs_cards entry is created, so they never appear in reviews
**Why it happens:** Phase 3 word saving flow doesn't create SRS cards
**How to avoid:** Hook into the familiarity-setting flow to auto-create srs_cards entries. Also create grammar SRS cards when grammar patterns are saved during sentence analysis
**Warning signs:** /review shows "no cards due" even though words were saved

### Pitfall 3: Exercise Exhaustion
**What goes wrong:** User reviews a grammar pattern but all pre-generated exercises are used up
**Why it happens:** Fixed batch size without replenishment
**How to avoid:** Check remaining unused exercises before/after review. If below threshold (e.g., 3), queue a new batch generation job. Mark exercises as `used` after presentation
**Warning signs:** Grammar reviews fall back to showing no exercise

### Pitfall 4: Telegram Callback Data Overflow
**What goes wrong:** Callback data exceeds 64-byte limit, Telegram silently drops the button
**Why it happens:** Encoding too much information (e.g., full word text) in callback
**How to avoid:** Use only short prefixes + numeric IDs. Format: `rv:123`, `rt:123:3`. Test all callback strings are under 64 bytes
**Warning signs:** Buttons don't respond when tapped

### Pitfall 5: Due Date Timezone Issues
**What goes wrong:** Cards scheduled for "tomorrow" appear immediately or skip a day
**Why it happens:** Mixing UTC and local time in due date comparisons
**How to avoid:** Always use UTC for `due` timestamps. Query: `WHERE due <= NOW()`. ts-fsrs returns UTC Date objects by default
**Warning signs:** Inconsistent card appearance timing

### Pitfall 6: Review Session Concurrency
**What goes wrong:** User starts /review, then sends another message, corrupting session state
**Why it happens:** In-memory session map updated by interleaved handlers
**How to avoid:** Lock session per chatId -- ignore non-review messages while session is active, or handle gracefully with "you have an active review session" message
**Warning signs:** Wrong card shown, duplicate ratings

## Code Examples

### Due Cards Query
```typescript
// Source: project pattern from existing drizzle queries
import { lte } from 'drizzle-orm';

async function getDueCards(db, limit = 20) {
  return db
    .select({
      cardId: srsCards.id,
      cardType: srsCards.cardType,
      wordId: srsCards.wordId,
      grammarPatternId: srsCards.grammarPatternId,
      // FSRS fields
      state: srsCards.state,
      due: srsCards.due,
      stability: srsCards.stability,
      difficulty: srsCards.difficulty,
      elapsedDays: srsCards.elapsedDays,
      scheduledDays: srsCards.scheduledDays,
      reps: srsCards.reps,
      lapses: srsCards.lapses,
      lastReview: srsCards.lastReview,
    })
    .from(srsCards)
    .where(lte(srsCards.due, new Date()))
    .orderBy(srsCards.due)
    .limit(limit);
}
```

### Vocabulary Card with Context Sentence
```typescript
// Fetch word + original sentence for review display
async function getVocabCardData(db, wordId: number) {
  const wordRows = await db
    .select({
      lemma: words.lemma,
      translation: words.translation,
      cefrLevel: words.cefrLevel,
      sentenceText: sentences.text,
    })
    .from(words)
    .innerJoin(sentenceWords, eq(words.id, sentenceWords.wordId))
    .innerJoin(sentences, eq(sentenceWords.sentenceId, sentences.id))
    .where(eq(words.id, wordId))
    .limit(1);
  return wordRows[0] ?? null;
}
```

### Cloze Exercise AI Generation Schema
```typescript
// Zod schema for AI-generated cloze exercises
import { z } from 'zod';

export const clozeExerciseSchema = z.object({
  exercises: z.array(z.object({
    sentence: z.string().describe('Complete English sentence using the grammar pattern, with the key part replaced by "___"'),
    answer: z.string().describe('The correct word(s) that fill the blank'),
    difficulty: z.number().min(1).max(3).describe('1=simple/common usage, 2=moderate context, 3=complex/unusual usage'),
    hint: z.string().optional().describe('Optional brief hint for the learner'),
  })),
});

export type ClozeExercises = z.infer<typeof clozeExerciseSchema>;
```

### Cloze Generation Prompt
```typescript
export const CLOZE_SYSTEM_PROMPT = `You are an English grammar exercise generator for a Russian-speaking learner at B1-B2 level.

Generate fill-in-the-blank (cloze) exercises for the given grammar pattern.

Rules:
- Each sentence must naturally use the grammar pattern
- Replace the key grammatical element with "___"
- Difficulty 1: simple, everyday sentences
- Difficulty 2: moderate complexity, varied contexts
- Difficulty 3: complex sentences with subordinate clauses or unusual usage
- Sentences should be realistic, not textbook-artificial
- Provide the exact answer that fills the blank`;

export function buildClozePrompt(pattern: string, description: string, count: number): string {
  return `Generate ${count} cloze exercises for this grammar pattern:

Pattern: ${pattern}
Description: ${description}

Generate exercises across all 3 difficulty levels.`;
}
```

### Telegram Review Flow
```typescript
// /review command handler
bot.command('review', async (ctx) => {
  const dueCards = await apiClient.getDueCards();
  if (dueCards.length === 0) {
    await ctx.reply('No cards due for review! Come back later.');
    return;
  }

  reviewSessions.set(ctx.chat.id, {
    cards: dueCards,
    currentIndex: 0,
    revealed: false,
  });

  await showCard(ctx, dueCards[0]);
});

async function showCard(ctx, card: DueCard) {
  if (card.cardType === 'vocabulary') {
    // Show word + context, hide translation
    const text = `<b>${escapeHtml(card.lemma)}</b>\n\n` +
      `<i>"${escapeHtml(card.sentenceText)}"</i>`;
    const keyboard = new InlineKeyboard()
      .text('Show answer', `rv:${card.cardId}`);
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } else {
    // Grammar: show cloze exercise
    const text = `Fill in the blank:\n\n${escapeHtml(card.clozeSentence)}`;
    const keyboard = new InlineKeyboard()
      .text('Show answer', `rv:${card.cardId}`);
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

// After reveal, show rating buttons
async function showRating(ctx, cardId: number, answer: string) {
  const keyboard = new InlineKeyboard()
    .text('Again', `rt:${cardId}:1`)
    .text('Hard', `rt:${cardId}:2`)
    .text('Good', `rt:${cardId}:3`)
    .text('Easy', `rt:${cardId}:4`);
  // Edit message to show answer + rating buttons
}
```

## New Database Schema Required

### grammar_exercises table
```typescript
// src/db/schema/grammar-exercises.ts
export const grammarExercises = pgTable('grammar_exercises', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  grammarPatternId: integer('grammar_pattern_id').notNull().references(() => grammarPatterns.id),
  sentence: text().notNull(),        // Full sentence with "___" for the gap
  clozeAnswer: text('cloze_answer').notNull(),  // Correct answer
  difficultyLevel: integer('difficulty_level').notNull().default(1), // 1-3
  hint: text(),                       // Optional hint
  used: boolean().default(false),     // Track if already shown to user
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### review_logs table (optional but recommended)
```typescript
// Track review history for analytics (Phase 5 dashboard)
export const reviewLogs = pgTable('review_logs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  srsCardId: integer('srs_card_id').notNull().references(() => srsCards.id),
  rating: integer().notNull(),        // 1-4 (Again/Hard/Good/Easy)
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  state: cardStateEnum().notNull(),   // State before review
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SM-2 algorithm | FSRS v6 | 2023-2024 | Better retention prediction, fewer reviews needed |
| ts-fsrs v3 (Node 16) | ts-fsrs v4 (Node 18+) | 2024 | Added `next()` method for single-rating calculation |
| `repeat()` for all outcomes | `next()` for single rating | ts-fsrs v4 | More efficient -- compute only the rating user selected |

**Deprecated/outdated:**
- SM-2 / SuperMemo: FSRS outperforms on all benchmarks. Project already decided on FSRS (STATE.md)
- `generatorParameters()`: Use `fsrs()` factory directly with parameter object

## Open Questions

1. **SRS card creation timing for grammar patterns**
   - What we know: Vocabulary cards should be created when user saves a word (after familiarity selection)
   - What's unclear: Should grammar pattern SRS cards be created automatically during sentence analysis (when pattern is first extracted), or only when the user explicitly opts in?
   - Recommendation: Auto-create grammar SRS cards when patterns are first saved. Grammar exercises are the core differentiator of this app. User can skip/dismiss during review if unwanted.

2. **Exercise batch size**
   - What we know: Need enough exercises to avoid exhaustion, but AI costs matter
   - What's unclear: Optimal batch size per difficulty level
   - Recommendation: Generate 6 exercises per pattern (2 per difficulty level). Replenish when unused count drops below 3.

3. **Collocations in SRS**
   - What we know: Collocations are stored as independent units (Phase 2). SRS cards have wordId and grammarPatternId.
   - What's unclear: Should collocations have their own SRS cards?
   - Recommendation: Defer to Phase 4 implementation -- add collocationId to srs_cards if time permits, otherwise treat as v2 feature. Current card_type enum only has 'vocabulary' and 'grammar'.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --testPathPattern=srs` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRS-01 | FSRS scheduling: create card, rate, check new due date | unit | `npm test -- tests/srs-service.test.ts -t "schedules"` | No - Wave 0 |
| SRS-02 | Vocab flashcard flow: fetch due card with word data | integration | `npm test -- tests/review-api.test.ts -t "vocabulary"` | No - Wave 0 |
| SRS-03 | Cloze exercise: AI generates valid fill-in-blank | unit | `npm test -- tests/exercise-generator.test.ts` | No - Wave 0 |
| SRS-04 | Batch pre-generation: exercises created via worker job | integration | `npm test -- tests/exercise-worker.test.ts` | No - Wave 0 |
| SRS-05 | Context sentence: word review includes original sentence | integration | `npm test -- tests/review-api.test.ts -t "context"` | No - Wave 0 |
| SRS-06 | Difficulty progression: exercises ordered by difficulty level | unit | `npm test -- tests/srs-service.test.ts -t "progression"` | No - Wave 0 |
| SRS-07 | Telegram /review: bot command starts review session | unit | `npm test -- tests/bot-review.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/srs-service.test.ts tests/review-api.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/srs-service.test.ts` -- covers SRS-01, SRS-06 (FSRS card operations, state mapping)
- [ ] `tests/review-api.test.ts` -- covers SRS-02, SRS-05 (review routes with word context)
- [ ] `tests/exercise-generator.test.ts` -- covers SRS-03 (cloze schema validation, mock AI)
- [ ] `tests/exercise-worker.test.ts` -- covers SRS-04 (BullMQ job processing)
- [ ] `tests/bot-review.test.ts` -- covers SRS-07 (Telegram review flow)
- [ ] Framework install: `npm install ts-fsrs` -- new dependency

## Sources

### Primary (HIGH confidence)
- [ts-fsrs GitHub](https://github.com/open-spaced-repetition/ts-fsrs) - Core API, Card type, Rating enum, State enum, scheduling functions
- [ts-fsrs DeepWiki](https://deepwiki.com/open-spaced-repetition/ts-fsrs/2-ts-fsrs-package-(typescript-scheduler)) - Complete API documentation with all types and parameters
- Existing project codebase - Schema (srs-cards.ts), AI integration patterns (analyze-sentence.ts), bot patterns (vocabulary.ts)

### Secondary (MEDIUM confidence)
- [ts-fsrs npm](https://www.npmjs.com/package/ts-fsrs) - Version, compatibility info

### Tertiary (LOW confidence)
- None -- all findings verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ts-fsrs is already decided (STATE.md), all other libs already in project
- Architecture: HIGH - follows established project patterns (BullMQ workers, Drizzle schema, grammY handlers)
- Pitfalls: HIGH - state enum mismatch verified by comparing srs-cards.ts schema vs ts-fsrs API docs
- Cloze generation: MEDIUM - AI prompt design is based on existing project patterns but untested

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable libraries, no fast-moving dependencies)
