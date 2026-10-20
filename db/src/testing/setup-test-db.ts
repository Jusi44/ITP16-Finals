import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setupTestDatabase } from './test-db.js';

async function main(): Promise<void> {
  const databaseUrl = await setupTestDatabase();
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  console.log(`Test database ready: ${databaseName}`);
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';
if (entrypoint === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
