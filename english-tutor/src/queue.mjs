import { nowIso, getSetting, setSetting, httpError } from './db.mjs';
import { emptyFsrsFields, matureFsrsFields, isMature } from './fsrs.mjs';
import { normalizeHeadword } from './normalize.mjs';

export const KINDS = ['word', 'pv', 'expr'];

export function hydrate(row) {
  if (!row) return null;
  const { source_json, ...rest } = row;
  return { ...rest, source: JSON.parse(source_json) };
}

export function getCard(db, id) {
  return hydrate(db.prepare('SELECT * FROM cards WHERE id = ?').get(Number(id)));
}

export const STREAMS = ['main', 'basic'];

export function nextCard(db, { kind = null, stream = 'main', now = nowIso() } = {}) {
  if (kind && !KINDS.includes(kind)) throw httpError(400, 'kind должен быть word, pv или expr');
  if (!STREAMS.includes(stream)) throw httpError(400, 'stream должен быть main или basic');
  const row = kind
    ? db.prepare(`SELECT id FROM cards WHERE status = 'queued' AND stream = ? AND kind = ? ORDER BY order_index LIMIT 1`).get(stream, kind)
    : db.prepare(`SELECT id FROM cards WHERE status = 'queued' AND stream = ? ORDER BY order_index LIMIT 1`).get(stream);
  if (!row) return null;
  db.prepare(`UPDATE cards SET status = 'shown', shown_at = ? WHERE id = ?`).run(now, row.id);
  setSetting(db, 'pending_card_id', String(row.id));
  return getCard(db, row.id);
}

// Нерешённая карточка (показана, но не «учу» и не «знаю») возвращается раньше новых:
// иначе слово молча выпадало из обучения. Фильтры по потоку и виду соблюдаются.
export function undecidedCard(db, { kind = null, stream = 'main' } = {}) {
  if (kind && !KINDS.includes(kind)) throw httpError(400, 'kind должен быть word, pv или expr');
  if (!STREAMS.includes(stream)) throw httpError(400, 'stream должен быть main или basic');
  const row = kind
    ? db.prepare(`SELECT id FROM cards WHERE status IN ('shown', 'discussing') AND stream = ? AND kind = ? ORDER BY shown_at, order_index LIMIT 1`).get(stream, kind)
    : db.prepare(`SELECT id FROM cards WHERE status IN ('shown', 'discussing') AND stream = ? ORDER BY shown_at, order_index LIMIT 1`).get(stream);
  if (!row) return null;
  setSetting(db, 'pending_card_id', String(row.id));
  return getCard(db, row.id);
}

export function pendingCard(db) {
  const id = getSetting(db, 'pending_card_id');
  return id ? getCard(db, Number(id)) : null;
}

export function resolveId(db, id) {
  if (id === undefined || id === null || id === '' || id === 'pending' || id === 'current') {
    const p = pendingCard(db);
    if (!p) throw httpError(404, 'нет текущего элемента: сначала /next');
    return p.id;
  }
  const n = Number(id);
  if (!Number.isInteger(n)) throw httpError(400, 'id должен быть числом');
  return n;
}

const ALLOWED = {
  learn: ['shown', 'discussing', 'queued', 'known', 'suspended', 'learning'],
  known: ['shown', 'discussing', 'queued', 'learning', 'suspended', 'known'],
  discuss: ['shown', 'discussing']
};

const FSRS_UPDATE = `fsrs_due = @fsrs_due, fsrs_stability = @fsrs_stability, fsrs_difficulty = @fsrs_difficulty,
      fsrs_elapsed_days = @fsrs_elapsed_days, fsrs_scheduled_days = @fsrs_scheduled_days, fsrs_reps = @fsrs_reps,
      fsrs_lapses = @fsrs_lapses, fsrs_learning_steps = @fsrs_learning_steps, fsrs_state = @fsrs_state,
      fsrs_last_review = @fsrs_last_review`;

export function decide(db, id, decision, now = nowIso()) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  if (!ALLOWED[decision]) throw httpError(400, 'неизвестное решение');
  if (!ALLOWED[decision].includes(card.status)) throw httpError(409, `нельзя ${decision} из статуса ${card.status}`);
  if (decision === 'learn') {
    // «ок» по карточке, которая уже учится, прогресс не сбрасывает; «знал» превращается в обычную новую
    if (card.status === 'learning' && !card.known_at) return card;
    const f = emptyFsrsFields(new Date(now));
    db.prepare(`UPDATE cards SET status = 'learning', decided_at = @now, known_at = NULL, ${FSRS_UPDATE} WHERE id = @id`).run({ ...f, now, id: card.id });
  } else if (decision === 'known') {
    // «знаю»: в повторение сразу зрелой, чтобы слово всё же всплыло через KNOWN_DAYS дней
    const f = matureFsrsFields(new Date(now));
    db.prepare(`UPDATE cards SET status = 'learning', decided_at = @now, known_at = @now, ${FSRS_UPDATE} WHERE id = @id`).run({ ...f, now, id: card.id });
  } else {
    db.prepare(`UPDATE cards SET status = 'discussing' WHERE id = ?`).run(card.id);
  }
  if (decision !== 'discuss' && getSetting(db, 'pending_card_id') === String(card.id)) setSetting(db, 'pending_card_id', '');
  return getCard(db, card.id);
}

