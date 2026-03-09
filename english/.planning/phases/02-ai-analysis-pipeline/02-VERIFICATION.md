---
phase: 02-ai-analysis-pipeline
verified: 2026-03-09T12:00:00Z
status: human_needed
score: 15/16 must-haves verified
human_verification:
  - test: "Submit a sentence via POST /sentences, start worker, wait for completion, check GET status returns full result"
    expected: "Job completes with sentenceId and counts, all data stored in PostgreSQL"
    why_human: "Requires running Fastify + BullMQ worker + real AI API key to test end-to-end pipeline"
---

# Phase 2: AI Analysis Pipeline Verification Report

**Phase Goal:** A sentence submitted via API is analyzed by AI and produces structured vocabulary, collocations, grammar patterns, and word families stored in the database
**Verified:** 2026-03-09T12:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | wink-lemmatizer normalizes words to correct lemma based on POS | VERIFIED | `src/lib/lemmatizer.ts` routes by POS with adverb handling; 9 unit tests in `tests/lemmatizer.test.ts` |
| 2  | AI SDK provider factory returns model based on env config | VERIFIED | `src/lib/ai/provider.ts` reads AI_PROVIDER/AI_MODEL env, supports openai/anthropic |
| 3  | Zod schema validates complete sentence analysis structure | VERIFIED | `src/lib/ai/schemas.ts` covers vocabulary, collocations, grammarPatterns, wordFamilies, cefrLevel, translation with .describe() on all fields |
| 4  | analyzeSentence function returns typed structured output | VERIFIED | `src/lib/ai/analyze-sentence.ts` uses generateText + Output.object with sentenceAnalysisSchema, handles NoObjectGeneratedError |
| 5  | AI analysis result is stored as sentence with translation and CEFR level | VERIFIED | `src/services/analysis.ts` inserts into sentences table with text, translation, cefrLevel, sourceBook; integration test confirms |
| 6  | Words are lemmatized, deduplicated, and linked to source sentence | VERIFIED | normalizeLemma called per vocabulary item, onConflictDoUpdate on lemma, sentenceWords junction populated |
| 7  | Collocations are stored as independent units linked to sentence | VERIFIED | Upsert into collocations table + sentenceCollocations junction; collocation type preserved |
| 8  | Grammar patterns are stored with upsert (unique on pattern text) | VERIFIED | onConflictDoUpdate on pattern target, sentenceGrammarPatterns junction populated |
| 9  | Word families are detected and all related words share the same word_family_id | VERIFIED | `src/services/word-family.ts` creates/reuses families, updates words; 2 integration tests confirm |
| 10 | Each word has a thematic cluster assigned | VERIFIED | thematicCluster field in schema, stored in word insert, integration test asserts non-null |
| 11 | Submitting the same word twice does not create duplicates | VERIFIED | onConflictDoUpdate on words.lemma target; dedup test confirms count unchanged after re-submission |
| 12 | Submitting the same collocation twice does not create duplicates | VERIFIED | unique constraint on collocations.text + onConflictDoUpdate; dedup test confirms |
| 13 | POST /sentences accepts text and sourceBook, enqueues BullMQ job, returns 202 with jobId | VERIFIED | `src/routes/sentences.ts` with Fastify schema validation (minLength:1), analysisQueue.add, reply.status(202); 4 API tests |
| 14 | GET /sentences/:jobId/status returns job state and result when completed | VERIFIED | Route gets job, checks state, returns status/result/error; 2 API tests |
| 15 | Worker processes job by calling analyzeSentence then storeAnalysisResults | VERIFIED | `src/workers/index.ts` imports and calls both functions in sequence with concurrency:2 |
| 16 | Full pipeline works end-to-end (submit -> analyze -> store -> status) | ? UNCERTAIN | All pieces verified individually and wired correctly, but end-to-end requires live AI API key and running services |

