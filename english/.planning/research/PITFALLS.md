# Domain Pitfalls

**Domain:** EPUB reader with LingQ-style word tracking added to existing English learning app
**Researched:** 2026-03-15
**Scope:** Pitfalls specific to ADDING EPUB reader and LingQ-style word tracking to the existing codebase with AI analysis pipeline, word_senses with POS, SRS via FSRS, vocabulary management, and Telegram bot

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Lemma Mismatch Between Reader Tokenization and Existing `word_senses`

**What goes wrong:** The reader highlights a word in text (e.g., "wouldn't"), but the tokenizer splits it into "would" + "n't" or keeps it as one token. The AI analysis returns lemma "would" with POS "verb", but `wink-lemmatizer` normalizes differently, or the AI returns a different lemma form than what already exists in the `words` table. Result: duplicate entries, words not recognized as known, status not reflected in reader highlights.

**Why it happens:** The existing system receives clean sentences from Telegram where the AI decides what words to extract. In the reader, you need a second path: display-time tokenization to match surface forms in EPUB HTML against stored lemmas. These are two fundamentally different operations that must agree.

**Consequences:**
- User marks "run" as known via Telegram, but "running" in the reader shows as unknown because the display-side tokenizer doesn't lemmatize to the same form
- Contractions like "I'd", "they've", "won't" either get skipped entirely or create ghost word entries
- Hyphenated compounds ("well-known", "up-to-date") create multiple word entries or none
- The word highlight system becomes untrustworthy, killing the core value proposition

**Prevention:**
- Build a single `matchSurfaceFormToLemma(token: string): string[]` function that returns candidate lemmas for any surface form, reusing `normalizeLemma` from `src/lib/lemmatizer.ts`
- Handle contractions explicitly with a lookup table: "won't" -> ["will", "not"], "I'd" -> ["I", "would"/"had"], "they've" -> ["they", "have"]
- For display highlighting, match against ALL word senses for a lemma, not just one POS
- Write extensive unit tests with edge cases before building the reader UI
- Phase: Must be solved in the EPUB parsing/tokenization phase, before any UI work

**Detection:** Create a test suite with 50+ real sentences from target books. Run tokenizer output against existing word DB. Any lemma that exists in DB but fails to match a surface form is a bug.

### Pitfall 2: EPUB HTML Structure Variance Destroying Sentence Boundaries

**What goes wrong:** EPUBs contain wildly inconsistent HTML. Some wrap each paragraph in `<p>`, others use `<div>`, some use `<br/>` for line breaks within dialogue. Poetry uses `<span>` per line. Dialogue splits across multiple `<p>` tags with speech marks spanning elements. Sentence splitter receives either too much text (entire chapter as one blob) or too little (half-sentences from split `<p>` tags).

**Why it happens:** EPUB is a container format, not a content format. Publishers use different tools (InDesign, Calibre, Sigil, hand-crafted) producing radically different internal HTML. EPUB 2 uses XHTML 1.1, EPUB 3 uses HTML5. There is no standard for how text content maps to HTML elements.

**Consequences:**
- Sentences split mid-clause: `"I said, "` becomes one sentence, `"hello."` becomes another
- Entire paragraphs treated as single sentences, overwhelming the AI analysis
- Dialogue attribution breaks: `"Run!" he shouted.` may be 1 or 2 sentences depending on parser
- Poetry/verse formatted as prose or each line as a separate sentence
- Footnote markers and superscripts injected mid-sentence

**Prevention:**
- Parse EPUB HTML to extract text content at the paragraph level, then re-segment with a proper sentence splitter (NOT by HTML structure alone)
- Use a robust sentence boundary detection library. `wink-nlp` (same ecosystem as existing `wink-lemmatizer`) has good English sentence segmentation
- Pre-process: strip footnote markers, handle `<br/>` within `<p>` as soft breaks not sentence boundaries
- Handle dialogue explicitly: quotes followed by attribution ("said X") should stay as one unit
- Store the mapping from sentences back to EPUB content positions (character offsets within chapter) for highlighting
- Phase: Core parsing phase -- get this wrong and everything downstream breaks

