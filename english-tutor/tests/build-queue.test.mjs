import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, groupWords, interleave, normalizeKey } from '../scripts/build-queue.mjs';

const w = (headword, level = 'B2', pos = 'verb') => ({ headword, pos, level, definition: 'd', example: 'e', examples: ['e'], phon: '' });

test('groupWords: модули по family_key, крупные первыми, одиночки отдельно', () => {
  const words = [w('inspect'), w('respect'), w('prospect', 'C1'), w('decide'), w('decisive', 'C1', 'adjective'), w('bleak', 'C1', 'adjective')];
  const roots = {
    'inspect|verb': { family_key: 'spect', root: 'spect' }, 'respect|verb': { family_key: 'spect', root: 'spect' },
    'prospect|verb': { family_key: 'spect', root: 'spect' }, 'decide|verb': { family_key: 'decide', root: 'cid' },
    'decisive|adjective': { family_key: 'decide', root: 'cid' }, 'bleak|adjective': { family_key: null, root: null }
  };
  const { modules, singles } = groupWords(words, roots);
  assert.deepEqual(modules.map((m) => m.key), ['spect', 'decide']);
  assert.deepEqual(modules[0].items.map((i) => i.headword), ['inspect', 'respect', 'prospect']);
  assert.deepEqual(singles.map((s) => s.headword), ['bleak']);
});

test('interleave держит пропорцию 6:2:2 и дожимает хвосты', () => {
  const a = Array.from({ length: 12 }, (_, i) => `w${i}`);
  const b = ['p0', 'p1', 'p2'];
  const c = ['e0', 'e1'];
  const out = interleave([[a, 6], [b, 2], [c, 2]]);
  assert.deepEqual(out.slice(0, 10), ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'p0', 'p1', 'e0', 'e1']);
  assert.equal(out.length, 17);
  assert.deepEqual(out.slice(-3), ['w10', 'w11', 'p2']);
});

test('buildQueue детерминирована и заполняет source', () => {
  const input = {
    words: [w('inspect'), w('respect'), w('bleak', 'C1', 'adjective')],
    pv: [{ headword: 'go on', verb: 'go', particle: 'on', rank: 1, senses: [{ n: 1, meaning: 'happen', percent: 64.5, example: 'x' }] }],
    expr: [{ headword: 'in terms of', source: 'phrase', rank: 1201, band: 2, level: null, frequency: 9800, genre: { spoken: 1, written: 2, academic: 3 }, example: 'y' }],
    roots: { 'inspect|verb': { family_key: 'spect', root: 'spect', root_meaning_ru: 'смотреть', twin: null, twin_note_ru: null }, 'respect|verb': { family_key: 'spect', root: 'spect', root_meaning_ru: 'смотреть', twin: 'honour', twin_note_ru: 'z' } }
  };
  const q1 = buildQueue(input);
  const q2 = buildQueue(input);
  assert.deepEqual(q1, q2);
  const inspect = q1.find((i) => i.headword === 'inspect');
  assert.equal(inspect.kind, 'word');
  assert.equal(inspect.group_key, 'spect');
  assert.deepEqual(inspect.source.family, ['respect']);
  const pv = q1.find((i) => i.kind === 'pv');
  assert.equal(pv.group_key, 'on');
  assert.equal(pv.group_label, 'частица on');
  const ex = q1.find((i) => i.kind === 'expr');
  assert.equal(ex.source.origin, 'phrase');
  assert.equal(ex.group_key, 'band-2');
});

test('normalizeKey сводит варианты ключа семьи', () => {
  assert.equal(normalizeKey('Spect-'), 'spect');
  assert.equal(normalizeKey(' spec '), 'spec');
  assert.equal(normalizeKey(null), null);
  const { modules } = groupWords([w('inspect'), w('respect')], { 'inspect|verb': { family_key: 'Spect' }, 'respect|verb': { family_key: 'spect-' } });
  assert.deepEqual(modules.map((m) => m.key), ['spect']);
});
