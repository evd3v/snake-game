import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';
import { buildApp } from '../src/server.mjs';

const item = (headword, kind = 'word', pos = 'verb') => ({ kind, headword, pos, level: 'B2', group_key: null, group_label: null, source: { definition: 'd', example: 'e' } });
const env = { API_TOKEN: 'secret-token', DASHBOARD_PASSWORD: 'pw', COOKIE_SECURE: '0' };
const auth = { authorization: 'Bearer secret-token' };

async function app() {
  const db = openDb(':memory:');
  seed(db, [item('inspect'), item('respect'), item('go on', 'pv', 'phrasal verb'), item('in terms of', 'expr', 'expression')]);
  const a = buildApp({ db, env });
  await a.ready();
  return { a, db };
}

test('health открыт, остальное требует токен или cookie', async () => {
  const { a } = await app();
  assert.equal((await a.inject({ method: 'GET', url: '/api/health' })).statusCode, 200);
  assert.equal((await a.inject({ method: 'GET', url: '/api/status' })).statusCode, 401);
  assert.equal((await a.inject({ method: 'GET', url: '/api/status', headers: { authorization: 'Bearer nope' } })).statusCode, 401);
  assert.equal((await a.inject({ method: 'GET', url: '/api/status', headers: auth })).statusCode, 200);
  const bad = await a.inject({ method: 'POST', url: '/api/login', payload: { password: 'wrong' } });
  assert.equal(bad.statusCode, 401);
  const login = await a.inject({ method: 'POST', url: '/api/login', payload: { password: 'pw' } });
  assert.equal(login.statusCode, 200);
  const cookie = login.cookies.find((c) => c.name === 'et_session');
  assert.ok(cookie && cookie.httpOnly);
  const me = await a.inject({ method: 'GET', url: '/api/me', cookies: { et_session: cookie.value } });
  assert.equal(me.statusCode, 200);
  const out = await a.inject({ method: 'POST', url: '/api/logout', cookies: { et_session: cookie.value } });
  assert.equal(out.statusCode, 200);
  assert.equal((await a.inject({ method: 'GET', url: '/api/me', cookies: { et_session: cookie.value } })).statusCode, 401);
});

test('next → explanation → learn → status', async () => {
  const { a } = await app();
  const n = await a.inject({ method: 'GET', url: '/api/next?kind=pv', headers: auth });
  assert.equal(n.statusCode, 200);
  const body = n.json();
  assert.equal(body.card.headword, 'go on');
  assert.equal(body.explanation_md, null);
  assert.match(body.prompt, /Данные \(фразовый глагол\)/);
  assert.equal(body.queued_left, 3);
  const ex = await a.inject({ method: 'POST', url: `/api/cards/${body.card.id}/explanation`, headers: auth, payload: { md: '**go on** продолжать; происходить' } });
  assert.equal(ex.statusCode, 200);
  assert.equal(ex.json().card.explanation_md, '**go on** продолжать; происходить');
  const pend = await a.inject({ method: 'GET', url: '/api/pending', headers: auth });
  assert.equal(pend.json().card.id, body.card.id);
  const learn = await a.inject({ method: 'POST', url: '/api/cards/pending/learn', headers: auth });
  assert.equal(learn.statusCode, 200);
  assert.equal(learn.json().card.status, 'learning');
  assert.equal(learn.json().status.all.learning, 1);
  const again = await a.inject({ method: 'POST', url: '/api/cards/pending/learn', headers: auth });
  assert.equal(again.statusCode, 404);
  const bad = await a.inject({ method: 'GET', url: '/api/next?kind=nope', headers: auth });
  assert.equal(bad.statusCode, 400);
});

