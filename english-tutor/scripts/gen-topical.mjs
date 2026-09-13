import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeHeadword } from '../src/normalize.mjs';

// Бытовой слой словаря: Oxford 3000/5000 его не покрывает (нет mushroom, kettle, sleeve, jaw).
// Списки по темам пишет Claude, дальше каждое слово проверяется по частотному списку живой речи.
export const TOPICS = [
  'кухня и посуда', 'еда и продукты', 'овощи, фрукты, грибы и ягоды', 'приготовление еды',
  'дом и мебель', 'ванная и гигиена', 'уборка и бытовая техника', 'ремонт и инструменты',
  'одежда и обувь', 'детали одежды и швейное', 'тело человека', 'лицо и голова',
  'болезни, симптомы и аптека', 'сон и утро', 'семья и родственники', 'дети и уход',
  'город и улица', 'магазины и покупки', 'деньги и оплата', 'транспорт и дорога',
  'машина и её части', 'погода и осадки', 'природа и рельеф', 'деревья, цветы и растения',
  'животные домашние', 'животные дикие и птицы', 'насекомые и рыбы', 'сад и огород',
  'работа в офисе', 'учёба и школа', 'документы и бюрократия', 'спорт и движения тела',
  'отдых, отпуск и отель', 'кафе и ресторан', 'праздники и подарки', 'эмоции и мимика',
  'жесты и движения рук', 'звуки и шумы', 'свет, цвет и оттенки', 'материалы и текстуры',
  'формы, размеры и количество', 'время и распорядок дня', 'телефон и техника',
  'почта, доставка и упаковка'
];

export function parseTopicalReply(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error('в ответе нет JSON-массива');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function readFrequency(file) {
  const rank = new Map();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const [i, line] of lines.entries()) {
    const word = line.split(' ')[0];
    if (word && !rank.has(word)) rank.set(word, i + 1);
  }
  return rank;
}

// Слово годится, если это одна лемма из латиницы, оно встречается в живой речи
// (частотный список субтитров) и его ещё нет в наших списках.
export function acceptWord(entry, { rank, taken, maxRank = 25000 }) {
  const headword = normalizeHeadword(entry.word);
  if (!headword || !/^[a-z][a-z'-]{1,20}$/.test(headword)) return null;
  if (taken.has(headword)) return null;
  const freq = rank.get(headword);
  if (!freq || freq > maxRank) return null;
  const ru = String(entry.ru || '').trim();
  if (!ru) return null;
  return { headword, pos: String(entry.pos || 'noun').toLowerCase(), ru, freq_rank: freq };
}

function askClaude(prompt) {
  const local = path.join(os.homedir(), '.local', 'bin', 'claude');
  const bin = process.env.CLAUDE_BIN || (fs.existsSync(local) ? local : 'claude');
  const script = path.join(os.homedir(), '.claude', 'accounts', 'cs-usage.py');
  let token = null;
  if (fs.existsSync(script)) {
    const r = spawnSync('python3', [script, 'picktoken'], { encoding: 'utf8', timeout: 90000 });
    const out = (r.stdout || '').trim().split('\n').pop();
    if (r.status === 0 && out.startsWith('sk-ant-')) token = out;
  }
  const env = { ...process.env, CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1', ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}) };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  const r = spawnSync(bin, ['-p', prompt, '--output-format', 'json', '--model', process.env.CLAUDE_MODEL || 'claude-opus-5', '--no-session-persistence', '--max-turns', '1'], {
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 240000, env
  });
  if (r.status !== 0) throw new Error(`claude exit ${r.status}${r.error ? ` (${r.error.message})` : ''}: ${(r.stderr || '').slice(0, 300)}`);
  const json = JSON.parse(r.stdout);
  if (json.is_error) throw new Error(`claude: ${String(json.result).slice(0, 300)}`);
  return json.result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rank = readFrequency('data/raw/en_50k.txt');
  const oxford = JSON.parse(fs.readFileSync('data/raw/oxford_5000.json', 'utf8'));
  const cachePath = 'data/topical.json';
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  const template = fs.readFileSync('prompts/topical.md', 'utf8');
  const oxfordWords = new Set(Object.values(oxford).map((e) => normalizeHeadword(e.word)));
  const count = Number(process.env.TOPICAL_COUNT) || 40;
  const only = process.argv.includes('--topic') ? process.argv[process.argv.indexOf('--topic') + 1] : null;
  for (const topic of TOPICS) {
    if (only && topic !== only) continue;
    if (cache[topic]) continue;
    const taken = new Set([...oxfordWords, ...Object.values(cache).flat().map((w) => w.headword)]);
    const have = [...Object.values(cache).flat().map((w) => w.headword)].slice(-120).join(', ') || 'нет';
    const prompt = template.replace('{{topic}}', topic).replace('{{count}}', String(count)).replace('{{have}}', have);
    let entries;
    try {
      entries = parseTopicalReply(askClaude(prompt));
    } catch (e) {
      console.error(`${topic}: ${e.message}; повтор`);
      entries = parseTopicalReply(askClaude(prompt));
    }
    const accepted = [];
    for (const entry of entries) {
      const ok = acceptWord(entry, { rank, taken });
      if (ok) { accepted.push({ ...ok, topic }); taken.add(ok.headword); }
    }
    cache[topic] = accepted;
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1));
    console.log(`${new Date().toISOString()} ${topic}: ${accepted.length} из ${entries.length}`);
  }
  const total = Object.values(cache).flat().length;
  console.log(`тем ${Object.keys(cache).length}/${TOPICS.length}, слов ${total}`);
}
