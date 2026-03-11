---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/schema/word-senses.ts
  - src/lib/ai/schemas.ts
  - src/lib/ai/prompts.ts
  - src/lib/ai/cloze-prompts.ts
  - src/routes/review.ts
  - src/services/analysis.ts
  - src/bot/handlers/review.ts
  - src/bot/services/api-client.ts
  - src/bot/notifications/scheduler.ts
  - src/bot/notifications/review-check.ts
  - web/src/types/api.ts
  - web/src/components/review/ReviewCard.vue
autonomous: true
requirements: [QUICK-3-DEFINITIONS, QUICK-3-GRAMMAR, QUICK-3-NOTIFICATIONS]
must_haves:
  truths:
    - "Vocabulary review cards show English definition/usage explanation alongside translation"
    - "Grammar exercises test word choice and usage context, not just grammatical form"
    - "Telegram notifications arrive once daily at 21:00 if user has not reviewed today"
    - "Notification includes micro progress report with card stats"
  artifacts:
    - path: "src/db/schema/word-senses.ts"
      provides: "definition column on word_senses"
      contains: "definition"
    - path: "src/lib/ai/cloze-prompts.ts"
      provides: "Usage-focused exercise generation prompt"
    - path: "src/bot/notifications/scheduler.ts"
      provides: "Daily 21:00 cron-style scheduler"
  key_links:
    - from: "src/lib/ai/schemas.ts"
      to: "src/services/analysis.ts"
      via: "definition field extracted by AI and saved to word_senses"
      pattern: "definition"
    - from: "src/routes/review.ts"
      to: "web/src/components/review/ReviewCard.vue"
      via: "definition field in DueCard API response"
      pattern: "definition"
---

<objective>
Three improvements to the English learning app:
1. Add word definitions to vocabulary review cards (both web and Telegram)
2. Rethink grammar exercises to focus on word choice/usage instead of grammatical form filling
3. Change notifications from hourly to daily at 21:00 with micro progress report

Purpose: Better learning experience -- definitions give context beyond translation, usage-focused exercises match how the user actually thinks about language, and daily notifications reduce noise while adding value.
Output: Updated schema, AI prompts, review API, review UIs, and notification scheduler.
</objective>

<execution_context>
@/Users/evd3v/.claude/get-shit-done/workflows/execute-plan.md
@/Users/evd3v/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/db/schema/word-senses.ts
@src/db/schema/words.ts
@src/lib/ai/schemas.ts
@src/lib/ai/prompts.ts
@src/lib/ai/cloze-prompts.ts
@src/lib/ai/cloze-schemas.ts
@src/services/analysis.ts
@src/routes/review.ts
@src/bot/handlers/review.ts
@src/bot/services/api-client.ts
@src/bot/notifications/scheduler.ts
@src/bot/notifications/review-check.ts
@web/src/types/api.ts
@web/src/components/review/ReviewCard.vue
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add word definitions to review cards</name>
  <files>
    src/db/schema/word-senses.ts
    src/lib/ai/schemas.ts
    src/lib/ai/prompts.ts
    src/routes/review.ts
    src/services/analysis.ts
    src/bot/handlers/review.ts
    src/bot/services/api-client.ts
    web/src/types/api.ts
    web/src/components/review/ReviewCard.vue
  </files>
  <action>
    1. **Schema**: Add `definition` text column to `word_senses` in `src/db/schema/word-senses.ts`. Run `npm run db:generate && npm run db:push` to apply.

    2. **AI extraction**: In `src/lib/ai/schemas.ts`, add `definition` field to the vocabulary item schema:
       ```
       definition: z.string().describe('Brief English definition: what this word means and when/how it is typically used (1-2 sentences)')
       ```
       In `src/lib/ai/prompts.ts`, add to the Vocabulary Extraction instructions:
       ```
       - Definition — a brief English explanation of what the word means and in what context it is typically used (1-2 sentences). This should help a learner understand the word's usage beyond just a translation.
       ```

    3. **Save definition**: In `src/services/analysis.ts` (or wherever word_senses are inserted after AI analysis), ensure the `definition` field from AI response is saved to the `word_senses.definition` column.

    4. **Review API**: In `src/routes/review.ts`, update the vocabulary card query to also select `wordSenses.definition`. Include it in the returned `word` object as `definition`.

    5. **Telegram bot**: In `src/bot/services/api-client.ts`, add `definition?: string | null` to the `word` property of `DueCard` interface. In `src/bot/handlers/review.ts`:
       - In `formatCardReveal()`, after the translation line, add the definition on a new line if present: `\n\n📖 <i>${escapeHtml(card.word.definition)}</i>`

    6. **Web types**: In `web/src/types/api.ts`, add `definition?: string | null` to the `word` property inside `DueCard` interface.

    7. **Web ReviewCard**: In `web/src/components/review/ReviewCard.vue`, in the vocabulary revealed section (after the translation `<p>`), add:
       ```vue
       <p v-if="card.word?.definition" class="definition">{{ card.word.definition }}</p>
       ```
       Add `.definition` style: `font-size: 14px; color: #64748b; margin-top: 8px; line-height: 1.5; font-style: italic;`
  </action>
  <verify>
    <automated>cd /Users/evd3v/Projects/Personal/english && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - word_senses table has definition column
    - AI schema extracts definition for each vocabulary word
    - Review API returns definition in vocabulary card data
    - Telegram reveal shows definition below translation
    - Web ReviewCard shows definition below translation when revealed
  </done>
</task>

