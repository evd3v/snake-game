# Phase 2: AI Analysis Pipeline - Research

**Researched:** 2026-03-09
**Domain:** AI-powered NLP analysis, structured output, lemmatization, vocabulary extraction
**Confidence:** HIGH

## Summary

This phase implements the core AI analysis pipeline: a user submits a sentence, and the system produces structured vocabulary, collocations, grammar patterns, word families, and thematic clusters -- all stored in the database. The existing BullMQ worker (`src/workers/index.ts`) has a placeholder processor ready to be replaced with real analysis logic.

The recommended approach uses Vercel AI SDK v6 (`ai` package) with `generateText` + `Output.object()` for structured AI output with Zod schema validation. This provides provider-agnostic AI calls (swap OpenAI/Anthropic via config), type-safe structured output, and automatic schema enforcement. For deterministic lemmatization (deduplication before DB insert), use `wink-lemmatizer` -- it is lightweight, zero-dependency, and handles nouns/verbs/adjectives. The AI handles context-dependent extraction (collocations, idioms, word families, thematic clusters, CEFR), while the deterministic lemmatizer normalizes surface forms to lemmas for deduplication.

**Primary recommendation:** Use AI SDK v6 `generateText` + `Output.object()` with Zod schemas for structured analysis. Use `wink-lemmatizer` for deterministic lemma normalization. Process everything in BullMQ worker, store results via Drizzle ORM in existing schema.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SENT-03 | AI analyzes sentence: translation, grammar breakdown, vocabulary, CEFR level | AI SDK structured output with comprehensive Zod schema; single `generateText` call returns all fields |
| SENT-04 | AI extracts collocations and phrasal verbs as separate units | Zod schema includes `collocations` array with type enum (collocation/phrasal_verb/idiom); maps to existing `collocations` table |
| SENT-05 | AI identifies grammar patterns with specific notation | Zod schema includes `grammarPatterns` array with pattern string and description; maps to existing `grammar_patterns` table |
| SENT-06 | AI detects word families and links related forms | AI returns word family groups; worker looks up existing words by lemma to link via `word_family_id` FK |
| SENT-07 | AI assigns thematic cluster to extracted vocabulary | Zod schema includes `thematicCluster` per word; stored in `words.thematic_cluster` column |
| VOCAB-01 | Words stored as lemmas with automatic deduplication | Two-pass: AI extracts words, `wink-lemmatizer` normalizes, `ON CONFLICT (lemma) DO NOTHING` or upsert in Drizzle |
| VOCAB-04 | Each word linked to original sentence(s) | Insert into `sentence_words` junction table after word upsert |
| VOCAB-05 | Collocations and phrasal verbs stored as independent learnable units | Insert into `collocations` table + `sentence_collocations` junction |
| VOCAB-06 | Word families linked in database | Create/find `word_families` record, set `word_family_id` on all related words |
| VOCAB-07 | Words auto-grouped into thematic clusters | AI provides cluster label per word; stored directly in `words.thematic_cluster` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^6.0 | Unified AI SDK for structured output | Provider-agnostic, type-safe with Zod, actively maintained by Vercel |
| `@ai-sdk/openai` | ^3.0 | OpenAI provider | Official AI SDK provider package |
| `@ai-sdk/anthropic` | ^3.0 | Anthropic provider | Official AI SDK provider package |
| `zod` | ^3.23 | Schema validation for AI output | Required by AI SDK for structured output; also validates API input |
| `wink-lemmatizer` | ^3.0.4 | Deterministic English lemmatization | Lightweight, zero-dep, handles noun/verb/adjective; 100% test coverage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` | ^0.45 | Database operations (already installed) | All DB reads/writes for analysis results |
| `bullmq` | ^5.70 | Job queue (already installed) | Worker processes analysis jobs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI SDK | Direct OpenAI/Anthropic SDKs | Loses provider switching; AI SDK adds minimal overhead |
| wink-lemmatizer | compromise | Compromise is heavier (200KB+), does more than needed; wink is focused |
| wink-lemmatizer | LLM-only lemmatization | Non-deterministic; same word could produce different lemmas across calls |

**Installation:**
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic zod wink-lemmatizer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    ai/
      provider.ts          # AI provider factory (OpenAI or Anthropic based on env)
      schemas.ts            # Zod schemas for AI structured output
      prompts.ts            # System/user prompt templates
      analyze-sentence.ts   # Main analysis function (generateText + Output.object)
    lemmatizer.ts           # wink-lemmatizer wrapper
  services/
    analysis.ts             # Orchestrates: AI call -> lemmatize -> DB store
    word-family.ts          # Word family detection and linking logic
  workers/
    index.ts                # BullMQ worker (update placeholder with real processor)
  routes/
    sentences.ts            # POST /sentences endpoint (enqueue job, return jobId)
    sentences-status.ts     # GET /sentences/:jobId/status (poll for result)
```

