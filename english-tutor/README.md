# English Tutor

Очередь слов и выражений с разбором и FSRS-повторением. Сервер на aventra (english.evm.im),
клиенты: группа Telegram с ботом general (bot-lite на work) и дашборд на том же сервере.
Спецификация и план: docs/superpowers/specs/2026-09-13-english-tutor-design.md,
docs/superpowers/plans/2026-09-13-english-tutor.md.

## Локально
npm install && npm test
DB_PATH=/tmp/et.sqlite npm run seed
API_TOKEN=dev DASHBOARD_PASSWORD=dev COOKIE_SECURE=0 DB_PATH=/tmp/et.sqlite PORT=3111 npm start

## Данные
node scripts/import-oxford.mjs && node scripts/import-phave.mjs && node scripts/import-phrase.mjs
node scripts/tag-roots.mjs      # claude -p, кэш data/roots.json (на work: балансировка токенов как у bot-lite)
node scripts/build-queue.mjs    # data/queue.json

## Деплой на aventra
rsync -az --delete --exclude node_modules --exclude data-db --exclude .env --exclude data/raw ./ aventra:/root/english-tutor/
ssh aventra 'cd /root/english-tutor && docker compose up -d --build && docker compose exec -T app node --disable-warning=ExperimentalWarning scripts/seed.mjs'

## Клиент на work
work/tutor.mjs читает ~/.claude/english-tutor.env (API_URL, API_TOKEN). Команды:
next [word|pv|expr] · explain <id> (markdown из stdin) · learn|known|discuss [id] · note [id] "текст"
· status · review · test <id> (JSON из stdin) · grade <1-4> [id] · pending
work/generator.mjs: фоновые разборы и предложения через claude -p (launchd com.aventra.english-generator).
