---
phase: 13
slug: reader-word-highlighting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npm test -- tests/reader-api.test.ts tests/word-highlighter.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/reader-api.test.ts tests/word-highlighter.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | READ-01 | integration | `npm test -- tests/reader-api.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | READ-02 | integration | `npm test -- tests/reader-api.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | HIGH-01 | unit | `npm test -- tests/word-highlighter.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | HIGH-02 | integration | `npm test -- tests/reader-api.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | READ-03 | manual-only | N/A | N/A | ⬜ pending |
| 13-02-02 | 02 | 1 | READ-04 | manual-only | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/word-highlighter.test.ts` — unit tests for tokenization and vocabulary matching logic (HIGH-01)
- [ ] `tests/reader-api.test.ts` — integration tests for page data and position endpoints (READ-01, READ-02, HIGH-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark theme toggle | READ-03 | CSS + localStorage, visual verification | Toggle theme button in reader, verify colors change |
| Next button gate | READ-04 | Frontend state logic, visual verification | Open page, verify next disabled, click all sentences, verify next enabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
