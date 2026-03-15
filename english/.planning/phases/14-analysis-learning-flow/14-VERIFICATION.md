---
phase: 14-analysis-learning-flow
verified: 2026-03-15T11:00:00Z
status: human_needed
score: 5/5
human_verification:
  - test: "Tap sentence in reader, verify modal opens with AI analysis"
    expected: "Loading spinner appears, then translation + new words/collocations/grammar with learn/know buttons"
    why_human: "Requires running app, AI service, and database with real data"
  - test: "Tap same sentence again after analysis"
    expected: "Modal opens instantly with cached result (no spinner)"
    why_human: "Requires verifying timing/caching behavior at runtime"
  - test: "Press Learn on a word, close modal, check highlight color"
    expected: "Word highlight changes from blue (new) to yellow (learning) immediately"
    why_human: "Visual/runtime behavior cannot be verified statically"
  - test: "Turn page after learning words, verify mini-report"
    expected: "PageReport toast shows non-zero counts, auto-dismisses after 3s"
    why_human: "Timing and visual overlay behavior"
  - test: "Verify dark theme works in modal"
    expected: "Modal inherits CSS custom properties, looks correct in dark mode"
    why_human: "Visual appearance check"
---

# Phase 14: Analysis & Learning Flow Verification Report

**Phase Goal:** Users tap sentences to get AI analysis and explicitly decide which words to learn, completing the LingQ-style read-and-learn loop
**Verified:** 2026-03-15T11:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tapping a sentence opens a modal with AI analysis: translation, new words with POS, grammar patterns, and collocations | VERIFIED | ReaderView.vue `openSentence()` calls `apiPost('/books/sentences/${id}/analyze')`, AnalysisModal.vue renders translation, newWords with POS badge, newCollocations, newGrammarPatterns |
| 2 | Re-tapping an already-analyzed sentence loads cached result instantly without an AI call | VERIFIED | books.ts line 263: checks `bookSentence.sentenceId`, if set calls `getFilteredAnalysis()` and returns 200 directly |
| 3 | Modal shows only NEW words/collocations with learn/know buttons; learn creates SRS card, know marks familiarity | VERIFIED | reader-analysis.ts filters by `familiarity === 'never_seen' && srs_card_id === null`; books.ts `/reader/words/:senseId/learn` creates SRS card + sets `seen_unsure`; `/know` sets `understand_in_context` |
| 4 | Word highlighting updates immediately after closing the analysis modal | VERIFIED | ReaderView.vue `updateHighlightStatus()` modifies local `pageData.value.sentences[].highlights` on learn/know without re-fetch |
| 5 | Page turn shows mini-report with counts of words learned, marked known, and grammar patterns found | VERIFIED | ReaderView.vue `goNext()` checks `hasStats`, shows PageReport component with promise-based dismiss before loading next page |

