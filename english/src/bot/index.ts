import 'dotenv/config';
import { Bot } from 'grammy';
import { createSentenceHandler } from './handlers/sentence.ts';
import { registerVocabularyHandlers } from './handlers/vocabulary.ts';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

const bot = new Bot(token);

registerVocabularyHandlers(bot);
bot.on('message:text', createSentenceHandler());

bot.catch((err) => {
  console.error('Bot error:', err);
});

const shutdown = () => {
  bot.stop();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bot.start({
  onStart: () => {
    console.log('Bot started');
  },
});
