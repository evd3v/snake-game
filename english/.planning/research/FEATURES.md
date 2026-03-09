# Feature Research

**Domain:** AI-powered reading-based English learning app (Telegram bot + web)
**Researched:** 2026-03-09
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that a reading-based learning tool must have. Without these, the product is broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sentence input with translation | Core loop: user enters sentence, gets translation. Without it there is no product. | LOW | LLM API call with structured output. Straightforward. |
| Vocabulary extraction from sentences | Every reading-based tool (LingQ, Readlang) does this. Users paste text, words get saved. | MEDIUM | Requires lemmatization, POS tagging, deduplication. LLM handles this well in a single prompt. |
| Vocabulary list with status tracking | LingQ has 4 stages (New/Learning/Familiar/Known). Minimum viable: 3 levels as specified in PROJECT.md. | LOW | CRUD on vocab entries with status field. Simple DB + UI. |
| Spaced repetition for vocabulary | Every SRS-based learning app has this. Users expect words to resurface at optimal intervals. | MEDIUM | Use FSRS over SM-2 -- 20-30% fewer reviews for same retention. `ts-fsrs` npm package is mature and well-maintained. |
| Basic flashcard review (word -> meaning) | Most basic review format. Users expect to be able to drill vocabulary. | LOW | Front/back card with FSRS scheduling. Standard pattern. |
| Context display during review | Showing the original sentence where word was encountered. LingQ and Readlang both do this. | LOW | Store sentence-word relationship. Display during review. |
| CEFR level estimation per sentence | Users at B1-B2 targeting C1 need to understand difficulty. Standard in language learning. | LOW | LLM estimates CEFR reliably. Include in sentence analysis prompt. |
| Progress dashboard (basic stats) | Word counts by status, review streak, activity over time. Every learning app tracks this. | MEDIUM | Aggregate queries + chart UI. Heat map and streak are standard. |
| Telegram bot for sentence input | Specified as core entry point. Bot must accept text and return analysis. | MEDIUM | Telegram Bot API, session management, formatted response. Use inline keyboards for actions. |

### Differentiators (Competitive Advantage)

