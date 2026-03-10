---
phase: 7
slug: service-updates-telegram-auto-add
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (implicit, uses package.json script) |
| **Quick run command** | `npm test -- tests/analysis.test.ts tests/bot-vocabulary.test.ts -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/analysis.test.ts tests/bot-vocabulary.test.ts -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | TG-01 | unit | `npm test -- tests/analysis.test.ts -t "auto-create SRS"` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | TG-01 | unit | `npm test -- tests/analysis.test.ts -t "CEFR filter"` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | TG-02 | unit | `npm test -- tests/analysis.test.ts -t "duplicate"` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | TG-01 | unit | `npm test -- tests/bot-vocabulary.test.ts` | ✅ (needs update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/analysis.test.ts` — add test cases for auto-SRS creation with CEFR filtering
- [ ] `tests/analysis.test.ts` — add test cases for duplicate SRS card prevention
- [ ] `tests/bot-vocabulary.test.ts` — update to reflect removal of selection flow

*Existing infrastructure covers framework and fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bot message shows analysis without selection keyboard | TG-01 | Visual UX in Telegram | Send a sentence in Telegram, verify no inline keyboard appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
