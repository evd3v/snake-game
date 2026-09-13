# English Tutor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Очередь слов и выражений (Oxford 5000 B2-C1, PHaVE, PHRASE, Oxford Phrase List) с разбором и FSRS-повторением, доступная из группы Telegram с личным ассистентом и с веб-дашборда, с одним состоянием на сервере aventra.

**Architecture:** Сервер Fastify + SQLite (`node:sqlite`) + ts-fsrs на aventra хранит очередь, карточки, историю, кэш разборов и запас проверочных предложений; тексты пишет Claude Opus на work (воркер bot-lite в диалоге и фоновый `generator.mjs`), сервер отдаёт готовые промпты и валидирует результат; дашборд это статичный HTML на том же сервере; Telegram-клиент это тонкий CLI `tutor.mjs`, который вызывает воркер бота general.

**Tech Stack:** Node 22 (ESM, `node:sqlite`, `node:test`), Fastify 5 (`@fastify/static`, `@fastify/cookie`), ts-fsrs 5, Docker Compose на aventra, launchd на work, bot-lite (edumotion `ops/bot-lite`).

**Spec:** `docs/superpowers/specs/2026-09-13-english-tutor-design.md`

## Global Constraints

- Node 22.13+ везде (`node:sqlite` без флага; предупреждение гасится `--disable-warning=ExperimentalWarning`). На work `/usr/local/bin/node` = v22.14, локально v22.14.
- Никаких нативных зависимостей: SQLite только через `node:sqlite`.
- Тексты для ученика только по-русски, без длинного тире «—», без ИИ-штампов. Примеры на английском.
- `/next` возвращает ровно один элемент; `/review` ровно одну карточку. Пачек нет.
- Порог «выучено»: `fsrs_state = 2 (Review)` и `fsrs_scheduled_days >= 21`. Пропорция потоков в очереди 6 слов : 2 фразовых : 2 выражения. Уровни слов только B2 и C1.
- Сервер не хранит ключей LLM и сам тексты не генерирует.
- Правка движка bot-lite ровно одна: спойлер `||текст||` в `mdToTelegramHtml`.
- Все коммиты в репозиторий `personal` (папка `english-tutor/`), кроме правки bot-lite (репозиторий edumotion, `ops/bot-lite`). Коммитить точечно `git add <пути>`, чужие незакоммиченные файлы не трогать. Сообщения коммитов заканчиваются строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Секреты не коммитятся: `.env` на серверах, в репозитории только `.env.example`.
- Параллельно не больше 3 субагентов, за задачу не больше 10.

## Структура файлов

```
english-tutor/
  package.json            scripts: test, start, seed; deps: fastify, @fastify/static, @fastify/cookie, ts-fsrs
  README.md               как запустить, деплой, команды tutor.mjs
  Dockerfile, docker-compose.yml, .env.example, .dockerignore
  src/schema.sql          таблицы cards, tests, review_log, notes, settings, sessions
  src/db.mjs              openDb(), nowIso(), getSetting/setSetting, httpError
  src/fsrs.mjs            emptyFsrsFields, applyRating, isMature, Rating, State
  src/queue.mjs           nextCard, pendingCard, decide, status, listCards, getCard, hydrate
  src/review.mjs          reviewNext, requiredTestType, validateSentence, addTest, grade, recentSentences
  src/jobs.mjs            jobs() для генератора
  src/prompts.mjs         renderExplainPrompt(card), renderTestPrompt(card, type, history)
  src/server.mjs          buildApp({db, env}) + запуск; маршруты /api/*, статика, напоминание
  prompts/explain.md, prompts/test.md, prompts/roots.md
  scripts/import-oxford.mjs, import-phave.mjs, import-phrase.mjs, tag-roots.mjs, build-queue.mjs, seed.mjs
  data/raw/               oxford_5000.json, full-word.json, phave.txt, phrase.txt, opl.html (исходники, коммитятся)
  data/words.json, pv.json, expr.json, roots.json, queue.json
  public/index.html, app.js, style.css
  work/tutor.mjs          CLI для воркера бота (HTTP-клиент, форматирование под Telegram)
  work/generator.mjs      фоновый генератор через claude -p
  work/TUTOR.md           инструкция репетитора для бота general
  work/com.aventra.english-generator.plist
  tests/*.test.mjs
```

Все команды ниже выполняются из `/Users/evd3v/Projects/personal/english-tutor`, если не сказано иное.

---

### Task 1: Каркас, база и обёртка FSRS

**Files:**
- Create: `english-tutor/package.json`, `english-tutor/.gitignore`, `english-tutor/src/schema.sql`, `english-tutor/src/db.mjs`, `english-tutor/src/fsrs.mjs`
- Test: `english-tutor/tests/db.test.mjs`, `english-tutor/tests/fsrs.test.mjs`

**Interfaces:**
- Produces: `openDb(file?) -> DatabaseSync`, `nowIso() -> string`, `getSetting(db,key)`, `setSetting(db,key,value)`, `httpError(status, message) -> Error{statusCode}`; `emptyFsrsFields(now) -> {fsrs_*}`, `applyRating(row, rating, now) -> {fields, log}`, `isMature(row) -> boolean`, `Rating`, `State`, `MATURE_DAYS = 21`.

- [ ] **Step 1: package.json и .gitignore**

```json
{
  "name": "english-tutor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "test": "node --disable-warning=ExperimentalWarning --test tests/*.test.mjs",
    "start": "node --disable-warning=ExperimentalWarning src/server.mjs",
    "seed": "node --disable-warning=ExperimentalWarning scripts/seed.mjs"
  },
  "dependencies": {
    "@fastify/cookie": "^11.0.2",
    "@fastify/static": "^8.1.1",
    "fastify": "^5.3.2",
    "ts-fsrs": "^5.2.3"
  }
}
```

`.gitignore`:
```
node_modules/
data-db/
.env
```

Run: `npm install` (создаст package-lock.json, он коммитится).

- [ ] **Step 2: schema.sql**

```sql
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('word','pv','expr')),
  headword TEXT NOT NULL,
  pos TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  source_json TEXT NOT NULL,
  group_key TEXT,
  group_label TEXT,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','shown','discussing','learning','known','suspended')),
  explanation_md TEXT,
  shown_at TEXT,
  decided_at TEXT,
  fsrs_due TEXT,
  fsrs_stability REAL NOT NULL DEFAULT 0,
  fsrs_difficulty REAL NOT NULL DEFAULT 0,
  fsrs_elapsed_days INTEGER NOT NULL DEFAULT 0,
  fsrs_scheduled_days INTEGER NOT NULL DEFAULT 0,
  fsrs_reps INTEGER NOT NULL DEFAULT 0,
  fsrs_lapses INTEGER NOT NULL DEFAULT 0,
  fsrs_learning_steps INTEGER NOT NULL DEFAULT 0,
  fsrs_state INTEGER NOT NULL DEFAULT 0,
  fsrs_last_review TEXT,
  UNIQUE (kind, headword, pos)
);
CREATE INDEX IF NOT EXISTS cards_status_order ON cards(status, order_index);
CREATE INDEX IF NOT EXISTS cards_due ON cards(status, fsrs_due);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('context','cloze')),
  sentence TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS tests_card_unused ON tests(card_id, used_at);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  ts TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  test_id INTEGER REFERENCES tests(id),
  test_type TEXT,
  sentence TEXT,
  answer TEXT,
  scheduled_days INTEGER,
  due_after TEXT
);
CREATE INDEX IF NOT EXISTS review_log_card ON review_log(card_id, id);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  ts TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
```

- [ ] **Step 3: Тест db**

`tests/db.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getSetting, setSetting, httpError } from '../src/db.mjs';

test('openDb создаёт схему и settings работают', () => {
  const db = openDb(':memory:');
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map((r) => r.name);
  assert.deepEqual(tables, ['cards', 'notes', 'review_log', 'sessions', 'settings', 'sqlite_sequence', 'tests']);
  assert.equal(getSetting(db, 'x'), null);
  setSetting(db, 'x', '1');
  setSetting(db, 'x', '2');
  assert.equal(getSetting(db, 'x'), '2');
});

test('httpError несёт statusCode', () => {
  const e = httpError(422, 'нет');
  assert.equal(e.statusCode, 422);
  assert.equal(e.message, 'нет');
});
```

- [ ] **Step 4: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/db.mjs'`.

- [ ] **Step 5: db.mjs**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));

export function openDb(file = process.env.DB_PATH || ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  return db;
}

export const nowIso = () => new Date().toISOString();

export function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

export function httpError(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}
```

- [ ] **Step 6: Тест fsrs**

`tests/fsrs.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFsrsFields, applyRating, isMature, Rating, State, MATURE_DAYS } from '../src/fsrs.mjs';

const t0 = new Date('2026-09-13T10:00:00Z');

test('новая карточка: state New, due = now', () => {
  const f = emptyFsrsFields(t0);
  assert.equal(f.fsrs_state, State.New);
  assert.equal(f.fsrs_due, t0.toISOString());
  assert.equal(f.fsrs_reps, 0);
});

test('Good дважды выводит в Review с интервалом в днях', () => {
  let row = emptyFsrsFields(t0);
  row = { ...row, ...applyRating(row, Rating.Good, t0).fields };
  assert.equal(row.fsrs_state, State.Learning);
  const t1 = new Date('2026-09-14T10:00:00Z');
  row = { ...row, ...applyRating(row, Rating.Good, t1).fields };
  assert.equal(row.fsrs_state, State.Review);
  assert.ok(row.fsrs_scheduled_days >= 1);
  assert.ok(new Date(row.fsrs_due) > t1);
});

test('Again после Review даёт Relearning и lapse', () => {
  let row = emptyFsrsFields(t0);
  row = { ...row, ...applyRating(row, Rating.Good, t0).fields };
  row = { ...row, ...applyRating(row, Rating.Good, new Date('2026-09-14T10:00:00Z')).fields };
  row = { ...row, ...applyRating(row, Rating.Again, new Date('2026-09-30T10:00:00Z')).fields };
  assert.equal(row.fsrs_state, State.Relearning);
  assert.equal(row.fsrs_lapses, 1);
});

test('isMature: Review и >= 21 дня', () => {
  assert.equal(MATURE_DAYS, 21);
  assert.equal(isMature({ fsrs_state: State.Review, fsrs_scheduled_days: 21 }), true);
  assert.equal(isMature({ fsrs_state: State.Review, fsrs_scheduled_days: 20 }), false);
  assert.equal(isMature({ fsrs_state: State.Learning, fsrs_scheduled_days: 30 }), false);
});

test('applyRating отвергает рейтинг вне 1..4', () => {
  assert.throws(() => applyRating(emptyFsrsFields(t0), 5, t0), /1\.\.4/);
});
```

- [ ] **Step 7: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/fsrs.mjs'`.

- [ ] **Step 8: fsrs.mjs**

```js
import { fsrs, createEmptyCard, generatorParameters, Rating, State } from 'ts-fsrs';

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));

export const MATURE_DAYS = 21;
export { Rating, State };

export function toFields(card) {
  return {
    fsrs_due: card.due.toISOString(),
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    fsrs_elapsed_days: card.elapsed_days,
    fsrs_scheduled_days: card.scheduled_days,
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_learning_steps: card.learning_steps,
    fsrs_state: card.state,
    fsrs_last_review: card.last_review ? card.last_review.toISOString() : null
  };
}

export function fromRow(row) {
  return {
    due: new Date(row.fsrs_due),
    stability: row.fsrs_stability,
    difficulty: row.fsrs_difficulty,
    elapsed_days: row.fsrs_elapsed_days,
    scheduled_days: row.fsrs_scheduled_days,
    reps: row.fsrs_reps,
    lapses: row.fsrs_lapses,
    learning_steps: row.fsrs_learning_steps,
    state: row.fsrs_state,
    last_review: row.fsrs_last_review ? new Date(row.fsrs_last_review) : undefined
  };
}

export function emptyFsrsFields(now = new Date()) {
  return toFields(createEmptyCard(now));
}

export function applyRating(row, rating, now = new Date()) {
  if (![1, 2, 3, 4].includes(Number(rating))) throw new Error('rating must be 1..4');
  const { card, log } = scheduler.next(fromRow(row), now, Number(rating));
  return { fields: toFields(card), log };
}

export function isMature(row) {
  return row.fsrs_state === State.Review && row.fsrs_scheduled_days >= MATURE_DAYS;
}
```

- [ ] **Step 9: Запустить тесты**

Run: `npm test`
Expected: PASS, 7 тестов.

- [ ] **Step 10: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/package.json english-tutor/package-lock.json english-tutor/.gitignore english-tutor/src/schema.sql english-tutor/src/db.mjs english-tutor/src/fsrs.mjs english-tutor/tests/db.test.mjs english-tutor/tests/fsrs.test.mjs
git commit -m "feat(english-tutor): каркас, схема SQLite и обёртка FSRS

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Импорт источников (Oxford 5000, PHaVE, PHRASE, Oxford Phrase List)

**Files:**
- Create: `english-tutor/data/raw/oxford_5000.json`, `english-tutor/data/raw/full-word.json`, `english-tutor/data/raw/phave.txt`, `english-tutor/data/raw/phrase.txt`, `english-tutor/data/raw/opl.html`
- Create: `english-tutor/scripts/import-oxford.mjs`, `english-tutor/scripts/import-phave.mjs`, `english-tutor/scripts/import-phrase.mjs`
- Create: `english-tutor/src/normalize.mjs`
- Test: `english-tutor/tests/import.test.mjs` (с фикстурами в `tests/fixtures/`)

**Interfaces:**
- Produces: `data/words.json: [{headword, pos, level, definition, example, examples[], phon}]`, `data/pv.json: [{headword, verb, particle, rank, senses:[{n, meaning, percent, example}]}]`, `data/expr.json: [{headword, source:'phrase'|'opl', rank|null, band|null, level|null, example|null, genre:{spoken,written,academic}|null}]`; `normalizeHeadword(s) -> string` (нижний регистр, `sb/sth/one's` сохраняются, лишние пробелы и `…` убраны).
- Функции парсинга экспортируются из скриптов: `parseOxford(json, fullWordJson)`, `parsePhave(text)`, `parsePhraseDoc(text)`, `parseOpl(html)`; сами скрипты при запуске как `node scripts/x.mjs` читают `data/raw/*` и пишут `data/*.json`.

- [ ] **Step 1: Положить исходники в data/raw**

Исходники уже скачаны в scratchpad этой сессии (`/private/tmp/claude-503/-Users-evd3v-Projects-personal/005154e5-ec51-490f-990f-99137388d2d4/scratchpad`). Если папки нет, скачать заново:

```bash
mkdir -p data/raw && cd data/raw
curl -sL -o oxford_5000.json "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/main/data/oxford_5000.json"
curl -sL -o full-word.json "https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/main/full-word.json"
curl -sL -o phave-list.pdf "https://www.norbertschmitt.co.uk/_files/ugd/5f2482_fb2f15be0d104d08802d9ffd722e5782.pdf" && pdftotext -layout phave-list.pdf phave.txt && rm phave-list.pdf
curl -sL -o phrase-list.doc "https://www.norbertschmitt.co.uk/_files/ugd/5f2482_63c555de9e3f4c09af4170ba051b3bbe.doc" && textutil -convert txt -output phrase.txt phrase-list.doc && rm phrase-list.doc
curl -sL -A "Mozilla/5.0" -o opl.html "https://www.oxfordlearnersdictionaries.com/wordlists/oxford-phrase-list?level=b2"
cd ../..
```

Проверка: `python3 -c "import json;d=json.load(open('data/raw/oxford_5000.json'));print(len(d))"` → 5944; `grep -c 'data-hw=' data/raw/opl.html` → строк ≥ 1 и `grep -o 'data-hw=' data/raw/opl.html | wc -l` → 750; `grep -cE '^[0-9]+\. [A-Z][A-Z ]+$' data/raw/phave.txt` → 150.

Форматы (проверено 13.09.2026):
- `oxford_5000.json`: объект `{ "<key>": {word, type, cefr ('a1'..'c1'), phon_br, phon_n_am, definition, example, uk, us} }`, 5944 записей, b2 = 1571, c1 = 1404.
- `full-word.json`: массив `[{id, value: {word, href, type, level ('A1'..'C1'), examples: [..]}}]`, 5948 записей.
- `phave.txt`: блоки вида
  ```
  1. GO ON

  1. Happen, take place (64.5%)

             There is a debate going on right now between the two parties.

  2. (+ To) Proceed to do or tackle STH after doing STH else (13%)

             Does anyone have any questions before I go on to the next chapter?
  ```
  Заголовок: `^(\d+)\. ([A-Z][A-Z ]+)$` (150 штук). Значение: `^(\d+)\. (.+?) \(([\d.]+)%\)$`. Пример: следующая непустая строка после значения, начинается с пробелов.
- `phrase.txt`: после шапки идут повторяющиеся группы строк: `rank` (число), `PHRASE` (верхний регистр, может содержать `/`, скобки), `frequency` (число), три строки с `* * *` / `* *` / `*` / `x`, `example`. 505 фраз.
- `opl.html`: `<li data-hw="a bit of a&#x2026;" data-oxford_phrase_list="b2">`, 750 штук, все уровни в одном HTML.

- [ ] **Step 2: Фикстуры и тест**

`tests/fixtures/phave-sample.txt` (скопировать из `data/raw/phave.txt` первые два блока, GO ON и PICK UP, как есть), `tests/fixtures/phrase-sample.txt`:
```
Appendix: The PHRASE List
Integrated        
List 
Rank
Phrase
Frequency
(per 100 million)
Spoken general
Written general
Written academic
Example
107
HAVE TO
83092
* * *
* * 
* 
I exercise because I have to.
415
SUCH AS
30857
* 
* * *
* * *
We have questions, such as how it happened.
1201
IN TERMS OF
9800
* 
* * 
* * *
In terms of cost, it is fine.
```
`tests/fixtures/opl-sample.html`:
```html
<ul><li data-hw="a bit" data-oxford_phrase_list="a2"><a>a bit</a></li>
<li data-hw="a bit of a&#x2026;" data-oxford_phrase_list="b2"><a>a bit of a…</a></li>
<li data-hw="come up with sth" data-oxford_phrase_list="b2"><a>come up with sth</a></li>
<li data-hw="in the long run" data-oxford_phrase_list="c1"><a>in the long run</a></li></ul>
```

`tests/import.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOxford } from '../scripts/import-oxford.mjs';
import { parsePhave } from '../scripts/import-phave.mjs';
import { parsePhraseDoc, parseOpl } from '../scripts/import-phrase.mjs';
import { normalizeHeadword } from '../src/normalize.mjs';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('normalizeHeadword', () => {
  assert.equal(normalizeHeadword('  A bit of a…  '), 'a bit of a');
  assert.equal(normalizeHeadword('COME UP'), 'come up');
  assert.equal(normalizeHeadword('look for sb/sth'), 'look for sb/sth');
});

test('parseOxford берёт только b2 и c1 и подклеивает примеры', () => {
  const ox = {
    k1: { word: 'a', type: 'indefinite article', cefr: 'a1', definition: 'x', example: 'a man', phon_br: '/ə/' },
    k2: { word: 'heritage', type: 'noun', cefr: 'c1', definition: 'the history...', example: 'rich heritage', phon_br: '/ˈherɪtɪdʒ/' },
    k3: { word: 'absorb', type: 'verb', cefr: 'b2', definition: 'take in', example: 'absorb water', phon_br: '/əbˈzɔːb/' }
  };
  const full = [{ id: 1, value: { word: 'heritage', type: 'noun', level: 'C1', examples: ['rich heritage', 'our cultural heritage'] } }];
  const out = parseOxford(ox, full);
  assert.deepEqual(out.map((w) => w.headword), ['heritage', 'absorb']);
  assert.equal(out[0].level, 'C1');
  assert.deepEqual(out[0].examples, ['rich heritage', 'our cultural heritage']);
  assert.deepEqual(out[1].examples, ['absorb water']);
});

test('parsePhave: 2 глагола, значения с процентами и примерами', () => {
  const out = parsePhave(fx('phave-sample.txt'));
  assert.equal(out.length, 2);
  assert.equal(out[0].headword, 'go on');
  assert.equal(out[0].verb, 'go');
  assert.equal(out[0].particle, 'on');
  assert.equal(out[0].rank, 1);
  assert.equal(out[0].senses.length, 2);
  assert.equal(out[0].senses[0].percent, 64.5);
  assert.match(out[0].senses[0].example, /debate going on/);
  assert.equal(out[1].headword, 'pick up');
});

test('parsePhraseDoc: ранг, фраза, частота, жанры, пример', () => {
  const out = parsePhraseDoc(fx('phrase-sample.txt'));
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], {
    headword: 'have to', source: 'phrase', rank: 107, band: 1, level: null,
    frequency: 83092, genre: { spoken: 3, written: 2, academic: 1 }, example: 'I exercise because I have to.'
  });
  assert.equal(out[2].band, 2);
});

test('parseOpl: только b2 и c1', () => {
  const out = parseOpl(fx('opl-sample.html'));
  assert.deepEqual(out.map((e) => [e.headword, e.level]), [['a bit of a', 'B2'], ['come up with sth', 'B2'], ['in the long run', 'C1']]);
  assert.equal(out[0].source, 'opl');
});
```

