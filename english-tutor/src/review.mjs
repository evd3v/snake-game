import { nowIso, getSetting, setSetting, httpError } from './db.mjs';
import { applyRating } from './fsrs.mjs';
import { getCard, hydrate } from './queue.mjs';
import { normalizeHeadword } from './normalize.mjs';

const PLACEHOLDERS = new Set(['sth', 'sb', 'sb/sth', 'sth/sb', "one's", "sb's", 'oneself', 'yourself', 'somebody', 'something', 'somewhere', 'etc', 'etc.']);

const IRREGULAR = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'], go: ['went', 'gone', 'goes', 'going'], come: ['came', 'coming'],
  get: ['got', 'gotten', 'getting'], take: ['took', 'taken', 'taking'], give: ['gave', 'given', 'giving'], put: ['putting'],
  set: ['setting'], run: ['ran', 'running'], bring: ['brought'], break: ['broke', 'broken'], hold: ['held'], keep: ['kept'],
  make: ['made', 'making'], find: ['found'], think: ['thought'], stand: ['stood'], sit: ['sat', 'sitting'], fall: ['fell', 'fallen'],
  catch: ['caught'], grow: ['grew', 'grown'], throw: ['threw', 'thrown'], blow: ['blew', 'blown'], tear: ['tore', 'torn'],
  wear: ['wore', 'worn'], hang: ['hung'], lay: ['laid'], lie: ['lay', 'lain', 'lying'], cut: ['cutting'], shut: ['shutting'],
  let: ['letting'], show: ['shown'], write: ['wrote', 'written', 'writing'], drive: ['drove', 'driven', 'driving'], deal: ['dealt'],
  feel: ['felt'], leave: ['left'], lose: ['lost'], meet: ['met'], pay: ['paid'], say: ['said'], sell: ['sold'], send: ['sent'],
  speak: ['spoke', 'spoken'], spend: ['spent'], stick: ['stuck'], tell: ['told'], wake: ['woke', 'woken', 'waking'], wind: ['wound'],
  build: ['built'], see: ['saw', 'seen'], do: ['did', 'done', 'does'], have: ['had', 'has', 'having'], eat: ['ate', 'eaten'],
  drink: ['drank', 'drunk'], know: ['knew', 'known'], begin: ['began', 'begun'], buy: ['bought'], fly: ['flew', 'flown'], lead: ['led'],
  light: ['lit'], ride: ['rode', 'ridden'], rise: ['rose', 'risen'], shake: ['shook', 'shaken'], steal: ['stole', 'stolen'],
  swim: ['swam', 'swum'], teach: ['taught'], understand: ['understood'], win: ['won'], draw: ['drew', 'drawn'],
  forget: ['forgot', 'forgotten'], freeze: ['froze', 'frozen'], hide: ['hid', 'hidden'], strike: ['struck'], sweep: ['swept'],
  swing: ['swung'], sing: ['sang', 'sung'], ring: ['rang', 'rung'], sink: ['sank', 'sunk'], spring: ['sprang', 'sprung'],
  bear: ['bore', 'borne'], bind: ['bound'], bite: ['bit', 'bitten'], bleed: ['bled'], breed: ['bred'], choose: ['chose', 'chosen'],
  cling: ['clung'], creep: ['crept'], dig: ['dug'], feed: ['fed'], fight: ['fought'], flee: ['fled'], fling: ['flung'],
  forbid: ['forbade', 'forbidden'], grind: ['ground'], kneel: ['knelt'], lend: ['lent'], mean: ['meant'], seek: ['sought'],
  shoot: ['shot'], shrink: ['shrank', 'shrunk'], slide: ['slid'], sling: ['slung'], spin: ['spun'], stink: ['stank', 'stunk'],
  sting: ['stung'], strive: ['strove', 'striven'], swear: ['swore', 'sworn'], tread: ['trod'], weave: ['wove', 'woven'],
  weep: ['wept'], wring: ['wrung']
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function wordForms(p) {
  const base = p.replace(/[^a-z'-]/g, '');
  if (!base) return [];
  const forms = [base, ...(IRREGULAR[base] || [])];
  const res = forms.map((f) => new RegExp(`\\b${esc(f)}(s|es|ed|d|ing|er|est|ly)?\\b`));
  if (base.length >= 6) res.push(new RegExp(`\\b${esc(base.slice(0, -2))}[a-z]{0,6}\\b`));
  if (base.endsWith('y') && base.length >= 4) res.push(new RegExp(`\\b${esc(base.slice(0, -1))}(ies|ied|ier|iest|ily)\\b`));
  if (base.endsWith('e') && base.length >= 4) res.push(new RegExp(`\\b${esc(base.slice(0, -1))}(ing|ed|es|er|est)\\b`));
  return res;
}

export function containsHeadword(card, sentence) {
  const text = ' ' + String(sentence).toLowerCase().replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const parts = String(card.headword).toLowerCase().split(/\s+/).filter((p) => p && !PLACEHOLDERS.has(p));
  return parts.every((p) => wordForms(p).some((re) => re.test(text)));
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const TEST_TYPES = ['context', 'cloze', 'pair'];

// Различение пары: предложение с пропуском, а в скобках на конце два варианта —
// само слово и его близнец по переводу. Проверяем, что оба варианта на месте,
// а в самом предложении слова нет.
export function splitPairOptions(sentence) {
  const m = String(sentence || '').match(/\(([^()]*\/[^()]*)\)\s*$/);
  if (!m) return null;
  return { body: String(sentence).slice(0, m.index).trim(), options: m[1].split('/').map((x) => x.trim().toLowerCase()).filter(Boolean) };
}

export function validateSentence(card, { type, sentence, answer }, history = []) {
  const errors = [];
  if (!TEST_TYPES.includes(type)) errors.push('type');
  const words = String(sentence || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 28) errors.push(`length ${words.length}`);
  if (type === 'context' && !containsHeadword(card, sentence)) errors.push('headword');
  if (type === 'cloze') {
    if (!/_{3,}/.test(String(sentence))) errors.push('gap');
    if (containsHeadword(card, sentence)) errors.push('cloze-has-headword');
  }
  if (type === 'pair') {
    const twin = norm(card.source?.twin);
    const parts = splitPairOptions(sentence);
    if (!/_{3,}/.test(String(sentence))) errors.push('gap');
    if (!parts || parts.options.length !== 2) errors.push('options');
    else {
      if (!parts.options.includes(norm(card.headword))) errors.push('options-no-headword');
      if (twin && !parts.options.includes(twin)) errors.push('options-no-twin');
      if (containsHeadword(card, parts.body)) errors.push('pair-body-has-headword');
    }
    if (norm(answer) !== norm(card.headword)) errors.push('answer-not-headword');
  }
  if (history.some((h) => norm(h) === norm(sentence))) errors.push('repeat');
  if (card.source?.example && norm(card.source.example) === norm(sentence)) errors.push('source-example');
  if (!String(answer || '').trim()) errors.push('answer');
  return errors;
}

export function recentSentences(db, cardId, n = 5) {
  const logged = db.prepare('SELECT sentence FROM review_log WHERE card_id = ? AND sentence IS NOT NULL ORDER BY id DESC LIMIT ?').all(cardId, n);
  const stocked = db.prepare('SELECT sentence FROM tests WHERE card_id = ? ORDER BY id DESC LIMIT ?').all(cardId, n);
  return [...new Set([...logged, ...stocked].map((r) => r.sentence))];
}

export function addTest(db, cardId, { type, sentence, answer }, now = nowIso()) {
  const card = getCard(db, cardId);
  if (!card) throw httpError(404, 'карточка не найдена');
  const errors = validateSentence(card, { type, sentence, answer }, recentSentences(db, cardId));
  if (errors.length) throw httpError(422, `предложение не прошло проверку: ${errors.join(', ')}`);
  const r = db.prepare('INSERT INTO tests(card_id, type, sentence, answer, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(card.id, type, String(sentence).trim(), String(answer).trim(), now);
  return db.prepare('SELECT * FROM tests WHERE id = ?').get(Number(r.lastInsertRowid));
}

export function pickDueCard(db, now = nowIso()) {
  return db.prepare(`SELECT * FROM cards WHERE status = 'learning' AND fsrs_due <= ? ORDER BY fsrs_due, order_index LIMIT 1`).get(now) || null;
}

// Различение пары даём только после того, как ОБА слова выучены по отдельности:
// две новые синонимичные единицы одновременно дают интерференцию (Tinkham 1993, Waring 1997),
// а контраст на уже знакомом слове работает.
export function twinReady(db, card) {
  const twin = card.source?.twin;
  if (!twin) return false;
  const row = db.prepare(`SELECT status, fsrs_reps FROM cards WHERE headword = ?
    ORDER BY CASE status WHEN 'learning' THEN 0 WHEN 'known' THEN 1 ELSE 2 END LIMIT 1`).get(normalizeHeadword(twin));
  if (!row) return false;
  if (row.status === 'known') return true;
  return row.status === 'learning' && (row.fsrs_reps || 0) >= 2;
}

export function requiredTestType(db, card) {
  if ((card.fsrs_reps || 0) < 3) return 'context';
  const last = db.prepare('SELECT test_type FROM review_log WHERE card_id = ? ORDER BY id DESC LIMIT 1').get(card.id);
  const lastType = last?.test_type;
  if ((card.fsrs_reps || 0) >= 4 && lastType !== 'pair' && twinReady(db, card)) return 'pair';
  return lastType === 'context' ? 'cloze' : 'context';
}

export function takeTest(db, cardId, type) {
  return db.prepare('SELECT * FROM tests WHERE card_id = ? AND used_at IS NULL AND type = ? ORDER BY id LIMIT 1').get(cardId, type)
    || db.prepare('SELECT * FROM tests WHERE card_id = ? AND used_at IS NULL ORDER BY id LIMIT 1').get(cardId)
    || null;
}

export function reviewNext(db, now = nowIso()) {
  const row = pickDueCard(db, now);
  if (!row) {
    setSetting(db, 'review_card_id', '');
    setSetting(db, 'review_test_id', '');
    return null;
  }
  const card = hydrate(row);
  const wanted_type = requiredTestType(db, card);
  const test = takeTest(db, card.id, wanted_type);
  const left_today = db.prepare(`SELECT COUNT(*) AS c FROM cards WHERE status = 'learning' AND fsrs_due <= ?`).get(now).c;
  setSetting(db, 'review_card_id', String(card.id));
  setSetting(db, 'review_test_id', test ? String(test.id) : '');
  return { card, test, wanted_type, left_today, history: recentSentences(db, card.id) };
}

export function currentReview(db) {
  const cardId = getSetting(db, 'review_card_id');
  const testId = getSetting(db, 'review_test_id');
  return { cardId: cardId ? Number(cardId) : null, testId: testId ? Number(testId) : null };
}

export function grade(db, cardId, rating, testId = null, now = new Date()) {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(Number(cardId));
  if (!row) throw httpError(404, 'карточка не найдена');
  if (row.status !== 'learning') throw httpError(409, 'карточка не в повторении');
  const { fields } = applyRating(row, rating, now);
  const test = testId ? db.prepare('SELECT * FROM tests WHERE id = ? AND card_id = ?').get(Number(testId), row.id) : null;
  db.prepare(`UPDATE cards SET fsrs_due = @fsrs_due, fsrs_stability = @fsrs_stability, fsrs_difficulty = @fsrs_difficulty,
    fsrs_elapsed_days = @fsrs_elapsed_days, fsrs_scheduled_days = @fsrs_scheduled_days, fsrs_reps = @fsrs_reps,
    fsrs_lapses = @fsrs_lapses, fsrs_learning_steps = @fsrs_learning_steps, fsrs_state = @fsrs_state,
    fsrs_last_review = @fsrs_last_review WHERE id = @id`).run({ ...fields, id: row.id });
  const ts = now.toISOString();
  if (test) db.prepare('UPDATE tests SET used_at = ? WHERE id = ?').run(ts, test.id);
  db.prepare(`INSERT INTO review_log(card_id, ts, rating, test_id, test_type, sentence, answer, scheduled_days, due_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, ts, Number(rating), test ? test.id : null, test ? test.type : null, test ? test.sentence : null, test ? test.answer : null, fields.fsrs_scheduled_days, fields.fsrs_due);
  setSetting(db, 'review_card_id', '');
  setSetting(db, 'review_test_id', '');
  return { card: getCard(db, row.id), due: fields.fsrs_due, scheduled_days: fields.fsrs_scheduled_days };
}