<task type="auto">
  <name>Task 2: Rethink grammar exercises for word choice focus</name>
  <files>
    src/lib/ai/cloze-prompts.ts
  </files>
  <action>
    Update `CLOZE_SYSTEM_PROMPT` in `src/lib/ai/cloze-prompts.ts` to shift exercise focus from grammatical form filling to word choice and usage context. Replace the current prompt with one that instructs the AI to:

    1. Create exercises where the blank tests whether the learner knows WHICH word fits in a given context, not just the grammatical form
    2. The blank should remove a content word (verb, noun, adjective, adverb) whose selection requires understanding of meaning, register, or collocation
    3. Provide 2-3 answer options in the hint (one correct, others plausible but wrong) to make it a word-choice exercise
    4. The answer should be the correct word, and the hint should list options like "choose: sustained / maintained / kept"
    5. Keep the pattern connection: exercises should still use sentences that demonstrate the grammar pattern, but the TEST is about word choice within that pattern

    New prompt direction:
    ```
    You are an English exercise generator for a Russian-speaking learner at B1-B2 level.

    Your task is to create word-choice exercises that practice vocabulary usage within the context of a specific grammar pattern.

    Rules:
    - Each sentence must naturally use the specified grammar pattern
    - Replace a KEY CONTENT WORD with "___" — the word whose selection requires understanding meaning, usage, or collocation
    - The exercise tests: "Which word fits here?" NOT "What grammatical form goes here?"
    - Bad blank: "She has ___ running every morning" (tests grammar — present participle)
    - Good blank: "She has ___ running every morning since January" (tests word choice — "been" vs "kept" vs "started", understanding of present perfect continuous)
    - Better blank: "The company ___ a significant loss last quarter" (tests word choice — "sustained" vs "received" vs "got", understanding of formal register and collocation)
    - The hint MUST provide 2-3 options: one correct and 1-2 plausible alternatives (e.g., "choose: sustained / received / got")
    - The answer is the single correct word
    - Use vocabulary at B1-B2 level — the challenge is choosing the RIGHT word, not knowing rare words
    - Difficulty levels:
      1 = Common word choices with clear context clues
      2 = Words with subtle meaning differences (e.g., "make" vs "do", "say" vs "tell")
      3 = Register-sensitive choices or collocation-dependent selections
    - Spread exercises evenly across all 3 difficulty levels
    - Keep sentences between 8-20 words
    ```

    Also update `buildClozePrompt` to reflect the word-choice focus in its instruction text.
  </action>
  <verify>
    <automated>cd /Users/evd3v/Projects/Personal/english && npx tsc --noEmit 2>&1 | head -10</automated>
  </verify>
  <done>
    - Cloze prompt instructs AI to generate word-choice exercises instead of form-filling
    - Hints provide 2-3 word options to choose from
    - Exercises still relate to grammar patterns but test usage/meaning
  </done>
</task>

<task type="auto">
  <name>Task 3: Daily 21:00 notifications with micro progress report</name>
  <files>
    src/bot/notifications/scheduler.ts
    src/bot/notifications/review-check.ts
  </files>
  <action>
    1. **Scheduler** (`src/bot/notifications/scheduler.ts`):
       - Replace the hourly interval with a daily check that fires at 21:00 in the user's timezone (use `Europe/Moscow` or make it configurable via `NOTIFICATION_TIMEZONE` env var, default `Europe/Moscow`)
       - Implementation: use `setInterval` with 60-second checks. On each tick, get current time in target timezone. If hour === 21 and minute === 0 (within the 60s window) and haven't sent today, call `checkAndNotifyDueCards`. Track `lastNotificationDate` to avoid duplicates.
       - Remove the 10-second startup delay notification (was for testing; daily is enough)
       - Log: "Notification scheduler started (chat ID: {chatId}, daily at 21:00 {timezone})"

    2. **Notification message** (`src/bot/notifications/review-check.ts`):
       - Check if user has reviewed today: query `review_logs` table for entries where `reviewed_at >= today's start` (in the configured timezone). If reviews exist today, skip notification entirely.
       - Build a micro progress report. Use the API server directly (import db and query) or call the dashboard stats endpoint. The message should include:
         - Number of due cards
         - Today's review count (if any partial reviews done) — but since we skip if reviewed, this will be 0 in practice
         - Current streak or total cards in "review" (known) state as a progress indicator
         - Format example:
           ```
           Time to review! You have 12 cards due.

           Your progress:
           Words: 45 known, 8 learning
           Grammar: 12 known, 3 learning
           Collocations: 6 known, 2 learning

           Use /review to start.
           ```
       - Since the bot does not have direct DB access (it calls the API), use `fetch` to call `GET /dashboard/stats` from the API server (using the existing API_URL pattern from api-client.ts). Also check due cards count as already done.
  </action>
  <verify>
    <automated>cd /Users/evd3v/Projects/Personal/english && npx tsc --noEmit 2>&1 | head -10</automated>
  </verify>
  <done>
    - Scheduler fires once daily at 21:00 (Europe/Moscow) instead of every hour
    - Notification skipped if user already reviewed today
    - Notification message includes due card count and progress stats (known/learning breakdown)
    - No startup delay notification
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- word_senses schema includes definition column
- Cloze prompt focuses on word choice, not grammar form filling
- Scheduler uses daily 21:00 timing instead of hourly interval
</verification>

<success_criteria>
- Vocabulary review cards (web + Telegram) show definition alongside translation on reveal
- Grammar exercises prompt AI to generate word-choice exercises with hint options
- Notifications fire once daily at 21:00 with progress report, skipped if already reviewed
</success_criteria>

<output>
After completion, create `.planning/quick/3-improve-word-reviews-with-definitions-fi/3-SUMMARY.md`
</output>
