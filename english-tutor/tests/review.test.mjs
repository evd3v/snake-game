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
