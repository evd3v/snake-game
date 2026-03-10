# Feature Landscape

**Domain:** Language learning app v1.1 -- vocabulary management, web SRS review, collocations UI, Telegram auto-add, multiple POS/translations
**Researched:** 2026-03-10
**Existing system:** AI sentence analysis, Telegram bot (input + word selection + familiarity + /review), FSRS SRS (vocab + grammar cards), web dashboard (stats/heatmap/clusters), web sentence input with word selector. All working in v1.0.

## Table Stakes

Features users expect given v1.0 exists. Missing = the web app feels like a dashboard without a workhorse.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Vocabulary list with search | Users need to see what they have learned; every SRS tool (Anki, LingQ, Memrise) has this | Low | Existing `words` table, `GET /sentences/:id/words` route pattern | Simple paginated list with text search on `lemma` field |
| Filter by familiarity status | LingQ's vocab page filters by status as a core navigation pattern; 3 familiarity levels already in schema | Low | `familiarityEnum` already defined | Dropdown/chip filter on `never_seen`, `seen_unsure`, `understand_in_context` |
| Filter by SRS state | Users need to see "what's due", "what's new", "what's learned" -- standard in every SRS app | Medium | Requires JOIN with `srs_cards` table to get card state per word | States: no card, new, learning, review, relearning |
| Sort options (alpha, date added, CEFR level) | LingQ supports alpha/date/status/importance sorting; minimum viable is alpha + date | Low | Existing columns `lemma`, `createdAt`, `cefrLevel` | Default sort by `createdAt` DESC (newest first) |
| Web SRS review flow (vocab cards) | The bot has /review; web MUST have equivalent -- users expect to review where they study | Medium | Existing `GET /review/due` and `POST /review/:cardId/rate` API endpoints already built | Reuse backend entirely; build Vue card UI with reveal + 4-button rating |
| Web SRS review flow (grammar cloze) | Grammar exercises already generated and served via API; web just needs the UI | Medium | Existing grammar exercise data in `grammar_exercises` table, served by review API | Text input or tap-to-reveal for cloze answer |
| Collocation display on sentence analysis | Collocations are extracted and stored but invisible in web UI; Telegram already shows them (quick-1 fix) | Low | `collocations` + `sentence_collocations` tables populated; need API endpoint + frontend component | Show type badge (collocation/phrasal verb/idiom), text, translation |
| Collocation display on vocabulary page | When viewing a word, seeing its collocations provides the "not just isolated words" value proposition | Medium | Requires query: word -> sentence_words -> sentence_collocations -> collocations | Show inline or expandable per word row |

## Differentiators

Features that set the app apart from generic Anki clones. Not expected, but high value for the C1 reading goal.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Multiple POS/translations per lemma | "run" as verb vs noun have different translations and learning trajectories; most SRS apps treat words as flat strings | High | **Schema change required**: current `words.lemma` has UNIQUE constraint; need `word_senses` table or composite unique on (lemma, pos) | This is the most architecturally impactful feature -- see detailed analysis below |
| Telegram auto-add words (skip familiarity) | Removes friction: user sends sentence, ALL new words auto-added with SRS cards; current flow requires manual selection of each word + familiarity tap | Low | Modify bot `vocabulary.ts` handler; auto-call `createSrsCard` for each new word | Default familiarity to `never_seen`; can still allow manual override later |
| Thematic cluster filter on vocabulary page | Users can browse "all my food words" or "all my emotion words" -- unique to this app's AI clustering | Low | `thematicCluster` column already populated on words | Simple filter/group-by on existing data |
| Session progress bar in web review | Visual feedback during review session (3/15 cards done) with session summary at end | Low | Frontend-only; count from due cards array | Anki shows remaining counts; replicate with simple progress bar |
| Word family links on vocabulary page | Click "reluctant" and see "reluctantly", "reluctance" linked -- unique word family feature | Low | `wordFamilyId` already in schema | Group or link words sharing same `wordFamilyId` |
| Review session stats summary | After completing review, show Again/Hard/Good/Easy breakdown -- mirrors what Telegram bot already does | Low | Frontend-only; track ratings during session | Already implemented in bot's `formatSessionSummary` |
| Keyboard shortcuts for review | Power users review faster with 1/2/3/4 keys instead of clicking buttons | Low | Frontend key event listeners | Anki standard: 1=Again, 2=Hard, 3=Good, 4=Easy |

