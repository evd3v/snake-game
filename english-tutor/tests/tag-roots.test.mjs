import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRootsReply, mergeRoots, batches, rootKey } from '../scripts/tag-roots.mjs';

test('parseRootsReply снимает ограждения и парсит массив', () => {
  const out = parseRootsReply('```json\n[{"word":"inspect","pos":"verb","root":"spect","root_meaning_ru":"смотреть","family_key":"spect","twin":null,"twin_note_ru":null}]\n```');
  assert.equal(out.length, 1);
  assert.equal(out[0].root, 'spect');
});

test('mergeRoots кладёт по ключу word|pos и не трогает существующие', () => {
  const cache = { 'inspect|verb': { root: 'spect' } };
  const merged = mergeRoots(cache, [{ word: 'inspect', pos: 'verb', root: 'x' }, { word: 'bleak', pos: 'adjective', root: null }]);
  assert.equal(merged['inspect|verb'].root, 'spect');
  assert.equal(merged['bleak|adjective'].root, null);
});

test('batches режет по размеру, rootKey', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(rootKey({ headword: 'Inspect', pos: 'verb' }), 'inspect|verb');
});