- [ ] **Step 3: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL на импортах `../scripts/import-oxford.mjs`.

- [ ] **Step 4: normalize.mjs**

```js
export function normalizeHeadword(s) {
  return String(s || '')
    .replace(/&#x2026;|…|\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
```

- [ ] **Step 5: import-oxford.mjs**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

export function parseOxford(oxfordJson, fullWordJson = []) {
  const extra = new Map();
  for (const item of fullWordJson) {
    const v = item.value || {};
    extra.set(`${normalizeHeadword(v.word)}|${(v.type || '').toLowerCase()}`, v.examples || []);
  }
  const out = [];
  for (const e of Object.values(oxfordJson)) {
    const level = String(e.cefr || '').toUpperCase();
    if (level !== 'B2' && level !== 'C1') continue;
    const headword = normalizeHeadword(e.word);
    const pos = String(e.type || '').toLowerCase();
    const more = extra.get(`${headword}|${pos}`) || [];
    const examples = [...new Set([e.example, ...more].filter(Boolean))];
    out.push({ headword, pos, level, definition: e.definition || '', example: e.example || '', examples, phon: e.phon_br || '' });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ox = JSON.parse(fs.readFileSync('data/raw/oxford_5000.json', 'utf8'));
  const full = JSON.parse(fs.readFileSync('data/raw/full-word.json', 'utf8'));
  const words = parseOxford(ox, full);
  fs.writeFileSync('data/words.json', JSON.stringify(words, null, 1));
  console.log(`words: ${words.length}`);
}
```

- [ ] **Step 6: import-phave.mjs**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

const HEAD = /^(\d+)\. ([A-Z][A-Z ]+)$/;
const SENSE = /^(\d+)\. (.+?) \(([\d.]+)%\)$/;

export function parsePhave(text) {
  const lines = text.split('\n').map((l) => l.replace(/\f/g, ''));
  const out = [];
  let cur = null;
  let sense = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const h = raw.match(HEAD);
    if (h) {
      const headword = normalizeHeadword(h[2]);
      const [verb, ...rest] = headword.split(' ');
      cur = { headword, verb, particle: rest.join(' '), rank: Number(h[1]), senses: [] };
      out.push(cur);
      sense = null;
      continue;
    }
    const s = raw.match(SENSE);
    if (s && cur) {
      sense = { n: Number(s[1]), meaning: s[2].trim(), percent: Number(s[3]), example: '' };
      cur.senses.push(sense);
      continue;
    }
    if (sense && /^\s{4,}/.test(raw) && !sense.example) sense.example = line;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pv = parsePhave(fs.readFileSync('data/raw/phave.txt', 'utf8'));
  fs.writeFileSync('data/pv.json', JSON.stringify(pv, null, 1));
  console.log(`pv: ${pv.length}, senses: ${pv.reduce((n, p) => n + p.senses.length, 0)}`);
}
```

Внимание: заголовок `^(\d+)\. ([A-Z][A-Z ]+)$` матчится по `raw` (без trim), потому что строки значений тоже начинаются с `N. `, но содержат строчные буквы.

- [ ] **Step 7: import-phrase.mjs**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

const stars = (s) => (s.trim().toLowerCase() === 'x' ? 0 : (s.match(/\*/g) || []).length);

export function parsePhraseDoc(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r/g, '').trimEnd());
  const out = [];
  for (let i = 0; i + 6 < lines.length; i++) {
    if (!/^\d+$/.test(lines[i].trim())) continue;
    const phrase = lines[i + 1].trim();
    if (!/^[A-Z][A-Z0-9 '’/()\-.,?!]*$/.test(phrase)) continue;
    if (!/^\d+$/.test(lines[i + 2].trim())) continue;
    const marks = [lines[i + 3], lines[i + 4], lines[i + 5]];
    if (!marks.every((m) => /^[\s*xX]+$/.test(m))) continue;
    const rank = Number(lines[i].trim());
    out.push({
      headword: normalizeHeadword(phrase),
      source: 'phrase',
      rank,
      band: Math.max(1, Math.ceil(rank / 1000)),
      level: null,
      frequency: Number(lines[i + 2].trim()),
      genre: { spoken: stars(marks[0]), written: stars(marks[1]), academic: stars(marks[2]) },
      example: lines[i + 6].trim()
    });
    i += 6;
  }
  return out;
}

export function parseOpl(html) {
  const out = [];
  const re = /<li[^>]*data-hw="([^"]+)"[^>]*data-oxford_phrase_list="([a-c][12])"/g;
  let m;
  while ((m = re.exec(html))) {
    const level = m[2].toUpperCase();
    if (level !== 'B2' && level !== 'C1') continue;
    out.push({ headword: normalizeHeadword(m[1]), source: 'opl', rank: null, band: null, level, frequency: null, genre: null, example: null });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const phrase = parsePhraseDoc(fs.readFileSync('data/raw/phrase.txt', 'utf8'));
  const opl = parseOpl(fs.readFileSync('data/raw/opl.html', 'utf8'));
  const seen = new Set(phrase.map((p) => p.headword));
  const merged = [...phrase, ...opl.filter((e) => !seen.has(e.headword))];
  fs.writeFileSync('data/expr.json', JSON.stringify(merged, null, 1));
  console.log(`phrase: ${phrase.length}, opl b2+c1: ${opl.length}, expr total: ${merged.length}`);
}
```

- [ ] **Step 8: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Прогнать импорт на реальных данных и проверить счётчики**

```bash
node scripts/import-oxford.mjs && node scripts/import-phave.mjs && node scripts/import-phrase.mjs
```
Expected: `words: 2975` (1571 + 1404), `pv: 150` и senses около 244, `phrase: 505`. Если `phrase` меньше 500, открыть `data/raw/phrase.txt` вокруг пропущенного ранга и расширить регулярку фразы (например, фразы с цифрами или апострофом другого вида), добавить кейс в фикстуру.

- [ ] **Step 10: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/data/raw english-tutor/data/words.json english-tutor/data/pv.json english-tutor/data/expr.json english-tutor/scripts/import-oxford.mjs english-tutor/scripts/import-phave.mjs english-tutor/scripts/import-phrase.mjs english-tutor/src/normalize.mjs english-tutor/tests/import.test.mjs english-tutor/tests/fixtures
git commit -m "feat(english-tutor): импорт Oxford 5000 B2-C1, PHaVE, PHRASE и Oxford Phrase List

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Разметка корней, семей и близнецов (LLM, с кэшем)

**Files:**
- Create: `english-tutor/prompts/roots.md`, `english-tutor/scripts/tag-roots.mjs`, `english-tutor/data/roots.json`
- Test: `english-tutor/tests/tag-roots.test.mjs`

**Interfaces:**
- Produces: `data/roots.json: { "<headword>|<pos>": {root, root_meaning_ru, family_key, twin, twin_note_ru} }`; `parseRootsReply(text) -> array`, `mergeRoots(cache, replies) -> cache`, `batches(words, size) -> [[...]]`.
- Запуск через локальный `claude -p` (эта машина залогинена). Кэш: пропускает уже размеченные ключи, поэтому перезапуск дописывает только недостающие.

- [ ] **Step 1: prompts/roots.md**

```
Для каждого английского слова из списка верни JSON-объект. Ответ: только JSON-массив, без текста вокруг и без markdown-ограждений.
Поля объекта:
- "word": слово ровно как в списке
- "pos": часть речи ровно как в списке
- "root": латинский или греческий корень в словарной форме ("spect", "dict", "port", "graph"), либо null, если слово германское или корень непрозрачен
- "root_meaning_ru": значение корня по-русски, либо null
- "family_key": ключ семьи для группировки однокоренных слов: корень, если он есть, иначе базовое слово семьи (для "decisive" это "decide"), иначе null
- "twin": английское слово с тем же обычным русским переводом, которое ученик уровня B1-B2 скорее всего знает и путает с этим (для "large" это "big"), либо null
- "twin_note_ru": одна фраза, чем слово отличается от близнеца (регистр, сочетаемость, грамматика, оттенок), либо null
Не выдумывай корни для германских слов (bleak, grin, slap): там root = null. Если сомневаешься, ставь null.

Слова (word | pos):
{{words}}
```

- [ ] **Step 2: Тест**

`tests/tag-roots.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRootsReply, mergeRoots, batches, rootKey } from '../scripts/tag-roots.mjs';

test('parseRootsReply снимает ограждения и парсит массив', () => {
  const out = parseRootsReply('```json\n[{"word":"inspect","pos":"verb","root":"spect","root_meaning_ru":"смотреть","family_key":"spect","twin":null,"twin_note_ru":null}]\n```');
  assert.equal(out.length, 1);
  assert.equal(out[0].root, 'spect');
});

test('mergeRoots кладёт по ключу word|pos и не трогает существующие', () => {
  const cache = { 'inspect|verb': { root: 'spect' } };
  const merged = mergeRoots(cache, [{ word: 'inspect', pos: 'verb', root: 'x' }, { word: 'bleak', pos: 'adjective', root: null }]);
  assert.equal(merged['inspect|verb'].root, 'spect');
  assert.equal(merged['bleak|adjective'].root, null);
});

test('batches режет по размеру, rootKey', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(rootKey({ headword: 'Inspect', pos: 'verb' }), 'inspect|verb');
});
```

- [ ] **Step 3: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, нет модуля `../scripts/tag-roots.mjs`.

- [ ] **Step 4: tag-roots.mjs**

```js
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const rootKey = (w) => `${String(w.headword).toLowerCase()}|${w.pos}`;

