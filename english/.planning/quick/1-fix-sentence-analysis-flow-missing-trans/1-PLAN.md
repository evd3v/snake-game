---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/sentences.ts
  - src/routes/words.ts
  - src/bot/services/api-client.ts
  - src/bot/format.ts
  - src/bot/handlers/sentence.ts
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "Bot message shows sentence translation after the original text"
    - "Words are marked with known/new emoji based on SRS card existence"
    - "Collocations are shown with text, translation, and CEFR level"
    - "Grammar patterns are shown with pattern notation and description"
    - "All analysis is in ONE message"
  artifacts:
    - path: "src/routes/sentences.ts"
      provides: "GET /sentences/:id/details endpoint returning translation, collocations, grammar"
    - path: "src/routes/words.ts"
      provides: "Words endpoint now includes hasSrsCard boolean"
    - path: "src/bot/format.ts"
      provides: "Full analysis message formatting"
    - path: "src/bot/services/api-client.ts"
      provides: "New API client functions and updated types"
  key_links:
    - from: "src/bot/handlers/sentence.ts"
      to: "api-client.ts"
      via: "getSentenceDetails + getSentenceWords calls"
      pattern: "apiClient\\.getSentenceDetails"
    - from: "src/bot/format.ts"
      to: "api-client.ts types"
      via: "SentenceDetails, WordInfo interfaces"
      pattern: "formatAnalysisResult.*SentenceDetails"
---

<objective>
Fix Telegram bot sentence analysis response to show full analysis: sentence translation, vocabulary with known/new markers, collocation details, and grammar pattern details -- all in one message.

Purpose: Currently the bot only shows a word list and count summary. Users need the complete analysis (translation, collocations with translations, grammar with descriptions, known vs new word markers) to understand the sentence.
Output: Updated bot message format matching the agreed template from CONTEXT.md.
</objective>

<execution_context>
@/Users/evd3v/.claude/get-shit-done/workflows/execute-plan.md
@/Users/evd3v/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/1-fix-sentence-analysis-flow-missing-trans/1-CONTEXT.md

<interfaces>
<!-- Current types and contracts the executor needs -->

From src/bot/services/api-client.ts:
```typescript
export interface WordInfo {
  id: number;
  lemma: string;
  translation: string | null;
  cefrLevel: string | null;
  familiarity: string;
  thematicCluster: string | null;
}

export interface JobResult {
  sentenceId: number;
  wordsInserted: number;
  collocationsInserted: number;
  grammarPatternsInserted: number;
}
```

From src/db/schema/sentences.ts:
```typescript
// sentences table has: id, text, translation, cefrLevel, sourceBook, createdAt
```

From src/db/schema/collocations.ts:
```typescript
// collocations table has: id, text, translation, type (collocation|phrasal_verb|idiom), cefrLevel
// sentenceCollocations junction: sentenceId, collocationId
```

From src/db/schema/grammar-patterns.ts:
```typescript
// grammarPatterns table has: id, pattern, description, cefrLevel
// sentenceGrammarPatterns junction: sentenceId, grammarPatternId
```

