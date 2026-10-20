import { hash, type Options } from '@node-rs/argon2';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createPool, createDb } from './client.js';
import { getDatabaseConnectionOptions, getSeedPasswords } from './env.js';
import { isEntrypoint } from './entrypoint.js';
import * as schema from './schema.js';
import { validatePassword } from './validation.js';

const ARGON2_OPTIONS: Options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export interface SeedUsersInput {
  adminPassword: string;
  staffPassword: string;
}

export interface SeedUsersResult {
  created: string[];
  skipped: string[];
}

export async function seedUsers(
  db: NodePgDatabase<typeof schema>,
  input: SeedUsersInput,
): Promise<SeedUsersResult> {
  validatePassword(input.adminPassword);
  validatePassword(input.staffPassword);

  const [adminHash, staffHash] = await Promise.all([
    hash(input.adminPassword, ARGON2_OPTIONS),
    hash(input.staffPassword, ARGON2_OPTIONS),
  ]);

  const accounts = [
    { username: 'admin', passwordHash: adminHash, role: 'ADMIN' as const },
    { username: 'staff', passwordHash: staffHash, role: 'STAFF' as const },
  ];

  const created: string[] = [];
  const skipped: string[] = [];

  await db.transaction(async (tx) => {
    for (const account of accounts) {
      const inserted = await tx
        .insert(schema.users)
        .values(account)
        .onConflictDoNothing({ target: schema.users.username })
        .returning({ username: schema.users.username });

      if (inserted.length > 0) {
        created.push(account.username);
      } else {
        skipped.push(account.username);
      }
    }
  });

  return { created, skipped };
}

async function main(): Promise<void> {
  const passwords = getSeedPasswords();
  const pool = createPool(getDatabaseConnectionOptions());
  const db = createDb(pool);

  try {
    const result = await seedUsers(db, passwords);
    console.log(
      `User seed complete: ${result.created.length} created, ${result.skipped.length} skipped.`,
    );
  } finally {
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
