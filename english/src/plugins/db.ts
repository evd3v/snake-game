import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDb, type Database } from '../db/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export default fp(async function dbPlugin(fastify: FastifyInstance) {
  const db = createDb(process.env.DATABASE_URL!);

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    // drizzle node-postgres driver manages pool internally
    // no explicit close needed for drizzle(url, opts) form
  });
}, { name: 'db' });
