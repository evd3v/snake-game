import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getSetting } from '../src/db.mjs';
import { seed } from '../scripts/seed.mjs';
import { nextCard, pendingCard, decide, status, listCards, setExplanation, addNote, cardDetails, suspend, resolveId, localDay } from '../src/queue.mjs';

const item = (headword, kind = 'word', pos = 'verb') => ({ kind, headword, pos, level: 'B2', group_key: null, group_label: null, source: { definition: 'd', example: 'e' } });
function fresh() {
  const db = openDb(':memory:');
  seed(db, [item('inspect'), item('respect'), item('go on', 'pv', 'phrasal verb'), item('in terms of', 'expr', 'expression')]);
  return db;
}

test('nextCard идёт по order_index, ставит shown и pending', () => {
  const db = fresh();
  const c1 = nextCard(db, { now: '2026-09-13T10:00:00.000Z' });
  assert.equal(c1.headword, 'inspect');
  assert.equal(c1.status, 'shown');
  assert.equal(c1.shown_at, '2026-09-13T10:00:00.000Z');
  assert.deepEqual(c1.source, { definition: 'd', example: 'e' });
  assert.equal(pendingCard(db).id, c1.id);
  const c2 = nextCard(db, { kind: 'pv' });
  assert.equal(c2.headword, 'go on');
  assert.equal(pendingCard(db).id, c2.id);
  assert.equal(getSetting(db, 'pending_card_id'), String(c2.id));
});

test('nextCard возвращает null, когда очередь пуста', () => {
  const db = openDb(':memory:');
  assert.equal(nextCard(db), null);
});

test('decide learn: FSRS new, pending очищается; known; discuss', () => {
  const db = fresh();
  const c = nextCard(db);
  const learned = decide(db, c.id, 'learn', '2026-09-13T10:00:00.000Z');
  assert.equal(learned.status, 'learning');
  assert.equal(learned.fsrs_state, 0);
  assert.equal(learned.fsrs_due, '2026-09-13T10:00:00.000Z');
  assert.equal(pendingCard(db), null);
  const c2 = nextCard(db);
  assert.equal(decide(db, c2.id, 'discuss').status, 'discussing');
  assert.equal(pendingCard(db).id, c2.id, 'discuss не снимает pending');
  const known = decide(db, c2.id, 'known', '2026-09-13T10:00:00.000Z');
  assert.equal(known.status, 'learning');
  assert.equal(known.known_at, '2026-09-13T10:00:00.000Z');
  assert.equal(known.fsrs_state, 2);
  assert.equal(known.fsrs_scheduled_days, 90);
  assert.equal(known.fsrs_due, '2026-12-12T10:00:00.000Z');
  assert.throws(() => decide(db, c2.id, 'discuss'), /нельзя/);
  const relearn = decide(db, c2.id, 'learn', '2026-09-14T10:00:00.000Z');
  assert.equal(relearn.known_at, null, '«ок» по знакомому слову делает его обычной новой карточкой');
  assert.equal(relearn.fsrs_state, 0);
  assert.equal(decide(db, c2.id, 'learn', '2026-09-15T10:00:00.000Z').fsrs_due, '2026-09-14T10:00:00.000Z', 'повторный «ок» прогресс не трогает');
  assert.throws(() => decide(db, 999, 'learn'), /не найдена/);
});

test('resolveId: pending или число', () => {
  const db = fresh();
  assert.throws(() => resolveId(db, 'pending'), /нет текущего/);
  const c = nextCard(db);
  assert.equal(resolveId(db, 'pending'), c.id);
  assert.equal(resolveId(db, undefined), c.id);
  assert.equal(resolveId(db, '7'), 7);
});

test('status считает по потокам и сумме, due_today, learned по порогу', () => {
  const db = fresh();
  const c = nextCard(db);
  decide(db, c.id, 'learn', '2026-09-13T10:00:00.000Z');
  db.prepare(`UPDATE cards SET fsrs_state = 2, fsrs_scheduled_days = 30, fsrs_due = '2027-01-01T00:00:00.000Z' WHERE headword = 'respect'`).run();
  db.prepare(`UPDATE cards SET status = 'learning' WHERE headword = 'respect'`).run();
  decide(db, nextCard(db, { kind: 'pv' }).id, 'known', '2026-09-13T10:00:00.000Z');
  const s = status(db, new Date('2026-09-13T12:00:00.000Z'));
  assert.equal(s.all.total, 4);
  assert.equal(s.all.learning, 1);
  assert.equal(s.all.learned, 1);
  assert.equal(s.all.known, 1);
  assert.equal(s.all.queued, 1);
  assert.equal(s.all.due_today, 1);
  assert.equal(s.word.total, 2);
  assert.equal(s.pv.known, 1);
  assert.equal(s.streak, 0);
  assert.equal(s.pending, null);
});

