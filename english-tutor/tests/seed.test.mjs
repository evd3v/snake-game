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
