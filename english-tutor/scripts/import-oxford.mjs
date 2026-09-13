import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';
import { lookupAudio } from './import-audio.mjs';

export function parseOxford(oxfordJson, fullWordJson = [], audioMap = {}) {
  const extra = new Map();
  for (const item of fullWordJson) {
    const v = item.value || {};
    extra.set(`${normalizeHeadword(v.word)}|${(v.type || '').toLowerCase()}`, v.examples || []);
  }
  const out = [];
  for (const e of Object.values(oxfordJson)) {
    const level = String(e.cefr || '').toUpperCase();
    if (level !== 'B2' && level !== 'C1') continue;
    const headword = normalizeHeadword(e.word);
    const pos = String(e.type || '').toLowerCase();
    const more = extra.get(`${headword}|${pos}`) || [];
    const examples = [...new Set([e.example, ...more].filter(Boolean))];
    const sound = lookupAudio(audioMap, headword, pos) || {};
    out.push({
      headword, pos, level, definition: e.definition || '', example: e.example || '', examples,
      phon: e.phon_br || sound.ipa_uk || '', phon_us: e.phon_n_am || sound.ipa_us || '', audio: sound.audio_uk || ''
    });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ox = JSON.parse(fs.readFileSync('data/raw/oxford_5000.json', 'utf8'));
  const full = JSON.parse(fs.readFileSync('data/raw/full-word.json', 'utf8'));
  const audioMap = JSON.parse(fs.readFileSync('data/audio.json', 'utf8'));
  const words = parseOxford(ox, full, audioMap);
  fs.writeFileSync('data/words.json', JSON.stringify(words, null, 1));
  console.log(`words: ${words.length}`);
}
