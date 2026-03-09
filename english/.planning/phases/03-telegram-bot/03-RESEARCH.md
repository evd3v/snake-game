# Phase 3: Telegram Bot - Research

**Researched:** 2026-03-09
**Domain:** Telegram Bot API via grammY framework, inline keyboards, async job integration
**Confidence:** HIGH

## Summary

Phase 3 adds a Telegram bot as the primary input channel for sentence analysis. The bot receives English sentences from the user, submits them to the existing BullMQ-based analysis pipeline (built in Phases 1-2), and presents compact results with inline keyboard buttons for vocabulary selection. The user can then set familiarity levels for chosen words.

The project already has a locked decision to use **grammY** (not Telegraf). The existing architecture -- Fastify REST API + BullMQ worker + PostgreSQL/Drizzle -- provides all the backend pieces. The bot needs to: (1) accept text messages, (2) call the existing `/sentences` API or directly enqueue BullMQ jobs, (3) poll for job completion, (4) format and present results, (5) handle inline keyboard interactions for word selection and familiarity setting.

**Primary recommendation:** Run the Telegram bot as a separate process using long polling (`bot.start()`), communicating with the backend via the existing REST API or shared database/queue. Use grammY's built-in `InlineKeyboard` for word selection -- no extra plugins needed for this use case.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-04 | Telegram bot via grammY library | grammY v1.41.1 with long polling, separate process, InlineKeyboard built-in |
| SENT-02 | User can input an English sentence via Telegram bot | Bot listens for text messages, enqueues to BullMQ analysis queue |
| VOCAB-02 | User selects which words to save after analysis | InlineKeyboard with callback queries, word toggle buttons |
| VOCAB-03 | User sets familiarity level on add: "never seen" / "seen but unsure" / "understand in context" | Second inline keyboard step after word selection, updates `words.familiarity` column |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.41.1 | Telegram Bot framework | Locked project decision; best TypeScript support, active maintenance, rich plugin ecosystem |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| callback-data | latest | Structured callback data packing/unpacking | Optional -- only if callback payloads get complex; simple string encoding may suffice |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Long polling | Webhooks | Webhooks more efficient but require SSL/domain setup; long polling simpler for VPS/Docker, no public URL needed, project already runs on VPS with Docker Compose |
| Separate bot process | Same process as Fastify | Separate process is cleaner -- bot crash doesn't take down API; easier to restart independently |
| Direct DB access from bot | REST API calls | REST API already exists (`POST /sentences`, `GET /sentences/:jobId/status`); using it avoids duplicating business logic |

**Installation:**
```bash
npm install grammy
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  bot/
    index.ts          # Bot entry point (separate process)
    handlers/
      sentence.ts     # Text message -> analysis flow
      vocabulary.ts   # Word selection + familiarity callbacks
    keyboards/
      analysis.ts     # Build inline keyboards from analysis results
    services/
      api-client.ts   # HTTP client to call existing Fastify API
    format.ts         # Format analysis results as Telegram messages
```

### Pattern 1: Separate Process with Shared Infrastructure
**What:** Bot runs as its own Node.js process (`tsx src/bot/index.ts`), separate from Fastify API and BullMQ worker.
**When to use:** Always for this project.
**Why:** The bot uses long polling which blocks the event loop differently than HTTP servers. Keeps concerns separated. If bot crashes, API stays up.

```typescript
// src/bot/index.ts
import 'dotenv/config';
import { Bot } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Register handlers
bot.on('message:text', handleSentence);
bot.on('callback_query:data', handleCallback);

// Graceful shutdown
process.on('SIGTERM', () => bot.stop());
process.on('SIGINT', () => bot.stop());

bot.start();
```

### Pattern 2: Job Polling for Async Results
**What:** After submitting a sentence, bot polls the job status endpoint until complete, then sends results.
**When to use:** Every sentence submission.
**Why:** AI analysis takes 3-10 seconds. Bot must wait for results before presenting them.

```typescript
// Submit sentence and poll for result
const { jobId } = await apiClient.submitSentence(text);

// Poll with backoff
let result;
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 1500));
  const status = await apiClient.getJobStatus(jobId);
  if (status.status === 'completed') {
    result = status.result;
    break;
  }
  if (status.status === 'failed') {
    throw new Error(status.error);
  }
}
```

### Pattern 3: Multi-Step Inline Keyboard Flow
**What:** Analysis result -> word selection keyboard -> familiarity keyboard -> confirmation.
**When to use:** Core interaction flow for VOCAB-02 and VOCAB-03.

