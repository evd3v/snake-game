---
phase: 2
slug: ai-analysis-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | VOCAB-01 | unit | `npm test -- tests/lemmatizer.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | SENT-03 | integration | `npm test -- tests/analysis.test.ts -t "returns structured analysis"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | SENT-04 | integration | `npm test -- tests/analysis.test.ts -t "extracts collocations"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | SENT-05 | integration | `npm test -- tests/analysis.test.ts -t "identifies grammar patterns"` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 0 | SENT-06 | integration | `npm test -- tests/word-family.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 0 | SENT-07 | integration | `npm test -- tests/analysis.test.ts -t "assigns thematic clusters"` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 0 | VOCAB-04 | integration | `npm test -- tests/analysis.test.ts -t "links words to sentence"` | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 0 | VOCAB-05 | integration | `npm test -- tests/analysis.test.ts -t "stores collocations independently"` | ❌ W0 | ⬜ pending |
| 02-01-09 | 01 | 0 | VOCAB-06 | integration | `npm test -- tests/word-family.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-10 | 01 | 0 | VOCAB-07 | integration | `npm test -- tests/analysis.test.ts -t "groups words into clusters"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lemmatizer.test.ts` — unit tests for lemma normalization with POS routing
- [ ] `tests/analysis.test.ts` — integration tests for full analysis pipeline (mock AI, verify DB state)
- [ ] `tests/word-family.test.ts` — integration tests for word family linking logic
- [ ] `tests/sentences-api.test.ts` — API endpoint tests for POST /sentences and GET /sentences/:jobId/status
- [ ] AI response mocking strategy: mock `generateText` or use fixture-based approach

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI quality of analysis | SENT-03 | AI output quality is subjective | Submit 5 varied sentences, review translation accuracy and CEFR assignment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
