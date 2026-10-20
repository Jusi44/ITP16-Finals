import { accessSync, constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const databaseSslSchema = z.enum(['off', 'require', 'verify']);

const rawEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: databaseSslSchema.optional(),
  DATABASE_SSL_CA_FILE: z.string().optional(),
  APP_TIMEZONE: z.string().min(1).default('Asia/Manila'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => {
      if (value === 'true') {
        return true;
      }
      if (value === 'false' || value.trim() === '') {
        return false;
      }
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }),
});

export type AppEnv = z.infer<typeof rawEnvSchema> & {
  DATABASE_SSL: z.infer<typeof databaseSslSchema>;
};

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  );
}

function isPlaceholderHost(hostname: string): boolean {
  return (
    hostname === 'example.com' ||
    hostname === 'example.org' ||
    hostname.endsWith('.example.com') ||
    hostname.endsWith('.example.org') ||
    hostname.startsWith('your-') ||
    hostname.includes('your-host')
  );
}

function validateProductionDatabaseUrl(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL.');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }

  const hostname = url.hostname.toLowerCase();
  const password = decodeURIComponent(url.password);

  if (isLoopbackHost(hostname) || isPlaceholderHost(hostname)) {
    throw new Error('DATABASE_URL must not point at a local or placeholder host in production.');
  }

  if (password.length < 8) {
    throw new Error('DATABASE_URL must include a database password of at least 8 characters.');
  }

  if (/^(change[_-]?me|local_dev_only_change_me|password|replace[_-]?me)$/i.test(password)) {
    throw new Error('DATABASE_URL must not use a placeholder database password in production.');
  }
}

export function parseEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const parsed = rawEnvSchema.parse(raw);

  if (!isValidTimeZone(parsed.APP_TIMEZONE)) {
    throw new Error('APP_TIMEZONE must be a valid IANA time zone.');
  }

  const databaseSsl = parsed.DATABASE_SSL ?? (parsed.NODE_ENV === 'production' ? 'verify' : 'off');

  if (parsed.NODE_ENV === 'production') {
    validateProductionDatabaseUrl(parsed.DATABASE_URL);

    if (databaseSsl === 'off') {
      throw new Error('DATABASE_SSL=off is not allowed when NODE_ENV=production.');
    }

    if (parsed.TRUST_PROXY === false) {
      throw new Error('TRUST_PROXY must be configured when NODE_ENV=production.');
    }
  }

  if (databaseSsl === 'verify') {
    if (!parsed.DATABASE_SSL_CA_FILE?.trim()) {
      throw new Error('DATABASE_SSL_CA_FILE is required when DATABASE_SSL=verify.');
    }

    try {
      accessSync(parsed.DATABASE_SSL_CA_FILE, constants.R_OK);
    } catch {
      throw new Error('DATABASE_SSL_CA_FILE must point to a readable CA bundle.');
    }
  }

  return { ...parsed, DATABASE_SSL: databaseSsl };
}

export const env = parseEnv(process.env);
