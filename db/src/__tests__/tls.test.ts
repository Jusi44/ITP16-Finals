import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeDatabaseUrl, resolveDatabaseSsl, resolveDatabaseSslMode } from '../client.js';

const tempDirectory = mkdtempSync(join(tmpdir(), 'smartcanteen-ca-'));
const caFile = join(tempDirectory, 'ca.pem');
writeFileSync(caFile, 'test-ca-certificate');

afterAll(() => {
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe('database TLS', () => {
  it('defaults to off outside production and verify in production', () => {
    expect(resolveDatabaseSslMode({ value: undefined, nodeEnv: 'development' })).toBe('off');
    expect(resolveDatabaseSslMode({ value: undefined, nodeEnv: 'test' })).toBe('off');
    expect(resolveDatabaseSslMode({ value: undefined, nodeEnv: 'production' })).toBe('verify');
  });

  it('rejects off in production', () => {
    expect(() => resolveDatabaseSslMode({ value: 'off', nodeEnv: 'production' })).toThrow(
      /DATABASE_SSL=off/,
    );
  });

  it('builds explicit ssl options', () => {
    expect(resolveDatabaseSsl('off')).toBe(false);
    expect(resolveDatabaseSsl('require')).toEqual({ rejectUnauthorized: false });
    expect(resolveDatabaseSsl('verify', caFile)).toEqual({
      ca: 'test-ca-certificate',
      rejectUnauthorized: true,
    });
  });

  it('requires a CA file for verify', () => {
    expect(() => resolveDatabaseSsl('verify')).toThrow(/DATABASE_SSL_CA_FILE/);
  });

  it('strips sslmode from the connection URL', () => {
    const normalized = normalizeDatabaseUrl(
      'postgresql://user:password@localhost:5432/smartcanteen?sslmode=prefer',
    );
    expect(normalized).not.toContain('sslmode');
  });
});
