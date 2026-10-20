import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { createDb, normalizeDatabaseUrl, resolveDatabaseSsl } from '../client.js';
import { getDatabaseConnectionOptions, getDatabaseSslMode, getTestDatabaseUrl } from '../env.js';
import { runMigrations } from '../migrate.js';
import * as schema from '../schema.js';
import { assertTestDatabase } from './guard.js';

let testPool: Pool | undefined;
let testDb: NodePgDatabase<typeof schema> | undefined;

function assertTestName(databaseName: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName) || !databaseName.endsWith('_test')) {
    throw new Error('Test database names must match [A-Za-z_][A-Za-z0-9_]* and end in _test.');
  }

  return databaseName;
}

function replaceDatabaseName(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function openMaintenanceClient(databaseUrl: string): Promise<Client> {
  const maintenanceUrl = replaceDatabaseName(databaseUrl, 'postgres');
  const connection = getDatabaseConnectionOptions();
  const client = new Client({
    connectionString: normalizeDatabaseUrl(maintenanceUrl),
    ssl: resolveDatabaseSsl(getDatabaseSslMode(), connection.caFile),
  });
  await client.connect();
  return client;
}

export function getTestUrl(): string {
  const databaseUrl = getTestDatabaseUrl();
  assertTestDatabase(databaseUrl);
  return databaseUrl;
}

export async function ensureTestDatabase(databaseUrl: string): Promise<string> {
  const databaseName = assertTestDatabase(databaseUrl);
  assertTestName(databaseName);

  const client = await openMaintenanceClient(databaseUrl);
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }

  return databaseUrl;
}

export async function setupTestDatabase(): Promise<string> {
  const nodeEnv = process.env.NODE_ENV;
  const databaseUrl = getTestUrl();
  assertTestDatabase(databaseUrl, nodeEnv);
  await ensureTestDatabase(databaseUrl);

  const connection = getDatabaseConnectionOptions();
  await runMigrations({
    databaseUrl,
    sslMode: getDatabaseSslMode(),
    caFile: connection.caFile,
  });

  return databaseUrl;
}

export function getTestPool(): Pool {
  if (!testPool) {
    const databaseUrl = getTestUrl();
    testPool = new Pool({
      connectionString: normalizeDatabaseUrl(databaseUrl),
      ssl: resolveDatabaseSsl(getDatabaseSslMode(), getDatabaseConnectionOptions().caFile),
      max: 5,
    });
  }

  return testPool;
}

export function getTestDb(): NodePgDatabase<typeof schema> {
  if (!testDb) {
    testDb = createDb(getTestPool());
  }

  return testDb;
}

export async function endTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = undefined;
    testDb = undefined;
  }
}

export async function truncateAll(db: NodePgDatabase<typeof schema>): Promise<void> {
  assertTestDatabase(getTestUrl());
  await db.execute(
    sql`TRUNCATE TABLE sessions, stock_records, sales, food_items, users RESTART IDENTITY CASCADE`,
  );
}

export async function createFreshTestDatabase(databaseName: string): Promise<string> {
  assertTestName(databaseName);

  const baseUrl = getTestUrl();
  assertTestDatabase(baseUrl);
  const freshUrl = replaceDatabaseName(baseUrl, databaseName);
  assertTestDatabase(freshUrl);

  const client = await openMaintenanceClient(freshUrl);
  try {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }

  return freshUrl;
}

export async function runTestMigrations(databaseUrl: string): Promise<void> {
  assertTestDatabase(databaseUrl);
  const connection = getDatabaseConnectionOptions();
  await runMigrations({
    databaseUrl,
    sslMode: getDatabaseSslMode(),
    caFile: connection.caFile,
  });
}

export async function openTestClient(databaseUrl: string): Promise<Client> {
  assertTestDatabase(databaseUrl);

  const connection = getDatabaseConnectionOptions();
  const client = new Client({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    ssl: resolveDatabaseSsl(getDatabaseSslMode(), connection.caFile),
  });
  await client.connect();
  return client;
}
