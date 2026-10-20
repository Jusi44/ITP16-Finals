import { verify } from '@node-rs/argon2';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getSeedPasswords } from '../env.js';
import * as schema from '../schema.js';
import { seedSampleItems } from '../seed-sample-items.js';
import { seedUsers } from '../seed.js';
import { endTestPool, getTestDb, truncateAll } from '../testing/test-db.js';

const db = getTestDb();
const adminPassword = 'test-admin-password';
const staffPassword = 'test-staff-password';

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await endTestPool();
});

describe('user seed', () => {
  it('creates admin and staff with argon2id hashes and is idempotent', async () => {
    const first = await seedUsers(db, { adminPassword, staffPassword });
    expect(first.created.sort()).toEqual(['admin', 'staff']);
    expect(first.skipped).toEqual([]);

    const users = await db.select().from(schema.users);
    expect(users).toHaveLength(2);

    const admin = users.find((user) => user.username === 'admin');
    const staff = users.find((user) => user.username === 'staff');
    expect(admin?.role).toBe('ADMIN');
    expect(staff?.role).toBe('STAFF');
    expect(admin?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(staff?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(admin?.passwordHash).not.toContain(adminPassword);
    expect(staff?.passwordHash).not.toContain(staffPassword);
    await expect(verify(admin?.passwordHash ?? '', adminPassword)).resolves.toBe(true);
    await expect(verify(staff?.passwordHash ?? '', staffPassword)).resolves.toBe(true);

    const beforeHashes = users.map((user) => user.passwordHash);

    const second = await seedUsers(db, {
      adminPassword: 'different-admin-password',
      staffPassword: 'different-staff-password',
    });

    expect(second.created).toEqual([]);
    expect(second.skipped.sort()).toEqual(['admin', 'staff']);

    const afterHashes = (await db.select().from(schema.users)).map((user) => user.passwordHash);
    expect(afterHashes.sort()).toEqual(beforeHashes.sort());
  });

  it('fails clearly when seed secrets are missing', () => {
    expect(() => getSeedPasswords({})).toThrow(/SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD/);
  });

  it('refuses short or placeholder seed passwords', () => {
    expect(() =>
      getSeedPasswords({
        SEED_ADMIN_PASSWORD: 'short',
        SEED_STAFF_PASSWORD: staffPassword,
      }),
    ).toThrow(/8-128/);

    expect(() =>
      getSeedPasswords({
        SEED_ADMIN_PASSWORD: 'local_dev_only_change_me',
        SEED_STAFF_PASSWORD: staffPassword,
      }),
    ).toThrow(/placeholder/);
  });
});

describe('sample item seed', () => {
  it('is idempotent and refuses production', async () => {
    const first = await seedSampleItems(db, 'development');
    expect(first).toEqual({ created: 6, skipped: 0 });

    const second = await seedSampleItems(db, 'development');
    expect(second).toEqual({ created: 0, skipped: 6 });

    await expect(seedSampleItems(db, 'production')).rejects.toThrow(/local-only/);
  });
});
