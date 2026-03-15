# Feature Landscape

**Domain:** EPUB reader with LingQ-style word tracking for English learning app v2.0
**Researched:** 2026-03-15
**Existing system:** AI sentence analysis (translation, vocabulary, collocations, grammar patterns, word families), FSRS SRS (vocab + grammar + collocation cards), vocabulary management with word senses and familiarity tracking, web dashboard, Telegram bot. All working in v1.x.

## Table Stakes

Features users expect from an in-app EPUB reader with vocabulary learning. Missing = the reader feels like a broken PDF viewer rather than a learning tool.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| EPUB upload and book management | Entry point for everything. User must get books into the system. LingQ, Readlang, every reader app has this. | Medium | New `books` table (id, title, author, filename, coverImage, uploadedAt); file storage on disk or S3; EPUB parser on backend | Parse EPUB on upload, extract chapters, split into sentences, store structured. Single user = disk storage fine. |
| Book library view | User needs to see their books, pick one, resume reading. Without this the upload is useless. | Low | `books` table, cover image extraction from EPUB metadata | Simple grid/list of books with cover, title, author, reading progress indicator |
| Paginated reader with sentence-level text | Core reading experience. Pages of 5-7 sentences, each sentence tappable. LingQ breaks lessons into pages this way. | High | Parsed chapter/sentence data in DB; frontend sentence rendering with word tokenization; touch/click handlers per sentence | This is the most complex UI component. Each sentence must be individually interactive while looking like flowing text. |
| Sentence analysis modal | User taps sentence, sees AI analysis (translation, vocabulary, collocations, grammar). This IS the learning moment. | Medium | Existing `analyzeSentence` pipeline; new modal component; analysis caching per sentence | Reuse existing AI analysis pipeline entirely. Cache results in DB -- same sentence never re-analyzed. |
| Word status highlighting in reader text | Visual feedback showing what you know vs what is new. Blue=new, yellow=learning, white=known. THE defining LingQ feature. | High | Word tokenization in frontend; cross-reference each token against vocabulary DB; real-time status lookup; CSS class per status | Requires mapping surface forms in text to lemmas in DB. Server must provide word status map per page. |
| Word status assignment in modal | After seeing analysis, user marks each word/collocation as "learn" or "know". Drives the entire SRS pipeline. | Medium | Existing familiarity enum (`never_seen`, `seen_unsure`, `understand_in_context`); existing SRS card creation | Modal shows new words/collocations from analysis. User taps "learn" = creates SRS card + sets familiarity. "Know" = marks as known, no card. |
| Reading position persistence | User closes browser, returns next day, lands on same page. Every ebook reader does this. | Low | New column `books.currentChapter`, `books.currentPage` or separate `reading_positions` table | Save position on every page turn. Restore on book open. |
| Page navigation (next/previous) | Swiping or tapping to move between pages of sentences. Basic reader navigation. | Low | Frontend pagination state; page index within chapter | Swipe gestures for mobile, arrow keys/buttons for desktop. Must enforce "analyze all sentences" before proceeding (per PROJECT.md). |

## Differentiators

Features that set this apart from LingQ and generic EPUB readers. Not expected, but high value for the C1 goal.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Mandatory sentence analysis before page turn | Unlike LingQ where you CAN skip words, this enforces engagement with every sentence. Turns passive reading into active learning. | Medium | Page state tracking: which sentences on current page have been analyzed; block "next page" until all done | PROJECT.md explicitly requires this: "pages with 5-7 sentences with mandatory clicking through each one" |
| Mini-report on page completion | After finishing a page, show: N new words added, N collocations found, N grammar patterns. Micro-dopamine hit. LingQ shows lesson-complete stats. | Low | Aggregate counts from analysis results for current page's sentences | Simple summary card shown between pages. Quick glance, then swipe to next page. |
| No A1/A2 filtering -- user decides | Unlike v1.x which auto-filtered basic words, v2.0 shows ALL words and lets the user decide. More control, catches false "known" words. | Low | Remove `shouldAutoAddWord` CEFR filter from analysis pipeline for reader context; keep it for Telegram if desired | PROJECT.md: "Remove A1/A2 filtering -- all words added, user decides themselves" |
| Analysis caching | Sentence analyzed once, cached forever. Re-reading a page is instant. LingQ does this for imported lessons. | Low | Check if sentence text already has analysis in DB before calling AI; return cached result | Existing `sentences` table already stores analysis results. Just add lookup-before-analyze logic. |
| Night mode / dark theme | Reading at night. Standard in every ebook reader (Kindle, Apple Books, LingQ). Not strictly required for learning but expected for reading comfort. | Low | CSS variables for background/text colors; toggle switch in reader UI; persist preference | Three themes: light (white bg), sepia (warm bg), dark (dark bg, light text). Store preference in localStorage. |
| Collocation highlighting in text | Beyond single words, highlight multi-word collocations/phrasal verbs in the reader text. Unique -- LingQ does not do this well. | High | Collocations from analysis must map back to text spans; multi-token matching in rendered text | This is genuinely hard: "look forward to" spans 3 tokens and may cross CSS boundaries. Consider deferring to v2.1. |
| Grammar pattern badge on sentence | Show small badges on analyzed sentences indicating grammar patterns found (e.g., "would have + V3"). Unique to this app. | Low | Grammar pattern data already extracted; display as chips/badges below or beside sentence | Subtle visual cue that a sentence contains interesting grammar. Not intrusive. |
| Per-book vocabulary stats | "From this book you learned 47 new words, 12 collocations." Motivating progress metric tied to reading. | Low | Track source book on sentences (already `sourceBook` field); aggregate by book | Show on book library card and book detail page |
| Keyboard shortcuts in reader | Power user feature: Space to open analysis, Escape to close, arrow keys to navigate. Desktop reading efficiency. | Low | Frontend key event listeners on reader view | Not needed for mobile, but significant for desktop reading sessions |

