---
phase: 11
slug: grammar-collocations-browse-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- tests/grammar-api.test.ts tests/collocations-api.test.ts -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/grammar-api.test.ts tests/collocations-api.test.ts -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | BROWSE-01 | integration | `npm test -- tests/grammar-api.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | BROWSE-02 | integration | `npm test -- tests/collocations-api.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | BROWSE-03 | integration | `npm test -- tests/grammar-api.test.ts tests/collocations-api.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/grammar-api.test.ts` — stubs for BROWSE-01, BROWSE-03 (grammar filters)
- [ ] `tests/collocations-api.test.ts` — stubs for BROWSE-02, BROWSE-03 (collocation filters)
- Both should use `buildTestApp/cleanupTestApp` helpers from `tests/helpers/setup.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grammar page renders with CEFR badges, SRS status, examples | BROWSE-01 | UI visual layout | Navigate to /grammar, verify list items show pattern, CEFR badge, SRS state, example sentences |
| Collocations page renders with type, translation, examples | BROWSE-02 | UI visual layout | Navigate to /collocations, verify list items show text, type badge, translation, example sentences |
| Filter dropdowns and search input work on both pages | BROWSE-03 | UI interaction | Test CEFR dropdown, type dropdown (collocations), text search on both pages |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
