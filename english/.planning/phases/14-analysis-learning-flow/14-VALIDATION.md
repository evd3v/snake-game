---
phase: 14
slug: analysis-learning-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual testing (no automated test framework in project) |
| **Config file** | none |
| **Quick run command** | `curl` against API endpoints |
| **Full suite command** | Manual end-to-end reader testing |
| **Estimated runtime** | ~30 seconds per manual flow |

---

## Sampling Rate

- **After every task commit:** Manual test against running dev server
- **After every plan wave:** Full reader flow: upload book, read page, tap sentences, mark words, check highlights, turn page, verify report
- **Before `/gsd:verify-work`:** All 6 requirements manually verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | ANAL-02 | smoke | `curl -X POST /books/sentences/:id/analyze` (twice, second=200) | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | ANAL-01 | manual | N/A - UI interaction | N/A | ⬜ pending |
| 14-01-03 | 01 | 1 | ANAL-03 | manual | N/A - UI verification | N/A | ⬜ pending |
| 14-01-04 | 01 | 1 | ANAL-04 | manual | N/A - UI verification | N/A | ⬜ pending |
| 14-02-01 | 02 | 1 | FLOW-01 | manual | N/A - frontend state | N/A | ⬜ pending |
| 14-02-02 | 02 | 1 | FLOW-02 | smoke | Verify analysis results include A1/A2 words | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `drizzle/0007_analysis_link.sql` — migration to add sentence_id FK to book_sentences
- [ ] No automated test infrastructure needed (project uses manual testing throughout)

*Existing infrastructure covers automated test requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tap sentence opens analysis modal | ANAL-01 | Requires touch/click interaction on reader UI | 1. Open reader 2. Tap sentence 3. Verify modal opens with translation, words, grammar, collocations |
| Modal shows only NEW items | ANAL-03 | Requires vocabulary state context | 1. Mark some words as known 2. Analyze sentence containing those words 3. Verify they don't appear in modal |
| Collocations/grammar with learn/know | ANAL-04 | Requires UI verification | 1. Analyze sentence 2. Verify collocations and grammar sections have buttons 3. Press each button type |
| Page turn mini-report | FLOW-01 | Frontend-only state | 1. Analyze sentences on a page 2. Mark some words 3. Turn page 4. Verify counts overlay |
| Highlight update after modal close | SC-4 | Visual verification | 1. Note word color 2. Analyze and mark 3. Close modal 4. Verify color changed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
