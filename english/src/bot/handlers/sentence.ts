import type { Context } from 'grammy';
import * as apiClient from '../services/api-client.ts';
import { formatAnalysisResult } from '../format.ts';

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
          const sentenceId = status.result.sentenceId;
          const [words, details] = await Promise.all([
            apiClient.getSentenceWords(sentenceId),
            apiClient.getSentenceDetails(sentenceId),
          ]);
          const formatted = formatAnalysisResult(text, details, words);

          await ctx.api.editMessageText(
            processingMsg.chat.id,
            processingMsg.message_id,
            formatted,
            { parse_mode: 'HTML' },
          );
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
