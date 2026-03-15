import { sql } from 'drizzle-orm';
import { normalizeLemma } from '../lib/lemmatizer.ts';
import type { Database } from '../db/index.ts';

export interface TokenHighlight {
  word: string;
  offset: number;
  length: number;
  status: 'new' | 'learning' | 'known' | null;
}

interface Token {
  word: string;
  offset: number;
  length: number;
  isWord: boolean;
}

const TOKEN_REGEX = /(\w+(?:'\w+)?)|([^\w]+)/g;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const isWord = match[1] !== undefined;
    tokens.push({
      word: match[0],
      offset: match.index,
      length: match[0].length,
      isWord,
    });
  }

  return tokens;
}

function cleanToken(token: string): string {
  return token.replace(/[^\w']/g, '').toLowerCase();
}

function getPossibleLemmas(word: string): string[] {
  const lower = word.toLowerCase();
  const lemmas = new Set<string>();
  lemmas.add(lower);

  for (const pos of ['noun', 'verb', 'adjective']) {
    try {
      const lemma = normalizeLemma(lower, pos);
      if (lemma) lemmas.add(lemma);
    } catch {
      // skip if lemmatization fails for this POS
    }
  }

  return Array.from(lemmas);
}

type LemmaStatus = 'new' | 'learning' | 'known';

export async function highlightSentences(
  db: Database,
  sentences: Array<{ id: number; text: string }>,
): Promise<Map<number, TokenHighlight[]>> {
  // 1. Tokenize all sentences, collect unique clean words
  const sentenceTokens = new Map<number, Token[]>();
  const allCleanWords = new Set<string>();

  for (const sentence of sentences) {
    const tokens = tokenize(sentence.text);
    sentenceTokens.set(sentence.id, tokens);

    for (const token of tokens) {
      if (token.isWord) {
        const clean = cleanToken(token.word);
        if (clean) allCleanWords.add(clean);
      }
    }
  }

  // 2. Generate all possible lemmas for all words
  const wordToLemmas = new Map<string, string[]>();
  const allLemmas = new Set<string>();

  for (const word of allCleanWords) {
    const lemmas = getPossibleLemmas(word);
    wordToLemmas.set(word, lemmas);
    for (const lemma of lemmas) {
      allLemmas.add(lemma);
    }
  }

  // 3. Batch query: one DB call for all lemmas
  const lemmaStatusMap = new Map<string, LemmaStatus>();

  if (allLemmas.size > 0) {
    const lemmaList = Array.from(allLemmas).map(l => `'${l.replace(/'/g, "''")}'`).join(',');

    const rows = await db.execute(sql.raw(`
      SELECT
        w.lemma,
        ws.familiarity,
        sc.state as srs_state
      FROM words w
      INNER JOIN word_senses ws ON ws.word_id = w.id
      LEFT JOIN srs_cards sc ON sc.word_sense_id = ws.id
      WHERE w.lemma IN (${lemmaList})
    `));

    // Build lemma status map with priority logic
    for (const row of rows.rows) {
      const lemma = row.lemma as string;
      const familiarity = row.familiarity as string | null;
      const srsState = row.srs_state as string | null;

      let status: LemmaStatus;

      // Active SRS card means "learning"
      if (srsState && ['new', 'learning', 'relearning'].includes(srsState)) {
        status = 'learning';
      } else if (familiarity === 'never_seen') {
        status = 'new';
      } else {
        status = 'known';
      }

      // Priority: learning > new > known
      const existing = lemmaStatusMap.get(lemma);
      if (!existing || statusPriority(status) > statusPriority(existing)) {
        lemmaStatusMap.set(lemma, status);
      }
    }
  }

  // 4. Map tokens back to highlights
  const result = new Map<number, TokenHighlight[]>();

  for (const sentence of sentences) {
    const tokens = sentenceTokens.get(sentence.id)!;
    const highlights: TokenHighlight[] = [];

    for (const token of tokens) {
      if (!token.isWord) continue;

      const clean = cleanToken(token.word);
      if (!clean) continue;

      const lemmas = wordToLemmas.get(clean) || [clean];
      let status: LemmaStatus | null = null;

      for (const lemma of lemmas) {
        const s = lemmaStatusMap.get(lemma);
        if (s !== undefined) {
          if (status === null || statusPriority(s) > statusPriority(status)) {
            status = s;
          }
        }
      }

      highlights.push({
        word: token.word,
        offset: token.offset,
        length: token.length,
        status,
      });
    }

    result.set(sentence.id, highlights);
  }

  return result;
}

function statusPriority(status: LemmaStatus): number {
  switch (status) {
    case 'learning': return 2;
    case 'new': return 1;
    case 'known': return 0;
  }
}
