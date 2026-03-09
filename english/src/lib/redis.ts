import IORedis from 'ioredis';

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

/**
 * Create a raw IORedis connection (for non-BullMQ use cases).
 * For BullMQ Queue/Worker, use getRedisUrl() and pass as connection string.
 */
export function createRedisConnection(url?: string): IORedis {
  return new IORedis(url ?? getRedisUrl(), {
    maxRetriesPerRequest: null,
  });
}

let _connection: IORedis | null = null;

export function getRedisConnection(url?: string): IORedis {
  if (!_connection) {
    _connection = createRedisConnection(url);
  }
  return _connection;
}
