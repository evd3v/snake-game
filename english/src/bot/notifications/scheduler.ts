import type { Bot } from 'grammy';
import { checkAndNotifyDueCards } from './review-check.ts';

const CHECK_INTERVAL_MS = 60000; // Check every minute

export function startNotificationScheduler(bot: Bot): void {
  const chatId = Number(process.env.NOTIFICATION_CHAT_ID) || 875484579;
  const timezone = process.env.NOTIFICATION_TIMEZONE ?? 'Europe/Moscow';

  let lastNotificationDate = '';

  const interval = setInterval(() => {
    const now = new Date();
    const timeInTz = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const parts: Record<string, string> = {};
    for (const part of timeInTz) {
      parts[part.type] = part.value;
    }

    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;

    if (hour === 21 && minute === 0 && lastNotificationDate !== dateKey) {
      lastNotificationDate = dateKey;
      checkAndNotifyDueCards(bot, chatId);
    }
  }, CHECK_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(interval);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  console.log(`Notification scheduler started (chat ID: ${chatId}, daily at 21:00 ${timezone})`);
}
