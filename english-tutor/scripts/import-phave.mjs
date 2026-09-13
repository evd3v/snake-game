import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

// Заголовки бывают с отступом и с несколькими пробелами после точки (ранги 100+).
const HEAD = /^(\d+)\.\s+([A-Z][A-Z ]+)$/;
const SENSE = /^(\d+)\. (.+?) \(([\d.]+)\s*%\)$/;

export function parsePhave(text) {
  const lines = text.split('\n').map((l) => l.replace(/\f/g, ''));
  const out = [];
  let cur = null;
  let sense = null;
  let wrapped = null; // длинное значение переносится на следующую строку, процент стоит в конце последней
  let inExample = false; // пример тоже может переноситься, до пустой строки
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { inExample = false; wrapped = null; continue; }
    const h = line.match(HEAD);
    if (h) {
      const headword = normalizeHeadword(h[2]);
      const [verb, ...rest] = headword.split(' ');
      cur = { headword, verb, particle: rest.join(' '), rank: Number(h[1]), senses: [] };
      out.push(cur);
      sense = null;
      wrapped = null;
      inExample = false;
      continue;
    }
    if (!cur) continue;
    const candidate = wrapped ? `${wrapped} ${line}` : line;
    const s = candidate.match(SENSE);
    if (s) {
      sense = { n: Number(s[1]), meaning: s[2].trim(), percent: Number(s[3]), example: '' };
      cur.senses.push(sense);
      wrapped = null;
      inExample = false;
      continue;
    }
    if (wrapped || /^\d+\. /.test(line)) { wrapped = candidate; continue; }
    if (!sense) continue;
    if (!sense.example) { sense.example = line; inExample = true; }
    else if (inExample) sense.example += ` ${line}`;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pv = parsePhave(fs.readFileSync('data/raw/phave.txt', 'utf8'));
  fs.writeFileSync('data/pv.json', JSON.stringify(pv, null, 1));
  console.log(`pv: ${pv.length}, senses: ${pv.reduce((n, p) => n + p.senses.length, 0)}`);
}
