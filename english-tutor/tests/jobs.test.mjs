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