test('streak считает подряд идущие дни с повторениями', () => {
  const db = fresh();
  const c = nextCard(db);
  decide(db, c.id, 'learn');
  const ins = db.prepare('INSERT INTO review_log(card_id, ts, rating) VALUES (?, ?, 3)');
  ins.run(c.id, '2026-09-11T09:00:00.000Z');
  ins.run(c.id, '2026-09-12T09:00:00.000Z');
  assert.equal(status(db, new Date('2026-09-12T20:00:00.000Z')).streak, 2);
  assert.equal(status(db, new Date('2026-09-13T20:00:00.000Z')).streak, 2, 'сегодня ещё не повторял, серия жива');
  assert.equal(status(db, new Date('2026-09-15T20:00:00.000Z')).streak, 0);
  assert.equal(localDay(new Date('2026-09-12T09:00:00.000Z')).length, 10);
});

test('setExplanation, addNote, cardDetails, suspend, listCards', () => {
  const db = fresh();
  const c = nextCard(db);
  assert.equal(setExplanation(db, c.id, '**inspect** разбор слова').explanation_md, '**inspect** разбор слова');
  const n = addNote(db, c.id, 'in- внутрь', '2026-09-13T10:00:00.000Z');
  assert.equal(n.text, 'in- внутрь');
  const d = cardDetails(db, c.id);
  assert.equal(d.card.headword, 'inspect');
  assert.equal(d.notes.length, 1);
  assert.deepEqual(d.history, []);
  decide(db, c.id, 'learn');
  assert.equal(suspend(db, c.id).status, 'suspended');
  const list = listCards(db, { status: 'queued', kind: 'word' });
  assert.deepEqual(list.map((x) => x.headword), ['respect']);
  assert.equal(listCards(db, { q: 'terms' })[0].headword, 'in terms of');
  assert.equal(listCards(db, {}).length, 4);
});

test('lookupCard: существующее слово становится текущим, новое создаётся в конце, learnerContext делит семью', async () => {
  const { lookupCard, learnerContext, guessKind } = await import('../src/queue.mjs');
  const db = fresh();
  const r1 = lookupCard(db, 'Respect');
  assert.equal(r1.created, false);
  assert.equal(r1.previous_status, 'queued');
  assert.equal(r1.card.status, 'shown');
  assert.equal(pendingCard(db).headword, 'respect');
  const r2 = lookupCard(db, 'разбери make up for');
  assert.equal(r2.created, true);
  assert.equal(r2.card.headword, 'make up for');
  assert.equal(r2.card.kind, 'pv');
  assert.equal(r2.card.status, 'shown');
  assert.equal(r2.card.order_index, 4);
  assert.deepEqual(r2.card.source, { origin: 'adhoc' });
  decide(db, r1.card.id, 'known');
  const r3 = lookupCard(db, 'respect');
  assert.equal(r3.previous_status, 'learning');
  assert.ok(r3.card.known_at);
  assert.equal(guessKind('bleak'), 'word');
  assert.equal(guessKind('in terms of'), 'expr');
  assert.equal(guessKind('give up'), 'pv');
  const ctx = learnerContext(db, { source: { family: ['respect', 'inspect', 'prospect'], twin: 'go on' } });
  assert.deepEqual(ctx.known, ['respect']);
  assert.deepEqual(ctx.unknown, ['inspect', 'prospect', 'go on']);
  assert.equal(ctx.twin_known, null, 'близнец не выучен, противопоставлять нечему');
  assert.throws(() => lookupCard(db, '   '), /нужно слово/);
});

