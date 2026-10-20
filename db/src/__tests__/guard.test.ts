import { describe, expect, it } from 'vitest';
import { assertTestDatabase, getDatabaseName } from '../testing/guard.js';

describe('test database guard', () => {
  it('accepts a database name ending in _test', () => {
    const name = assertTestDatabase(
      'postgresql://user:password@localhost:5432/smartcanteen_test',
      'test',
    );
    expect(name).toBe('smartcanteen_test');
  });

  it('rejects a database that does not end in _test', () => {
    expect(() =>
      assertTestDatabase('postgresql://user:password@localhost:5432/smartcanteen', 'test'),
    ).toThrow(/does not end in _test/);
  });

  it('rejects NODE_ENV=production', () => {
    expect(() =>
      assertTestDatabase(
        'postgresql://user:password@localhost:5432/smartcanteen_test',
        'production',
      ),
    ).toThrow(/NODE_ENV=production/);
  });

  it('extracts the database name', () => {
    expect(getDatabaseName('postgresql://user:password@localhost:5432/smartcanteen_test')).toBe(
      'smartcanteen_test',
    );
  });
});
