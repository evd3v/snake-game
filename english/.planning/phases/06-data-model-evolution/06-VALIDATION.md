---
phase: 6
slug: data-model-evolution
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-00-01 | 00 | 0 | DATA-01, DATA-02 | stub | `npm test -- tests/word-senses.test.ts` | Created in W0 | ⬜ pending |
| 6-01-01 | 01 | 1 | DATA-01 | integration | `npm test -- tests/word-senses.test.ts` | ✅ (from W0) | ⬜ pending |
| 6-01-02 | 01 | 1 | DATA-02 | integration | `npm test -- tests/word-senses.test.ts` | ✅ (from W0) | ⬜ pending |
| 6-01-03 | 01 | 1 | DATA-03 | integration | `npm test -- tests/db.test.ts` | ✅ (needs update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/word-senses.test.ts` — stubs for DATA-01, DATA-02: multi-POS insertion, independent SRS per sense (Plan 06-00)
- [x] Update `tests/db.test.ts` — add `word_senses` to expected tables list (Plan 06-02 Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| *None* | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