## Anti-Features

Features to explicitly NOT build in v2.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Table of contents / chapter navigation | PROJECT.md explicitly marks this as out of scope. Sequential reading is the intended flow. | Read linearly, chapter by chapter. Can add later if books are long. |
| Per-book reading progress percentage | PROJECT.md explicitly marks this as out of scope for v2.0. | Track position for resume, but do not display "42% complete" UI. |
| In-reader dictionary lookup (external) | The AI analysis IS the dictionary. External lookups fragment the experience and duplicate functionality. | AI analysis modal serves as the comprehensive word reference. |
| Simultaneous multi-book reading | Single user, sequential learner. Managing multiple concurrent book states adds complexity. | One active book at a time. Can switch books from library, position saved. |
| Social features / reading clubs | PROJECT.md: personal tool, single user. | N/A |
| Audio / text-to-speech | PROJECT.md: focus on reading, not listening. | Defer entirely. |
| EPUB editing / annotation | Not a reading tool feature. Annotations live in the vocabulary system. | Words/collocations saved to vocabulary = the annotation layer. |
| Custom font / font size controls | Nice-to-have but not learning-critical. System font at readable size is fine for v2.0. | Use system font stack with good default size. Add font controls in v2.1 if needed. |
| Offline reading / PWA | Single user on home network. Server is always available. | Standard web app, no service worker needed. |
| PDF / MOBI / other format support | EPUB is the standard. Most books available as EPUB. Converting adds complexity. | EPUB only. User can convert with Calibre if needed. |

## Feature Dependencies

```
EPUB upload + parsing
  |
  +---> Book library view (needs parsed book data)
  |       |
  |       +---> Reading position persistence (needs book + chapter context)
  |
  +---> Chapter/sentence storage in DB
          |
          +---> Paginated reader (renders stored sentences)
          |       |
          |       +---> Word status highlighting (needs vocab DB cross-reference)
          |       |       |
          |       |       +---> Collocation highlighting (extension of word highlighting)
          |       |
          |       +---> Sentence tap -> Analysis modal
          |       |       |
          |       |       +---> Word status assignment (learn/know buttons)
          |       |       |       |
          |       |       |       +---> SRS card creation (existing pipeline)
          |       |       |
          |       |       +---> Grammar pattern badges
          |       |
          |       +---> Mandatory analysis enforcement (tracks sentence completion)
          |       |       |
          |       |       +---> Page turn with mini-report
          |       |
          |       +---> Night mode (independent CSS concern)
          |
          +---> Analysis caching (check DB before AI call)
          |
          +---> Per-book vocabulary stats (aggregate from sentence data)
```

Key dependency: The entire reader pipeline depends on EPUB upload producing properly parsed, sentence-split, chapter-organized data in the database. This parsing quality determines everything downstream.

## Detailed Analysis: EPUB Upload and Parsing

**Upload flow:**
1. User selects EPUB file in browser
2. File uploaded to server via multipart form
3. Backend parses EPUB: extract metadata (title, author, cover), chapter list, chapter HTML content
4. For each chapter: strip HTML to clean text, split into sentences using NLP sentence boundary detection
5. Store: book metadata in `books` table, chapters in `chapters` table, sentences pre-split but NOT pre-analyzed (analysis happens on-demand during reading)

**Why server-side parsing (not browser):** EPUB is a ZIP containing XHTML files. Server-side parsing with Node.js (`epub` or `epub2` npm package) is straightforward. Sending parsed data to frontend is simpler than parsing in browser. Server stores the structured result.

