# Architecture Patterns

**Domain:** AI-powered personal English learning app (sentence analysis + spaced repetition)
**Researched:** 2026-03-09

## Recommended Architecture

Modular monolith deployed as a single Node.js process behind Nginx, with a background worker process for AI batch jobs. Not microservices -- this is a single-user personal tool. Splitting into separate services adds deployment complexity with zero scaling benefit.

```
                    +------------------+
                    |     Nginx        |
                    |  (reverse proxy) |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +---------v--------+
     |   Vue 3 SPA     |          |  Telegram Bot    |
     |  (static files) |          |  (webhook mode)  |
     +--------+--------+          +---------+--------+
              |                             |
              +-------------+---------------+
                            |
                   +--------v--------+
                   |   REST API       |
                   |   (Express/     |
                   |    Fastify)      |
                   +--------+--------+
                            |
              +-------------+-------------+
              |             |             |
     +--------v---+  +-----v------+ +----v---------+
     | Domain      |  | AI Service | | SRS Engine   |
     | Services    |  | Layer      | | (SM-2)       |
     | (sentences, |  | (analysis, | | (scheduling, |
     |  words,     |  |  exercise  | |  review      |
     |  grammar)   |  |  gen)      | |  sessions)   |
     +--------+----+  +-----+------+ +----+---------+
              |              |             |
              +------+-------+-------------+
                     |
              +------v-------+
              |  PostgreSQL  |
              +--------------+

     Separate process:
              +------------------+
              | Background Worker|
              | (BullMQ + Redis) |
              | - AI batch jobs  |
              | - Exercise gen   |
              +------------------+
```

### Why This Shape

