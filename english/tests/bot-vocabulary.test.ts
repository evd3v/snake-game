import { describe, it, expect } from 'vitest';
import { buildWordSelectionKeyboard, buildFamiliarityKeyboard } from '../src/bot/keyboards/analysis.ts';
import type { WordInfo } from '../src/bot/services/api-client.ts';

const sampleWords: WordInfo[] = [
  { id: 1, lemma: 'reluctant', translation: 'unwilling', cefrLevel: 'B2', familiarity: 'unknown', thematicCluster: null },
  { id: 2, lemma: 'crucial', translation: 'very important', cefrLevel: 'B1', familiarity: 'unknown', thematicCluster: null },
  { id: 3, lemma: 'evidence', translation: 'proof', cefrLevel: 'B1', familiarity: 'unknown', thematicCluster: null },
];

describe('buildWordSelectionKeyboard', () => {
  it('returns one row per word plus no save button when nothing selected', () => {
    const kb = buildWordSelectionKeyboard(42, sampleWords, new Set());
    // 3 words = 3 rows, no save button
    expect(kb.inline_keyboard).toHaveLength(3);
  });

  it('marks selected words with a checkmark prefix', () => {
    const selected = new Set([2]);
    const kb = buildWordSelectionKeyboard(42, sampleWords, selected);
    const buttons = kb.inline_keyboard.map((row) => row[0]);
    // Word id 2 (crucial) should have checkmark
    expect(buttons[1].text).toMatch(/^✅/);
    // Others should not
    expect(buttons[0].text).not.toMatch(/^✅/);
    expect(buttons[2].text).not.toMatch(/^✅/);
  });

  it('shows Save button when selection is non-empty', () => {
    const selected = new Set([1, 3]);
    const kb = buildWordSelectionKeyboard(42, sampleWords, selected);
    // 3 word rows + 1 save row
    expect(kb.inline_keyboard).toHaveLength(4);
    const lastRow = kb.inline_keyboard[3];
    expect(lastRow[0].text).toContain('Save 2 word(s)');
    expect(lastRow[0].callback_data).toBe('done:42');
  });

  it('uses correct callback data format for word buttons', () => {
    const kb = buildWordSelectionKeyboard(42, sampleWords, new Set());
    expect(kb.inline_keyboard[0][0].callback_data).toBe('sel:42:1');
    expect(kb.inline_keyboard[1][0].callback_data).toBe('sel:42:2');
    expect(kb.inline_keyboard[2][0].callback_data).toBe('sel:42:3');
  });

  it('includes lemma, translation, and CEFR level in button text', () => {
    const kb = buildWordSelectionKeyboard(42, sampleWords, new Set());
    const text = kb.inline_keyboard[0][0].text;
    expect(text).toContain('reluctant');
    expect(text).toContain('unwilling');
    expect(text).toContain('B2');
  });
});

describe('buildFamiliarityKeyboard', () => {
  it('returns 4 buttons with correct callback data', () => {
    const kb = buildFamiliarityKeyboard(10, 5);
    const buttons = kb.inline_keyboard.map((row) => row[0]);
    expect(buttons).toHaveLength(4);
    expect(buttons[0].callback_data).toBe('fam:10:5:ns');
    expect(buttons[1].callback_data).toBe('fam:10:5:su');
    expect(buttons[2].callback_data).toBe('fam:10:5:uc');
    expect(buttons[3].callback_data).toBe('fam:10:5:skip');
  });

  it('has descriptive button labels', () => {
    const kb = buildFamiliarityKeyboard(10, 5);
    const labels = kb.inline_keyboard.map((row) => row[0].text);
    expect(labels[0]).toContain('Never seen');
    expect(labels[1]).toContain('Seen but unsure');
    expect(labels[2]).toContain('Understand in context');
    expect(labels[3]).toContain('Skip');
  });
});

describe('callback data size', () => {
  it('stays under 64 bytes for all callback types with large IDs', () => {
    // sel: callback
    const selData = `sel:99999:99999`;
    expect(Buffer.byteLength(selData, 'utf8')).toBeLessThan(64);

    // done: callback
    const doneData = `done:99999`;
    expect(Buffer.byteLength(doneData, 'utf8')).toBeLessThan(64);

    // fam: callback (longest variant)
    const famData = `fam:99999:99999:skip`;
    expect(Buffer.byteLength(famData, 'utf8')).toBeLessThan(64);
  });
});