export function suspend(db, id) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  db.prepare(`UPDATE cards SET status = 'suspended' WHERE id = ?`).run(card.id);
  return getCard(db, card.id);
}

export function setExplanation(db, id, md) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  const text = String(md || '').trim();
  if (text.length < 20) throw httpError(422, 'разбор слишком короткий');
  db.prepare('UPDATE cards SET explanation_md = ? WHERE id = ?').run(text, card.id);
  return getCard(db, card.id);
}

export function addNote(db, id, text, now = nowIso()) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  const t = String(text || '').trim();
  if (!t) throw httpError(422, 'пустая заметка');
  const r = db.prepare('INSERT INTO notes(card_id, ts, text) VALUES (?, ?, ?)').run(card.id, now, t);
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(r.lastInsertRowid));
}

export function cardDetails(db, id) {
  const card = getCard(db, id);
  if (!card) throw httpError(404, 'карточка не найдена');
  const notes = db.prepare('SELECT * FROM notes WHERE card_id = ? ORDER BY id').all(card.id);
  const history = db.prepare('SELECT ts, rating, test_type, sentence, answer, scheduled_days FROM review_log WHERE card_id = ? ORDER BY id').all(card.id);
  return { card, notes, history };
}

export function listCards(db, { status = null, kind = null, q = null, limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = {};
  if (status) { where.push('status = @status'); params.status = status; }
  if (kind) { where.push('kind = @kind'); params.kind = kind; }
  if (q) { where.push('headword LIKE @q'); params.q = `%${String(q).toLowerCase()}%`; }
  const sql = `SELECT id, kind, headword, pos, level, status, group_label, fsrs_due, fsrs_scheduled_days, fsrs_state, known_at, order_index
    FROM cards ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY order_index LIMIT @limit OFFSET @offset`;
  return db.prepare(sql).all({ ...params, limit: Number(limit) || 200, offset: Number(offset) || 0 });
}

export function localDay(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: process.env.TZ || 'Europe/Moscow' });
}

export function streakDays(db, now = new Date()) {
  const days = new Set(db.prepare('SELECT ts FROM review_log').all().map((r) => localDay(r.ts)));
  if (!days.size) return 0;
  let cursor = new Date(now);
  if (!days.has(localDay(cursor))) cursor = new Date(cursor.getTime() - 86400e3);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400e3);
  }
  return streak;
}

export function status(db, now = new Date()) {
  const rows = db.prepare('SELECT kind, status, stream, fsrs_state, fsrs_scheduled_days, fsrs_due, known_at FROM cards').all();
  const today = localDay(now);
  const mk = () => ({ total: 0, queued: 0, shown: 0, learning: 0, learned: 0, known: 0, suspended: 0, due_today: 0 });
  const by = { word: mk(), pv: mk(), expr: mk(), all: mk(), basic: mk() };
  for (const r of rows) {
    const buckets = r.stream === 'basic' ? [by.basic, by.all] : [by[r.kind], by.all];
    for (const b of buckets) {
      b.total++;
      if (r.status === 'queued') b.queued++;
      else if (r.status === 'shown' || r.status === 'discussing') b.shown++;
      else if (r.status === 'known') b.known++;
      else if (r.status === 'suspended') b.suspended++;
      else if (r.status === 'learning') {
        if (isMature(r)) { if (r.known_at) b.known++; else b.learned++; } else b.learning++;
        if (r.fsrs_due && localDay(r.fsrs_due) <= today) b.due_today++;
      }
    }
  }
  return { ...by, streak: streakDays(db, now), pending: pendingCard(db) };
}

const PARTICLES = new Set(['up', 'down', 'out', 'off', 'on', 'in', 'over', 'back', 'away', 'through', 'along', 'around', 'about', 'into', 'by', 'for', 'after', 'forward', 'apart', 'aside', 'ahead', 'across', 'behind', 'together']);

export function guessKind(text) {
  const parts = normalizeHeadword(text).split(' ').filter(Boolean);
  if (parts.length === 1) return 'word';
  if (parts.length <= 3 && PARTICLES.has(parts[1]) && !/^(a|an|the)$/.test(parts[0])) return 'pv';
  return 'expr';
}

