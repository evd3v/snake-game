import type { Bot } from 'grammy';
import { checkAndNotifyDueCards } from './review-check.ts';

const ONE_HOUR_MS = 3600000;
const STARTUP_DELAY_MS = 10000;

export function startNotificationScheduler(bot: Bot): void {
  const chatId = Number(process.env.NOTIFICATION_CHAT_ID) || 875484579;

  // Run once after startup delay
  const startupTimeout = setTimeout(() => {
    checkAndNotifyDueCards(bot, chatId);
  }, STARTUP_DELAY_MS);

  // Run every hour
  const interval = setInterval(() => {
    checkAndNotifyDueCards(bot, chatId);
  }, ONE_HOUR_MS);

  const cleanup = () => {
    clearTimeout(startupTimeout);
    clearInterval(interval);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  console.log(`Notification scheduler started (chat ID: ${chatId}, interval: 1h)`);
}
