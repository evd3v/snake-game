import 'dotenv/config';
import { buildServer } from './server.ts';

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
