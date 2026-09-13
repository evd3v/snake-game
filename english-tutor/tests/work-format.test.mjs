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
