import { afterAll, describe, expect, it } from 'vitest';
import { countMigrations } from '../migrate.js';
import {
  createFreshTestDatabase,
  endTestPool,
  openTestClient,
  runTestMigrations,
} from '../testing/test-db.js';

const migratorDatabaseName = 'smartcanteen_migrator_test';

afterAll(async () => {
  await endTestPool();
});

describe('migration runner', () => {
  it('serializes two simultaneous runs without duplicate migrations', async () => {
    const databaseUrl = await createFreshTestDatabase(migratorDatabaseName);

    await expect(
      Promise.all([runTestMigrations(databaseUrl), runTestMigrations(databaseUrl)]),
    ).resolves.toEqual([undefined, undefined]);

    const client = await openTestClient(databaseUrl);

    try {
      const result = await client.query(
        'SELECT count(*)::int AS count, count(DISTINCT hash)::int AS distinct_count FROM drizzle.__drizzle_migrations',
      );

      const expected = countMigrations();
      expect(expected).toBeGreaterThan(0);
      expect(result.rows[0]?.count).toBe(expected);
      expect(result.rows[0]?.distinct_count).toBe(expected);

      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      );
      const tableNames = tables.rows.map((row) => String(row.table_name));

      expect(tableNames).toEqual(['food_items', 'sales', 'sessions', 'stock_records', 'users']);

      await client.query(
        `INSERT INTO users (username, password_hash)
         VALUES ('migration-check', 'hash')
         ON CONFLICT DO NOTHING`,
      );
    } finally {
      await client.end();
    }
  });
});
