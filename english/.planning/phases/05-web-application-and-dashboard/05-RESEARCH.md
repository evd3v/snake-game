# Phase 5: Web Application and Dashboard - Research

**Researched:** 2026-03-09
**Domain:** Vue 3 SPA with TypeScript, dashboard visualization, Fastify API integration
**Confidence:** HIGH

## Summary

Phase 5 builds a Vue 3 + TypeScript SPA frontend that connects to the existing Fastify REST API backend. The project already has CORS enabled (`@fastify/cors`), API routes for sentences, words, review, and health, and runs on port 3000. The frontend needs to be a separate Vite project (in a `web/` directory) that proxies API requests to the backend during development.

The dashboard requirements cover four areas: progress counters (DASH-01), weak spots (DASH-02), activity streak/heatmap (DASH-03), and thematic cluster gaps (DASH-04). Most dashboard data requires new API endpoints that aggregate data from existing tables (`srs_cards`, `review_logs`, `words`, `grammar_patterns`). The sentence input UI (SENT-01) mirrors the existing Telegram bot flow: POST sentence, poll for job status, display analysis, select words.

**Primary recommendation:** Use `create-vue` scaffolding into a `web/` directory with Vue Router + Pinia + Vite. Keep the frontend simple -- no heavy UI framework, just utility CSS (UnoCSS or Tailwind). Use `vue3-apexcharts` for charts and a custom SVG heatmap for the activity calendar.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | Vue 3 + TypeScript SPA frontend | Standard stack section -- Vite + Vue 3 + vue-router + Pinia |
| SENT-01 | User can input an English sentence via web UI | Existing POST /sentences + GET /sentences/:jobId/status API; need polling + result display |
| DASH-01 | Overall progress counters (new/learning/known) for words and patterns | New API endpoint aggregating srs_cards by state + card_type |
| DASH-02 | Weak spots: grammar patterns and words with low success rate | New API endpoint using review_logs join to compute success rates |
| DASH-03 | Activity streak and heatmap (days in a row, daily reviews/additions) | New API endpoint aggregating review_logs + sentences by date; vue3-calendar-heatmap or custom SVG |
| DASH-04 | Thematic cluster coverage gaps | New API endpoint grouping words by thematic_cluster with familiarity/SRS state breakdown |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5 | UI framework | Project constraint (INFRA-03) |
| vite | ^6 | Build tool + dev server | Official Vue tooling, instant HMR |
| vue-router | ^4 | Client-side routing | Official Vue router |
| pinia | ^3 | State management | Official Vue state management, replaced Vuex |
| typescript | ^5.9 | Type safety | Already used in backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue3-apexcharts | ^1.11 | Chart components (bar, donut, radial) | DASH-01 progress counters, DASH-02 weak spots |
| apexcharts | ^4 | Charting engine (peer dep of vue3-apexcharts) | Required by vue3-apexcharts |
| vue3-calendar-heatmap | ^2.0 | GitHub-style activity heatmap | DASH-03 activity heatmap |
| @vueuse/core | ^12 | Composable utilities (useFetch, useLocalStorage, etc.) | API calls, reactive utilities |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vue3-apexcharts | ECharts (vue-echarts) | ECharts is more powerful but heavier (800KB vs 130KB); ApexCharts sufficient for this dashboard |
| vue3-calendar-heatmap | Custom SVG grid | Heatmap lib is unmaintained (last publish 3 years ago); custom SVG is ~50 lines and more maintainable |
| Tailwind CSS | UnoCSS | Both work; Tailwind has larger ecosystem but UnoCSS is lighter. Either is fine. |
| @vueuse/core | Raw fetch | VueUse provides reactive wrappers; raw fetch is simpler for a small app. Claude's discretion. |

