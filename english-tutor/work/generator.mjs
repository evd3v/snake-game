#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_BIN || path.join(HOME, '.local', 'bin', 'claude');
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';

function loadEnv() {
  const file = process.env.ENGLISH_TUTOR_ENV || path.join(HOME, '.claude', 'english-tutor.env');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function pickToken() {
  const script = path.join(HOME, '.claude', 'accounts', 'cs-usage.py');
  if (!fs.existsSync(script)) return null;
  const r = spawnSync('python3', [script, 'picktoken'], { encoding: 'utf8', timeout: 90000 });
  const token = (r.stdout || '').trim().split('\n').pop();
  return r.status === 0 && token.startsWith('sk-ant-') ? token : null;
}

function askClaude(prompt) {
  const token = pickToken();
  const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`, CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1', ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}) };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  const r = spawnSync(CLAUDE, ['-p', prompt, '--output-format', 'json', '--model', MODEL, '--no-session-persistence', '--max-turns', '1'], {
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 180000, env
  });
  if (r.status !== 0) throw new Error(`claude exit ${r.status}${r.error ? ` (${r.error.message})` : ''}: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
  const json = JSON.parse(r.stdout);
  if (json.is_error) throw new Error(`claude: ${String(json.result).slice(0, 300)}`);
  return String(json.result || '');
}

export function parseTestReply(text) {
  const cleaned = String(text).replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('в ответе нет JSON');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  return { type: obj.type, sentence: String(obj.sentence || '').trim(), answer: String(obj.answer || '').trim() };
}

export async function runJobs({ jobs, ask, post, log, max = 10 }) {
  const result = { explained: 0, tested: 0, failed: 0 };
  let budget = max;
  // Предложения для повторения идут первыми: они нужны сегодня, а разборы заготовлены на 20 карточек вперёд.
  for (const job of jobs.tests) {
    if (budget-- <= 0) return result;
    try {
      let payload = parseTestReply(await ask(job.prompt));
      let r = await post(`/api/review/${job.card_id}/test`, payload);
      if (r.status === 422) {
        payload = parseTestReply(await ask(`${job.prompt}\n\nПредыдущая попытка отклонена: ${r.body?.error || ''}. Составь другое предложение.`));
        r = await post(`/api/review/${job.card_id}/test`, payload);
      }
      if (r.status !== 200) throw new Error(`${r.status} ${r.body?.error || ''}`);
      result.tested++;
      log.info(`test ${job.headword}: ok`);
    } catch (e) {
      result.failed++;
      log.error(`test ${job.headword}: ${e.message}`);
    }
  }
  for (const job of jobs.explain) {
    if (budget-- <= 0) return result;
    try {
      const md = (await ask(job.prompt)).replace(/^```(?:markdown)?\n?|```$/g, '').trim();
      const r = await post(`/api/cards/${job.card_id}/explanation`, { md });
      if (r.status !== 200) throw new Error(`${r.status} ${r.body?.error || ''}`);
      result.explained++;
      log.info(`explain ${job.headword}: ok`);
    } catch (e) {
      result.failed++;
      log.error(`explain ${job.headword}: ${e.message}`);
    }
  }
  return result;
}

export async function main() {
  const env = loadEnv();
  const base = env.API_URL.replace(/\/$/, '');
  const headers = { authorization: `Bearer ${env.API_TOKEN}`, 'content-type': 'application/json' };
  const jobsRes = await fetch(`${base}/api/jobs`, { headers });
  if (!jobsRes.ok) throw new Error(`jobs HTTP ${jobsRes.status}`);
  const jobs = await jobsRes.json();
  const post = async (p, body) => {
    const r = await fetch(`${base}${p}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const log = { info: (m) => console.log(`${new Date().toISOString()} ${m}`), error: (m) => console.error(`${new Date().toISOString()} ${m}`) };
  const out = await runJobs({ jobs, ask: async (p) => askClaude(p), post, log, max: Number(process.env.GENERATOR_MAX) || 10 });
  log.info(`done: explain ${out.explained}, tests ${out.tested}, failed ${out.failed}, pending explain ${jobs.explain.length}, tests ${jobs.tests.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => {
    console.error(`${new Date().toISOString()} generator failed: ${e.message}`);
    process.exit(1);
  });
}
