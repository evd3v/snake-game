import 'dotenv/config';
import { buildServer } from '../../src/server.ts';
import type { FastifyInstance } from 'fastify';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildServer({ logger: false });
  await app.ready();
  return app;
}

export async function cleanupTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}
