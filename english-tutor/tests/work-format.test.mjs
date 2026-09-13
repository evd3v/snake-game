import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNext, formatNeedExplanation, formatReview, formatNeedTest, formatStatus, formatDecision, parseGrade } from '../work/format.mjs';

const card = { id: 5, kind: 'word', headword: 'inspect', pos: 'verb', level: 'B2', group_label: 'корень spect' };

test('formatNext: пометка о нерешённом слове', () => {
  const t = formatNext({ card, explanation_md: '**inspect** осматривать', queued_left: 5, repeat: true });
  assert.match(t, /^_это слово ещё не решено, поэтому оно снова первым_\n\n\*\*inspect\*\*/);
  assert.ok(!/не решено/.test(formatNext({ card, explanation_md: '**inspect** осматривать', queued_left: 5 })));
});

test('formatNext: разбор, хвост со статусом и кнопки', () => {
  const t = formatNext({ card, explanation_md: '**inspect** осматривать', queued_left: 120 });
  assert.match(t, /^\*\*inspect\*\* осматривать/);
  assert.match(t, /_слово · B2 · корень spect · в очереди 120_/);
  assert.match(t, /\[\[BUTTONS: 👍 Учу \| 🤝 Знаю\]\]$/);
});

test('formatNeedExplanation содержит промпт и команду сохранения', () => {
  const t = formatNeedExplanation({ card, prompt: 'ПРОМПТ', queued_left: 1 });
  assert.match(t, /\[НУЖЕН РАЗБОР\]/);
  assert.match(t, /ПРОМПТ/);
  assert.match(t, /tutor\.mjs explain 5/);
});

test('formatReview: спойлер и шкала', () => {
  const t = formatReview({ card, test: { sentence: 'She inspected it.', answer: 'осматривать / examine' }, wanted_type: 'context', left_today: 4 });
  assert.match(t, /\*\*Повторение\*\* · осталось 4/);
  assert.match(t, /^> She inspected it\.$/m);
  assert.match(t, /She inspected it\./);
  assert.match(t, /\|\|осматривать \/ examine\|\|/);
  assert.match(t, /\[\[BUTTONS: 1 снова \| 2 трудно \/\/ 3 норм \| 4 легко\]\]$/);
  assert.match(formatReview({ card, test: { sentence: 'She _____ it. (осмотрела)', answer: 'inspect' }, wanted_type: 'cloze', left_today: 1 }), /на месте пропуска/);
});

test('formatNeedTest и formatStatus и formatDecision', () => {
  assert.match(formatNeedTest({ card, prompt: 'P', wanted_type: 'cloze' }), /\[\[НУЖЕН ТЕСТ\]|\[НУЖЕН ТЕСТ\][\s\S]*tutor\.mjs test 5/);
  const s = { all: { total: 3800, learned: 10, learning: 40, known: 500, queued: 3200, shown: 2, due_today: 7 }, word: { total: 2975, learned: 8, learning: 30, known: 400, queued: 2500, shown: 1, due_today: 5 }, pv: { total: 150, learned: 1, learning: 5, known: 50, queued: 90, shown: 1, due_today: 1 }, expr: { total: 675, learned: 1, learning: 5, known: 50, queued: 610, shown: 0, due_today: 1 }, streak: 3 };
  const t = formatStatus({ ...s, basic: { total: 3484, known: 2383, learning: 20, learned: 0, queued: 1050, shown: 0, suspended: 0, due_today: 0 } });
  assert.match(t, /^\*\*Английский\*\*$/m);
  assert.match(t, /^Учу сейчас: \*\*40\*\*$/m);
  assert.match(t, /^Выучено: \*\*10\*\* _\(повтор реже, чем раз в 3 недели\)_$/m);
  assert.match(t, /^Ждёт повторения сегодня: \*\*7\*\*$/m);
  assert.match(t, /[▓░]{12} разобрано 600 из 3800 \(16%\)/);
  assert.match(t, /^слова B2-C1 — 2500$/m);
  assert.match(t, /^фразовые глаголы — 90$/m);
  assert.match(t, /^бытовые слова — 1050 _\(пачками, кнопка «Аудит»\)_$/m);
  assert.match(t, /^Отмечено знакомыми: 2883$/m, '500 из основной очереди плюс 2383 бытовых');
  assert.match(t, /_серия: 3 дней подряд_/);
  assert.match(t, /\[\[BUTTONS: Дальше \| Повторение \/\/ Аудит\]\]$/);
  const noBasic = formatStatus(s);
  assert.ok(!/бытовые слова/.test(noBasic));
  assert.match(formatDecision('learn', { status: s }), /В повторении/);
  assert.match(formatDecision('known', { status: s }), /знакомое.*3 месяца/);
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

test('formatAudit: нумерованная пачка и кнопки, formatAuditResult, bar', async () => {
  const { formatAudit, formatAuditResult, bar } = await import('../work/format.mjs');
  const t = formatAudit({ items: [{ n: 1, headword: 'kettle', ru: 'чайник' }, { n: 2, headword: 'sleeve', ru: 'рукав' }], left: 2600 });
  assert.match(t, /\*\*Аудит бытового слоя\*\* · осталось 2600/);
  assert.match(t, /^> 1 kettle \(чайник\) · 2 sleeve \(рукав\)$/m);
  assert.match(t, /\[\[BUTTONS: Все знаю \| Стоп\]\]$/);
  assert.equal(formatAudit({ items: [], left: 0 }), 'Бытовой слой проверен целиком.');
  assert.match(formatAuditResult({ known: 24, moved: ['kettle'], left: 2575 }), /Записал знакомыми 24[\s\S]*kettle/);
  assert.ok(!/В очередь/.test(formatAuditResult({ known: 25, moved: [], left: 2575 })));
  assert.equal(bar(0, 10, 4), '░░░░');
  assert.equal(bar(10, 10, 4), '▓▓▓▓');
  assert.equal(bar(5, 10, 4), '▓▓░░');
  assert.equal(bar(1, 0, 3), '░░░');
});

test('formatNext: ссылка на озвучку только когда она есть в данных', async () => {
  const { formatNext } = await import('../work/format.mjs');
  const withAudio = formatNext({ card: { ...card, source: { audio: 'https://example.com/exceed.mp3' } }, explanation_md: '**exceed** превышать', queued_left: 10 });
  assert.match(withAudio, /\[🔊 послушать\]\(https:\/\/example\.com\/exceed\.mp3\)\n\[\[BUTTONS/);
  const without = formatNext({ card: { ...card, source: {} }, explanation_md: '**exceed** превышать', queued_left: 10 });
  assert.ok(!/🔊/.test(without));
});

test('formatReview: подсказка для pair', async () => {
  const { formatReview } = await import('../work/format.mjs');
  const t = formatReview({ card, test: { type: 'pair', sentence: 'The bill must not _____ the agreed sum here. (surpass / exceed)', answer: 'exceed' }, wanted_type: 'pair', left_today: 2 });
  assert.match(t, /какой из двух вариантов сюда подходит/);
  assert.match(t, /\(surpass \/ exceed\)/);
});
