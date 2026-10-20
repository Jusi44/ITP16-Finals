import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const baseEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL:
    'postgresql://smartcanteen:strong-password@smartcanteen.cluster-abc123.ap-southeast-1.rds.amazonaws.com:5432/smartcanteen',
  DATABASE_SSL: 'require',
  APP_TIMEZONE: 'Asia/Manila',
  TRUST_PROXY: '10.0.0.0/8',
} satisfies NodeJS.ProcessEnv;

describe('api env', () => {
  it('allows a production RDS URL whose password merely contains "example"', () => {
    const parsed = parseEnv({
      ...baseEnv,
      DATABASE_URL:
        'postgresql://smartcanteen:exampleProductionPassword@smartcanteen.cluster-abc123.ap-southeast-1.rds.amazonaws.com:5432/smartcanteen',
    });

    expect(parsed.DATABASE_SSL).toBe('require');
  });

  it('rejects localhost in production', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://smartcanteen:strong-password@localhost:5432/smartcanteen',
      }),
    ).toThrow(/local or placeholder host/);
  });

  it('rejects a placeholder password in production', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        DATABASE_URL:
          'postgresql://smartcanteen:local_dev_only_change_me@smartcanteen.cluster-abc123.ap-southeast-1.rds.amazonaws.com:5432/smartcanteen',
      }),
    ).toThrow(/placeholder database password/);
  });

  it('rejects DATABASE_SSL=off in production', () => {
    expect(() => parseEnv({ ...baseEnv, DATABASE_SSL: 'off' })).toThrow(
      /DATABASE_SSL=off is not allowed/,
    );
  });

  it('rejects TRUST_PROXY=false in production', () => {
    expect(() => parseEnv({ ...baseEnv, TRUST_PROXY: 'false' })).toThrow(
      /TRUST_PROXY must be configured/,
    );
  });

  it('rejects an invalid time zone', () => {
    expect(() => parseEnv({ ...baseEnv, APP_TIMEZONE: 'Not/AZone' })).toThrow(
      /valid IANA time zone/,
    );
  });
});
