// Requires: docker compose up -d postgres redis
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanupTestApp } from './helpers/setup.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await cleanupTestApp(app);
});

describe('POST /sentences', () => {
  it('returns 202 with jobId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sentences',
      payload: { text: 'The cat sat on the mat.' },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body).toHaveProperty('jobId');
    expect(body.jobId).toBeTruthy();
  });

  it('returns 202 with sourceBook', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sentences',
      payload: { text: 'Hello world.', sourceBook: 'Test Book' },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body).toHaveProperty('jobId');
  });

  it('rejects empty text with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sentences',
      payload: { text: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects missing text with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sentences',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /sentences/:jobId/status', () => {
  it('returns status for enqueued job', async () => {
    // First enqueue a job
    const postResponse = await app.inject({
      method: 'POST',
      url: '/sentences',
      payload: { text: 'Testing status polling.' },
    });
    const { jobId } = postResponse.json();

    // Then check its status
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/sentences/${jobId}/status`,
    });

    expect(statusResponse.statusCode).toBe(200);
    const body = statusResponse.json();
    expect(body).toHaveProperty('status');
    // Worker is not running in tests, so job stays in 'waiting' state
    expect(body.status).toBe('waiting');
  });

  it('returns 404 for nonexistent job', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/sentences/nonexistent-job-id/status',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toBe('Job not found');
  });
});
