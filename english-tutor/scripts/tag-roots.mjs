import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const rootKey = (w) => `${String(w.headword).toLowerCase()}|${w.pos}`;

export function batches(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function parseRootsReply(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error('в ответе нет JSON-массива');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function mergeRoots(cache, replies) {
  const out = { ...cache };
  for (const r of replies) {
    const key = `${String(r.word).toLowerCase()}|${r.pos}`;
    if (out[key]) continue;
    out[key] = {
      root: r.root ?? null,
      root_meaning_ru: r.root_meaning_ru ?? null,
      family_key: r.family_key ?? null,
      twin: r.twin ?? null,
      twin_note_ru: r.twin_note_ru ?? null
    };
  }
  return out;
}

function pickToken() {
  const script = path.join(os.homedir(), '.claude', 'accounts', 'cs-usage.py');
  if (!fs.existsSync(script)) return null;
  const r = spawnSync('python3', [script, 'picktoken'], { encoding: 'utf8', timeout: 90000 });
  const token = (r.stdout || '').trim().split('\n').pop();
  return r.status === 0 && token.startsWith('sk-ant-') ? token : null;
}

function askClaude(prompt) {
  const token = pickToken();
  const env = { ...process.env, CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1', ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}) };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  const local = path.join(os.homedir(), '.local', 'bin', 'claude');
  const bin = process.env.CLAUDE_BIN || (fs.existsSync(local) ? local : 'claude');
  const r = spawnSync(bin, [
    '-p', prompt, '--output-format', 'json', '--model', process.env.CLAUDE_MODEL || 'claude-opus-5',
    '--no-session-persistence', '--max-turns', '1'
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 240000, env });
  if (r.status !== 0) throw new Error(`claude exit ${r.status}${r.error ? ` (${r.error.message})` : ''}: ${(r.stderr || '').slice(0, 500)}`);
  const json = JSON.parse(r.stdout);
  if (json.is_error) throw new Error(`claude error: ${String(json.result).slice(0, 500)}`);
  return json.result;
}

export function shardArg(argv) {
  const i = argv.indexOf('--shard');
  if (i < 0) return null;
  const m = String(argv[i + 1] || '').match(/^(\d+)\/(\d+)$/);
  if (!m) throw new Error('--shard ожидает k/n, например 1/3');
  return { k: Number(m[1]), n: Number(m[2]) };
}

export function mergeShards(cache, shards) {
  let out = { ...cache };
  for (const shard of shards) for (const [key, value] of Object.entries(shard)) if (!out[key]) out[key] = value;
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
  const cachePath = 'data/roots.json';
  const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
  if (process.argv.includes('--merge')) {
    const shards = fs.readdirSync('data').filter((f) => /^roots-shard-\d+\.json$/.test(f)).map((f) => readJson(`data/${f}`));
    const merged = mergeShards(readJson(cachePath), shards);
    fs.writeFileSync(cachePath, JSON.stringify(merged, null, 1));
    console.log(`слито: ${Object.keys(merged).length} из ${words.length}`);
    process.exit(0);
  }
  const shard = shardArg(process.argv);
  const main = readJson(cachePath);
  const outPath = shard ? `data/roots-shard-${shard.k}.json` : cachePath;
  let cache = shard ? mergeShards(readJson(outPath), []) : main;
  const template = fs.readFileSync('prompts/roots.md', 'utf8');
  let todo = words.filter((w) => !main[rootKey(w)] && !cache[rootKey(w)]);
  const all = batches(todo, 40);
  const mine = shard ? all.filter((_, i) => i % shard.n === shard.k - 1) : all;
  console.log(`всего ${words.length}, в кэше ${Object.keys(main).length}, батчей ${all.length}, моих ${mine.length}${shard ? ` (шард ${shard.k}/${shard.n})` : ''}`);
  for (const [i, batch] of mine.entries()) {
    const list = batch.map((w) => `${w.headword} | ${w.pos}`).join('\n');
    const prompt = template.replace('{{words}}', list);
    let replies;
    try {
      replies = parseRootsReply(askClaude(prompt));
    } catch (e) {
      console.error(`батч ${i}: ${e.message}; повтор`);
      replies = parseRootsReply(askClaude(prompt));
    }
    cache = mergeRoots(cache, replies);
    fs.writeFileSync(outPath, JSON.stringify(cache, null, 1));
    console.log(`${new Date().toISOString()} батч ${i + 1}/${mine.length}: +${replies.length}`);
  }
}
