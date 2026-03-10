---
phase: 06-data-model-evolution
verified: 2026-03-10T05:30:00Z
status: passed
score: 12/12 must-haves verified
---

# Phase 6: Data Model Evolution Verification Report

**Phase Goal:** Words support multiple parts of speech with independent translations and SRS tracking per sense
**Verified:** 2026-03-10T05:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | word_senses table exists with composite unique on (word_id, part_of_speech) | VERIFIED | `src/db/schema/word-senses.ts` line 12: `unique().on(t.wordId, t.partOfSpeech)` |
| 2 | words table no longer has translation or familiarity columns | VERIFIED | `src/db/schema/words.ts` has only id, lemma, cefrLevel, thematicCluster, wordFamilyId, createdAt; familiarityEnum kept as export only |
| 3 | srs_cards table has word_sense_id column instead of word_id | VERIFIED | `src/db/schema/srs-cards.ts` line 19: `wordSenseId: integer('word_sense_id').references(() => wordSenses.id)` |
| 4 | Existing words migrated to word_senses with POS 'unknown' | VERIFIED | `drizzle/0003_word_senses.sql` line 12-14: INSERT INTO word_senses SELECT id, 'unknown', translation, familiarity FROM words |
| 5 | Existing srs_cards backfilled with word_sense_id | VERIFIED | `drizzle/0003_word_senses.sql` lines 17-21: UPDATE srs_cards SET word_sense_id from word_senses join |
| 6 | Analysis pipeline upserts word then word_sense in two steps | VERIFIED | `src/services/analysis.ts` lines 70-96: Step 1 upserts word on lemma, Step 2 upserts wordSense on (wordId, partOfSpeech) |
| 7 | Reviewing a vocabulary card shows translation and POS from word_senses | VERIFIED | `src/routes/review.ts` lines 28-52: joins wordSenses for translation and partOfSpeech |
| 8 | Creating an SRS card links to word_sense_id, not word_id | VERIFIED | `src/services/srs.ts` line 47: `opts: { wordSenseId?: number; ... }`, line 55: `wordSenseId: opts.wordSenseId` |
| 9 | Dashboard stats/weak-spots/clusters join through word_senses | VERIFIED | `src/routes/dashboard.ts` all 4 raw SQL queries use word_senses joins |
| 10 | GET /sentences/:id/words returns translation, familiarity, POS, senseId from word_senses | VERIFIED | `src/routes/words.ts` lines 14-31: LEFT JOIN wordSenses, returns senseId field |
| 11 | Bot DueCard type includes partOfSpeech field | VERIFIED | `src/bot/services/api-client.ts` line 99: `partOfSpeech: string \| null` in word object |
| 12 | Tests expect word_senses in schema tables | VERIFIED | `tests/db.test.ts` line 41: `'word_senses'` in expectedTables |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/word-senses.ts` | wordSenses table with composite unique | VERIFIED | 13 lines, exports wordSenses, composite unique on (wordId, partOfSpeech) |
| `drizzle/0003_word_senses.sql` | Custom SQL migration with data backfill | VERIFIED | 26 lines, correct order: CREATE, INSERT, ADD COLUMN, UPDATE backfill, DROP old columns |
| `src/routes/review.ts` | Review route joining through word_senses | VERIFIED | Imports wordSenses, joins srs_cards -> word_senses -> words for vocabulary cards |
| `src/routes/dashboard.ts` | Dashboard queries joining through word_senses | VERIFIED | All 4 raw SQL queries updated: stats, weak-spots, clusters use word_senses |
| `src/services/srs.ts` | createSrsCard accepts wordSenseId | VERIFIED | Parameter changed from wordId to wordSenseId |
| `src/db/schema/words.ts` | No translation/familiarity columns | VERIFIED | Only familiarityEnum export remains, columns removed |
| `src/db/schema/srs-cards.ts` | wordSenseId FK replaces wordId | VERIFIED | wordSenseId references wordSenses.id |
| `src/db/schema/index.ts` | Exports wordSenses | VERIFIED | Line 6: `export { wordSenses } from './word-senses.ts'` |
| `src/db/relations.ts` | wordSensesRelations added | VERIFIED | Lines 38-44: one(words), many(srsCards) |
| `src/services/analysis.ts` | Two-step upsert | VERIFIED | Word upsert then wordSense upsert with conflict on composite key |
| `src/bot/services/api-client.ts` | WordInfo/DueCard with partOfSpeech/senseId | VERIFIED | WordInfo has partOfSpeech, senseId; DueCard.word has partOfSpeech |
| `src/bot/handlers/vocabulary.ts` | createSrsCard uses senseId | VERIFIED | Line 127: `apiClient.createSrsCard(wordInfo.senseId)` |
| `tests/db.test.ts` | word_senses in expectedTables | VERIFIED | Includes word_senses, review_logs, grammar_exercises |
| `tests/word-senses.test.ts` | Test stubs exist | VERIFIED | 5 it.todo() tests across 2 describe blocks |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/analysis.ts` | `src/db/schema/word-senses.ts` | import wordSenses, two-step upsert | WIRED | Imports wordSenses from schema/index.ts, uses insert().values().onConflictDoUpdate() |
| `src/db/schema/srs-cards.ts` | `src/db/schema/word-senses.ts` | wordSenseId FK reference | WIRED | `wordSenseId: integer('word_sense_id').references(() => wordSenses.id)` |
| `src/routes/review.ts` | `src/db/schema/word-senses.ts` | join srs_cards -> word_senses -> words | WIRED | Imports wordSenses, innerJoin for vocabulary card enrichment |
| `src/routes/dashboard.ts` | word_senses table | raw SQL joins | WIRED | All 4 queries use `JOIN word_senses ws ON ...` |
| `src/services/srs.ts` | `src/db/schema/srs-cards.ts` | createSrsCard uses wordSenseId | WIRED | opts.wordSenseId passed to srsCards insert |
| `src/bot/handlers/vocabulary.ts` | `src/bot/services/api-client.ts` | createSrsCard(wordInfo.senseId) | WIRED | Line 127: uses senseId from WordInfo to create SRS card |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| DATA-01 | 06-00, 06-01 | Words stored with POS via word_senses table -- one lemma can have multiple senses | SATISFIED | word_senses table with composite unique (word_id, part_of_speech), two-step upsert in analysis |
| DATA-02 | 06-00, 06-02 | SRS cards linked to word_sense not word, each sense tracked independently | SATISFIED | srs_cards.wordSenseId FK, all routes/services use wordSenseId |
| DATA-03 | 06-01 | Migration of existing data -- existing words get senses from existing POS/translation | SATISFIED | Migration SQL backfills word_senses with POS 'unknown' and copies translation/familiarity |