**Why NOT pre-analyze all sentences:** A 300-page book has ~3000-5000 sentences. Analyzing all upfront would cost $5-15 in API calls and take 30+ minutes. Analyze on-demand when user reads each page. Cache results permanently.

**Sentence splitting challenge:** Naive splitting on `.` breaks on "Dr. Smith" and "U.S.A.". Use a proper sentence tokenizer. Options: `compromise` (JS NLP library), regex with abbreviation handling, or include sentence splitting in the chapter preprocessing step. Compromise is lightweight and handles English well.

## Detailed Analysis: Paginated Reader with Sentence Interaction

**Page model:**
- A "page" = 5-7 sentences from the current chapter
- Pages are computed from the stored sentence list, not from visual layout
- This is fundamentally different from EPUB.js pagination (which paginates by visual space)
- No need for epub.js at all -- we parse EPUB on upload and render our own pages from sentence data

**Why NOT use epub.js for rendering:** epub.js renders EPUB HTML as-is with CSS. We need per-sentence interactivity, per-word highlighting, custom click handlers. epub.js would fight against these requirements. Better to render our own HTML from extracted sentence text, with full control over the DOM.

**Sentence rendering:**
- Each sentence is a `<span class="sentence" data-id="123">` containing word spans
- Each word is a `<span class="word" data-lemma="run" data-status="new">run</span>`
- CSS classes drive highlighting: `.word[data-status="new"]` = blue bg, `[data-status="learning"]` = yellow bg, `[data-status="known"]` = no highlight

**Interaction flow per sentence:**
1. User taps sentence
2. Check cache: if analysis exists in DB, show immediately; if not, call AI API
3. Analysis modal opens with: translation, word list (with status per word), collocations, grammar patterns
4. User marks words: "learn" / "know" for each new word
5. Modal closes, sentence text re-renders with updated word highlights
6. Sentence marked as "completed" for this page

**Word tokenization:** Split sentence text into tokens on the frontend. Match tokens to vocabulary entries by lemmatizing each token and looking up against the words table. The server should return a word-status map for all words on the current page: `{ "run": "learning", "quickly": "known", "obstreperous": "new" }`.

## Detailed Analysis: Word Status System

**Current system has 3 familiarity levels on `word_senses`:**
- `never_seen` -- default when AI extracts a word
- `seen_unsure` -- user has encountered but not confident
- `understand_in_context` -- user knows the word

**For the reader, simplify to the LingQ-inspired 3-state model:**

| Status | Visual | Meaning | Maps to existing |
|--------|--------|---------|-----------------|
| New (blue) | Blue background | Word exists in text but not in user's vocabulary DB at all | No row in `words` table for this lemma |
| Learning (yellow) | Yellow background | Word is in vocabulary, user is actively studying it | `familiarity = never_seen OR seen_unsure` AND has SRS card |
| Known (no highlight) | No highlight | User knows this word | `familiarity = understand_in_context` OR no SRS card needed |

**"Learn" button in modal:** Creates word in vocabulary (if not exists) + creates SRS card + sets familiarity to `never_seen`. Word turns yellow in text.

**"Know" button in modal:** Creates word in vocabulary (if not exists) + sets familiarity to `understand_in_context` + NO SRS card. Word becomes unhighlighted.

**Status changes over time:** As user reviews SRS cards and eventually "graduates" a word, its familiarity updates to `understand_in_context` and it stops being highlighted. This happens through the existing SRS review flow, not in the reader.

## Detailed Analysis: Page Completion Flow

**Enforcement mechanism:**
- Track `Set<sentenceId>` of analyzed sentences on current page
- "Next page" button/swipe disabled until `analyzedSentences.size === currentPageSentences.length`
- Visual indicator per sentence: dim checkmark or subtle border change when analyzed

**Mini-report content (shown between pages):**

```
Page 3 of Chapter 2
---
+4 new words added to vocabulary
+2 collocations found
+1 grammar pattern identified
12 words already known on this page
```

- Aggregate from analysis results of all sentences on the completed page
- Show for 2-3 seconds or until user taps/swipes to continue
- No blocking -- user can dismiss immediately

**Per-chapter completion:** When last page of a chapter is completed, show chapter-level summary (total words learned from this chapter) and auto-advance to next chapter.

## Detailed Analysis: Night Mode

**Implementation approach -- CSS custom properties:**

```css
:root {
  --reader-bg: #ffffff;
  --reader-text: #1a1a1a;
  --word-new-bg: #cce5ff;
  --word-learning-bg: #fff3cd;
}

[data-theme="dark"] {
  --reader-bg: #1a1a1a;
  --reader-text: #e0e0e0;
  --word-new-bg: #1a3a5c;
  --word-learning-bg: #5c4a1a;
}

[data-theme="sepia"] {
  --reader-bg: #f4ecd8;
  --reader-text: #5b4636;
  --word-new-bg: #b8d4e8;
  --word-learning-bg: #e8d8a8;
}
```

