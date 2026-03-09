import path from 'node:path';
import Fastify from 'fastify';
import autoload from '@fastify/autoload';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

export async function buildServer(opts?: { logger?: boolean }) {
  const app = Fastify({
    logger: opts?.logger ?? true,
  });

  await app.register(sensible);
  await app.register(cors);

  await app.register(autoload, {
    dir: path.join(import.meta.dirname, 'plugins'),
  });

  await app.register(autoload, {
    dir: path.join(import.meta.dirname, 'routes'),
  });

  return app;
}
