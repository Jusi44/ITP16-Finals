import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hash, type Options } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDb, createPool } from './client.js';
import { getDatabaseConnectionOptions } from './env.js';
import { isEntrypoint } from './entrypoint.js';
import { readPasswordInput } from './hidden-prompt.js';
import * as schema from './schema.js';
import { validatePassword, validateUsername } from './validation.js';

const ARGON2_OPTIONS: Options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export interface SetPasswordResult {
  username: string;
  sessionsRevoked: number;
}

export async function setUserPassword(
  db: NodePgDatabase<typeof schema>,
  username: string,
  newPassword: string,
): Promise<SetPasswordResult> {
  validateUsername(username);
  validatePassword(newPassword);

  const passwordHash = await hash(newPassword, ARGON2_OPTIONS);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    const user = existing[0];

    if (!user) {
      throw new Error(`User "${username}" not found.`);
    }

    await tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id));

    const revoked = await tx
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, user.id))
      .returning({ id: schema.sessions.id });

    return { username: user.username, sessionsRevoked: revoked.length };
  });
}

async function readUsername(): Promise<string> {
  const configured = process.env.SET_PASSWORD_USER?.trim();
  if (configured) {
    return validateUsername(configured);
  }

  if (!stdin.isTTY) {
    throw new Error('SET_PASSWORD_USER is not set and stdin is not an interactive terminal.');
  }

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await readline.question('Username: ');
    return validateUsername(answer.trim());
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  const username = await readUsername();
  const newPassword = await readPasswordInput();
  const pool = createPool(getDatabaseConnectionOptions());
  const db = createDb(pool);

  try {
    const result = await setUserPassword(db, username, newPassword);
    console.log(`Password updated for ${result.username}`);
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