**Score:** 5/5 truths verified (automated checks)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `drizzle/0007_analysis_link.sql` | sentence_id FK on book_sentences | VERIFIED | 2 lines: ALTER TABLE + CREATE INDEX |
| `src/services/reader-analysis.ts` | Filtering logic for new vs existing items | VERIFIED | 156 lines, exports `getFilteredAnalysis`, batch queries for words/collocations/grammar with SRS card checks |
| `src/routes/books.ts` | Analyze, learn, know endpoints | VERIFIED | 8 endpoints: analyze, status, learn/know for words/collocations/grammar |
| `src/services/analysis.ts` | autoCreateSrsCards option | VERIFIED | `StoreOptions` interface, destructured with default `true`, guards all 3 SRS creation blocks |
| `src/workers/job-processor.ts` | bookSentenceId handling | VERIFIED | Passes `autoCreateSrsCards: !bookSentenceId`, links book_sentences after analysis |
| `src/db/schema/books.ts` | sentenceId column | VERIFIED | `sentenceId: integer('sentence_id').references(() => sentences.id)` |
| `web/src/components/reader/AnalysisModal.vue` | Analysis display with learn/know buttons | VERIFIED | 432 lines, translation box, new words/collocations/grammar sections, learn/know buttons with status labels |
| `web/src/components/reader/PageReport.vue` | Mini-report overlay on page turn | VERIFIED | 116 lines, auto-dismiss 3s, shows non-zero stats only, themed via CSS custom properties |
| `web/src/views/ReaderView.vue` | Modal integration, page stats tracking, highlight refresh | VERIFIED | Imports AnalysisModal + PageReport, polling logic, local highlight updates, pageStats tracking |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/routes/books.ts` | `src/workers/job-processor.ts` | `analysisQueue.add` | WIRED | Line 269: `fastify.analysisQueue.add('sentence-analysis', { text, bookSentenceId })` |
| `src/workers/job-processor.ts` | `src/services/analysis.ts` | `autoCreateSrsCards` option | WIRED | Line 18: `storeAnalysisResults(db, text, sourceBook, analysis, { autoCreateSrsCards: !bookSentenceId })` |
| `src/routes/books.ts` | `src/services/reader-analysis.ts` | `getFilteredAnalysis` for cached results | WIRED | Line 264 and 300: `getFilteredAnalysis(fastify.db, sentenceId)` |
| `web/src/views/ReaderView.vue` | `/books/sentences/:id/analyze` | `apiPost` on sentence click | WIRED | Line 113: `apiPost('/books/sentences/${id}/analyze')` |
| `web/src/components/reader/AnalysisModal.vue` | `/reader/words/:id/learn` | `apiPost` on learn button click | WIRED | ReaderView `handleLearn` calls `apiPost('/reader/${segment}/${id}/learn')` on modal `learn` event |
| `web/src/views/ReaderView.vue` | `web/src/components/reader/PageReport.vue` | `pageStats` reactive state shown on goNext | WIRED | `pageStats` incremented in handleLearn/handleKnow, passed as prop to PageReport, shown conditionally in goNext |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ANAL-01 | 14-01, 14-02 | Tap sentence opens modal with AI analysis | SATISFIED | Analyze endpoint queues job, modal shows results |
| ANAL-02 | 14-01, 14-02 | Re-tap loads cached result instantly | SATISFIED | sentence_id FK check returns filtered results without AI call |
| ANAL-03 | 14-01, 14-02 | Only new words shown with learn/know buttons | SATISFIED | getFilteredAnalysis filters by familiarity + SRS card existence |
| ANAL-04 | 14-01, 14-02 | Collocations and grammar also have learn/know | SATISFIED | Modal shows all three types with identical learn/know pattern |
| FLOW-01 | 14-02 | Page turn mini-report with counts | SATISFIED | PageReport component, promise-based dismiss in goNext |
| FLOW-02 | 14-01, 14-02 | All words shown regardless of CEFR level | SATISFIED | `autoCreateSrsCards: false` for reader path, no `shouldAutoAddWord` in reader endpoints |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected |

### Human Verification Required

### 1. Full Analysis Flow

**Test:** Open reader, tap a sentence, verify modal shows AI analysis results
**Expected:** Loading spinner, then translation + new words with POS/definition + collocations + grammar patterns, each with Learn/Know buttons
**Why human:** Requires running app with AI service and populated database

### 2. Caching Behavior

**Test:** Tap same sentence again after first analysis
**Expected:** Modal opens instantly with no loading spinner (cached path returns 200)
**Why human:** Requires runtime verification of timing behavior

### 3. Highlight Update After Learn/Know

**Test:** Press Learn on a word, close modal, observe text highlights
**Expected:** Word changes from blue (new) to yellow (learning); Know removes highlight entirely
**Why human:** Visual rendering behavior

### 4. Page Turn Report

**Test:** Analyze sentences and learn/know items, then turn page
**Expected:** Mini-report toast shows counts (e.g., "+2 to learn, 1 marked known"), auto-dismisses after 3 seconds
**Why human:** Timing and overlay visual behavior

### 5. Dark Theme Modal

**Test:** Toggle dark theme, open analysis modal
**Expected:** Modal background, text, borders all use dark theme CSS custom properties
**Why human:** Visual appearance verification

### Gaps Summary

No automated gaps found. All artifacts exist, are substantive (not stubs), and are properly wired together. The complete read-and-learn loop is implemented end-to-end: sentence tap triggers analysis (cached or queued), modal displays filtered results with learn/know actions, highlights update locally, and page turn shows a summary report.

Human verification is needed to confirm runtime behavior: AI analysis returns correct data, polling works smoothly, visual theming is correct, and the overall UX flow feels right.

---

_Verified: 2026-03-15T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
