---
phase: 5
slug: web-application-and-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 (already configured in project root) |
| **Config file** | `vitest.config.ts` (exists at project root) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + `cd web && npm run build` succeeds
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | INFRA-03 | smoke | `cd web && npm run build` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DASH-01 | unit | `npm test -- tests/dashboard-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | DASH-02 | unit | `npm test -- tests/dashboard-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | DASH-03 | unit | `npm test -- tests/dashboard-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | DASH-04 | unit | `npm test -- tests/dashboard-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | SENT-01 | integration | `npm test -- tests/sentences-api.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/` project scaffolded with Vite + Vue 3 + TypeScript — covers INFRA-03
- [ ] `tests/dashboard-api.test.ts` — stubs for DASH-01, DASH-02, DASH-03, DASH-04

*Wave 0 creates test stubs and project scaffolding before feature work begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard visually renders charts correctly | DASH-01, DASH-02 | Visual rendering fidelity | Open dashboard in browser, verify charts show data with correct labels |
| Activity heatmap displays correct colors | DASH-03 | Visual color gradient | Add review data, verify heatmap cells show appropriate intensity |
| Cluster view layout readable | DASH-04 | Visual layout | Verify cluster view groups are readable and coverage gaps highlighted |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
