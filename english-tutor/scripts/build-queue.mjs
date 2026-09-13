import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const byLevelThenName = (a, b) => (a.level === b.level ? a.headword.localeCompare(b.headword) : a.level.localeCompare(b.level));

// Ключи семей приходят от модели пачками и могут разъехаться в мелочах (Spect, spect-, spec):
// сводим к латинским буквам в нижнем регистре, чтобы одна семья не распалась на две.
export const normalizeKey = (k) => String(k || '').toLowerCase().replace(/[^a-z]/g, '') || null;

export function groupWords(words, roots) {
  const groups = new Map();
  const singles = [];
  for (const w of words) {
    const tag = roots[`${w.headword}|${w.pos}`] || {};
    const key = normalizeKey(tag.family_key);
    if (!key) { singles.push(w); continue; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  const modules = [];
  for (const [key, items] of groups) {
    if (items.length < 2) { singles.push(...items); continue; }
    items.sort(byLevelThenName);
    modules.push({ key, items });
  }
  modules.sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
  singles.sort(byLevelThenName);
  return { modules, singles };
}

export function interleave(streams) {
  const queues = streams.map(([items, n]) => ({ items: [...items], n }));
  const out = [];
  while (queues.some((q) => q.items.length)) {
    for (const q of queues) out.push(...q.items.splice(0, q.n));
  }
  return out;
}

function toWordItem(w, roots, module) {
  const tag = roots[`${w.headword}|${w.pos}`] || {};
  const family = module ? module.items.filter((x) => x.headword !== w.headword).map((x) => x.headword) : [];
  return {
    kind: 'word', headword: w.headword, pos: w.pos, level: w.level,
    group_key: module ? module.key : null,
    group_label: module ? (tag.root ? `корень ${tag.root}` : `семья ${module.key}`) : null,
    source: {
      definition: w.definition, example: w.example, examples: w.examples, phon: w.phon, phon_us: w.phon_us || '', audio: w.audio || '',
      root: tag.root ?? null, root_meaning_ru: tag.root_meaning_ru ?? null, family,
      twin: tag.twin ?? null, twin_note_ru: tag.twin_note_ru ?? null
    }
  };
}

function wordStream(words, roots) {
  const { modules, singles } = groupWords(words, roots);
  const rest = [...singles];
  const out = [];
  for (const m of modules) {
    for (const w of m.items) out.push(toWordItem(w, roots, m));
    for (const s of rest.splice(0, Math.ceil(m.items.length / 2))) out.push(toWordItem(s, roots, null));
  }
  for (const s of rest) out.push(toWordItem(s, roots, null));
  return out;
}

function pvStream(pv) {
  const byParticle = new Map();
  for (const p of pv) {
    if (!byParticle.has(p.particle)) byParticle.set(p.particle, []);
    byParticle.get(p.particle).push(p);
  }
  const groups = [...byParticle.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const out = [];
  for (const [particle, items] of groups) {
    items.sort((a, b) => a.rank - b.rank);
    for (const p of items) out.push({
      kind: 'pv', headword: p.headword, pos: 'phrasal verb', level: '',
      group_key: particle, group_label: `частица ${particle}`,
      source: { verb: p.verb, particle: p.particle, rank: p.rank, senses: p.senses }
    });
  }
  return out;
}

function exprStream(expr) {
  const phrase = expr.filter((e) => e.source === 'phrase').sort((a, b) => a.rank - b.rank);
  const opl = expr.filter((e) => e.source === 'opl').sort((a, b) => a.level.localeCompare(b.level) || a.headword.localeCompare(b.headword));
  return [...phrase, ...opl].map((e) => ({
    kind: 'expr', headword: e.headword, pos: 'expression', level: e.level || '',
    group_key: e.source === 'phrase' ? `band-${e.band}` : `opl-${e.level.toLowerCase()}`,
    group_label: e.source === 'phrase' ? `частотная полоса ${e.band}K` : `Oxford Phrase List ${e.level}`,
    source: { origin: e.source, rank: e.rank, band: e.band, level: e.level, frequency: e.frequency, genre: e.genre, example: e.example }
  }));
}

// Бытовой слой идёт отдельным потоком в конце: он не мешает основной очереди,
// проверяется пачками и сортируется по частоте живой речи (сначала самое ходовое).
// Слова Oxford уровней A1-A2 (the, you, carrot, towel) ученику уровня B1-B2 проверять
// незачем: они сеются сразу как знакомые и в аудит не попадают. Всё остальное
// (B1, тематические) идёт в аудит пачками.
export const PREKNOWN_LEVELS = ['A1', 'A2'];
export const PREKNOWN_RANK = 2000;
export const isPreknown = (b) =>
  (b.origin === 'oxford' && PREKNOWN_LEVELS.includes(String(b.level || '').toUpperCase())) ||
  (Number(b.freq_rank) > 0 && Number(b.freq_rank) <= PREKNOWN_RANK);

export function basicStream(basic) {
  return [...basic]
    .sort((a, b) => (a.freq_rank || 99999) - (b.freq_rank || 99999) || a.headword.localeCompare(b.headword))
    .map((b) => ({
      preknown: isPreknown(b),
      kind: 'word', headword: b.headword, pos: b.pos || '', level: b.level || '',
      group_key: b.topic ? `тема ${b.topic}` : `уровень ${b.level || '?'}`,
      group_label: b.topic ? `тема: ${b.topic}` : `Oxford ${b.level || ''}`.trim(),
      stream: 'basic', topic: b.topic || null, freq_rank: b.freq_rank || null,
      source: { definition: b.definition || '', example: b.example || '', examples: b.examples || [], ru: b.ru || '', origin: b.origin || 'oxford', phon: b.phon || '', audio: b.audio || '' }
    }));
}

export function buildQueue({ words, pv, expr, roots, basic = [] }) {
  const main = interleave([[wordStream(words, roots), 6], [pvStream(pv), 2], [exprStream(expr), 2]]);
  return [...main, ...basicStream(basic)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const basic = fs.existsSync('data/basic.json') ? read('data/basic.json') : [];
  const queue = buildQueue({ words: read('data/words.json'), pv: read('data/pv.json'), expr: read('data/expr.json'), roots: read('data/roots.json'), basic });
  fs.writeFileSync('data/queue.json', JSON.stringify(queue, null, 1));
  const n = (k) => queue.filter((i) => i.kind === k && i.stream !== 'basic').length;
  console.log(`queue: ${queue.length} (word ${n('word')}, pv ${n('pv')}, expr ${n('expr')}, basic ${queue.filter((i) => i.stream === 'basic').length})`);
}
