import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';
import { readFrequency } from './gen-topical.mjs';

const BASIC_LEVELS = ['A1', 'A2', 'B1'];

// Бытовой слой = Oxford 3000 уровней A1-B1 (структурный) + тематические слова,
// которых в Oxford нет вовсе (mushroom, kettle, sleeve, jaw).
export function buildBasic({ oxford, topical, rank, mainWords = new Set() }) {
  const out = [];
  const seen = new Set();
  for (const e of Object.values(oxford)) {
    const level = String(e.cefr || '').toUpperCase();
    if (!BASIC_LEVELS.includes(level)) continue;
    const headword = normalizeHeadword(e.word);
    const key = `${headword}|${(e.type || '').toLowerCase()}`;
    if (!headword || seen.has(key) || mainWords.has(key)) continue;
    seen.add(key);
    out.push({
      headword, pos: String(e.type || '').toLowerCase(), level, origin: 'oxford',
      definition: e.definition || '', example: e.example || '', examples: e.example ? [e.example] : [],
      ru: '', topic: null, freq_rank: rank.get(headword) || null
    });
  }
  for (const t of topical) {
    const headword = normalizeHeadword(t.headword);
    const key = `${headword}|${t.pos || ''}`;
    if (!headword || seen.has(key) || mainWords.has(key)) continue;
    seen.add(key);
    out.push({
      headword, pos: t.pos || 'noun', level: 'A2-B1', origin: 'topical',
      definition: '', example: '', examples: [], ru: t.ru || '', topic: t.topic || null, freq_rank: t.freq_rank || rank.get(headword) || null
    });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const oxford = JSON.parse(fs.readFileSync('data/raw/oxford_5000.json', 'utf8'));
  const topicalCache = fs.existsSync('data/topical.json') ? JSON.parse(fs.readFileSync('data/topical.json', 'utf8')) : {};
  const topical = Object.values(topicalCache).flat();
  const rank = readFrequency('data/raw/en_50k.txt');
  const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
  const mainWords = new Set(words.map((w) => `${w.headword}|${w.pos}`));
  const basic = buildBasic({ oxford, topical, rank, mainWords });
  fs.writeFileSync('data/basic.json', JSON.stringify(basic, null, 1));
  const n = (o) => basic.filter((b) => b.origin === o).length;
  console.log(`basic: ${basic.length} (oxford A1-B1 ${n('oxford')}, тематические ${n('topical')}), тем ${Object.keys(topicalCache).length}`);
}
