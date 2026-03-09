# Pitfalls Research

**Domain:** AI-powered English learning app (reading-based vocabulary and grammar acquisition via Telegram bot + web app)
**Researched:** 2026-03-09
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Inconsistent AI Analysis Output Across Identical Inputs

**What goes wrong:**
The same sentence submitted twice produces different grammar labels, different CEFR levels, different lemma extractions, or different collocation boundaries. User sees "Third Conditional" one time and "Unreal Past" another time for the same pattern. Extracted vocabulary differs between runs. This destroys trust in the system and corrupts the learning data -- duplicate lemmas with slightly different forms pollute the dictionary, grammar pattern tracking becomes noisy.

**Why it happens:**
LLMs are inherently non-deterministic. Research shows up to 76 accuracy points variance across minor prompt formatting changes. Temperature > 0 introduces randomness. Without rigid output schemas, the model improvises field names, nesting, and classification granularity. The grammar taxonomy is not pinned down -- the model invents its own labels each time.

**How to avoid:**
1. Use structured output / JSON Schema enforcement (OpenAI Structured Outputs, or Anthropic tool_use with strict schemas). Define every field, enum, and nested object explicitly. Never rely on freeform text for classification fields.
2. Set temperature to 0 for all analysis calls (not for exercise generation).
3. Define a fixed grammar taxonomy as an enum in the prompt -- do not let the model invent labels. Example: instead of letting AI say "Third Conditional" or "Unreal Past Conditional" or "Past Hypothetical", define `grammar_pattern_id` as one of your predefined patterns.
4. Define a fixed CEFR mapping for grammar patterns and lock it in a reference table, not in the LLM's judgment.
5. For lemmatization: do NOT rely solely on the LLM. Use a deterministic lemmatizer (spaCy or Stanza) as the primary source, with the LLM providing supplementary context (collocations, word families, usage notes).

**Warning signs:**
- Same sentence produces different word counts in vocabulary extraction
- Grammar pattern table grows with near-duplicate labels ("Present Perfect" vs "Present Perfect Simple" vs "Present Perfect Tense")
- CEFR level assignments contradict each other for similar constructions
- Unit tests for the analysis endpoint are flaky

**Phase to address:**
Phase 1 (Core AI Analysis) -- this is foundational. If analysis is inconsistent, everything downstream (SRS cards, grammar tracking, progress dashboard) is built on sand.

---

### Pitfall 2: SM-2 "Low Interval Hell" and Overdue Card Bias

**What goes wrong:**
Cards the user struggles with get stuck in a loop of 1-day intervals that never increase, creating a demoralizing grind. Separately, when the user takes a break (vacation, busy week), overdue cards get rescheduled too aggressively -- the algorithm overshoots, pushing intervals far too long after the user successfully recalls an overdue card. Research on 13 years of Anki data confirms SM-2 systematically overshoots for overdue cards, with retention dropping from 87% to 75%.

**Why it happens:**
SM-2's ease factor has no floor protection by default -- repeated failures drive ease toward unusable values. The algorithm also doesn't account for the "overdue bonus" correctly: recalling a card that was due 30 days ago but reviewed at day 60 shouldn't get the same interval boost as a card reviewed on time.

