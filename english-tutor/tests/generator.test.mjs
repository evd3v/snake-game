import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTestReply, runJobs } from '../work/generator.mjs';

test('parseTestReply снимает ограждения', () => {
  const r = parseTestReply('```json\n{"type":"context","sentence":"A long sentence with inspect inside it for sure.","answer":"осматривать / examine"}\n```');
  assert.equal(r.type, 'context');
  assert.throws(() => parseTestReply('no json'), /JSON/);
});

test('runJobs: разборы и тесты, повтор теста после 422, лимит', async () => {
  const jobs = {
    explain: [{ card_id: 1, headword: 'inspect', kind: 'word', prompt: 'E1' }, { card_id: 2, headword: 'respect', kind: 'word', prompt: 'E2' }],
    tests: [{ card_id: 1, headword: 'inspect', kind: 'word', type: 'context', prompt: 'T1' }]
  };
  const asked = [];
  const posted = [];
  let testTries = 0;
  const ask = async (prompt) => {
    asked.push(prompt);
    if (prompt.startsWith('E')) return `разбор для ${prompt} достаточной длины`;
    testTries++;
    return JSON.stringify({ type: 'context', sentence: `try ${testTries}`, answer: 'a' });
  };
  const post = async (p, body) => {
    posted.push([p, body]);
    if (p.endsWith('/test') && body.sentence === 'try 1') return { status: 422, body: { error: 'length 2' } };
    return { status: 200, body: {} };
  };
  const done = await runJobs({ jobs, ask, post, log: { info() {}, error() {} }, max: 10 });
  assert.deepEqual(done, { explained: 2, tested: 1, failed: 0 });
  assert.equal(asked.length, 4);
  assert.match(asked[3], /^T1[\s\S]*length 2/);
  assert.deepEqual(posted[0], ['/api/cards/1/explanation', { md: 'разбор для E1 достаточной длины' }]);
  const limited = await runJobs({ jobs, ask, post, log: { info() {}, error() {} }, max: 1 });
  assert.deepEqual(limited, { explained: 1, tested: 0, failed: 0 });
});
