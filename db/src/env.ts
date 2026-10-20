import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  resolveDatabaseSslMode,
  type DatabaseConnectionOptions,
  type DatabaseSslMode,
} from './client.js';
import { validatePassword } from './validation.js';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

export type NodeEnv = 'development' | 'test' | 'production';

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'production' || value === 'test') {
    return value;
  }
  return 'development';
}

export function getNodeEnv(env: NodeJS.ProcessEnv = process.env): NodeEnv {
  return parseNodeEnv(env.NODE_ENV);
}

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  return databaseUrl;
}

export function getDatabaseSslMode(env: NodeJS.ProcessEnv = process.env): DatabaseSslMode {
  return resolveDatabaseSslMode({
    value: env.DATABASE_SSL,
    nodeEnv: getNodeEnv(env),
  });
}

export function getDatabaseConnectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConnectionOptions {
  return {
    databaseUrl: getDatabaseUrl(env),
    sslMode: getDatabaseSslMode(env),
    caFile: env.DATABASE_SSL_CA_FILE,
  };
}

export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.TEST_DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const url = new URL(getDatabaseUrl(env));
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!databaseName.endsWith('_test')) {
    url.pathname = `/${databaseName}_test`;
  }

  return url.toString();
}

export interface SeedPasswords {
  adminPassword: string;
  staffPassword: string;
}

export function getSeedPasswords(env: NodeJS.ProcessEnv = process.env): SeedPasswords {
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  const staffPassword = env.SEED_STAFF_PASSWORD;
  const missing: string[] = [];

  if (!adminPassword) {
    missing.push('SEED_ADMIN_PASSWORD');
  }
  if (!staffPassword) {
    missing.push('SEED_STAFF_PASSWORD');
  }

  if (!adminPassword || !staffPassword) {
    throw new Error(`Missing required seed secret(s): ${missing.join(', ')}.`);
  }

  validatePassword(adminPassword);
  validatePassword(staffPassword);

  return { adminPassword, staffPassword };
}