```typescript
// Step 1: Show analysis with word selection buttons
const keyboard = new InlineKeyboard();
for (const word of analysis.vocabulary) {
  keyboard.text(`${word.lemma}`, `select:${sentenceId}:${word.wordId}`).row();
}
keyboard.text('Done selecting', `done:${sentenceId}`);

await ctx.reply(formatAnalysis(analysis), { reply_markup: keyboard });

// Step 2: On word select callback -> toggle selection, update keyboard
bot.callbackQuery(/^select:(\d+):(\d+)$/, async (ctx) => {
  // Toggle word in selection set, update keyboard marks
  await ctx.editMessageReplyMarkup({ reply_markup: updatedKeyboard });
  await ctx.answerCallbackQuery();
});

// Step 3: On "done" -> show familiarity options for each selected word
bot.callbackQuery(/^done:(\d+)$/, async (ctx) => {
  // Show first selected word with familiarity options
  await ctx.editMessageText(formatFamiliarityPrompt(word), {
    reply_markup: familiarityKeyboard(sentenceId, wordId),
  });
  await ctx.answerCallbackQuery();
});

// Step 4: On familiarity select -> save and move to next word or finish
bot.callbackQuery(/^fam:(\d+):(\d+):(.+)$/, async (ctx) => {
  const [_, sentenceId, wordId, level] = ctx.match!;
  await apiClient.setFamiliarity(wordId, level);
  // Show next word or completion message
});
```

### Pattern 4: Callback Data Encoding
**What:** Encode action, IDs, and state into short callback data strings (max 64 bytes).
**When to use:** All inline keyboard interactions.

```typescript
// Format: "action:param1:param2"
// Examples:
//   "sel:42:17"     -> select word 17 from sentence 42
//   "done:42"       -> done selecting words for sentence 42
//   "fam:42:17:ns"  -> set word 17 familiarity to "never_seen"
//   "fam:42:17:su"  -> "seen_unsure"
//   "fam:42:17:uc"  -> "understand_in_context"

// Use short codes for familiarity to stay within 64-byte limit
const FAMILIARITY_MAP: Record<string, string> = {
  ns: 'never_seen',
  su: 'seen_unsure',
  uc: 'understand_in_context',
};
```

### Anti-Patterns to Avoid
- **Storing state in callback data:** Callback data has a 64-byte limit. Store state in DB or in-memory map, reference by ID only.
- **Blocking middleware with long operations:** Never await AI analysis in the message handler. Submit to queue, then poll separately or use a "processing..." message that gets edited.
- **Single process for bot + API:** Couples their lifecycles. Bot long polling failure shouldn't crash the API.
- **Not answering callback queries:** Always call `ctx.answerCallbackQuery()` -- otherwise Telegram shows a spinning loader to the user.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram Bot API communication | Raw HTTP calls to api.telegram.org | `grammy` Bot class | Handles update types, error retries, rate limiting |
| Inline keyboard construction | Manual JSON objects | `InlineKeyboard` from grammy | Type-safe, chainable API, handles row layout |
| Callback data parsing | Ad-hoc string splitting | Regex patterns with named groups or `callback-data` npm package | Consistent, type-safe extraction |
| Message formatting | Raw string concatenation | Template function with Telegram MarkdownV2/HTML escape | MarkdownV2 has many special chars that need escaping |

**Key insight:** grammY handles all Telegram Bot API complexity. The real work in this phase is the UX flow design (multi-step keyboard interactions) and integration with the existing analysis pipeline.

## Common Pitfalls

### Pitfall 1: MarkdownV2 Escaping Nightmares
**What goes wrong:** Messages with special characters (`.`, `-`, `(`, `)`, `!`, etc.) fail to send with parse_mode: "MarkdownV2".
**Why it happens:** Telegram's MarkdownV2 requires escaping nearly every special character outside of formatting entities.
**How to avoid:** Use `parse_mode: "HTML"` instead -- it's far more predictable. Only `<`, `>`, `&` need escaping. grammY does not auto-escape.
**Warning signs:** Bot silently fails to send messages or sends without formatting.

### Pitfall 2: Callback Data 64-Byte Limit
**What goes wrong:** Buttons stop working or throw errors when callback data exceeds 64 bytes.
**Why it happens:** Telegram enforces a strict 64-byte limit on callback_data field.
**How to avoid:** Use short codes (abbreviated action names, numeric IDs). Never embed full words or translations in callback data.
**Warning signs:** Buttons that work in testing fail with longer words/IDs.