Features that set this apart from Anki + LingQ + Readlang. These align with the project's core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI grammar pattern extraction and tracking | LingQ and Anki ignore grammar entirely. Extracting patterns like "would have + V3" from real sentences and tracking mastery across encounters is genuinely novel for a personal tool. | HIGH | LLM extracts patterns from sentences. Need a pattern taxonomy/normalization scheme so "would have gone" and "would have seen" map to the same pattern. DB schema for patterns with progression tracking. |
| Collocation and phrasal verb extraction | Moving beyond isolated words to multi-word units. LingQ tracks individual words; this tracks "make a decision" as a unit. Critical for C1 level. | HIGH | LLM identifies collocations, phrasal verbs, idioms per sentence. Deduplication is hard -- "make a decision" vs "make decisions" need to resolve to the same collocation. |
| Word families linking | Connecting "reluctance", "reluctant", "reluctantly" as a family. No mainstream app does this automatically. Reduces cognitive overhead by showing related forms together. | MEDIUM | LLM can identify word family relationships. Store as graph edges. Surface during review: "You know reluctant -- here's reluctantly." |
| AI-generated exercises (cloze, grammar drills) | Not just flashcards. Fill-in-the-blank for grammar patterns, sentence reordering, collocation matching. Generated in batches to save API costs. | HIGH | Batch generation via LLM. Research shows ~75% well-formedness rate for LLM-generated cloze items (GPT study, arxiv 2403.02078). Need quality filtering. Pre-generate and cache exercises. |
| Thematic vocabulary clusters | Auto-grouping words by topic (legal, medical, emotions). Shows gaps: "you know 15 food words but only 2 emotion words." | MEDIUM | LLM assigns topic tags during extraction. Aggregate by cluster for dashboard. Value is in the gap analysis visualization. |
| Grammar pattern progression within topics | Tracking that user has seen "Past Perfect" in 12 sentences, got 8/10 exercises right, and showing mastery level per pattern. Not just "you reviewed this" but "you understand this." | MEDIUM | Requires exercise results feeding back into pattern mastery scores. FSRS can be applied to grammar patterns, not just vocab. |
| Adaptive difficulty in exercises | Exercises that match current level -- easy for well-known patterns, challenging for weak spots. | MEDIUM | Use FSRS difficulty + retrievability scores to select what to practice. LLM generates exercises at appropriate difficulty. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time AI response during review | Feels "smart" -- AI generates exercise on the spot | Adds 2-5s latency per review card. Kills flow. Burns tokens. At personal budget, unsustainable for daily use. | Batch-generate exercises ahead of time. Pre-compute next 50 reviews with exercises. |
| Audio/pronunciation features | Complete language learning experience | Massively increases scope. TTS quality varies. Focus is reading comprehension, not speaking. PROJECT.md explicitly excludes this. | Link to external pronunciation resources if needed. |
| Book tracking and progress | Know which books you've read, track pages | Adds complexity without improving learning. Sentence-level input doesn't need book metadata. PROJECT.md excludes this. | User can tag sentences informally if desired. |
| Social features / leaderboards | Motivation through competition | Single user app. Social features require auth, profiles, privacy. PROJECT.md explicitly excludes. | Streak and personal stats provide sufficient motivation. |
| Gamification (XP, levels, badges) | Duolingo-style engagement | Distracts from actual learning. Single user doesn't need artificial motivation loops. Adds UI complexity. | Simple streak counter and progress percentages are enough. |
| Native mobile app | Better mobile experience | Web app + Telegram bot covers mobile use cases. Native app doubles development effort. | PWA if mobile web needs improvement later. |
| Multiple language support | Broader appeal | Single user learning English. Multi-language adds DB complexity, prompt engineering per language. | Hard-code English as target language. |
| Grammar explanations / lessons | Educational completeness | Turns tool into a course. User is B1-B2, not a beginner. They need pattern recognition, not grammar lessons. | Link to external grammar references. Show pattern examples from user's own sentences. |
| Importing full texts / ebooks | Read inside the app like LingQ | Massive feature: text rendering, pagination, word highlighting, position tracking. LingQ's core and took years. | Sentence-by-sentence input is the design choice. Keep it simple. |
| AI conversation practice | Trendy in 2025-2026 apps | Out of scope. Reading focus, not speaking. | Not applicable for this product. |

## Feature Dependencies

```
[Sentence Input + AI Analysis]
    +-- requires --> [LLM Integration (structured output)]
    +-- produces --> [Vocabulary Extraction]
    |                   +-- requires --> [Lemmatization + Dedup]
    |                   +-- produces --> [Vocabulary List]
    |                                       +-- enables --> [Flashcard Review]
    |                                       +-- enables --> [Spaced Repetition (FSRS)]
    |                                       +-- enables --> [Word Family Linking]
    +-- produces --> [Collocation Extraction]
    |                   +-- requires --> [Lemmatization + Dedup]
    |                   +-- enables --> [Collocation Review Cards]
    +-- produces --> [Grammar Pattern Extraction]
    |                   +-- requires --> [Pattern Taxonomy/Normalization]
    |                   +-- enables --> [Pattern Tracking + Progression]
    |                   +-- enables --> [Grammar Exercises (cloze)]
    +-- produces --> [CEFR Level Estimation]

[Spaced Repetition (FSRS)]
    +-- enables --> [Flashcard Review]
    +-- enables --> [Exercise Scheduling]

[AI Exercise Generation (batch)]
    +-- requires --> [Vocabulary List]
    +-- requires --> [Grammar Pattern Extraction]
    +-- requires --> [LLM Integration]
    +-- produces --> [Cloze Exercises]
    +-- produces --> [Collocation Matching Exercises]

[Progress Dashboard]
    +-- requires --> [Vocabulary List] (word counts by status)
    +-- requires --> [Spaced Repetition] (review history)
    +-- requires --> [Grammar Pattern Tracking] (pattern mastery)
    +-- enhanced-by --> [Thematic Clusters] (gap analysis)

[Telegram Bot]
    +-- uses --> [Sentence Input + AI Analysis]
    +-- independent-of --> [Web Dashboard]
    +-- shares-backend --> [Web Application]
```

