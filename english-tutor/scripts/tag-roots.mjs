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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
  const cachePath = 'data/roots.json';
  let cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  const template = fs.readFileSync('prompts/roots.md', 'utf8');
  const todo = words.filter((w) => !cache[rootKey(w)]);
  console.log(`всего ${words.length}, размечено ${words.length - todo.length}, осталось ${todo.length}`);
  for (const [i, batch] of batches(todo, 40).entries()) {
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
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1));
    console.log(`батч ${i + 1}/${Math.ceil(todo.length / 40)}: +${replies.length}`);
  }
}
