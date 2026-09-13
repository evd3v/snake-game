import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts');
const cache = new Map();
function template(name) {
  if (!cache.has(name)) cache.set(name, fs.readFileSync(path.join(dir, `${name}.md`), 'utf8'));
  return cache.get(name);
}

const LABELS = { word: 'слово', pv: 'фразовый глагол', expr: 'выражение' };
export const kindLabel = (kind) => LABELS[kind] || kind;

function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));
}

function cardData(card) {
  return JSON.stringify({ headword: card.headword, pos: card.pos, level: card.level, ...card.source }, null, 1);
}

export function renderExplainPrompt(card, learner = { known: [], unknown: [] }) {
  const list = (arr) => (arr && arr.length ? arr.map((x) => (typeof x === 'string' ? x : x.headword)).join(', ') : '(ничего)');
  return fill(template('explain'), {
    headword: card.headword, pos: card.pos, level: card.level || '?', kind_ru: kindLabel(card.kind), data: cardData(card),
    known: list(learner.known), unknown: list(learner.unknown)
  });
}

export function renderTestPrompt(card, type, history = []) {
  return fill(template('test'), {
    headword: card.headword, type, kind_ru: kindLabel(card.kind), data: cardData(card),
    history: history.length ? history.map((h) => `- ${h}`).join('\n') : '(ничего)'
  });
}
