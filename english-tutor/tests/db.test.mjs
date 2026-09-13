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
