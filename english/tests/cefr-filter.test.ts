import { describe, it, expect } from 'vitest';
import { shouldAutoAddWord, MIN_CEFR_FOR_AUTO_ADD } from '../src/services/cefr-filter.ts';

describe('shouldAutoAddWord', () => {
  it('filters out A1 words', () => {
    expect(shouldAutoAddWord('A1')).toBe(false);
  });

  it('filters out A2 words', () => {
    expect(shouldAutoAddWord('A2')).toBe(false);
  });

  it('includes B1 words', () => {
    expect(shouldAutoAddWord('B1')).toBe(true);
  });

  it('includes B2 words', () => {
    expect(shouldAutoAddWord('B2')).toBe(true);
  });

  it('includes C1 words', () => {
    expect(shouldAutoAddWord('C1')).toBe(true);
  });

  it('includes C2 words', () => {
    expect(shouldAutoAddWord('C2')).toBe(true);
  });

  it('includes words with null CEFR level (unknown = include)', () => {
    expect(shouldAutoAddWord(null)).toBe(true);
  });

  it('includes words with invalid CEFR level (unknown = include)', () => {
    expect(shouldAutoAddWord('invalid')).toBe(true);
  });

  it('exports MIN_CEFR_FOR_AUTO_ADD constant as B1', () => {
    expect(MIN_CEFR_FOR_AUTO_ADD).toBe('B1');
  });
});
