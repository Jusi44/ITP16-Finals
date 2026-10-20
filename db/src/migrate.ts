import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import {
  normalizeDatabaseUrl,
  resolveDatabaseSsl,
  type DatabaseConnectionOptions,
} from './client.js';
import { getDatabaseConnectionOptions } from './env.js';

export const MIGRATION_ADVISORY_LOCK_KEY = 2026102001;

export function getMigrationsFolder(): string {
  return fileURLToPath(new URL('../migrations', import.meta.url));
}

export function countMigrations(migrationsFolder = getMigrationsFolder()): number {
  const journalPath = resolve(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries?: unknown[];
  };

  return journal.entries?.length ?? 0;
}

export async function runMigrations(
  options: DatabaseConnectionOptions & {
    migrationsFolder?: string;
  } = getDatabaseConnectionOptions(),
): Promise<void> {
  const client = new Client({
    connectionString: normalizeDatabaseUrl(options.databaseUrl),
    ssl: resolveDatabaseSsl(options.sslMode, options.caFile),
  });

  await client.connect();

  let locked = false;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
    locked = true;

    await migrate(drizzle(client), {
      migrationsFolder: options.migrationsFolder ?? getMigrationsFolder(),
    });
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
      } catch {
        // Closing the session releases the lock if the connection is already gone.
      }
    }

    await client.end();
  }
}

async function main(): Promise<void> {
  await runMigrations();
  console.log('Migrations complete.');
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';
if (entrypoint === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