**Detection:** Parse 5 different EPUBs from different sources (Gutenberg, commercial, Calibre-converted, self-published). Compare sentence count and spot-check 20 random sentences from each. If more than 5% are visibly wrong splits, the splitter needs tuning.

### Pitfall 3: AI Analysis Cost Explosion with Eager Per-Sentence Processing

**What goes wrong:** A typical novel has 5,000-10,000 sentences. The existing system processes one sentence at a time via Telegram at maybe 5-20 per day. With a book reader, the user can "flip through" pages rapidly. If every sentence triggers an AI call, reading one book costs $50-200+ in API calls and takes hours of processing time.

**Why it happens:** The existing `analyze-sentence` pipeline is designed for on-demand single-sentence analysis. It was never designed for batch processing thousands of sentences. The natural impulse is to reuse it as-is for every sentence.

**Consequences:**
- API rate limits hit within minutes of starting a book (OpenAI: 500-10,000 RPM depending on tier)
- Cost per book becomes prohibitive -- reading 10 books/month at $100/book is $1,000/month
- User waits 2-5 seconds per sentence for analysis, destroying the reading flow
- Server overwhelmed if processing is done eagerly on page load

**Prevention:**
- Analyze on-demand when user taps a sentence, NOT eagerly for entire book/chapter
- Cache analysis results in DB keyed by normalized sentence text hash -- same sentence reuses existing analysis
- Use OpenAI Batch API (50% cost reduction, 24hr turnaround) for optional pre-processing of upcoming chapters
- Implement a processing queue with concurrency limits (existing BullMQ infrastructure supports this)
- Consider lighter pre-processing: tokenize words client-side and match against existing word DB without AI. Only call AI when user actually taps a sentence for full analysis
- Word highlighting does NOT require AI -- it only requires matching surface forms to known lemmas in the DB
- Phase: Architecture decision in the first phase. Do NOT build eager processing and "optimize later"

**Detection:** Before building, calculate: average sentence count per chapter x API cost per call x chapters per book. If total exceeds $5/book, the architecture needs revision.

### Pitfall 4: Word Status Conflict Between Reader and Telegram Flows

**What goes wrong:** User marks "serendipity" as `never_seen` via reader flow, but it already has a word_sense with `understand_in_context` familiarity from a Telegram sentence analyzed months ago. Or: user marks word as "know" in reader, but the SRS card is due for review. The two systems have contradictory views of word knowledge.

**Why it happens:** The existing system has two status dimensions that are only loosely connected:
1. `word_senses.familiarity` enum: `never_seen`, `seen_unsure`, `understand_in_context`
2. `srs_cards.state` enum: `new`, `learning`, `review`, `relearning`

The reader introduces a third dimension: LingQ-style word status (new/recognized/familiar/learned/known, typically shown as blue/yellow/green/white highlighting). These three systems can disagree.

**Consequences:**
- Word shows as "new" (blue) in reader but user has reviewed it 20 times via SRS
- User marks word "known" in reader but SRS keeps scheduling reviews for it
- Familiarity set via Telegram doesn't reflect in reader highlights
- User loses trust in the system's understanding of their knowledge

**Prevention:**
- Do NOT introduce a third status dimension. Map reader word states directly to the existing `word_senses.familiarity`:
  - Reader "new/blue" = no word_sense exists for this lemma, or familiarity is `never_seen`
  - Reader "learning/yellow" = familiarity is `seen_unsure` (has SRS card in `new`/`learning` state)
  - Reader "known/white" = familiarity is `understand_in_context` (SRS card graduated or no card needed)
- When user taps "know" in reader, update BOTH `word_senses.familiarity` AND suspend/graduate the SRS card
- When SRS review changes card state, the reader highlight should reflect it on next page load
- Single source of truth: `word_senses.familiarity` drives highlight color, period
- Phase: Design the status mapping BEFORE building the reader UI. Document it as a specification.

**Detection:** Write integration tests: create a word via Telegram flow, verify it appears correctly highlighted in reader. Mark word in reader, verify SRS card state updates. Review word in SRS, verify reader highlight changes.

