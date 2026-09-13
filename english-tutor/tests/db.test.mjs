import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
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

test('миграция старой базы: колонки stream/known_at/topic добавляются, индекс создаётся', () => {
  const { DatabaseSync } = require('node:sqlite');
  const file = `/tmp/et-migrate-${process.pid}.sqlite`;
  fs.rmSync(file, { force: true });
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE cards (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, headword TEXT NOT NULL,
    pos TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT '', source_json TEXT NOT NULL, group_key TEXT, group_label TEXT,
    order_index INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'queued', explanation_md TEXT, shown_at TEXT, decided_at TEXT,
    fsrs_due TEXT, fsrs_stability REAL NOT NULL DEFAULT 0, fsrs_difficulty REAL NOT NULL DEFAULT 0,
    fsrs_elapsed_days INTEGER NOT NULL DEFAULT 0, fsrs_scheduled_days INTEGER NOT NULL DEFAULT 0, fsrs_reps INTEGER NOT NULL DEFAULT 0,
    fsrs_lapses INTEGER NOT NULL DEFAULT 0, fsrs_learning_steps INTEGER NOT NULL DEFAULT 0, fsrs_state INTEGER NOT NULL DEFAULT 0,
    fsrs_last_review TEXT, UNIQUE (kind, headword, pos))`);
  old.prepare(`INSERT INTO cards (kind, headword, source_json, order_index) VALUES ('word', 'exceed', '{}', 0)`).run();
  old.close();
  const db = openDb(file);
  const cols = db.prepare('PRAGMA table_info(cards)').all().map((c) => c.name);
  for (const col of ['known_at', 'stream', 'topic', 'freq_rank']) assert.ok(cols.includes(col), col);
  assert.equal(db.prepare(`SELECT stream FROM cards WHERE headword = 'exceed'`).get().stream, 'main');
  assert.ok(db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='cards_stream'`).get());
  db.close();
  fs.rmSync(file, { force: true });
});