test('known-bulk, cards list и details, notes, suspend', async () => {
  const { a } = await app();
  const list = (await a.inject({ method: 'GET', url: '/api/cards?kind=word', headers: auth })).json().items;
  const ids = list.map((c) => c.id);
  const kb = await a.inject({ method: 'POST', url: '/api/cards/known-bulk', headers: auth, payload: { ids } });
  assert.equal(kb.json().updated, 2);
  const after = (await a.inject({ method: 'GET', url: '/api/cards?status=known', headers: auth })).json().items;
  assert.equal(after.length, 2);
  const note = await a.inject({ method: 'POST', url: `/api/cards/${ids[0]}/notes`, headers: auth, payload: { text: 'in- внутрь' } });
  assert.equal(note.statusCode, 200);
  const det = (await a.inject({ method: 'GET', url: `/api/cards/${ids[0]}`, headers: auth })).json();
  assert.equal(det.notes.length, 1);
  assert.equal(det.card.headword, 'inspect');
  const n = await a.inject({ method: 'GET', url: '/api/next', headers: auth });
  const learn = await a.inject({ method: 'POST', url: `/api/cards/${n.json().card.id}/learn`, headers: auth });
  const sus = await a.inject({ method: 'POST', url: `/api/cards/${learn.json().card.id}/suspend`, headers: auth });
  assert.equal(sus.json().card.status, 'suspended');
});

test('review: next без запаса даёт prompt, test кладёт запас, grade списывает', async () => {
  const { a, db } = await app();
  const n = await a.inject({ method: 'GET', url: '/api/next', headers: auth });
  const id = n.json().card.id;
  await a.inject({ method: 'POST', url: `/api/cards/${id}/learn`, headers: auth });
  db.prepare(`UPDATE cards SET fsrs_due = '2020-01-01T00:00:00.000Z' WHERE id = ?`).run(id);
  const r1 = (await a.inject({ method: 'GET', url: '/api/review/next', headers: auth })).json();
  assert.equal(r1.card.id, id);
  assert.equal(r1.test, null);
  assert.match(r1.prompt, /"type": "context"/);
  const badTest = await a.inject({ method: 'POST', url: `/api/review/${id}/test`, headers: auth, payload: { type: 'context', sentence: 'short', answer: 'x' } });
  assert.equal(badTest.statusCode, 422);
  assert.match(badTest.json().error, /length/);
  const t = await a.inject({ method: 'POST', url: `/api/review/current/test`, headers: auth, payload: { type: 'context', sentence: 'Before buying the flat, we hired an expert to inspect the wiring and the roof.', answer: 'осматривать / examine' } });
  assert.equal(t.statusCode, 200);
  const r2 = (await a.inject({ method: 'GET', url: '/api/review/next', headers: auth })).json();
  assert.equal(r2.test.id, t.json().test.id);
  assert.equal(r2.prompt, null);
  const g = await a.inject({ method: 'POST', url: '/api/review/current/grade', headers: auth, payload: { rating: 3 } });
  assert.equal(g.statusCode, 200);
  assert.equal(g.json().next_left, 0);
  assert.equal(db.prepare('SELECT used_at FROM tests WHERE id = ?').get(t.json().test.id).used_at !== null, true);
  const r3 = (await a.inject({ method: 'GET', url: '/api/review/next', headers: auth })).json();
  assert.equal(r3.card, null);
  const badGrade = await a.inject({ method: 'POST', url: '/api/review/current/grade', headers: auth, payload: { rating: 3 } });
  assert.equal(badGrade.statusCode, 404);
});

test('jobs отдаёт задания', async () => {
  const { a } = await app();
  const j = (await a.inject({ method: 'GET', url: '/api/jobs?explain=2', headers: auth })).json();
  assert.equal(j.explain.length, 4);
  assert.deepEqual(j.tests, []);
});

test('статика: / отдаёт index.html', async () => {
  const { a } = await app();
  const r = await a.inject({ method: 'GET', url: '/' });
  assert.equal(r.statusCode, 200);
  assert.match(r.headers['content-type'], /text\/html/);
});

test('lookup: своё слово в обход очереди', async () => {
  const { a } = await app();
  const r = await a.inject({ method: 'POST', url: '/api/cards/lookup', headers: auth, payload: { text: 'surpass' } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().created, true);
  assert.equal(r.json().card.status, 'shown');
  assert.match(r.json().prompt, /Ученик уже знает/);
  const learn = await a.inject({ method: 'POST', url: '/api/cards/pending/learn', headers: auth });
  assert.equal(learn.json().card.headword, 'surpass');
});
