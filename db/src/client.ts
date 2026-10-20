import { readFileSync } from 'node:fs';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type DatabaseSslMode = 'off' | 'require' | 'verify';

export interface DatabaseConnectionOptions {
  databaseUrl: string;
  sslMode: DatabaseSslMode;
  caFile?: string | null;
}

export interface ResolveSslModeOptions {
  value: string | undefined;
  nodeEnv: string;
}

export function resolveDatabaseSslMode({ value, nodeEnv }: ResolveSslModeOptions): DatabaseSslMode {
  const mode = (value?.trim() || (nodeEnv === 'production' ? 'verify' : 'off')) as DatabaseSslMode;

  if (mode !== 'off' && mode !== 'require' && mode !== 'verify') {
    throw new Error('DATABASE_SSL must be one of: off, require, verify.');
  }

  if (nodeEnv === 'production' && mode === 'off') {
    throw new Error('DATABASE_SSL=off is not allowed when NODE_ENV=production.');
  }

  return mode;
}

export function normalizeDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('ssl');
  return url.toString();
}

export function resolveDatabaseSsl(
  sslMode: DatabaseSslMode,
  caFile?: string | null,
): false | { ca?: string; rejectUnauthorized: boolean } {
  if (sslMode === 'off') {
    return false;
  }

  if (sslMode === 'require') {
    return { rejectUnauthorized: false };
  }

  if (!caFile?.trim()) {
    throw new Error('DATABASE_SSL_CA_FILE is required when DATABASE_SSL=verify.');
  }

  return {
    ca: readFileSync(caFile, 'utf8'),
    rejectUnauthorized: true,
  };
}

export function createPool(options: DatabaseConnectionOptions): Pool {
  return new Pool({
    connectionString: normalizeDatabaseUrl(options.databaseUrl),
    ssl: resolveDatabaseSsl(options.sslMode, options.caFile),
  });
}

export function createDb(pool: Pool): NodePgDatabase<typeof schema> {
  return drizzle(pool, { schema });
}
