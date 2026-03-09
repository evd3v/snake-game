---
phase: 1
slug: foundation-and-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0 |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-01 | integration | `npx vitest run tests/db.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-02 | integration | `npx vitest run tests/health.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | INFRA-05 | smoke/manual | `docker compose up -d && curl http://localhost:3000/health` | ❌ manual | ⬜ pending |
| 01-01-04 | 01 | 1 | INFRA-06 | integration | `npx vitest run tests/queue.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework configuration
- [ ] `tests/helpers/setup.ts` — shared test utilities (app builder, db cleanup)
- [ ] `tests/health.test.ts` — covers INFRA-02
- [ ] `tests/db.test.ts` — covers INFRA-01 (schema existence, migration check)
- [ ] `tests/queue.test.ts` — covers INFRA-06 (job enqueue + process)
- [ ] Framework install: `npm install -D vitest`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker Compose brings up full environment | INFRA-05 | Requires running Docker daemon and container orchestration | 1. Run `docker compose up -d` 2. Wait for healthy status 3. `curl http://localhost:3000/health` 4. Verify 200 response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