test('бытовой слой: отдельный поток, аудит пачками, незнакомые уходят в начало основной очереди', async () => {
  const { nextCard: nc, auditBatch, auditMark, status: st } = await import('../src/queue.mjs');
  const db = openDb(':memory:');
  seed(db, [
    item('inspect'),
    { ...item('kettle'), stream: 'basic', topic: 'кухня и посуда', freq_rank: 8337, source: { ru: 'чайник' } },
    { ...item('mushroom'), stream: 'basic', topic: 'еда', freq_rank: 10166, source: { ru: 'гриб' } },
    { ...item('spoon'), stream: 'basic', freq_rank: 3000, source: { ru: 'ложка' } }
  ]);
  assert.equal(nc(db, {}).headword, 'inspect', 'по умолчанию основная очередь');
  const basicFirst = nc(db, { stream: 'basic' });
  assert.equal(basicFirst.headword, 'kettle');
  assert.throws(() => nc(db, { stream: 'нет' }), /stream/);

  const batch = auditBatch(db, 10);
  assert.deepEqual(batch.items.map((i) => [i.n, i.headword, i.ru]), [[1, 'mushroom', 'гриб'], [2, 'spoon', 'ложка']]);
  assert.ok(!batch.items.some((i) => i.id), 'номер пачки указывает на все карточки слова, а не на одну');
  assert.equal(batch.left, 2, 'kettle уже показан, он не в пачке');
  const marked = auditMark(db, [1], '2026-09-13T10:00:00.000Z');
  assert.deepEqual(marked.moved, ['mushroom']);
  assert.equal(marked.known, 1);
  assert.equal(marked.left, 0);
  const moved = db.prepare(`SELECT stream, order_index, status FROM cards WHERE headword = 'mushroom'`).get();
  assert.equal(moved.stream, 'main');
  assert.ok(moved.order_index < 0, 'незнакомое слово встаёт в начало очереди');
  assert.equal(nc(db, {}).headword, 'mushroom', 'и выдаётся следующим');
  const s = st(db, new Date('2026-09-13T12:00:00.000Z'));
  assert.equal(s.basic.total, 2, 'mushroom переехал в основную очередь');
  assert.equal(s.basic.queued, 0, 'kettle показан, spoon знаком: проверять нечего');
  assert.equal(s.word.total, 2, 'и считается там');
  assert.equal(s.basic.known, 1, 'spoon отмечен знакомым');
  assert.throws(() => auditMark(db, []), /нет открытой пачки/);
});

test('аудит: одно слово с двумя частями речи занимает один номер', async () => {
  const { auditBatch, auditMark } = await import('../src/queue.mjs');
  const db = openDb(':memory:');
  seed(db, [
    { ...item('poison', 'word', 'noun'), stream: 'basic', freq_rank: 5000 },
    { ...item('poison', 'word', 'verb'), stream: 'basic', freq_rank: 5000 },
    { ...item('hunt', 'word', 'verb'), stream: 'basic', freq_rank: 6000 }
  ]);
  const batch = auditBatch(db, 25);
  assert.deepEqual(batch.items.map((i) => i.headword), ['poison', 'hunt']);
  assert.equal(batch.left, 2, 'слова, а не карточки');
  const r = auditMark(db, [1]);
  assert.deepEqual(r.moved, ['poison']);
  assert.equal(r.known, 1, 'hunt');
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE headword = 'poison' AND stream = 'main'`).get().c, 2, 'обе карточки poison уехали в основную очередь');
});

test('undecidedCard: самое старое нерешённое, с учётом потока и вида', async () => {
  const { undecidedCard } = await import('../src/queue.mjs');
  const db = fresh();
  assert.equal(undecidedCard(db, {}), null);
  const a = nextCard(db, { now: '2026-09-13T10:00:00.000Z' });
  const b = nextCard(db, { kind: 'pv', now: '2026-09-13T11:00:00.000Z' });
  assert.equal(undecidedCard(db, {}).headword, a.headword, 'самое давнее');
  assert.equal(undecidedCard(db, { kind: 'pv' }).headword, b.headword);
  assert.equal(undecidedCard(db, { kind: 'expr' }), null);
  decide(db, a.id, 'learn');
  assert.equal(undecidedCard(db, {}).headword, b.headword);
  decide(db, b.id, 'known');
  assert.equal(undecidedCard(db, {}), null);
  assert.throws(() => undecidedCard(db, { stream: 'нет' }), /stream/);
});

test('learnerContext: twin_known только для знакомого близнеца', async () => {
  const { learnerContext, isKnownWord, decide: dec } = await import('../src/queue.mjs');
  const db = fresh();
  const card = { source: { family: ['respect', 'go on'], twin: 'Respect' } };
  assert.deepEqual(learnerContext(db, card), { known: [], unknown: ['respect', 'go on'], twin_known: null });
  const respectId = db.prepare(`SELECT id FROM cards WHERE headword = 'respect'`).get().id;
  dec(db, respectId, 'learn');
  assert.equal(isKnownWord(db, 'Respect'), true, 'регистр не важен');
  assert.equal(isKnownWord(db, 'нет такого'), false);
  const ctx = learnerContext(db, card);
  assert.deepEqual(ctx.known, ['respect']);
  assert.equal(ctx.twin_known, 'respect');
  assert.equal(learnerContext(db, { source: {} }).twin_known, null);
});

test('статус бытового слоя считает слова, а не карточки', async () => {
  const { status: st } = await import('../src/queue.mjs');
  const db = openDb(':memory:');
  seed(db, [
    { ...item('poison', 'word', 'noun'), stream: 'basic' },
    { ...item('poison', 'word', 'verb'), stream: 'basic' },
    { ...item('hunt', 'word', 'verb'), stream: 'basic' }
  ]);
  const s = st(db, new Date('2026-09-13T12:00:00.000Z'));
  assert.equal(s.basic.total, 3, 'карточек три');
  assert.equal(s.basic.queued, 2, 'слов на проверку два');
});
