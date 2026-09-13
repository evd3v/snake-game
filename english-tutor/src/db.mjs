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
  // миграция 13.09.2026: «знаю» кладёт карточку в повторение зрелой, отметка хранится в known_at
  const cols = db.prepare('PRAGMA table_info(cards)').all().map((c) => c.name);
  if (!cols.includes('known_at')) db.exec('ALTER TABLE cards ADD COLUMN known_at TEXT');
  // миграция 13.09.2026: бытовой слой (A1-B1 и повседневные слова) живёт отдельным потоком
  if (!cols.includes('stream')) db.exec(`ALTER TABLE cards ADD COLUMN stream TEXT NOT NULL DEFAULT 'main'`);
  if (!cols.includes('topic')) db.exec('ALTER TABLE cards ADD COLUMN topic TEXT');
  if (!cols.includes('freq_rank')) db.exec('ALTER TABLE cards ADD COLUMN freq_rank INTEGER');
  db.exec('CREATE INDEX IF NOT EXISTS cards_stream ON cards(stream, status, order_index)');
  // миграция 13.09.2026: у типов теста появился 'pair' (различение пары), а старая
  // таблица держала CHECK на два типа. Пересобираем её: там только заготовки предложений.
  const testsSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tests'`).get()?.sql || '';
  if (/CHECK \(type IN \('context','cloze'\)\)/.test(testsSql)) {
    db.exec(`BEGIN;
      CREATE TABLE tests_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL REFERENCES cards(id),
        type TEXT NOT NULL,
        sentence TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        used_at TEXT
      );
      INSERT INTO tests_new SELECT id, card_id, type, sentence, answer, created_at, used_at FROM tests;
      DROP TABLE tests;
      ALTER TABLE tests_new RENAME TO tests;
      CREATE INDEX IF NOT EXISTS tests_card_unused ON tests(card_id, used_at);
      COMMIT;`);
  }
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
