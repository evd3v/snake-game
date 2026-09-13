import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

// Транскрипция и озвучка слов: датасет Oxford Learner's Dictionaries (слово, часть речи,
// IPA британский и американский, mp3). Ключ — «слово|часть речи», как в остальных списках.
export function buildAudioMap(fullWordJson) {
  const map = {};
  for (const item of fullWordJson) {
    const v = item.value || {};
    const headword = normalizeHeadword(v.word);
    const pos = String(v.type || '').toLowerCase();
    if (!headword) continue;
    const entry = {
      ipa_uk: v.phonetics?.uk || '',
      ipa_us: v.phonetics?.us || '',
      audio_uk: v.uk?.mp3 || '',
      audio_us: v.us?.mp3 || ''
    };
    if (!entry.ipa_uk && !entry.audio_uk) continue;
    map[`${headword}|${pos}`] = entry;
    if (!map[headword]) map[headword] = entry;
  }
  return map;
}

// Озвучка и IPA для карточки: сначала точное совпадение по части речи, потом по слову.
export function lookupAudio(map, headword, pos = '') {
  return map[`${normalizeHeadword(headword)}|${String(pos).toLowerCase()}`] || map[normalizeHeadword(headword)] || null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const full = JSON.parse(fs.readFileSync('data/raw/full-word.json', 'utf8'));
  const map = buildAudioMap(full);
  fs.writeFileSync('data/audio.json', JSON.stringify(map));
  console.log(`audio: ${Object.keys(map).length} ключей`);
}
