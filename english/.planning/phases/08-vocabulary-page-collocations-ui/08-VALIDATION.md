---
phase: 8
slug: vocabulary-page-collocations-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | implicit (package.json script) |
| **Quick run command** | `npm test -- --reporter=verbose tests/vocabulary-api.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/vocabulary-api.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | VOCPG-01 | integration | `npm test -- tests/vocabulary-api.test.ts -t "list"` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | VOCPG-02 | integration | `npm test -- tests/vocabulary-api.test.ts -t "filter"` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | VOCPG-03 | integration | `npm test -- tests/vocabulary-api.test.ts -t "sort"` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | VOCPG-04 | integration | `npm test -- tests/vocabulary-api.test.ts -t "collocation"` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 1 | VOCPG-05 | integration | `npm test -- tests/vocabulary-api.test.ts -t "family"` | ❌ W0 | ⬜ pending |
| 8-02-03 | 02 | 1 | VOCPG-06 | integration | `npm test -- tests/vocabulary-api.test.ts -t "cluster"` | ❌ W0 | ⬜ pending |
| 8-03-01 | 03 | 1 | VOCPG-07 | integration | `npm test -- tests/vocabulary-api.test.ts -t "mark-known"` | ❌ W0 | ⬜ pending |
| 8-03-02 | 03 | 1 | VOCPG-08 | integration | `npm test -- tests/vocabulary-api.test.ts -t "reset"` | ❌ W0 | ⬜ pending |
| 8-04-01 | 04 | 2 | COLL-01 | manual-only | N/A | N/A | ⬜ pending |
| 8-04-02 | 04 | 2 | COLL-02 | manual-only | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/vocabulary-api.test.ts` — stubs for VOCPG-01 through VOCPG-08
- [ ] Test data seeding for collocations linked to words via sentences (shared sentence linking pattern)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentence analysis result shows collocations | COLL-01 | UI visual verification, already renders in AnalysisResult.vue | Open analysis result page, verify collocations section visible |
| Vocabulary word detail shows collocations | COLL-02 | UI visual verification | Open word detail, verify collocations displayed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
