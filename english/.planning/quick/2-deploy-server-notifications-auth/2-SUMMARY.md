---
phase: quick-2
plan: 1
subsystem: deployment, bot
tags: [docker, caddy, auth, notifications, srs]
dependency_graph:
  requires: [bot-handlers, api-client, srs-review]
  provides: [production-deployment, bot-auth, review-notifications]
  affects: [bot-index, dockerfile, env-config]
tech_stack:
  added: [caddy]
  patterns: [grammy-middleware, setInterval-scheduler]
key_files:
  created:
    - src/bot/middleware/auth.ts
    - src/bot/notifications/scheduler.ts
    - src/bot/notifications/review-check.ts
    - docker-compose.prod.yml
    - Caddyfile
  modified:
    - src/bot/index.ts
    - Dockerfile
    - .env.example
decisions:
  - Auth middleware uses env var with hardcoded default for user ID
  - Notification scheduler uses setInterval (simple, no cron dependency)
  - Bot connects to app via Docker internal network (http://app:3000)
  - Caddy handles HTTPS automatically via Let's Encrypt
  - No ports exposed except 80/443 through Caddy
metrics:
  duration: 1min
  completed: "2026-03-10T18:12:02Z"
---

# Quick Task 2: Deploy Server, Notifications, Auth Summary

Production deployment config with bot auth restriction and hourly SRS review notifications using Docker Compose, Caddy reverse proxy, and grammy middleware.

## Task Completion

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Auth middleware + review notifications | 31efe22 | auth.ts, scheduler.ts, review-check.ts, index.ts |
| 2 | Production Docker + Caddy config | 4186eb6 | docker-compose.prod.yml, Caddyfile, Dockerfile |

## What Was Built

### Auth Middleware
- grammy middleware that checks `ctx.from.id` against `ALLOWED_TELEGRAM_USER_ID` env var
- Rejects unauthorized users with "Unauthorized" message
- Wired before all handlers in bot index

### Notification Scheduler
- `checkAndNotifyDueCards` fetches due cards via API client, sends count message if any exist
- `startNotificationScheduler` runs check every hour via `setInterval`
- Initial check fires 10 seconds after bot startup
- Cleanup on SIGTERM/SIGINT

### Production Docker Setup
- **Dockerfile**: `npm ci --omit=dev`, no watch mode, `npx tsx src/main.ts` default CMD
- **docker-compose.prod.yml**: 5 services (postgres, redis, app, worker, bot) + caddy
  - Postgres/Redis: no exposed ports, healthchecks
  - App/Worker: depend on healthy postgres+redis
  - Bot: depends on app started, connects via internal network
  - Caddy: ports 80/443, auto-HTTPS for english.evm.im
- **Caddyfile**: Simple reverse proxy to app:3000

## Deviations from Plan

None - plan executed exactly as written.

## Deployment Steps

```bash
# On server (ssh aventra)
git clone <repo> && cd english
# Create .env with: TELEGRAM_BOT_TOKEN, AI_PROVIDER, AI_MODEL, OPENAI_API_KEY, POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx drizzle-kit push
```
