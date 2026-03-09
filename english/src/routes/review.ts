import type { FastifyPluginAsync } from 'fastify';
import { eq, lte, asc, and } from 'drizzle-orm';
import { srsCards } from '../db/schema/srs-cards.ts';
import { words, sentenceWords } from '../db/schema/words.ts';
import { sentences } from '../db/schema/sentences.ts';
import { grammarPatterns } from '../db/schema/grammar-patterns.ts';
import { grammarExercises } from '../db/schema/grammar-exercises.ts';
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

          if (card.cardType === 'vocabulary' && card.wordId) {
            // Fetch word data + first sentence context
            const wordRows = await fastify.db
              .select({
                lemma: words.lemma,
                translation: words.translation,
                cefrLevel: words.cefrLevel,
                sentenceText: sentences.text,
              })
              .from(words)
              .innerJoin(sentenceWords, eq(words.id, sentenceWords.wordId))
              .innerJoin(sentences, eq(sentenceWords.sentenceId, sentences.id))
              .where(eq(words.id, card.wordId))
              .limit(1);

            const wordData = wordRows[0];
            return {
              ...base,
              word: wordData
                ? { lemma: wordData.lemma, translation: wordData.translation, cefrLevel: wordData.cefrLevel }
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
            const [exercise] = await fastify.db
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

            return {
              ...base,
              pattern: patternData ?? undefined,
              exercise: exercise ?? undefined,
            };
          }

          return base;
        }),
      );

      return enriched;
    },
  );

  // POST /review/:cardId/rate - Rate a card
  fastify.post<{ Params: { cardId: string }; Body: { rating: number } }>(
    '/review/:cardId/rate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'number', minimum: 1, maximum: 4 },
          },
        },
      },
    },
    async (request, reply) => {
      const cardId = Number(request.params.cardId);
      const { rating } = request.body;

      // Check card exists
      const [card] = await fastify.db
        .select()
        .from(srsCards)
        .where(eq(srsCards.id, cardId));

      if (!card) {
        return reply.status(404).send({ error: 'Card not found' });
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

  // POST /words/:wordId/srs-card - Create SRS card for a vocabulary word
  fastify.post<{ Params: { wordId: string } }>(
    '/words/:wordId/srs-card',
    async (request, reply) => {
      const wordId = Number(request.params.wordId);

      const card = await createSrsCard(fastify.db, 'vocabulary', { wordId });

      if (!card) {
        // onConflictDoNothing returned nothing - card already exists, fetch it
        const [existing] = await fastify.db
          .select()
          .from(srsCards)
          .where(
            and(
              eq(srsCards.cardType, 'vocabulary'),
              eq(srsCards.wordId, wordId),
            ),
          );

        return reply.status(201).send(existing);
      }

      return reply.status(201).send(card);
    },
  );
};

export default reviewRoute;
