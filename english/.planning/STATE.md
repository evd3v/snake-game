---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: EPUB Reader & LingQ-style Learning
status: in_progress
stopped_at: Completed 14-01-PLAN.md
last_updated: "2026-03-15T07:32:42Z"
last_activity: 2026-03-15 — Completed 14-01 Analysis Learning Flow Backend
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** User reads a real book in EPUB reader, gets AI analysis of each sentence (translation, grammar, vocabulary, collocations), with extracted items feeding into spaced repetition -- learning through reading in context.
**Current focus:** Phase 14 - Analysis Learning Flow

## Current Position

Phase: 14 of 14 (Analysis Learning Flow)
Plan: 1 of 2 complete (Phase 14)
Status: In progress
Last activity: 2026-03-15 — Completed 14-01 Analysis Learning Flow Backend

Progress: [████████░░] 83%

## Performance Metrics

**Velocity:**
- Total plans completed: 31 (v1.0 + v1.1 + v2.0)
- Average duration: 3.5min
- Total execution time: ~1.7 hours

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06 | 3 | 14min | 4.7min |
| 07 | 2 | 3min | 1.5min |
| 08 | 2 | 6min | 3min |
| 09 | 2 | 4min | 2min |
| 10 | 2 | 8min | 4min |
| 11 | 2 | 6min | 3min |

| 12 | 2 | 5min | 2.5min |
| 13 | 2 | 4min | 2min |
| 14 | 1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: P12-01 (4min), P12-02 (1min), P13-01 (3min), P13-02 (1min), P14-01 (3min)
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
- [12-01]: Used createRequire for epub2 CJS import in ESM project
- [12-01]: Synchronous EPUB processing (no queue) -- parsing is fast, no AI calls
- [12-01]: Pre-computed page numbers on sentences (groups of 6, merge short final pages)
- [Phase 12]: Styled label as upload button with hidden file input for clean UX
- [13-01]: Raw SQL batch query for vocabulary lookup (words + word_senses + srs_cards JOIN)
- [13-01]: Status priority: learning > new > known -- most actionable status wins for multi-sense words
- [Phase 13]: CSS custom properties for dark/light theming with .dark class toggle
- [14-01]: Raw SQL for getFilteredAnalysis following word-highlighter batch pattern
- [14-01]: autoCreateSrsCards default true preserves backward compatibility

### Pending Todos

None yet.

### Blockers/Concerns

- ~~EPUB parser choice not finalized~~ -- resolved: using epub2
- ~~Sentence splitter choice not finalized~~ -- resolved: using sbd
- Lemma mismatch risk between reader tokenization and existing vocabulary -- needs centralized matching function
- Proper noun flooding in reader (character names show as "new") -- needs ignore mechanism in Phase 13/14

## Session Continuity

Last session: 2026-03-15T07:32:42Z
Stopped at: Completed 14-01-PLAN.md
Resume file: None
