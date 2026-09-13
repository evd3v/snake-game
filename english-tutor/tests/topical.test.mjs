import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseTopicalReply, acceptWord, readFrequency, TOPICS } from '../scripts/gen-topical.mjs';

test('темы перечислены и не повторяются', () => {
  assert.ok(TOPICS.length >= 40);
  assert.equal(new Set(TOPICS).size, TOPICS.length);
});

test('parseTopicalReply снимает ограждения', () => {
  const out = parseTopicalReply('```json\n[{"word":"kettle","pos":"noun","ru":"чайник"}]\n```');
  assert.deepEqual(out, [{ word: 'kettle', pos: 'noun', ru: 'чайник' }]);
  assert.throws(() => parseTopicalReply('нет json'), /JSON/);
});

test('acceptWord: только леммы из частотного списка, без дублей и без мусора', () => {
  const rank = new Map([['kettle', 8337], ['mushroom', 10166], ['shoelace', 28572], ['spoon', 3000]]);
  const taken = new Set(['spoon']);
  const opts = { rank, taken };
  assert.deepEqual(acceptWord({ word: 'Kettle', pos: 'NOUN', ru: 'чайник' }, opts), { headword: 'kettle', pos: 'noun', ru: 'чайник', freq_rank: 8337 });
  assert.equal(acceptWord({ word: 'spoon', pos: 'noun', ru: 'ложка' }, opts), null, 'уже есть в наших списках');
  assert.equal(acceptWord({ word: 'shoelace', pos: 'noun', ru: 'шнурок' }, opts), null, 'слишком редкое для базового слоя');
  assert.equal(acceptWord({ word: 'nonexistentword', pos: 'noun', ru: 'нечто' }, opts), null);
  assert.equal(acceptWord({ word: 'kettle drum', pos: 'noun', ru: 'котёл' }, opts), null, 'не одно слово');
  assert.equal(acceptWord({ word: 'mushroom', pos: 'noun', ru: '' }, opts), null, 'без перевода');
  assert.equal(acceptWord({ word: 'shoelace', pos: 'noun', ru: 'шнурок' }, { rank, taken, maxRank: 30000 }).freq_rank, 28572);
});

test('readFrequency: ранг по позиции строки', () => {
  const rank = readFrequency('data/raw/en_50k.txt');
  assert.equal(rank.get('you'), 1);
  assert.ok(rank.get('mushroom') > 9000 && rank.get('mushroom') < 12000);
  assert.equal(rank.get('zzzzzz'), undefined);
});