## Anti-Features

Features to explicitly NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Card template editor (Anki-style) | Single user, fixed card types (vocab + grammar cloze); template flexibility adds complexity without value for personal tool | Hardcode two card templates in Vue components |
| Deck/tag organization | Current architecture uses thematic clusters from AI; manual deck management adds UX overhead for a single user | Use AI-generated thematic clusters as the organizational primitive |
| Audio/pronunciation on cards | Out of scope per PROJECT.md; focus is reading comprehension, not listening/speaking | Defer entirely |
| Gamification (points, streaks on review) | Dashboard already has streak counter; adding XP/levels to review is scope creep | Keep existing streak; no gamification on review flow |
| Bulk import/export | Single user, data enters through sentence analysis only; no Anki import needed | Keep sentence-based input as sole entry point |
| Custom SRS parameters UI | ts-fsrs defaults with `request_retention=0.9` and `enable_fuzz=true` already set; exposing knobs adds complexity | Keep hardcoded FSRS config |
| Collocation SRS cards | Collocations exist as display units but adding them to SRS doubles card volume and requires new card type; better to show them as context for word cards | Show collocations as enrichment on word cards and vocabulary page |

## Feature Dependencies

```
Multiple POS/translations ──> Vocabulary page (needs to display senses correctly)
                          ──> Web review (card front/back must show correct sense)
                          ──> Telegram auto-add (must decide which sense to auto-add)

Vocabulary page ──> Collocation display (collocations shown per-word)
               ──> Word family links (family grouping on vocab page)
               ──> Thematic cluster filter (filter by cluster)

Web SRS review ──> Session stats summary (tracks ratings during session)
              ──> Keyboard shortcuts (keybindings on review UI)
              ──> Progress bar (needs card count from session)

Telegram auto-add ──> (independent, can ship standalone)

Collocations on sentence analysis ──> (independent, extends existing AnalysisResult component)
```

## Detailed Analysis: Multiple POS/Translations

This is the highest-complexity feature and the only one requiring schema changes. Current state:

**Current schema:**
- `words.lemma` is `text().notNull().unique()` -- one row per lemma
- `words.translation` is a single `text()` field
- No POS column exists

**The problem:** "run" (verb, "бежать") and "run" (noun, "пробежка") are the same lemma but different vocabulary items. Currently they collapse into one row.

**Recommended approach -- word senses table:**

The established pattern (WordNet, LingQ, the GlobalSense model from lemma-based dictionary design) is to separate the word form from its senses:

1. Keep `words` table as the lemma anchor (id, lemma, wordFamilyId, createdAt)
2. Add `word_senses` table: (id, wordId FK, pos, translation, cefrLevel, familiarity, thematicCluster)
3. SRS cards point to `word_senses.id` instead of `words.id`
4. Sentence-word junction links to the specific sense encountered

**Why not composite unique (lemma, pos):** Multiple senses can share the same POS ("run" as verb can mean "to move quickly" or "to operate a machine"). The senses table handles this naturally.

**Migration path:**
- Create `word_senses` table
- Migrate existing words: for each word, create one sense row copying translation/cefrLevel/familiarity/thematicCluster
- Update `srs_cards.wordId` to point to sense IDs (or add `wordSenseId` column)
- Update AI analysis pipeline to output POS per word
- Update all queries (vocabulary page, review, Telegram)

**Risk:** This touches every layer. Must be done first if included in v1.1, as all other features depend on the word data model.

**Simpler interim alternative:** Add a `pos` column to `words` and change the unique constraint to `(lemma, pos)`. This handles the most common case (same word as verb vs noun) without a full senses refactor. Loses the ability to track multiple meanings within the same POS, but that is rare at B1-B2 level.

## Detailed Analysis: Web SRS Review UI

Standard flashcard review UI pattern based on Anki/Mochi/every SRS app:

**Card states in UI:**
1. **Front shown** -- word (vocab) or cloze sentence (grammar), context sentence, "Show Answer" button
2. **Answer revealed** -- translation shown (vocab) or answer filled in (grammar), 4 rating buttons appear
3. **Rated** -- card dismissed, next card shown, progress bar advances

