import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { words, sentenceWords } from '../db/schema/words.ts';

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

      return rows.map(({ position, ...word }) => word);
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