From src/db/schema/srs-cards.ts:
```typescript
// srsCards table has: id, cardType (vocabulary|grammar), wordId, grammarPatternId, state, due, ...
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add API endpoints for sentence details and word SRS status</name>
  <files>src/routes/sentences.ts, src/routes/words.ts</files>
  <action>
1. In src/routes/sentences.ts, add a GET /sentences/:id/details endpoint that returns:
   - sentence text, translation, cefrLevel (from sentences table)
   - collocations array: join sentenceCollocations -> collocations, return {text, translation, type, cefrLevel} for each
   - grammarPatterns array: join sentenceGrammarPatterns -> grammarPatterns, return {pattern, description, cefrLevel} for each
   Import the required schema tables: sentences, collocations, sentenceCollocations, grammarPatterns, sentenceGrammarPatterns from '../db/schema/index.ts'. Use eq from drizzle-orm for joins. Parse sentenceId as Number from params. Return 404 if sentence not found.

2. In src/routes/words.ts, modify the GET /sentences/:sentenceId/words endpoint to include a `hasSrsCard` boolean for each word. After fetching words, do a single query: select wordId from srsCards where cardType='vocabulary' and wordId IN (wordIds). Build a Set of wordIds that have cards. Map over results adding `hasSrsCard: wordIdSet.has(word.id)`. Import srsCards from '../db/schema/srs-cards.ts' and `inArray` from 'drizzle-orm'.
  </action>
  <verify>
    <automated>npx tsx -e "console.log('TypeScript compiles')" && cd /Users/evd3v/Projects/Personal/english && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>GET /sentences/:id/details returns sentence translation + collocations array + grammar patterns array. GET /sentences/:sentenceId/words now includes hasSrsCard boolean per word.</done>
</task>

<task type="auto">
  <name>Task 2: Update API client types and format function, wire into sentence handler</name>
  <files>src/bot/services/api-client.ts, src/bot/format.ts, src/bot/handlers/sentence.ts</files>
  <action>
1. In src/bot/services/api-client.ts:
   - Add WordInfo.hasSrsCard boolean field to the existing interface
   - Add new interfaces:
     ```
     CollocationInfo { text: string; translation: string | null; type: string; cefrLevel: string | null }
     GrammarPatternInfo { pattern: string; description: string | null; cefrLevel: string | null }
     SentenceDetails { text: string; translation: string | null; cefrLevel: string | null; collocations: CollocationInfo[]; grammarPatterns: GrammarPatternInfo[] }
     ```
   - Add async function getSentenceDetails(sentenceId: number): Promise<SentenceDetails> that fetches GET /sentences/{sentenceId}/details

2. In src/bot/format.ts:
   - Update imports to include new types (SentenceDetails, CollocationInfo, GrammarPatternInfo)
   - Update formatAnalysisResult signature to accept (sentenceText: string, details: SentenceDetails, words: WordInfo[]): string
   - New format (use HTML parse_mode, escapeHtml for all user content):
     Line 1: bold original sentence text (from sentenceText param, NOT details.text -- use the raw input)
     Blank line
     Line 3: translation emoji + details.translation (or skip section if null)
     Blank line
     Vocabulary section header with counts: "N new, M known" where new = words without SRS card, known = words with SRS card
     Each word: emoji marker (use a checkmark character for known, "NEW" marker for new) + lemma + dash + translation + [cefrLevel]
     - Known marker: word.hasSrsCard is true
     - New marker: word.hasSrsCard is false
     Blank line
     Collocations section (only if details.collocations.length > 0):
     Each collocation: text + dash + translation + [cefrLevel]
     Blank line
     Grammar section (only if details.grammarPatterns.length > 0):
     Each pattern: bullet + pattern + dash + description
   - Use the exact emoji from CONTEXT.md template: heading markers, checkmark/new markers for words

3. In src/bot/handlers/sentence.ts:
   - Import getSentenceDetails from api-client
   - After job completes and words are fetched, also call getSentenceDetails(sentenceId)
   - Pass the original text (from ctx.message.text), details, and words to the updated formatAnalysisResult
   - Keep the existing keyboard attachment logic unchanged
  </action>
  <verify>
    <automated>cd /Users/evd3v/Projects/Personal/english && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Bot analysis message shows: original sentence, translation, vocabulary with known/new markers and counts, collocations with translations, grammar with descriptions -- all in one message matching the CONTEXT.md template format.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `npx tsc --noEmit`
2. Manual test: send a sentence to the bot and verify the response shows all sections (translation, vocab with markers, collocations, grammar)
</verification>

<success_criteria>
- Sentence analysis response includes Russian translation of the sentence
- Each word shows known (has SRS card) or new (no SRS card) marker
- Word count summary shows "N new, M known"
- Collocations displayed with text, translation, CEFR level
- Grammar patterns displayed with pattern notation and description
- All content in a single message
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-sentence-analysis-flow-missing-trans/1-SUMMARY.md`
</output>
