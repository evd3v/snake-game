import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { getRedisUrl } from '../lib/redis.ts';

declare module 'fastify' {
  interface FastifyInstance {
    analysisQueue: Queue;
  }
}

export default fp(async function queuePlugin(fastify: FastifyInstance) {
  const redisUrl = new URL(getRedisUrl());

  const analysisQueue = new Queue('sentence-analysis', {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      maxRetriesPerRequest: null,
    },
  });

  fastify.decorate('analysisQueue', analysisQueue);

  fastify.addHook('onClose', async () => {
    await analysisQueue.close();
  });
}, { name: 'queue' });