Three themes sufficient: Light, Sepia, Dark. Toggle in reader toolbar. Persist to `localStorage`. Word status colors must remain distinguishable in all themes -- adjust blue/yellow shades per theme.

## MVP Recommendation

**Priority order for v2.0 implementation:**

1. **EPUB upload + parsing + sentence storage** -- foundation for everything; without this nothing works. Complexity: Medium.
2. **Book library view** -- minimal UI to see uploaded books and pick one. Complexity: Low.
3. **Paginated reader with sentence rendering** -- core reading experience, pages of 5-7 sentences. Complexity: High (biggest frontend effort).
4. **Sentence analysis modal with caching** -- tap sentence, see AI analysis, cached for re-reads. Reuses existing pipeline. Complexity: Medium.
5. **Word status assignment (learn/know) in modal** -- the LingQ learning moment. Creates SRS cards. Complexity: Medium.
6. **Word status highlighting in reader** -- blue/yellow/white per word. Requires lemma lookup. Complexity: High.
7. **Mandatory analysis + page mini-report** -- enforcement and progress feedback. Complexity: Medium.
8. **Reading position persistence** -- resume where you left off. Complexity: Low.
9. **Night mode** -- CSS custom properties, toggle, persist. Complexity: Low.

**Defer to v2.1:**
- Collocation highlighting in text (multi-token spans are complex)
- Per-book vocabulary stats (nice but not core)
- Keyboard shortcuts (desktop optimization)
- Grammar pattern badges on sentences (subtle enhancement)
- Table of contents / chapter navigation

**Critical path:** Items 1-6 form the minimum viable reader. Items 7-9 are important polish but the reader is usable without them.

## Integration with Existing System

| Existing Component | How Reader Uses It | Changes Needed |
|---|---|---|
| `analyzeSentence` AI pipeline | Called when user taps sentence in reader | Add cache-check: skip AI if sentence already analyzed; remove A1/A2 filter for reader context |
| `storeAnalysisResults` service | Stores words, collocations, grammar patterns from analysis | Add `bookId` and `chapterId` to sentence record for book context tracking |
| `words` + `word_senses` tables | Cross-referenced for word status highlighting | No schema changes; add API endpoint returning word status map for a set of tokens |
| `srs_cards` table | Created when user clicks "learn" in modal | No changes; existing `createEmptyCard` flow works |
| `familiarityEnum` | Drives highlighting logic (never_seen/seen_unsure/understand_in_context) | No changes; maps directly to new/learning/known visual states |
| `sentences` table | Stores analyzed sentences | Add `bookId`, `chapterId`, `positionInChapter` columns for reader context |
| FSRS review flow | Separate from reader; user reviews cards in review UI | No changes; words learned in reader appear in review naturally |

## Sources

- [LingQ Reader word status system](https://lingtuitive.com/blog/how-to-read-books-with-lingq-guide) -- blue/yellow/white highlighting, status levels 1-4, paging behavior (MEDIUM confidence)
- [LingQ 5.0 announcement](https://www.lingq.com/blog/introducing-lingq-5-0/) -- reader UI patterns, lesson-complete flow (MEDIUM confidence)
- [LingQ statistics and tracking](https://www.lingq.com/blog/lingq-statistics/) -- progress metrics, known word counting (MEDIUM confidence)
- [LingQ paging moves to known](https://www.lingq.com/en/forum/open-forum/someone-please-fix-paging-move/) -- page turn behavior, auto-marking words as known (MEDIUM confidence)
- [Readlang features](https://readlang.com/features) -- click-to-translate, auto-flashcard creation, context preservation (MEDIUM confidence)
- [epub npm package](https://www.npmjs.com/package/epub) -- server-side EPUB parsing for Node.js (HIGH confidence, npm registry)
- [@lingo-reader/epub-parser](https://www.npmjs.com/package/@lingo-reader/epub-parser) -- alternative EPUB parser with chapter loading (MEDIUM confidence)
- [epub.js](https://github.com/futurepress/epub.js) -- browser-side EPUB rendering library; evaluated and rejected for this use case (HIGH confidence, primary source)
- [Readlang word familiarity color scale discussion](https://forum.readlang.com/t/a-color-scale-feature-for-tracking-word-familiarity-progress/1634) -- community patterns for word status visualization (LOW confidence)
- Existing codebase: `src/services/analysis.ts`, `src/lib/ai/schemas.ts`, `src/db/schema/words.ts`, `src/db/schema/word-senses.ts`, `src/db/schema/srs-cards.ts` -- current analysis pipeline and data model (HIGH confidence, primary source)
