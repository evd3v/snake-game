import { sql } from 'drizzle-orm';
import type { Database } from '../db/index.ts';

export interface ReaderAnalysisResult {
  translation: string | null;
  cefrLevel: string | null;
  newWords: Array<{
    senseId: number;
    lemma: string;
    partOfSpeech: string;
    translation: string | null;
    definition: string | null;
    cefrLevel: string | null;
  }>;
  newCollocations: Array<{
    collocationId: number;
    text: string;
    translation: string | null;
    type: string;
    cefrLevel: string | null;
  }>;
  newGrammarPatterns: Array<{
    grammarPatternId: number;
    pattern: string;
    description: string | null;
    cefrLevel: string | null;
  }>;
  existingWordsCount: number;
  existingCollocationsCount: number;
  existingGrammarPatternsCount: number;
}

export async function getFilteredAnalysis(
  db: Database,
  sentenceId: number,
): Promise<ReaderAnalysisResult> {
  // Get sentence translation and CEFR level
  const sentenceResult = await db.execute(sql.raw(`
    SELECT translation, cefr_level
    FROM sentences
    WHERE id = ${sentenceId}
    LIMIT 1
  `));
  const sentenceRow = sentenceResult.rows[0];

  // Get all words linked to this sentence with their familiarity and SRS status
  const wordsResult = await db.execute(sql.raw(`
    SELECT
      ws.id AS sense_id,
      w.lemma,
      ws.part_of_speech,
      ws.translation,
      ws.definition,
      w.cefr_level,
      ws.familiarity,
      sc.id AS srs_card_id
    FROM sentence_words sw
    INNER JOIN words w ON w.id = sw.word_id
    INNER JOIN word_senses ws ON ws.word_id = w.id
    LEFT JOIN srs_cards sc ON sc.word_sense_id = ws.id AND sc.card_type = 'vocabulary'
    WHERE sw.sentence_id = ${sentenceId}
  `));

  const newWords: ReaderAnalysisResult['newWords'] = [];
  let existingWordsCount = 0;

  for (const row of wordsResult.rows) {
    const isNew = row.familiarity === 'never_seen' && row.srs_card_id === null;
    if (isNew) {
      newWords.push({
        senseId: row.sense_id as number,
        lemma: row.lemma as string,
        partOfSpeech: row.part_of_speech as string,
        translation: row.translation as string | null,
        definition: row.definition as string | null,
        cefrLevel: row.cefr_level as string | null,
      });
    } else {
      existingWordsCount++;
    }
  }

  // Get all collocations linked to this sentence with SRS status
  const collocationsResult = await db.execute(sql.raw(`
    SELECT
      c.id AS collocation_id,
      c.text,
      c.translation,
      c.type,
      c.cefr_level,
      sc.id AS srs_card_id
    FROM sentence_collocations sco
    INNER JOIN collocations c ON c.id = sco.collocation_id
    LEFT JOIN srs_cards sc ON sc.collocation_id = c.id AND sc.card_type = 'collocation'
    WHERE sco.sentence_id = ${sentenceId}
  `));

  const newCollocations: ReaderAnalysisResult['newCollocations'] = [];
  let existingCollocationsCount = 0;

  for (const row of collocationsResult.rows) {
    if (row.srs_card_id === null) {
      newCollocations.push({
        collocationId: row.collocation_id as number,
        text: row.text as string,
        translation: row.translation as string | null,
        type: row.type as string,
        cefrLevel: row.cefr_level as string | null,
      });
    } else {
      existingCollocationsCount++;
    }
  }

  // Get all grammar patterns linked to this sentence with SRS status
  const grammarResult = await db.execute(sql.raw(`
    SELECT
      gp.id AS grammar_pattern_id,
      gp.pattern,
      gp.description,
      gp.cefr_level,
      sc.id AS srs_card_id
    FROM sentence_grammar_patterns sgp
    INNER JOIN grammar_patterns gp ON gp.id = sgp.grammar_pattern_id
    LEFT JOIN srs_cards sc ON sc.grammar_pattern_id = gp.id AND sc.card_type = 'grammar'
    WHERE sgp.sentence_id = ${sentenceId}
  `));

  const newGrammarPatterns: ReaderAnalysisResult['newGrammarPatterns'] = [];
  let existingGrammarPatternsCount = 0;

  for (const row of grammarResult.rows) {
    if (row.srs_card_id === null) {
      newGrammarPatterns.push({
        grammarPatternId: row.grammar_pattern_id as number,
        pattern: row.pattern as string,
        description: row.description as string | null,
        cefrLevel: row.cefr_level as string | null,
      });
    } else {
      existingGrammarPatternsCount++;
    }
  }

  return {
    translation: (sentenceRow?.translation as string | null) ?? null,
    cefrLevel: (sentenceRow?.cefr_level as string | null) ?? null,
    newWords,
    newCollocations,
    newGrammarPatterns,
    existingWordsCount,
    existingCollocationsCount,
    existingGrammarPatternsCount,
  };
}