1. **Monolith, not microservices.** Single user, single VPS. A monolith with clear module boundaries gives you all the separation benefits without inter-service communication overhead, distributed transactions, or multi-container orchestration complexity. You can always extract a service later if needed (you won't need to).

2. **Telegram bot as a thin client.** The bot uses webhooks (not long polling) and translates Telegram messages into the same API calls the Vue SPA makes. No separate business logic in the bot -- it is a UI layer only.

3. **Background worker as a separate process.** AI calls are slow (2-15 seconds) and expensive. They must not block the API. A BullMQ worker backed by Redis processes AI jobs asynchronously. The API enqueues a job and returns immediately; the worker picks it up, calls Claude/OpenAI, stores results in PostgreSQL.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Vue 3 SPA** | UI for input, review, dashboard | REST API via HTTP |
| **Telegram Bot** | Quick sentence input, review notifications | REST API via internal HTTP calls or shared service layer |
| **REST API** | Request handling, validation, routing | Domain Services, AI Service, SRS Engine |
| **Domain Services** | Business logic: sentences, words, collocations, grammar patterns, word families | PostgreSQL (via ORM/query builder) |
| **AI Service Layer** | Abstracts Claude/OpenAI; prompt management; response parsing | External AI APIs, BullMQ (enqueue jobs) |
| **SRS Engine** | SM-2 algorithm, scheduling, review session management | PostgreSQL |
| **Background Worker** | Processes AI analysis and exercise generation jobs | BullMQ/Redis, AI Service Layer, PostgreSQL |
| **PostgreSQL** | Persistent storage | All services read/write |
| **Redis** | Job queue state, optional caching | BullMQ, API (cache) |

### Data Flow

#### Flow 1: Sentence Input (primary flow)

```
User enters sentence (via Vue SPA or Telegram Bot)
  |
  v
REST API receives sentence text + source info
  |
  v
Domain Service saves raw sentence to DB (status: "pending_analysis")
  |
  v
AI Service enqueues analysis job to BullMQ
  |
  v
API returns immediately: { id, status: "pending_analysis" }
  |
  v (async, seconds later)
Background Worker picks up job
  |
  v
AI Service calls Claude/OpenAI with structured prompt:
  - Translate sentence
  - Extract words (lemmatized)
  - Identify collocations, phrasal verbs, idioms
  - Detect grammar patterns
  - Assign CEFR level
  |
  v
Worker parses AI response (structured JSON via system prompt)
  |
  v
Domain Service processes extracted data:
  - Upsert words (deduplicate by lemma)
  - Link collocations to constituent words
  - Upsert grammar patterns
  - Create word family associations
  - Assign thematic clusters
  - Create SRS cards for new items
  |
  v
Sentence status updated to "analyzed"
  |
  v
SPA polls or receives WebSocket notification: analysis complete
```

#### Flow 2: Review Session

```
User opens review (Vue SPA)
  |
  v
SRS Engine queries due cards: WHERE next_review <= NOW()
  |
  v
Returns cards with pre-generated exercises (from batch job)
  |
  v
User answers exercise
  |
  v
SRS Engine applies SM-2:
  - Update easiness_factor
  - Calculate next interval
  - Update repetition count
  - Set next_review date
  |
  v
Record response in review_history for analytics
```

#### Flow 3: Batch Exercise Generation (background, periodic)

```
Cron or manual trigger
  |
  v
Query items needing exercises:
  - Cards due in next 48 hours with < 3 pre-generated exercises
  |
  v
Group items by type (word cards, grammar exercises, collocation fill-in-blank)
  |
  v
Batch AI requests (multiple items per prompt to save tokens)
  |
  v
Store generated exercises linked to their SRS cards
```

## Database Schema Design

### Core Entities and Relationships

```
sentences
  id, text, translation, source_book, source_page,
  cefr_level, analysis_status, raw_ai_response,
  created_at

words
  id, lemma, pos (part of speech), translation,
  cefr_level, familiarity_level (0/1/2),
  created_at

word_occurrences
  id, word_id -> words, sentence_id -> sentences,
  surface_form (actual form in sentence)

word_families
  id, root_lemma

word_family_members
  word_family_id -> word_families, word_id -> words

collocations
  id, text, type (collocation/phrasal_verb/idiom),
  translation, cefr_level, familiarity_level

collocation_words
  collocation_id -> collocations, word_id -> words,
  position

collocation_occurrences
  collocation_id -> collocations, sentence_id -> sentences

grammar_patterns
  id, pattern_name, pattern_template (e.g. "would have + V3"),
  category, cefr_level, description

grammar_pattern_occurrences
  grammar_pattern_id -> grammar_patterns,
  sentence_id -> sentences,
  matched_fragment (exact text from sentence)

thematic_clusters
  id, name, description

word_clusters
  word_id -> words, cluster_id -> thematic_clusters

srs_cards
  id, item_type (word/collocation/grammar_pattern),
  item_id, -- polymorphic reference
  easiness_factor (default 2.5),
  interval_days,
  repetition_count,
  next_review,
  last_review,
  created_at

exercises
  id, srs_card_id -> srs_cards,
  exercise_type (flashcard/fill_blank/choose_correct/construct),
  prompt, correct_answer, distractors (jsonb),
  used (boolean),
  created_at

review_history
  id, srs_card_id -> srs_cards,
  exercise_id -> exercises (nullable),
  quality (0-5, SM-2 grade),
  response_time_ms,
  reviewed_at
```

### Schema Design Decisions

1. **Polymorphic SRS cards.** One `srs_cards` table with `item_type` + `item_id` instead of separate card tables per type. Simpler querying for "what's due today" -- a single query across all item types. The polymorphic FK is acceptable here because this is a personal tool, not a multi-tenant SaaS.

2. **Separate occurrence tables.** `word_occurrences` and `collocation_occurrences` link items to their source sentences. This preserves context ("where did I encounter this word?") without denormalizing.

3. **Pre-generated exercises stored in DB.** Exercises are generated in batches and stored, not generated on-the-fly. The `used` flag prevents repeating the same exercise. This is central to the token-saving strategy.

4. **`raw_ai_response` on sentences.** Store the full AI response for debugging and potential re-parsing if the extraction logic changes. JSONB column.

5. **Familiarity as integer, not boolean.** Three levels (0: never seen, 1: seen/recognized, 2: understand in context) maps directly to the project requirement and is simpler than a separate status table.

### Key Indexes

```sql
-- SRS scheduling (most frequent query)
CREATE INDEX idx_srs_cards_next_review ON srs_cards(next_review) WHERE next_review IS NOT NULL;

-- Word deduplication
CREATE UNIQUE INDEX idx_words_lemma_pos ON words(lemma, pos);

-- Sentence analysis status
CREATE INDEX idx_sentences_status ON sentences(analysis_status) WHERE analysis_status = 'pending_analysis';

-- Exercises for a card that haven't been used
CREATE INDEX idx_exercises_card_unused ON exercises(srs_card_id) WHERE used = false;
```

## Patterns to Follow

### Pattern 1: AI Provider Abstraction

Wrap AI calls behind an interface so you can swap Claude for OpenAI (or use both).

```typescript
interface AIProvider {
  analyzeSentence(text: string): Promise<SentenceAnalysis>;
  generateExercises(items: ReviewItem[], count: number): Promise<Exercise[]>;
}

class ClaudeProvider implements AIProvider {
  async analyzeSentence(text: string): Promise<SentenceAnalysis> {
    // Structured prompt + response parsing
  }
}

class OpenAIProvider implements AIProvider {
  // Same interface, different implementation
}
```

**Why:** The project explicitly requires provider independence. This costs almost nothing to implement upfront and saves a rewrite later.

### Pattern 2: Job Queue for AI Calls

Never call AI synchronously in the request path. Always enqueue.

```typescript
// In API handler
const sentence = await sentenceService.create(text, source);
await aiQueue.add('analyze-sentence', { sentenceId: sentence.id });
return { id: sentence.id, status: 'pending_analysis' };

// In worker
aiQueue.process('analyze-sentence', async (job) => {
  const result = await aiProvider.analyzeSentence(job.data.text);
  await sentenceService.saveAnalysis(job.data.sentenceId, result);
});
```

**Why:** AI calls take 2-15 seconds. Blocking the API degrades UX and risks timeouts. The queue also provides automatic retries on failure (AI APIs have ~1-3% error rate).

### Pattern 3: Structured AI Output with Validation

Force AI responses into structured JSON and validate before storing.

```typescript
// System prompt forces JSON output
const systemPrompt = `Analyze the English sentence. Respond ONLY with JSON matching this schema:
{
  "translation": "string",
  "cefr_level": "A1|A2|B1|B2|C1|C2",
  "words": [{ "lemma": "string", "pos": "string", "translation": "string" }],
  "collocations": [{ "text": "string", "type": "collocation|phrasal_verb|idiom", "translation": "string" }],
  "grammar_patterns": [{ "name": "string", "template": "string", "matched_fragment": "string" }]
}`;

// Validate with Zod before storing
const AnalysisSchema = z.object({
  translation: z.string(),
  cefr_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  words: z.array(WordSchema),
  // ...
});
```

**Why:** LLMs return inconsistent formats. Without validation, you get runtime errors downstream. Zod catches bad responses immediately, and the job can be retried with a different prompt variation.

### Pattern 4: Shared Service Layer (Bot + API)

The Telegram bot and REST API share the same service layer. No logic duplication.

```
REST API Handler --> sentenceService.create()
Telegram Bot Handler --> sentenceService.create()  // same function
```

**Why:** Two UIs, one brain. If the bot duplicates business logic, you maintain two codebases that drift apart.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous AI in Request Path
**What:** Calling Claude/OpenAI directly in the API handler and waiting for the response.
**Why bad:** 2-15 second response times. Telegram webhook times out after ~30 seconds. User sees loading spinner. If AI API is down, your whole app is down.
**Instead:** Enqueue job, return pending status, notify when complete.

### Anti-Pattern 2: Storing Exercises Inline in Card Records
**What:** Putting generated exercises as a JSONB column on the SRS card.
**Why bad:** Can't easily query "how many unused exercises exist?", can't track which exercises were used, can't independently expire/regenerate exercises.
**Instead:** Separate `exercises` table linked to `srs_cards`.

### Anti-Pattern 3: Separate Databases or Services Per Feature
**What:** Words in one service, grammar in another, SRS in a third.
**Why bad:** For a single-user app, this creates network hops, distributed transaction problems, and deployment complexity with zero benefit.
**Instead:** Modules within a monolith. Separate files/folders, shared database.

### Anti-Pattern 4: Real-Time AI for Exercise Generation
**What:** Calling AI when user starts a review session to generate exercises on-the-fly.
**Why bad:** User waits 5-10 seconds before each review session. Costs more tokens (no batching discount). If AI API is down, user can't review.
**Instead:** Batch pre-generate exercises for items due in the next 48 hours. User always has exercises ready.

### Anti-Pattern 5: Letting AI Determine Database Structure
**What:** Storing raw AI output as the source of truth without normalization.
**Why bad:** AI outputs vary between calls. "make a decision" might be tagged as a collocation in one analysis and ignored in another. You lose consistency and can't reliably query/aggregate.
**Instead:** Parse AI output into normalized schema, validate, deduplicate by lemma/pattern, and store structured data. Keep raw response for debugging only.

## Suggested Build Order

Based on dependency analysis between components:

### Phase 1: Core Data Layer
Build first because everything depends on it.
- PostgreSQL schema (sentences, words, collocations, grammar_patterns, srs_cards)
- Domain services (CRUD for all entities)
- Basic REST API skeleton (Express/Fastify with typed routes)

### Phase 2: AI Analysis Pipeline
Depends on Phase 1 (needs schema to store results).
- AI provider abstraction (start with Claude)
- Redis + BullMQ setup
- Background worker process
- Sentence analysis job (input -> AI -> parsed -> stored)
- Basic prompt engineering for sentence analysis

### Phase 3: Telegram Bot
Depends on Phase 1-2 (needs API and analysis pipeline).
- Telegraf webhook setup
- Sentence input command
- Analysis result notification
- Docker integration

### Phase 4: SRS Engine
Depends on Phase 1 (needs srs_cards table).
- SM-2 algorithm implementation (pure function, easy to test)
- Review scheduling queries
- Review session flow (get due cards -> present -> grade -> reschedule)

### Phase 5: Exercise Generation
Depends on Phase 2 + 4 (needs AI pipeline and SRS cards).
- Exercise generation prompts (per type: flashcard, fill-blank, etc.)
- Batch generation job (cron-triggered)
- Exercise storage and retrieval

### Phase 6: Vue 3 SPA
Depends on Phase 1, 4, 5 (needs API, SRS, exercises).
- Sentence input UI
- Review session UI
- Dashboard (progress, streaks, heatmap)
- Thematic cluster browser

### Rationale for This Order
- **Data layer first** because you can't build anything without it. Also lets you iterate on schema before it's in production.
- **AI pipeline before bot** because the bot's primary value is "input sentence and get analysis." Without AI, the bot is just a text box.
- **SRS before exercises** because SM-2 is a pure algorithm that doesn't depend on AI. You can test it independently. Exercises need SRS cards to exist.
- **Vue SPA last** because you can validate the entire backend flow via Telegram bot + API tests before building the frontend. This reduces wasted UI work on unstable APIs.

## Scalability Considerations

| Concern | At 1 user (current) | At 10 users | At 100 users |
|---------|---------------------|-------------|--------------|
| AI costs | ~$5-15/month | $50-150/month, need batching optimization | Unsustainable without caching/dedup |
| Database | SQLite would work, PostgreSQL is fine | PostgreSQL fine | PostgreSQL fine, add connection pooling |
| Background jobs | Single worker, no concurrency needed | Single worker with concurrency=3 | Multiple workers, priority queues |
| API | No load concerns | No load concerns | Add rate limiting, basic auth |

For a personal tool, scalability is not a concern. The architecture is designed for **maintainability and reliability**, not scale. The queue-based AI pattern is not for scale -- it's for UX (don't block the user) and resilience (retry on failure).