**How to avoid:**
1. Enforce a minimum ease factor of 1.3 (Anki's learned-the-hard-way default). If ease drops below 1.3, cap it.
2. For overdue cards, scale the interval increase based on how overdue the card was. Do not give full credit for overdue recalls -- use a dampening factor (e.g., `new_interval = old_interval * ease * min(1.0, scheduled_days / actual_days)`).
3. Seriously consider FSRS instead of SM-2. FSRS was trained on 700 million reviews from 20,000 users, achieves 20-30% fewer reviews for the same retention, and handles overdue cards correctly. It is now the default in Anki (since 23.10). For a new project in 2026, there is no reason to implement SM-2.
4. If sticking with SM-2 for simplicity: add jitter (randomness of +/- 5% to intervals) to prevent "sibling cards" from always appearing together.

**Warning signs:**
- Growing number of cards with ease factor at or near the floor
- User dreads reviews because the same 20 cards appear every single day
- After a 2-week break, previously-known cards get 90+ day intervals and are forgotten by next review

**Phase to address:**
Phase 2 (SRS Implementation). Design the algorithm layer as a swappable strategy pattern so you can migrate from SM-2 to FSRS later without schema changes.

---

### Pitfall 3: AI-Generated Exercises With Wrong or Ambiguous Answers

**What goes wrong:**
The LLM generates a fill-in-the-blank exercise for grammar, but the "correct" answer is wrong, or multiple answers are valid but only one is accepted. Example: "She ___ (go) to the store yesterday" -- correct answer is "went" but the AI also generates "had gone" as valid. Or worse: the AI generates a sentence with a grammar error in the non-blank portion. The user learns incorrect patterns.

**Why it happens:**
LLMs hallucinate. ChatGPT 3.5 had a 32% error rate on algebra problems; language exercises are similarly vulnerable. The model generates plausible-looking but linguistically incorrect sentences, especially for complex grammar (subjunctive, mixed conditionals, formal register). Distractor options in multiple-choice may be accidentally correct. The batch generation approach (generating exercises ahead of time, not during review) means errors persist until someone notices.

**How to avoid:**
1. Use structured prompts with explicit constraints: provide the target grammar pattern, the vocabulary to include, the exact blank position, and the expected answer. Do not ask the model to invent all of these simultaneously.
2. Implement a validation layer: after generation, send the exercise + answer back to the LLM in a separate call asking "Is this exercise correct? Is the answer the only valid answer?" This self-consistency check catches ~70% of errors.
3. Store a `verified` flag on exercises. New exercises start as unverified. After the user completes an exercise, show a "Report problem" button. Flagged exercises get reviewed or regenerated.
4. For grammar exercises, use the original user-submitted sentence as the base -- mutate it (remove a word, change tense) rather than generating from scratch. Real sentences are less likely to contain errors than fully synthetic ones.
5. Generate 3 exercises per item, pick the best one via a scoring pass, discard the rest.

**Warning signs:**
- Users mentally answer correctly but the system marks them wrong
- Fill-in-the-blank exercises where 2+ grammatically valid answers exist but only one is accepted
- Generated sentences sound unnatural or contain errors in the non-blank portions
- Exercise difficulty doesn't match the stated CEFR level

**Phase to address:**
Phase 3 (Exercise Generation). Build the validation pipeline from day one -- do not ship unvalidated exercises.

---

### Pitfall 4: Lemmatization Failures for Irregular Forms, Phrasal Verbs, and Collocations

**What goes wrong:**
The system treats "went" and "go" as separate vocabulary items. "Look up", "look after", "look into" all get lemmatized to "look" and merged into a single entry, losing the phrasal verb distinction. "Better" doesn't link to "good". Multi-word collocations like "make a decision" get split into individual words. The vocabulary dictionary fills with duplicates and misses the actual learning units the user needs.

**Why it happens:**
Rule-based lemmatizers (NLTK WordNet, Porter stemmer) fail on irregular forms. Even spaCy mishandles edge cases. Phrasal verbs are a category that falls between single words and idioms -- standard NLP tokenizers don't recognize them as units. Collocations require statistical methods (PMI, t-test) or explicit dictionaries, not just tokenization.

**How to avoid:**
1. Use a two-pass extraction: first pass with spaCy for standard lemmatization, second pass with the LLM specifically for phrasal verbs, collocations, and idioms. The LLM is good at recognizing "look up" as a phrasal verb in context -- better than statistical methods for single-sentence inputs.
2. Maintain a curated phrasal verb dictionary (there are ~5,000 common English phrasal verbs). Cross-reference LLM extraction against this list.
3. Store the original surface form alongside the lemma. Schema: `vocabulary(id, lemma, surface_form, pos, is_phrasal_verb, is_collocation, source_sentence_id)`.
4. For word families (reluctance/reluctant/reluctantly), do NOT rely on lemmatization. Use the LLM to explicitly identify word family relationships and store them as graph edges, not as shared lemmas.
5. Implement deduplication at insertion time: before adding a new vocabulary item, check for existing entries with the same lemma + POS combination. For phrasal verbs, check lemma + particle combination.

**Warning signs:**
- Vocabulary count grows faster than expected (duplicates)
- User sees "go" and "went" as separate flashcards
- Phrasal verbs like "give up" appear as just "give"
- Word families are not connected in the UI

**Phase to address:**
Phase 1 (Core AI Analysis) -- extraction quality is foundational. Design the vocabulary schema to support phrasal verbs and collocations from the start; retrofitting is painful.

---

### Pitfall 5: Unbounded AI Token Costs From Naive Prompt Design

**What goes wrong:**
Each sentence analysis costs $0.02-0.05 with a large model. User submits 30 sentences per reading session. Exercise generation for 200 vocabulary items costs $5-10. Monthly costs spiral to $50-100+ for a single user. The system prompt is 2,000 tokens of boilerplate repeated in every call. Conversation history is passed unnecessarily.

**Why it happens:**
Developers design prompts for quality first, then discover costs too late. System prompts include extensive examples and instructions that could be cached. Each analysis call uses the most expensive model even for simple tasks. Exercise generation happens one-at-a-time instead of in batches.

**How to avoid:**
1. Use prompt caching aggressively. Both Anthropic and OpenAI support it -- the system prompt and taxonomy definitions should be cached (up to 90% cost reduction on the static portion).
2. Use model routing: sentence analysis (complex task) uses Claude Sonnet or GPT-4o; exercise validation (simple task) uses Claude Haiku or GPT-4o-mini. Cost difference is 10-20x.
3. Batch exercise generation: generate 10-20 exercises per API call, not one. Structure the prompt to return an array. Use the Batch API endpoints (50% discount for async workloads).
4. Set `max_tokens` explicitly on every call. Grammar analysis should not produce 2,000-token responses. Cap at 500-800 tokens.
5. Track costs per-call in the database. Add a daily/monthly cost ceiling with alerts. Schema: `ai_calls(id, endpoint, model, input_tokens, output_tokens, cost_usd, created_at)`.
6. Cache identical sentence analyses. If the user submits "She went to the store" twice, return the cached result.

**Warning signs:**
- Monthly API bill exceeds the cost of a commercial language learning subscription
- Average response contains 3x more tokens than needed
- Same system prompt sent 100 times per day without caching
- No cost tracking -- you discover the problem from the billing dashboard

**Phase to address:**
Phase 1 (Core AI Analysis) -- design the AI abstraction layer with cost controls from the start. Model routing and caching are architectural decisions, not optimizations to add later.

---

### Pitfall 6: Telegram Bot That Feels Like a CLI, Not a Conversation

**What goes wrong:**
The bot dumps a wall of text (translation + grammar breakdown + vocabulary list + CEFR level) in a single message after each sentence submission. User has to scroll through 30 lines of analysis they don't care about right now. There's no way to drill into specific parts. The bot restarts the "conversation" on every message -- no concept of "I'm currently reading chapter 5" or "show me today's reviews". Commands are cryptic (/analyze, /review, /stats) instead of using inline keyboards.

**Why it happens:**
Developers treat the bot as an API endpoint that happens to use Telegram as transport. They don't think about the reading flow: user is holding a book, wants to quickly capture a sentence and get back to reading. The analysis dump interrupts this flow.

**How to avoid:**
1. After sentence submission, send only the translation and a compact summary (CEFR level, count of new words). Attach an inline keyboard with buttons: "Grammar details", "Vocabulary", "Full analysis". Load detail on demand.
2. Use Telegram's message editing (`editMessageText`) instead of sending new messages for drill-down -- keeps the chat clean.
3. Implement conversation state properly. Use a state machine (FSM) with persistent storage, not in-memory dicts that die on restart. Libraries like `aiogram` have built-in FSM support with Redis/PostgreSQL backends.
4. For reviews in the bot: keep it minimal. Show the word/pattern, wait for user's self-assessment (inline buttons: "Forgot / Hard / Good / Easy"), confirm, next card. Do NOT show the answer before the user responds.
5. Long-running AI analysis (>3 seconds) must be handled asynchronously -- send a "thinking..." message, then edit it with the result. Do not block the event loop.
6. Limit bot's scope: the bot is for INPUT and quick reviews. Deep analysis, dashboard, and exercise sessions belong in the web app. Do not try to replicate the web UI in Telegram.

**Warning signs:**
- Bot messages are longer than 2 phone screens
- User stops using the bot and only uses the web app for input (defeats the purpose)
- Bot becomes unresponsive during AI analysis calls
- State is lost on bot restart

**Phase to address:**
Phase 2 (Telegram Bot). Design the UX flow on paper before writing code. Test with real reading sessions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing AI raw JSON response without schema validation | Ship faster, flexible structure | Inconsistent data, migration nightmares, broken downstream queries | Never -- validate from day one |
| Using LLM for lemmatization instead of deterministic NLP | One integration point, simpler code | Non-deterministic results, duplicate vocabulary, higher token costs | Never for lemmatization; use LLM only for collocations/phrasal verbs |
| In-memory bot state instead of persistent storage | Quick prototype | State lost on restart, cannot scale | Only in first-week prototype, replace before any real use |
| Single AI model for all tasks | Simpler prompt management | 10-20x higher costs than necessary | MVP only, add model routing by Phase 2 |
| No review history table (only current SRS state) | Simpler schema | Cannot analyze learning patterns, debug algorithm issues, or migrate algorithms | Never -- log every review from the start |
| Hardcoded grammar taxonomy in prompts | Quick iteration | Taxonomy changes require prompt rewrite and reprocessing | MVP only, move to DB-driven taxonomy by Phase 2 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude/OpenAI API | Not handling rate limits or timeouts; crashing on 429/529 errors | Implement exponential backoff with jitter. Use a queue for batch operations. Set per-call timeouts (30s for analysis, 60s for batch generation). |
| Claude/OpenAI API | Assuming structured output always parses correctly | Always wrap JSON parsing in try/catch. Log raw responses for failed parses. Have a retry-with-simplified-prompt fallback. |
| Claude/OpenAI API | Not pinning model versions | Pin to specific model snapshots (e.g., `claude-sonnet-4-20250514` not `claude-sonnet-4-latest`). Model updates can change output format and classification behavior. |
| Telegram Bot API | Blocking the event loop with synchronous AI calls | Use async HTTP client (aiohttp/httpx) for all AI API calls. Process analysis in background tasks. |
| Telegram Bot API | Not handling message size limits (4096 chars) | Split long responses or use "detail on demand" with inline keyboards. Check message length before sending. |
| PostgreSQL | Storing SRS scheduling data without timezone awareness | Use `TIMESTAMPTZ` for all date/time columns. Store next review time in UTC. Convert to user timezone only in the presentation layer. |
| spaCy/NLP library | Loading the NLP model on every request | Load the model once at application startup and reuse it. spaCy model loading takes 1-3 seconds. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous AI calls in Telegram handler | Bot freezes for 3-10 seconds on each message, other users' messages queue up | Async processing with immediate acknowledgment message | At any scale -- even a single user notices 5s+ delays |
| N+1 queries for review sessions (load card, then load sentence context, then load word family) | Review session takes 2-3 seconds to load each card | Eager-load review batch with JOINs: cards + sentences + vocabulary in one query | At 500+ vocabulary items |
| Unbatched exercise generation | Generating exercises takes 30+ minutes for 100 items | Batch 10-20 items per API call; use background job queue | At 100+ vocabulary items needing exercises |
| Full review history scan for dashboard stats | Dashboard takes 10+ seconds to load | Maintain aggregate tables (daily_stats, weekly_stats) updated on each review; materialized views for complex metrics | At 5,000+ reviews |
| Storing all AI analysis responses as JSON blobs without indexes | Queries filtering by grammar pattern or CEFR level require full table scans | Extract key fields into indexed columns; use JSONB with GIN indexes only for supplementary data | At 1,000+ analyzed sentences |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API keys in code or docker-compose.yml | Key leak via git history | Use environment variables or Docker secrets. Add `.env` to `.gitignore`. |
| No input sanitization on user-submitted sentences | Prompt injection -- user crafts input that hijacks the AI analysis prompt | Treat user input as data, not as part of the prompt template. Use clear delimiters. Validate input length (max 500 chars per sentence). |
| Telegram bot token in source code | Anyone can impersonate the bot | Store token in environment variable. Rotate if leaked. |
| No rate limiting on AI-powered endpoints | Cost denial-of-service -- someone sends 1,000 sentences in a minute | Rate limit per user: max 50 sentences/hour, max 200/day. Apply at the application layer. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing full linguistic analysis immediately | Information overload; user wanted just a translation while reading | Show translation + "X new words found" summary. Details on demand via buttons/tabs. |
| Review sessions with 50+ cards | Cognitive fatigue, user skips reviews | Cap review sessions at 20 cards. Prioritize by overdue-ness. Let user choose session length. |
| No "I already know this" escape hatch | User must grind through basic words they already know | Add "Mark as known" action that skips SRS entirely and moves word to "known" status. |
| Grammar explanations in English (target language) for a Russian-speaking B1 learner | User struggles to understand the explanation, not just the grammar | Provide grammar explanations in Russian (the user's native language). Vocabulary definitions can be bilingual. |
| Treating all vocabulary equally in SRS | High-frequency words and rare words get same review schedule | Weight by word frequency (BNC/COCA lists). High-frequency unknown words should be prioritized. |
| No progress visibility during reading | User doesn't feel they're learning, abandons the tool | After each reading session, show: "Today: 12 sentences, 8 new words, 3 grammar patterns. Total: 450 words learned." |

## "Looks Done But Isn't" Checklist

- [ ] **Sentence Analysis:** Often missing -- handling of sentences with multiple clauses. A compound sentence may contain 2-3 grammar patterns; verify all are extracted, not just the first.
- [ ] **Vocabulary Deduplication:** Often missing -- POS-aware deduplication. "Light" (noun, adjective, verb) should be three separate vocabulary items, not one.
- [ ] **SRS Algorithm:** Often missing -- handling of the "first review" case. New cards need a separate learning queue with short intervals (1min, 10min, 1day) before entering the regular SRS cycle.
- [ ] **Exercise Generation:** Often missing -- difficulty progression. Exercises for the same grammar pattern should get harder over time (recognition -> fill-in-blank -> free production), not stay at the same level.
- [ ] **Telegram Bot:** Often missing -- graceful handling of non-text messages (photos, stickers, voice messages). Bot should respond with "Please send a text sentence" instead of crashing.
- [ ] **Dashboard:** Often missing -- "empty state" design. Dashboard with zero data should guide the user to submit their first sentence, not show empty charts.
- [ ] **Collocation Extraction:** Often missing -- distinguishing collocations from free combinations. "Heavy rain" is a collocation; "heavy box" is a free combination. Both contain "heavy" but only the first should be extracted as a unit.
- [ ] **Grammar Pattern Tracking:** Often missing -- handling patterns the user has mastered. Patterns with 5+ successful reviews should stop generating exercises and move to a "maintenance" schedule.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Inconsistent AI analysis (duplicate grammar labels, inconsistent CEFR) | MEDIUM | 1. Define canonical taxonomy. 2. Write migration script to map existing labels to canonical ones. 3. Re-analyze affected sentences in batch. 4. Add schema validation to prevent recurrence. |
| SM-2 low interval hell (stuck cards) | LOW | 1. Identify cards with ease < 1.5 and interval < 3 days. 2. Reset ease to 2.5, interval to 1 day. 3. Give user a "fresh start" option per card. |
| Wrong AI-generated exercises in production | MEDIUM | 1. Mark all unverified exercises as "needs review". 2. Run batch validation pass with self-consistency check. 3. Delete exercises that fail validation. 4. Regenerate with improved prompts. |
| Vocabulary duplicates from bad lemmatization | HIGH | 1. Export all vocabulary. 2. Run deduplication with deterministic lemmatizer. 3. Merge duplicates (keeping all source sentences). 4. Update SRS state for merged items (keep best ease/interval). Schema migration required. |
| Token cost overrun | LOW | 1. Add cost tracking immediately. 2. Switch expensive calls to cheaper model. 3. Enable prompt caching. 4. Add response caching for repeated inputs. Immediate effect, no data migration. |
| Lost Telegram bot state | LOW | 1. Migrate to persistent state storage (PostgreSQL/Redis). 2. Current conversation state is lost but not critical -- user can restart. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Inconsistent AI analysis | Phase 1: Core AI Analysis | Run same 50 sentences through analysis 3 times; output must be byte-identical for classification fields |
| SM-2 / SRS algorithm issues | Phase 2: SRS Implementation | Simulate 1,000 reviews with edge cases (all failures, long gaps, rapid succession); verify no card gets stuck below 2-day interval |
| AI exercise quality | Phase 3: Exercise Generation | Generate 100 exercises, manually verify 20; error rate must be <5%. Implement automated self-consistency check. |
| Lemmatization failures | Phase 1: Core AI Analysis | Test with 50 sentences containing irregular verbs, phrasal verbs, and collocations. Verify: "went"="go", "look up" != "look", "make a decision" extracted as unit |
| Token cost overrun | Phase 1: Core AI Analysis | Track cost per analysis call. Set budget: <$0.01 per sentence analysis. Alert at >$0.005. |
| Telegram UX problems | Phase 2: Telegram Bot | Test with real reading session: submit 10 sentences from a book in 5 minutes. Bot must not feel like a chore. |
| Exercise difficulty stuck at one level | Phase 3: Exercise Generation | Verify that exercise type progression exists: recognition -> gap-fill -> production for each grammar pattern |
| Dashboard empty states | Phase 4: Web Dashboard | Load dashboard with 0, 1, 10, 100, 1000 data points. All states must look intentional. |

## Sources

- [SM-2 Overdue Card Bias Analysis](https://controlaltbackspace.org/overdue-handling/) -- 13 years of Anki data analysis
- [FSRS vs SM-2 Comparison](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/) -- FSRS achieves 20-30% fewer reviews
- [FSRS Algorithm Details](https://www.quizcat.ai/blog/fsrs-algorithm-next-gen-spaced-repetition) -- trained on 700M reviews
- [LLM Sensitivity to Prompt Engineering](https://arxiv.org/html/2406.12334) -- up to 76-point accuracy variance
- [LLM Structured Output Guide](https://modelmetry.com/blog/how-to-ensure-llm-output-adheres-to-a-json-schema) -- schema enforcement approaches
- [LLM Cost Optimization Strategies](https://www.glukhov.org/post/2025/11/cost-effective-llm-applications) -- prompt caching, model routing, batching
- [Token Optimization Guide](https://www.burnwise.io/blog/token-optimization-guide) -- 60% cost reduction strategies
- [Anki SM-2 Low Interval Hell](https://www.blueraja.com/blog/477/a-better-spaced-repetition-learning-algorithm-sm2) -- SM2+ improvements
- [OpenAI on Hallucinations](https://openai.com/index/why-language-models-hallucinate/) -- why LLMs generate incorrect content
- [Telegram Bot Features](https://core.telegram.org/bots/features) -- official bot UX capabilities
- [Lemmatization Challenges](https://nlp.stanford.edu/IR-book/html/htmledition/stemming-and-lemmatization-1.html) -- Stanford NLP on irregular forms

---
*Pitfalls research for: AI-powered English learning app*
*Researched: 2026-03-09*
