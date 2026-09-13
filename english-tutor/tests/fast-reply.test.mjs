import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyReply, run, FALLBACK_EXIT } from '../work/tutor.mjs';

test('classifyReply: команды обучения распознаются без модели', () => {
  assert.deepEqual(classifyReply('/next'), { cmd: 'next', args: [] });
  assert.deepEqual(classifyReply('дальше'), { cmd: 'next', args: [] });
  assert.deepEqual(classifyReply('/next фразовый'), { cmd: 'next', args: ['фразовый'] });
  assert.deepEqual(classifyReply('дальше базовое'), { cmd: 'next', args: ['базовое'] });
  assert.deepEqual(classifyReply('/review'), { cmd: 'review', args: [] });
  assert.deepEqual(classifyReply('/status'), { cmd: 'status', args: [] });
  assert.deepEqual(classifyReply('Аудит'), { cmd: 'audit', args: [] });
  assert.deepEqual(classifyReply('👍 Учу'), { cmd: 'learn', args: [] });
  assert.deepEqual(classifyReply('ок'), { cmd: 'learn', args: [] });
  assert.deepEqual(classifyReply('🤝 Знаю'), { cmd: 'known', args: [] });
  assert.deepEqual(classifyReply('пропусти'), { cmd: 'skip', args: [] });
  assert.deepEqual(classifyReply('стоп'), { cmd: 'stop', args: [] });
  assert.deepEqual(classifyReply('все знаю'), { cmd: 'audit-mark', args: [] });
  assert.equal(FALLBACK_EXIT, 3);
});

test('classifyReply: цифры это оценка или номера пачки, вопрос уходит модели', () => {
  assert.deepEqual(classifyReply('3', { review: true }), { cmd: 'grade', args: ['3'] });
  assert.deepEqual(classifyReply('не понял', { review: true }), { cmd: 'grade', args: ['не понял'] });
  assert.deepEqual(classifyReply('2 7 15', { audit: true }), { cmd: 'audit-mark', args: ['2', '7', '15'] });
  assert.deepEqual(classifyReply('3', { audit: true }), { cmd: 'audit-mark', args: ['3'] }, 'при открытой пачке цифра это номер');
  assert.equal(classifyReply('2 7 15', {}), null, 'без открытой пачки номера непонятны');
  assert.equal(classifyReply('а чем exceed от surpass'), null);
  assert.equal(classifyReply('разбери mushroom'), null);
  assert.equal(classifyReply(''), null);
  assert.equal(classifyReply('x'.repeat(80)), null);
});

test('run reply: выполняет команду, отдаёт fallback на вопрос и на отсутствующий разбор', async () => {
  const calls = [];
  const io = {
    call: async (env, method, p, body) => {
      calls.push([method, p]);
      if (p === '/api/status') return { open: { review: false, audit: false }, all: { learning: 1, learned: 0, known: 0, due_today: 0, total: 10, queued: 5, shown: 0 }, word: { total: 10, queued: 5, learning: 1, learned: 0, known: 0, shown: 0 }, pv: { total: 0, queued: 0, learning: 0, learned: 0, known: 0, shown: 0 }, expr: { total: 0, queued: 0, learning: 0, learned: 0, known: 0, shown: 0 }, streak: 0 };
      if (p.endsWith('/learn')) return { card: { headword: 'exceed', status: 'learning' }, status: { all: { learning: 1, learned: 0, known: 0, due_today: 1 } } };
      if (p.startsWith('/api/next')) return { card: { headword: 'exceed', kind: 'word', level: 'B2', source: {} }, explanation_md: '**exceed** превышать', queued_left: 5 };
      throw new Error(`unexpected ${p}`);
    }
  };
  const learned = await run(['reply', '👍', 'Учу'], {}, io);
  assert.match(learned, /В повторении/);
  assert.deepEqual(calls.map((c) => c[1]), ['/api/status', '/api/cards/pending/learn']);
  const question = await run(['reply', 'а', 'чем', 'от', 'surpass'], {}, io);
  assert.deepEqual(question, { fallback: true });
  const stopped = await run(['reply', 'стоп'], {}, io);
  assert.match(stopped, /Остановились/);
  const noExplanation = {
    call: async (env, method, p) => {
      if (p === '/api/status') return { open: {} };
      if (p.startsWith('/api/next')) return { card: { id: 7, headword: 'bleak', kind: 'word', level: 'C1', source: {} }, explanation_md: null, prompt: 'ПРОМПТ', queued_left: 3 };
      throw new Error(`unexpected ${p}`);
    }
  };
  assert.deepEqual(await run(['reply', 'дальше'], {}, noExplanation), { fallback: true }, 'разбор ещё не готов — пишет модель');
});
