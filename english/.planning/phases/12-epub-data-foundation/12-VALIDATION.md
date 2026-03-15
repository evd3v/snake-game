---
phase: 12
slug: epub-data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- tests/books-api.test.ts tests/epub-parser.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/books-api.test.ts tests/epub-parser.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | EPUB-02 | unit | `npm test -- tests/epub-parser.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | EPUB-01 | integration | `npm test -- tests/books-api.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | EPUB-03 | integration | `npm test -- tests/books-api.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | EPUB-04 | integration | `npm test -- tests/books-api.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/epub-parser.test.ts` — unit tests for EPUB parsing and sentence splitting (EPUB-02)
- [ ] `tests/books-api.test.ts` — integration tests for book CRUD endpoints (EPUB-01, EPUB-03, EPUB-04)
- [ ] `tests/fixtures/test.epub` — small test EPUB file for testing
- [ ] `npm install epub2 cheerio sbd @fastify/multipart` — dependencies needed before tests run

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cover image renders correctly in UI | EPUB-03 | Visual verification | Upload book, check library view shows cover |
| File upload UX flow | EPUB-01 | UI interaction | Upload via web interface, verify feedback |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
