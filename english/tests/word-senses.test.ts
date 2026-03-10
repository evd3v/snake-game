import { describe, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

describe('Word senses - DATA-01: Multi-POS insertion', () => {
  it.todo('inserts the same lemma with two different POS values without constraint violation');
  it.todo('each sense has independent translation');
  it.todo('composite unique (word_id, part_of_speech) prevents duplicate senses');
});

describe('Word senses - DATA-02: Independent SRS per sense', () => {
  it.todo('creates separate SRS cards for different senses of the same word');
  it.todo('reviewing one sense card does not affect another sense card for the same word');
});
