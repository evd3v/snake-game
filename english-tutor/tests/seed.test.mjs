import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';

const item = (headword, kind = 'word') => ({ kind, headword, pos: 'verb', level: 'B2', group_key: null, group_label: null, source: { definition: 'd' } });

test('seed вставляет по порядку и идемпотентен', () => {
  const db = openDb(':memory:');
  const r1 = seed(db, [item('inspect'), item('respect')]);
  assert.deepEqual(r1, { inserted: 2, skipped: 0, preknown: 0 });
  const r2 = seed(db, [item('inspect'), item('respect'), item('bleak')]);
  assert.deepEqual(r2, { inserted: 1, skipped: 2, preknown: 0 });
  const rows = db.prepare('SELECT headword, order_index, status, source_json FROM cards ORDER BY order_index').all();
  assert.deepEqual(rows.map((r) => [r.headword, r.order_index, r.status]), [['inspect', 0, 'queued'], ['respect', 1, 'queued'], ['bleak', 2, 'queued']]);
  assert.equal(JSON.parse(rows[0].source_json).definition, 'd');
});

test('seed: preknown-карточки сразу знакомые и в аудит не попадают', async () => {
  const { auditBatch } = await import('../src/queue.mjs');
  const db = openDb(':memory:');
  const basic = (h, preknown) => ({ ...item(h), stream: 'basic', preknown });
  const r = seed(db, [basic('you', true), basic('carrot', true), basic('mushroom', false)]);
  assert.deepEqual(r, { inserted: 3, skipped: 0, preknown: 2 });
  const rows = db.prepare('SELECT headword, status FROM cards ORDER BY order_index').all().map((r) => [r.headword, r.status]);
  assert.deepEqual(rows, [['you', 'known'], ['carrot', 'known'], ['mushroom', 'queued']]);
  assert.deepEqual(auditBatch(db).items.map((i) => i.headword), ['mushroom']);
  assert.ok(db.prepare(`SELECT decided_at FROM cards WHERE headword = 'you'`).get().decided_at);
});
