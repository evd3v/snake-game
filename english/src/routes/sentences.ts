import type { FastifyPluginAsync } from 'fastify';

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
      const job = await fastify.analysisQueue.add('analyze', {
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
};

export default sentencesRoute;
