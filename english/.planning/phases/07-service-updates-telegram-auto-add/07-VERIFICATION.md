---
phase: 07-service-updates-telegram-auto-add
verified: 2026-03-10T08:00:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 07: Service Updates & Telegram Auto-Add Verification Report

**Phase Goal:** New words from sentence analysis are automatically added with SRS cards, no manual selection required
**Verified:** 2026-03-10T08:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When a sentence is analyzed, all extracted words with CEFR >= B1 automatically get SRS cards | VERIFIED | `src/services/analysis.ts` lines 100-128: `shouldAutoAddWord(vocab.cefrLevel)` gates check-then-insert for vocabulary SRS cards inside `storeAnalysisResults` loop |
| 2 | Words with CEFR A1 or A2 do not get SRS cards automatically | VERIFIED | `src/services/cefr-filter.ts` line 20: index < threshold returns false for A1 (idx 0) and A2 (idx 1) vs B1 (idx 2); test at `tests/cefr-filter.test.ts` lines 5-11 |
| 3 | Words with null CEFR level get SRS cards (safe default) | VERIFIED | `src/services/cefr-filter.ts` line 14: `if (cefrLevel === null) return true`; test at `tests/cefr-filter.test.ts` line 29 |
| 4 | Re-analyzing a sentence with the same words does not create duplicate SRS cards | VERIFIED | `src/services/analysis.ts` lines 102-111: select existing card before insert; test at `tests/analysis.test.ts` lines 205-216 asserts 3 cards after two calls |
| 5 | When user submits a sentence in Telegram, the bot shows analysis result without word selection keyboard | VERIFIED | `src/bot/handlers/sentence.ts` lines 35-42: `editMessageText(formatted, { parse_mode: 'HTML' })` with no InlineKeyboard; no import of any keyboard builder |
| 6 | The bot message includes a summary of how many new words were auto-added to SRS | VERIFIED | `src/bot/format.ts` lines 22-25: counts `newCount` and `knownCount` from `hasSrsCard`, displays in header "Vocabulary (N new, M known)" |
| 7 | No vocabulary selection or familiarity callback handlers are registered on the bot | VERIFIED | `src/bot/index.ts` has only 2 registrations: `registerReviewHandlers` and `bot.on('message:text')`. No vocabulary handler import. `src/bot/handlers/vocabulary.ts` is deleted. Grep for `registerVocabularyHandlers|initSelection|buildWordSelectionKeyboard` across src/ returned zero matches |
| 8 | API endpoints for familiarity and SRS card creation remain intact for web UI use | VERIFIED | `src/routes/words.ts` and `src/routes/review.ts` both exist (confirmed via filesystem check) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/cefr-filter.ts` | CEFR threshold filtering function | VERIFIED | 21 lines, exports `shouldAutoAddWord` and `MIN_CEFR_FOR_AUTO_ADD`, substantive logic with CEFR_ORDER array |
| `src/services/analysis.ts` | Auto-SRS card creation in storeAnalysisResults | VERIFIED | 263 lines, imports and uses `shouldAutoAddWord`, check-then-insert pattern at lines 100-128 |
| `tests/cefr-filter.test.ts` | Unit tests for CEFR filtering | VERIFIED | 40 lines, 9 test cases covering all CEFR levels, null, invalid, and constant export |
| `tests/analysis.test.ts` | Integration tests for auto-SRS creation | VERIFIED | 246 lines, 3 new tests: auto-create B1+ (line 149), no-duplicate (line 205), grammar preserved (line 218) |
| `src/bot/handlers/sentence.ts` | Simplified sentence handler showing read-only analysis result | VERIFIED | 72 lines, displays formatted result via editMessageText, no keyboard construction |
| `src/bot/index.ts` | Bot setup without vocabulary handler registration | VERIFIED | 31 lines, no vocabulary handler import or registration |
| `tests/bot-vocabulary.test.ts` | Updated tests for simplified flow | VERIFIED | 15 lines, verifies vocabulary.ts and analysis.ts keyboard files are deleted |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/analysis.ts` | `src/services/cefr-filter.ts` | `import shouldAutoAddWord` | WIRED | Line 19: `import { shouldAutoAddWord } from './cefr-filter.ts'`; used at line 101 |
| `src/services/analysis.ts` | srs_cards table | check-then-insert for vocabulary cards | WIRED | Lines 102-127: select existing card by cardType+wordSenseId, insert if not found with full FSRS fields |
| `src/bot/handlers/sentence.ts` | `formatAnalysisResult` | import from ../format.ts | WIRED | Line 3: `import { formatAnalysisResult } from '../format.ts'`; used at line 35 |
| `src/bot/index.ts` | `src/bot/handlers/sentence.ts` | createSentenceHandler | WIRED | Line 3: `import { createSentenceHandler } from './handlers/sentence.ts'`; used at line 15 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TG-01 | 07-01, 07-02 | All new words automatically added with SRS cards during sentence analysis | SATISFIED | `shouldAutoAddWord` filters B1+, `storeAnalysisResults` creates cards, bot shows read-only result |
| TG-02 | 07-01, 07-02 | Known words (existing SRS card) are not duplicated | SATISFIED | Check-then-insert pattern in analysis.ts prevents duplicates; test confirms 3 cards after two analyses |

No orphaned requirements found. REQUIREMENTS.md maps TG-01 and TG-02 to Phase 7 (lines 86-87), both marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | No anti-patterns detected | -- | -- |

No TODO, FIXME, placeholder, stub, or empty implementation patterns found in any phase files.

### Human Verification Required

### 1. Telegram Bot End-to-End Flow

**Test:** Send a real English sentence to the Telegram bot
**Expected:** Bot displays formatted analysis with vocabulary (N new, M known), collocations, and grammar sections. No inline keyboard for word selection appears. SRS cards visible in review queue.
**Why human:** Requires running bot with live Telegram API and real AI analysis pipeline

### 2. Web UI Analysis Unchanged

**Test:** Submit a sentence through the web UI
**Expected:** Analysis works as before. Word familiarity and SRS card creation endpoints still functional for web use.
**Why human:** Requires running full stack and verifying web flow is not broken by bot changes

### Gaps Summary

No gaps found. All 8 observable truths verified. All artifacts exist, are substantive, and are properly wired. Both requirements (TG-01, TG-02) are satisfied. All 4 commits verified in git history. No anti-patterns detected.

---

_Verified: 2026-03-10T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
