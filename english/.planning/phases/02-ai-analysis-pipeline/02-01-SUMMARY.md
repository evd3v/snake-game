---
phase: 02-ai-analysis-pipeline
plan: 01
subsystem: ai, nlp
tags: [ai-sdk, openai, anthropic, zod, structured-output, wink-lemmatizer, tdd]

# Dependency graph
requires:
  - phase: 01-02
    provides: Fastify server, BullMQ worker, vitest test config
provides:
  - AI provider factory (OpenAI/Anthropic via env config)
  - Zod schema for structured sentence analysis output
  - System and user prompt templates with grammar notation
  - analyzeSentence function with structured AI output
  - Deterministic lemma normalization via wink-lemmatizer
  - Unit tests for lemmatizer (9 cases)
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: [ai, "@ai-sdk/openai", "@ai-sdk/anthropic", zod, wink-lemmatizer]
  patterns: [provider-factory, structured-output-zod, two-pass-lemmatization, tdd-red-green]

key-files:
  created:
    - src/lib/ai/provider.ts
    - src/lib/ai/schemas.ts
    - src/lib/ai/prompts.ts
    - src/lib/ai/analyze-sentence.ts
    - src/lib/lemmatizer.ts
    - src/types/wink-lemmatizer.d.ts
    - tests/lemmatizer.test.ts
  modified:
    - package.json
    - .env.example

key-decisions:
  - "Adverb lemmatization strips -ly suffix before adjective lookup since wink-lemmatizer has no adverb function"
  - "Added custom type declaration for wink-lemmatizer CJS package (no @types available)"

patterns-established:
  - "Provider factory pattern: getModel() reads AI_PROVIDER/AI_MODEL env vars, returns provider-agnostic model"
  - "Structured output pattern: generateText + Output.object with Zod schema for type-safe AI responses"
  - "Two-pass lemmatization: AI provides initial lemma, normalizeLemma deterministically normalizes by POS"

requirements-completed: [SENT-03, SENT-05, VOCAB-01]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 2 Plan 01: AI SDK and NLP Building Blocks Summary

**AI SDK provider factory with Zod structured output schema, prompt templates with V1/V2/V3 grammar notation, analyzeSentence function, and wink-lemmatizer wrapper with 9 passing unit tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T11:39:22Z
- **Completed:** 2026-03-09T11:42:00Z
- **Tasks:** 2 (Task 2 via TDD)
- **Files modified:** 9

## Accomplishments
- AI provider factory supporting OpenAI and Anthropic via environment configuration
- Comprehensive Zod schema covering vocabulary, collocations, grammar patterns, word families, CEFR levels, and translations
- System prompt with grammar notation conventions (V1/V2/V3, Ving, to-V, modal + V1) for consistent pattern extraction
- analyzeSentence function using AI SDK v6 generateText + Output.object for type-safe structured output
- Deterministic lemmatizer wrapper routing wink-lemmatizer by POS with adverb-to-adjective root handling
- 9 unit tests covering irregular forms, POS routing, lowercasing, and passthrough for unknown POS

## Task Commits

Each task was committed atomically:

1. **Task 1: AI provider factory, Zod schema, prompts, analyzeSentence** - `f1ae9d5` (feat)
2. **Task 2 RED: Failing lemmatizer unit tests** - `c581beb` (test)
3. **Task 2 GREEN: Lemmatizer implementation** - `06f81ae` (feat)

## Files Created/Modified
- `src/lib/ai/provider.ts` - AI provider factory (OpenAI/Anthropic based on env)
- `src/lib/ai/schemas.ts` - Zod schema for sentence analysis structured output
- `src/lib/ai/prompts.ts` - System prompt and user prompt builder
- `src/lib/ai/analyze-sentence.ts` - Main AI analysis function with error handling
- `src/lib/lemmatizer.ts` - wink-lemmatizer wrapper with POS routing and adverb handling
- `src/types/wink-lemmatizer.d.ts` - Type declaration for CJS wink-lemmatizer package
- `tests/lemmatizer.test.ts` - 9 unit tests for lemmatizer
- `package.json` - Added ai, @ai-sdk/openai, @ai-sdk/anthropic, zod, wink-lemmatizer
- `.env.example` - Added AI_PROVIDER, AI_MODEL, OPENAI_API_KEY, ANTHROPIC_API_KEY

## Decisions Made
- Adverb lemmatization strips -ly suffix before passing to wink-lemmatizer adjective function, since the library has no dedicated adverb method and adverbs typically share adjective roots.
- Added custom `.d.ts` type declaration for wink-lemmatizer because no @types package exists and the CJS module lacks TypeScript types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adverb lemmatization not stripping -ly suffix**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** wink-lemmatizer.adjective('quickly') returns 'quickly' unchanged -- it does not strip -ly
- **Fix:** Added lemmatizeAdverb helper that strips -ly suffix (including -ily -> -y mapping) before adjective lookup
- **Files modified:** src/lib/lemmatizer.ts
- **Verification:** All 9 tests pass including normalizeLemma('quickly', 'adverb') === 'quick'
- **Committed in:** 06f81ae (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Missing type declaration for wink-lemmatizer**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `npx tsc --noEmit` failed with TS7016 -- no declaration file for CJS module wink-lemmatizer
- **Fix:** Created src/types/wink-lemmatizer.d.ts with typed exports (noun, verb, adjective functions)
- **Files modified:** src/types/wink-lemmatizer.d.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 06f81ae (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct behavior and compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - AI API keys needed at runtime but not for development/testing.

## Next Phase Readiness
- All AI and NLP building blocks ready for Plan 02 (analysis service + DB storage)
- analyzeSentence, schemas, and lemmatizer can be imported directly by the analysis service
- Provider factory allows swapping between OpenAI and Anthropic via environment variables

---
*Phase: 02-ai-analysis-pipeline*
*Completed: 2026-03-09*