## Technology Recommendations (Architecture-Driven)

| Layer | Recommendation | Why |
|-------|---------------|-----|
| API Framework | **Fastify** | Faster than Express, built-in TypeScript support, schema validation via JSON Schema |
| ORM/Query | **Drizzle ORM** | Type-safe, SQL-like API, good PostgreSQL support, no magic |
| Job Queue | **BullMQ** | Mature, Redis-backed, supports retries/delays/priorities, good TypeScript types |
| Telegram | **Telegraf** | Most popular Node.js Telegram framework, webhook support, good middleware pattern |
| Validation | **Zod** | Runtime validation for AI responses, integrates with TypeScript types |
| AI SDK | **Direct HTTP** (Anthropic SDK / OpenAI SDK) | Official SDKs are thin wrappers; no need for LangChain overhead |

## Sources

- [SM-2 algorithm explanation](https://dev.to/umangsinha12/how-spaced-repetition-actually-works-the-sm-2-algorithm-1ge3) - SM-2 internals
- [SM-2 algorithm explained](https://tegaru.app/en/blog/sm2-algorithm-explained) - Algorithm parameters
- [PostgreSQL SRS implementation](https://github.com/sivers/srs) - SRS in PostgreSQL functions
- [Scalable Telegram Bot with BullMQ](https://medium.com/@pushpesh0/building-a-scalable-telegram-bot-with-node-js-bullmq-and-webhooks-6b0070fcbdfc) - Queue pattern for bots
- [Telegraf framework](https://github.com/telegraf/telegraf) - Telegram bot framework
- [5 Patterns for Scalable LLM Integration](https://latitude-blog.ghost.io/blog/5-patterns-for-scalable-llm-service-integration/) - Queue-based AI patterns
- [Design Patterns for LLM Microservices](https://latitude.so/blog/design-patterns-llm-microservices/) - AI service architecture
- [AI-powered backend architecture 2026](https://www.refontelearning.com/blog/ai-powered-backend-architecture-in-2026-how-backend-engineers-build-scalable-intelligent-systems) - Modern backend patterns
