---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 10-02-PLAN.md
last_updated: "2026-03-10T15:52:13.693Z"
last_activity: 2026-03-10 — Completed 10-02 collocation review UI & enrichment
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 13
  completed_plans: 13
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** User inputs a real sentence from a book and gets full analysis (translation, grammar, vocabulary, CEFR), with extracted items feeding into spaced repetition -- all in one flow.
**Current focus:** Phase 10 - Collocation SRS Review Enhancement

## Current Position

Phase: 10 (Collocation SRS Review Enhancement)
Plan: 2 of 2 in current phase
Status: phase-complete
Last activity: 2026-03-10 — Completed 10-02 collocation review UI & enrichment

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 15 (v1.0)
- Average duration: 4min
- Total execution time: ~1 hour

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 9min | 4.5min |
| 02 | 3 | 9min | 3min |
| 03 | 2 | 8min | 4min |
| 04 | 3 | 11min | 3.7min |
| 05 | 3 | 11min | 3.7min |

**Recent Trend:**
- Last 5 plans: 04-02 (5min), 04-03 (3min), 05-01 (4min), 05-02 (3min), 05-03 (4min)
- Trend: Stable

*Updated after each plan completion*
| Phase 06 P00 | 1min | 1 tasks | 1 files |
| Phase 06 P01 | 4min | 2 tasks | 8 files |
| Phase 06 P02 | 9min | 2 tasks | 17 files |
| Phase 07 P01 | 2min | 2 tasks | 4 files |
| Phase 07 P02 | 1min | 2 tasks | 5 files |
| Phase 08 P01 | 3min | 3 tasks | 2 files |
| Phase 08 P02 | 3min | 2 tasks | 6 files |
| Phase 09 P01 | 2min | 2 tasks | 5 files |
| Phase 09 P02 | 2min | 2 tasks | 6 files |
| Phase 11 P01 | 3min | 2 tasks | 4 files |
| Phase 11 P02 | 3min | 3 tasks | 11 files |
| Phase 10 P01 | 3min | 2 tasks | 6 files |
| Phase 10 P02 | 5min | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 roadmap]: Schema migration first -- composite unique on (lemma, partOfSpeech) is prerequisite for all features
- [v1.1 roadmap]: Auto-add uses CEFR filtering to prevent queue flooding (threshold TBD, likely B2+)
- [v1.1 roadmap]: Web review is stateless (fetch-rate-fetch) to avoid SRS conflicts with Telegram
- [v1.0 carry-forward]: Upsert words on lemma conflict updates thematicCluster (AI may refine on re-encounter)
- [v1.0 carry-forward]: Adverb lemmatization strips -ly suffix before adjective lookup
- [Phase 06]: Followed existing test pattern with buildTestApp/cleanupTestApp helpers for word senses stubs
- [Phase 06-01]: word_senses uses composite unique on (word_id, part_of_speech) -- not on lemma+POS
- [Phase 06-01]: Existing words migrated with POS 'unknown' -- actual POS set on re-encounter
- [Phase 06-01]: familiarityEnum kept in words.ts, column moved to word_senses
- [Phase 06-02]: SRS card endpoint renamed from /words/:wordId/srs-card to /word-senses/:wordSenseId/srs-card
- [Phase 06-02]: PATCH /words/:id/familiarity kept for compat but updates word_senses
- [Phase 07]: CEFR auto-add threshold set to B1 -- broader inclusion catches more useful vocabulary
- [Phase 07]: Check-then-insert for vocab SRS dedup (no unique constraint on wordSenseId in srs_cards)
- [Phase 07]: Deleted vocabulary handler and keyboard files entirely rather than emptying them
- [Phase 08]: Batch-fetch strategy: query words first with filters/pagination, then batch senses and SRS cards
- [Phase 08]: SRS state filtering uses EXISTS/NOT EXISTS subqueries for vocabulary card type
- [Phase 08]: Collocations fetched via indirect sentenceWords->sentenceCollocations->collocations with selectDistinct
- [Phase 08]: Slide-out panel overlay for word detail rather than inline expansion
- [Phase 08]: Optimistic UI updates for mark-known and reset actions
- [Phase 09]: 409 skip logic: stale cards silently skipped without counting in session stats
- [Phase 09]: fetchedAt stored once at session start, sent with every rate call for staleness detection
- [Phase 09]: Grammar cards without exercises show pattern title and immediate rating (no reveal step)
- [Phase 11]: Collocations SRS state filter deferred to Phase 10 (collocationId not yet on srs_cards)
- [Phase 10]: No CEFR filter for collocation SRS cards -- all collocations get cards since curated by AI extraction
- [Phase 10]: Check-then-insert dedup for collocation SRS cards (follows Phase 7 convention)

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix sentence analysis flow - full message with translation, collocations, grammar, known/new markers | 2026-03-09 | 28cb7e0 | [1-fix-sentence-analysis-flow-missing-trans](./quick/1-fix-sentence-analysis-flow-missing-trans/) |
| 2 | Deploy server config, bot auth middleware, hourly review notifications | 2026-03-10 | 4186eb6 | [2-deploy-server-notifications-auth](./quick/2-deploy-server-notifications-auth/) |

### Blockers/Concerns

- normalizeLemma() collapses adverbs to adjective form -- may cause POS collisions after migration. Investigate in Phase 6.
- CEFR auto-add threshold not finalized (B1+ vs B2+). Decide during Phase 7 planning.
- Grammar exercise exhaustion may accelerate with web review added. Monitor during Phase 9.

## Session Continuity

Last session: 2026-03-10T18:12:00Z
Stopped at: Completed quick-2 (deploy server, auth, notifications)
Resume file: None