export function batches(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function parseRootsReply(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error('в ответе нет JSON-массива');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function mergeRoots(cache, replies) {
  const out = { ...cache };
  for (const r of replies) {
    const key = `${String(r.word).toLowerCase()}|${r.pos}`;
    if (out[key]) continue;
    out[key] = {
      root: r.root ?? null,
      root_meaning_ru: r.root_meaning_ru ?? null,
      family_key: r.family_key ?? null,
      twin: r.twin ?? null,
      twin_note_ru: r.twin_note_ru ?? null
    };
  }
  return out;
}

function askClaude(prompt) {
  const r = spawnSync(process.env.CLAUDE_BIN || 'claude', [
    '-p', prompt, '--output-format', 'json', '--model', process.env.CLAUDE_MODEL || 'claude-opus-5',
    '--no-session-persistence', '--max-turns', '1'
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 240000 });
  if (r.status !== 0) throw new Error(`claude exit ${r.status}: ${(r.stderr || '').slice(0, 500)}`);
  const json = JSON.parse(r.stdout);
  if (json.is_error) throw new Error(`claude error: ${String(json.result).slice(0, 500)}`);
  return json.result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
  const cachePath = 'data/roots.json';
  let cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  const template = fs.readFileSync('prompts/roots.md', 'utf8');
  const todo = words.filter((w) => !cache[rootKey(w)]);
  console.log(`всего ${words.length}, размечено ${words.length - todo.length}, осталось ${todo.length}`);
  for (const [i, batch] of batches(todo, 40).entries()) {
    const list = batch.map((w) => `${w.headword} | ${w.pos}`).join('\n');
    const prompt = template.replace('{{words}}', list);
    let replies;
    try {
      replies = parseRootsReply(askClaude(prompt));
    } catch (e) {
      console.error(`батч ${i}: ${e.message}; повтор`);
      replies = parseRootsReply(askClaude(prompt));
    }
    cache = mergeRoots(cache, replies);
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1));
    console.log(`батч ${i + 1}/${Math.ceil(todo.length / 40)}: +${replies.length}`);
  }
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Прогнать разметку (фон, около 30-40 минут, 75 вызовов Opus последовательно)**

```bash
cd /Users/evd3v/Projects/personal/english-tutor && node scripts/tag-roots.mjs 2>&1 | tee /tmp/tag-roots.log
```
Запускать в фоне (`run_in_background`), пока идут Task 4-8; перед Task 4 нужен только формат, не полнота. Проверка по завершении:
```bash
node -e "const r=require('./data/roots.json'); const v=Object.values(r); console.log('всего', v.length, 'с корнем', v.filter(x=>x.root).length, 'с близнецом', v.filter(x=>x.twin).length)"
```
Expected: всего 2975; с корнем примерно 1500-2000; с близнецом несколько сотен. Если какие-то слова не размечены (`осталось > 0` при повторном запуске), перезапустить, скрипт дописывает только недостающие.

- [ ] **Step 7: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/prompts/roots.md english-tutor/scripts/tag-roots.mjs english-tutor/tests/tag-roots.test.mjs english-tutor/data/roots.json
git commit -m "feat(english-tutor): разметка корней, семей и близнецов через claude -p с кэшем

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(`data/roots.json` коммитить после завершения прогона; если прогон ещё идёт, закоммитить скрипт и тест сейчас, а данные отдельным коммитом позже.)

---

### Task 4: Сборка очереди и сид базы

**Files:**
- Create: `english-tutor/scripts/build-queue.mjs`, `english-tutor/scripts/seed.mjs`, `english-tutor/data/queue.json`
- Test: `english-tutor/tests/build-queue.test.mjs`, `english-tutor/tests/seed.test.mjs`

**Interfaces:**
- Produces: `buildQueue({words, pv, expr, roots}) -> [{kind, headword, pos, level, group_key, group_label, source}]` (порядок = order_index); `seed(db, queue) -> {inserted, skipped}` (идемпотентно по `kind+headword+pos`).
- `source` для `word`: `{definition, example, examples, phon, root, root_meaning_ru, family: [headwords], twin, twin_note_ru}`; для `pv`: `{verb, particle, rank, senses}`; для `expr`: `{origin:'phrase'|'opl', rank, band, level, frequency, genre, example}`.

- [ ] **Step 1: Тест build-queue**

`tests/build-queue.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, groupWords, interleave } from '../scripts/build-queue.mjs';

const w = (headword, level = 'B2', pos = 'verb') => ({ headword, pos, level, definition: 'd', example: 'e', examples: ['e'], phon: '' });

test('groupWords: модули по family_key, крупные первыми, одиночки отдельно', () => {
  const words = [w('inspect'), w('respect'), w('prospect', 'C1'), w('decide'), w('decisive', 'C1', 'adjective'), w('bleak', 'C1', 'adjective')];
  const roots = {
    'inspect|verb': { family_key: 'spect', root: 'spect' }, 'respect|verb': { family_key: 'spect', root: 'spect' },
    'prospect|verb': { family_key: 'spect', root: 'spect' }, 'decide|verb': { family_key: 'decide', root: 'cid' },
    'decisive|adjective': { family_key: 'decide', root: 'cid' }, 'bleak|adjective': { family_key: null, root: null }
  };
  const { modules, singles } = groupWords(words, roots);
  assert.deepEqual(modules.map((m) => m.key), ['spect', 'decide']);
  assert.deepEqual(modules[0].items.map((i) => i.headword), ['inspect', 'respect', 'prospect']);
  assert.deepEqual(singles.map((s) => s.headword), ['bleak']);
});

test('interleave держит пропорцию 6:2:2 и дожимает хвосты', () => {
  const a = Array.from({ length: 12 }, (_, i) => `w${i}`);
  const b = ['p0', 'p1', 'p2'];
  const c = ['e0', 'e1'];
  const out = interleave([[a, 6], [b, 2], [c, 2]]);
  assert.deepEqual(out.slice(0, 10), ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'p0', 'p1', 'e0', 'e1']);
  assert.equal(out.length, 17);
  assert.deepEqual(out.slice(-3), ['w10', 'w11', 'p2']);
});

test('buildQueue детерминирована и заполняет source', () => {
  const input = {
    words: [w('inspect'), w('respect'), w('bleak', 'C1', 'adjective')],
    pv: [{ headword: 'go on', verb: 'go', particle: 'on', rank: 1, senses: [{ n: 1, meaning: 'happen', percent: 64.5, example: 'x' }] }],
    expr: [{ headword: 'in terms of', source: 'phrase', rank: 1201, band: 2, level: null, frequency: 9800, genre: { spoken: 1, written: 2, academic: 3 }, example: 'y' }],
    roots: { 'inspect|verb': { family_key: 'spect', root: 'spect', root_meaning_ru: 'смотреть', twin: null, twin_note_ru: null }, 'respect|verb': { family_key: 'spect', root: 'spect', root_meaning_ru: 'смотреть', twin: 'honour', twin_note_ru: 'z' } }
  };
  const q1 = buildQueue(input);
  const q2 = buildQueue(input);
  assert.deepEqual(q1, q2);
  const inspect = q1.find((i) => i.headword === 'inspect');
  assert.equal(inspect.kind, 'word');
  assert.equal(inspect.group_key, 'spect');
  assert.deepEqual(inspect.source.family, ['respect']);
  const pv = q1.find((i) => i.kind === 'pv');
  assert.equal(pv.group_key, 'on');
  assert.equal(pv.group_label, 'частица on');
  const ex = q1.find((i) => i.kind === 'expr');
  assert.equal(ex.source.origin, 'phrase');
  assert.equal(ex.group_key, 'band-2');
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, нет `../scripts/build-queue.mjs`.

- [ ] **Step 3: build-queue.mjs**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const byLevelThenName = (a, b) => (a.level === b.level ? a.headword.localeCompare(b.headword) : a.level.localeCompare(b.level));

export function groupWords(words, roots) {
  const groups = new Map();
  const singles = [];
  for (const w of words) {
    const tag = roots[`${w.headword}|${w.pos}`] || {};
    const key = tag.family_key || null;
    if (!key) { singles.push(w); continue; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  const modules = [];
  for (const [key, items] of groups) {
    if (items.length < 2) { singles.push(...items); continue; }
    items.sort(byLevelThenName);
    modules.push({ key, items });
  }
  modules.sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
  singles.sort(byLevelThenName);
  return { modules, singles };
}

export function interleave(streams) {
  const queues = streams.map(([items, n]) => ({ items: [...items], n }));
  const out = [];
  while (queues.some((q) => q.items.length)) {
    for (const q of queues) out.push(...q.items.splice(0, q.n));
  }
  return out;
}

function wordStream(words, roots) {
  const { modules, singles } = groupWords(words, roots);
  const rest = [...singles];
  const out = [];
  for (const m of modules) {
    for (const w of m.items) out.push(toWordItem(w, roots, m));
    for (const s of rest.splice(0, Math.ceil(m.items.length / 2))) out.push(toWordItem(s, roots, null));
  }
  for (const s of rest) out.push(toWordItem(s, roots, null));
  return out;
}

function toWordItem(w, roots, module) {
  const tag = roots[`${w.headword}|${w.pos}`] || {};
  const family = module ? module.items.filter((x) => x.headword !== w.headword).map((x) => x.headword) : [];
  return {
    kind: 'word', headword: w.headword, pos: w.pos, level: w.level,
    group_key: module ? module.key : null,
    group_label: module ? (tag.root ? `корень ${tag.root}` : `семья ${module.key}`) : null,
    source: {
      definition: w.definition, example: w.example, examples: w.examples, phon: w.phon,
      root: tag.root ?? null, root_meaning_ru: tag.root_meaning_ru ?? null, family,
      twin: tag.twin ?? null, twin_note_ru: tag.twin_note_ru ?? null
    }
  };
}

function pvStream(pv) {
  const byParticle = new Map();
  for (const p of pv) {
    if (!byParticle.has(p.particle)) byParticle.set(p.particle, []);
    byParticle.get(p.particle).push(p);
  }
  const groups = [...byParticle.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const out = [];
  for (const [particle, items] of groups) {
    items.sort((a, b) => a.rank - b.rank);
    for (const p of items) out.push({
      kind: 'pv', headword: p.headword, pos: 'phrasal verb', level: '',
      group_key: particle, group_label: `частица ${particle}`,
      source: { verb: p.verb, particle: p.particle, rank: p.rank, senses: p.senses }
    });
  }
  return out;
}

function exprStream(expr) {
  const phrase = expr.filter((e) => e.source === 'phrase').sort((a, b) => a.rank - b.rank);
  const opl = expr.filter((e) => e.source === 'opl').sort((a, b) => a.level.localeCompare(b.level) || a.headword.localeCompare(b.headword));
  return [...phrase, ...opl].map((e) => ({
    kind: 'expr', headword: e.headword, pos: 'expression', level: e.level || '',
    group_key: e.source === 'phrase' ? `band-${e.band}` : `opl-${e.level.toLowerCase()}`,
    group_label: e.source === 'phrase' ? `частотная полоса ${e.band}K` : `Oxford Phrase List ${e.level}`,
    source: { origin: e.source, rank: e.rank, band: e.band, level: e.level, frequency: e.frequency, genre: e.genre, example: e.example }
  }));
}

export function buildQueue({ words, pv, expr, roots }) {
  return interleave([[wordStream(words, roots), 6], [pvStream(pv), 2], [exprStream(expr), 2]]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const queue = buildQueue({ words: read('data/words.json'), pv: read('data/pv.json'), expr: read('data/expr.json'), roots: read('data/roots.json') });
  fs.writeFileSync('data/queue.json', JSON.stringify(queue, null, 1));
  const n = (k) => queue.filter((i) => i.kind === k).length;
  console.log(`queue: ${queue.length} (word ${n('word')}, pv ${n('pv')}, expr ${n('expr')})`);
}
```

- [ ] **Step 4: Тест seed**

`tests/seed.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';

const item = (headword, kind = 'word') => ({ kind, headword, pos: 'verb', level: 'B2', group_key: null, group_label: null, source: { definition: 'd' } });

test('seed вставляет по порядку и идемпотентен', () => {
  const db = openDb(':memory:');
  const r1 = seed(db, [item('inspect'), item('respect')]);
  assert.deepEqual(r1, { inserted: 2, skipped: 0 });
  const r2 = seed(db, [item('inspect'), item('respect'), item('bleak')]);
  assert.deepEqual(r2, { inserted: 1, skipped: 2 });
  const rows = db.prepare('SELECT headword, order_index, status, source_json FROM cards ORDER BY order_index').all();
  assert.deepEqual(rows.map((r) => [r.headword, r.order_index, r.status]), [['inspect', 0, 'queued'], ['respect', 1, 'queued'], ['bleak', 2, 'queued']]);
  assert.equal(JSON.parse(rows[0].source_json).definition, 'd');
});
```

- [ ] **Step 5: seed.mjs**

```js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.mjs';

export function seed(db, queue) {
  const insert = db.prepare(`INSERT INTO cards (kind, headword, pos, level, source_json, group_key, group_label, order_index)
    VALUES (@kind, @headword, @pos, @level, @source_json, @group_key, @group_label, @order_index)
    ON CONFLICT(kind, headword, pos) DO NOTHING`);
  let inserted = 0;
  let skipped = 0;
  db.exec('BEGIN');
  try {
    queue.forEach((item, order_index) => {
      const r = insert.run({
        kind: item.kind, headword: item.headword, pos: item.pos || '', level: item.level || '',
        source_json: JSON.stringify(item.source), group_key: item.group_key, group_label: item.group_label, order_index
      });
      if (r.changes) inserted++; else skipped++;
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { inserted, skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb(process.env.DB_PATH || 'data-db/tutor.sqlite');
  const queue = JSON.parse(fs.readFileSync(new URL('../data/queue.json', import.meta.url), 'utf8'));
  console.log(seed(db, queue));
}
```

- [ ] **Step 6: Запустить тесты, собрать очередь**

Run: `npm test` → PASS. Затем (после завершения Task 3 Step 6): `node scripts/build-queue.mjs` → `queue: ~3800 (word 2975, pv 150, expr ~700)`. Проверить первые 12 строк: `node -e "require('./data/queue.json').slice(0,12).forEach(i=>console.log(i.kind,i.headword,i.group_label))"` → 6 слов одного корня, 2 фразовых с одной частицей, 2 выражения.

- [ ] **Step 7: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/scripts/build-queue.mjs english-tutor/scripts/seed.mjs english-tutor/tests/build-queue.test.mjs english-tutor/tests/seed.test.mjs english-tutor/data/queue.json
git commit -m "feat(english-tutor): очередь по корням, частицам и полосам, сид базы

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Логика очереди: next, pending, решения, статус, список

**Files:**
- Create: `english-tutor/src/queue.mjs`
- Test: `english-tutor/tests/queue.test.mjs`

**Interfaces:**
- Consumes: `openDb`, `getSetting/setSetting/httpError/nowIso` (Task 1), `emptyFsrsFields/isMature` (Task 1), `seed` (Task 4).
- Produces: `hydrate(row) -> card` (поле `source` вместо `source_json`), `getCard(db,id)`, `nextCard(db,{kind,now}) -> card|null`, `pendingCard(db) -> card|null`, `resolveId(db, idOrPending) -> number`, `decide(db,id,'learn'|'known'|'discuss',now) -> card`, `suspend(db,id) -> card`, `setExplanation(db,id,md) -> card`, `addNote(db,id,text,now) -> note`, `listCards(db,{status,kind,q,limit,offset}) -> [{id,kind,headword,pos,level,status,group_label,fsrs_due,fsrs_scheduled_days}]`, `cardDetails(db,id) -> {card, notes, history}`, `status(db, now) -> {word,pv,expr,all: counters, streak, pending}` где counters = `{total,queued,shown,learning,learned,known,suspended,due_today}`, `localDay(date) -> 'YYYY-MM-DD'`.

- [ ] **Step 1: Тест**

`tests/queue.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getSetting } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';
import { nextCard, pendingCard, decide, status, listCards, setExplanation, addNote, cardDetails, suspend, resolveId, localDay } from '../src/queue.mjs';

const item = (headword, kind = 'word', pos = 'verb') => ({ kind, headword, pos, level: 'B2', group_key: null, group_label: null, source: { definition: 'd', example: 'e' } });
function fresh() {
  const db = openDb(':memory:');
  seed(db, [item('inspect'), item('respect'), item('go on', 'pv', 'phrasal verb'), item('in terms of', 'expr', 'expression')]);
  return db;
}

test('nextCard идёт по order_index, ставит shown и pending', () => {
  const db = fresh();
  const c1 = nextCard(db, { now: '2026-09-13T10:00:00.000Z' });
  assert.equal(c1.headword, 'inspect');
  assert.equal(c1.status, 'shown');
  assert.equal(c1.shown_at, '2026-09-13T10:00:00.000Z');
  assert.deepEqual(c1.source, { definition: 'd', example: 'e' });
  assert.equal(pendingCard(db).id, c1.id);
  const c2 = nextCard(db, { kind: 'pv' });
  assert.equal(c2.headword, 'go on');
  assert.equal(pendingCard(db).id, c2.id);
  assert.equal(getSetting(db, 'pending_card_id'), String(c2.id));
});

test('nextCard возвращает null, когда очередь пуста', () => {
  const db = openDb(':memory:');
  assert.equal(nextCard(db), null);
});

test('decide learn: FSRS new, pending очищается; known; discuss', () => {
  const db = fresh();
  const c = nextCard(db);
  const learned = decide(db, c.id, 'learn', '2026-09-13T10:00:00.000Z');
  assert.equal(learned.status, 'learning');
  assert.equal(learned.fsrs_state, 0);
  assert.equal(learned.fsrs_due, '2026-09-13T10:00:00.000Z');
  assert.equal(pendingCard(db), null);
  const c2 = nextCard(db);
  assert.equal(decide(db, c2.id, 'discuss').status, 'discussing');
  assert.equal(pendingCard(db).id, c2.id, 'discuss не снимает pending');
  assert.equal(decide(db, c2.id, 'known').status, 'known');
  assert.throws(() => decide(db, c2.id, 'discuss'), /нельзя/);
  assert.throws(() => decide(db, 999, 'learn'), /не найдена/);
});

test('resolveId: pending или число', () => {
  const db = fresh();
  assert.throws(() => resolveId(db, 'pending'), /нет текущего/);
  const c = nextCard(db);
  assert.equal(resolveId(db, 'pending'), c.id);
  assert.equal(resolveId(db, undefined), c.id);
  assert.equal(resolveId(db, '7'), 7);
});

test('status считает по потокам и сумме, due_today, learned по порогу', () => {
  const db = fresh();
  const c = nextCard(db);
  decide(db, c.id, 'learn', '2026-09-13T10:00:00.000Z');
  db.prepare(`UPDATE cards SET fsrs_state = 2, fsrs_scheduled_days = 30, fsrs_due = '2027-01-01T00:00:00.000Z' WHERE headword = 'respect'`).run();
  db.prepare(`UPDATE cards SET status = 'learning' WHERE headword = 'respect'`).run();
  const s = status(db, new Date('2026-09-13T12:00:00.000Z'));
  assert.equal(s.all.total, 4);
  assert.equal(s.all.learning, 1);
  assert.equal(s.all.learned, 1);
  assert.equal(s.all.queued, 2);
  assert.equal(s.all.due_today, 1);
  assert.equal(s.word.total, 2);
  assert.equal(s.pv.queued, 1);
  assert.equal(s.streak, 0);
  assert.equal(s.pending, null);
});

test('streak считает подряд идущие дни с повторениями', () => {
  const db = fresh();
  const c = nextCard(db);
  decide(db, c.id, 'learn');
  const ins = db.prepare('INSERT INTO review_log(card_id, ts, rating) VALUES (?, ?, 3)');
  ins.run(c.id, '2026-09-11T09:00:00.000Z');
  ins.run(c.id, '2026-09-12T09:00:00.000Z');
  assert.equal(status(db, new Date('2026-09-12T20:00:00.000Z')).streak, 2);
  assert.equal(status(db, new Date('2026-09-13T20:00:00.000Z')).streak, 2, 'сегодня ещё не повторял, серия жива');
  assert.equal(status(db, new Date('2026-09-15T20:00:00.000Z')).streak, 0);
  assert.equal(localDay(new Date('2026-09-12T09:00:00.000Z')).length, 10);
});

test('setExplanation, addNote, cardDetails, suspend, listCards', () => {
  const db = fresh();
  const c = nextCard(db);
  assert.equal(setExplanation(db, c.id, '**inspect** разбор').explanation_md, '**inspect** разбор');
  const n = addNote(db, c.id, 'in- внутрь', '2026-09-13T10:00:00.000Z');
  assert.equal(n.text, 'in- внутрь');
  const d = cardDetails(db, c.id);
  assert.equal(d.card.headword, 'inspect');
  assert.equal(d.notes.length, 1);
  assert.deepEqual(d.history, []);
  decide(db, c.id, 'learn');
  assert.equal(suspend(db, c.id).status, 'suspended');
  const list = listCards(db, { status: 'queued', kind: 'word' });
  assert.deepEqual(list.map((x) => x.headword), ['respect']);
  assert.equal(listCards(db, { q: 'terms' })[0].headword, 'in terms of');
  assert.equal(listCards(db, {}).length, 4);
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, нет `../src/queue.mjs`.

- [ ] **Step 3: queue.mjs**

```js
import { nowIso, getSetting, setSetting, httpError } from './db.mjs';
import { emptyFsrsFields, isMature } from './fsrs.mjs';

export const KINDS = ['word', 'pv', 'expr'];

export function hydrate(row) {
  if (!row) return null;
  const { source_json, ...rest } = row;
  return { ...rest, source: JSON.parse(source_json) };
}

export function getCard(db, id) {
  return hydrate(db.prepare('SELECT * FROM cards WHERE id = ?').get(Number(id)));
}

export function nextCard(db, { kind = null, now = nowIso() } = {}) {
  if (kind && !KINDS.includes(kind)) throw httpError(400, 'kind должен быть word, pv или expr');
  const row = kind
    ? db.prepare(`SELECT id FROM cards WHERE status = 'queued' AND kind = ? ORDER BY order_index LIMIT 1`).get(kind)
    : db.prepare(`SELECT id FROM cards WHERE status = 'queued' ORDER BY order_index LIMIT 1`).get();
  if (!row) return null;
  db.prepare(`UPDATE cards SET status = 'shown', shown_at = ? WHERE id = ?`).run(now, row.id);
  setSetting(db, 'pending_card_id', String(row.id));
  return getCard(db, row.id);
}

export function pendingCard(db) {
  const id = getSetting(db, 'pending_card_id');
  return id ? getCard(db, Number(id)) : null;
}

export function resolveId(db, id) {
  if (id === undefined || id === null || id === '' || id === 'pending' || id === 'current') {
    const p = pendingCard(db);
    if (!p) throw httpError(404, 'нет текущего элемента: сначала /next');
    return p.id;
  }
  const n = Number(id);
  if (!Number.isInteger(n)) throw httpError(400, 'id должен быть числом');
  return n;
}

const ALLOWED = {
  learn: ['shown', 'discussing', 'queued', 'known', 'suspended'],
  known: ['shown', 'discussing', 'queued', 'learning', 'suspended'],
  discuss: ['shown', 'discussing']
};

export function decide(db, id, decision, now = nowIso()) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  if (!ALLOWED[decision]) throw httpError(400, 'неизвестное решение');
  if (!ALLOWED[decision].includes(card.status)) throw httpError(409, `нельзя ${decision} из статуса ${card.status}`);
  if (decision === 'learn') {
    const f = emptyFsrsFields(new Date(now));
    db.prepare(`UPDATE cards SET status = 'learning', decided_at = @now,
      fsrs_due = @fsrs_due, fsrs_stability = @fsrs_stability, fsrs_difficulty = @fsrs_difficulty,
      fsrs_elapsed_days = @fsrs_elapsed_days, fsrs_scheduled_days = @fsrs_scheduled_days, fsrs_reps = @fsrs_reps,
      fsrs_lapses = @fsrs_lapses, fsrs_learning_steps = @fsrs_learning_steps, fsrs_state = @fsrs_state,
      fsrs_last_review = @fsrs_last_review WHERE id = @id`).run({ ...f, now, id: card.id });
  } else if (decision === 'known') {
    db.prepare(`UPDATE cards SET status = 'known', decided_at = ? WHERE id = ?`).run(now, card.id);
  } else {
    db.prepare(`UPDATE cards SET status = 'discussing' WHERE id = ?`).run(card.id);
  }
  if (decision !== 'discuss' && getSetting(db, 'pending_card_id') === String(card.id)) setSetting(db, 'pending_card_id', '');
  return getCard(db, card.id);
}

export function suspend(db, id) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  db.prepare(`UPDATE cards SET status = 'suspended' WHERE id = ?`).run(card.id);
  return getCard(db, card.id);
}

export function setExplanation(db, id, md) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  const text = String(md || '').trim();
  if (text.length < 20) throw httpError(422, 'разбор слишком короткий');
  db.prepare('UPDATE cards SET explanation_md = ? WHERE id = ?').run(text, card.id);
  return getCard(db, card.id);
}

export function addNote(db, id, text, now = nowIso()) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  const t = String(text || '').trim();
  if (!t) throw httpError(422, 'пустая заметка');
  const r = db.prepare('INSERT INTO notes(card_id, ts, text) VALUES (?, ?, ?)').run(card.id, now, t);
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(r.lastInsertRowid));
}

export function cardDetails(db, id) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  const notes = db.prepare('SELECT * FROM notes WHERE card_id = ? ORDER BY id').all(card.id);
  const history = db.prepare('SELECT ts, rating, test_type, sentence, answer, scheduled_days FROM review_log WHERE card_id = ? ORDER BY id').all(card.id);
  return { card, notes, history };
}

export function listCards(db, { status = null, kind = null, q = null, limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = {};
  if (status) { where.push('status = @status'); params.status = status; }
  if (kind) { where.push('kind = @kind'); params.kind = kind; }
  if (q) { where.push('headword LIKE @q'); params.q = `%${String(q).toLowerCase()}%`; }
  const sql = `SELECT id, kind, headword, pos, level, status, group_label, fsrs_due, fsrs_scheduled_days, fsrs_state, order_index
    FROM cards ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY order_index LIMIT @limit OFFSET @offset`;
  return db.prepare(sql).all({ ...params, limit: Number(limit), offset: Number(offset) });
}

export function localDay(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: process.env.TZ || 'Europe/Moscow' });
}

export function streakDays(db, now = new Date()) {
  const days = new Set(db.prepare('SELECT ts FROM review_log').all().map((r) => localDay(r.ts)));
  if (!days.size) return 0;
  let cursor = new Date(now);
  if (!days.has(localDay(cursor))) cursor = new Date(cursor.getTime() - 86400e3);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400e3);
  }
  return streak;
}

