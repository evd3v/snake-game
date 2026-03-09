import type { Context } from 'grammy';
import * as apiClient from '../services/api-client.ts';
import { formatAnalysisResult } from '../format.ts';
import { buildWordSelectionKeyboard } from '../keyboards/analysis.ts';
import { initSelection } from './vocabulary.ts';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSentenceHandler() {
  return async (ctx: Context): Promise<void> => {
    const text = ctx.message?.text;
    if (!text) return;

    const processingMsg = await ctx.reply('Analyzing your sentence...');

    try {
      const { jobId } = await apiClient.submitSentence(text);

      let attempts = 0;
      while (attempts < MAX_POLL_ATTEMPTS) {
        await delay(POLL_INTERVAL_MS);
        attempts++;

        const status = await apiClient.getJobStatus(jobId);

        if (status.status === 'completed' && status.result) {
          const words = await apiClient.getSentenceWords(status.result.sentenceId);
          const formatted = formatAnalysisResult(status.result, words);

          const sentenceId = status.result.sentenceId;
          const chatId = processingMsg.chat.id;

          // Initialize word selection state and attach keyboard
          if (words.length > 0) {
            initSelection(chatId, sentenceId, words);
            const keyboard = buildWordSelectionKeyboard(sentenceId, words, new Set());
            await ctx.api.editMessageText(
              chatId,
              processingMsg.message_id,
              formatted,
              { parse_mode: 'HTML', reply_markup: keyboard },
            );
          } else {
            await ctx.api.editMessageText(
              chatId,
              processingMsg.message_id,
              formatted,
              { parse_mode: 'HTML' },
            );
          }
          return;
        }

        if (status.status === 'failed') {
          const errorMsg = status.error ?? 'Unknown error';
          await ctx.api.editMessageText(
            processingMsg.chat.id,
            processingMsg.message_id,
            `Analysis failed: ${errorMsg}`,
          );
          return;
        }
      }

      // Timeout
      await ctx.api.editMessageText(
        processingMsg.chat.id,
        processingMsg.message_id,
        'Analysis timed out. Please try again.',
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await ctx.api.editMessageText(
        processingMsg.chat.id,
        processingMsg.message_id,
        `Error: ${errorMsg}`,
      );
    }
  };
}
