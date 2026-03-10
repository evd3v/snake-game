const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const MIN_CEFR_FOR_AUTO_ADD = 'B1';

/**
 * Determines whether a word should automatically get an SRS card
 * based on its CEFR level.
 *
 * Words at or above MIN_CEFR_FOR_AUTO_ADD (B1) are included.
 * Words with null or unrecognized CEFR levels are included (safe default).
 * Only A1 and A2 words are excluded.
 */
export function shouldAutoAddWord(cefrLevel: string | null): boolean {
  if (cefrLevel === null) return true;

  const index = CEFR_ORDER.indexOf(cefrLevel as (typeof CEFR_ORDER)[number]);
  if (index === -1) return true; // Unknown level — include by default

  const threshold = CEFR_ORDER.indexOf(MIN_CEFR_FOR_AUTO_ADD as (typeof CEFR_ORDER)[number]);
  return index >= threshold;
}
