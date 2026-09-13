#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatNext, formatNeedExplanation, formatReview, formatNeedTest, formatStatus, formatDecision, parseGrade, lookupNote } from './format.mjs';

function loadEnv() {
  const file = process.env.ENGLISH_TUTOR_ENV || path.join(os.homedir(), '.claude', 'english-tutor.env');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  if (!env.API_URL || !env.API_TOKEN) throw new Error(`в ${file} нужны API_URL и API_TOKEN`);
  return env;
}

async function call(env, method, p, body) {
  const r = await fetch(`${env.API_URL.replace(/\/$/, '')}${p}`, {
    method,
    headers: { authorization: `Bearer ${env.API_TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(json.error || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return json;
}

const readStdin = () => fs.readFileSync(0, 'utf8');

export async function run(argv, env, io = { call }) {
  const [cmd, ...rest] = argv;
  const c = (m, p, b) => io.call(env, m, p, b);
  switch (cmd) {
    case 'next': {
      const kind = rest[0] ? { word: 'word', слово: 'word', pv: 'pv', фразовый: 'pv', expr: 'expr', выражение: 'expr' }[rest[0]] : '';
      const body = await c('GET', `/api/next${kind ? `?kind=${kind}` : ''}`);
      return body.explanation_md ? formatNext(body) : formatNeedExplanation(body);
    }
    case 'word': {
      const body = await c('POST', '/api/cards/lookup', { text: rest.join(' ') });
      const note = lookupNote(body);
      const text = body.explanation_md ? formatNext(body) : formatNeedExplanation(body);
      return note ? `${note}\n\n${text}` : text;
    }
    case 'explain': {
      const id = rest[0];
      const md = readStdin();
      const r = await c('POST', `/api/cards/${id}/explanation`, { md });
      const queued_left = (await c('GET', '/api/status')).all.queued;
      return formatNext({ card: r.card, explanation_md: r.card.explanation_md, queued_left });
    }
    case 'learn': case 'known': case 'discuss': {
      let id = rest[0] || 'pending';
      if (rest.length && !/^\d+$/.test(rest[0]) && rest[0] !== 'pending') {
        id = (await c('POST', '/api/cards/lookup', { text: rest.join(' ') })).card.id;
      }
      const r = await c('POST', `/api/cards/${id}/${cmd}`);
      return formatDecision(cmd, r);
    }
    case 'note': {
      const id = /^\d+$/.test(rest[0] || '') ? rest.shift() : 'pending';
      const r = await c('POST', `/api/cards/${id}/notes`, { text: rest.join(' ') });
      return `Заметка сохранена к карточке ${r.note.card_id}.`;
    }
    case 'pending': {
      const r = await c('GET', '/api/pending');
      return r.card ? `Текущий: ${r.card.headword} (${r.card.id}, ${r.card.status})` : 'Текущего элемента нет.';
    }
    case 'status':
      return formatStatus(await c('GET', '/api/status'));
    case 'review': {
      const body = await c('GET', '/api/review/next');
      if (!body.card) return 'На сегодня всё повторено.';
      return body.test ? formatReview(body) : formatNeedTest(body);
    }
    case 'test': {
      const id = rest[0] || 'current';
      const payload = JSON.parse(readStdin());
      await c('POST', `/api/review/${id}/test`, payload);
      const body = await c('GET', '/api/review/next');
      if (!body.card) return 'На сегодня всё повторено.';
      return body.test ? formatReview(body) : formatNeedTest(body);
    }
    case 'grade': {
      const rating = parseGrade(rest[0]);
      if (!rating) return 'Ошибка: оценка должна быть 1, 2, 3 или 4 (снова, трудно, норм, легко).';
      const g = await c('POST', `/api/review/${rest[1] || 'current'}/grade`, { rating });
      const head = `Записал ${rating}, следующий раз через ${g.scheduled_days} дн.`;
      if (!g.next_left) return `${head} На сегодня всё.`;
      const body = await c('GET', '/api/review/next');
      return `${head}\n\n${body.test ? formatReview(body) : formatNeedTest(body)}`;
    }
    default:
      return 'Команды: next [word|pv|expr] · word <слово или фраза> · explain <id> · learn|known|discuss [id] · note [id] текст · pending · status · review · test [id] · grade <1-4> [id]';
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  run(process.argv.slice(2), loadEnv()).then((text) => {
    process.stdout.write(text + '\n');
  }).catch((e) => {
    process.stdout.write(`Ошибка: ${e.message}\n`);
    process.exit(2);
  });
}
