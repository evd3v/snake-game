---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: EPUB Reader & LingQ-style Learning
status: not-started
stopped_at: null
last_updated: "2026-03-15T00:00:00Z"
last_activity: 2026-03-15 — Roadmap created for v2.0
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** User reads a real book in EPUB reader, gets AI analysis of each sentence (translation, grammar, vocabulary, collocations), with extracted items feeding into spaced repetition -- learning through reading in context.
**Current focus:** Phase 12 - EPUB Data Foundation

## Current Position

Phase: 12 of 14 (EPUB Data Foundation)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-15 — Roadmap created for v2.0

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 28 (v1.0 + v1.1)
- Average duration: 3.5min
- Total execution time: ~1.6 hours

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06 | 3 | 14min | 4.7min |
| 07 | 2 | 3min | 1.5min |
| 08 | 2 | 6min | 3min |
| 09 | 2 | 4min | 2min |
| 10 | 2 | 8min | 4min |
| 11 | 2 | 6min | 3min |

**Recent Trend:**
- Last 5 plans: P09-02 (2min), P11-01 (3min), P11-02 (3min), P10-01 (3min), P10-02 (5min)
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 research]: Server-side EPUB parsing, NOT client-side epub.js (incompatible with per-sentence interaction)
- [v2.0 research]: Reuse existing analyzeSentence pipeline with autoCreateSrsCards option
- [v2.0 research]: Word highlighting maps to existing word_senses.familiarity enum, no new status dimension
- [v2.0 research]: On-demand analysis (user taps), not eager -- word highlighting needs only DB lookup
- [v2.0 research]: New tables: books, book_chapters, book_sentences, reading_positions

### Pending Todos

None yet.

### Blockers/Concerns

- EPUB parser choice not finalized (epub2 vs @smoores/epub) -- test both during Phase 12 planning
- Sentence splitter choice not finalized (sbd vs @stdlib/nlp-sentencize) -- test during Phase 12
- Lemma mismatch risk between reader tokenization and existing vocabulary -- needs centralized matching function
- Proper noun flooding in reader (character names show as "new") -- needs ignore mechanism in Phase 13/14

## Session Continuity

Last session: 2026-03-15
Stopped at: Roadmap created for v2.0 milestone
Resume file: None