**Installation (in web/ directory):**
```bash
npm create vue@latest web -- --typescript --router --pinia
cd web
npm install vue3-apexcharts apexcharts
npm install -D @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
web/
├── index.html
├── vite.config.ts           # Vite config with API proxy
├── tsconfig.json
├── src/
│   ├── main.ts              # App entry
│   ├── App.vue              # Root component
│   ├── router/
│   │   └── index.ts         # Route definitions
│   ├── stores/
│   │   ├── dashboard.ts     # Dashboard stats store
│   │   ├── sentences.ts     # Sentence input + analysis store
│   │   └── review.ts        # Review session store (future)
│   ├── api/
│   │   ├── client.ts        # Base fetch wrapper (baseURL, error handling)
│   │   ├── sentences.ts     # POST /sentences, GET /sentences/:id/status
│   │   ├── words.ts         # GET /sentences/:id/words, PATCH /words/:id/familiarity
│   │   ├── review.ts        # GET /review/due, POST /review/:id/rate
│   │   └── dashboard.ts     # GET /dashboard/stats, GET /dashboard/activity, etc.
│   ├── views/
│   │   ├── DashboardView.vue    # Main dashboard page
│   │   ├── SentenceInputView.vue # Sentence input + analysis
│   │   ├── VocabularyView.vue   # Word browsing (stretch)
│   │   └── ReviewView.vue       # Web review session (stretch)
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── ProgressCounters.vue    # DASH-01
│   │   │   ├── WeakSpots.vue           # DASH-02
│   │   │   ├── ActivityHeatmap.vue     # DASH-03
│   │   │   └── ClusterCoverage.vue     # DASH-04
│   │   ├── sentence/
│   │   │   ├── SentenceForm.vue        # Text input
│   │   │   ├── AnalysisResult.vue      # AI analysis display
│   │   │   └── WordSelector.vue        # Word selection checkboxes
│   │   └── ui/
│   │       ├── Card.vue
│   │       └── Spinner.vue
│   └── types/
│       └── api.ts            # Shared API response types
└── package.json
```

### Pattern 1: Vite API Proxy for Development
**What:** Proxy `/api/*` requests to the Fastify backend during development
**When to use:** Always during local development
**Example:**
```typescript
// web/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

### Pattern 2: API Client with Base URL
**What:** Thin fetch wrapper that handles base URL and error responses
**When to use:** All API calls go through this
**Example:**
```typescript
// web/src/api/client.ts
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

### Pattern 3: Job Polling for Sentence Analysis
**What:** Submit sentence, poll for completion, then display results
**When to use:** SENT-01 sentence input flow
**Example:**
```typescript
// web/src/stores/sentences.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiPost, apiGet } from '../api/client';

export const useSentenceStore = defineStore('sentence', () => {
  const loading = ref(false);
  const result = ref(null);

  async function analyze(text: string) {
    loading.value = true;
    const { jobId } = await apiPost<{ jobId: string }>('/sentences', { text });

    // Poll until complete
    while (true) {
      const status = await apiGet<{ status: string; result?: unknown }>(
        `/sentences/${jobId}/status`,
      );
      if (status.status === 'completed') {
        result.value = status.result;
        break;
      }
      if (status.status === 'failed') {
        throw new Error('Analysis failed');
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    loading.value = false;
  }

  return { loading, result, analyze };
});
```

### Pattern 4: Pinia Store for Dashboard Data
**What:** Store fetches and caches dashboard aggregations
**When to use:** All DASH-* requirements
**Example:**
```typescript
// web/src/stores/dashboard.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiGet } from '../api/client';

interface ProgressStats {
  words: { new: number; learning: number; known: number };
  grammar: { new: number; learning: number; known: number };
}

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<ProgressStats | null>(null);
  const loading = ref(false);

  async function fetchStats() {
    loading.value = true;
    stats.value = await apiGet<ProgressStats>('/dashboard/stats');
    loading.value = false;
  }

  return { stats, loading, fetchStats };
});
```

