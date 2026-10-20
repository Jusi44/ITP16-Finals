import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDb, createPool } from './client.js';
import { getDatabaseConnectionOptions, getNodeEnv } from './env.js';
import { isEntrypoint } from './entrypoint.js';
import { assertMoneyString, type MoneyString } from './money.js';
import * as schema from './schema.js';

export interface SampleItem {
  name: string;
  category: string;
  price: MoneyString;
  currentStock: number;
  minThreshold: number;
}

export const SAMPLE_ITEMS: SampleItem[] = [
  {
    name: 'Chicken Adobo Rice',
    category: 'Meals',
    price: '65.00',
    currentStock: 20,
    minThreshold: 5,
  },
  {
    name: 'Pancit Bihon',
    category: 'Meals',
    price: '50.00',
    currentStock: 4,
    minThreshold: 5,
  },
  {
    name: 'Iced Tea',
    category: 'Drinks',
    price: '25.00',
    currentStock: 30,
    minThreshold: 5,
  },
  {
    name: 'Bottled Water',
    category: 'Drinks',
    price: '20.00',
    currentStock: 0,
    minThreshold: 5,
  },
  {
    name: 'Banana Chips',
    category: 'Snacks',
    price: '15.00',
    currentStock: 40,
    minThreshold: 5,
  },
  {
    name: 'Leche Flan',
    category: 'Desserts',
    price: '35.00',
    currentStock: 3,
    minThreshold: 5,
  },
];

export interface SampleSeedResult {
  created: number;
  skipped: number;
}

export async function seedSampleItems(
  db: NodePgDatabase<typeof schema>,
  nodeEnv: string,
): Promise<SampleSeedResult> {
  if (nodeEnv === 'production') {
    throw new Error('Sample items are local-only fixtures and cannot be seeded in production.');
  }

  for (const item of SAMPLE_ITEMS) {
    assertMoneyString(item.price);
  }

  const existing = await db.select({ name: schema.foodItems.name }).from(schema.foodItems);
  const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));
  const missing = SAMPLE_ITEMS.filter((item) => !existingNames.has(item.name.toLowerCase()));

  if (missing.length > 0) {
    await db.insert(schema.foodItems).values(missing);
  }

  return {
    created: missing.length,
    skipped: SAMPLE_ITEMS.length - missing.length,
  };
}

async function main(): Promise<void> {
  const pool = createPool(getDatabaseConnectionOptions());
  const db = createDb(pool);

  try {
    const result = await seedSampleItems(db, getNodeEnv());
    console.log(`Sample item seed complete: ${result.created} created, ${result.skipped} skipped.`);
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
