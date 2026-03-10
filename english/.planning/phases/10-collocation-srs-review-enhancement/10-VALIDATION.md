---
phase: 10
slug: collocation-srs-review-enhancement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts |
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
| 10-01-01 | 01 | 1 | CSRS-01 | integration | `npx vitest run tests/collocation-srs.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | CSRS-02 | integration | `npx vitest run tests/collocation-review.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | CSRS-03 | integration | `npx vitest run tests/grammar-review-enhanced.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/collocation-srs.test.ts` — stubs for CSRS-01 (collocation card auto-creation in analysis)
- [ ] `tests/collocation-review.test.ts` — stubs for CSRS-02 (collocation card enrichment in review)
- [ ] `tests/grammar-review-enhanced.test.ts` — stubs for CSRS-03 (grammar card back enhancement)

*Note: Tests require running PostgreSQL and Redis (`docker compose up -d postgres redis`). Uses existing `buildTestApp/cleanupTestApp` helpers.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collocation cards render correctly in /review UI | CSRS-02 | Visual layout verification | Open /review, flip collocation card, verify front shows text+context, back shows translation+type |
| Grammar cards show enriched back side | CSRS-03 | Visual layout verification | Open /review, flip grammar card, verify pattern description and example sentence visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
