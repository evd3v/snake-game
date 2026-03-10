import type { Bot } from 'grammy';
import { getDueCards } from '../services/api-client.ts';

export async function checkAndNotifyDueCards(bot: Bot, chatId: number): Promise<void> {
  try {
    const preview = await getDueCards(1);

    if (preview.length === 0) {
      return;
    }

    const allDue = await getDueCards(100);
    const count = allDue.length;

    await bot.api.sendMessage(
      chatId,
      `You have ${count} card${count === 1 ? '' : 's'} due for review! Use /review to start.`,
    );
  } catch (error) {
    console.error('Failed to check/notify due cards:', error);
  }
}
