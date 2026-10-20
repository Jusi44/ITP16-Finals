import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema.js';
import { endTestPool, getTestDb, truncateAll } from '../testing/test-db.js';

const db = getTestDb();

async function captureError(operation: Promise<unknown>): Promise<{ code?: string }> {
  try {
    await operation;
  } catch (error) {
    const wrapped = error as { code?: string; cause?: { code?: string } };
    return { code: wrapped.code ?? wrapped.cause?.code };
  }

  throw new Error('Expected the database operation to fail.');
}

async function insertUser(username = 'admin'): Promise<schema.User> {
  const [user] = await db
    .insert(schema.users)
    .values({ username, passwordHash: 'hash' })
    .returning();
  return user as schema.User;
}

async function insertItem(): Promise<schema.FoodItem> {
  const [item] = await db
    .insert(schema.foodItems)
    .values({ name: 'Test Item', category: 'Meals', price: '10.00' })
    .returning();
  return item as schema.FoodItem;
}

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await endTestPool();
});

describe('schema constraints', () => {
  it('rejects a username outside the policy', async () => {
    const error = await captureError(insertUser('ab'));
    expect(error.code).toBe('23514');
  });

  it('rejects a username with invalid characters', async () => {
    const error = await captureError(insertUser('bad name'));
    expect(error.code).toBe('23514');
  });

  it('enforces case-insensitive unique usernames', async () => {
    await insertUser('admin');
    const error = await captureError(insertUser('Admin'));
    expect(error.code).toBe('23505');
  });

  it('rejects negative sales totals', async () => {
    const item = await insertItem();
    const user = await insertUser();

    const error = await captureError(
      db.insert(schema.sales).values({
        itemId: item.id,
        itemName: item.name,
        quantitySold: 1,
        totalPrice: '-1.00',
        userId: user.id,
        username: user.username,
      }),
    );

    expect(error.code).toBe('23514');
  });

  it('rejects zero or negative sale quantities', async () => {
    const item = await insertItem();

    const error = await captureError(
      db.insert(schema.sales).values({
        itemId: item.id,
        itemName: item.name,
        quantitySold: 0,
        totalPrice: '10.00',
        username: 'admin',
      }),
    );

    expect(error.code).toBe('23514');
  });

  it('rejects negative stock', async () => {
    const item = await insertItem();

    const error = await captureError(
      db
        .update(schema.foodItems)
        .set({ currentStock: -1 })
        .where(sql`${schema.foodItems.id} = ${item.id}`),
    );

    expect(error.code).toBe('23514');
  });

  it('rejects zero or negative stock record magnitudes', async () => {
    const item = await insertItem();

    const error = await captureError(
      db.insert(schema.stockRecords).values({
        itemId: item.id,
        itemName: item.name,
        quantityChanged: 0,
        type: 'RESTOCK',
      }),
    );

    expect(error.code).toBe('23514');
  });
});

describe('schema relationships', () => {
  it('cascades session deletion when a user is deleted', async () => {
    const user = await insertUser();

    await db.insert(schema.sessions).values({
      userId: user.id,
      tokenHash: 'session-hash',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await db.delete(schema.users).where(sql`${schema.users.id} = ${user.id}`);

    const sessions = await db.select().from(schema.sessions);
    expect(sessions).toHaveLength(0);
  });

  it('keeps the sale snapshot when an item is deleted', async () => {
    const item = await insertItem();
    const user = await insertUser();

    await db.insert(schema.sales).values({
      itemId: item.id,
      itemName: item.name,
      quantitySold: 1,
      totalPrice: '10.00',
      userId: user.id,
      username: user.username,
    });

    await db.delete(schema.foodItems).where(sql`${schema.foodItems.id} = ${item.id}`);

    const [sale] = await db.select().from(schema.sales);
    expect(sale?.itemId).toBeNull();
    expect(sale?.itemName).toBe('Test Item');
  });

  it('maintains food_items.updated_at with a trigger', async () => {
    const item = await insertItem();
    await new Promise((resolve) => setTimeout(resolve, 20));

    await db
      .update(schema.foodItems)
      .set({ currentStock: 3 })
      .where(sql`${schema.foodItems.id} = ${item.id}`);

    const [updated] = await db
      .select()
      .from(schema.foodItems)
      .where(sql`${schema.foodItems.id} = ${item.id}`);

    expect(updated?.updatedAt.getTime()).toBeGreaterThan(item.updatedAt.getTime());
  });
});

describe('citext and indexes', () => {
  it('compares usernames case-insensitively', async () => {
    const result = await db.execute(sql`SELECT 'Admin'::citext = 'admin'::citext AS equal`);
    expect(result.rows[0]?.equal).toBe(true);
  });

  it('creates the FK indexes required by the spec', async () => {
    const result = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'sales_item_id_idx',
          'sales_user_id_idx',
          'stock_records_user_id_idx'
        )
    `);

    const names = result.rows.map((row) => String(row.indexname)).sort();
    expect(names).toEqual(['sales_item_id_idx', 'sales_user_id_idx', 'stock_records_user_id_idx']);
  });
});
