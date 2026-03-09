---
phase: 3
slug: telegram-bot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/bot-*.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/bot-*.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | INFRA-04 | unit | `npm test -- tests/bot-setup.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SENT-02 | unit | `npm test -- tests/bot-sentence.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | VOCAB-02 | unit | `npm test -- tests/bot-vocabulary.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | VOCAB-03 | unit | `npm test -- tests/bot-vocabulary.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SENT-02/VOCAB-02 | unit | `npm test -- tests/words-api.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/bot-setup.test.ts` — stubs for INFRA-04 (bot creation, handler registration)
- [ ] `tests/bot-sentence.test.ts` — stubs for SENT-02 (message handling, API calls, polling)
- [ ] `tests/bot-vocabulary.test.ts` — stubs for VOCAB-02, VOCAB-03 (keyboard building, callback handling, familiarity updates)
- [ ] `tests/words-api.test.ts` — stubs for new API routes (word listing, familiarity update)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Telegram message flow | SENT-02 | Requires live Telegram bot connection | Send a sentence to bot, verify analysis result appears |
| Inline keyboard interaction | VOCAB-02 | Requires live Telegram client | Tap word buttons, verify selection persists |
| Familiarity level selection | VOCAB-03 | Requires live Telegram client | Select familiarity for saved word, verify DB update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
