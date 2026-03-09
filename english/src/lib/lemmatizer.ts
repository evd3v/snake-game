import lemmatizer from 'wink-lemmatizer';

const posMap: Record<string, (word: string) => string> = {
  noun: lemmatizer.noun,
  verb: lemmatizer.verb,
  adjective: lemmatizer.adjective,
  adverb: lemmatizer.adjective, // adverbs often share adjective root
};

function lemmatizeAdverb(word: string): string {
  // Strip -ly suffix to get adjective root, then lemmatize as adjective
  if (word.endsWith('ly')) {
    const stem = word.slice(0, -2);

    // Handle -ily -> -y (e.g., happily -> happy)
    if (stem.endsWith('i')) {
      const adjForm = stem.slice(0, -1) + 'y';
      return lemmatizer.adjective(adjForm);
    }

    // Handle -lly -> -l (e.g., fully -> full)
    // Standard -ly removal (e.g., quickly -> quick)
    const adjResult = lemmatizer.adjective(stem);
    return adjResult;
  }

  // Adverbs without -ly suffix (e.g., "fast", "well")
  return lemmatizer.adjective(word);
}

export function normalizeLemma(word: string, partOfSpeech: string): string {
  const lowered = word.toLowerCase();

  if (partOfSpeech === 'adverb') {
    return lemmatizeAdverb(lowered);
  }

  const fn = posMap[partOfSpeech];

  if (fn) {
    return fn(lowered);
  }

  return lowered;
}
