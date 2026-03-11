import type { Bot, Context } from 'grammy';
import type { DueCard } from '../services/api-client.ts';
import * as apiClient from '../services/api-client.ts';
import { buildRevealKeyboard, buildRatingKeyboard, buildEndSessionKeyboard } from '../keyboards/review.ts';
import { escapeHtml } from '../format.ts';

interface ReviewStats {
  total: number;
  ratings: Record<number, number>;
}

interface ReviewSession {
  cards: DueCard[];
  currentIndex: number;
  revealed: boolean;
  stats: ReviewStats;
}

const reviewSessions = new Map<number, ReviewSession>();

export function formatCardFront(card: DueCard): string {
  if (card.cardType === 'vocabulary' && card.word) {
    const lemma = escapeHtml(card.word.lemma);
    const pos = card.word.partOfSpeech ? ` · ${escapeHtml(card.word.partOfSpeech)}` : '';
    const cefr = card.word.cefrLevel ? ` · ${escapeHtml(card.word.cefrLevel)}` : '';
    const sentence = card.sentence ? `\n\n<i>"${escapeHtml(card.sentence)}"</i>` : '';
    return `📚 <b>${lemma}</b>${pos}${cefr}${sentence}`;
  }

  if (card.cardType === 'grammar') {
    if (card.exercise) {
      const hint = card.exercise.hint ? `\n\n💡 <i>${escapeHtml(card.exercise.hint)}</i>` : '';
      return `📖 Fill in the blank:\n\n${escapeHtml(card.exercise.sentence)}${hint}`;
    }
    const patternName = card.pattern ? escapeHtml(card.pattern.pattern) : 'Grammar';
    const desc = card.pattern?.description ? `\n${escapeHtml(card.pattern.description)}` : '';
    const example = card.exampleSentence ? `\n\n<i>"${escapeHtml(card.exampleSentence)}"</i>` : '';
    return `📖 <b>${patternName}</b>${desc}${example}\n\n<i>Rate based on your knowledge of this pattern</i>`;
  }

  if (card.cardType === 'collocation' && card.collocation) {
    const text = escapeHtml(card.collocation.text);
    const type = escapeHtml(card.collocation.type.replace(/_/g, ' '));
    const cefr = card.collocation.cefrLevel ? ` · ${escapeHtml(card.collocation.cefrLevel)}` : '';
    const sentence = card.sentence ? `\n\n<i>"${escapeHtml(card.sentence)}"</i>` : '';
    return `🔗 <b>${text}</b> · ${type}${cefr}${sentence}`;
  }

  return 'Unknown card type';
}

export function isAutoRevealCard(card: DueCard): boolean {
  return card.cardType === 'grammar' && !card.exercise;
}

export function formatCardReveal(card: DueCard): string {
  if (card.cardType === 'vocabulary' && card.word) {
    const front = formatCardFront(card);
    const translation = card.word.translation ? escapeHtml(card.word.translation) : '—';
    const definition = card.word.definition ? `\n\n📖 <i>${escapeHtml(card.word.definition)}</i>` : '';
    return `${front}\n\n✅ <b>${translation}</b>${definition}`;
  }

  if (card.cardType === 'grammar') {
    if (card.exercise) {
      const front = formatCardFront(card);
      const answer = escapeHtml(card.exercise.answer);
      const desc = card.pattern?.description ? `\n\n${escapeHtml(card.pattern.description)}` : '';
      const example = card.exampleSentence ? `\n<i>"${escapeHtml(card.exampleSentence)}"</i>` : '';
      return `${front}\n\n✅ <b>${answer}</b>${desc}${example}`;
    }
    // No exercise — front already contains all info
    return formatCardFront(card);
  }

  if (card.cardType === 'collocation' && card.collocation) {
    const front = formatCardFront(card);
    const translation = card.collocation.translation ? escapeHtml(card.collocation.translation) : '—';
    return `${front}\n\n✅ <b>${translation}</b>`;
  }

  return formatCardFront(card);
}

export function formatSessionSummary(stats: ReviewStats): string {
  const again = stats.ratings[1] ?? 0;
  const hard = stats.ratings[2] ?? 0;
  const good = stats.ratings[3] ?? 0;
  const easy = stats.ratings[4] ?? 0;
  return `🎉 <b>Review complete!</b>\n\n${stats.total} cards reviewed\n\n🔴 Again: ${again}\n🟠 Hard: ${hard}\n🟢 Good: ${good}\n🔵 Easy: ${easy}`;
}