export function status(db, now = new Date()) {
  const rows = db.prepare('SELECT kind, status, fsrs_state, fsrs_scheduled_days, fsrs_due FROM cards').all();
  const today = localDay(now);
  const mk = () => ({ total: 0, queued: 0, shown: 0, learning: 0, learned: 0, known: 0, suspended: 0, due_today: 0 });
  const by = { word: mk(), pv: mk(), expr: mk(), all: mk() };
  for (const r of rows) {
    for (const b of [by[r.kind], by.all]) {
      b.total++;
      if (r.status === 'queued') b.queued++;
      else if (r.status === 'shown' || r.status === 'discussing') b.shown++;
      else if (r.status === 'known') b.known++;
      else if (r.status === 'suspended') b.suspended++;
      else if (r.status === 'learning') {
        if (isMature(r)) b.learned++; else b.learning++;
        if (r.fsrs_due && localDay(r.fsrs_due) <= today) b.due_today++;
      }
    }
  }
  return { ...by, streak: streakDays(db, now), pending: pendingCard(db) };
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/src/queue.mjs english-tutor/tests/queue.test.mjs
git commit -m "feat(english-tutor): очередь, текущий элемент, решения и статус

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Повторение: выбор карточки, тип теста, валидация предложения, оценка

**Files:**
- Create: `english-tutor/src/review.mjs`
- Test: `english-tutor/tests/review.test.mjs`

**Interfaces:**
- Consumes: `applyRating` (Task 1), `getCard/hydrate` (Task 5), `getSetting/setSetting/httpError/nowIso` (Task 1).
- Produces: `pickDueCard(db, nowIso) -> row|null`, `requiredTestType(db, card) -> 'context'|'cloze'`, `recentSentences(db, cardId) -> string[]`, `containsHeadword(card, sentence) -> boolean`, `validateSentence(card, {type,sentence,answer}, history) -> string[]` (пустой массив = ок), `addTest(db, cardId, {type,sentence,answer}, nowIso) -> testRow`, `reviewNext(db, nowIso) -> {card, test|null, wanted_type, left_today, history} | null` (запоминает `review_card_id` и `review_test_id` в settings), `grade(db, cardId, rating, testId, now) -> {card, due, scheduled_days}`, `currentReview(db) -> {cardId, testId}`.

- [ ] **Step 1: Тест**

`tests/review.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getSetting } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';
import { nextCard, decide } from '../src/queue.mjs';
import { pickDueCard, requiredTestType, containsHeadword, validateSentence, addTest, reviewNext, grade, recentSentences } from '../src/review.mjs';

const item = (headword, kind = 'word', pos = 'verb', source = { definition: 'd', example: 'The mechanic inspected the engine.' }) =>
  ({ kind, headword, pos, level: 'B2', group_key: null, group_label: null, source });

function learningDb() {
  const db = openDb(':memory:');
  seed(db, [item('inspect'), item('go on', 'pv', 'phrasal verb', { verb: 'go', particle: 'on', senses: [] }), item('bleak', 'word', 'adjective')]);
  for (const _ of [1, 2, 3]) decide(db, nextCard(db).id, 'learn', '2026-09-10T10:00:00.000Z');
  return db;
}

test('containsHeadword: словоформы, неправильные глаголы, плейсхолдеры', () => {
  assert.equal(containsHeadword({ headword: 'inspect' }, 'She inspected the room carefully.'), true);
  assert.equal(containsHeadword({ headword: 'inspect' }, 'She looked at the room.'), false);
  assert.equal(containsHeadword({ headword: 'go on' }, 'What went on there last night?'), true);
  assert.equal(containsHeadword({ headword: 'look for sb/sth' }, 'I am looking for my keys.'), true);
  assert.equal(containsHeadword({ headword: 'heritage' }, 'Their cultural heritage is rich.'), true);
  assert.equal(containsHeadword({ headword: 'happy' }, 'They lived happily.'), true);
});

test('validateSentence: длина, заголовок, повтор, пример источника, cloze', () => {
  const card = { headword: 'inspect', source: { example: 'The mechanic inspected the engine.' } };
  const ok = 'Before buying the flat, we hired an expert to inspect the wiring and the roof.';
  assert.deepEqual(validateSentence(card, { type: 'context', sentence: ok, answer: 'осматривать / examine' }, []), []);
  assert.deepEqual(validateSentence(card, { type: 'context', sentence: 'Inspect it now.', answer: 'x' }, []), ['length 3']);
  assert.deepEqual(validateSentence(card, { type: 'context', sentence: 'Before buying the flat we hired an expert to check the wiring and the roof.', answer: 'x' }, []), ['headword']);
  assert.deepEqual(validateSentence(card, { type: 'context', sentence: ok, answer: 'x' }, [ok.toUpperCase()]), ['repeat']);
  assert.deepEqual(validateSentence(card, { type: 'context', sentence: 'The mechanic inspected the engine and found nothing wrong with it at all.', answer: 'x' }, []), []);
  assert.deepEqual(validateSentence(card, { type: 'context', sentence: card.source.example, answer: 'x' }, []), ['length 5', 'source-example']);
  assert.deepEqual(validateSentence(card, { type: 'cloze', sentence: 'Before buying the flat, we hired an expert to _____ the wiring and the roof. (осмотреть)', answer: 'inspect' }, []), []);
  assert.deepEqual(validateSentence(card, { type: 'cloze', sentence: 'Before buying the flat, we hired an expert to inspect the wiring and the roof.', answer: 'inspect' }, []), ['gap', 'cloze-has-headword']);
  assert.deepEqual(validateSentence(card, { type: 'other', sentence: ok, answer: '' }, []), ['type', 'answer']);
});

test('pickDueCard берёт самую просроченную, requiredTestType чередует после 3 повторов', () => {
  const db = learningDb();
  db.prepare(`UPDATE cards SET fsrs_due = '2026-09-12T00:00:00.000Z' WHERE headword = 'bleak'`).run();
  db.prepare(`UPDATE cards SET fsrs_due = '2026-09-11T00:00:00.000Z' WHERE headword = 'inspect'`).run();
  db.prepare(`UPDATE cards SET fsrs_due = '2027-01-01T00:00:00.000Z' WHERE headword = 'go on'`).run();
  const row = pickDueCard(db, '2026-09-13T00:00:00.000Z');
  assert.equal(row.headword, 'inspect');
  assert.equal(requiredTestType(db, row), 'context');
  db.prepare(`UPDATE cards SET fsrs_reps = 3 WHERE id = ?`).run(row.id);
  assert.equal(requiredTestType(db, { ...row, fsrs_reps: 3 }), 'context', 'без истории всё ещё context');
  db.prepare(`INSERT INTO review_log(card_id, ts, rating, test_type) VALUES (?, '2026-09-12T00:00:00.000Z', 3, 'context')`).run(row.id);
  assert.equal(requiredTestType(db, { ...row, fsrs_reps: 3 }), 'cloze');
  db.prepare(`INSERT INTO review_log(card_id, ts, rating, test_type) VALUES (?, '2026-09-12T01:00:00.000Z', 3, 'cloze')`).run(row.id);
  assert.equal(requiredTestType(db, { ...row, fsrs_reps: 4 }), 'context');
});

test('addTest валидирует, reviewNext отдаёт запас, grade двигает FSRS и списывает тест', () => {
  const db = learningDb();
  const card = db.prepare(`SELECT * FROM cards WHERE headword = 'inspect'`).get();
  assert.throws(() => addTest(db, card.id, { type: 'context', sentence: 'Too short.', answer: 'x' }), /не прошло проверку/);
  const t = addTest(db, card.id, { type: 'context', sentence: 'Before buying the flat, we hired an expert to inspect the wiring and the roof.', answer: 'осматривать / examine' }, '2026-09-13T09:00:00.000Z');
  assert.equal(t.used_at, null);
  db.prepare(`UPDATE cards SET fsrs_due = '2026-09-13T00:00:00.000Z' WHERE id = ?`).run(card.id);
  db.prepare(`UPDATE cards SET fsrs_due = '2027-01-01T00:00:00.000Z' WHERE id != ?`).run(card.id);
  const r = reviewNext(db, '2026-09-13T10:00:00.000Z');
  assert.equal(r.card.id, card.id);
  assert.equal(r.test.id, t.id);
  assert.equal(r.wanted_type, 'context');
  assert.equal(r.left_today, 1);
  assert.equal(getSetting(db, 'review_card_id'), String(card.id));
  assert.equal(getSetting(db, 'review_test_id'), String(t.id));
  const g = grade(db, card.id, 3, t.id, new Date('2026-09-13T10:01:00.000Z'));
  assert.ok(new Date(g.due) > new Date('2026-09-13T10:01:00.000Z'));
  assert.equal(db.prepare('SELECT used_at FROM tests WHERE id = ?').get(t.id).used_at, '2026-09-13T10:01:00.000Z');
  const log = db.prepare('SELECT * FROM review_log WHERE card_id = ?').get(card.id);
  assert.equal(log.rating, 3);
  assert.equal(log.sentence, t.sentence);
  assert.equal(getSetting(db, 'review_card_id'), '');
  assert.deepEqual(recentSentences(db, card.id), [t.sentence]);
  assert.equal(reviewNext(db, '2026-09-13T10:02:00.000Z'), null, 'больше ничего не просрочено');
});

test('reviewNext без запаса отдаёт test: null и историю; grade без теста тоже работает', () => {
  const db = learningDb();
  db.prepare(`UPDATE cards SET fsrs_due = '2026-09-13T00:00:00.000Z' WHERE headword = 'bleak'`).run();
  db.prepare(`UPDATE cards SET fsrs_due = '2027-01-01T00:00:00.000Z' WHERE headword != 'bleak'`).run();
  const r = reviewNext(db, '2026-09-13T10:00:00.000Z');
  assert.equal(r.card.headword, 'bleak');
  assert.equal(r.test, null);
  assert.deepEqual(r.history, []);
  const g = grade(db, r.card.id, 1, null, new Date('2026-09-13T10:01:00.000Z'));
  assert.equal(g.card.fsrs_reps, 1);
  assert.throws(() => grade(db, r.card.id, 9, null), /1\.\.4/);
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, нет `../src/review.mjs`.

- [ ] **Step 3: review.mjs**

```js
import { nowIso, getSetting, setSetting, httpError } from './db.mjs';
import { applyRating } from './fsrs.mjs';
import { getCard, hydrate } from './queue.mjs';

const PLACEHOLDERS = new Set(['sth', 'sb', 'sb/sth', 'sth/sb', "one's", "sb's", 'oneself', 'yourself', 'somebody', 'something', 'somewhere', 'etc', 'etc.']);

const IRREGULAR = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'], go: ['went', 'gone', 'goes', 'going'], come: ['came', 'coming'],
  get: ['got', 'gotten', 'getting'], take: ['took', 'taken', 'taking'], give: ['gave', 'given', 'giving'], put: ['putting'],
  set: ['setting'], run: ['ran', 'running'], bring: ['brought'], break: ['broke', 'broken'], hold: ['held'], keep: ['kept'],
  make: ['made', 'making'], find: ['found'], think: ['thought'], stand: ['stood'], sit: ['sat', 'sitting'], fall: ['fell', 'fallen'],
  catch: ['caught'], grow: ['grew', 'grown'], throw: ['threw', 'thrown'], blow: ['blew', 'blown'], tear: ['tore', 'torn'],
  wear: ['wore', 'worn'], hang: ['hung'], lay: ['laid'], lie: ['lay', 'lain', 'lying'], cut: ['cutting'], shut: ['shutting'],
  let: ['letting'], show: ['shown'], write: ['wrote', 'written', 'writing'], drive: ['drove', 'driven', 'driving'], deal: ['dealt'],
  feel: ['felt'], leave: ['left'], lose: ['lost'], meet: ['met'], pay: ['paid'], say: ['said'], sell: ['sold'], send: ['sent'],
  speak: ['spoke', 'spoken'], spend: ['spent'], stick: ['stuck'], tell: ['told'], wake: ['woke', 'woken', 'waking'], wind: ['wound'],
  build: ['built'], see: ['saw', 'seen'], do: ['did', 'done', 'does'], have: ['had', 'has', 'having'], eat: ['ate', 'eaten'],
  drink: ['drank', 'drunk'], know: ['knew', 'known'], begin: ['began', 'begun'], buy: ['bought'], fly: ['flew', 'flown'], lead: ['led'],
  light: ['lit'], ride: ['rode', 'ridden'], rise: ['rose', 'risen'], shake: ['shook', 'shaken'], steal: ['stole', 'stolen'],
  swim: ['swam', 'swum'], teach: ['taught'], understand: ['understood'], win: ['won'], draw: ['drew', 'drawn'],
  forget: ['forgot', 'forgotten'], freeze: ['froze', 'frozen'], hide: ['hid', 'hidden'], strike: ['struck'], sweep: ['swept'],
  swing: ['swung'], sing: ['sang', 'sung'], ring: ['rang', 'rung'], sink: ['sank', 'sunk'], spring: ['sprang', 'sprung'],
  bear: ['bore', 'borne'], bind: ['bound'], bite: ['bit', 'bitten'], bleed: ['bled'], breed: ['bred'], choose: ['chose', 'chosen'],
  cling: ['clung'], creep: ['crept'], dig: ['dug'], feed: ['fed'], fight: ['fought'], flee: ['fled'], fling: ['flung'],
  forbid: ['forbade', 'forbidden'], grind: ['ground'], kneel: ['knelt'], lend: ['lent'], mean: ['meant'], seek: ['sought'],
  shoot: ['shot'], shrink: ['shrank', 'shrunk'], slide: ['slid'], sling: ['slung'], spin: ['spun'], stink: ['stank', 'stunk'],
  sting: ['stung'], strive: ['strove', 'striven'], swear: ['swore', 'sworn'], tread: ['trod'], weave: ['wove', 'woven'],
  weep: ['wept'], wring: ['wrung']
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function wordForms(p) {
  const base = p.replace(/[^a-z'-]/g, '');
  if (!base) return [];
  const forms = [base, ...(IRREGULAR[base] || [])];
  const res = forms.map((f) => new RegExp(`\\b${esc(f)}(s|es|ed|d|ing|er|est|ly)?\\b`));
  if (base.length >= 6) res.push(new RegExp(`\\b${esc(base.slice(0, -2))}[a-z]{0,6}\\b`));
  if (base.endsWith('y') && base.length >= 4) res.push(new RegExp(`\\b${esc(base.slice(0, -1))}(ies|ied|ier|iest|ily)\\b`));
  if (base.endsWith('e') && base.length >= 4) res.push(new RegExp(`\\b${esc(base.slice(0, -1))}(ing|ed|es|er|est)\\b`));
  return res;
}

export function containsHeadword(card, sentence) {
  const text = ' ' + String(sentence).toLowerCase().replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const parts = String(card.headword).toLowerCase().split(/\s+/).filter((p) => p && !PLACEHOLDERS.has(p));
  return parts.every((p) => wordForms(p).some((re) => re.test(text)));
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function validateSentence(card, { type, sentence, answer }, history = []) {
  const errors = [];
  if (!['context', 'cloze'].includes(type)) errors.push('type');
  const words = String(sentence || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 28) errors.push(`length ${words.length}`);
  if (type === 'context' && !containsHeadword(card, sentence)) errors.push('headword');
  if (type === 'cloze') {
    if (!/_{3,}/.test(String(sentence))) errors.push('gap');
    if (containsHeadword(card, sentence)) errors.push('cloze-has-headword');
  }
  if (history.some((h) => norm(h) === norm(sentence))) errors.push('repeat');
  if (card.source?.example && norm(card.source.example) === norm(sentence)) errors.push('source-example');
  if (!String(answer || '').trim()) errors.push('answer');
  return errors;
}

export function recentSentences(db, cardId, n = 5) {
  const logged = db.prepare('SELECT sentence FROM review_log WHERE card_id = ? AND sentence IS NOT NULL ORDER BY id DESC LIMIT ?').all(cardId, n);
  const stocked = db.prepare('SELECT sentence FROM tests WHERE card_id = ? ORDER BY id DESC LIMIT ?').all(cardId, n);
  return [...new Set([...logged, ...stocked].map((r) => r.sentence))];
}

export function addTest(db, cardId, { type, sentence, answer }, now = nowIso()) {
  const card = getCard(db, cardId);
  if (!card) throw httpError(404, 'карточка не найдена');
  const errors = validateSentence(card, { type, sentence, answer }, recentSentences(db, cardId));
  if (errors.length) throw httpError(422, `предложение не прошло проверку: ${errors.join(', ')}`);
  const r = db.prepare('INSERT INTO tests(card_id, type, sentence, answer, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(card.id, type, String(sentence).trim(), String(answer).trim(), now);
  return db.prepare('SELECT * FROM tests WHERE id = ?').get(Number(r.lastInsertRowid));
}

export function pickDueCard(db, now = nowIso()) {
  return db.prepare(`SELECT * FROM cards WHERE status = 'learning' AND fsrs_due <= ? ORDER BY fsrs_due, order_index LIMIT 1`).get(now) || null;
}

export function requiredTestType(db, card) {
  if ((card.fsrs_reps || 0) < 3) return 'context';
  const last = db.prepare('SELECT test_type FROM review_log WHERE card_id = ? ORDER BY id DESC LIMIT 1').get(card.id);
  return last && last.test_type === 'context' ? 'cloze' : 'context';
}

export function takeTest(db, cardId, type) {
  return db.prepare('SELECT * FROM tests WHERE card_id = ? AND used_at IS NULL AND type = ? ORDER BY id LIMIT 1').get(cardId, type)
    || db.prepare('SELECT * FROM tests WHERE card_id = ? AND used_at IS NULL ORDER BY id LIMIT 1').get(cardId)
    || null;
}

export function reviewNext(db, now = nowIso()) {
  const row = pickDueCard(db, now);
  if (!row) {
    setSetting(db, 'review_card_id', '');
    setSetting(db, 'review_test_id', '');
    return null;
  }
  const card = hydrate(row);
  const wanted_type = requiredTestType(db, card);
  const test = takeTest(db, card.id, wanted_type);
  const left_today = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'learning' AND fsrs_due <= ?`).get(now).c;
  setSetting(db, 'review_card_id', String(card.id));
  setSetting(db, 'review_test_id', test ? String(test.id) : '');
  return { card, test, wanted_type, left_today, history: recentSentences(db, card.id) };
}

export function currentReview(db) {
  const cardId = getSetting(db, 'review_card_id');
  const testId = getSetting(db, 'review_test_id');
  return { cardId: cardId ? Number(cardId) : null, testId: testId ? Number(testId) : null };
}

export function grade(db, cardId, rating, testId = null, now = new Date()) {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(Number(cardId));
  if (!row) throw httpError(404, 'карточка не найдена');
  if (row.status !== 'learning') throw httpError(409, 'карточка не в повторении');
  const { fields } = applyRating(row, rating, now);
  const test = testId ? db.prepare('SELECT * FROM tests WHERE id = ? AND card_id = ?').get(Number(testId), row.id) : null;
  db.prepare(`UPDATE cards SET fsrs_due = @fsrs_due, fsrs_stability = @fsrs_stability, fsrs_difficulty = @fsrs_difficulty,
    fsrs_elapsed_days = @fsrs_elapsed_days, fsrs_scheduled_days = @fsrs_scheduled_days, fsrs_reps = @fsrs_reps,
    fsrs_lapses = @fsrs_lapses, fsrs_learning_steps = @fsrs_learning_steps, fsrs_state = @fsrs_state,
    fsrs_last_review = @fsrs_last_review WHERE id = @id`).run({ ...fields, id: row.id });
  const ts = now.toISOString();
  if (test) db.prepare('UPDATE tests SET used_at = ? WHERE id = ?').run(ts, test.id);
  db.prepare(`INSERT INTO review_log(card_id, ts, rating, test_id, test_type, sentence, answer, scheduled_days, due_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, ts, Number(rating), test ? test.id : null, test ? test.type : null, test ? test.sentence : null, test ? test.answer : null, fields.fsrs_scheduled_days, fields.fsrs_due);
  setSetting(db, 'review_card_id', '');
  setSetting(db, 'review_test_id', '');
  return { card: getCard(db, row.id), due: fields.fsrs_due, scheduled_days: fields.fsrs_scheduled_days };
}
```

Примечание к тесту про `applyRating` с рейтингом 9: ошибка приходит из `fsrs.mjs` (`rating must be 1..4`), в `grade` её не глотать.

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS. Если падает кейс `happy → happily`: ветка `endsWith('y')` даёт `happ(ies|ied|ier|iest|ily)`, проверить регулярку.

- [ ] **Step 5: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/src/review.mjs english-tutor/tests/review.test.mjs
git commit -m "feat(english-tutor): повторение по FSRS, запас предложений и их проверка

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Промпты и задания генератору

**Files:**
- Create: `english-tutor/prompts/explain.md`, `english-tutor/prompts/test.md`, `english-tutor/src/prompts.mjs`, `english-tutor/src/jobs.mjs`
- Test: `english-tutor/tests/prompts.test.mjs`, `english-tutor/tests/jobs.test.mjs`

**Interfaces:**
- Produces: `renderExplainPrompt(card) -> string`, `renderTestPrompt(card, type, history) -> string`, `kindLabel(kind) -> 'слово'|'фразовый глагол'|'выражение'`; `jobs(db, {explainAhead=20, perKindAhead=3, testsWithinHours=24, now}) -> {explain: [{card_id, headword, kind, prompt}], tests: [{card_id, headword, kind, type, prompt}]}`.

- [ ] **Step 1: prompts/explain.md**

```
Ты репетитор английского для русскоязычного ученика уровня B1-B2, цель C1 в чтении.
Напиши разбор элемента ниже. Ответ: только текст разбора в markdown, без вступлений, без заголовка «Разбор», без заключений.

Формат для слова (строку пропускай, если для неё нет данных):
**{{headword}}** ({{pos}}, {{level}}) значение по-русски одной-двумя строками; если значений несколько, 2-3 через «;».
Строение: приставка + корень + суффикс с их значениями. Только если в данных есть root; иначе строку не писать и этимологию не выдумывать.
Семья: однокоренные из данных (family), каждое с переводом в скобках.
Сочетания: 2-3 самых ходовых сочетания с переводом.
Не путать: близнец из данных (twin) и одна фраза, чем отличается (twin_note_ru можно переформулировать), плюс по одному сочетанию на каждое слово. Только если twin есть.
Пример: одно предложение из данных (examples) с переводом; если примера нет, своё из 10-18 слов.

Формат для фразового глагола:
**{{headword}}** значение(я) по-русски.
Частица: что значит частица в этом глаголе (одна фраза).
Значения: ключевые значения из данных с процентами, каждое: значение по-русски, пример из данных с переводом.
Сочетания: 2-3 типичных.

Формат для выражения:
**{{headword}}** значение по-русски.
Регистр: разговорное / нейтральное / письменное (по данным genre, если есть).
Пример: из данных с переводом, или своё из 10-18 слов.

Правила: по-русски, коротко, без длинного тире, без вводных слов и оценок. Английские примеры естественные и современные. Не добавляй ничего сверх формата.

Данные ({{kind_ru}}):
{{data}}
```

- [ ] **Step 2: prompts/test.md**

```
Ты составляешь одно проверочное предложение для карточки ученика (русскоязычный, уровень B1-B2).
Ответ: только JSON вида {"type": "{{type}}", "sentence": "...", "answer": "..."} без пояснений и без markdown-ограждений.

Тип {{type}}:
- context: естественное английское предложение из 12-22 слов, в котором встречается «{{headword}}» (словоформа допускается) в значении из данных, и это значение однозначно понятно из контекста. answer: значение по-русски одной строкой, затем « / » и короткий английский глосс.
- cloze: такое же предложение, но вместо «{{headword}}» стоит пропуск «_____» (для фразового глагола пропуск на месте глагола и частицы вместе), а после предложения в скобках русская подсказка значения. Самого слова в предложении быть не должно. answer: «{{headword}}».

Запрещено: повторять пример из данных и любое предложение из списка «уже было»; офисно-корпоративные ситуации, если слово не про это; имена реальных людей.
Хорошо: конкретные бытовые, дорожные, семейные, сюжетные ситуации, каждый раз другая.

Данные ({{kind_ru}}):
{{data}}

Уже было:
{{history}}
```

- [ ] **Step 3: Тест prompts**

`tests/prompts.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderExplainPrompt, renderTestPrompt, kindLabel } from '../src/prompts.mjs';

const card = { id: 1, kind: 'word', headword: 'inspect', pos: 'verb', level: 'B2', source: { definition: 'look closely', examples: ['x'], root: 'spect', family: ['respect'] } };

test('kindLabel', () => {
  assert.equal(kindLabel('word'), 'слово');
  assert.equal(kindLabel('pv'), 'фразовый глагол');
  assert.equal(kindLabel('expr'), 'выражение');
});

test('renderExplainPrompt подставляет поля и данные', () => {
  const p = renderExplainPrompt(card);
  assert.match(p, /\*\*inspect\*\* \(verb, B2\)/);
  assert.match(p, /Данные \(слово\)/);
  assert.match(p, /"root": "spect"/);
  assert.ok(!p.includes('{{'));
});

test('renderTestPrompt подставляет тип, заголовок и историю', () => {
  const p = renderTestPrompt(card, 'cloze', ['One old sentence here.']);
  assert.match(p, /"type": "cloze"/);
  assert.match(p, /«inspect»/);
  assert.match(p, /Уже было:\n- One old sentence here\./);
  assert.match(renderTestPrompt(card, 'context', []), /Уже было:\n\(ничего\)/);
  assert.ok(!p.includes('{{'));
});
```

- [ ] **Step 4: prompts.mjs**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts');
const cache = new Map();
function template(name) {
  if (!cache.has(name)) cache.set(name, fs.readFileSync(path.join(dir, `${name}.md`), 'utf8'));
  return cache.get(name);
}

const LABELS = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };
export const kindLabel = (kind) => LABELS[kind] || kind;

function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));
}

function cardData(card) {
  return JSON.stringify({ headword: card.headword, pos: card.pos, level: card.level, ...card.source }, null, 1);
}

export function renderExplainPrompt(card) {
  return fill(template('explain'), { headword: card.headword, pos: card.pos, level: card.level, kind_ru: kindLabel(card.kind), data: cardData(card) });
}

export function renderTestPrompt(card, type, history = []) {
  return fill(template('test'), {
    headword: card.headword, type, kind_ru: kindLabel(card.kind), data: cardData(card),
    history: history.length ? history.map((h) => `- ${h}`).join('\n') : '(ничего)'
  });
}
```

- [ ] **Step 5: Тест jobs**

`tests/jobs.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';
import { nextCard, decide, setExplanation } from '../src/queue.mjs';
import { addTest } from '../src/review.mjs';
import { jobs } from '../src/jobs.mjs';

const item = (headword, kind = 'word', pos = 'verb') => ({ kind, headword, pos, level: 'B2', group_key: null, group_label: null, source: { definition: 'd' } });

test('jobs: разбор для показанных и ближайших в очереди, тесты для карточек со сроком в сутки без запаса', () => {
  const db = openDb(':memory:');
  seed(db, [item('inspect'), item('respect'), item('prospect'), item('go on', 'pv', 'phrasal verb'), item('in terms of', 'expr', 'expression')]);
  const shown = nextCard(db);
  decide(db, shown.id, 'learn', '2026-09-13T08:00:00.000Z');
  db.prepare(`UPDATE cards SET fsrs_due = '2026-09-13T20:00:00.000Z' WHERE id = ?`).run(shown.id);
  const j = jobs(db, { explainAhead: 2, perKindAhead: 1, now: new Date('2026-09-13T10:00:00.000Z') });
  assert.deepEqual(j.explain.map((e) => e.headword), ['inspect', 'respect', 'prospect', 'go on', 'in terms of']);
  assert.match(j.explain[0].prompt, /Данные \(слово\)/);
  assert.deepEqual(j.tests.map((t) => [t.headword, t.type]), [['inspect', 'context']]);
  assert.match(j.tests[0].prompt, /"type": "context"/);
  setExplanation(db, shown.id, 'разбор достаточной длины для проверки');
  addTest(db, shown.id, { type: 'context', sentence: 'Before buying the flat, we hired an expert to inspect the wiring and the roof.', answer: 'x' });
  const j2 = jobs(db, { explainAhead: 2, perKindAhead: 1, now: new Date('2026-09-13T10:00:00.000Z') });
  assert.ok(!j2.explain.some((e) => e.headword === 'inspect'));
  assert.deepEqual(j2.tests, []);
});
```

- [ ] **Step 6: jobs.mjs**

```js
import { hydrate } from './queue.mjs';
import { requiredTestType, recentSentences } from './review.mjs';
import { renderExplainPrompt, renderTestPrompt } from './prompts.mjs';

export function jobs(db, { explainAhead = 20, perKindAhead = 3, testsWithinHours = 24, now = new Date() } = {}) {
  const seen = new Set();
  const explain = [];
  const push = (row) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    const card = hydrate(row);
    explain.push({ card_id: card.id, headword: card.headword, kind: card.kind, prompt: renderExplainPrompt(card) });
  };
  db.prepare(`SELECT * FROM cards WHERE explanation_md IS NULL AND status IN ('shown', 'discussing', 'learning') ORDER BY shown_at, order_index`).all().forEach(push);
  db.prepare(`SELECT * FROM cards WHERE explanation_md IS NULL AND status = 'queued' ORDER BY order_index LIMIT ?`).all(explainAhead).forEach(push);
  for (const kind of ['word', 'pv', 'expr']) {
    db.prepare(`SELECT * FROM cards WHERE explanation_md IS NULL AND status = 'queued' AND kind = ? ORDER BY order_index LIMIT ?`).all(kind, perKindAhead).forEach(push);
  }
  const horizon = new Date(now.getTime() + testsWithinHours * 3600e3).toISOString();
  const tests = db.prepare(`SELECT c.* FROM cards c WHERE c.status = 'learning' AND c.fsrs_due <= ?
    AND NOT EXISTS (SELECT 1 FROM tests t WHERE t.card_id = c.id AND t.used_at IS NULL)
    ORDER BY c.fsrs_due, c.order_index LIMIT 30`).all(horizon).map(hydrate).map((card) => {
    const type = requiredTestType(db, card);
    return { card_id: card.id, headword: card.headword, kind: card.kind, type, prompt: renderTestPrompt(card, type, recentSentences(db, card.id)) };
  });
  return { explain, tests };
}
```

- [ ] **Step 7: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/prompts/explain.md english-tutor/prompts/test.md english-tutor/src/prompts.mjs english-tutor/src/jobs.mjs english-tutor/tests/prompts.test.mjs english-tutor/tests/jobs.test.mjs
git commit -m "feat(english-tutor): промпты разбора и теста, задания генератору

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: HTTP API, авторизация, статика и напоминание

**Files:**
- Create: `english-tutor/src/server.mjs`, `english-tutor/src/reminder.mjs`
- Test: `english-tutor/tests/api.test.mjs`, `english-tutor/tests/reminder.test.mjs`

**Interfaces:**
- Consumes: всё из Task 5-7.
- Produces: `buildApp({ db, env }) -> FastifyInstance` (без `listen`), `env = { API_TOKEN, DASHBOARD_PASSWORD, COOKIE_SECURE ('1'|'0'), REMINDER_AT?, TELEGRAM_BOT_TOKEN?, TELEGRAM_CHAT_ID? }`; `reminderDue({ at, nowLocalHHMM, today, sentDay, dueToday }) -> boolean`; `startReminder({ db, env, send, intervalMs })` (таймер, `unref`).
- Маршруты (все под `/api`, JSON):
  - `POST /login {password}` → `{ok:true}` + cookie `et_session`; `POST /logout`; `GET /me` → `{ok:true}`; `GET /health` → `{ok:true}` (без авторизации).
  - `GET /status` → результат `status()`.
  - `GET /next?kind=` → `{card, explanation_md|null, prompt|null, queued_left}`; 404 `{error}` если очередь пуста.
  - `GET /pending` → `{card|null}`.
  - `POST /cards/:id/explanation {md}` → `{card}`; `POST /cards/:id/learn|known|discuss|suspend` → `{card, status}`; `POST /cards/:id/notes {text}` → `{note}`; `POST /cards/known-bulk {ids:[...]}` → `{updated}`; `GET /cards?status&kind&q&limit&offset` → `{items}`; `GET /cards/:id` → `{card, notes, history}`.
  - `GET /review/next` → `{card, test|null, wanted_type, prompt|null, left_today} | {card:null, left_today:0}`; `POST /review/:id/test {type,sentence,answer}` → `{test}` (422 при провале проверки); `POST /review/:id/grade {rating, test_id?}` → `{card, due, scheduled_days, next_left}`; в `:id` допускается `current` (берётся `review_card_id`, `test_id` по умолчанию `review_test_id`).
  - `GET /jobs?explain=20&tests_hours=24` → результат `jobs()`.
  - Ошибки: `{error: message}` со статусом из `err.statusCode` (иначе 500).

- [ ] **Step 1: Тест reminder**

`tests/reminder.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderDue } from '../src/reminder.mjs';

test('reminderDue: время совпало, сегодня не слали, есть что повторять', () => {
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '', dueToday: 3 }), true);
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '20:59', today: '2026-09-13', sentDay: '', dueToday: 3 }), false);
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '2026-09-13', dueToday: 3 }), false);
  assert.equal(reminderDue({ at: '21:00', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '', dueToday: 0 }), false);
  assert.equal(reminderDue({ at: '', nowLocalHHMM: '21:00', today: '2026-09-13', sentDay: '', dueToday: 3 }), false);
});
```

- [ ] **Step 2: reminder.mjs**

```js
import { getSetting, setSetting } from './db.mjs';
import { status, localDay } from './queue.mjs';

export function reminderDue({ at, nowLocalHHMM, today, sentDay, dueToday }) {
  if (!at) return false;
  if (nowLocalHHMM !== at) return false;
  if (sentDay === today) return false;
  return dueToday > 0;
}

export function localHHMM(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: process.env.TZ || 'Europe/Moscow' }).format(date);
}

export async function sendTelegram(env, text) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
  });
  if (!r.ok) throw new Error(`telegram ${r.status}`);
}

export function startReminder({ db, env, send = sendTelegram, intervalMs = 60000, log = console }) {
  if (!env.REMINDER_AT || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return null;
  const timer = setInterval(async () => {
    try {
      const now = new Date();
      const s = status(db, now);
      const today = localDay(now);
      if (!reminderDue({ at: env.REMINDER_AT, nowLocalHHMM: localHHMM(now), today, sentDay: getSetting(db, 'reminder_sent_day') || '', dueToday: s.all.due_today })) return;
      await send(env, `Ждёт повторения: ${s.all.due_today}. Команда /review в этом чате или дашборд.`);
      setSetting(db, 'reminder_sent_day', today);
    } catch (e) {
      log.error(`reminder: ${e.message}`);
    }
  }, intervalMs);
  timer.unref();
  return timer;
}
```

- [ ] **Step 3: Тест API**

`tests/api.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';
import { buildApp } from '../src/server.mjs';

const item = (headword, kind = 'word', pos = 'verb') => ({ kind, headword, pos, level: 'B2', group_key: null, group_label: null, source: { definition: 'd', example: 'e' } });
const env = { API_TOKEN: 'secret-token', DASHBOARD_PASSWORD: 'pw', COOKIE_SECURE: '0' };
const auth = { authorization: 'Bearer secret-token' };

async function app() {
  const db = openDb(':memory:');
  seed(db, [item('inspect'), item('respect'), item('go on', 'pv', 'phrasal verb'), item('in terms of', 'expr', 'expression')]);
  const a = buildApp({ db, env });
  await a.ready();
  return { a, db };
}

test('health открыт, остальное требует токен или cookie', async () => {
  const { a } = await app();
  assert.equal((await a.inject({ method: 'GET', url: '/api/health' })).statusCode, 200);
  assert.equal((await a.inject({ method: 'GET', url: '/api/status' })).statusCode, 401);
  assert.equal((await a.inject({ method: 'GET', url: '/api/status', headers: { authorization: 'Bearer nope' } })).statusCode, 401);
  assert.equal((await a.inject({ method: 'GET', url: '/api/status', headers: auth })).statusCode, 200);
  const bad = await a.inject({ method: 'POST', url: '/api/login', payload: { password: 'wrong' } });
  assert.equal(bad.statusCode, 401);
  const login = await a.inject({ method: 'POST', url: '/api/login', payload: { password: 'pw' } });
  assert.equal(login.statusCode, 200);
  const cookie = login.cookies.find((c) => c.name === 'et_session');
  assert.ok(cookie && cookie.httpOnly);
  const me = await a.inject({ method: 'GET', url: '/api/me', cookies: { et_session: cookie.value } });
  assert.equal(me.statusCode, 200);
  const out = await a.inject({ method: 'POST', url: '/api/logout', cookies: { et_session: cookie.value } });
  assert.equal(out.statusCode, 200);
  assert.equal((await a.inject({ method: 'GET', url: '/api/me', cookies: { et_session: cookie.value } })).statusCode, 401);
});

test('next → explanation → learn → status', async () => {
  const { a } = await app();
  const n = await a.inject({ method: 'GET', url: '/api/next?kind=pv', headers: auth });
  assert.equal(n.statusCode, 200);
  const body = n.json();
  assert.equal(body.card.headword, 'go on');
  assert.equal(body.explanation_md, null);
  assert.match(body.prompt, /Данные \(фразовый глагол\)/);
  assert.equal(body.queued_left, 3);
  const ex = await a.inject({ method: 'POST', url: `/api/cards/${body.card.id}/explanation`, headers: auth, payload: { md: '**go on** продолжать; происходить' } });
  assert.equal(ex.statusCode, 200);
  assert.equal(ex.json().card.explanation_md, '**go on** продолжать; происходить');
  const pend = await a.inject({ method: 'GET', url: '/api/pending', headers: auth });
  assert.equal(pend.json().card.id, body.card.id);
  const learn = await a.inject({ method: 'POST', url: '/api/cards/pending/learn', headers: auth });
  assert.equal(learn.statusCode, 200);
  assert.equal(learn.json().card.status, 'learning');
  assert.equal(learn.json().status.all.learning, 1);
  const again = await a.inject({ method: 'POST', url: '/api/cards/pending/learn', headers: auth });
  assert.equal(again.statusCode, 404);
  const bad = await a.inject({ method: 'GET', url: '/api/next?kind=nope', headers: auth });
  assert.equal(bad.statusCode, 400);
});

test('known-bulk, cards list и details, notes, suspend', async () => {
  const { a } = await app();
  const list = (await a.inject({ method: 'GET', url: '/api/cards?kind=word', headers: auth })).json().items;
  const ids = list.map((c) => c.id);
  const kb = await a.inject({ method: 'POST', url: '/api/cards/known-bulk', headers: auth, payload: { ids } });
  assert.equal(kb.json().updated, 2);
  const after = (await a.inject({ method: 'GET', url: '/api/cards?status=known', headers: auth })).json().items;
  assert.equal(after.length, 2);
  const note = await a.inject({ method: 'POST', url: `/api/cards/${ids[0]}/notes`, headers: auth, payload: { text: 'in- внутрь' } });
  assert.equal(note.statusCode, 200);
  const det = (await a.inject({ method: 'GET', url: `/api/cards/${ids[0]}`, headers: auth })).json();
  assert.equal(det.notes.length, 1);
  assert.equal(det.card.headword, 'inspect');
  const n = await a.inject({ method: 'GET', url: '/api/next', headers: auth });
  const learn = await a.inject({ method: 'POST', url: `/api/cards/${n.json().card.id}/learn`, headers: auth });
  const sus = await a.inject({ method: 'POST', url: `/api/cards/${learn.json().card.id}/suspend`, headers: auth });
  assert.equal(sus.json().card.status, 'suspended');
});

test('review: next без запаса даёт prompt, test кладёт запас, grade списывает', async () => {
  const { a, db } = await app();
  const n = await a.inject({ method: 'GET', url: '/api/next', headers: auth });
  const id = n.json().card.id;
  await a.inject({ method: 'POST', url: `/api/cards/${id}/learn`, headers: auth });
  db.prepare(`UPDATE cards SET fsrs_due = '2020-01-01T00:00:00.000Z' WHERE id = ?`).run(id);
  const r1 = (await a.inject({ method: 'GET', url: '/api/review/next', headers: auth })).json();
  assert.equal(r1.card.id, id);
  assert.equal(r1.test, null);
  assert.match(r1.prompt, /"type": "context"/);
  const badTest = await a.inject({ method: 'POST', url: `/api/review/${id}/test`, headers: auth, payload: { type: 'context', sentence: 'short', answer: 'x' } });
  assert.equal(badTest.statusCode, 422);
  assert.match(badTest.json().error, /length/);
  const t = await a.inject({ method: 'POST', url: `/api/review/current/test`, headers: auth, payload: { type: 'context', sentence: 'Before buying the flat, we hired an expert to inspect the wiring and the roof.', answer: 'осматривать / examine' } });
  assert.equal(t.statusCode, 200);
  const r2 = (await a.inject({ method: 'GET', url: '/api/review/next', headers: auth })).json();
  assert.equal(r2.test.id, t.json().test.id);
  assert.equal(r2.prompt, null);
  const g = await a.inject({ method: 'POST', url: '/api/review/current/grade', headers: auth, payload: { rating: 3 } });
  assert.equal(g.statusCode, 200);
  assert.equal(g.json().next_left, 0);
  assert.equal(db.prepare('SELECT used_at FROM tests WHERE id = ?').get(t.json().test.id).used_at !== null, true);
  const r3 = (await a.inject({ method: 'GET', url: '/api/review/next', headers: auth })).json();
  assert.equal(r3.card, null);
  const badGrade = await a.inject({ method: 'POST', url: '/api/review/current/grade', headers: auth, payload: { rating: 3 } });
  assert.equal(badGrade.statusCode, 404);
});

test('jobs отдаёт задания', async () => {
  const { a } = await app();
  const j = (await a.inject({ method: 'GET', url: '/api/jobs?explain=2', headers: auth })).json();
  assert.equal(j.explain.length, 4);
  assert.deepEqual(j.tests, []);
});

test('статика: / отдаёт index.html', async () => {
  const { a } = await app();
  const r = await a.inject({ method: 'GET', url: '/' });
  assert.equal(r.statusCode, 200);
  assert.match(r.headers['content-type'], /text\/html/);
});
```

- [ ] **Step 4: Запустить, убедиться что падает**

Run: `npm test`
Expected: FAIL, нет `../src/server.mjs` и `../src/reminder.mjs`.

- [ ] **Step 5: Заглушка статики**

Создать `public/index.html` с минимальным содержимым (полный дашборд в Task 9):
```html
<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>English Tutor</title></head><body>English Tutor</body></html>
```

- [ ] **Step 6: server.mjs**

```js
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { openDb, nowIso, httpError } from './db.mjs';
import { nextCard, pendingCard, resolveId, decide, suspend, setExplanation, addNote, cardDetails, listCards, status, getCard } from './queue.mjs';
import { reviewNext, addTest, grade, currentReview } from './review.mjs';
import { jobs } from './jobs.mjs';
import { renderExplainPrompt, renderTestPrompt } from './prompts.mjs';
import { startReminder } from './reminder.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DAYS = 30;

export function buildApp({ db, env, logger = false }) {
  const app = Fastify({ logger });
  app.register(fastifyCookie);
  app.register(fastifyStatic, { root: path.join(here, '..', 'public'), prefix: '/' });

  app.setErrorHandler((err, req, reply) => {
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (code === 500) app.log.error(err);
    reply.code(code).send({ error: code === 500 ? 'внутренняя ошибка' : err.message });
  });

  const sessionOk = (token) => {
    if (!token) return false;
    const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token);
    return Boolean(row && row.expires_at > nowIso());
  };

  // Хук авторизации регистрируется раньше, чем плагин cookie успевает добавить свой парсер,
  // поэтому cookie читаем из заголовка сами.
  const cookieValue = (req, name) => {
    if (req.cookies && req.cookies[name]) return req.cookies[name];
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  };

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    if (req.url === '/api/health' || req.url === '/api/login') return;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (env.API_TOKEN && bearer && bearer === env.API_TOKEN) return;
    if (sessionOk(cookieValue(req, 'et_session'))) return;
    throw httpError(401, 'нужна авторизация');
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.post('/api/login', async (req, reply) => {
    const password = String(req.body?.password || '');
    if (!env.DASHBOARD_PASSWORD || password !== env.DASHBOARD_PASSWORD) throw httpError(401, 'неверный пароль');
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
    db.prepare('INSERT INTO sessions(token, expires_at) VALUES (?, ?)').run(token, expires);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
    reply.setCookie('et_session', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE !== '0', maxAge: SESSION_DAYS * 86400 });
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    const token = cookieValue(req, 'et_session');
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    reply.clearCookie('et_session', { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async () => ({ ok: true }));
  app.get('/api/status', async () => status(db));

  app.get('/api/next', async (req) => {
    const kind = req.query.kind || null;
    const card = nextCard(db, { kind });
    if (!card) throw httpError(404, kind ? `очередь ${kind} пуста` : 'очередь пуста');
    const queued_left = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'queued'`).get().c;
    return { card, explanation_md: card.explanation_md, prompt: card.explanation_md ? null : renderExplainPrompt(card), queued_left };
  });

  app.get('/api/pending', async () => ({ card: pendingCard(db) }));

  app.post('/api/cards/known-bulk', async (req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    if (!ids.length) throw httpError(400, 'ids пуст');
    const stmt = db.prepare(`UPDATE cards SET status = 'known', decided_at = ? WHERE id = ? AND status IN ('queued', 'shown', 'discussing')`);
    let updated = 0;
    db.exec('BEGIN');
    try {
      for (const id of ids) updated += stmt.run(nowIso(), id).changes;
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return { updated };
  });

  app.get('/api/cards', async (req) => ({ items: listCards(db, req.query) }));
  app.get('/api/cards/:id', async (req) => cardDetails(db, resolveId(db, req.params.id)));

  app.post('/api/cards/:id/explanation', async (req) => ({ card: setExplanation(db, resolveId(db, req.params.id), req.body?.md) }));
  for (const decision of ['learn', 'known', 'discuss']) {
    app.post(`/api/cards/:id/${decision}`, async (req) => {
      const card = decide(db, resolveId(db, req.params.id), decision);
      return { card, status: status(db) };
    });
  }
  app.post('/api/cards/:id/suspend', async (req) => ({ card: suspend(db, resolveId(db, req.params.id)), status: status(db) }));
  app.post('/api/cards/:id/notes', async (req) => ({ note: addNote(db, resolveId(db, req.params.id), req.body?.text) }));

  app.get('/api/review/next', async () => {
    const r = reviewNext(db);
    if (!r) return { card: null, test: null, wanted_type: null, prompt: null, left_today: 0 };
    return { card: r.card, test: r.test, wanted_type: r.wanted_type, prompt: r.test ? null : renderTestPrompt(r.card, r.wanted_type, r.history), left_today: r.left_today };
  });

  const reviewId = (param) => {
    if (param === 'current') {
      const { cardId } = currentReview(db);
      if (!cardId) throw httpError(404, 'нет текущей карточки повторения: сначала /review');
      return cardId;
    }
    const n = Number(param);
    if (!Number.isInteger(n)) throw httpError(400, 'id должен быть числом');
    if (!getCard(db, n)) throw httpError(404, 'карточка не найдена');
    return n;
  };

  app.post('/api/review/:id/test', async (req) => ({ test: addTest(db, reviewId(req.params.id), req.body || {}) }));

  app.post('/api/review/:id/grade', async (req) => {
    const cardId = reviewId(req.params.id);
    const current = currentReview(db);
    const testId = req.body?.test_id ?? (current.cardId === cardId ? current.testId : null);
    const g = grade(db, cardId, Number(req.body?.rating), testId);
    const next_left = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'learning' AND fsrs_due <= ?`).get(nowIso()).c;
    return { ...g, next_left };
  });

  app.get('/api/jobs', async (req) => jobs(db, {
    explainAhead: Number(req.query.explain) || 20,
    testsWithinHours: Number(req.query.tests_hours) || 24
  }));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const db = openDb(env.DB_PATH || 'data-db/tutor.sqlite');
  const app = buildApp({ db, env, logger: true });
  startReminder({ db, env, log: app.log });
  app.listen({ port: Number(env.PORT) || 3000, host: '0.0.0.0' }).catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 7: Запустить тесты**

Run: `npm test`
Expected: PASS. Если `login.cookies` пуст, проверить, что `@fastify/cookie` зарегистрирован до маршрутов (так и есть) и что `reply.setCookie` вызывается.

- [ ] **Step 8: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/src/server.mjs english-tutor/src/reminder.mjs english-tutor/public/index.html english-tutor/tests/api.test.mjs english-tutor/tests/reminder.test.mjs
git commit -m "feat(english-tutor): HTTP API, вход по паролю и токену, напоминание

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Дашборд

**Files:**
- Modify: `english-tutor/public/index.html`
- Create: `english-tutor/public/app.js`, `english-tutor/public/style.css`

**Interfaces:**
- Consumes: API из Task 8 через `fetch` с cookie (`credentials: 'same-origin'`).
- Вкладки: Статус, Учить, Повторение, Список, Карточка (открывается из списка). Разбор рендерится из markdown простым конвертером (`**b**`, `*i*`, переносы). Кнопки на «Учить»: Учу / Знаю / Отложить (просто следующий). На «Повторение»: Показать ответ → 1-4. Если `test` null: текст «Предложение ещё готовится (генератор на work), загляни через 10 минут» и кнопка «Следующая» не нужна, карточка остаётся текущей.

- [ ] **Step 1: index.html**

```html
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>English Tutor</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header>
  <h1>English Tutor</h1>
  <nav id="tabs" hidden>
    <button data-tab="status">Статус</button>
    <button data-tab="learn">Учить</button>
    <button data-tab="review">Повторение</button>
    <button data-tab="list">Список</button>
  </nav>
</header>
<main>
  <section id="login">
    <form id="login-form">
      <input type="password" name="password" placeholder="Пароль" autocomplete="current-password" required>
      <button type="submit">Войти</button>
    </form>
    <p id="login-error" class="error" hidden></p>
  </section>

  <section id="status" hidden>
    <div id="status-cards" class="grid"></div>
    <table id="status-table"></table>
  </section>

  <section id="learn" hidden>
    <div class="row">
      <select id="learn-kind">
        <option value="">Любой поток</option>
        <option value="word">Слово</option>
        <option value="pv">Фразовый глагол</option>
        <option value="expr">Выражение</option>
      </select>
      <button id="learn-next">Следующий</button>
    </div>
    <article id="learn-card" hidden>
      <div class="meta" id="learn-meta"></div>
      <div class="md" id="learn-explanation"></div>
      <div class="row">
        <button id="learn-learn" class="primary">Учу</button>
        <button id="learn-known">Знаю</button>
        <button id="learn-skip">Отложить</button>
      </div>
    </article>
    <p id="learn-message" class="muted"></p>
  </section>

  <section id="review" hidden>
    <p id="review-left" class="muted"></p>
    <article id="review-card" hidden>
      <div class="meta" id="review-meta"></div>
      <p id="review-sentence" class="sentence"></p>
      <button id="review-reveal">Показать ответ</button>
      <p id="review-answer" class="answer" hidden></p>
      <div class="row" id="review-grades" hidden>
        <button data-rating="1">1 снова</button>
        <button data-rating="2">2 трудно</button>
        <button data-rating="3" class="primary">3 норм</button>
        <button data-rating="4">4 легко</button>
      </div>
    </article>
    <p id="review-message" class="muted"></p>
    <button id="review-start">Начать</button>
  </section>

  <section id="list" hidden>
    <div class="row">
      <select id="list-status">
        <option value="">Любой статус</option>
        <option value="queued">В очереди</option>
        <option value="shown">Отложено</option>
        <option value="discussing">Обсуждается</option>
        <option value="learning">Учу</option>
        <option value="known">Знал</option>
        <option value="suspended">Убрано</option>
      </select>
      <select id="list-kind">
        <option value="">Любой поток</option>
        <option value="word">Слово</option>
        <option value="pv">Фразовый глагол</option>
        <option value="expr">Выражение</option>
      </select>
      <input id="list-q" placeholder="Поиск">
      <button id="list-go">Показать</button>
    </div>
    <table id="list-table"></table>
  </section>

  <section id="card" hidden>
    <button id="card-back">← Список</button>
    <div class="meta" id="card-meta"></div>
    <div class="md" id="card-explanation"></div>
    <div class="row">
      <button id="card-learn">Учу</button>
      <button id="card-known">Знаю</button>
      <button id="card-suspend">Убрать из повторения</button>
    </div>
    <h3>Заметки</h3>
    <ul id="card-notes"></ul>
    <h3>История</h3>
    <table id="card-history"></table>
  </section>
</main>
<script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css**

```css
:root { color-scheme: light dark; --bg: #fff; --fg: #111; --muted: #666; --line: #ddd; --primary: #2563eb; }
@media (prefers-color-scheme: dark) { :root { --bg: #111; --fg: #eee; --muted: #999; --line: #333; --primary: #60a5fa; } }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.45 -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--fg); }
header { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
h1 { font-size: 18px; margin: 0; }
nav button { margin-right: 6px; }
main { max-width: 720px; margin: 0 auto; padding: 16px; }
button { font: inherit; padding: 8px 14px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
button.primary { background: var(--primary); color: #fff; border-color: var(--primary); }
button.active { border-color: var(--primary); color: var(--primary); }
input, select { font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px; }
.grid .tile { border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
.grid .tile b { display: block; font-size: 24px; }
.meta, .muted { color: var(--muted); font-size: 14px; }
.md { border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin: 12px 0; white-space: pre-wrap; }
.sentence { font-size: 20px; margin: 16px 0; }
.answer { padding: 10px; border-left: 3px solid var(--primary); }
.error { color: #dc2626; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
td, th { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 14px; }
tr.clickable { cursor: pointer; }
```

- [ ] **Step 3: app.js**

```js
const $ = (sel) => document.querySelector(sel);
const KIND = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };
const STATUS = { queued: 'в очереди', shown: 'отложено', discussing: 'обсуждается', learning: 'учу', known: 'знал', suspended: 'убрано' };

async function api(url, opts = {}) {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts });
  if (r.status === 401) { showLogin(); throw new Error('401'); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body;
}
const post = (url, payload) => api(url, { method: 'POST', body: JSON.stringify(payload || {}) });

function md(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return esc(text || '').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/\|\|([^|]+)\|\|/g, '<span class="answer">$1</span>');
}

function show(tab) {
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== tab;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
  try { localStorage.setItem('et_tab', tab); } catch {}
  if (tab === 'status') loadStatus();
  if (tab === 'list') loadList();
}
function showLogin() { $('#tabs').hidden = true; show('login'); }

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').hidden = true;
  try {
    await post('/api/login', { password: new FormData(e.target).get('password') });
    e.target.reset();
    start();
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-error').hidden = false;
  }
});

async function start() {
  try { await api('/api/me'); } catch { return; }
  $('#tabs').hidden = false;
  let tab = 'status';
  try { tab = localStorage.getItem('et_tab') || 'status'; } catch {}
  show(['status', 'learn', 'review', 'list'].includes(tab) ? tab : 'status');
}
$('#tabs').addEventListener('click', (e) => { if (e.target.dataset.tab) show(e.target.dataset.tab); });

async function loadStatus() {
  const s = await api('/api/status');
  $('#status-cards').innerHTML = [
    ['Выучено', s.all.learned], ['Учу', s.all.learning], ['Ждёт сегодня', s.all.due_today],
    ['Осталось в очереди', s.all.queued], ['Знал заранее', s.all.known], ['Серия дней', s.streak]
  ].map(([l, v]) => `<div class="tile"><b>${v}</b>${l}</div>`).join('');
  const row = (k, c) => `<tr><th>${KIND[k] || 'всего'}</th><td>${c.total}</td><td>${c.learned}</td><td>${c.learning}</td><td>${c.known}</td><td>${c.shown}</td><td>${c.queued}</td></tr>`;
  $('#status-table').innerHTML = '<tr><th></th><th>всего</th><th>выучено</th><th>учу</th><th>знал</th><th>отложено</th><th>в очереди</th></tr>' +
    ['word', 'pv', 'expr', 'all'].map((k) => row(k, s[k])).join('');
}

let learnCard = null;
function renderLearn(body) {
  learnCard = body.card;
  $('#learn-card').hidden = false;
  $('#learn-meta').textContent = `${KIND[body.card.kind]} · ${body.card.level || ''} ${body.card.group_label ? '· ' + body.card.group_label : ''} · в очереди ${body.queued_left}`;
  $('#learn-explanation').innerHTML = body.explanation_md ? md(body.explanation_md) : `<b>${body.card.headword}</b><br><span class="muted">Разбор ещё готовится (генератор на work). Можно решить сейчас или отложить.</span>`;
  $('#learn-message').textContent = '';
}
$('#learn-next').addEventListener('click', async () => {
  try { renderLearn(await api(`/api/next?kind=${$('#learn-kind').value}`)); }
  catch (e) { $('#learn-message').textContent = e.message; $('#learn-card').hidden = true; }
});
async function learnDecide(decision) {
  if (!learnCard) return;
  const r = await post(`/api/cards/${learnCard.id}/${decision}`);
  $('#learn-card').hidden = true;
  $('#learn-message').textContent = decision === 'learn' ? `В повторении. Учу: ${r.status.all.learning}, выучено: ${r.status.all.learned}` : 'Отмечено как известное';
  learnCard = null;
}
$('#learn-learn').addEventListener('click', () => learnDecide('learn'));
$('#learn-known').addEventListener('click', () => learnDecide('known'));
$('#learn-skip').addEventListener('click', () => { $('#learn-card').hidden = true; $('#learn-message').textContent = 'Отложено, найдёшь в списке со статусом «отложено»'; learnCard = null; });

let review = null;
async function reviewNext() {
  review = await api('/api/review/next');
  $('#review-answer').hidden = true;
  $('#review-grades').hidden = true;
  $('#review-reveal').hidden = false;
  if (!review.card) {
    $('#review-card').hidden = true;
    $('#review-left').textContent = 'На сегодня всё повторено';
    $('#review-message').textContent = '';
    return;
  }
  $('#review-card').hidden = false;
  $('#review-left').textContent = `Осталось сегодня: ${review.left_today}`;
  $('#review-meta').textContent = `${KIND[review.card.kind]} · ${review.wanted_type === 'cloze' ? 'вставь слово' : 'что значит выделенное'}`;
  if (!review.test) {
    $('#review-sentence').textContent = review.card.headword;
    $('#review-message').textContent = 'Предложение ещё готовится (генератор на work), загляни через 10 минут или спроси /review в Telegram.';
    $('#review-reveal').hidden = true;
    return;
  }
  $('#review-sentence').textContent = review.test.sentence;
  $('#review-answer').textContent = review.test.answer;
  $('#review-message').textContent = '';
}
$('#review-start').addEventListener('click', reviewNext);
$('#review-reveal').addEventListener('click', () => { $('#review-answer').hidden = false; $('#review-grades').hidden = false; $('#review-reveal').hidden = true; });
$('#review-grades').addEventListener('click', async (e) => {
  const rating = Number(e.target.dataset.rating);
  if (!rating || !review?.card) return;
  const g = await post(`/api/review/${review.card.id}/grade`, { rating, test_id: review.test ? review.test.id : null });
  $('#review-message').textContent = `Следующий раз через ${g.scheduled_days} дн.`;
  await reviewNext();
});

async function loadList() {
  const p = new URLSearchParams({ status: $('#list-status').value, kind: $('#list-kind').value, q: $('#list-q').value });
  const { items } = await api(`/api/cards?${p}`);
  $('#list-table').innerHTML = '<tr><th>слово</th><th>поток</th><th>статус</th><th>срок</th></tr>' + items.map((c) =>
    `<tr class="clickable" data-id="${c.id}"><td>${c.headword}</td><td>${KIND[c.kind]}</td><td>${STATUS[c.status]}</td><td>${c.fsrs_due ? c.fsrs_due.slice(0, 10) : ''}</td></tr>`).join('');
}
$('#list-go').addEventListener('click', loadList);
$('#list-table').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openCard(Number(tr.dataset.id)); });

let cardId = null;
async function openCard(id) {
  cardId = id;
  const d = await api(`/api/cards/${id}`);
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== 'card';
  $('#card-meta').textContent = `${d.card.headword} · ${KIND[d.card.kind]} · ${STATUS[d.card.status]} ${d.card.group_label ? '· ' + d.card.group_label : ''}`;
  $('#card-explanation').innerHTML = d.card.explanation_md ? md(d.card.explanation_md) : '<span class="muted">Разбора ещё нет</span>';
  $('#card-notes').innerHTML = d.notes.map((n) => `<li>${md(n.text)} <span class="muted">${n.ts.slice(0, 10)}</span></li>`).join('') || '<li class="muted">нет</li>';
  $('#card-history').innerHTML = d.history.map((h) => `<tr><td>${h.ts.slice(0, 10)}</td><td>${h.rating}</td><td>${h.sentence || ''}</td></tr>`).join('');
}
$('#card-back').addEventListener('click', () => show('list'));
$('#card-learn').addEventListener('click', async () => { await post(`/api/cards/${cardId}/learn`); openCard(cardId); });
$('#card-known').addEventListener('click', async () => { await post(`/api/cards/${cardId}/known`); openCard(cardId); });
$('#card-suspend').addEventListener('click', async () => { await post(`/api/cards/${cardId}/suspend`); openCard(cardId); });

start();
```

- [ ] **Step 4: Проверить в браузере**

```bash
cd /Users/evd3v/Projects/personal/english-tutor
DB_PATH=/tmp/et-dev.sqlite node --disable-warning=ExperimentalWarning scripts/seed.mjs
API_TOKEN=dev DASHBOARD_PASSWORD=dev COOKIE_SECURE=0 DB_PATH=/tmp/et-dev.sqlite PORT=3111 npm start
```
Открыть `http://localhost:3111` во встроенном браузере (`preview_start` с url), войти паролем `dev`, пройти: Статус показывает счётчики; Учить → Следующий → Учу; Повторение → Начать → сообщение «готовится» (запаса нет); Список → фильтр «учу» → карточка. Исправить, что сломано. Тесты `npm test` по-прежнему PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/public
git commit -m "feat(english-tutor): дашборд: статус, учить, повторение, список, карточка

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Docker, compose, README

**Files:**
- Create: `english-tutor/Dockerfile`, `english-tutor/docker-compose.yml`, `english-tutor/.env.example`, `english-tutor/.dockerignore`, `english-tutor/README.md`

- [ ] **Step 1: Файлы**

`Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY prompts ./prompts
COPY public ./public
COPY data/queue.json ./data/queue.json
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.mjs"]
```

`docker-compose.yml`:
```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:3101:3000"
    env_file: .env
    environment:
      TZ: Europe/Moscow
      DB_PATH: /data/tutor.sqlite
      PORT: "3000"
    volumes:
      - ./data-db:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

`.env.example`:
```
API_TOKEN=замени-на-openssl-rand-hex-32
DASHBOARD_PASSWORD=замени
COOKIE_SECURE=1
# необязательно: напоминание в Telegram
REMINDER_AT=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`.dockerignore`:
```
node_modules
data-db
data/raw
.env
tests
work
```

`README.md`:
```
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
node scripts/tag-roots.mjs      # claude -p, кэш data/roots.json
node scripts/build-queue.mjs    # data/queue.json

## Деплой на aventra
rsync -az --delete --exclude node_modules --exclude data-db --exclude .env --exclude data/raw ./ aventra:/root/english-tutor/
ssh aventra 'cd /root/english-tutor && docker compose up -d --build && docker compose exec -T app node --disable-warning=ExperimentalWarning scripts/seed.mjs'

## Клиент на work
work/tutor.mjs читает ~/.claude/english-tutor.env (API_URL, API_TOKEN). Команды:
next [word|pv|expr] · explain <id> (markdown из stdin) · learn|known|discuss [id] · note [id] "текст"
· status · review · test <id> (JSON из stdin) · grade <1-4> [id] · pending
work/generator.mjs: фоновые разборы и предложения через claude -p (launchd com.aventra.english-generator).
```

- [ ] **Step 2: Собрать и проверить локально**

```bash
cd /Users/evd3v/Projects/personal/english-tutor
cp .env.example .env && sed -i '' 's/^API_TOKEN=.*/API_TOKEN=dev/; s/^DASHBOARD_PASSWORD=.*/DASHBOARD_PASSWORD=dev/; s/^COOKIE_SECURE=.*/COOKIE_SECURE=0/' .env
docker compose up -d --build && sleep 5 && curl -s http://127.0.0.1:3101/api/health && docker compose exec -T app node --disable-warning=ExperimentalWarning scripts/seed.mjs && curl -s -H "Authorization: Bearer dev" http://127.0.0.1:3101/api/status | head -c 300; docker compose down
```
Expected: `{"ok":true}`, `{ inserted: ~3800, skipped: 0 }`, статус с `total`. (Локальный Docker должен быть запущен; если его нет, пропустить и проверить на aventra в Task 11.)

- [ ] **Step 3: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/Dockerfile english-tutor/docker-compose.yml english-tutor/.env.example english-tutor/.dockerignore english-tutor/README.md
git commit -m "feat(english-tutor): Docker, compose и README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Выкладка на aventra

**Files:** ничего в репозитории; на сервере `/root/english-tutor/`, `/root/english-tutor/.env`, `/etc/nginx/sites-enabled/english.evm.im`.

- [ ] **Step 1: Остановить легаси english-ai (данные не удалять)**

```bash
ssh aventra 'cd /root/english && docker compose -f docker-compose.prod.yml down && docker ps --format "{{.Names}}" | grep -c english || true'
```
Expected: контейнеры `english-*` остановлены, volume `pgdata` остаётся (`docker volume ls | grep english`).

- [ ] **Step 2: Залить код и создать .env**

```bash
cd /Users/evd3v/Projects/personal/english-tutor
rsync -az --delete --exclude node_modules --exclude data-db --exclude .env --exclude data/raw ./ aventra:/root/english-tutor/
ssh aventra 'cd /root/english-tutor && test -f .env || { printf "API_TOKEN=%s\nDASHBOARD_PASSWORD=%s\nCOOKIE_SECURE=1\nREMINDER_AT=\nTELEGRAM_BOT_TOKEN=\nTELEGRAM_CHAT_ID=\n" "$(openssl rand -hex 32)" "$(openssl rand -base64 12 | tr -d "/+=" | cut -c1-12)" > .env; chmod 600 .env; }; grep -c . .env'
```
Expected: `6`. Пароль дашборда Евгений посмотрит сам в `/root/english-tutor/.env` (в чат не выводить).

- [ ] **Step 3: Собрать, запустить, засеять**

```bash
ssh aventra 'cd /root/english-tutor && docker compose up -d --build && sleep 8 && curl -s http://127.0.0.1:3101/api/health && docker compose exec -T app node --disable-warning=ExperimentalWarning scripts/seed.mjs && T=$(grep ^API_TOKEN= .env | cut -d= -f2) && curl -s -H "Authorization: Bearer $T" http://127.0.0.1:3101/api/status | head -c 400'
```
Expected: `{"ok":true}`, `{ inserted: ~3800, skipped: 0 }`, статус с `total` около 3800.

- [ ] **Step 4: nginx: всё на 3101**

Заменить в `/etc/nginx/sites-enabled/english.evm.im` блоки `root`, `index`, `location /api/`, `location /index.html`, `location /assets/`, `location /` одним:
```nginx
    location / {
        proxy_pass http://127.0.0.1:3101;
        proxy_http_version 1.1;
        proxy_read_timeout 120s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```
(оставить `listen`, `server_name`, ssl-строки, `client_max_body_size`, редирект с 80). Сначала бэкап: `cp /etc/nginx/sites-enabled/english.evm.im /root/english.evm.im.nginx.bak-$(date +%Y%m%d)`. Затем `nginx -t && systemctl reload nginx`.

Проверка снаружи:
```bash
curl -s https://english.evm.im/api/health; curl -s -o /dev/null -w "%{http_code}\n" https://english.evm.im/; curl -s -o /dev/null -w "%{http_code}\n" https://english.evm.im/api/status
```
Expected: `{"ok":true}`, `200`, `401`.

- [ ] **Step 5: Записать в память сессии**

Обновить `/Users/evd3v/.claude/projects/-Users-evd3v-Projects-personal/memory/MEMORY.md`, секция «English Learning App»: строки про `docker compose restart`, `drizzle` и `/var/www/english` относятся к легаси; добавить строку: english-tutor живёт в `/root/english-tutor` (compose, порт 3101, SQLite в `data-db/`), деплой rsync + `docker compose up -d --build`.

---

### Task 12: Клиент для бота и фоновый генератор на work

**Files:**
- Create: `english-tutor/work/tutor.mjs`, `english-tutor/work/generator.mjs`, `english-tutor/work/format.mjs`, `english-tutor/work/com.aventra.english-generator.plist`
- Test: `english-tutor/tests/work-format.test.mjs`, `english-tutor/tests/generator.test.mjs`

**Interfaces:**
- `format.mjs`: `formatNext(body) -> string` (markdown bot-lite: `**жирный**`, `_курсив_`, `||спойлер||`), `formatNeedExplanation(body) -> string` (блок для воркера с промптом и командой сохранения), `formatReview(body) -> string`, `formatNeedTest(body) -> string`, `formatStatus(s) -> string`, `formatDecision(kind, r) -> string`, `parseGrade(text) -> 1|2|3|4|null` («1», «снова», «не понял» = 1; «2», «трудно» = 2; «3», «норм», «понял», «ок» = 3; «4», «легко» = 4).
- `generator.mjs`: `parseTestReply(text) -> {type, sentence, answer}`, `runJobs({ jobs, ask, post, log, max })` (чистая оркестрация, `ask(prompt) -> text`, `post(path, body) -> {status, body}`), `main()`.
- `tutor.mjs`: команды из README (Task 10), читает `~/.claude/english-tutor.env`, печатает готовый текст для чата, коды выхода: 0 ок, 2 ошибка API (текст ошибки в stdout одной строкой «Ошибка: …»).

- [ ] **Step 1: Тест форматирования и разбора оценки**

`tests/work-format.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNext, formatNeedExplanation, formatReview, formatNeedTest, formatStatus, formatDecision, parseGrade } from '../work/format.mjs';

const card = { id: 5, kind: 'word', headword: 'inspect', pos: 'verb', level: 'B2', group_label: 'корень spect' };

test('formatNext: разбор, хвост со статусом и подсказка', () => {
  const t = formatNext({ card, explanation_md: '**inspect** осматривать', queued_left: 120 });
  assert.match(t, /^\*\*inspect\*\* осматривать/);
  assert.match(t, /_слово · B2 · корень spect · в очереди 120_/);
  assert.match(t, /ок \/ знаю \/ вопрос/);
});

test('formatNeedExplanation содержит промпт и команду сохранения', () => {
  const t = formatNeedExplanation({ card, prompt: 'ПРОМПТ', queued_left: 1 });
  assert.match(t, /\[НУЖЕН РАЗБОР\]/);
  assert.match(t, /ПРОМПТ/);
  assert.match(t, /tutor\.mjs explain 5/);
});

test('formatReview: спойлер и шкала', () => {
  const t = formatReview({ card, test: { sentence: 'She inspected it.', answer: 'осматривать / examine' }, wanted_type: 'context', left_today: 4 });
  assert.match(t, /Повторение · осталось 4/);
  assert.match(t, /She inspected it\./);
  assert.match(t, /\|\|осматривать \/ examine\|\|/);
  assert.match(t, /1 снова · 2 трудно · 3 норм · 4 легко/);
  assert.match(formatReview({ card, test: { sentence: 'She _____ it. (осмотрела)', answer: 'inspect' }, wanted_type: 'cloze', left_today: 1 }), /вставь слово/);
});

test('formatNeedTest и formatStatus и formatDecision', () => {
  assert.match(formatNeedTest({ card, prompt: 'P', wanted_type: 'cloze' }), /\[НУЖЕН ТЕСТ\][\s\S]*tutor\.mjs test 5/);
  const s = { all: { total: 3800, learned: 10, learning: 40, known: 500, queued: 3200, shown: 2, due_today: 7 }, word: { total: 2975, learned: 8, learning: 30, known: 400, queued: 2500, shown: 1, due_today: 5 }, pv: { total: 150, learned: 1, learning: 5, known: 50, queued: 90, shown: 1, due_today: 1 }, expr: { total: 675, learned: 1, learning: 5, known: 50, queued: 610, shown: 0, due_today: 1 }, streak: 3 };
  const t = formatStatus(s);
  assert.match(t, /Выучено 10 из 3800/);
  assert.match(t, /ждёт сегодня 7/);
  assert.match(t, /серия 3/);
  assert.match(formatDecision('learn', { status: s }), /В повторении/);
  assert.match(formatDecision('known', { status: s }), /знал/);
});

test('parseGrade', () => {
  assert.equal(parseGrade('1'), 1);
  assert.equal(parseGrade('не понял'), 1);
  assert.equal(parseGrade('снова'), 1);
  assert.equal(parseGrade('2'), 2);
  assert.equal(parseGrade('трудно'), 2);
  assert.equal(parseGrade('3'), 3);
  assert.equal(parseGrade('понял'), 3);
  assert.equal(parseGrade('норм'), 3);
  assert.equal(parseGrade('4'), 4);
  assert.equal(parseGrade('легко'), 4);
  assert.equal(parseGrade('дальше'), null);
});
```

- [ ] **Step 2: format.mjs**

```js
const KIND = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };

function meta(card, tail) {
  return [KIND[card.kind] || card.kind, card.level || null, card.group_label || null, tail].filter(Boolean).join(' · ');
}

export function formatNext(body) {
  return `${body.explanation_md.trim()}\n\n_${meta(body.card, `в очереди ${body.queued_left}`)}_\nок / знаю / вопрос`;
}

export function formatNeedExplanation(body) {
  return [
    `[НУЖЕН РАЗБОР] карточка ${body.card.id} (${body.card.headword}) ещё без разбора. Напиши его строго по промпту ниже, сохрани командой`,
    `  node ~/projects/personal-git/english-tutor/work/tutor.mjs explain ${body.card.id} <<'MD'`,
    `  <текст разбора>`,
    `  MD`,
    `и отправь в чат то, что команда напечатает.`,
    '',
    body.prompt
  ].join('\n');
}

export function formatReview(body) {
  const task = body.wanted_type === 'cloze' || /_{3,}/.test(body.test.sentence) ? 'вставь слово' : 'что значит выделенное';
  return [
    `Повторение · осталось ${body.left_today} · ${task}`,
    '',
    body.test.sentence,
    '',
    `||${body.test.answer}||`,
    '',
    '1 снова · 2 трудно · 3 норм · 4 легко'
  ].join('\n');
}

export function formatNeedTest(body) {
  return [
    `[НУЖЕН ТЕСТ] для карточки ${body.card.id} (${body.card.headword}) нет готового предложения. Составь его по промпту ниже, сохрани командой`,
    `  node ~/projects/personal-git/english-tutor/work/tutor.mjs test ${body.card.id} <<'JSON'`,
    `  {"type": "${body.wanted_type}", "sentence": "...", "answer": "..."}`,
    `  JSON`,
    `и отправь в чат то, что команда напечатает. Если команда ответила «Ошибка: предложение не прошло проверку», составь другое.`,
    '',
    body.prompt
  ].join('\n');
}

export function formatStatus(s) {
  const line = (label, c) => `${label}: выучено ${c.learned}, учу ${c.learning}, знал ${c.known}, отложено ${c.shown}, в очереди ${c.queued}`;
  return [
    `Выучено ${s.all.learned} из ${s.all.total} · учу ${s.all.learning} · ждёт сегодня ${s.all.due_today} · серия ${s.streak}`,
    line('Слова', s.word),
    line('Фразовые', s.pv),
    line('Выражения', s.expr)
  ].join('\n');
}

export function formatDecision(decision, r) {
  const a = r.status.all;
  if (decision === 'learn') return `В повторении. Учу ${a.learning}, выучено ${a.learned}, ждёт сегодня ${a.due_today}.`;
  if (decision === 'known') return `Записал как «знал». Всего таких ${a.known}.`;
  return 'Обсуждаем. Скажи «ок», когда станет понятно.';
}

export function parseGrade(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/^(1|снова|не понял|не поняла|нет)$/.test(t)) return 1;
  if (/^(2|трудно|сложно)$/.test(t)) return 2;
  if (/^(3|норм|нормально|понял|поняла|ок|да)$/.test(t)) return 3;
  if (/^(4|легко|изи)$/.test(t)) return 4;
  return null;
}
```

- [ ] **Step 3: tutor.mjs**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatNext, formatNeedExplanation, formatReview, formatNeedTest, formatStatus, formatDecision, parseGrade } from './format.mjs';

function loadEnv() {
  const file = process.env.ENGLISH_TUTOR_ENV || path.join(os.homedir(), '.claude', 'english-tutor.env');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  if (!env.API_URL || !env.API_TOKEN) throw new Error(`в ${file} нужны API_URL и API_TOKEN`);
  return env;
}

async function call(env, method, p, body) {
  const r = await fetch(`${env.API_URL.replace(/\/$/, '')}${p}`, {
    method,
    headers: { authorization: `Bearer ${env.API_TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(json.error || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return json;
}

const readStdin = () => fs.readFileSync(0, 'utf8');

export async function run(argv, env, io = { call }) {
  const [cmd, ...rest] = argv;
  const c = (m, p, b) => io.call(env, m, p, b);
  switch (cmd) {
    case 'next': {
      const kind = rest[0] ? { word: 'word', слово: 'word', pv: 'pv', фразовый: 'pv', expr: 'expr', выражение: 'expr' }[rest[0]] : '';
      const body = await c('GET', `/api/next${kind ? `?kind=${kind}` : ''}`);
      return body.explanation_md ? formatNext(body) : formatNeedExplanation(body);
    }
    case 'explain': {
      const id = rest[0];
      const md = readStdin();
      const r = await c('POST', `/api/cards/${id}/explanation`, { md });
      const queued_left = (await c('GET', '/api/status')).all.queued;
      return formatNext({ card: r.card, explanation_md: r.card.explanation_md, queued_left });
    }
    case 'learn': case 'known': case 'discuss': {
      const r = await c('POST', `/api/cards/${rest[0] || 'pending'}/${cmd}`);
      return formatDecision(cmd, r);
    }
    case 'note': {
      const id = /^\d+$/.test(rest[0] || '') ? rest.shift() : 'pending';
      const r = await c('POST', `/api/cards/${id}/notes`, { text: rest.join(' ') });
      return `Заметка сохранена к карточке ${r.note.card_id}.`;
    }
    case 'pending': {
      const r = await c('GET', '/api/pending');
      return r.card ? `Текущий: ${r.card.headword} (${r.card.id}, ${r.card.status})` : 'Текущего элемента нет.';
    }
    case 'status':
      return formatStatus(await c('GET', '/api/status'));
    case 'review': {
      const body = await c('GET', '/api/review/next');
      if (!body.card) return 'На сегодня всё повторено.';
      return body.test ? formatReview(body) : formatNeedTest(body);
    }
    case 'test': {
      const id = rest[0] || 'current';
      const payload = JSON.parse(readStdin());
      const r = await c('POST', `/api/review/${id}/test`, payload);
      const body = await c('GET', '/api/review/next');
      if (!body.card) return 'На сегодня всё повторено.';
      return body.test ? formatReview(body) : formatNeedTest(body);
    }
    case 'grade': {
      const rating = parseGrade(rest[0]);
      if (!rating) return 'Ошибка: оценка должна быть 1, 2, 3 или 4 (снова, трудно, норм, легко).';
      const g = await c('POST', `/api/review/${rest[1] || 'current'}/grade`, { rating });
      const head = `Записал ${rating}, следующий раз через ${g.scheduled_days} дн.`;
      if (!g.next_left) return `${head} На сегодня всё.`;
      const body = await c('GET', '/api/review/next');
      return `${head}\n\n${body.test ? formatReview(body) : formatNeedTest(body)}`;
    }
    default:
      return 'Команды: next [word|pv|expr] · explain <id> · learn|known|discuss [id] · note [id] текст · pending · status · review · test [id] · grade <1-4> [id]';
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  run(process.argv.slice(2), loadEnv()).then((text) => {
    process.stdout.write(text + '\n');
  }).catch((e) => {
    process.stdout.write(`Ошибка: ${e.message}\n`);
    process.exit(2);
  });
}
```

- [ ] **Step 4: Тест генератора**

`tests/generator.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTestReply, runJobs } from '../work/generator.mjs';

test('parseTestReply снимает ограждения', () => {
  const r = parseTestReply('```json\n{"type":"context","sentence":"A long sentence with inspect inside it for sure.","answer":"осматривать / examine"}\n```');
  assert.equal(r.type, 'context');
  assert.throws(() => parseTestReply('no json'), /JSON/);
});

test('runJobs: разборы и тесты, повтор теста после 422, лимит', async () => {
  const jobs = {
    explain: [{ card_id: 1, headword: 'inspect', kind: 'word', prompt: 'E1' }, { card_id: 2, headword: 'respect', kind: 'word', prompt: 'E2' }],
    tests: [{ card_id: 1, headword: 'inspect', kind: 'word', type: 'context', prompt: 'T1' }]
  };
  const asked = [];
  const posted = [];
  let testTries = 0;
  const ask = async (prompt) => {
    asked.push(prompt);
    if (prompt.startsWith('E')) return `разбор для ${prompt} достаточной длины`;
    testTries++;
    return JSON.stringify({ type: 'context', sentence: `try ${testTries}`, answer: 'a' });
  };
  const post = async (p, body) => {
    posted.push([p, body]);
    if (p.endsWith('/test') && body.sentence === 'try 1') return { status: 422, body: { error: 'length 2' } };
    return { status: 200, body: {} };
  };
  const done = await runJobs({ jobs, ask, post, log: { info() {}, error() {} }, max: 10 });
  assert.deepEqual(done, { explained: 2, tested: 1, failed: 0 });
  assert.equal(asked.length, 4);
  assert.match(asked[3], /^T1[\s\S]*length 2/);
  assert.deepEqual(posted[0], ['/api/cards/1/explanation', { md: 'разбор для E1 достаточной длины' }]);
  const limited = await runJobs({ jobs, ask, post, log: { info() {}, error() {} }, max: 1 });
  assert.deepEqual(limited, { explained: 1, tested: 0, failed: 0 });
});
```

- [ ] **Step 5: generator.mjs**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_BIN || path.join(HOME, '.local', 'bin', 'claude');
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';

function loadEnv() {
  const file = process.env.ENGLISH_TUTOR_ENV || path.join(HOME, '.claude', 'english-tutor.env');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function pickToken() {
  const script = path.join(HOME, '.claude', 'accounts', 'cs-usage.py');
  if (!fs.existsSync(script)) return null;
  const r = spawnSync('python3', [script, 'picktoken'], { encoding: 'utf8', timeout: 90000 });
  const token = (r.stdout || '').trim().split('\n').pop();
  return r.status === 0 && token.startsWith('sk-ant-') ? token : null;
}

function askClaude(prompt) {
  const token = pickToken();
  const r = spawnSync(CLAUDE, ['-p', prompt, '--output-format', 'json', '--model', MODEL, '--no-session-persistence', '--max-turns', '1'], {
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 180000,
    env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`, CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1', ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}) }
  });
  if (r.status !== 0) throw new Error(`claude exit ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
  const json = JSON.parse(r.stdout);
  if (json.is_error) throw new Error(`claude: ${String(json.result).slice(0, 300)}`);
  return String(json.result || '');
}

export function parseTestReply(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('в ответе нет JSON');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  return { type: obj.type, sentence: String(obj.sentence || '').trim(), answer: String(obj.answer || '').trim() };
}

export async function runJobs({ jobs, ask, post, log, max = 10 }) {
  const result = { explained: 0, tested: 0, failed: 0 };
  let budget = max;
  for (const job of jobs.explain) {
    if (budget-- <= 0) return result;
    try {
      const md = (await ask(job.prompt)).replace(/^```(?:markdown)?\n?|```$/g, '').trim();
      const r = await post(`/api/cards/${job.card_id}/explanation`, { md });
      if (r.status !== 200) throw new Error(`${r.status} ${r.body?.error || ''}`);
      result.explained++;
      log.info(`explain ${job.headword}: ok`);
    } catch (e) {
      result.failed++;
      log.error(`explain ${job.headword}: ${e.message}`);
    }
  }
  for (const job of jobs.tests) {
    if (budget-- <= 0) return result;
    try {
      let payload = parseTestReply(await ask(job.prompt));
      let r = await post(`/api/review/${job.card_id}/test`, payload);
      if (r.status === 422) {
        payload = parseTestReply(await ask(`${job.prompt}\n\nПредыдущая попытка отклонена: ${r.body?.error || ''}. Составь другое предложение.`));
        r = await post(`/api/review/${job.card_id}/test`, payload);
      }
      if (r.status !== 200) throw new Error(`${r.status} ${r.body?.error || ''}`);
      result.tested++;
      log.info(`test ${job.headword}: ok`);
    } catch (e) {
      result.failed++;
      log.error(`test ${job.headword}: ${e.message}`);
    }
  }
  return result;
}

export async function main() {
  const env = loadEnv();
  const base = env.API_URL.replace(/\/$/, '');
  const headers = { authorization: `Bearer ${env.API_TOKEN}`, 'content-type': 'application/json' };
  const jobsRes = await fetch(`${base}/api/jobs`, { headers });
  if (!jobsRes.ok) throw new Error(`jobs HTTP ${jobsRes.status}`);
  const jobs = await jobsRes.json();
  const post = async (p, body) => {
    const r = await fetch(`${base}${p}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const log = { info: (m) => console.log(`${new Date().toISOString()} ${m}`), error: (m) => console.error(`${new Date().toISOString()} ${m}`) };
  const out = await runJobs({ jobs, ask: async (p) => askClaude(p), post, log, max: Number(process.env.GENERATOR_MAX) || 10 });
  log.info(`done: explain ${out.explained}, tests ${out.tested}, failed ${out.failed}, pending explain ${jobs.explain.length}, tests ${jobs.tests.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => {
    console.error(`${new Date().toISOString()} generator failed: ${e.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 6: plist**

`work/com.aventra.english-generator.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.aventra.english-generator</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/evd3v/projects/personal-git/english-tutor/work/generator.mjs</string>
  </array>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/Users/evd3v/.local/var/english-generator.log</string>
  <key>StandardErrorPath</key><string>/Users/evd3v/.local/var/english-generator.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>/Users/evd3v</string>
  </dict>
</dict>
</plist>
```

- [ ] **Step 7: Запустить тесты, commit**

Run: `npm test` → PASS.
```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/work english-tutor/tests/work-format.test.mjs english-tutor/tests/generator.test.mjs
git commit -m "feat(english-tutor): tutor.mjs для бота, фоновый генератор и plist

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin good
```
(ветка `good` это текущая ветка репозитория personal; на work клонируется она же.)

- [ ] **Step 8: Развернуть на work**

```bash
ssh work 'set -e; cd ~/projects; test -d personal-git || git clone --filter=blob:none --sparse -b good git@github.com:evd3v/snake-game.git personal-git; cd personal-git && git sparse-checkout set english-tutor && git pull -q; ls english-tutor/work; mkdir -p ~/.local/var'
```
Создать `~/.claude/english-tutor.env` на work (токен взять из `/root/english-tutor/.env` на aventra, передать через ssh, в чат не печатать):
```bash
T=$(ssh aventra 'grep ^API_TOKEN= /root/english-tutor/.env | cut -d= -f2'); ssh work "printf 'API_URL=https://english.evm.im\nAPI_TOKEN=%s\n' '$T' > ~/.claude/english-tutor.env && chmod 600 ~/.claude/english-tutor.env && node ~/projects/personal-git/english-tutor/work/tutor.mjs status"
```
Expected: строка «Выучено 0 из ~3800 …».

Запустить генератор один раз вручную и поставить в launchd:
```bash
ssh work 'GENERATOR_MAX=3 node ~/projects/personal-git/english-tutor/work/generator.mjs; cp ~/projects/personal-git/english-tutor/work/com.aventra.english-generator.plist ~/Library/LaunchAgents/ && launchctl bootout gui/$(id -u)/com.aventra.english-generator 2>/dev/null; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aventra.english-generator.plist && launchctl list | grep english-generator'
```
Expected: три строки `explain …: ok`, строка `done: explain 3 …`; агент в списке. Проверить на сервере: `curl -s -H "Authorization: Bearer $T" https://english.evm.im/api/cards/1 | head -c 300` содержит `explanation_md`.

---

### Task 13: bot-lite: спойлер в конвертере markdown

**Files:**
- Modify: `/Users/evd3v/Projects/edumotion/ops/bot-lite/bot-lite.mjs` (функция `mdToTelegramHtml`, около строки 1440, и блок `export {` в конце файла)
- Test: `/Users/evd3v/Projects/edumotion/ops/bot-lite/tests/md-spoiler.test.mjs`

- [ ] **Step 1: Тест**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mdToTelegramHtml } from '../bot-lite.mjs';

test('||текст|| становится tg-spoiler, жирный внутри работает, одиночный | не трогаем', () => {
  assert.equal(mdToTelegramHtml('Q\n\n||осматривать / examine||\n\n1 снова'), 'Q\n\n<tg-spoiler>осматривать / examine</tg-spoiler>\n\n1 снова');
  assert.equal(mdToTelegramHtml('||**a**||'), '<tg-spoiler><b>a</b></tg-spoiler>');
  assert.equal(mdToTelegramHtml('a | b'), 'a | b');
  assert.equal(mdToTelegramHtml('||x'), '||x');
});
```

Run: `cd /Users/evd3v/Projects/edumotion/ops/bot-lite && node --test tests/md-spoiler.test.mjs`
Expected: FAIL, `mdToTelegramHtml` не экспортируется.

- [ ] **Step 2: Правка**

В `mdToTelegramHtml` после строки `.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')` добавить первой в цепочке (до жирного):
```js
    .replace(/\|\|([^|\n]+(?:\|[^|\n]+)*)\|\|/g, '<tg-spoiler>$1</tg-spoiler>')
```
Точнее, цепочка должна начинаться так:
```js
  s = s
    .replace(/\|\|([^|\n]+(?:\|[^|\n]+)*)\|\|/g, '<tg-spoiler>$1</tg-spoiler>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
```
В блок `export {` добавить `mdToTelegramHtml,`.

- [ ] **Step 3: Тесты всего bot-lite**

Run: `cd /Users/evd3v/Projects/edumotion/ops/bot-lite && npm test`
Expected: PASS, включая новый тест. Затем `node /Users/evd3v/Projects/edumotion/tools/bot-lite-release.mjs check` → без ошибок.

- [ ] **Step 4: Commit и push (только свои файлы; чужие незакоммиченные не трогать)**

```bash
cd /Users/evd3v/Projects/edumotion
git add ops/bot-lite/bot-lite.mjs ops/bot-lite/tests/md-spoiler.test.mjs
git commit -m "feat(bot-lite): спойлер ||текст|| в конвертере markdown для Telegram

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin HEAD
```
Если ветка разошлась с origin, а дерево грязное, пушить через отдельное рабочее дерево (правило из CLAUDE.md).

- [ ] **Step 5: Установить на work**

```bash
ssh work 'cd ~/projects/edumotion && git pull -q && node tools/bot-lite-release.mjs install --restart-idle && node tools/bot-lite-release.mjs status'
```
Expected: новый release с коммитом спойлера, бот general перезапущен (или в `busy`, тогда перезапустить позже, когда очередь пуста). Проверка: `ssh work 'grep -c tg-spoiler ~/.claude/bot-lite/current/bot-lite.mjs'` → `1` и больше.

---

### Task 14: Подключение чата: доступ, память general, TUTOR.md, сквозная проверка

**Files:**
- Create: `english-tutor/work/TUTOR.md`
- На work: `~/.claude/channels/telegram-general/access.json`, `~/.claude/bot-lite/memory/general/00-operating-memory.md`

- [ ] **Step 1: TUTOR.md**

```
# Репетитор английского (чат -5548139504)

В этом чате ты репетитор Евгения. Состояние живёт на сервере, к нему одна дверь:
`node ~/projects/personal-git/english-tutor/work/tutor.mjs <команда>`. Ничего «по памяти» не считать,
не придумывать номера карточек и статусы: только то, что напечатала команда. Текст, который печатает
команда, отправляй в чат как есть (это готовый markdown), при необходимости добавляя одну строку от себя.

## Команды Евгения → что делать

- `/next`, «дальше», «ещё», «следующее» → `tutor.mjs next`. `/next слово|фразовый|выражение` → `tutor.mjs next word|pv|expr`.
  Если команда напечатала `[НУЖЕН РАЗБОР]`: напиши разбор строго по промпту из вывода, сохрани его командой
  `tutor.mjs explain <id>` (текст через heredoc в stdin), отправь в чат то, что напечатала команда сохранения.
- «ок», «понял», «ясно», 👍 (приходит как «ок» с реплаем на сообщение) → `tutor.mjs learn`. Ответ команды в чат.
- «знаю», «знал» → `tutor.mjs known`.
- Вопрос по текущему элементу («а чем от …», «пример с …», «почему …») → сначала `tutor.mjs discuss`, потом объясни сам
  по данным разбора и своим знаниям; если разницы или этимологии в данных нет, скажи об этом прямо («в списках этого нет,
  по моему пониманию …»), не выдумывай. Закончи вопросом «ок?». После «ок»: `tutor.mjs learn`, затем
  `tutor.mjs note "<итог объяснения в одну-две строки>"`.
- `/review`, «повторение», «проверь» → `tutor.mjs review`. Если напечатано `[НУЖЕН ТЕСТ]`: составь предложение по промпту,
  сохрани `tutor.mjs test <id>` (JSON в stdin), отправь вывод. Если команда ответила «Ошибка: предложение не прошло проверку», составь другое.
- Ответ на проверку: цифра 1-4 или слово («снова», «трудно», «норм», «легко», «не понял» = 1, «понял» = 3) → `tutor.mjs grade <оценка>`.
  Команда сама печатает следующую карточку; отправляй её вывод. «стоп», «хватит» → просто ответь «Остановились», ничего не вызывай.
- `/status`, «статус», «сколько» → `tutor.mjs status`.
- «пропусти», «отложи» → ничего не вызывать, ответить «Отложил, вернётся из списка на дашборде», следующий `/next` даст новый элемент.

## Стиль

По-русски, коротко, без длинного тире, без вводных слов. Примеры только на английском. Одно сообщение на одно действие.
Не предлагать расписание и не напоминать «пора заниматься»: Евгений дёргает сам.
Если команда напечатала «Ошибка: …», покажи эту строку и ничего не додумывай.
```

- [ ] **Step 2: Доступ и память на work**

Добавить группу в `~/.claude/channels/telegram-general/access.json` (бэкап рядом):
```bash
ssh work 'cd ~/.claude/channels/telegram-general && cp access.json access.json.bak-english-$(date +%Y%m%d) && python3 - <<EOF
import json
p="access.json"; a=json.load(open(p))
a.setdefault("groups",{})["-5548139504"]={"requireMention": False, "allowFrom": ["875484579"]}
json.dump(a, open(p,"w"), ensure_ascii=False, indent=2)
print(a["groups"])
EOF'
```
Добавить абзац в `~/.claude/bot-lite/memory/general/00-operating-memory.md` (бэкап рядом), в конец файла:
```
## Репетитор английского (13.09.2026)
Если в промпте `chat_id=-5548139504`: это чат обучения английскому. Прочитай `~/projects/personal-git/english-tutor/work/TUTOR.md` и работай строго по нему. Все действия только через `node ~/projects/personal-git/english-tutor/work/tutor.mjs …`, вывод команды отправляй как есть.
```
```bash
ssh work 'f=~/.claude/bot-lite/memory/general/00-operating-memory.md; cp $f $f.bak-english-$(date +%Y%m%d); printf "\n## Репетитор английского (13.09.2026)\nЕсли в промпте \`chat_id=-5548139504\`: это чат обучения английскому. Прочитай \`~/projects/personal-git/english-tutor/work/TUTOR.md\` и работай строго по нему. Все действия только через \`node ~/projects/personal-git/english-tutor/work/tutor.mjs …\`, вывод команды отправляй как есть.\n" >> $f; tail -4 $f; ~/.claude/bot-lite/current/memory-budget-check.sh 2>/dev/null | tail -2'
```
Файлы access.json и память читаются на каждом сообщении, перезапуск бота не нужен. Убедиться, что бот general добавлен в группу -5548139504 (Евгений создал группу; если бота там нет, попросить добавить).

- [ ] **Step 3: Commit TUTOR.md и обновить клон на work**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/work/TUTOR.md
git commit -m "docs(english-tutor): инструкция репетитора для бота general

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin good
ssh work 'cd ~/projects/personal-git && git pull -q && test -f english-tutor/work/TUTOR.md && echo ok'
```

- [ ] **Step 4: Сквозная проверка в группе (руками Евгения, я смотрю логи)**

Попросить Евгения написать в группу `/next`, потом «ок», потом `/status`, потом `/review` (пока ничего не просрочено, ответ «На сегодня всё повторено»). Смотреть:
```bash
ssh work 'tail -30 ~/.claude/bot-lite/logs/general.log 2>/dev/null || ls ~/.claude/bot-lite | grep -i log'
ssh aventra 'cd /root/english-tutor && docker compose logs --tail 30 app | grep -E "GET|POST"'
```
Ожидаемо: сообщение с разбором в чате, «В повторении…», статус. Если бот молчит: проверить `access.json` (группа, requireMention false), что бот в группе, и что задача не в `busy`.

---

### Task 15: Блиц известных слов

**Files:** артефакт-страница (публикуется инструментом Artifact), никаких файлов в репозитории кроме результата `english-tutor/data/known-blitz.json`.

- [ ] **Step 1: Загрузить скиллы и собрать страницу**

Загрузить `artifact-design` и `artifact-capabilities` (нужна capability `db` для сохранения отметок). Страница: заголовок, три вкладки по потокам (слова B2, слова C1, фразовые, выражения) с чипами-заголовками (`GET /api/cards?limit=5000` не доступен из артефакта из-за CSP, поэтому список слов встраивается в страницу из `data/queue.json` при сборке: `[{id, kind, headword, level}]`, id берутся с сервера через `GET https://english.evm.im/api/cards?limit=5000` с токеном при сборке страницы, не из браузера). Нажатие на чип переключает «знаю» и сохраняет документ `blitz/known` = `{ids: [...]}` в базе артефакта (по контракту скилла). Счётчик отмеченных вверху, кнопка «сбросить».

- [ ] **Step 2: Опубликовать, дать ссылку Евгению, дождаться сообщения «готово»**

- [ ] **Step 3: Забрать отметки и отправить на сервер**

`Artifact` `action: read_db`, `db_op: get`, `collection: blitz`, `doc_id: known` → сохранить как `english-tutor/data/known-blitz.json`, затем:
```bash
cd /Users/evd3v/Projects/personal/english-tutor
T=$(ssh aventra 'grep ^API_TOKEN= /root/english-tutor/.env | cut -d= -f2')
node -e "const ids=require('./data/known-blitz.json').ids; fetch('https://english.evm.im/api/cards/known-bulk',{method:'POST',headers:{authorization:'Bearer $T','content-type':'application/json'},body:JSON.stringify({ids})}).then(r=>r.json()).then(console.log)"
node ~/Projects/personal/english-tutor/work/tutor.mjs status 2>/dev/null || ssh work 'node ~/projects/personal-git/english-tutor/work/tutor.mjs status'
```
Expected: `{ updated: N }`, статус показывает «знал N».

- [ ] **Step 4: Commit**

```bash
cd /Users/evd3v/Projects/personal
git add english-tutor/data/known-blitz.json
git commit -m "data(english-tutor): отметки блица известных слов

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin good
```

Запасной вариант без артефакта: вывести слова порциями по 100 в чат, Евгений отвечает номерами, я собираю `ids` руками.
