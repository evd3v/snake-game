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