## Moderate Pitfalls

### Pitfall 5: Mobile Browser Touch Event Conflicts

**What goes wrong:** The reader needs to support: (a) tapping a word to see its status/meaning, (b) tapping a sentence to trigger analysis modal, (c) swiping/tapping to turn pages, (d) long-press to select text. These gestures conflict with each other and with browser default behaviors (text selection, scroll bounce, back navigation).

**Prevention:**
- Define clear gesture zones: word tap vs. sentence tap vs. page navigation
- Use a debounced approach: short tap on word = word popup, tap on sentence area (outside word) = full analysis, edge tap or swipe = page turn
- Disable browser text selection via CSS `user-select: none` on reader content
- Prevent iOS Safari bounce scroll with `overscroll-behavior: none`
- Test on actual mobile devices (iOS Safari + Android Chrome) early, not just desktop
- Phase: Reader UI phase -- build a gesture prototype BEFORE implementing content rendering

### Pitfall 6: EPUB Resource Path Resolution and CSS Interference

**What goes wrong:** EPUB internal paths for CSS, images, and fonts use relative references that break when content is extracted and rendered in a custom web view. Publisher CSS overrides reader styles -- font sizes, colors, margins all change. Some EPUBs include aggressive CSS resets.

**Prevention:**
- Parse the EPUB OPF manifest to build a complete resource map
- Strip publisher CSS entirely -- this is a language learning reader, not a faithful renderer. Apply own consistent styles
- Convert image references to blob URLs or serve via API endpoint if images are needed
- If preserving some publisher formatting (italics, bold), whitelist only inline styles, not linked stylesheets
- Phase: EPUB parsing phase -- handle alongside HTML extraction

### Pitfall 7: Sentence Deduplication and Source Tracking

**What goes wrong:** Common short sentences appear in every book: "He nodded.", "She smiled.", "Yes.", "Thank you." The existing `sentences` table stores each input as a unique row with `sourceBook`. If the same sentence appears in a new book, should it create a new row (duplicating analysis) or reuse the existing one (losing per-book context)?

**Prevention:**
- Separate sentence analysis results from sentence occurrences. Analysis (translation, vocabulary, grammar) should be cached and shared. Occurrence (which book, which position) should be per-book
- Add a `book_sentences` junction table: `(book_id, sentence_id, chapter_index, sentence_index)` linking to reusable `sentences` rows
- For lookup: hash normalized sentence text, check if analysis exists, reuse if so
- Phase: Database schema extension phase -- design before implementing reader

### Pitfall 8: Sentence Splitter Edge Cases in Literary English

**What goes wrong:** Literary text has patterns that break naive sentence splitters:
- Dialogue with ellipsis: `"I thought... maybe we could..."` -- is this 1 or 3 sentences?
- Abbreviations: `Dr. Smith arrived at 3 p.m. on Tuesday.` -- 1 sentence, not 3
- Quoted speech spanning paragraphs: opening quote without closing in same paragraph
- Em-dashes used as sentence breaks: `She ran--he followed--they escaped.`
- ALL CAPS titles/headers mixed into chapter content

**Prevention:**
- Use a rule-based splitter with known abbreviation lists, NOT just regex on `.!?`
- `wink-nlp` handles most English abbreviations and dialogue correctly out of the box
- Add post-processing: merge sentences under 3 words with adjacent sentences (likely false splits)
- Treat ellipsis (`...`) as continuation, not boundary, unless followed by a capital letter after whitespace
- Pre-strip chapter titles/headers before sentence splitting (detect via HTML heading tags `<h1>`-`<h6>`)
- Phase: EPUB parsing phase -- test with real literary EPUBs before building UI

### Pitfall 9: Reading Position Persistence Fragility

**What goes wrong:** User reads to page 47, closes browser, comes back -- app shows page 1. Or worse: book is re-parsed with slightly different sentence segmentation, and the saved position now points to the wrong location.

