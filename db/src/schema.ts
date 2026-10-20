import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

export const userRole = pgEnum('user_role', ['ADMIN', 'STAFF']);
export const stockType = pgEnum('stock_type', ['RESTOCK', 'SALE']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: citext('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('STAFF'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('users_username_format', sql`${table.username} ~ '^[A-Za-z0-9_.-]{3,32}$'`)],
);

export const foodItems = pgTable(
  'food_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    currentStock: integer('current_stock').notNull().default(0),
    minThreshold: integer('min_threshold').notNull().default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('food_items_price_non_negative', sql`${table.price} >= 0`),
    check('food_items_current_stock_non_negative', sql`${table.currentStock} >= 0`),
    check('food_items_min_threshold_non_negative', sql`${table.minThreshold} >= 0`),
  ],
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id').references(() => foodItems.id, { onDelete: 'set null' }),
    itemName: text('item_name').notNull(),
    quantitySold: integer('quantity_sold').notNull(),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    username: text('username').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('sales_quantity_sold_positive', sql`${table.quantitySold} > 0`),
    check('sales_total_price_non_negative', sql`${table.totalPrice} >= 0`),
    index('sales_created_at_idx').on(table.createdAt.desc()),
    index('sales_item_id_idx').on(table.itemId),
    index('sales_user_id_idx').on(table.userId),
  ],
);

export const stockRecords = pgTable(
  'stock_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id').references(() => foodItems.id, { onDelete: 'set null' }),
    itemName: text('item_name').notNull(),
    quantityChanged: integer('quantity_changed').notNull(),
    type: stockType('type').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    username: text('username').notNull().default('System'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('stock_records_quantity_changed_positive', sql`${table.quantityChanged} > 0`),
    index('stock_records_created_at_idx').on(table.createdAt.desc()),
    index('stock_records_item_id_idx').on(table.itemId),
    index('stock_records_user_id_idx').on(table.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type FoodItem = typeof foodItems.$inferSelect;
export type NewFoodItem = typeof foodItems.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type StockRecord = typeof stockRecords.$inferSelect;
export type NewStockRecord = typeof stockRecords.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
