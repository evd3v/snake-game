import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const byLevelThenName = (a, b) => (a.level === b.level ? a.headword.localeCompare(b.headword) : a.level.localeCompare(b.level));

export function groupWords(words, roots) {
  const groups = new Map();
  const singles = [];
  for (const w of words) {
    const tag = roots[`${w.headword}|${w.pos}`] || {};
    const key = tag.family_key || null;
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
      definition: w.definition, example: w.example, examples: w.examples, phon: w.phon,
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

export function buildQueue({ words, pv, expr, roots }) {
  return interleave([[wordStream(words, roots), 6], [pvStream(pv), 2], [exprStream(expr), 2]]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const queue = buildQueue({ words: read('data/words.json'), pv: read('data/pv.json'), expr: read('data/expr.json'), roots: read('data/roots.json') });
  fs.writeFileSync('data/queue.json', JSON.stringify(queue, null, 1));
  const n = (k) => queue.filter((i) => i.kind === k).length;
  console.log(`queue: ${queue.length} (word ${n('word')}, pv ${n('pv')}, expr ${n('expr')})`);
}