### Pitfall 3: Not Handling Stale Callbacks
**What goes wrong:** User clicks a button from an old message, bot crashes or behaves unexpectedly.
**Why it happens:** Inline keyboard buttons persist in chat history. User may click hours/days later.
**How to avoid:** Always validate that referenced data (sentence, word) still exists. Return a friendly "This analysis has expired" message for stale callbacks.
**Warning signs:** Unhandled errors in callback query handlers.

### Pitfall 4: Race Condition in Polling Loop
**What goes wrong:** Bot sends "still processing" then immediately sends result, or sends result twice.
**Why it happens:** Polling interval too aggressive or no deduplication.
**How to avoid:** Use a simple state machine per chat (idle -> processing -> showing results -> selecting words). Track state in memory or Redis.
**Warning signs:** Duplicate messages to user.

### Pitfall 5: Bot Token in Source Code
**What goes wrong:** Token committed to git, bot gets hijacked.
**Why it happens:** Hardcoded token during development.
**How to avoid:** Use `process.env.TELEGRAM_BOT_TOKEN` exclusively. Add to `.env` (already gitignored). Add `TELEGRAM_BOT_TOKEN` to `.env.example`.
**Warning signs:** Token visible in source files.

## Code Examples

### Complete Analysis Flow (Message -> Result -> Word Selection)

```typescript
// src/bot/handlers/sentence.ts
import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';

export async function handleSentence(ctx: Context) {
  const text = ctx.message?.text;
  if (!text) return;

  // 1. Send "processing" indicator
  const processingMsg = await ctx.reply('Analyzing your sentence...');

  // 2. Submit to analysis pipeline via API
  const response = await fetch(`${API_URL}/sentences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const { jobId } = await response.json();

  // 3. Poll for completion
  let result = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`${API_URL}/sentences/${jobId}/status`);
    const status = await statusRes.json();

    if (status.status === 'completed') {
      result = status.result;
      break;
    }
    if (status.status === 'failed') {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        'Analysis failed. Please try again.',
      );
      return;
    }
  }

  if (!result) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      'Analysis timed out. Please try again.',
    );
    return;
  }

  // 4. Format and send result with word selection keyboard
  const formatted = formatAnalysisResult(result);
  const keyboard = buildWordSelectionKeyboard(result.sentenceId, result.words);

  await ctx.api.editMessageText(
    ctx.chat!.id,
    processingMsg.message_id,
    formatted,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}
```

### Word Selection Keyboard Builder

```typescript
// src/bot/keyboards/analysis.ts
import { InlineKeyboard } from 'grammy';

interface WordInfo {
  id: number;
  lemma: string;
  translation: string;
  cefrLevel: string;
}

export function buildWordSelectionKeyboard(
  sentenceId: number,
  words: WordInfo[],
  selected: Set<number> = new Set(),
): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const word of words) {
    const mark = selected.has(word.id) ? '>' : ' ';
    const label = `${mark} ${word.lemma} -- ${word.translation} [${word.cefrLevel}]`;
    kb.text(label, `sel:${sentenceId}:${word.id}`).row();
  }

  if (selected.size > 0) {
    kb.text(`Save ${selected.size} word(s)`, `done:${sentenceId}`);
  }

  return kb;
}