**Prevention:**
- Store reading position as (chapter_index, sentence_index) which is stable across font size changes and screen rotations
- Do NOT store position as pixel offset or percentage -- these change with viewport
- Save position on every page turn (debounced write to API), not just on explicit "bookmark"
- On position restore, validate that the stored position is still valid (chapter exists, sentence index in range), fall back to nearest valid position
- Sentence segmentation must be deterministic -- same EPUB always produces the same sentence list. Do NOT re-parse on each read, store parsed results
- Phase: Reader UI phase -- implement from the start, not as an afterthought

### Pitfall 10: Proper Noun Flooding the Word Highlights

**What goes wrong:** Literary text is full of character names, place names, brand names. "Dumbledore", "Hogwarts", "Gryffindor" -- the existing AI prompt filters proper nouns for vocabulary extraction, but in reader mode where ALL words get highlighted by status, every proper noun shows as "new" (blue) and clutters the display with noise.

**Prevention:**
- The existing prompt correctly skips proper nouns for AI vocabulary extraction -- keep this
- For display highlighting: detect proper nouns client-side (capitalized words not at sentence start, words not in the word DB) and show them in neutral style, not "new word" blue
- Allow user to tap a proper noun and mark it as "ignore" (never highlight again)
- Store ignored words in a lightweight blocklist table (separate from word_senses)
- Pre-populate blocklist with common proper noun patterns (names ending in common suffixes, place names)
- Phase: Word highlighting phase -- needs its own "ignored words" concept distinct from vocabulary tracking

### Pitfall 11: epub.js Performance with Large Chapters on Mobile

**What goes wrong:** Books with large chapters (400+ paragraphs) cause extreme lag in epub.js, with nearly 1 second delay per action. Tab inactivity on Chrome causes the epub.js instance to become unresponsive until a forced re-render. Continuous scroll mode (natural for mobile) is less performant than paginated mode.

**Prevention:**
- Do NOT use epub.js for rendering. The app uses a custom "5-7 sentences per page" model which is fundamentally different from epub.js's page-based rendering. Parse EPUB server-side, send sentence data via API, render with Vue components
- Server-side parsing: extract chapters into sentence arrays during upload, store in DB. Reader fetches one page (5-7 sentences) at a time via API
- This avoids the entire epub.js performance problem and gives full control over sentence-level interaction
- Phase: Architecture decision -- choose server-side parsing over client-side epub.js in the first phase

## Minor Pitfalls

### Pitfall 12: EPUB File Size and Memory on Upload

**What goes wrong:** Large EPUBs (50MB+ with images) cause upload timeouts or memory issues during server-side parsing. Some image-heavy books (graphic novels, textbooks with illustrations) are poor fits for this text-focused reader.

**Prevention:**
- Set a maximum file size limit (e.g., 50MB) with clear error message
- Parse chapters lazily -- extract text content chapter by chapter, not entire book into memory
- Strip and discard images during text extraction (this is a language learning reader, not a graphic reader)
- Phase: EPUB upload/parsing phase

### Pitfall 13: Re-analysis When AI Prompt Changes

**What goes wrong:** The prompt in `src/lib/ai/prompts.ts` is heavily tuned and will continue to evolve. When the prompt changes, previously cached analyses have different quality (old analyses missing definitions, or using old CEFR filtering). No way to know which analyses are stale.

**Prevention:**
- Add a `prompt_version` integer to cached sentence analyses
- When prompt version changes, mark old analyses as potentially stale but do NOT auto-reprocess (too expensive)
- Allow user to manually re-analyze a sentence (tap and hold, "re-analyze" option in the modal)
- Phase: Caching architecture phase -- add version tracking from the start

### Pitfall 14: wink-lemmatizer Limitations for Reader-Side Matching

**What goes wrong:** The existing `wink-lemmatizer` is dictionary-based and only handles noun, verb, adjective. It cannot do POS disambiguation without context. For reader-side matching where you have a surface form but no POS tag, lemmatization becomes ambiguous ("left" could be "leave" verb or "left" adjective).

