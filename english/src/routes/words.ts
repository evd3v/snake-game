import type { FastifyPluginAsync } from 'fastify';
import { eq, inArray, and } from 'drizzle-orm';
import { words, sentenceWords } from '../db/schema/words.ts';
import { srsCards } from '../db/schema/srs-cards.ts';

const wordsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { sentenceId: string } }>(
    '/sentences/:sentenceId/words',
    async (request) => {
      const sentenceId = Number(request.params.sentenceId);

      const rows = await fastify.db
        .select({
          id: words.id,
          lemma: words.lemma,
          translation: words.translation,
          cefrLevel: words.cefrLevel,
          familiarity: words.familiarity,
          thematicCluster: words.thematicCluster,
          position: sentenceWords.position,
        })
        .from(words)
        .innerJoin(sentenceWords, eq(words.id, sentenceWords.wordId))
        .where(eq(sentenceWords.sentenceId, sentenceId))
        .orderBy(sentenceWords.position);

      const wordIds = rows.map((r) => r.id);
      let srsWordIds = new Set<number>();

      if (wordIds.length > 0) {
        const srsRows = await fastify.db
          .select({ wordId: srsCards.wordId })
          .from(srsCards)
          .where(and(eq(srsCards.cardType, 'vocabulary'), inArray(srsCards.wordId, wordIds)));

        srsWordIds = new Set(srsRows.map((r) => r.wordId!).filter(Boolean));
      }

      return rows.map(({ position, ...word }) => ({
        ...word,
        hasSrsCard: srsWordIds.has(word.id),
      }));
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { familiarity: string } }>(
    '/words/:id/familiarity',
    {
      schema: {
        body: {
          type: 'object',
          required: ['familiarity'],
          properties: {
            familiarity: {
              type: 'string',
              enum: ['never_seen', 'seen_unsure', 'understand_in_context'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const { familiarity } = request.body;

      const [updated] = await fastify.db
        .update(words)
        .set({ familiarity: familiarity as typeof words.$inferInsert.familiarity })
        .where(eq(words.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Word not found' });
      }

      return updated;
    },
  );
};

export default wordsRoute;