// Своё слово в обход очереди: существующую карточку делаем текущей, новую создаём в конце очереди.
export function lookupCard(db, text, now = nowIso()) {
  const headword = normalizeHeadword(text).replace(/^(разбери|разбор|слово|давай)\s+/u, '');
  if (!headword || headword.length > 80) throw httpError(400, 'нужно слово или фраза');
  let row = db.prepare('SELECT id, status FROM cards WHERE headword = ? ORDER BY order_index LIMIT 1').get(headword);
  let created = false;
  if (!row) {
    const kind = guessKind(headword);
    const max = db.prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM cards').get().m;
    const r = db.prepare(`INSERT INTO cards (kind, headword, pos, level, source_json, group_key, group_label, order_index, status, shown_at)
      VALUES (?, ?, '', '', ?, NULL, NULL, ?, 'shown', ?)`).run(kind, headword, JSON.stringify({ origin: 'adhoc' }), max + 1, now);
    row = { id: Number(r.lastInsertRowid), status: 'queued' };
    created = true;
  }
  const previous_status = row.status;
  if (row.status === 'queued') db.prepare(`UPDATE cards SET status = 'shown', shown_at = ? WHERE id = ?`).run(now, row.id);
  setSetting(db, 'pending_card_id', String(row.id));
  return { card: getCard(db, row.id), created, previous_status };
}

// Что ученик уже знает из семьи и близнецов карточки: known = статусы learning/known, unknown = остальные из списка.
export function learnerContext(db, card) {
  const related = [...new Set([...(card.source?.family || []), card.source?.twin].filter(Boolean).map((h) => normalizeHeadword(h)))];
  const known = [];
  const unknown = [];
  for (const h of related) {
    const r = db.prepare('SELECT status FROM cards WHERE headword = ? ORDER BY CASE status WHEN \'known\' THEN 0 WHEN \'learning\' THEN 1 ELSE 2 END LIMIT 1').get(h);
    if (r && (r.status === 'known' || r.status === 'learning')) known.push(h); else unknown.push(h);
  }
  return { known, unknown };
}

const AUDIT_LIMIT = 25;

// Бытовой слой: слова проверяются пачками (их тысячи и большинство известно),
// а не по одному. Номера пачки держим в settings, чтобы ответ «1 5 12» был однозначным.
export function auditBatch(db, limit = AUDIT_LIMIT) {
  const size = Math.min(Number(limit) || AUDIT_LIMIT, 50);
  // Одно слово в пачке = одна строка, даже если у него несколько частей речи
  // (poison как существительное и как глагол): решение применяется ко всем его карточкам.
  const rows = db.prepare(`SELECT id, headword, source_json, level FROM cards
    WHERE stream = 'basic' AND status = 'queued' ORDER BY order_index LIMIT ?`).all(size * 3);
  const left = db.prepare(`SELECT COUNT(DISTINCT headword) AS c FROM cards WHERE stream = 'basic' AND status = 'queued'`).get().c;
  const items = [];
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.headword)) {
      if (groups.size >= size) continue;
      const src = JSON.parse(r.source_json);
      groups.set(r.headword, []);
      items.push({ n: items.length + 1, headword: r.headword, ru: src.ru || '', level: r.level || '' });
    }
    groups.get(r.headword).push(r.id);
  }
  setSetting(db, 'audit_batch', JSON.stringify(items.map((i) => groups.get(i.headword))));
  return { items, left };
}

// Ответ на пачку: номера незнакомых уходят в основную очередь (в начало),
// остальные отмечаются знакомыми.
export function auditMark(db, unknownNumbers = [], now = nowIso()) {
  const groups = JSON.parse(getSetting(db, 'audit_batch') || '[]');
  if (!groups.length) throw httpError(404, 'нет открытой пачки: сначала /audit');
  const nums = new Set((unknownNumbers || []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= groups.length));
  const moved = [];
  let known = 0;
  const head = db.prepare('SELECT COALESCE(MIN(order_index), 0) AS m FROM cards').get().m;
  let slot = head - 1;
  groups.forEach((ids, idx) => {
    const unknown = nums.has(idx + 1);
    for (const id of [].concat(ids)) {
      const card = getCard(db, id);
      if (!card || card.status !== 'queued') continue;
      if (unknown) {
        db.prepare(`UPDATE cards SET stream = 'main', order_index = ? WHERE id = ?`).run(slot--, id);
        if (!moved.includes(card.headword)) moved.push(card.headword);
      } else {
        decide(db, id, 'known', now);
        known++;
      }
    }
  });
  setSetting(db, 'audit_batch', '');
  const left = db.prepare(`SELECT COUNT(DISTINCT headword) AS c FROM cards WHERE stream = 'basic' AND status = 'queued'`).get().c;
  return { moved, known, left };
}