### Anti-Patterns to Avoid
- **Fetching data in components directly:** Use Pinia stores or composables -- keep components as views, not data fetchers
- **No loading/error states:** Every async operation must show loading spinner and handle errors
- **Polling without cleanup:** Always clear polling intervals on component unmount (use `onUnmounted`)
- **Giant monolithic views:** Break dashboard into small focused components (ProgressCounters, WeakSpots, etc.)

## New Backend API Endpoints Required

The existing API covers sentence submission, word listing, and review. Dashboard features need new endpoints:

### GET /dashboard/stats (DASH-01)
```sql
-- Words by SRS state
SELECT state, COUNT(*) FROM srs_cards WHERE card_type = 'vocabulary' GROUP BY state;
-- Grammar by SRS state
SELECT state, COUNT(*) FROM srs_cards WHERE card_type = 'grammar' GROUP BY state;
-- Total words (including those without SRS cards = "new")
SELECT COUNT(*) FROM words;
```

### GET /dashboard/weak-spots (DASH-02)
```sql
-- Words with lowest success rate (rating 1-2 frequency)
SELECT w.lemma, w.translation,
  COUNT(CASE WHEN rl.rating <= 2 THEN 1 END)::float / NULLIF(COUNT(rl.id), 0) as fail_rate
FROM srs_cards sc
JOIN words w ON sc.word_id = w.id
JOIN review_logs rl ON rl.srs_card_id = sc.id
WHERE sc.card_type = 'vocabulary'
GROUP BY w.id
HAVING COUNT(rl.id) >= 2
ORDER BY fail_rate DESC
LIMIT 10;
-- Same for grammar patterns
```

### GET /dashboard/activity (DASH-03)
```sql
-- Daily activity for last 365 days
SELECT DATE(reviewed_at) as day, COUNT(*) as reviews
FROM review_logs
WHERE reviewed_at > NOW() - INTERVAL '365 days'
GROUP BY DATE(reviewed_at);

-- Daily additions
SELECT DATE(created_at) as day, COUNT(*) as additions
FROM sentences
WHERE created_at > NOW() - INTERVAL '365 days'
GROUP BY DATE(created_at);
```

### GET /dashboard/clusters (DASH-04)
```sql
-- Thematic cluster breakdown
SELECT thematic_cluster,
  COUNT(*) as total,
  COUNT(CASE WHEN sc.state = 'review' THEN 1 END) as known,
  COUNT(CASE WHEN sc.state IN ('learning', 'relearning') THEN 1 END) as learning
FROM words w
LEFT JOIN srs_cards sc ON sc.word_id = w.id AND sc.card_type = 'vocabulary'
WHERE w.thematic_cluster IS NOT NULL
GROUP BY thematic_cluster
ORDER BY total DESC;
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom canvas/SVG charts | vue3-apexcharts | Responsive, animated, dozens of chart types, tooltip/zoom built in |
| SPA routing | Hash-based manual routing | vue-router 4 | History mode, route guards, lazy loading, typed routes |
| State management | Custom event bus / provide/inject for global state | Pinia | DevTools integration, SSR-ready, type inference, persistence plugins |
| Date formatting | Manual date string manipulation | `Intl.DateTimeFormat` or `date-fns` | Locale-aware, handles edge cases |
| API proxy in dev | Manual CORS config tweaking | Vite `server.proxy` | Zero-config proxy, no CORS issues in development |

**Key insight:** This is a personal dashboard app -- keep dependencies minimal. ApexCharts handles all visualization needs. No need for a full UI component library (Vuetify, PrimeVue) -- utility CSS + hand-crafted components is faster and lighter for 4-5 pages.

## Common Pitfalls

### Pitfall 1: Polling Memory Leaks
**What goes wrong:** `setInterval` or recursive `setTimeout` for job status polling continues after component unmount
**Why it happens:** Vue 3 Composition API requires explicit cleanup
**How to avoid:** Use `onUnmounted` hook to clear timeouts; or use an AbortController
**Warning signs:** Console errors about updating unmounted components

### Pitfall 2: Vite Proxy vs Production
**What goes wrong:** API calls work in dev (proxied) but break in production
**Why it happens:** Vite proxy only works in dev server; production needs real CORS or reverse proxy
**How to avoid:** Use environment variable for API base URL (`VITE_API_URL`). In production, configure nginx/caddy to serve SPA and proxy `/api` to Fastify
**Warning signs:** 404 or CORS errors in production only

### Pitfall 3: TypeScript Strictness Mismatch
**What goes wrong:** Frontend and backend have different tsconfig settings causing type confusion
**Why it happens:** Two separate tsconfig.json files
**How to avoid:** Ensure both use `strict: true`, `moduleResolution: "bundler"`. Backend already uses these settings.

### Pitfall 4: Large Initial Bundle
**What goes wrong:** ApexCharts + all views loaded upfront, slow first paint
**Why it happens:** No code splitting
**How to avoid:** Use `defineAsyncComponent` for chart components and route-level lazy loading with `() => import('./views/DashboardView.vue')`
**Warning signs:** Bundle > 500KB gzipped

### Pitfall 5: Dashboard N+1 Queries
**What goes wrong:** Dashboard loads slowly because frontend makes 4+ parallel API calls, each running complex aggregation queries
**Why it happens:** Naive endpoint design
**How to avoid:** Either combine into a single `/dashboard/summary` endpoint, or ensure each query uses proper indexes. Add indexes on `review_logs(reviewed_at)`, `srs_cards(card_type, state)`, `words(thematic_cluster)`
**Warning signs:** Dashboard load > 500ms

## Code Examples

### Vite Config with API Proxy
```typescript
// web/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

