import type { WordInfo, JobResult } from './services/api-client.ts';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatAnalysisResult(result: JobResult, words: WordInfo[]): string {
  const lines: string[] = [];

  lines.push('<b>Analysis complete</b>');
  lines.push('');

  if (words.length > 0) {
    lines.push('<b>Vocabulary:</b>');
    for (const word of words) {
      const lemma = escapeHtml(word.lemma);
      const translation = word.translation ? escapeHtml(word.translation) : '—';
      const cefr = word.cefrLevel ? ` [${escapeHtml(word.cefrLevel)}]` : '';
      lines.push(`  ${lemma} — ${translation}${cefr}`);
    }
    lines.push('');
  }

  const parts: string[] = [];
  if (result.wordsInserted > 0) parts.push(`${result.wordsInserted} words`);
  if (result.collocationsInserted > 0) parts.push(`${result.collocationsInserted} collocations`);
  if (result.grammarPatternsInserted > 0) parts.push(`${result.grammarPatternsInserted} grammar patterns`);

  if (parts.length > 0) {
    lines.push(`<i>${parts.join(', ')}</i>`);
  }

  return lines.join('\n');
}
