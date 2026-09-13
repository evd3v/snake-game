import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderExplainPrompt, renderTestPrompt, kindLabel } from '../src/prompts.mjs';

const card = { id: 1, kind: 'word', headword: 'inspect', pos: 'verb', level: 'B2', source: { definition: 'look closely', examples: ['x'], root: 'spect', family: ['respect'] } };

test('kindLabel', () => {
  assert.equal(kindLabel('word'), 'слово');
  assert.equal(kindLabel('pv'), 'фразовый глагол');
  assert.equal(kindLabel('expr'), 'выражение');
});

test('renderExplainPrompt подставляет поля и данные', () => {
  const p = renderExplainPrompt(card, { known: ['respect'], unknown: ['prospect'] });
  assert.match(p, /\*\*inspect\*\* · verb · B2/);
  assert.match(p, /уже знает или учит \(по его словарю\): respect/);
  assert.match(p, /ещё не встречал: prospect/);
  assert.match(renderExplainPrompt(card), /\(ничего\)/);
  assert.match(p, /Данные \(слово\)/);
  assert.match(p, /"root": "spect"/);
  assert.ok(!p.includes('{{'));
});

test('renderTestPrompt подставляет тип, заголовок и историю', () => {
  const p = renderTestPrompt(card, 'cloze', ['One old sentence here.']);
  assert.match(p, /"type": "cloze"/);
  assert.match(p, /«inspect»/);
  assert.match(p, /Уже было:\n- One old sentence here\./);
  assert.match(renderTestPrompt(card, 'context', []), /Уже было:\n\(ничего\)/);
  assert.ok(!p.includes('{{'));
});

test('renderExplainPrompt: близнец попадает в промпт только знакомый', () => {
  const p1 = renderExplainPrompt(card, { known: ['respect'], unknown: [], twin_known: 'surpass' });
  assert.match(p1, /Близнец по переводу, которого ученик уже знает: surpass/);
  const p2 = renderExplainPrompt(card, { known: [], unknown: ['surpass'], twin_known: null });
  assert.match(p2, /Близнец по переводу, которого ученик уже знает: нет/);
  assert.match(p2, /Секцию пиши ТОЛЬКО если/);
});