### Pattern 1: Provider Factory
**What:** A factory function that returns the correct AI model based on environment configuration.
**When to use:** All AI calls go through this factory so provider can be swapped without code changes.
**Example:**
```typescript
// src/lib/ai/provider.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export function getModel() {
  const provider = process.env.AI_PROVIDER ?? 'openai';
  switch (provider) {
    case 'openai':
      return openai(process.env.AI_MODEL ?? 'gpt-4o');
    case 'anthropic':
      return anthropic(process.env.AI_MODEL ?? 'claude-sonnet-4-20250514');
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
```

### Pattern 2: Structured Output with Zod Schema
**What:** Define the complete analysis response as a Zod schema, use AI SDK's `Output.object()` for type-safe structured generation.
**When to use:** Every AI analysis call.
**Example:**
```typescript
// src/lib/ai/schemas.ts
import { z } from 'zod';

export const sentenceAnalysisSchema = z.object({
  translation: z.string().describe('Russian translation of the sentence'),
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('CEFR level of the sentence'),
  vocabulary: z.array(z.object({
    word: z.string().describe('The word as it appears in the sentence'),
    lemma: z.string().describe('Base/dictionary form of the word'),
    translation: z.string().describe('Russian translation'),
    partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'determiner', 'interjection']),
    cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    thematicCluster: z.string().describe('Thematic group, e.g. "emotions", "business", "nature"'),
  })),
  collocations: z.array(z.object({
    text: z.string().describe('The collocation/phrasal verb/idiom as a unit'),
    translation: z.string().describe('Russian translation'),
    type: z.enum(['collocation', 'phrasal_verb', 'idiom']),
    cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  })),
  grammarPatterns: z.array(z.object({
    pattern: z.string().describe('Grammar pattern notation, e.g. "would have + V3"'),
    description: z.string().describe('Brief explanation of the pattern'),
    cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  })),
  wordFamilies: z.array(z.object({
    root: z.string().describe('Root/base word of the family'),
    forms: z.array(z.string()).describe('All known forms of this word family'),
  })),
});

export type SentenceAnalysis = z.infer<typeof sentenceAnalysisSchema>;
```

```typescript
// src/lib/ai/analyze-sentence.ts
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getModel } from './provider.ts';
import { sentenceAnalysisSchema } from './schemas.ts';

export async function analyzeSentence(sentence: string) {
  const { output } = await generateText({
    model: getModel(),
    output: Output.object({ schema: sentenceAnalysisSchema }),
    system: `You are an English language analysis expert helping a Russian-speaking learner at B1-B2 level...`,
    prompt: `Analyze this English sentence:\n\n"${sentence}"`,
  });
  return output;
}
```

### Pattern 3: Two-Pass Lemma Normalization
**What:** AI provides initial lemma guess, then `wink-lemmatizer` normalizes deterministically for consistent deduplication.
**When to use:** Before inserting words into DB to ensure same word always maps to same lemma.
**Example:**
```typescript
// src/lib/lemmatizer.ts
import lemmatizer from 'wink-lemmatizer';

const posMap = {
  noun: lemmatizer.noun,
  verb: lemmatizer.verb,
  adjective: lemmatizer.adjective,
  adverb: lemmatizer.adjective, // adverbs often share adjective root
} as const;

export function normalizeLemma(word: string, partOfSpeech: string): string {
  const fn = posMap[partOfSpeech as keyof typeof posMap];
  if (fn) {
    return fn(word.toLowerCase());
  }
  return word.toLowerCase();
}
```

