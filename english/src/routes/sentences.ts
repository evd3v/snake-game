import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { sentences } from '../db/schema/sentences.ts';
import { collocations, sentenceCollocations } from '../db/schema/collocations.ts';
import { grammarPatterns, sentenceGrammarPatterns } from '../db/schema/grammar-patterns.ts';

const sentencesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { text: string; sourceBook?: string } }>(
    '/sentences',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1 },
            sourceBook: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { text, sourceBook } = request.body;
      const job = await fastify.analysisQueue.add('sentence-analysis', {
        text,
        sourceBook,
      });
      return reply.status(202).send({ jobId: job.id });
    },
  );

  fastify.get<{ Params: { jobId: string } }>(
    '/sentences/:jobId/status',
    async (request, reply) => {
      const { jobId } = request.params;
      const job = await fastify.analysisQueue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      const state = await job.getState();

      if (state === 'completed') {
        return { status: 'completed', result: job.returnvalue };
      }

      if (state === 'failed') {
        return { status: 'failed', error: job.failedReason };
      }

      return { status: state };
    },
  );
  fastify.get<{ Params: { id: string } }>(
    '/sentences/:id/details',
    async (request, reply) => {
      const sentenceId = Number(request.params.id);

      const [sentence] = await fastify.db
        .select({
          text: sentences.text,
          translation: sentences.translation,
          cefrLevel: sentences.cefrLevel,
        })
        .from(sentences)
        .where(eq(sentences.id, sentenceId));

      if (!sentence) {
        return reply.status(404).send({ error: 'Sentence not found' });
      }

      const collocationRows = await fastify.db
        .select({
          text: collocations.text,
          translation: collocations.translation,
          type: collocations.type,
          cefrLevel: collocations.cefrLevel,
        })
        .from(sentenceCollocations)
        .innerJoin(collocations, eq(sentenceCollocations.collocationId, collocations.id))
        .where(eq(sentenceCollocations.sentenceId, sentenceId));

      const grammarRows = await fastify.db
        .select({
          pattern: grammarPatterns.pattern,
          description: grammarPatterns.description,
          cefrLevel: grammarPatterns.cefrLevel,
        })
        .from(sentenceGrammarPatterns)
        .innerJoin(grammarPatterns, eq(sentenceGrammarPatterns.grammarPatternId, grammarPatterns.id))
        .where(eq(sentenceGrammarPatterns.sentenceId, sentenceId));

      return {
        text: sentence.text,
        translation: sentence.translation,
        cefrLevel: sentence.cefrLevel,
        collocations: collocationRows,
        grammarPatterns: grammarRows,
      };
    },
  );
};

export default sentencesRoute;