**Score:** 15/16 truths verified (1 needs human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/ai/provider.ts` | AI provider factory | VERIFIED | 15 lines, exports getModel(), supports openai/anthropic |
| `src/lib/ai/schemas.ts` | Zod schema for analysis output | VERIFIED | 91 lines, exports sentenceAnalysisSchema + SentenceAnalysis type |
| `src/lib/ai/prompts.ts` | System and user prompt templates | VERIFIED | 46 lines, exports SYSTEM_PROMPT + buildUserPrompt with V1/V2/V3 notation |
| `src/lib/ai/analyze-sentence.ts` | Main AI analysis function | VERIFIED | 32 lines, exports analyzeSentence with error handling |
| `src/lib/lemmatizer.ts` | Deterministic lemma normalization | VERIFIED | 45 lines, exports normalizeLemma with POS routing and adverb-ly stripping |
| `tests/lemmatizer.test.ts` | Unit tests for lemmatizer (min 30 lines) | VERIFIED | 40 lines, 9 test cases covering POS routing and edge cases |
| `src/services/analysis.ts` | Analysis storage orchestrator | VERIFIED | 148 lines, exports storeAnalysisResults with full upsert/junction logic |
| `src/services/word-family.ts` | Word family detection and linking | VERIFIED | 72 lines, exports linkWordFamilies with existing family reuse |
| `tests/fixtures/analysis-result.ts` | Mock AI analysis fixture | VERIFIED | 74 lines, exports mockAnalysisResult + MOCK_SENTENCE |
| `tests/analysis.test.ts` | Integration tests for analysis (min 80 lines) | VERIFIED | 157 lines, 8 test cases covering storage, dedup, junctions, families |
| `tests/word-family.test.ts` | Integration tests for word family (min 40 lines) | VERIFIED | 116 lines, 2 test cases covering create and reuse scenarios |
| `src/routes/sentences.ts` | POST/GET sentence endpoints | VERIFIED | 53 lines, exports default Fastify plugin |
| `src/workers/index.ts` | Worker with real analysis pipeline | VERIFIED | 47 lines, imports analyzeSentence + storeAnalysisResults |
| `tests/sentences-api.test.ts` | API endpoint tests (min 40 lines) | VERIFIED | 97 lines, 6 test cases |
| `src/db/schema/collocations.ts` | Unique constraint on text | VERIFIED | `.unique()` on text column confirmed line 12 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `analyze-sentence.ts` | `provider.ts` | imports getModel | WIRED | Line 2: `import { getModel } from './provider.ts'` |
| `analyze-sentence.ts` | `schemas.ts` | imports sentenceAnalysisSchema | WIRED | Line 3: `import { sentenceAnalysisSchema, type SentenceAnalysis } from './schemas.ts'` |
| `analysis.ts` | `lemmatizer.ts` | imports normalizeLemma | WIRED | Line 11: `import { normalizeLemma } from '../lib/lemmatizer.ts'` |
| `analysis.ts` | `schema/index.ts` | imports all table schemas | WIRED | Lines 3-10: imports sentences, words, sentenceWords, collocations, sentenceCollocations, grammarPatterns, sentenceGrammarPatterns |
| `word-family.ts` | `word-families.ts` | imports wordFamilies table | WIRED | Line 3: `import { wordFamilies } from '../db/schema/word-families.ts'` |
| `sentences.ts` (route) | `queue plugin` | fastify.analysisQueue.add | WIRED | Line 20: `fastify.analysisQueue.add('analyze', { text, sourceBook })` |
| `workers/index.ts` | `analyze-sentence.ts` | imports analyzeSentence | WIRED | Line 4: `import { analyzeSentence } from '../lib/ai/analyze-sentence.ts'` |
| `workers/index.ts` | `analysis.ts` | imports storeAnalysisResults | WIRED | Line 5: `import { storeAnalysisResults } from '../services/analysis.ts'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SENT-03 | 02-01, 02-03 | AI analyzes sentence: translation, grammar, vocabulary, CEFR level | SATISFIED | Zod schema covers all fields; analyzeSentence returns structured output; worker calls it |
| SENT-04 | 02-02, 02-03 | AI extracts collocations and phrasal verbs as separate units | SATISFIED | Schema has collocations array with type enum; storeAnalysisResults upserts into collocations table |
| SENT-05 | 02-01, 02-03 | AI identifies grammar patterns with notation (V1/V2/V3) | SATISFIED | SYSTEM_PROMPT specifies notation; schema has grammarPatterns; storage service upserts patterns |
| SENT-06 | 02-02, 02-03 | AI detects word families and links related forms | SATISFIED | Schema has wordFamilies; linkWordFamilies service creates/reuses families; integration tests confirm |
| SENT-07 | 02-02, 02-03 | AI assigns thematic cluster to vocabulary | SATISFIED | Schema has thematicCluster field; stored on word upsert; test asserts non-null |
| VOCAB-01 | 02-01, 02-03 | Words stored as lemmas with automatic deduplication | SATISFIED | normalizeLemma + onConflictDoUpdate on words.lemma; dedup test confirms |
| VOCAB-04 | 02-02, 02-03 | Each word linked to original sentence(s) | SATISFIED | sentenceWords junction table populated per word; test verifies junction count |
| VOCAB-05 | 02-02, 02-03 | Collocations stored as independent learnable units | SATISFIED | Collocations table with unique text, linked via sentenceCollocations junction |
| VOCAB-06 | 02-02, 02-03 | Word families linked in database | SATISFIED | wordFamilies table + words.wordFamilyId FK; linkWordFamilies links related forms |
| VOCAB-07 | 02-02, 02-03 | Words auto-grouped into thematic clusters | SATISFIED | thematicCluster stored per word from AI output |

No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | None found | - | - |

No TODOs, FIXMEs, placeholders, empty implementations, or stub handlers detected in any phase 2 source files.

### Human Verification Required

### 1. End-to-End Pipeline Test

**Test:** Start PostgreSQL, Redis, Fastify server, and BullMQ worker. Set AI_PROVIDER and API key in .env. POST a sentence to `/sentences`, poll `/sentences/:jobId/status` until completed. Query database tables directly to confirm all data stored.
**Expected:** Job completes successfully. Sentence row has translation and CEFR level. Words table has lemmatized entries with thematic clusters. Collocations, grammar patterns, and word families all stored with proper junction links.
**Why human:** Requires live AI API key (OpenAI/Anthropic) and running infrastructure (PostgreSQL + Redis). Cannot verify AI response quality or structured output parsing programmatically without real API call.

### Gaps Summary

No gaps found. All 15 programmatically verifiable truths pass at all three levels (exists, substantive, wired). All 10 requirement IDs are satisfied with implementation evidence. All key links are wired. No anti-patterns detected.

The single remaining item (end-to-end pipeline test) requires human verification with live services and an AI API key, but all component-level and integration-level evidence confirms the pipeline is correctly assembled.

---

_Verified: 2026-03-09T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