### Dependency Notes

- **AI Analysis requires LLM Integration:** All extraction (vocab, grammar, collocations) happens in a single LLM call per sentence. This is the foundational capability.
- **Flashcard Review requires both Vocabulary List and FSRS:** Cannot review what hasn't been extracted; cannot schedule without FSRS.
- **Exercise Generation requires Pattern Extraction:** Grammar exercises need identified patterns to generate targeted cloze tests.
- **Dashboard requires all data sources:** Must be built after vocab, review, and pattern tracking are functional.
- **Telegram Bot and Web App share backend:** They are two frontends to the same API. Build API first, then both clients.
- **Word Families enhance Vocabulary List:** Not required for vocab to work, but improves the experience by grouping related words.
- **Thematic Clusters enhance Dashboard:** Not required for dashboard, but enables gap analysis view.

## MVP Definition

### Launch With (v1)

Minimum viable product -- enough to replace manual Anki workflow.

- [ ] **Sentence input via Telegram bot** -- core entry point while reading
- [ ] **AI analysis per sentence** -- translation, vocabulary extraction with lemmas, CEFR level
- [ ] **Vocabulary storage with status tracking** -- 3 levels (new / learning / know)
- [ ] **Basic web UI for vocabulary list** -- view, search, change status
- [ ] **FSRS-based flashcard review in web UI** -- word -> meaning cards with original sentence context
- [ ] **Basic progress stats** -- total words, words per status, daily count

### Add After Validation (v1.x)

Features to add once the core input-review loop works.

- [ ] **Collocation and phrasal verb extraction** -- add after vocab extraction is proven reliable
- [ ] **Grammar pattern extraction and tracking** -- requires pattern taxonomy; add once sentence analysis prompts are stable
- [ ] **Word family linking** -- connect related word forms; add once vocab dedup is solid
- [ ] **AI-generated cloze exercises** -- batch-generate fill-in-the-blank; add once grammar patterns are tracked
- [ ] **Review streak and heat map** -- engagement features for the dashboard
- [ ] **Thematic vocabulary clusters** -- auto-grouping + gap analysis

### Future Consideration (v2+)

Features to defer until the system is mature.

- [ ] **Grammar pattern progression and mastery scores** -- needs sufficient data (100+ sentences with patterns)
- [ ] **Adaptive exercise difficulty** -- needs exercise history to calibrate
- [ ] **Dashboard gap analysis by thematic clusters** -- needs enough vocabulary to show meaningful patterns
- [ ] **Exercise type variety** -- sentence reordering, collocation matching, error correction
- [ ] **Telegram bot inline review** -- quick review sessions inside Telegram (complex UX in chat)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sentence input + AI analysis | HIGH | MEDIUM | P1 |
| Telegram bot for input | HIGH | MEDIUM | P1 |
| Vocabulary extraction with lemmas | HIGH | MEDIUM | P1 |
| Vocabulary list with status | HIGH | LOW | P1 |
| FSRS flashcard review | HIGH | MEDIUM | P1 |
| Context display in review | HIGH | LOW | P1 |
| CEFR level estimation | MEDIUM | LOW | P1 |
| Basic progress stats | MEDIUM | LOW | P1 |
| Collocation extraction | HIGH | HIGH | P2 |
| Grammar pattern extraction | HIGH | HIGH | P2 |
| Word family linking | MEDIUM | MEDIUM | P2 |
| AI cloze exercise generation | HIGH | HIGH | P2 |
| Review streak + heat map | MEDIUM | LOW | P2 |
| Thematic clusters | MEDIUM | MEDIUM | P2 |
| Pattern mastery progression | MEDIUM | MEDIUM | P3 |
| Adaptive difficulty | MEDIUM | HIGH | P3 |
| Cluster gap analysis dashboard | MEDIUM | MEDIUM | P3 |
| Exercise type variety | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add after core loop works
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | LingQ | Anki | Readlang | Our Approach |
|---------|-------|------|----------|--------------|
| Sentence/text input | Full text import + reader UI | Manual card creation | Web reader with click-to-translate | Single sentence input via bot or web. Simpler but friction-free. |
| Vocabulary extraction | Click unknown words in text | Manual | Click words in text | AI auto-extracts all relevant vocabulary from sentence |
| Lemmatization | Basic (groups inflections) | None (manual) | Basic | LLM-powered lemmatization with deduplication |
| Collocations | Not tracked | Manual if user creates cards | Not tracked | **AI extracts collocations as first-class learning units** |
| Grammar patterns | Not tracked | Manual if user creates cards | Not tracked | **AI extracts and tracks grammar patterns with progression** |
| Word families | Not tracked | Manual | Not tracked | **Auto-linked word families** |
| Spaced repetition | Custom SRS | SM-2 (default), FSRS (opt-in) | Basic SRS | FSRS via ts-fsrs -- modern, fewer reviews needed |
| Exercise types | Flashcards, cloze (basic) | Flashcards (customizable) | Flashcards | Flashcards + AI-generated cloze + collocation matching |
| CEFR tracking | Not per-sentence | None | None | **Per-sentence CEFR estimation** |
| Progress dashboard | Detailed (words known, reading stats) | Basic (review forecast) | Basic | Words + patterns + clusters + gaps |
| Mobile access | Native apps | Native apps | Web | Telegram bot (mobile input) + web (review + dashboard) |
| Content library | Massive built-in library | None | Web reader | None -- user brings own sentences from books |
| Price | $12.99/mo | Free + addons | $5/mo or free tier | Self-hosted, AI API costs only |

