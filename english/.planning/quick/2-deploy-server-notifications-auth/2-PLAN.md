---
phase: quick-2
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.prod.yml
  - Caddyfile
  - Dockerfile
  - .env.example
  - src/bot/index.ts
  - src/bot/middleware/auth.ts
  - src/bot/notifications/scheduler.ts
  - src/bot/notifications/review-check.ts
autonomous: false
requirements: [DEPLOY-01, AUTH-01, NOTIFY-01]
must_haves:
  truths:
    - "Application runs on server via docker compose at english.evm.im"
    - "Only Telegram user 875484579 can interact with the bot"
    - "Bot sends hourly notification when SRS cards are due for review"
  artifacts:
    - path: "docker-compose.prod.yml"
      provides: "Production Docker Compose with all services"
    - path: "Caddyfile"
      provides: "Reverse proxy with automatic HTTPS for english.evm.im"
    - path: "src/bot/middleware/auth.ts"
      provides: "Telegram user restriction middleware"
    - path: "src/bot/notifications/scheduler.ts"
      provides: "Hourly notification cron scheduler"
  key_links:
    - from: "src/bot/index.ts"
      to: "src/bot/middleware/auth.ts"
      via: "bot.use(authMiddleware)"
      pattern: "bot\\.use"
    - from: "src/bot/index.ts"
      to: "src/bot/notifications/scheduler.ts"
      via: "startNotificationScheduler(bot)"
      pattern: "startNotificationScheduler"
---

<objective>
Deploy the English learning app to the server (ssh aventra) as Docker containers with domain english.evm.im. Add Telegram user restriction (only user ID 875484579) and hourly SRS review notifications.

Purpose: Move from local dev to production, secure the bot to single user, add proactive review reminders.
Output: Production docker-compose, Caddy config, auth middleware, notification scheduler.
</objective>

<execution_context>
@/Users/evd3v/.claude/get-shit-done/workflows/execute-plan.md
@/Users/evd3v/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docker-compose.yml
@Dockerfile
@.env.example
@src/bot/index.ts
@src/bot/handlers/review.ts
@src/bot/services/api-client.ts
@src/workers/index.ts
@src/main.ts
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Telegram auth middleware and hourly review notifications</name>
  <files>src/bot/middleware/auth.ts, src/bot/notifications/scheduler.ts, src/bot/notifications/review-check.ts, src/bot/index.ts, .env.example</files>
  <action>
1. Create `src/bot/middleware/auth.ts`:
   - Export a grammy middleware function that checks `ctx.from?.id` against `ALLOWED_TELEGRAM_USER_ID` env var (default: 875484579).
   - If user ID does not match, reply "Unauthorized" and return (do not call next()).
   - If matches, call `next()`.

2. Create `src/bot/notifications/review-check.ts`:
   - Export `async function checkAndNotifyDueCards(bot: Bot, chatId: number): Promise<void>`
   - Call `apiClient.getDueCards(1)` to check if any cards are due (limit 1 is enough to check existence).
   - If cards.length > 0, fetch full count with `apiClient.getDueCards(100)` and send message: "You have {N} cards due for review! Use /review to start."
   - If 0 cards, do nothing (no message).
   - Wrap in try/catch, log errors but don't crash.

3. Create `src/bot/notifications/scheduler.ts`:
   - Export `function startNotificationScheduler(bot: Bot): void`
   - Use `setInterval` with 1 hour (3600000ms) interval.
   - Read `NOTIFICATION_CHAT_ID` from env (same as ALLOWED_TELEGRAM_USER_ID — the personal chat ID with the bot). Note: for Telegram bots, the chat ID for a private chat equals the user ID.
   - On each tick, call `checkAndNotifyDueCards(bot, chatId)`.
   - Also run once on startup after a 10-second delay (give API time to start).
   - Handle SIGTERM to clear the interval.

4. Update `src/bot/index.ts`:
   - Import auth middleware, add `bot.use(authMiddleware)` BEFORE registering handlers.
   - Import and call `startNotificationScheduler(bot)` after `bot.start()` callback.

5. Add to `.env.example`:
   - `ALLOWED_TELEGRAM_USER_ID=875484579`
   - `NOTIFICATION_CHAT_ID=875484579`
  </action>
  <verify>
    <automated>npx tsx --eval "import { createAuthMiddleware } from './src/bot/middleware/auth.ts'; console.log('auth OK'); import { startNotificationScheduler } from './src/bot/notifications/scheduler.ts'; console.log('scheduler OK')" 2>&1 | grep -c "OK"</automated>
  </verify>
  <done>Auth middleware rejects non-matching user IDs. Notification scheduler starts with setInterval. Bot index wires both. Env example updated.</done>
</task>

<task type="auto">
  <name>Task 2: Create production Docker and Caddy config for server deployment</name>
  <files>Dockerfile, docker-compose.prod.yml, Caddyfile</files>
  <action>
1. Update `Dockerfile` for production:
   - Keep `FROM node:22-alpine` and `WORKDIR /app`.
   - `COPY package*.json ./` then `RUN npm ci --omit=dev` (production deps only).
   - `COPY . .` (no source mount in prod).
   - Remove `tsx watch` — use `npx tsx` without watch.
   - Set `CMD ["npx", "tsx", "src/main.ts"]` as default (overridden per service in compose).

