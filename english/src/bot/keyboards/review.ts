import { InlineKeyboard } from 'grammy';

export function buildRevealKeyboard(cardId: number): InlineKeyboard {
  return new InlineKeyboard().text('Show answer', `rv:${cardId}`);
}

export function buildRatingKeyboard(cardId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('Again', `rt:${cardId}:1`)
    .text('Hard', `rt:${cardId}:2`)
    .text('Good', `rt:${cardId}:3`)
    .text('Easy', `rt:${cardId}:4`);
}

export function buildEndSessionKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('End session', 'rs');
}
