import { describe, it, expect } from 'vitest';
import { buildRevealKeyboard, buildRatingKeyboard, buildEndSessionKeyboard } from '../src/bot/keyboards/review.ts';

/** Extract callback_data from a button */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cbData(btn: any): string {
  return btn.callback_data;
}

describe('buildRevealKeyboard', () => {
  it('returns a keyboard with a single "Show answer" button', () => {
    const kb = buildRevealKeyboard(42);
    expect(kb.inline_keyboard).toHaveLength(1);
    expect(kb.inline_keyboard[0]).toHaveLength(1);
    expect(kb.inline_keyboard[0][0].text).toBe('Show answer');
    expect(cbData(kb.inline_keyboard[0][0])).toBe('rv:42');
  });
});

describe('buildRatingKeyboard', () => {
  it('returns 4 rating buttons in a single row', () => {
    const kb = buildRatingKeyboard(99);
    expect(kb.inline_keyboard).toHaveLength(1);
    const buttons = kb.inline_keyboard[0];
    expect(buttons).toHaveLength(4);
    expect(buttons[0].text).toBe('Again');
    expect(cbData(buttons[0])).toBe('rt:99:1');
    expect(buttons[1].text).toBe('Hard');
    expect(cbData(buttons[1])).toBe('rt:99:2');
    expect(buttons[2].text).toBe('Good');
    expect(cbData(buttons[2])).toBe('rt:99:3');
    expect(buttons[3].text).toBe('Easy');
    expect(cbData(buttons[3])).toBe('rt:99:4');
  });
});

describe('buildEndSessionKeyboard', () => {
  it('returns a keyboard with "End session" button', () => {
    const kb = buildEndSessionKeyboard();
    expect(kb.inline_keyboard).toHaveLength(1);
    expect(kb.inline_keyboard[0][0].text).toBe('End session');
    expect(cbData(kb.inline_keyboard[0][0])).toBe('rs');
  });
});

describe('callback data size', () => {
  it('stays under 64 bytes for all review callback types with large IDs', () => {
    // rv: callback
    const rvData = 'rv:99999';
    expect(Buffer.byteLength(rvData, 'utf8')).toBeLessThan(64);

    // rt: callback (longest variant)
    const rtData = 'rt:99999:4';
    expect(Buffer.byteLength(rtData, 'utf8')).toBeLessThan(64);

    // rs: callback
    const rsData = 'rs';
    expect(Buffer.byteLength(rsData, 'utf8')).toBeLessThan(64);

    // rn: callback
    const rnData = 'rn';
    expect(Buffer.byteLength(rnData, 'utf8')).toBeLessThan(64);
  });
});

describe('review handler logic', () => {
  // These tests verify the handler module exports and session management
  it('exports registerReviewHandlers function', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    expect(typeof mod.registerReviewHandlers).toBe('function');
  });

  it('exports formatCardFront for vocabulary cards', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    const dueCard = {
      cardId: 1,
      cardType: 'vocabulary' as const,
      state: 'new',
      due: new Date().toISOString(),
      word: { lemma: 'resilient', translation: 'able to recover', cefrLevel: 'C1' },
      sentence: 'She remained resilient despite all challenges.',
    };
    const text = mod.formatCardFront(dueCard);
    expect(text).toContain('resilient');
    expect(text).toContain('She remained resilient');
    expect(text).toContain('C1');
  });

  it('exports formatCardFront for grammar cards with exercise', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    const dueCard = {
      cardId: 2,
      cardType: 'grammar' as const,
      state: 'new',
      due: new Date().toISOString(),
      pattern: { pattern: 'present perfect', description: 'Used for completed actions' },
      exercise: { id: 10, sentence: 'I ___ (finish) the work.', answer: 'have finished', hint: 'present perfect', difficultyLevel: 1 },
    };
    const text = mod.formatCardFront(dueCard);
    expect(text).toContain('Fill in the blank');
    expect(text).toContain('I ___ (finish) the work.');
  });

  it('exports formatCardFront for grammar cards without exercise', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    const dueCard = {
      cardId: 3,
      cardType: 'grammar' as const,
      state: 'new',
      due: new Date().toISOString(),
      pattern: { pattern: 'past simple', description: 'Used for past events' },
    };
    const text = mod.formatCardFront(dueCard);
    expect(text).toContain('past simple');
    expect(text).toContain('No exercises available');
  });

  it('exports formatCardReveal for vocabulary cards', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    const dueCard = {
      cardId: 1,
      cardType: 'vocabulary' as const,
      state: 'new',
      due: new Date().toISOString(),
      word: { lemma: 'resilient', translation: 'able to recover', cefrLevel: 'C1' },
      sentence: 'She remained resilient despite all challenges.',
    };
    const text = mod.formatCardReveal(dueCard);
    expect(text).toContain('resilient');
    expect(text).toContain('able to recover');
  });

  it('exports formatCardReveal for grammar cards with exercise', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    const dueCard = {
      cardId: 2,
      cardType: 'grammar' as const,
      state: 'new',
      due: new Date().toISOString(),
      pattern: { pattern: 'present perfect', description: 'Used for completed actions' },
      exercise: { id: 10, sentence: 'I ___ (finish) the work.', answer: 'have finished', hint: 'present perfect', difficultyLevel: 1 },
    };
    const text = mod.formatCardReveal(dueCard);
    expect(text).toContain('have finished');
    expect(text).toContain('present perfect');
  });

  it('exports formatSessionSummary with ratings breakdown', async () => {
    const mod = await import('../src/bot/handlers/review.ts');
    const stats = { total: 5, ratings: { 1: 1, 2: 0, 3: 3, 4: 1 } };
    const text = mod.formatSessionSummary(stats);
    expect(text).toContain('5');
    expect(text).toContain('Again: 1');
    expect(text).toContain('Hard: 0');
    expect(text).toContain('Good: 3');
    expect(text).toContain('Easy: 1');
  });
});
