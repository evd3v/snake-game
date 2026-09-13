import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFsrsFields, applyRating, isMature, Rating, State, MATURE_DAYS, matureFsrsFields, KNOWN_DAYS } from '../src/fsrs.mjs';

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

test('matureFsrsFields: зрелая карточка, срок через 90 дней, дальше FSRS работает', () => {
  const f = matureFsrsFields(t0);
  assert.equal(KNOWN_DAYS, 90);
  assert.equal(f.fsrs_state, State.Review);
  assert.equal(isMature(f), true);
  assert.equal(f.fsrs_due, '2026-12-12T10:00:00.000Z');
  const next = applyRating(f, Rating.Good, new Date('2026-12-12T10:00:00.000Z')).fields;
  assert.ok(next.fsrs_scheduled_days > 90);
  const again = applyRating(f, Rating.Again, new Date('2026-12-12T10:00:00.000Z')).fields;
  assert.equal(again.fsrs_state, State.Relearning);
});
