import { Queue } from 'bullmq';
import { createEmptyCard } from 'ts-fsrs';
import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/index.ts';
import {
  sentences,
  words,
  wordSenses,
  sentenceWords,
  collocations,
  sentenceCollocations,
  grammarPatterns,
  sentenceGrammarPatterns,
  srsCards,
} from '../db/schema/index.ts';
import { normalizeLemma } from '../lib/lemmatizer.ts';
import type { SentenceAnalysis } from '../lib/ai/schemas.ts';
import { linkWordFamilies } from './word-family.ts';
import { shouldAutoAddWord } from './cefr-filter.ts';
import { getRedisUrl } from '../lib/redis.ts';

/**
 * Check if a sentence is a service/boilerplate page (copyright, ToC, dedications, etc.)
 * These should not be analyzed for language learning.
 */
export function isServiceSentence(text: string): boolean {
  const normalized = text.toLowerCase().trim();

  // Too short to be meaningful (titles, headings, fragments)
  if (normalized.split(/\s+/).length < 4) return true;

  // Copyright / legal boilerplate
  if (/copyright|©|all rights reserved|permission.*publisher|isbn|library of congress/i.test(text)) return true;

  // Table of contents / navigation
  if (/^(begin reading|table of contents|newsletters|copyright page|acknowledgments|about the author|also by)/i.test(normalized)) return true;

  // Dedications (short ALL CAPS lines)
  if (text === text.toUpperCase() && text.length < 100) return true;

  // Epigraph attributions
  if (/^—[A-Z]/.test(text.trim())) return true;

  return false;
}

/**
 * Filter vocabulary: remove single-word collocations and collocations
 * that are too basic or aren't real fixed expressions.
 */
function filterCollocations(colls: SentenceAnalysis['collocations']): SentenceAnalysis['collocations'] {
  return colls.filter(c => {
    const wordCount = c.text.trim().split(/\s+/).length;
    // Must have at least 2 words
    if (wordCount < 2) return false;
    return true;
  });
}

let exerciseQueue: Queue | null = null;

function getExerciseQueue(): Queue {
  if (!exerciseQueue) {
    const redisUrl = new URL(getRedisUrl());
    exerciseQueue = new Queue('sentence-analysis', {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        maxRetriesPerRequest: null,
      },
    });
  }
  return exerciseQueue;
}

interface StoreOptions {
  autoCreateSrsCards?: boolean;
}

