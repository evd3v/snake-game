import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedisUrl } from '../lib/redis.ts';

const redisUrl = new URL(getRedisUrl());

const worker = new Worker(
  'sentence-analysis',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);
    // Placeholder processor -- Phase 2 will add real analysis logic
    return { status: 'completed' };
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      maxRetriesPerRequest: null,
    },
  },
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
});

console.log('Worker started, waiting for jobs...');
