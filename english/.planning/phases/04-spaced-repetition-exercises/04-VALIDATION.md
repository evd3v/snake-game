---
phase: 4
slug: spaced-repetition-exercises
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --testPathPattern=srs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/srs-service.test.ts tests/review-api.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SRS-01 | unit | `npm test -- tests/srs-service.test.ts -t "schedules"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | SRS-06 | unit | `npm test -- tests/srs-service.test.ts -t "progression"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | SRS-02 | integration | `npm test -- tests/review-api.test.ts -t "vocabulary"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | SRS-05 | integration | `npm test -- tests/review-api.test.ts -t "context"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | SRS-03 | unit | `npm test -- tests/exercise-generator.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | SRS-04 | integration | `npm test -- tests/exercise-worker.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | SRS-07 | unit | `npm test -- tests/bot-review.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/srs-service.test.ts` — stubs for SRS-01, SRS-06 (FSRS card operations, state mapping, difficulty progression)
- [ ] `tests/review-api.test.ts` — stubs for SRS-02, SRS-05 (review routes with word context)
- [ ] `tests/exercise-generator.test.ts` — stubs for SRS-03 (cloze schema validation, mock AI)
- [ ] `tests/exercise-worker.test.ts` — stubs for SRS-04 (BullMQ job processing)
- [ ] `tests/bot-review.test.ts` — stubs for SRS-07 (Telegram review flow)
- [ ] `npm install ts-fsrs` — new dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram review UX feels natural | SRS-07 | UI/UX judgment | Start /review, complete 3 cards, verify flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
