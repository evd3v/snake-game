import { InlineKeyboard } from 'grammy';
import type { WordInfo } from '../services/api-client.ts';

export function buildWordSelectionKeyboard(
  sentenceId: number,
  words: WordInfo[],
  selected: Set<number>,
): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (let i = 0; i < words.length; i++) {
    if (i > 0) kb.row();
    const word = words[i];
    const mark = selected.has(word.id) ? '✅ ' : '';
    const translation = word.translation ?? '—';
    const cefr = word.cefrLevel ? ` [${word.cefrLevel}]` : '';
    const label = `${mark}${word.lemma} — ${translation}${cefr}`;
    kb.text(label, `sel:${sentenceId}:${word.id}`);
  }

  if (selected.size > 0) {
    kb.row().text(`Save ${selected.size} word(s)`, `done:${sentenceId}`);
  }

  return kb;
}

export function buildFamiliarityKeyboard(
  sentenceId: number,
  wordId: number,
): InlineKeyboard {
  return new InlineKeyboard()
    .text('Never seen', `fam:${sentenceId}:${wordId}:ns`).row()
    .text('Seen but unsure', `fam:${sentenceId}:${wordId}:su`).row()
    .text('Understand in context', `fam:${sentenceId}:${wordId}:uc`).row()
    .text('Skip', `fam:${sentenceId}:${wordId}:skip`);
}