### Pattern 4: Upsert with Deduplication
**What:** Use Drizzle `onConflictDoUpdate` or `onConflictDoNothing` on the unique `lemma` column.
**When to use:** Every word insert to prevent duplicates.
**Example:**
```typescript
// In analysis service
import { words } from '../db/schema/index.ts';
import { eq } from 'drizzle-orm';

async function upsertWord(db: Database, lemma: string, data: Partial<typeof words.$inferInsert>) {
  const [word] = await db
    .insert(words)
    .values({ lemma, ...data })
    .onConflictDoUpdate({
      target: words.lemma,
      set: {
        // Update thematic cluster if provided (AI might give better info on re-encounter)
        thematicCluster: data.thematicCluster,
      },
    })
    .returning();
  return word;
}
```

### Pattern 5: Worker-Based Async Processing
**What:** The sentence submission API enqueues a BullMQ job; the worker processes it asynchronously; client polls for result.
**When to use:** All AI analysis -- never in the request path.
**Example:**
```typescript
// POST /sentences route
fastify.post('/sentences', async (request, reply) => {
  const { text, sourceBook } = request.body as { text: string; sourceBook?: string };
  const job = await fastify.analysisQueue.add('analyze', { text, sourceBook });
  return reply.code(202).send({ jobId: job.id });
});

// GET /sentences/:jobId/status
fastify.get('/sentences/:jobId/status', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const job = await fastify.analysisQueue.getJob(jobId);
  if (!job) return reply.code(404).send({ error: 'Job not found' });
  const state = await job.getState();
  if (state === 'completed') {
    return { status: 'completed', result: job.returnvalue };
  }
  return { status: state };
});
```

### Anti-Patterns to Avoid
- **AI call in request path:** Always queue via BullMQ. AI calls take 3-15 seconds. Never block the HTTP request.
- **Relying solely on AI for lemmatization:** AI lemmas are non-deterministic. "running" might become "run" in one call and "running" in another. Always normalize with `wink-lemmatizer`.
- **One AI call per extracted item:** Make a single structured output call per sentence. Do not call AI separately for vocabulary, collocations, grammar, etc.
- **Storing raw surface forms as lemmas:** Always normalize to base form before insert. "reluctantly" -> "reluctant" (adjective base), not stored as-is.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI structured output parsing | Custom JSON extraction from text | AI SDK `Output.object()` + Zod | Handles retries, validation, type safety; supports streaming |
| Lemmatization | Regex-based stemming | `wink-lemmatizer` | Irregular forms (knives->knife, eaten->eat) need dictionary lookup |
| Job queue | setTimeout/setInterval polling | BullMQ (already installed) | Retries, concurrency control, job state tracking |
| Schema validation | Manual if/typeof checks | Zod | Composable, type inference, AI SDK integration |
| Provider abstraction | if/else for OpenAI vs Anthropic | AI SDK provider pattern | Unified API, tested against each provider |

**Key insight:** The AI SDK eliminates the need to write provider-specific code, JSON parsing/validation logic, or structured output enforcement. It does this reliably with Zod integration.

## Common Pitfalls

### Pitfall 1: wink-lemmatizer Requires POS Tag
**What goes wrong:** Calling `lemmatizer.noun('running')` returns 'running' (not a noun), but `lemmatizer.verb('running')` returns 'run'.
**Why it happens:** wink-lemmatizer has separate functions per part of speech -- `noun()`, `verb()`, `adjective()`.
**How to avoid:** AI must provide part-of-speech for each word. Use the POS to route to the correct lemmatizer function.
**Warning signs:** Words not deduplicating properly; same word stored under multiple lemmas.

### Pitfall 2: Word Family Linking is Complex
**What goes wrong:** Naively creating a new word family for every sentence analysis leads to fragmented families. "reluctant" from sentence 1 and "reluctantly" from sentence 2 end up in separate families.
**Why it happens:** Word family detection requires cross-referencing existing DB state.
**How to avoid:** After AI returns word family groups, check DB for existing words sharing the same root. If found, use their existing `word_family_id`. If creating new family, link all existing words with matching roots.
**Warning signs:** Same root word appearing in multiple `word_families` rows.

