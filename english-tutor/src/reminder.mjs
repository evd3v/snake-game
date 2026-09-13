import { getSetting, setSetting } from './db.mjs';
import { status, localDay } from './queue.mjs';

export function reminderDue({ at, nowLocalHHMM, today, sentDay, dueToday }) {
  if (!at) return false;
  if (nowLocalHHMM !== at) return false;
  if (sentDay === today) return false;
  return dueToday > 0;
}

export function localHHMM(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: process.env.TZ || 'Europe/Moscow' }).format(date);
}

export async function sendTelegram(env, text) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
  });
  if (!r.ok) throw new Error(`telegram ${r.status}`);
}

export function startReminder({ db, env, send = sendTelegram, intervalMs = 60000, log = console }) {
  if (!env.REMINDER_AT || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return null;
  const timer = setInterval(async () => {
    try {
      const now = new Date();
      const s = status(db, now);
      const today = localDay(now);
      if (!reminderDue({ at: env.REMINDER_AT, nowLocalHHMM: localHHMM(now), today, sentDay: getSetting(db, 'reminder_sent_day') || '', dueToday: s.all.due_today })) return;
      await send(env, `Ждёт повторения: ${s.all.due_today}. Команда /review в этом чате или дашборд.`);
      setSetting(db, 'reminder_sent_day', today);
    } catch (e) {
      log.error(`reminder: ${e.message}`);
    }
  }, intervalMs);
  timer.unref();
  return timer;
}
