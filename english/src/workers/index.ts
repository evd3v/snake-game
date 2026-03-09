import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedisUrl } from '../lib/redis.ts';
import { analyzeSentence } from '../lib/ai/analyze-sentence.ts';
import { storeAnalysisResults } from '../services/analysis.ts';
import { createDb } from '../db/index.ts';

const redisUrl = new URL(getRedisUrl());
const db = createDb(process.env.DATABASE_URL!);

const worker = new Worker(
  'sentence-analysis',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);
    const { text, sourceBook } = job.data as {
      text: string;
      sourceBook?: string;
    };
    const analysis = await analyzeSentence(text);
    const result = await storeAnalysisResults(db, text, sourceBook, analysis);
    return result;
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      maxRetriesPerRequest: null,
    },
    concurrency: 2,
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