### Pitfall 3: Collocation Deduplication
**What goes wrong:** "take into account" from two different sentences creates two collocation records.
**Why it happens:** `collocations` table has no unique constraint on `text`.
**How to avoid:** Add a unique constraint on `collocations.text` column, or do a find-or-create pattern before inserting. The junction table `sentence_collocations` handles the many-to-many relationship.
**Warning signs:** Duplicate rows in `collocations` table.

### Pitfall 4: wink-lemmatizer is CJS-Only
**What goes wrong:** `import lemmatizer from 'wink-lemmatizer'` may fail in ESM context.
**Why it happens:** wink-lemmatizer v3.0.4 is a CommonJS package, last updated ~3 years ago.
**How to avoid:** The project uses `"type": "module"` in package.json and `tsx` for execution, which handles CJS interop. Use default import: `import lemmatizer from 'wink-lemmatizer'`. Test the import early.
**Warning signs:** `ERR_REQUIRE_ESM` or `default is not a function` errors.

### Pitfall 5: AI Output Validation Failures
**What goes wrong:** `NoObjectGeneratedError` thrown when AI cannot produce valid schema-conforming output.
**Why it happens:** Schema too strict, or AI model doesn't follow instructions well for complex schemas.
**How to avoid:** Use `.describe()` on every Zod field. Keep enum values clear. Add try/catch with job retry logic. Consider making some fields optional with `.nullable()` or `.optional()`.
**Warning signs:** Jobs failing consistently with validation errors.

### Pitfall 6: Grammar Pattern Deduplication
**What goes wrong:** "would have + V3" and "would have + past participle" stored as separate patterns.
**Why it happens:** AI uses slightly different notation across calls.
**How to avoid:** Define a specific notation system in the prompt (e.g., V1/V2/V3, Ving, to-V). Normalize pattern strings before insert. Use unique constraint on `grammar_patterns.pattern` (already exists in schema).
**Warning signs:** Near-duplicate patterns in `grammar_patterns` table.

## Code Examples

### Complete Worker Processor
```typescript
// src/workers/index.ts (updated)
import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedisUrl } from '../lib/redis.ts';
import { createDb } from '../db/index.ts';
import { analyzeSentence } from '../lib/ai/analyze-sentence.ts';
import { storeAnalysisResults } from '../services/analysis.ts';

const redisUrl = new URL(getRedisUrl());
const db = createDb(process.env.DATABASE_URL!);

const worker = new Worker(
  'sentence-analysis',
  async (job) => {
    const { text, sourceBook } = job.data;

    // Step 1: AI structured analysis
    const analysis = await analyzeSentence(text);

    // Step 2: Store sentence + all extracted items in DB
    const result = await storeAnalysisResults(db, text, sourceBook, analysis);

    return result;
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      maxRetriesPerRequest: null,
    },
    concurrency: 2, // Limit concurrent AI calls
  },
);
```

### Env Configuration
```bash
# .env additions for Phase 2
AI_PROVIDER=openai          # or "anthropic"
AI_MODEL=gpt-4o             # or "claude-sonnet-4-20250514"
OPENAI_API_KEY=sk-...       # if using OpenAI
ANTHROPIC_API_KEY=sk-ant-.. # if using Anthropic
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject()` (AI SDK v5) | `generateText()` + `Output.object()` (AI SDK v6) | 2025-2026 | `generateObject` deprecated; use new Output API |
| JSON Mode (OpenAI) | Strict Structured Outputs | 2024 | Guaranteed schema adherence, not just valid JSON |
| Direct provider SDKs | Unified AI SDK | 2024-2025 | Provider switching without code changes |

**Deprecated/outdated:**
- `generateObject` / `streamObject`: Deprecated in AI SDK v6. Use `generateText` with `Output.object()` instead.
- OpenAI JSON Mode (`type: "json_object"`): Legacy. Use Structured Outputs with `json_schema` type.
- `CoreMessage`: Removed in AI SDK v6. Use `ModelMessage`.

## Open Questions

1. **Collocation unique constraint**
   - What we know: `collocations` table currently has no unique constraint on `text`.
   - What's unclear: Whether to add a DB-level unique constraint or handle in application code.
   - Recommendation: Add unique constraint via Drizzle migration. Use `onConflictDoNothing` for upsert.