### Vue Router with Lazy Loading
```typescript
// web/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/sentences',
      name: 'sentences',
      component: () => import('@/views/SentenceInputView.vue'),
    },
    {
      path: '/vocabulary',
      name: 'vocabulary',
      component: () => import('@/views/VocabularyView.vue'),
    },
  ],
});

export default router;
```

### Progress Counters Component (DASH-01)
```vue
<!-- web/src/components/dashboard/ProgressCounters.vue -->
<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  stats: {
    new: number;
    learning: number;
    known: number;
  };
  label: string;
}

const props = defineProps<Props>();
const total = computed(() => props.stats.new + props.stats.learning + props.stats.known);
</script>

<template>
  <div class="progress-counters">
    <h3>{{ label }}</h3>
    <div class="counters">
      <div class="counter new">
        <span class="count">{{ stats.new }}</span>
        <span class="label">New</span>
      </div>
      <div class="counter learning">
        <span class="count">{{ stats.learning }}</span>
        <span class="label">Learning</span>
      </div>
      <div class="counter known">
        <span class="count">{{ stats.known }}</span>
        <span class="label">Known</span>
      </div>
    </div>
    <div class="total">Total: {{ total }}</div>
  </div>
</template>
```

### Custom Activity Heatmap (DASH-03 - preferred over stale library)
```vue
<!-- web/src/components/dashboard/ActivityHeatmap.vue -->
<script setup lang="ts">
import { computed } from 'vue';

interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

const props = defineProps<{ data: DayActivity[] }>();

const maxCount = computed(() => Math.max(...props.data.map((d) => d.count), 1));

function getColor(count: number): string {
  if (count === 0) return '#ebedf0';
  const intensity = Math.min(count / maxCount.value, 1);
  if (intensity < 0.25) return '#9be9a8';
  if (intensity < 0.5) return '#40c463';
  if (intensity < 0.75) return '#30a14e';
  return '#216e39';
}
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vuex | Pinia | Vue 3.2+ (2022) | Simpler API, better TS support, smaller bundle |
| Vue CLI + Webpack | Vite | Vue 3.3+ (2023) | 10-100x faster HMR, native ESM |
| Options API | Composition API + `<script setup>` | Vue 3.2+ (2022) | Better TS inference, composable reuse |
| Mixins | Composables | Vue 3 (2020) | No naming conflicts, explicit dependencies |
| Manual imports | unplugin-auto-import | 2023 | Less boilerplate (optional, skip for small project) |

**Deprecated/outdated:**
- Vuex: Pinia is the official replacement
- Vue CLI: Vite is the official build tool
- Options API: Still works but Composition API is preferred for new projects
- Filters (`{{ value | filter }}`): Removed in Vue 3, use computed or methods

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0 (already configured in project root) |
| Config file | `vitest.config.ts` (exists at project root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03 | Vue SPA builds and serves | smoke | `cd web && npm run build` | No -- Wave 0 |
| SENT-01 | Sentence input form submits to API and displays result | integration (API route test) | `npm test -- tests/sentences-api.test.ts` | Exists (backend only) |
| DASH-01 | Dashboard stats endpoint returns correct counts | unit | `npm test -- tests/dashboard-api.test.ts` | No -- Wave 0 |
| DASH-02 | Weak spots endpoint computes success rates | unit | `npm test -- tests/dashboard-api.test.ts` | No -- Wave 0 |
| DASH-03 | Activity endpoint returns daily aggregates | unit | `npm test -- tests/dashboard-api.test.ts` | No -- Wave 0 |
| DASH-04 | Cluster endpoint groups words by theme | unit | `npm test -- tests/dashboard-api.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=verbose`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + `cd web && npm run build` succeeds

### Wave 0 Gaps
- [ ] `tests/dashboard-api.test.ts` -- covers DASH-01, DASH-02, DASH-03, DASH-04
- [ ] `web/` project scaffolded with Vite -- covers INFRA-03

## Open Questions

1. **CSS approach: Tailwind vs UnoCSS vs plain CSS?**
   - What we know: Both work well with Vite. Project is personal/small. No existing CSS framework.
   - What's unclear: User preference
   - Recommendation: Use plain CSS with scoped styles in `.vue` files. Minimal overhead, no extra dependency. Add Tailwind later if desired.

2. **Production deployment: how to serve the SPA?**
   - What we know: Docker Compose already configured. Fastify serves on port 3000.
   - What's unclear: Whether to add nginx container or serve static files from Fastify
   - Recommendation: Use `@fastify/static` to serve the built `web/dist/` from the same Fastify server. Simplest for a single-user app. No extra container needed.

3. **Should web review sessions (ReviewView) be in scope?**
   - What we know: Phase requirements list DASH-* and SENT-01 only. Review already works via Telegram.
   - What's unclear: Whether web review is needed for v1
   - Recommendation: Out of scope for this phase. The route/view can be scaffolded but left as a placeholder.

## Sources

### Primary (HIGH confidence)
- Project source code analysis -- `src/routes/`, `src/db/schema/`, `src/services/`
- Project `package.json` -- current dependency versions
- Project `.planning/REQUIREMENTS.md` -- requirement definitions
- [Vue.js Quick Start](https://vuejs.org/guide/quick-start) -- official setup guide

### Secondary (MEDIUM confidence)
- [vue3-apexcharts npm](https://www.npmjs.com/package/vue3-apexcharts) -- v1.11.1, actively maintained (last publish 2026-03-03)
- [vue3-calendar-heatmap npm](https://www.npmjs.com/package/vue3-calendar-heatmap) -- v2.0.5, last publish 3 years ago (stale)
- [Vue 3 Project Structure Guide](https://faisalkhalid.bio/vue3-project-structure/) -- community patterns
- [razorness/vue3-calendar-heatmap](https://github.com/razorness/vue3-calendar-heatmap) -- GitHub-style heatmap component

### Tertiary (LOW confidence)
- CSS framework choice -- based on general ecosystem knowledge, no specific project guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Vue 3 + Vite + vue-router + Pinia is the official recommended stack
- Architecture: HIGH -- Project structure based on existing codebase patterns and Vue community standards
- Pitfalls: HIGH -- Based on direct analysis of existing API design and common SPA patterns
- New API endpoints: HIGH -- SQL queries derived directly from existing DB schema analysis

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable stack, 30-day window)
