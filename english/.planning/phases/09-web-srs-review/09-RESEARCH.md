# Phase 9: Web SRS Review - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 SPA review flow with FSRS integration, staleness guard for multi-client SRS
**Confidence:** HIGH

## Summary

Phase 9 adds a full SRS review session to the Vue 3 web frontend. The backend API already exists and is fully functional (`GET /review/due`, `POST /review/:cardId/rate`) -- this phase is purely frontend with one backend enhancement (staleness guard). The Telegram bot review handler (`src/bot/handlers/review.ts`) provides the exact session flow to replicate: fetch due cards, show front (vocab word with sentence context or grammar cloze), reveal answer, rate with Again/Hard/Good/Easy, track stats, show summary.

The staleness guard (WREV-06) is the only non-trivial technical challenge. The project decision says "Web review is stateless (fetch-rate-fetch) to avoid SRS conflicts with Telegram." This means the web client should NOT batch-fetch all cards upfront and rate them from memory like Telegram does. Instead, it should verify card freshness before rating -- if the card was already rated via Telegram between fetch and rate, the web must detect this and skip that card.

**Primary recommendation:** Build a stateless review flow (fetch one or small batch, rate, fetch next) with a `lastReview` timestamp check on the rate endpoint to prevent double-rating conflicts.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WREV-01 | Vocab flashcards with sentence context in browser | Existing `/review/due` API returns word data + sentence. Frontend components: ReviewCard, ReviewSession |
| WREV-02 | Grammar cloze exercises in browser | Same API returns exercise data with sentence/answer/hint. Frontend renders cloze with blank |
| WREV-03 | Rate cards with Again/Hard/Good/Easy buttons + keyboard 1-4 | Existing `POST /review/:cardId/rate` with rating 1-4. Add keyboard event listener |
| WREV-04 | Progress bar during session | Track currentIndex/total in Pinia store, render as CSS width percentage |
| WREV-05 | Summary screen after completion | Track ratings histogram in store, render summary component |
| WREV-06 | Web/Telegram no conflicts (staleness guard) | Add `lastReview` timestamp to rate endpoint, return 409 if card was reviewed since fetch |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.29 | UI framework | Already in project |
| Pinia | ^3.0.4 | State management | Already used for stores (vocabulary, dashboard, sentences) |
| vue-router | ^5.0.3 | Routing | Already in project, add `/review` route |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All dependencies already present |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pinia store | Composable (useReview) | Store is project pattern, composable would break consistency |
| CSS progress bar | Third-party progress lib | Unnecessary -- CSS width transition is trivial |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
web/src/
├── views/ReviewView.vue           # Route component, orchestrates session
├── components/review/
│   ├── ReviewCard.vue             # Single card display (front/back states)
│   ├── RatingButtons.vue          # Again/Hard/Good/Easy buttons
│   ├── ReviewProgress.vue         # Progress bar
│   └── ReviewSummary.vue          # End-of-session summary
├── stores/review.ts               # Pinia store for review session state
└── types/api.ts                   # Add DueCard, RateResult types
```

### Pattern 1: Stateless Review Flow (fetch-rate-fetch)
**What:** Unlike Telegram (which fetches all 20 cards upfront and walks through them in memory), the web review fetches cards, rates one at a time, and the backend can optionally re-check due status. However, since this is a single-user app and sessions are short (20 cards), the simpler approach is:
1. Fetch all due cards at session start (same as Telegram)
2. Walk through them client-side
3. On each rate call, include the card's `due` timestamp from the original fetch
4. Backend rejects if `lastReview` is newer than the fetch timestamp (staleness guard)

**When to use:** Always -- this is the core session architecture.

### Pattern 2: Pinia Store for Session State
**What:** Follow the exact pattern from `stores/vocabulary.ts` -- composition API style store with refs.
**When to use:** All review state management.
**Example:**
```typescript
// stores/review.ts
export const useReviewStore = defineStore('review', () => {
  const cards = ref<DueCard[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const loading = ref(false)
  const sessionActive = ref(false)
  const stats = reactive({ total: 0, ratings: { 1: 0, 2: 0, 3: 0, 4: 0 } })

  const currentCard = computed(() => cards.value[currentIndex.value] ?? null)
  const progress = computed(() => cards.value.length > 0
    ? currentIndex.value / cards.value.length
    : 0
  )
  const isComplete = computed(() =>
    sessionActive.value && currentIndex.value >= cards.value.length
  )
  // ...
})
```

### Pattern 3: Keyboard Shortcuts
**What:** `window.addEventListener('keydown', handler)` in the ReviewView component, cleaned up in `onUnmounted`.
**When to use:** WREV-03 requires keyboard shortcuts 1-4 for rating.
**Example:**
```typescript
function handleKeydown(e: KeyboardEvent) {
  if (!revealed.value) {
    if (e.key === ' ' || e.key === 'Enter') {
      store.reveal()
    }
    return
  }
  const rating = Number(e.key)
  if (rating >= 1 && rating <= 4) {
    store.rate(rating)
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
```

### Anti-Patterns to Avoid
- **Fetching cards one-by-one from API:** Adds latency between cards. Batch-fetch upfront is fine for single-user.
- **Keeping review session alive across page navigations:** Session should reset on route leave. No persistence needed.
- **Using v-if chains for card states:** Use a single ReviewCard component with front/back via a `revealed` prop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRS scheduling | Custom FSRS | Existing `rateCard()` service | Already implemented server-side with ts-fsrs |
| Card enrichment | Client-side data joining | Existing `/review/due` endpoint | Already enriches cards with word/sentence/exercise data |
| Rating validation | Client-side FSRS | `POST /review/:cardId/rate` | Backend handles all scheduling logic |

**Key insight:** The backend API is fully complete. This phase is purely frontend + one backend guard endpoint enhancement.

## Common Pitfalls

### Pitfall 1: Double-Rating from Concurrent Sessions
**What goes wrong:** User starts review in web, switches to Telegram, rates same card in both.
**Why it happens:** Both clients fetched the same due cards.
**How to avoid:** Add staleness guard: `POST /review/:cardId/rate` accepts optional `expectedDue` timestamp. If `lastReview` on the card is newer than when cards were fetched, return 409 Conflict. Web client skips that card and moves to next.
**Warning signs:** Card state becomes inconsistent (double advancement).

### Pitfall 2: Keyboard Shortcut Conflicts
**What goes wrong:** Number keys trigger rating while user is typing in another input, or Space triggers rating when scrolling.
**Why it happens:** Global keyboard listener without checking active element.
**How to avoid:** Check `document.activeElement` is not an input/textarea before processing shortcuts. In review view there are no inputs, but guard defensively.
**Warning signs:** Accidental ratings.

### Pitfall 3: Grammar Card Without Exercise
**What goes wrong:** Grammar card fetched but no unused exercises remain.
**Why it happens:** All exercises marked as `used: true` (exercise exhaustion -- noted in STATE.md blockers).
**How to avoid:** API already returns `exercise: undefined` for such cards. Frontend should show pattern name with "No exercises available" message (same as Telegram does). Still allow rating.
**Warning signs:** User sees empty grammar cards.

### Pitfall 4: Empty Review Queue
**What goes wrong:** User navigates to /review but no cards are due.
**Why it happens:** All cards scheduled for future dates.
**How to avoid:** Show "No cards due for review" message with suggestion to come back later. Do not show empty session UI.
**Warning signs:** Blank screen.

### Pitfall 5: Session Lost on Page Refresh
**What goes wrong:** User refreshes mid-review, loses progress.
**Why it happens:** State only in memory (Pinia store).
**How to avoid:** This is acceptable for a personal tool. Already-rated cards are persisted server-side. The user just loses their position. On refresh, a new session starts with remaining due cards. No need to persist session state.
**Warning signs:** None -- this is fine.

## Code Examples

### API Client Functions (web/src/api/client.ts additions)
```typescript
// Matches DueCard type from bot/services/api-client.ts
export interface DueCard {
  cardId: number
  cardType: 'vocabulary' | 'grammar'
  state: string
  due: string
  word?: {
    lemma: string
    translation: string | null
    cefrLevel: string | null
    partOfSpeech: string | null
  }
  sentence?: string
  pattern?: { pattern: string; description: string }
  exercise?: {
    id: number
    sentence: string
    answer: string
    hint: string | null
    difficultyLevel: number
  }
}

export interface RateResult {
  success: boolean
  nextDue: string
}
```

### Backend Staleness Guard Enhancement
```typescript
// In POST /review/:cardId/rate, add optional expectedDue check:
fastify.post<{
  Params: { cardId: string }
  Body: { rating: number; fetchedAt?: string }
}>(
  '/review/:cardId/rate',
  async (request, reply) => {
    const cardId = Number(request.params.cardId);
    const { rating, fetchedAt } = request.body;

    const [card] = await fastify.db
      .select()
      .from(srsCards)
      .where(eq(srsCards.id, cardId));

    if (!card) {
      return reply.status(404).send({ error: 'Card not found' });
    }

    // Staleness guard: if card was reviewed after we fetched it
    if (fetchedAt && card.lastReview) {
      const fetchTime = new Date(fetchedAt);
      if (card.lastReview > fetchTime) {
        return reply.status(409).send({
          error: 'Card was already reviewed',
          lastReview: card.lastReview,
        });
      }
    }

    const scheduled = await rateCard(fastify.db, cardId, rating as Rating);
    // ... rest of existing logic
  }
);
```

### Review Card Front/Back Rendering
```vue
<!-- ReviewCard.vue - vocabulary front -->
<template>
  <div class="review-card">
    <div v-if="card.cardType === 'vocabulary'" class="vocab-card">
      <div class="word-front">
        <span class="lemma">{{ card.word?.lemma }}</span>
        <span v-if="card.word?.cefrLevel" class="cefr">{{ card.word.cefrLevel }}</span>
        <span v-if="card.word?.partOfSpeech" class="pos">{{ card.word.partOfSpeech }}</span>
      </div>
      <p v-if="card.sentence" class="context-sentence">
        "{{ card.sentence }}"
      </p>
      <div v-if="revealed" class="translation">
        {{ card.word?.translation ?? '---' }}
      </div>
    </div>

    <div v-else-if="card.cardType === 'grammar'" class="grammar-card">
      <div v-if="card.exercise" class="cloze">
        <p class="cloze-sentence">{{ card.exercise.sentence }}</p>
        <div v-if="revealed" class="cloze-answer">
          <strong>{{ card.exercise.answer }}</strong>
          <p v-if="card.exercise.hint" class="hint">{{ card.exercise.hint }}</p>
        </div>
      </div>
      <div v-else class="no-exercise">
        <p class="pattern-name">{{ card.pattern?.pattern }}</p>
        <p class="pattern-desc">No exercises available</p>
      </div>
    </div>
  </div>
</template>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegram-only review | Web + Telegram review | Phase 9 | Need staleness guard for concurrency |
| Batch fetch all cards | Same (batch fetch ok for single user) | Unchanged | No change needed |

**Deprecated/outdated:**
- None. All existing patterns remain current.

## Open Questions

1. **Grammar exercise exhaustion monitoring**
   - What we know: STATE.md notes "Grammar exercise exhaustion may accelerate with web review added"
   - What's unclear: How many unused exercises remain per pattern
   - Recommendation: Out of scope for this phase. Monitor post-launch. If exhaustion is a problem, trigger batch regeneration.

2. **Session size limit**
   - What we know: Telegram fetches 20 cards. Web could handle more.
   - What's unclear: Whether user wants configurable session size
   - Recommendation: Default to 20 (same as Telegram). Can add UI control later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --reporter=verbose tests/review-api.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WREV-01 | Vocab cards returned with word + sentence | unit (API) | `npm test -- tests/review-api.test.ts` | Yes |
| WREV-02 | Grammar cards returned with exercise | unit (API) | `npm test -- tests/review-api.test.ts` | Yes |
| WREV-03 | Rate card with rating 1-4 | unit (API) | `npm test -- tests/review-api.test.ts` | Yes |
| WREV-04 | Progress bar during session | manual-only | N/A (visual, no test framework for Vue in project) | N/A |
| WREV-05 | Summary screen after completion | manual-only | N/A (visual) | N/A |
| WREV-06 | Staleness guard prevents conflicts | unit (API) | `npm test -- tests/review-api.test.ts` | Needs new test |

### Sampling Rate
- **Per task commit:** `npm test -- tests/review-api.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/review-api.test.ts` -- add staleness guard test (409 on stale rate)
- No new test files needed. Existing review-api tests cover WREV-01 through WREV-03 API behavior.
- No Vue test framework in project (no vitest browser mode, no @vue/test-utils). Frontend testing is manual-only per project conventions.

## Sources

### Primary (HIGH confidence)
- `src/routes/review.ts` -- Existing review API with GET /review/due and POST /review/:cardId/rate
- `src/services/srs.ts` -- FSRS integration with ts-fsrs, getDueCards, rateCard functions
- `src/bot/handlers/review.ts` -- Telegram review session flow (reference implementation)
- `src/bot/services/api-client.ts` -- DueCard/RateResult TypeScript interfaces
- `src/db/schema/srs-cards.ts` -- Card schema with lastReview timestamp field
- `web/src/stores/vocabulary.ts` -- Pinia store pattern (composition API)
- `web/src/api/client.ts` -- API client pattern (apiGet, apiPost)
- `tests/review-api.test.ts` -- Existing review endpoint tests

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` -- Decision: "Web review is stateless (fetch-rate-fetch) to avoid SRS conflicts"
- `.planning/STATE.md` -- Blocker note: "Grammar exercise exhaustion may accelerate with web review"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - follows existing Vue/Pinia patterns exactly, backend API complete
- Pitfalls: HIGH - staleness guard is the only real risk; well-understood solution
- Staleness guard: MEDIUM - implementation approach clear but `fetchedAt` parameter design needs validation during implementation

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependency changes expected)