2. Create `docker-compose.prod.yml`:
   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       restart: unless-stopped
       environment:
         POSTGRES_USER: english
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-english}
         POSTGRES_DB: english
       volumes:
         - pgdata:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U english"]
         interval: 10s
         timeout: 5s
         retries: 5

     redis:
       image: redis:7-alpine
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 10s
         timeout: 5s
         retries: 5

     app:
       build:
         context: .
         dockerfile: Dockerfile
       restart: unless-stopped
       command: ["npx", "tsx", "src/main.ts"]
       environment:
         DATABASE_URL: postgres://english:${POSTGRES_PASSWORD:-english}@postgres:5432/english
         REDIS_URL: redis://redis:6379
         AI_PROVIDER: ${AI_PROVIDER}
         AI_MODEL: ${AI_MODEL}
         OPENAI_API_KEY: ${OPENAI_API_KEY}
         ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
       depends_on:
         postgres:
           condition: service_healthy
         redis:
           condition: service_healthy

     worker:
       build:
         context: .
         dockerfile: Dockerfile
       restart: unless-stopped
       command: ["npx", "tsx", "src/workers/index.ts"]
       environment:
         DATABASE_URL: postgres://english:${POSTGRES_PASSWORD:-english}@postgres:5432/english
         REDIS_URL: redis://redis:6379
         AI_PROVIDER: ${AI_PROVIDER}
         AI_MODEL: ${AI_MODEL}
         OPENAI_API_KEY: ${OPENAI_API_KEY}
         ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
       depends_on:
         postgres:
           condition: service_healthy
         redis:
           condition: service_healthy

     bot:
       build:
         context: .
         dockerfile: Dockerfile
       restart: unless-stopped
       command: ["npx", "tsx", "src/bot/index.ts"]
       environment:
         API_URL: http://app:3000
         TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
         ALLOWED_TELEGRAM_USER_ID: ${ALLOWED_TELEGRAM_USER_ID:-875484579}
         NOTIFICATION_CHAT_ID: ${NOTIFICATION_CHAT_ID:-875484579}
       depends_on:
         app:
           condition: service_started

     caddy:
       image: caddy:2-alpine
       restart: unless-stopped
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile
         - caddy_data:/data
         - caddy_config:/config
       depends_on:
         - app

   volumes:
     pgdata:
     caddy_data:
     caddy_config:
   ```

   Key decisions:
   - No ports exposed on postgres/redis (internal only).
   - Bot connects to app via Docker network (`http://app:3000`).
   - All secrets via env vars (user creates `.env` on server).
   - `restart: unless-stopped` for all services.

3. Create `Caddyfile`:
   ```
   english.evm.im {
     reverse_proxy app:3000
   }
   ```
   Caddy handles automatic HTTPS via Let's Encrypt.

4. Add `POSTGRES_PASSWORD` to `.env.example` with comment for production.
  </action>
  <verify>
    <automated>docker compose -f docker-compose.prod.yml config --quiet 2>&1 && echo "VALID" || echo "INVALID"</automated>
  </verify>
  <done>Production docker-compose.prod.yml validates. All 5 services defined (postgres, redis, app, worker, bot). Caddy configured for english.evm.im with auto-HTTPS. No ports exposed except 80/443.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Production deployment configuration and bot enhancements:
    - docker-compose.prod.yml with 5 services (postgres, redis, app, worker, bot, caddy)
    - Caddyfile for english.evm.im with auto-HTTPS
    - Telegram user restriction middleware (only user 875484579)
    - Hourly SRS review notification scheduler
  </what-built>
  <how-to-verify>
    1. Review docker-compose.prod.yml — ensure all env vars and service dependencies look correct
    2. To deploy to server:
       ```bash
       # On local machine
       git push origin good

       # SSH to server
       ssh aventra
       cd /path/to/english  # clone repo if needed
       git pull
       # Create .env file with production secrets:
       # TELEGRAM_BOT_TOKEN, OPENAI_API_KEY/ANTHROPIC_API_KEY, AI_PROVIDER, AI_MODEL, POSTGRES_PASSWORD
       docker compose -f docker-compose.prod.yml up -d --build
       # Run migrations
       docker compose -f docker-compose.prod.yml exec app npx tsx node_modules/.bin/drizzle-kit push
       ```
    3. Verify https://english.evm.im responds
    4. Send a message to the bot from your Telegram account — should work
    5. Try from another account (if possible) — should get "Unauthorized"
    6. Wait for notification or check bot logs: `docker compose -f docker-compose.prod.yml logs bot`
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `docker compose -f docker-compose.prod.yml config` validates without errors
- Auth middleware module imports successfully
- Notification scheduler module imports successfully
- Bot index.ts wires auth middleware and notification scheduler
</verification>

<success_criteria>
- Production Docker Compose defines all 5 services with proper dependencies
- Caddy configured for english.evm.im domain
- Bot rejects messages from non-authorized users
- Bot checks for due SRS cards every hour and notifies if any are due
- All env vars documented in .env.example
</success_criteria>

<output>
After completion, create `.planning/quick/2-deploy-server-notifications-auth/2-SUMMARY.md`
</output>
