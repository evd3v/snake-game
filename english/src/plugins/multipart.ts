import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

export default fp(async function multipartPlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 1,
    },
  });
}, { name: 'multipart' });