**Layout pattern:**
- Single card centered on screen, max-width ~600px
- Front: word/lemma large, context sentence below in italic, CEFR badge
- Reveal transition: answer slides in below (no flip animation needed for web -- flip is a mobile pattern)
- Rating buttons: horizontal row, color-coded (red=Again, orange=Hard, green=Good, blue=Easy)
- Each button shows next review interval ("10m", "1d", "3d", "7d") -- requires computing preview schedules via ts-fsrs

**Session flow:**
1. Fetch due cards (`GET /review/due?limit=20`)
2. Show first card front
3. User clicks "Show Answer" or presses Space
4. User rates (click or keyboard 1-4)
5. `POST /review/:cardId/rate` fires
6. Next card shown; progress bar updates
7. All cards done: show session summary (same as bot's `formatSessionSummary`)

**The backend is already complete.** The review API (`/review/due`, `/review/:cardId/rate`) returns enriched card data with word info, sentence context, grammar exercises. The web UI is purely a frontend task.

## Detailed Analysis: Telegram Auto-Add

Current flow: sentence -> analysis -> word selection keyboard -> user taps each word -> familiarity question per word -> SRS card created.

This is 3-5 taps per word. For 8 words in a sentence, that is 24-40 taps.

**Proposed flow:** sentence -> analysis -> ALL new words auto-added with `familiarity: never_seen` -> SRS cards auto-created -> user sees confirmation message with word count.

**Implementation:**
- In the sentence handler (after analysis job completes), fetch words for sentence
- For each word without an existing SRS card, call `createSrsCard`
- Send single message: "Added N new words to vocabulary" with the word list
- Keep the option to manually adjust familiarity later (via vocabulary page or dedicated bot command)

**Preserving manual mode:** Add a `/settings` command or bot config to toggle between auto-add and manual selection. Default to auto-add for speed.

## Detailed Analysis: Collocations UI

**On sentence analysis page:**
- After AnalysisResult component, show a "Collocations" section
- Each collocation as a pill/badge with type indicator (collocation / phrasal verb / idiom)
- Translation shown on hover or inline
- API: add collocations to the sentence analysis response (they are already in DB via `sentence_collocations`)

**On vocabulary page:**
- When expanding a word row, show associated collocations
- Query path: word -> sentence_words -> sentences -> sentence_collocations -> collocations
- This is a N+1 query risk; solve with a dedicated API endpoint that returns collocations for a word ID
- Alternative: preload collocations for visible words in a batch query

## MVP Recommendation

**Priority order for v1.1 implementation:**

1. **Telegram auto-add** -- lowest complexity, highest daily UX impact, zero schema changes, independent of other features
2. **Vocabulary page (list + search + filters + sort)** -- table stakes for web app to be useful beyond dashboard
3. **Collocations on sentence analysis** -- low complexity, data already exists, completes the analysis display
4. **Web SRS review flow** -- medium complexity but backend is done; brings review capability to web (currently bot-only)
5. **Multiple POS/translations** -- highest complexity, schema migration, touches all layers; implement last

**Defer consideration:** If polysemous words are rarely encountered in practice (most B1-B2 vocabulary is not heavily polysemous), a simpler interim solution works: append POS to the existing translation field as "(v.) бежать" without schema changes. This buys time while delivering all other features. Revisit for v1.2 if it becomes a real pain point.

## Sources

- [LingQ vocabulary page filtering guide](https://forum.lingq.com/t/how-and-why-to-filter-your-vocabulary-list-like-a-pro/6858) -- vocabulary list filter patterns (MEDIUM confidence)
- [LingQ vocabulary review features](https://www.lingq.com/blog/reviewing-vocabulary/) -- status-based filtering and sorting (MEDIUM confidence)
- [Lemma-based multilingual dictionary dataset design](https://bierfeldt.com/posts/2022-10-06-designing-dataset-lemma-translation-dictionary/) -- GlobalSense model for multi-sense words (HIGH confidence, direct source)
- [Anki preferences and review UI](https://docs.ankiweb.net/preferences.html) -- review interface patterns, rating buttons, minimalist mode (HIGH confidence, official docs)
- [Mochi SRS](https://mochi.cards/) -- modern web SRS UI reference (MEDIUM confidence)
- Existing codebase: `src/routes/review.ts`, `src/bot/handlers/vocabulary.ts`, `src/db/schema/words.ts` -- current API and schema (HIGH confidence, primary source)
