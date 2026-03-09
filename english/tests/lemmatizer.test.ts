import { describe, it, expect } from 'vitest';
import { normalizeLemma } from '../src/lib/lemmatizer.ts';

describe('normalizeLemma', () => {
  it('lemmatizes verbs to base form', () => {
    expect(normalizeLemma('running', 'verb')).toBe('run');
  });

  it('lemmatizes irregular noun plurals', () => {
    expect(normalizeLemma('knives', 'noun')).toBe('knife');
  });

  it('lemmatizes irregular adjective comparatives', () => {
    expect(normalizeLemma('better', 'adjective')).toBe('good');
  });

  it('lemmatizes adverbs using adjective root', () => {
    expect(normalizeLemma('quickly', 'adverb')).toBe('quick');
  });

  it('returns prepositions unchanged (lowercased)', () => {
    expect(normalizeLemma('into', 'preposition')).toBe('into');
  });

  it('lowercases input before lemmatizing', () => {
    expect(normalizeLemma('Running', 'verb')).toBe('run');
  });

  it('handles irregular past participles', () => {
    expect(normalizeLemma('eaten', 'verb')).toBe('eat');
  });

  it('returns conjunctions unchanged (lowercased)', () => {
    expect(normalizeLemma('Although', 'conjunction')).toBe('although');
  });

  it('handles regular noun plurals', () => {
    expect(normalizeLemma('dogs', 'noun')).toBe('dog');
  });
});
