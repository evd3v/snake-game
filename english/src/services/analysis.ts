import { Queue } from 'bullmq';
import { createEmptyCard } from 'ts-fsrs';
import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/index.ts';
import {
  sentences,
  words,
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
import { getRedisUrl } from '../lib/redis.ts';

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

export async function storeAnalysisResults(
  db: Database,
  text: string,
  sourceBook: string | undefined,
  analysis: SentenceAnalysis,
): Promise<{
  sentenceId: number;
  wordsInserted: number;
  collocationsInserted: number;
  grammarPatternsInserted: number;
}> {
  // a. Insert sentence
  const [insertedSentence] = await db
    .insert(sentences)
    .values({
      text,
      translation: analysis.translation,
      cefrLevel: analysis.cefrLevel,
      sourceBook: sourceBook ?? null,
    })
    .returning({ id: sentences.id });

  const sentenceId = insertedSentence.id;

  // b. Upsert words
  const insertedWordsMap = new Map<string, number>();
  let wordsInserted = 0;

  for (let i = 0; i < analysis.vocabulary.length; i++) {
    const vocab = analysis.vocabulary[i];
    const normalizedLemma = normalizeLemma(vocab.lemma, vocab.partOfSpeech);

    const [upsertedWord] = await db
      .insert(words)
      .values({
        lemma: normalizedLemma,
        translation: vocab.translation,
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

  for (const coll of analysis.collocations) {
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

    let newSrsCard = null;
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
