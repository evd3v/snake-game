---
phase: 04-spaced-repetition-exercises
verified: 2026-03-09T21:02:00Z
status: passed
score: 7/7 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 04: Spaced Repetition Exercises Verification Report

**Phase Goal:** User can review saved vocabulary and grammar through FSRS-scheduled flashcards and AI-generated cloze exercises
**Verified:** 2026-03-09T21:02:00Z
**Status:** passed
**Re-verification:** Yes -- re-verification confirming previous passed result

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FSRS scheduling creates cards, rates them, and computes correct next due dates | VERIFIED | `src/services/srs.ts` line 88: `scheduler.next(card, now, rating)` with module-level `const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true })`. 7 SRS tests pass including state transitions and due date verification. |
| 2 | State mapping between DB string enum and ts-fsrs numeric enum is correct | VERIFIED | `toFsrsCard` maps new->0, learning->1, review->2, relearning->3 (lines 9-14). `toDbState` reverses (lines 16-21). Tests confirm both directions. |
| 3 | AI generates cloze exercises with difficulty levels 1-3 for a grammar pattern | VERIFIED | `src/services/exercise-generator.ts` calls `generateText` with `Output.object({ schema: clozeExerciseSchema })` (line 17). Zod schema validates difficulty `z.number().int().min(1).max(3)`. Stores results in grammar_exercises. 7 exercise tests pass. |
| 4 | Due vocabulary cards can be fetched via API with word data and original sentence context | VERIFIED | `src/routes/review.ts` GET /review/due joins words -> sentenceWords -> sentences (lines 29-41) for vocabulary cards. Review API tests pass. |
| 5 | Rating a card via API updates its FSRS scheduling | VERIFIED | POST /review/:cardId/rate validates rating 1-4 via JSON schema (lines 105-106), calls `rateCard()` (line 125), returns `{ success: true, nextDue }` (line 149). Grammar exercises marked as used on rate. |
| 6 | When user saves a word with familiarity, an SRS card is auto-created | VERIFIED | `src/bot/handlers/vocabulary.ts` line 125: `await apiClient.createSrsCard(wordId)` after `setFamiliarity()`, wrapped in try/catch. Route POST /words/:wordId/srs-card uses onConflictDoNothing for idempotency. |
| 7 | User types /review in Telegram and sees due cards with reveal/rate flow | VERIFIED | `src/bot/handlers/review.ts` implements full session: /review command (line 67), rv: reveal callback (line 107), rt: rate callback (line 132), rs: end session (line 181). Registered in `src/bot/index.ts` line 16 before message:text handler. 11 bot-review tests pass. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/srs.ts` | FSRS card lifecycle | VERIFIED | 131 lines. Exports createSrsCard, rateCard, getDueCards, toFsrsCard, toDbState, Rating. Uses ts-fsrs ^5.2.3. |
| `src/db/schema/grammar-exercises.ts` | grammar_exercises table | VERIFIED | 13 lines. Table with id, grammarPatternId (FK), sentence, clozeAnswer, difficultyLevel, hint, used, createdAt. |
| `src/db/schema/review-logs.ts` | review_logs table | VERIFIED | 13 lines. Table with id, srsCardId (FK), rating, elapsedDays, scheduledDays, state, reviewedAt. |
| `src/services/exercise-generator.ts` | AI cloze generation | VERIFIED | 39 lines. Exports generateClozeExercises. Uses generateText + Output.object pattern. Inserts rows into grammar_exercises. |
| `src/lib/ai/cloze-schemas.ts` | Zod schema for cloze output | VERIFIED | 26 lines. Exports clozeExerciseSchema with exercises array (sentence, answer, difficulty 1-3, optional hint). Type exported. |
| `src/lib/ai/cloze-prompts.ts` | System and user prompts | VERIFIED | 29 lines. Exports CLOZE_SYSTEM_PROMPT (B1-B2 level, difficulty rules) and buildClozePrompt(pattern, description, count). |
| `src/routes/review.ts` | Review API routes | VERIFIED | 182 lines. GET /review/due with enriched card data, POST /review/:cardId/rate, POST /words/:wordId/srs-card. |
| `src/workers/job-processor.ts` | Worker with generate-exercises job | VERIFIED | Handles both sentence-analysis and generate-exercises job types via switch on job.name. |
| `src/bot/handlers/review.ts` | /review command and callback handlers | VERIFIED | 204 lines. Exports registerReviewHandlers. Full session: formatCardFront, formatCardReveal, formatSessionSummary. |
| `src/bot/keyboards/review.ts` | Inline keyboard builders | VERIFIED | 17 lines. Exports buildRevealKeyboard, buildRatingKeyboard, buildEndSessionKeyboard. |
| `src/db/schema/index.ts` | Barrel exports | VERIFIED | Exports grammarExercises (line 7) and reviewLogs (line 8) from new schema files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/services/srs.ts | ts-fsrs | scheduler.next() | WIRED | Line 88: `scheduler.next(card, now, rating)` with module-level scheduler |
| src/services/srs.ts | src/db/schema/srs-cards.ts | drizzle insert/select/update | WIRED | Lines 51, 77, 92: insert, select, update on srsCards table |
| src/services/exercise-generator.ts | src/lib/ai/cloze-schemas.ts | clozeExerciseSchema | WIRED | Line 3: import, line 17: used in Output.object({ schema: clozeExerciseSchema }) |
| src/routes/review.ts | src/services/srs.ts | getDueCards, rateCard imports | WIRED | Line 8: `import { getDueCards, rateCard, createSrsCard, Rating }` |
| src/bot/handlers/vocabulary.ts | src/bot/services/api-client.ts | createSrsCard API call | WIRED | Line 125: `await apiClient.createSrsCard(wordId)` after familiarity set |
| src/workers/job-processor.ts | src/services/exercise-generator.ts | generate-exercises job | WIRED | Imports generateClozeExercises, calls it in generate-exercises case |
| src/bot/handlers/review.ts | src/bot/services/api-client.ts | getDueCards, rateCard | WIRED | Lines 80, 150: `apiClient.getDueCards(20)`, `apiClient.rateCard(cardId, rating)` |
| src/bot/handlers/review.ts | src/bot/keyboards/review.ts | keyboard builders | WIRED | Line 4: imports all three keyboard builders, used throughout handler |
| src/bot/index.ts | src/bot/handlers/review.ts | registerReviewHandlers | WIRED | Line 5: import, line 16: `registerReviewHandlers(bot)` before message:text handler |
| src/services/analysis.ts | srsCards + BullMQ queue | Auto-create grammar SRS cards + queue exercises | WIRED | Lines 158-195: checks for existing card, creates if new, queues generate-exercises job |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SRS-01 | 04-01 | FSRS algorithm for scheduling reviews | SATISFIED | ts-fsrs ^5.2.3 in package.json. Scheduler configured with request_retention=0.9, enable_fuzz=true. Full card lifecycle tested. |
| SRS-02 | 04-02 | Flashcard review for vocabulary (show word, recall translation, rate) | SATISFIED | Review API returns vocabulary cards with word data. Bot handler shows word front, reveals translation, accepts rating 1-4. |
| SRS-03 | 04-01 | Cloze exercises for grammar patterns (AI-generated sentence with gap) | SATISFIED | exercise-generator.ts generates cloze exercises via AI, stores in grammar_exercises with sentence containing "___" and answer. |
| SRS-04 | 04-02 | Exercises pre-generated in batches (not at review time) | SATISFIED | BullMQ generate-exercises job queued during analysis when grammar pattern SRS card is first created. Worker processes asynchronously. |
| SRS-05 | 04-02 | Original book sentence shown as context during word review | SATISFIED | GET /review/due joins words -> sentenceWords -> sentences to fetch sentenceText. Bot formats it as italic quote in card front. |
| SRS-06 | 04-01 | Grammar pattern progression (simple to complex variations) | SATISFIED | Grammar exercises ordered by difficultyLevel ASC when fetching unused exercises (routes/review.ts line 79). Difficulty levels 1-3 validated by Zod schema. |
| SRS-07 | 04-03 | Quick review session available in Telegram bot | SATISFIED | /review command starts session, shows cards one by one, reveal/rate flow, session summary with ratings breakdown. 11 bot-review tests pass. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODO, FIXME, placeholder, or empty implementation patterns detected in phase artifacts.

### Human Verification Required

### 1. End-to-End Review Flow in Telegram

**Test:** Send /review in Telegram with some due vocabulary and grammar cards in the database
**Expected:** First card appears with "Show answer" button. Tapping reveal shows translation/answer. Rating buttons appear. After rating, next card shows. After all cards, summary with counts displays.
**Why human:** Bot interaction requires actual Telegram API, message formatting, and inline keyboard rendering.

### 2. AI Exercise Quality

**Test:** Trigger exercise generation for a real grammar pattern and review the generated exercises
**Expected:** Exercises are natural English sentences with appropriate blanks, answers are correct, difficulty levels feel appropriately graded
**Why human:** AI output quality cannot be verified programmatically -- requires linguistic judgment.

### 3. FSRS Scheduling Feel Over Time

**Test:** Review a card multiple times with different ratings and observe due date changes
**Expected:** "Again" shortens intervals, "Good"/"Easy" extends them, stability increases with consistent correct answers
**Why human:** FSRS parameter tuning and scheduling feel require observation over multiple review cycles.

### Gaps Summary

No gaps found. All 7 observable truths verified. All 11 artifacts exist, are substantive, and properly wired. All 10 key links confirmed. All 7 requirements (SRS-01 through SRS-07) satisfied. All 90 tests pass across 15 test files with no regressions. No anti-patterns detected.

---

_Verified: 2026-03-09T21:02:00Z_
_Verifier: Claude (gsd-verifier)_