**Key competitive insight:** LingQ and Readlang are strong at text reading interfaces but weak at linguistic analysis. Anki is strong at SRS but requires manual card creation. This project automates the analysis that users currently do manually, and tracks linguistic dimensions (collocations, patterns, word families) that no competitor handles automatically.

## Technical Notes on Key Features

### FSRS vs SM-2
Use FSRS (Free Spaced Repetition Scheduler) instead of SM-2. FSRS was trained on 700M+ reviews from 20K users, produces 20-30% fewer reviews for same retention. The `ts-fsrs` npm package is the canonical TypeScript implementation, actively maintained, supports ESM/CJS/UMD.

### AI Sentence Analysis Prompt Design
A single LLM call per sentence should extract: translation, vocabulary (with lemmas and POS), collocations, grammar patterns, CEFR estimate. Structured JSON output. This is the most token-intensive operation but happens only once per sentence (not during review).

### Exercise Generation Quality
Research (arxiv 2403.02078) shows LLM-generated cloze questions achieve ~75% well-formedness and ~67% suitable distractors. For a personal tool this is acceptable -- user can skip bad exercises. Batch-generate and let FSRS schedule them.

### Collocation Deduplication
Hardest technical challenge. "make a decision" / "make decisions" / "making a decision" must resolve to one collocation. Approach: store canonical form (lemmatized), match new collocations against existing ones using LLM similarity judgment or normalized string matching.

## Sources

- [ts-fsrs npm package](https://www.npmjs.com/package/ts-fsrs) -- TypeScript FSRS implementation
- [FSRS vs SM-2 comparison](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/) -- performance benchmarks
- [awesome-fsrs](https://github.com/open-spaced-repetition/awesome-fsrs) -- FSRS ecosystem
- [LLM cloze generation research](https://arxiv.org/abs/2403.02078) -- exercise generation quality metrics
- [LingQ vs Anki comparison](https://ling-app.com/blog/lingq-vs-anki/) -- competitor analysis
- [LingQ alternatives](https://lingochampion.com/en-US/lingq-alternatives/) -- Readlang comparison
- [Collocation extraction](https://en.wikipedia.org/wiki/Collocation_extraction) -- NLP approaches
- [Top AI language learning apps 2026](https://www.devopsschool.com/blog/top-10-ai-language-learning-apps-in-2025-features-pros-cons-comparison/) -- feature landscape
- [Taalhammer SRS comparison](https://www.taalhammer.com/best-language-learning-apps-with-spaced-repetition-srs-and-ai-in-2025-taalhammer-vs-11-other-apps/) -- SRS app features

---
*Feature research for: AI-powered reading-based English learning app*
*Researched: 2026-03-09*