**Prevention:**
- For reader-side matching, generate ALL possible lemmas for a surface form (try all POS categories via `normalizeLemma`) and check if ANY match exists in the DB
- Accept that some matches will be imperfect -- this is acceptable if the fallback is "show as unknown" rather than "crash" or "show wrong status"
- Consider `compromise` npm library for lightweight POS tagging of reader text to disambiguate before lemmatization
- Phase: Word matching phase -- build the multi-POS lookup from the start

### Pitfall 15: Page Model Mismatch with Variable Sentence Lengths

**What goes wrong:** The spec says "5-7 sentences per page." But one sentence might be 3 words ("He left.") and another might be 80 words (a complex literary sentence). Pages vary wildly in visual length -- some fill half the screen, others require scrolling on mobile.

**Prevention:**
- Use character/word count as the primary pagination metric, not sentence count. Target ~150-200 words per page
- Keep the minimum at 3 sentences and maximum at 10, but let word count be the primary driver
- Calculate page boundaries during parsing and store them, so pagination is consistent across sessions
- Phase: EPUB parsing/pagination phase

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| EPUB parsing and sentence splitting | HTML structure variance (#2), sentence splitter edge cases (#8), pagination (#15) | Test with 5+ EPUBs from different sources before building UI |
| Word tokenization and matching | Lemma mismatch (#1), proper nouns (#10), wink-lemmatizer limits (#14) | Build and test matching layer in isolation with extensive unit tests |
| Database schema extension | Sentence dedup (#7), status conflicts (#4), prompt versioning (#13) | Design schema changes before code; map reader states to existing familiarity enum |
| AI analysis integration | Cost explosion (#3) | Calculate cost-per-book before building; implement on-demand analysis, not eager |
| Reader UI (mobile) | Touch conflicts (#5), reading position (#9), epub.js perf (#11) | Use server-side parsing + Vue rendering, not epub.js. Gesture prototype first |
| Reader UI (word highlighting) | Status conflicts (#4), proper nouns (#10) | Single source of truth in word_senses.familiarity; separate "ignore" list for proper nouns |
| Architecture | epub.js vs server-side parsing (#11), eager vs on-demand analysis (#3) | Decide server-side parsing + on-demand AI before writing any code |

## Sources

- [epub.js large chapter lag (GitHub issue #714)](https://github.com/futurepress/epub.js/issues/714)
- [epub.js tab inactivity lag (GitHub issue #913)](https://github.com/futurepress/epub.js/issues/913)
- [Edge Cases in Splitting Text into Words and Sentences](https://gist.github.com/b936168921d3468d88bb27d2016044c9)
- [NLP: Splitting Text into Sentences](https://towardsdatascience.com/nlp-splitting-text-into-sentences-7bbce222ef17/)
- [How to Split Sentences (Grammarly Engineering)](https://www.grammarly.com/blog/engineering/how-to-split-sentences/)
- [OpenAI Batch API documentation](https://developers.openai.com/api/docs/guides/batch/)
- [Claude Rate Limits documentation](https://platform.claude.com/docs/en/api/rate-limits)
- [AI Batch Processing: OpenAI, Claude, and Gemini (2025)](https://adhavpavan.medium.com/ai-batch-processing-openai-claude-and-gemini-2025-94107c024a10)
- [compromise NLP library](https://github.com/spencermountain/compromise)
- [NLTK tokenizer contraction splitting (GitHub issue #401)](https://github.com/nltk/nltk/issues/401)
- Existing codebase: `src/lib/lemmatizer.ts` (normalizeLemma with POS-specific lemmatization, adverb-to-adjective collapsing)
- Existing codebase: `src/services/analysis.ts` (storeAnalysisResults upsert logic, SRS card creation)
- Existing codebase: `src/db/schema/word-senses.ts` (unique on wordId+partOfSpeech, familiarity enum)
- Existing codebase: `src/db/schema/srs-cards.ts` (card states, word_sense reference)
- Existing codebase: `src/db/schema/sentences.ts` (sourceBook field, no book-level linking)
- Existing codebase: `src/lib/ai/prompts.ts` (proper noun filtering, B1+ vocabulary extraction)