export function buildFamiliarityKeyboard(
  sentenceId: number,
  wordId: number,
): InlineKeyboard {
  return new InlineKeyboard()
    .text('Never seen', `fam:${sentenceId}:${wordId}:ns`).row()
    .text('Seen but unsure', `fam:${sentenceId}:${wordId}:su`).row()
    .text('Understand in context', `fam:${sentenceId}:${wordId}:uc`).row()
    .text('Skip', `fam:${sentenceId}:${wordId}:skip`);
}
```

### Analysis Result Formatter (HTML)

```typescript
// src/bot/format.ts
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatAnalysisResult(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push(`<b>Translation:</b> ${escapeHtml(result.translation)}`);
  lines.push(`<b>CEFR Level:</b> ${result.cefrLevel}`);
  lines.push('');

  if (result.vocabulary?.length) {
    lines.push('<b>Vocabulary:</b>');
    for (const w of result.vocabulary) {
      lines.push(`  ${escapeHtml(w.lemma)} -- ${escapeHtml(w.translation)} [${w.cefrLevel}]`);
    }
    lines.push('');
  }

  if (result.collocations?.length) {
    lines.push('<b>Collocations:</b>');
    for (const c of result.collocations) {
      lines.push(`  ${escapeHtml(c.text)} -- ${escapeHtml(c.translation)}`);
    }
    lines.push('');
  }

  if (result.grammarPatterns?.length) {
    lines.push('<b>Grammar:</b>');
    for (const g of result.grammarPatterns) {
      lines.push(`  <code>${escapeHtml(g.pattern)}</code> -- ${escapeHtml(g.description)}`);
    }
  }

  lines.push('');
  lines.push('Select words to save to vocabulary:');

  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegraf | grammY | 2021+ | Better TypeScript support, active maintenance, plugin ecosystem |
| MarkdownV2 formatting | HTML parse_mode | Always available | HTML much simpler to work with, fewer escaping issues |
| Conversations plugin for flows | Callback queries + state tracking | N/A | Conversations plugin is overkill for simple multi-step flows |

**Note:** grammY sessions plugin exists but is unnecessary for this phase -- the bot serves a single user and state can be tracked in a simple in-memory Map keyed by chat ID.

## Open Questions

1. **API client vs direct queue access**
   - What we know: The bot can either call the REST API (`POST /sentences`) or directly enqueue BullMQ jobs
   - What's unclear: Whether adding HTTP overhead matters for a single-user bot
   - Recommendation: Use REST API -- it already exists, validates input, and keeps the bot decoupled from backend internals. The HTTP overhead is negligible for a single user.

2. **Vocabulary update endpoint**
   - What we know: Phase 2 built `POST /sentences` and `GET /sentences/:jobId/status`. There is no endpoint to update word familiarity or to fetch analysis results by sentence ID.
   - What's unclear: Exact API shape needed for word selection and familiarity updates
   - Recommendation: Phase 3 will need to add new API routes: `PATCH /words/:id/familiarity` and potentially `GET /sentences/:id/analysis` (to re-fetch stored results). Plan for this.

3. **Enriching job result with word IDs**
   - What we know: Current worker returns `{ sentenceId, wordsInserted, collocationsInserted, grammarPatternsInserted }` -- no word details
   - What's unclear: Whether to expand worker return value or add a separate query endpoint
   - Recommendation: Add a `GET /sentences/:sentenceId/words` endpoint that returns words linked to a sentence with their IDs, lemmas, translations, and CEFR levels. This is cleaner than bloating the job result.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --testPathPattern=bot` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-04 | Bot initializes and registers handlers | unit | `npm test -- tests/bot-setup.test.ts` | No -- Wave 0 |
| SENT-02 | Text message triggers analysis submission | unit | `npm test -- tests/bot-sentence.test.ts` | No -- Wave 0 |
| VOCAB-02 | Word selection via inline keyboard callbacks | unit | `npm test -- tests/bot-vocabulary.test.ts` | No -- Wave 0 |
| VOCAB-03 | Familiarity level setting via callbacks | unit | `npm test -- tests/bot-vocabulary.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/bot-*.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/bot-setup.test.ts` -- covers INFRA-04 (bot creation, handler registration)
- [ ] `tests/bot-sentence.test.ts` -- covers SENT-02 (message handling, API calls, polling)
- [ ] `tests/bot-vocabulary.test.ts` -- covers VOCAB-02, VOCAB-03 (keyboard building, callback handling, familiarity updates)
- [ ] New API routes need test files: `tests/words-api.test.ts`

## Sources

### Primary (HIGH confidence)
- [grammy.dev/guide/getting-started](https://grammy.dev/guide/getting-started) -- setup, version (v1.41.1), basic patterns
- [grammy.dev/plugins/keyboard](https://grammy.dev/plugins/keyboard) -- InlineKeyboard API, callback handling, message editing
- [grammy.dev/guide/deployment-types](https://grammy.dev/guide/deployment-types) -- long polling vs webhooks, VPS recommendations
- [grammy.dev/hosting/vps](https://grammy.dev/hosting/vps) -- VPS deployment patterns, process management

### Secondary (MEDIUM confidence)
- [grammy.dev/plugins/session](https://grammy.dev/plugins/session) -- session management (not needed for single-user)
- [grammy.dev/plugins/menu](https://grammy.dev/plugins/menu) -- interactive menus (overkill for this use case)

### Tertiary (LOW confidence)
- npm registry -- grammy v1.41.1 confirmed via `npm view grammy version`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- grammY is a locked decision, version verified, API documented
- Architecture: HIGH -- patterns verified against official docs, existing codebase understood
- Pitfalls: HIGH -- common issues well-documented in grammY docs and Telegram Bot API docs

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (grammY is stable, Telegram Bot API changes infrequently)
