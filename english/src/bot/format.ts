import type { WordInfo, SentenceDetails } from './services/api-client.ts';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatAnalysisResult(sentenceText: string, details: SentenceDetails, words: WordInfo[]): string {
  const lines: string[] = [];

  // Original sentence
  lines.push(`<b>${escapeHtml(sentenceText)}</b>`);
  lines.push('');

  // Translation
  if (details.translation) {
    lines.push(`\u{1F504} ${escapeHtml(details.translation)}`);
    lines.push('');
  }

  // Vocabulary section
  if (words.length > 0) {
    const newCount = words.filter((w) => !w.hasSrsCard).length;
    const knownCount = words.filter((w) => w.hasSrsCard).length;

    lines.push(`<b>\u{1F4DA} Vocabulary (${newCount} new, ${knownCount} known):</b>`);
    for (const word of words) {
      const marker = word.hasSrsCard ? '\u2705' : '\u{1F195}';
      const lemma = escapeHtml(word.lemma);
      const translation = word.translation ? escapeHtml(word.translation) : '\u2014';
      const cefr = word.cefrLevel ? ` [${escapeHtml(word.cefrLevel)}]` : '';
      lines.push(`  ${marker} ${lemma} \u2014 ${translation}${cefr}`);
    }
    lines.push('');
  }

  // Collocations section
  if (details.collocations.length > 0) {
    lines.push('<b>\u{1F517} Collocations:</b>');
    for (const col of details.collocations) {
      const text = escapeHtml(col.text);
      const translation = col.translation ? escapeHtml(col.translation) : '\u2014';
      const cefr = col.cefrLevel ? ` [${escapeHtml(col.cefrLevel)}]` : '';
      lines.push(`  ${text} \u2014 ${translation}${cefr}`);
    }
    lines.push('');
  }

  // Grammar section
  if (details.grammarPatterns.length > 0) {
    lines.push('<b>\u{1F4D6} Grammar:</b>');
    for (const gp of details.grammarPatterns) {
      const pattern = escapeHtml(gp.pattern);
      const description = gp.description ? escapeHtml(gp.description) : '';
      lines.push(`  \u2022 ${pattern}${description ? ` \u2014 ${description}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
