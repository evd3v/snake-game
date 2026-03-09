// Requires: Redis running on REDIS_URL
import 'dotenv/config';
import { describe, it, expect, afterAll } from 'vitest';
import { Queue, Worker } from 'bullmq';

function getRedisConfig() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    maxRetriesPerRequest: null,
  };
}

const TEST_QUEUE_NAME = 'test-queue-' + Date.now();

let queue: Queue;
let worker: Worker;

afterAll(async () => {
  if (worker) await worker.close();
  if (queue) {
    await queue.obliterate({ force: true });
    await queue.close();
  }
});

describe('BullMQ queue integration', () => {
  it('can enqueue and process a job', async () => {
    const redisConfig = getRedisConfig();

    queue = new Queue(TEST_QUEUE_NAME, { connection: redisConfig });

    const jobResult = await new Promise<{ processed: boolean; data: unknown }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Job processing timed out after 5 seconds'));
        }, 5_000);

        worker = new Worker(
          TEST_QUEUE_NAME,
          async (job) => {
            return { processed: true, input: job.data };
          },
          { connection: { ...redisConfig } },
        );

        worker.on('completed', (job, result) => {
          clearTimeout(timeout);
          resolve({ processed: true, data: result });
        });

        worker.on('failed', (job, err) => {
          clearTimeout(timeout);
          reject(err);
        });

        // Add a job after worker is set up
        queue.add('test-job', { sentence: 'Hello world', lang: 'en' });
      },
    );

    expect(jobResult.processed).toBe(true);
    expect(jobResult.data).toEqual({
      processed: true,
      input: { sentence: 'Hello world', lang: 'en' },
    });
  });
});
