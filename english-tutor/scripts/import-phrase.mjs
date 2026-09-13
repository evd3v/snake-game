import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

const stars = (s) => (s.trim().toLowerCase() === 'x' ? 0 : (s.match(/\*/g) || []).length);

export function parsePhraseDoc(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r/g, '').trimEnd());
  const out = [];
  for (let i = 0; i + 6 < lines.length; i++) {
    if (!/^\d+$/.test(lines[i].trim())) continue;
    const phrase = lines[i + 1].trim();
    // Фразы в верхнем регистре; в скобках бывают пояснения строчными: (BE) LIKELY TO, OUT OF (‘IN’/’FROM’), THE LATTER (anaphor).
    if (!/^[A-Z(][A-Za-z0-9 '’‘/()\-.,?!+]*$/.test(phrase) || !/[A-Z]{2}/.test(phrase)) continue;
    if (!/^\d+$/.test(lines[i + 2].trim())) continue;
    const marks = [lines[i + 3], lines[i + 4], lines[i + 5]];
    if (!marks.every((m) => /^[\s*xX]+$/.test(m))) continue;
    const rank = Number(lines[i].trim());
    out.push({
      headword: normalizeHeadword(phrase),
      source: 'phrase',
      rank,
      band: Math.max(1, Math.ceil(rank / 1000)),
      level: null,
      frequency: Number(lines[i + 2].trim()),
      genre: { spoken: stars(marks[0]), written: stars(marks[1]), academic: stars(marks[2]) },
      example: lines[i + 6].trim()
    });
    i += 6;
  }
  return out;
}

export function parseOpl(html) {
  const out = [];
  const re = /<li[^>]*data-hw="([^"]+)"[^>]*data-oxford_phrase_list="([a-c][12])"/g;
  let m;
  while ((m = re.exec(html))) {
    const level = m[2].toUpperCase();
    if (level !== 'B2' && level !== 'C1') continue;
    out.push({ headword: normalizeHeadword(m[1]), source: 'opl', rank: null, band: null, level, frequency: null, genre: null, example: null });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const phrase = parsePhraseDoc(fs.readFileSync('data/raw/phrase.txt', 'utf8'));
  const opl = parseOpl(fs.readFileSync('data/raw/opl.html', 'utf8'));
  const seen = new Set(phrase.map((p) => p.headword));
  const merged = [...phrase, ...opl.filter((e) => !seen.has(e.headword))];
  fs.writeFileSync('data/expr.json', JSON.stringify(merged, null, 1));
  console.log(`phrase: ${phrase.length}, opl b2+c1: ${opl.length}, expr total: ${merged.length}`);
}