export async function storeAnalysisResults(
  db: Database,
  text: string,
  sourceBook: string | undefined,
  analysis: SentenceAnalysis,
  options: StoreOptions = {},
): Promise<{
  sentenceId: number;
  wordsInserted: number;
  collocationsInserted: number;
  grammarPatternsInserted: number;
}> {
  const { autoCreateSrsCards = true } = options;

  // Filter collocations at code level (safety net for AI)
  const filteredCollocations = filterCollocations(analysis.collocations);

  // a. Deduplicate: check if this sentence already exists
  const [existingSentence] = await db
    .select({ id: sentences.id })
    .from(sentences)
    .where(eq(sentences.text, text))
    .limit(1);

  let sentenceId: number;

  if (existingSentence) {
    sentenceId = existingSentence.id;
    // Update translation if needed
    await db
      .update(sentences)
      .set({
        translation: analysis.translation,
        cefrLevel: analysis.cefrLevel,
      })
      .where(eq(sentences.id, sentenceId));
  } else {
    const [insertedSentence] = await db
      .insert(sentences)
      .values({
        text,
        translation: analysis.translation,
        cefrLevel: analysis.cefrLevel,
        sourceBook: sourceBook ?? null,
      })
      .returning({ id: sentences.id });
    sentenceId = insertedSentence.id;
  }

  // b. Upsert words
  const insertedWordsMap = new Map<string, number>();
  let wordsInserted = 0;

  for (let i = 0; i < analysis.vocabulary.length; i++) {
    const vocab = analysis.vocabulary[i];
    const normalizedLemma = normalizeLemma(vocab.lemma, vocab.partOfSpeech);

    // Step 1: Upsert word (lemma-level, no translation/familiarity)
    const [upsertedWord] = await db
      .insert(words)
      .values({
        lemma: normalizedLemma,
        cefrLevel: vocab.cefrLevel,
        thematicCluster: vocab.thematicCluster,
      })
      .onConflictDoUpdate({
        target: words.lemma,
        set: {
          thematicCluster: vocab.thematicCluster,
        },
      })
      .returning({ id: words.id });

    // Step 2: Upsert word sense (POS-level, with translation)
    const [upsertedSense] = await db
      .insert(wordSenses)
      .values({
        wordId: upsertedWord.id,
        partOfSpeech: vocab.partOfSpeech,
        translation: vocab.translation,
        definition: vocab.definition,
      })
      .onConflictDoUpdate({
        target: [wordSenses.wordId, wordSenses.partOfSpeech],
        set: { translation: vocab.translation, definition: vocab.definition },
      })
      .returning({ id: wordSenses.id });

    // Step 3: Auto-create vocabulary SRS card for CEFR >= B1 (idempotent)
    if (autoCreateSrsCards && shouldAutoAddWord(vocab.cefrLevel)) {
      const [existingVocabCard] = await db
        .select({ id: srsCards.id })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'vocabulary'),
            eq(srsCards.wordSenseId, upsertedSense.id),
          ),
        )
        .limit(1);

      if (!existingVocabCard) {
        const emptyCard = createEmptyCard();
        await db.insert(srsCards).values({
          cardType: 'vocabulary',
          wordSenseId: upsertedSense.id,
          state: 'new',
          due: emptyCard.due,
          stability: emptyCard.stability,
          difficulty: emptyCard.difficulty,
          elapsedDays: emptyCard.elapsed_days,
          scheduledDays: emptyCard.scheduled_days,
          reps: emptyCard.reps,
          lapses: emptyCard.lapses,
        });
      }
    }

    insertedWordsMap.set(normalizedLemma, upsertedWord.id);
    wordsInserted++;

    // c. Link sentence-words
    await db
      .insert(sentenceWords)
      .values({
        sentenceId,
        wordId: upsertedWord.id,
        position: i,
      })
      .onConflictDoNothing();
  }

  // d. Upsert collocations
  let collocationsInserted = 0;

  for (const coll of filteredCollocations) {
    const [upsertedCollocation] = await db
      .insert(collocations)
      .values({
        text: coll.text,
        translation: coll.translation,
        type: coll.type,
        cefrLevel: coll.cefrLevel,
      })
      .onConflictDoUpdate({
        target: collocations.text,
        set: {
          translation: coll.translation,
        },
      })
      .returning({ id: collocations.id });

    collocationsInserted++;

    await db
      .insert(sentenceCollocations)
      .values({
        sentenceId,
        collocationId: upsertedCollocation.id,
      })
      .onConflictDoNothing();

    // Auto-create SRS card for collocation (idempotent - check first)
    if (autoCreateSrsCards) {
      const [existingCollocationCard] = await db
        .select({ id: srsCards.id })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'collocation'),
            eq(srsCards.collocationId, upsertedCollocation.id),
          ),
        )
        .limit(1);

      if (!existingCollocationCard) {
        const emptyCard = createEmptyCard();
        await db.insert(srsCards).values({
          cardType: 'collocation',
          collocationId: upsertedCollocation.id,
          state: 'new',
          due: emptyCard.due,
          stability: emptyCard.stability,
          difficulty: emptyCard.difficulty,
          elapsedDays: emptyCard.elapsed_days,
          scheduledDays: emptyCard.scheduled_days,
          reps: emptyCard.reps,
          lapses: emptyCard.lapses,
        });
      }
    }
  }

  // e. Upsert grammar patterns
  let grammarPatternsInserted = 0;

  for (const gp of analysis.grammarPatterns) {
    const [upsertedPattern] = await db
      .insert(grammarPatterns)
      .values({
        pattern: gp.pattern,
        description: gp.description,
        cefrLevel: gp.cefrLevel,
      })
      .onConflictDoUpdate({
        target: grammarPatterns.pattern,
        set: {
          description: gp.description,
        },
      })
      .returning({ id: grammarPatterns.id });

    grammarPatternsInserted++;

    await db
      .insert(sentenceGrammarPatterns)
      .values({
        sentenceId,
        grammarPatternId: upsertedPattern.id,
      })
      .onConflictDoNothing();

    // Auto-create SRS card for grammar pattern (idempotent - check first)
    let newSrsCard = null;
    if (autoCreateSrsCards) {
      const [existingCard] = await db
        .select({ id: srsCards.id })
        .from(srsCards)
        .where(
          and(
            eq(srsCards.cardType, 'grammar'),
            eq(srsCards.grammarPatternId, upsertedPattern.id),
          ),
        )
        .limit(1);

      if (!existingCard) {
        const emptyCard = createEmptyCard();
        const [inserted] = await db
          .insert(srsCards)
          .values({
            cardType: 'grammar',
            grammarPatternId: upsertedPattern.id,
            state: 'new',
            due: emptyCard.due,
            stability: emptyCard.stability,
            difficulty: emptyCard.difficulty,
            elapsedDays: emptyCard.elapsed_days,
            scheduledDays: emptyCard.scheduled_days,
            reps: emptyCard.reps,
            lapses: emptyCard.lapses,
          })
          .returning();
        newSrsCard = inserted;
      }
    }

    // Queue exercise generation only for newly created SRS cards
    if (newSrsCard) {
      try {
        const queue = getExerciseQueue();
        await queue.add('generate-exercises', {
          grammarPatternId: upsertedPattern.id,
          pattern: gp.pattern,
          description: gp.description,
          count: 6,
        });
      } catch (err) {
        console.error('Failed to queue exercise generation:', err);
      }
    }
  }

  // f. Link word families
  await linkWordFamilies(db, analysis.wordFamilies, insertedWordsMap);

  // g. Return summary
  return {
    sentenceId,
    wordsInserted,
    collocationsInserted,
    grammarPatternsInserted,
  };
}