No orphaned requirements found. All three DATA requirements mapped in REQUIREMENTS.md to Phase 6 are accounted for across plans 06-00, 06-01, and 06-02.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/word-senses.test.ts` | 16-24 | 5 it.todo() stubs | Info | Test stubs by design (Wave 0 prerequisite); tests verify schema contracts but are not implemented yet |
| `src/bot/handlers/vocabulary.ts` | 129 | console.error for SRS card creation failure | Info | Appropriate error logging, not a stub |

No blockers or warnings found.

### Human Verification Required

### 1. End-to-End Analysis Flow

**Test:** Submit a sentence via bot or API, verify word_senses rows are created with correct POS
**Expected:** Each vocabulary word gets a word_sense row with its part of speech and translation
**Why human:** Requires running application with database and AI provider

### 2. Dashboard Data Accuracy

**Test:** View dashboard after migration, verify stats/weak-spots/clusters show correct data
**Expected:** Counts and joins through word_senses produce same logical results as pre-migration
**Why human:** Requires populated database with review history

### 3. Bot SRS Card Creation

**Test:** In Telegram bot, analyze a sentence, select words, set familiarity -- verify SRS card created for word_sense
**Expected:** SRS card has word_sense_id set, not null
**Why human:** Requires running bot with API server

### Gaps Summary

No gaps found. All 12 observable truths verified. All 3 requirements satisfied. All key links wired. No blocker anti-patterns detected.

The phase goal "Words support multiple parts of speech with independent translations and SRS tracking per sense" is achieved through:
1. The word_senses table with composite unique constraint enabling multiple POS per lemma
2. Migration of srs_cards from word_id to word_sense_id for per-sense tracking
3. Complete rewiring of all consumers (routes, services, bot, tests) to use the new model
4. Data migration preserving all existing words with POS 'unknown'

---

_Verified: 2026-03-10T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
