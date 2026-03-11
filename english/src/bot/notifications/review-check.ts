import type { Bot } from 'grammy';
import { getDueCards } from '../services/api-client.ts';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

interface ProgressStats {
  words: { new: number; learning: number; known: number };
  grammar: { new: number; learning: number; known: number };
  collocations: { new: number; learning: number; known: number };
}

async function fetchDashboardStats(): Promise<ProgressStats | null> {
  try {
    const response = await fetch(`${API_URL}/dashboard/stats`);
    if (!response.ok) return null;
    return response.json() as Promise<ProgressStats>;
  } catch {
    return null;
  }
}

async function hasReviewedToday(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/dashboard/activity`);
    if (!response.ok) return false;
    const activity = (await response.json()) as Array<{ date: string; reviews: number }>;
    if (activity.length === 0) return false;

    const timezone = process.env.NOTIFICATION_TIMEZONE ?? 'Europe/Moscow';
    const now = new Date();
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // YYYY-MM-DD format

    return activity.some((day) => day.date === todayParts && day.reviews > 0);
  } catch {
    return false;
  }
}

export async function checkAndNotifyDueCards(bot: Bot, chatId: number): Promise<void> {
  try {
    // Skip if user already reviewed today
    const reviewed = await hasReviewedToday();
    if (reviewed) {
      console.log('Skipping notification: user already reviewed today');
      return;
    }

    const allDue = await getDueCards(100);
    const count = allDue.length;

    if (count === 0) {
      return;
    }

    // Build progress report
    const stats = await fetchDashboardStats();
    let progressSection = '';

    if (stats) {
      const lines: string[] = [];

      const wordsTotal = stats.words.known + stats.words.learning;
      if (wordsTotal > 0) {
        lines.push(`Words: ${stats.words.known} known, ${stats.words.learning} learning`);
      }

      const grammarTotal = stats.grammar.known + stats.grammar.learning;
      if (grammarTotal > 0) {
        lines.push(`Grammar: ${stats.grammar.known} known, ${stats.grammar.learning} learning`);
      }

      const collTotal = stats.collocations.known + stats.collocations.learning;
      if (collTotal > 0) {
        lines.push(`Collocations: ${stats.collocations.known} known, ${stats.collocations.learning} learning`);
      }

      if (lines.length > 0) {
        progressSection = `\n\nYour progress:\n${lines.join('\n')}`;
      }
    }

    const message = `Time to review! You have ${count} card${count === 1 ? '' : 's'} due.${progressSection}\n\nUse /review to start.`;

    await bot.api.sendMessage(chatId, message);
  } catch (error) {
    console.error('Failed to check/notify due cards:', error);
  }
}
