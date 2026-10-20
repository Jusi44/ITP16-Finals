import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readPasswordInput } from '../hidden-prompt.js';
import * as schema from '../schema.js';
import { seedUsers } from '../seed.js';
import { setUserPassword } from '../set-password.js';
import { endTestPool, getTestDb, truncateAll } from '../testing/test-db.js';

const db = getTestDb();

beforeEach(async () => {
  await truncateAll(db);
  await seedUsers(db, {
    adminPassword: 'test-admin-password',
    staffPassword: 'test-staff-password',
  });
});

afterAll(async () => {
  await endTestPool();
});

describe('set-password', () => {
  it('updates the hash and revokes sessions in one operation', async () => {
    const [admin] = await db.select().from(schema.users).where(eq(schema.users.username, 'admin'));
    expect(admin).toBeDefined();

    await db.insert(schema.sessions).values({
      userId: admin!.id,
      tokenHash: 'existing-session',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await setUserPassword(db, 'admin', 'new-admin-password');
    expect(result.sessionsRevoked).toBe(1);

    const [updated] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, 'admin'));
    expect(updated?.passwordHash).not.toBe(admin!.passwordHash);
    await expect(verify(updated?.passwordHash ?? '', 'new-admin-password')).resolves.toBe(true);

    const sessions = await db.select().from(schema.sessions);
    expect(sessions).toHaveLength(0);
  });

  it('rejects invalid passwords and unknown users', async () => {
    await expect(setUserPassword(db, 'admin', 'short')).rejects.toThrow(/8-128/);
    await expect(setUserPassword(db, 'nobody', 'valid-password')).rejects.toThrow(/not found/);
  });
});

describe('password input', () => {
  it('uses SET_PASSWORD when present', async () => {
    await expect(
      readPasswordInput({ env: { SET_PASSWORD: 'from-env' }, stdin: { isTTY: false } }),
    ).resolves.toBe('from-env');
  });

  it('fails instead of hanging when non-interactive without SET_PASSWORD', async () => {
    await expect(readPasswordInput({ env: {}, stdin: { isTTY: false } })).rejects.toThrow(
      /not an interactive terminal/,
    );
  });
});