function formatProgress(current: number, total: number): string {
  return `[${current + 1}/${total}] `;
}

export function registerReviewHandlers(bot: Bot): void {
  // /review command
  bot.command('review', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Check for active session
    if (reviewSessions.has(chatId)) {
      await ctx.reply('You have an active review session', {
        reply_markup: buildEndSessionKeyboard(),
      });
      return;
    }

    try {
      const cards = await apiClient.getDueCards(20);

      if (cards.length === 0) {
        await ctx.reply('No cards due for review! Come back later.');
        return;
      }

      const session: ReviewSession = {
        cards,
        currentIndex: 0,
        revealed: false,
        stats: { total: 0, ratings: { 1: 0, 2: 0, 3: 0, 4: 0 } },
      };
      reviewSessions.set(chatId, session);

      const card = cards[0];
      const text = formatProgress(0, cards.length) + formatCardFront(card);
      const keyboard = isAutoRevealCard(card)
        ? buildRatingKeyboard(card.cardId)
        : buildRevealKeyboard(card.cardId);
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error('Failed to start review:', error);
      await ctx.reply('Failed to load review cards. Please try again.');
    }
  });

  // Reveal answer
  bot.callbackQuery(/^rv:(\d+)$/, async (ctx: Context) => {
    const chatId = ctx.callbackQuery?.message?.chat.id;
    if (!chatId) {
      await ctx.answerCallbackQuery('Error: no chat context');
      return;
    }

    const session = reviewSessions.get(chatId);
    if (!session) {
      await ctx.answerCallbackQuery('This review session has expired');
      return;
    }

    const card = session.cards[session.currentIndex];
    session.revealed = true;

    const text = formatProgress(session.currentIndex, session.cards.length) + formatCardReveal(card);
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: buildRatingKeyboard(card.cardId),
    });
    await ctx.answerCallbackQuery();
  });

  // Rate card
  bot.callbackQuery(/^rt:(\d+):([1-4])$/, async (ctx: Context) => {
    const match = ctx.match as RegExpMatchArray;
    const cardId = Number(match[1]);
    const rating = Number(match[2]);
    const chatId = ctx.callbackQuery?.message?.chat.id;

    if (!chatId) {
      await ctx.answerCallbackQuery('Error: no chat context');
      return;
    }

    const session = reviewSessions.get(chatId);
    if (!session) {
      await ctx.answerCallbackQuery('This review session has expired');
      return;
    }

    try {
      await apiClient.rateCard(cardId, rating);
    } catch (error) {
      console.error('Failed to rate card:', error);
    }

    // Update stats
    session.stats.total += 1;
    session.stats.ratings[rating] = (session.stats.ratings[rating] ?? 0) + 1;

    // Advance to next card
    session.currentIndex += 1;
    session.revealed = false;

    if (session.currentIndex < session.cards.length) {
      const nextCard = session.cards[session.currentIndex];
      const text = formatProgress(session.currentIndex, session.cards.length) + formatCardFront(nextCard);
      const keyboard = isAutoRevealCard(nextCard)
        ? buildRatingKeyboard(nextCard.cardId)
        : buildRevealKeyboard(nextCard.cardId);
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      // Session complete
      const summary = formatSessionSummary(session.stats);
      await ctx.editMessageText(summary, { parse_mode: 'HTML' });
      reviewSessions.delete(chatId);
    }

    await ctx.answerCallbackQuery();
  });

  // End session early
  bot.callbackQuery('rs', async (ctx: Context) => {
    const chatId = ctx.callbackQuery?.message?.chat.id;
    if (!chatId) {
      await ctx.answerCallbackQuery('Error: no chat context');
      return;
    }

    const session = reviewSessions.get(chatId);
    if (!session) {
      await ctx.answerCallbackQuery('This review session has expired');
      return;
    }

    if (session.stats.total > 0) {
      const summary = formatSessionSummary(session.stats);
      await ctx.editMessageText(summary, { parse_mode: 'HTML' });
    } else {
      await ctx.editMessageText('Session ended.');
    }

    reviewSessions.delete(chatId);
    await ctx.answerCallbackQuery();
  });
}