2. **Grammar pattern notation standardization**
   - What we know: STATE.md flags "Grammar taxonomy (50-100 patterns for B1-C1) needs definition before Phase 2 prompt engineering."
   - What's unclear: Full taxonomy of patterns to include in the prompt.
   - Recommendation: Start with a focused set (20-30 common B1-C1 patterns) in the system prompt. Use notation like `V1/V2/V3`, `Ving`, `to-V`, `modal + V1`. Let the set grow organically as real sentences are processed.

3. **wink-lemmatizer CJS interop**
   - What we know: Package is CJS-only, project uses ESM with tsx.
   - What's unclear: Whether default import works cleanly.
   - Recommendation: Test import in Wave 0. Fallback: use `createRequire` from `node:module`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SENT-03 | AI returns translation, grammar, vocabulary, CEFR | integration | `npm test -- tests/analysis.test.ts -t "returns structured analysis"` | Wave 0 |
| SENT-04 | Collocations extracted and stored | integration | `npm test -- tests/analysis.test.ts -t "extracts collocations"` | Wave 0 |
| SENT-05 | Grammar patterns identified with notation | integration | `npm test -- tests/analysis.test.ts -t "identifies grammar patterns"` | Wave 0 |
| SENT-06 | Word families detected and linked | integration | `npm test -- tests/analysis.test.ts -t "links word families"` | Wave 0 |
| SENT-07 | Thematic clusters assigned | integration | `npm test -- tests/analysis.test.ts -t "assigns thematic clusters"` | Wave 0 |
| VOCAB-01 | Lemma deduplication | unit | `npm test -- tests/lemmatizer.test.ts` | Wave 0 |
| VOCAB-04 | Words linked to source sentence | integration | `npm test -- tests/analysis.test.ts -t "links words to sentence"` | Wave 0 |
| VOCAB-05 | Collocations as independent units | integration | `npm test -- tests/analysis.test.ts -t "stores collocations independently"` | Wave 0 |
| VOCAB-06 | Word families linked in DB | integration | `npm test -- tests/word-family.test.ts` | Wave 0 |
| VOCAB-07 | Words auto-grouped into clusters | integration | `npm test -- tests/analysis.test.ts -t "groups words into clusters"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lemmatizer.test.ts` -- unit tests for lemma normalization with POS routing
- [ ] `tests/analysis.test.ts` -- integration tests for full analysis pipeline (mock AI, verify DB state)
- [ ] `tests/word-family.test.ts` -- integration tests for word family linking logic
- [ ] `tests/sentences-api.test.ts` -- API endpoint tests for POST /sentences and GET /sentences/:jobId/status
- [ ] AI response mocking strategy: either mock `generateText` or use a fixture-based approach

## Sources

### Primary (HIGH confidence)
- [AI SDK v6 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) -- generateObject deprecation, Output.object() API
- [AI SDK Node.js Getting Started](https://ai-sdk.dev/docs/getting-started/nodejs) -- installation, provider setup
- [AI SDK generateObject cookbook](https://ai-sdk.dev/cookbook/node/generate-object) -- Output.object() usage with Zod
- [AI SDK Providers: OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai) -- provider configuration
- [AI SDK Providers: Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- provider configuration

### Secondary (MEDIUM confidence)
- [wink-lemmatizer GitHub](https://github.com/winkjs/wink-lemmatizer) -- API reference, POS-specific functions
- [OpenAI Structured Outputs Guide](https://developers.openai.com/api/docs/guides/structured-outputs/) -- native structured output support
- [wink-lemmatizer npm](https://www.npmjs.com/package/wink-lemmatizer) -- version 3.0.4, last updated ~3 years ago

### Tertiary (LOW confidence)
- wink-lemmatizer CJS/ESM interop -- not directly verified, inferred from package age and CJS default

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- AI SDK v6 is well-documented, actively maintained, verified via official docs
- Architecture: HIGH -- follows established patterns from Phase 1 (BullMQ worker, Fastify plugins, Drizzle ORM)
- Pitfalls: HIGH -- identified from real project constraints (CJS interop, schema design, dedup logic)
- Lemmatizer choice: MEDIUM -- wink-lemmatizer is stable but unmaintained; adequate for this use case

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (30 days -- AI SDK is fast-moving, check for updates)
