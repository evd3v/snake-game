import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.ts';

export function createDb(databaseUrl: string) {
  return drizzle(databaseUrl, { schema });
}

export type Database = ReturnType<typeof createDb>;
