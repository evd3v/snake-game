import type { Bot, Context } from 'grammy';
import type { WordInfo } from '../services/api-client.ts';
import * as apiClient from '../services/api-client.ts';
import { buildWordSelectionKeyboard, buildFamiliarityKeyboard } from '../keyboards/analysis.ts';
import { escapeHtml } from '../format.ts';

const FAMILIARITY_MAP: Record<string, string> = {
  ns: 'never_seen',
  su: 'seen_unsure',
  uc: 'understand_in_context',
};

interface SelectionState {
  selected: Set<number>;
  words: WordInfo[];
  pendingFamiliarity: number[];
}

const selectionStates = new Map<string, SelectionState>();

function stateKey(chatId: number, sentenceId: number): string {
  return `${chatId}:${sentenceId}`;
}

export function initSelection(chatId: number, sentenceId: number, words: WordInfo[]): void {
  selectionStates.set(stateKey(chatId, sentenceId), {
    selected: new Set(),
    words,
    pendingFamiliarity: [],
  });
}

export function registerVocabularyHandlers(bot: Bot): void {
  // Toggle word selection
  bot.callbackQuery(/^sel:(\d+):(\d+)$/, async (ctx: Context) => {
    const match = ctx.match as RegExpMatchArray;
    const sentenceId = Number(match[1]);
    const wordId = Number(match[2]);
    const chatId = ctx.callbackQuery?.message?.chat.id;

    if (!chatId) {
      await ctx.answerCallbackQuery('Error: no chat context');
      return;
    }

    const state = selectionStates.get(stateKey(chatId, sentenceId));
    if (!state) {
      await ctx.answerCallbackQuery('This selection has expired');
      return;
    }

    // Toggle
    if (state.selected.has(wordId)) {
      state.selected.delete(wordId);
    } else {
      state.selected.add(wordId);
    }

    const keyboard = buildWordSelectionKeyboard(sentenceId, state.words, state.selected);
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Finish selection, start familiarity flow
  bot.callbackQuery(/^done:(\d+)$/, async (ctx: Context) => {
    const match = ctx.match as RegExpMatchArray;
    const sentenceId = Number(match[1]);
    const chatId = ctx.callbackQuery?.message?.chat.id;

    if (!chatId) {
      await ctx.answerCallbackQuery('Error: no chat context');
      return;
    }

    const state = selectionStates.get(stateKey(chatId, sentenceId));
    if (!state) {
      await ctx.answerCallbackQuery('This selection has expired');
      return;
    }

    // Build pending list from selected word IDs
    state.pendingFamiliarity = [...state.selected];
    const firstWordId = state.pendingFamiliarity[0];
    const firstWord = state.words.find((w) => w.id === firstWordId);

    if (!firstWord) {
      await ctx.answerCallbackQuery('No words selected');
      return;
    }

    const keyboard = buildFamiliarityKeyboard(sentenceId, firstWordId);
    const label = `<b>How well do you know "${escapeHtml(firstWord.lemma)}"?</b>`;
    await ctx.editMessageText(label, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
  });

  // Set familiarity for a word
  bot.callbackQuery(/^fam:(\d+):(\d+):(.+)$/, async (ctx: Context) => {
    const match = ctx.match as RegExpMatchArray;
    const sentenceId = Number(match[1]);
    const wordId = Number(match[2]);
    const code = match[3];
    const chatId = ctx.callbackQuery?.message?.chat.id;

    if (!chatId) {
      await ctx.answerCallbackQuery('Error: no chat context');
      return;
    }

    const state = selectionStates.get(stateKey(chatId, sentenceId));
    if (!state) {
      await ctx.answerCallbackQuery('This selection has expired');
      return;
    }

    // Save familiarity (skip if code is 'skip')
    if (code !== 'skip' && FAMILIARITY_MAP[code]) {
      try {
        await apiClient.setFamiliarity(wordId, FAMILIARITY_MAP[code]);
      } catch (error) {
        console.error('Failed to set familiarity:', error);
      }
    }

    // Remove this word from pending
    state.pendingFamiliarity = state.pendingFamiliarity.filter((id) => id !== wordId);

    if (state.pendingFamiliarity.length > 0) {
      // Show next word
      const nextWordId = state.pendingFamiliarity[0];
      const nextWord = state.words.find((w) => w.id === nextWordId);

      if (nextWord) {
        const keyboard = buildFamiliarityKeyboard(sentenceId, nextWordId);
        const label = `<b>How well do you know "${escapeHtml(nextWord.lemma)}"?</b>`;
        await ctx.editMessageText(label, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    } else {
      // All done
      const savedCount = state.selected.size;
      await ctx.editMessageText(`Saved ${savedCount} word(s) to vocabulary!`);
      selectionStates.delete(stateKey(chatId, sentenceId));
    }

    await ctx.answerCallbackQuery();
  });
}
