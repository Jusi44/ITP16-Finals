# SmartCanteen — Functional Parity Spec (derived from the Android source)

## 1. Roles & navigation
- Roles: `ADMIN`, `STAFF`. Login by username + password.
- Sessions: 8-hour DB-backed session (random opaque token; only its SHA-256 hash stored), httpOnly + SameSite=Lax cookie, Secure and `__Host-` prefix in production. Logout and user deletion revoke access immediately.
- Tabs for everyone: **Dashboard, Inventory, Orders (sales), Analytics (reports)**.
- **Personnel** tab (user management) only for `ADMIN`.
- Sub-page **Stock History / "Audit Trail"** opened from Reports; has a back button.
- Header: avatar circle (first letter of username), "SmartCanteen", "Session: <username>", logout button.
- On login show a toast: "Welcome back, <username>!". Success/failure toasts for every mutation.
- Theme: orange gradient (#FF9800 -> #FF5722) for header/nav/login, background #F9F9FB, white rounded cards,
  heavy font weights. Desktop: nav becomes a left sidebar; mobile: bottom nav. Keep the same visual identity.
- App name tagline on login: "Efficient • Modern • Reliable"; button "ACCESS SYSTEM"; footer "Authorized Access Only".

## 2. Data model (Firestore -> PostgreSQL)
Android entities: FoodItem, Sale, StockRecord, User.

Extensions: only `citext` is required. `gen_random_uuid()` is built into Postgres 13+, so `pgcrypto` is not installed. All money columns are `numeric(12,2)`.

Database connections use TLS in production. `DATABASE_SSL` is `off`, `require` (encrypted, no certificate verification), or `verify` (certificate + hostname verification against `DATABASE_SSL_CA_FILE`). It defaults to `off` outside production and `verify` in production; production refuses to start with `off`. The `ssl` option is built explicitly and any `sslmode` in `DATABASE_URL` is ignored.

```sql
CREATE TYPE user_role AS ENUM ('ADMIN','STAFF');
CREATE TYPE stock_type AS ENUM ('RESTOCK','SALE');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'STAFF',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_.-]{3,32}$')
);
CREATE TABLE food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  current_stock int NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_threshold int NOT NULL DEFAULT 5 CHECK (min_threshold >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES food_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,            -- snapshot (Android denormalizes this too)
  quantity_sold int NOT NULL CHECK (quantity_sold > 0),
  total_price numeric(12,2) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_total_price_non_negative CHECK (total_price >= 0)
);
CREATE TABLE stock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES food_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity_changed int NOT NULL CHECK (quantity_changed > 0),
  type stock_type NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username text NOT NULL DEFAULT 'System',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON sales (created_at DESC);
CREATE INDEX ON sales (item_id);
CREATE INDEX ON sales (user_id);
CREATE INDEX ON stock_records (created_at DESC);
CREATE INDEX ON stock_records (item_id);
CREATE INDEX ON stock_records (user_id);
CREATE INDEX ON sessions (user_id);
CREATE INDEX ON sessions (expires_at);
```

`stock_records.quantity_changed` is always a positive magnitude; the UI derives `+N`/`-N` from `type`.

`food_items.updated_at` is maintained by a `BEFORE UPDATE` trigger (`food_items_set_updated_at`), so ORM and raw SQL updates both refresh it.

## 3. Business rules (from the Android code)
- **Low stock:** `current_stock <= min_threshold`. **Out of stock:** `current_stock = 0`.
- **Stock colour:** `<= threshold` red; `<= threshold + 5` orange; else green.
- **Stock progress bar:** `current_stock / (current_stock + 15)`, clamped to [0.1, 1]; 0 when stock is 0.
- **Default categories:** Meals, Drinks, Snacks, Desserts, plus any distinct category already in use. Default new-item category "Meals", default threshold 5.
- **Seed accounts** (first run only): `admin` (ADMIN) and `staff` (STAFF). Passwords come from env at seed time — NOT hardcoded `admin123/staff123` (that is what the Android app does; we must not).
- **Delete user:** allowed for any user except the one named `admin` (case-insensitive), yourself, or the last remaining `ADMIN`.
- **Record sale:** quantity 1..current_stock. Creates a Sale (price snapshot = item.price * qty) and a StockRecord `type=SALE, quantity_changed=qty` (positive magnitude; UI renders `-N`), decrements stock. If stock is insufficient -> 409 `INSUFFICIENT_STOCK` (Android silently no-ops while showing success; that is a bug).
- **Restock:** positive integer qty; stock += qty; StockRecord `type=RESTOCK`. Must be one transaction (Android does it as two separate writes).
- **Edit item:** name, category, price, current stock, threshold all editable. Keep Android parity: an edit that overwrites stock creates no stock record. This is a product decision that may change later.
- **Delete item:** confirmation dialog "Are you sure you want to delete <name>?". History rows for deleted items show the snapshot name labelled "(removed)" (Android shows "Removed Item").
- **Dashboard:** cards "Total Menu" (item count) and "Low Stock" (count; red when > 0); 7-day sales trend bar chart (seven calendar days including today in `APP_TIMEZONE`, oldest->today; bar height = day revenue / max; zero-revenue days get 0 height, days with sales get a 5% minimum; label = weekday; small rotated caption = top product by quantity that day); "Attention Required" list of low-stock items ("Out of Stock" or "Only N left in inventory"); "Top Sellers" top 3 items by total quantity with "N sold"; empty state "No sales data available yet".
- **Inventory:** search by name (case-insensitive), category chips ("All" + distinct), cards with name, ₱price, category badge, stock number ("EMPTY" at 0) + "IN STOCK" label, progress bar, actions Restock / Edit / Delete, "Add Item" button. Empty state "No items found in this category".
- **Orders (POS):** search "What would you like to sell?"; list items with price, category, "N left" / "OUT OF STOCK"; click to select (toggle); order-summary panel with qty stepper (min 1, max current stock) and button "COMPLETE PAYMENT • ₱<total>"; after success show a 1.5 s "SUCCESS" overlay. Disable selection/payment for out-of-stock items.
- **Reports:** filter chips Today / 7 Days (seven calendar days including today) / All Time; "NET REVENUE" card (sum, 2 decimals) + "N Transactions"; "Recent Transactions" list (item, "MMM dd, HH:mm", +₱total, "N units"); **Share** button -> web: Web Share API with clipboard fallback, plus CSV download. Report text format:
  `SmartCanteen Sales Report / Total Revenue: ₱X.XX / Total Sales: N / then "<date> - <item>: ₱<total>" per line`.
  Button to open Stock History.
- **Stock History (Audit Trail):** list of records: item name, "Added to stock by <user>" or "Sold by <user>", date, badge "+N" (green) / "-N" (red). Empty state "No activity recorded yet".
- **Personnel (ADMIN):** list users with role badge, add-user dialog (username, password, role STAFF/ADMIN), delete button (hidden for `admin`, self, and the last remaining `ADMIN`). Usernames are 3-32 chars `[A-Za-z0-9_.-]`; passwords are 8-128 chars. No self-service password reset.
- **Live data:** Android uses Firestore snapshot listeners, so screens update in real time across devices. Web: SSE channel `/api/events` (or 5 s polling as the minimum) so a sale on one terminal updates others.

## 4. Deviations I want from the Android behaviour (bug fixes)
1. Lists (transactions, audit trail) show **newest first** (Android sorts DESC then `.reversed()` -> oldest first).
2. Passwords hashed; no plaintext, no hardcoded defaults, no client-side auth.
3. Atomic, race-safe sale + restock; explicit insufficient-stock error.
4. "Today" = calendar day in `APP_TIMEZONE` (Android uses a rolling 24h window while its chart uses calendar days).
Anything else that differs must be listed in the phase summary.

## 5. REST API (all under /api, JSON, cookie session)
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | /auth/login | public | rate-limited (5 failed/min per IP+username, 429 `RATE_LIMITED`); sets cookie |
| POST | /auth/logout | any | |
| GET | /auth/me | any | current user |
| GET | /items | any | |
| POST | /items | any | validate |
| PATCH | /items/:id | any | |
| DELETE | /items/:id | any | |
| POST | /items/:id/restock | any | `{quantity}` |
| POST | /sales | any | `{itemId, quantity}` atomic |
| GET | /sales?range=today\|7d\|all | any | |
| GET | /reports/export.csv?range= | any | |
| GET | /stock-records | any | |
| GET | /dashboard | any | stats, low stock, top 3, 7-day series |
| GET | /users | ADMIN | no password fields |
| POST | /users | ADMIN | |
| DELETE | /users/:id | ADMIN | not `admin`, not self |
| GET | /events | any | SSE: item/sale/stock changes (Phase 4) |
| GET | /api/health | public | for ALB health check |

Phase 2 implements this table except `/reports/export.csv` and `/events`, which are Phase 4.
