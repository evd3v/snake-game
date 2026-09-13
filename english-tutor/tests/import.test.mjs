import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOxford } from '../scripts/import-oxford.mjs';
import { parsePhave } from '../scripts/import-phave.mjs';
import { parsePhraseDoc, parseOpl } from '../scripts/import-phrase.mjs';
import { normalizeHeadword } from '../src/normalize.mjs';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('normalizeHeadword', () => {
  assert.equal(normalizeHeadword('  A bit of a…  '), 'a bit of a');
  assert.equal(normalizeHeadword('COME UP'), 'come up');
  assert.equal(normalizeHeadword('look for sb/sth'), 'look for sb/sth');
});

test('parseOxford берёт только b2 и c1 и подклеивает примеры', () => {
  const ox = {
    k1: { word: 'a', type: 'indefinite article', cefr: 'a1', definition: 'x', example: 'a man', phon_br: '/ə/' },
    k2: { word: 'heritage', type: 'noun', cefr: 'c1', definition: 'the history...', example: 'rich heritage', phon_br: '/ˈherɪtɪdʒ/' },
    k3: { word: 'absorb', type: 'verb', cefr: 'b2', definition: 'take in', example: 'absorb water', phon_br: '/əbˈzɔːb/' }
  };
  const full = [{ id: 1, value: { word: 'heritage', type: 'noun', level: 'C1', examples: ['rich heritage', 'our cultural heritage'] } }];
  const out = parseOxford(ox, full);
  assert.deepEqual(out.map((w) => w.headword), ['heritage', 'absorb']);
  assert.equal(out[0].level, 'C1');
  assert.deepEqual(out[0].examples, ['rich heritage', 'our cultural heritage']);
  assert.deepEqual(out[1].examples, ['absorb water']);
});

test('parsePhave: 2 глагола, значения с процентами и примерами', () => {
  const out = parsePhave(fx('phave-sample.txt'));
  assert.equal(out.length, 4);
  assert.equal(out[0].headword, 'go on');
  assert.deepEqual([out[3].headword, out[3].senses[0].percent, out[3].senses[0].example], ['end up', 100, 'We ended up staying at home all evening.']);
  assert.match(out[3].senses[0].meaning, /^Finally do STH .* series of events$/);
  assert.deepEqual([out[2].rank, out[2].headword, out[2].senses[0].percent], [100, 'carry on', 75]);
  assert.equal(out[0].verb, 'go');
  assert.equal(out[0].particle, 'on');
  assert.equal(out[0].rank, 1);
  assert.equal(out[0].senses.length, 2);
  assert.equal(out[0].senses[0].percent, 64.5);
  assert.match(out[0].senses[0].example, /debate going on/);
  assert.equal(out[1].headword, 'pick up');
});

test('parsePhraseDoc: ранг, фраза, частота, жанры, пример', () => {
  const out = parsePhraseDoc(fx('phrase-sample.txt'));
  assert.equal(out.length, 4);
  assert.equal(out[3].headword, 'out of (‘due to’)');
  assert.deepEqual(out[0], {
    headword: 'have to', source: 'phrase', rank: 107, band: 1, level: null,
    frequency: 83092, genre: { spoken: 3, written: 2, academic: 1 }, example: 'I exercise because I have to.'
  });
  assert.equal(out[2].band, 2);
});

test('parseOpl: только b2 и c1', () => {
  const out = parseOpl(fx('opl-sample.html'));
  assert.deepEqual(out.map((e) => [e.headword, e.level]), [['a bit of a', 'B2'], ['come up with sth', 'B2'], ['in the long run', 'C1']]);
  assert.equal(out[0].source, 'opl');
});
