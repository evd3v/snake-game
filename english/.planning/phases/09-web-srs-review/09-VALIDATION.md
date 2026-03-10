---
phase: 9
slug: web-srs-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --reporter=verbose tests/review-api.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/review-api.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | WREV-06 | unit | `npm test -- tests/review-api.test.ts` | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 1 | WREV-01 | unit (API) | `npm test -- tests/review-api.test.ts` | ✅ | ⬜ pending |
| 9-01-03 | 01 | 1 | WREV-02 | unit (API) | `npm test -- tests/review-api.test.ts` | ✅ | ⬜ pending |
| 9-01-04 | 01 | 1 | WREV-03 | unit (API) | `npm test -- tests/review-api.test.ts` | ✅ | ⬜ pending |
| 9-02-01 | 02 | 1 | WREV-04 | manual | N/A | N/A | ⬜ pending |
| 9-02-02 | 02 | 1 | WREV-05 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/review-api.test.ts` — add staleness guard test (409 on stale rate) for WREV-06
- No new test files needed. Existing review-api tests cover WREV-01 through WREV-03 API behavior.
- No Vue test framework in project (no vitest browser mode, no @vue/test-utils). Frontend testing is manual-only per project conventions.

*Existing infrastructure covers WREV-01, WREV-02, WREV-03. Only WREV-06 staleness guard needs a new test.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress bar renders during session | WREV-04 | No Vue test framework in project | Navigate to /review, start session, verify progress bar increments as cards are rated |
| Summary screen shows rating counts | WREV-05 | No Vue test framework in project | Complete a review session, verify summary shows counts per rating (Again/Hard/Good/Easy) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
