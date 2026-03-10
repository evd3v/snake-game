import type { FastifyPluginAsync } from 'fastify';
import { eq, lte, asc, and } from 'drizzle-orm';
import { srsCards } from '../db/schema/srs-cards.ts';
import { words, sentenceWords } from '../db/schema/words.ts';
import { wordSenses } from '../db/schema/word-senses.ts';
import { sentences } from '../db/schema/sentences.ts';
import { grammarPatterns, sentenceGrammarPatterns } from '../db/schema/grammar-patterns.ts';
import { grammarExercises } from '../db/schema/grammar-exercises.ts';
import { collocations, sentenceCollocations } from '../db/schema/collocations.ts';
import { getDueCards, rateCard, createSrsCard, Rating } from '../services/srs.ts';

const reviewRoute: FastifyPluginAsync = async (fastify) => {
  // GET /review/due - Fetch due cards with enriched data
  fastify.get<{ Querystring: { limit?: string } }>(
    '/review/due',
    async (request) => {
      const limit = request.query.limit ? Number(request.query.limit) : 20;
      const dueCards = await getDueCards(fastify.db, limit);

      const enriched = await Promise.all(
        dueCards.map(async (card) => {
          const base = {
            cardId: card.id,
            cardType: card.cardType,
            state: card.state,
            due: card.due,
          };

          if (card.cardType === 'vocabulary' && card.wordSenseId) {
            // Fetch word data via word_senses + first sentence context
            const wordRows = await fastify.db
              .select({
                lemma: words.lemma,
                translation: wordSenses.translation,
                cefrLevel: words.cefrLevel,
                partOfSpeech: wordSenses.partOfSpeech,
                sentenceText: sentences.text,
              })
              .from(wordSenses)
              .innerJoin(words, eq(wordSenses.wordId, words.id))
              .innerJoin(sentenceWords, eq(words.id, sentenceWords.wordId))
              .innerJoin(sentences, eq(sentenceWords.sentenceId, sentences.id))
              .where(eq(wordSenses.id, card.wordSenseId))
              .limit(1);

            const wordData = wordRows[0];
            return {
              ...base,
              word: wordData
                ? { lemma: wordData.lemma, translation: wordData.translation, cefrLevel: wordData.cefrLevel, partOfSpeech: wordData.partOfSpeech }
                : undefined,
              sentence: wordData?.sentenceText ?? undefined,
            };
          }

          if (card.cardType === 'grammar' && card.grammarPatternId) {
            // Fetch pattern data
            const [patternData] = await fastify.db
              .select({
                pattern: grammarPatterns.pattern,
                description: grammarPatterns.description,
              })
              .from(grammarPatterns)
              .where(eq(grammarPatterns.id, card.grammarPatternId))
              .limit(1);

            // Fetch one unused exercise, ordered by difficulty ascending (SRS-06)
            let [exercise] = await fastify.db
              .select({
                id: grammarExercises.id,
                sentence: grammarExercises.sentence,
                answer: grammarExercises.clozeAnswer,
                hint: grammarExercises.hint,
                difficultyLevel: grammarExercises.difficultyLevel,
              })
              .from(grammarExercises)
              .where(
                and(
                  eq(grammarExercises.grammarPatternId, card.grammarPatternId),
                  eq(grammarExercises.used, false),
                ),
              )
              .orderBy(asc(grammarExercises.difficultyLevel))
              .limit(1);

            // If all exercises used, reset them for another cycle
            if (!exercise) {
              await fastify.db
                .update(grammarExercises)
                .set({ used: false })
                .where(eq(grammarExercises.grammarPatternId, card.grammarPatternId));

              [exercise] = await fastify.db
                .select({
                  id: grammarExercises.id,
                  sentence: grammarExercises.sentence,
                  answer: grammarExercises.clozeAnswer,
                  hint: grammarExercises.hint,
                  difficultyLevel: grammarExercises.difficultyLevel,
                })
                .from(grammarExercises)
                .where(
                  and(
                    eq(grammarExercises.grammarPatternId, card.grammarPatternId),
                    eq(grammarExercises.used, false),
                  ),
                )
                .orderBy(asc(grammarExercises.difficultyLevel))
                .limit(1);
            }

            // Fetch example sentence from user's texts (CSRS-03)
            const [exampleRow] = await fastify.db
              .select({ text: sentences.text })
              .from(sentenceGrammarPatterns)
              .innerJoin(sentences, eq(sentenceGrammarPatterns.sentenceId, sentences.id))
              .where(eq(sentenceGrammarPatterns.grammarPatternId, card.grammarPatternId))
              .limit(1);

            return {
              ...base,
              pattern: patternData ?? undefined,
              exercise: exercise ?? undefined,
              exampleSentence: exampleRow?.text ?? undefined,
            };
          }

          if (card.cardType === 'collocation' && card.collocationId) {
            // Fetch collocation data
            const [collData] = await fastify.db
              .select({
                text: collocations.text,
                translation: collocations.translation,
                type: collocations.type,
                cefrLevel: collocations.cefrLevel,
              })
              .from(collocations)
              .where(eq(collocations.id, card.collocationId))
              .limit(1);

            // Fetch context sentence via sentenceCollocations
            const [sentenceRow] = await fastify.db
              .select({ text: sentences.text })
              .from(sentenceCollocations)
              .innerJoin(sentences, eq(sentenceCollocations.sentenceId, sentences.id))
              .where(eq(sentenceCollocations.collocationId, card.collocationId))
              .limit(1);

            return {
              ...base,
              collocation: collData ?? undefined,
              sentence: sentenceRow?.text ?? undefined,
            };
          }

          return base;
        }),
      );

      return enriched;
    },
  );

  // POST /review/:cardId/rate - Rate a card
  fastify.post<{ Params: { cardId: string }; Body: { rating: number; fetchedAt?: string } }>(
    '/review/:cardId/rate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'number', minimum: 1, maximum: 4 },
            fetchedAt: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const cardId = Number(request.params.cardId);
      const { rating, fetchedAt } = request.body;

      // Check card exists
      const [card] = await fastify.db
        .select()
        .from(srsCards)
        .where(eq(srsCards.id, cardId));

      if (!card) {
        return reply.status(404).send({ error: 'Card not found' });
      }

      // Staleness guard: reject if card was reviewed after fetchedAt
      if (fetchedAt && card.lastReview && card.lastReview > new Date(fetchedAt)) {
        return reply.status(409).send({ error: 'Card was already reviewed', lastReview: card.lastReview });
      }

      const scheduled = await rateCard(fastify.db, cardId, rating as Rating);

      // If grammar card, mark exercise as used (if an exercise was associated)
      if (card.cardType === 'grammar' && card.grammarPatternId) {
        const [exercise] = await fastify.db
          .select({ id: grammarExercises.id })
          .from(grammarExercises)
          .where(
            and(
              eq(grammarExercises.grammarPatternId, card.grammarPatternId),
              eq(grammarExercises.used, false),
            ),
          )
          .orderBy(asc(grammarExercises.difficultyLevel))
          .limit(1);

        if (exercise) {
          await fastify.db
            .update(grammarExercises)
            .set({ used: true })
            .where(eq(grammarExercises.id, exercise.id));
        }
      }

      return { success: true, nextDue: scheduled.card.due };
    },
  );

  // POST /word-senses/:wordSenseId/srs-card - Create SRS card for a vocabulary word sense
  fastify.post<{ Params: { wordSenseId: string } }>(
    '/word-senses/:wordSenseId/srs-card',
    async (request, reply) => {
      const wordSenseId = Number(request.params.wordSenseId);

      const card = await createSrsCard(fastify.db, 'vocabulary', { wordSenseId });

      if (!card) {
        // onConflictDoNothing returned nothing - card already exists, fetch it
        const [existing] = await fastify.db
          .select()
          .from(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              eq(srsCards.wordSenseId, wordSenseId),
            ),
          );

        return reply.status(201).send(existing);
      }

      return reply.status(201).send(card);
    },
  );
};

export default reviewRoute;
