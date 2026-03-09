# Requirements: English Learning App

**Defined:** 2026-03-09
**Core Value:** User inputs a real sentence from a book and gets full analysis (translation, grammar, vocabulary, CEFR), with extracted items feeding into spaced repetition — all in one flow.

## v1 Requirements

### Sentence Analysis

- [ ] **SENT-01**: User can input an English sentence via web UI
- [ ] **SENT-02**: User can input an English sentence via Telegram bot
- [ ] **SENT-03**: AI analyzes sentence and returns: translation, grammar breakdown, vocabulary, CEFR level
- [ ] **SENT-04**: AI extracts collocations and phrasal verbs as separate units
- [ ] **SENT-05**: AI identifies grammar patterns with specific notation (e.g. "would have + V3")
- [ ] **SENT-06**: AI detects word families and links related forms (reluctance → reluctant, reluctantly)
- [ ] **SENT-07**: AI assigns thematic cluster to extracted vocabulary

### Vocabulary

- [ ] **VOCAB-01**: Words stored as lemmas with automatic deduplication
- [ ] **VOCAB-02**: User selects which words to save after analysis
- [ ] **VOCAB-03**: User sets familiarity level on add: "never seen" / "seen but unsure" / "understand in context"
- [ ] **VOCAB-04**: Each word linked to original sentence(s) where encountered
- [ ] **VOCAB-05**: Collocations and phrasal verbs stored as independent learnable units
- [ ] **VOCAB-06**: Word families linked in database (one root → multiple forms)
- [ ] **VOCAB-07**: Words auto-grouped into thematic clusters

### Spaced Repetition

- [ ] **SRS-01**: FSRS algorithm for scheduling reviews
- [ ] **SRS-02**: Flashcard review for vocabulary (show word → recall translation → rate)
- [ ] **SRS-03**: Cloze exercises for grammar patterns (AI-generated sentence with gap)
- [ ] **SRS-04**: Exercises pre-generated in batches (not at review time)
- [ ] **SRS-05**: Original book sentence shown as context during word review
- [ ] **SRS-06**: Grammar pattern progression (simple → complex variations)
- [ ] **SRS-07**: Quick review session available in Telegram bot

### Dashboard

- [ ] **DASH-01**: Overall progress counters (new / learning / known) for words and patterns
- [ ] **DASH-02**: Weak spots: grammar patterns and words with low success rate
- [ ] **DASH-03**: Activity streak and heatmap (days in a row, daily reviews/additions)
- [ ] **DASH-04**: Thematic cluster coverage gaps

### Infrastructure

- [ ] **INFRA-01**: PostgreSQL database with Drizzle ORM
- [ ] **INFRA-02**: Fastify REST API backend (TypeScript)
- [ ] **INFRA-03**: Vue 3 + TypeScript SPA frontend
- [ ] **INFRA-04**: Telegram bot via grammY library
- [ ] **INFRA-05**: Docker Compose deployment configuration
- [ ] **INFRA-06**: Async AI processing (queue-based, non-blocking)

## v2 Requirements

### Advanced Analysis

- **ADV-01**: Reading session tracking (link sentences to specific books)
- **ADV-02**: Automatic CEFR level estimation for user based on known vocabulary
- **ADV-03**: Book difficulty recommendation based on current level

### Advanced Review

- **REV-01**: Multiple exercise types (translation, sentence building, matching)
- **REV-02**: Adaptive difficulty based on user performance trends

### Social / Export

- **EXP-01**: Export vocabulary to Anki deck
- **EXP-02**: Share progress statistics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app | Web + Telegram bot is sufficient for personal use |
| Audio / pronunciation | Focus is on reading comprehension and grammar |
| Multiple users / auth | Personal tool, single user |
| Book tracking / progress per book | Adds complexity, not core to learning flow |
| Real-time chat with AI | Structured analysis is more effective than freeform chat |
| Gamification (badges, XP) | Streak + heatmap is enough motivation for personal use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SENT-01 | — | Pending |
| SENT-02 | — | Pending |
| SENT-03 | — | Pending |
| SENT-04 | — | Pending |
| SENT-05 | — | Pending |
| SENT-06 | — | Pending |
| SENT-07 | — | Pending |
| VOCAB-01 | — | Pending |
| VOCAB-02 | — | Pending |
| VOCAB-03 | — | Pending |
| VOCAB-04 | — | Pending |
| VOCAB-05 | — | Pending |
| VOCAB-06 | — | Pending |
| VOCAB-07 | — | Pending |
| SRS-01 | — | Pending |
| SRS-02 | — | Pending |
| SRS-03 | — | Pending |
| SRS-04 | — | Pending |
| SRS-05 | — | Pending |
| SRS-06 | — | Pending |
| SRS-07 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |
| INFRA-06 | — | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 0
- Unmapped: 31 ⚠️

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after initial definition*
