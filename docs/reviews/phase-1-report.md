# Phase 1 — Database Report

Status: implementation complete, verification passed, awaiting reviewer feedback.

## What Was Built

- Drizzle schema for `users`, `food_items`, `sales`, `stock_records`, and `sessions`, with enums, FKs, checks, and indexes from `docs/SPEC.md`.
- Forward-only migrations:
  - `db/migrations/0000_citext.sql` — `CREATE EXTENSION IF NOT EXISTS citext;`
  - `db/migrations/0001_init.sql` — generated schema, constraints, and indexes.
  - `db/migrations/0002_food_items_updated_at.sql` — `set_updated_at()` trigger function and `food_items_set_updated_at` trigger.
- Shared database connection module at `db/src/client.ts`:
  - Explicit `ssl` construction for `DATABASE_SSL=off|require|verify`.
  - Production default is `verify`; production startup fails on `off`.
  - `sslmode`/`ssl` are stripped from `DATABASE_URL` before `pg` sees the URL.
  - `DATABASE_SSL_CA_FILE` is required and read for `verify`.
- Advisory-locked migration runner at `db/src/migrate.ts`:
  - Dedicated `pg.Client` session.
  - `pg_advisory_lock(2026102001)` before migrating, unlocked in `finally`.
  - Compiled command: `node db/dist/migrate.js`.
- Idempotent user seed (`db/src/seed.ts`), local-only sample item seed (`db/src/seed-sample-items.ts`), and password rotation (`db/src/set-password.ts`) with a hidden prompt (`db/src/hidden-prompt.ts`).
- Shared username/password policy in `db/src/validation.ts`.
- Guarded test infrastructure in `db/src/testing/`:
  - `_test` suffix and non-production guard.
  - Derived `smartcanteen_test` database, migration setup, truncation, and fresh-database helpers.
  - `NODE_ENV=test` set by `db/vitest.config.ts`.
- API production env validation in `api/src/env.ts`: TLS, placeholder password/host checks, time zone, and `TRUST_PROXY`.
- Root `npm run check`; delegated API database scripts; README, AGENTS, SPEC, and `.env.example` updates.
- Removed `SESSION_SECRET` from `.env.example` and README. No secret values or hashes were written to the repository or this report.

## Feedback Items Addressed

1. TLS: implemented once in `db/src/client.ts` and used by migrate/seed/sample/set-password; API env validation rejects production `DATABASE_SSL=off` and validates `verify` CA files. Phase 2's API pool will call the shared `createPool`.
2. Production migrator: proven in a clean temp directory with a production-only install; no `drizzle-kit` or `tsx` present.
3. Concurrent migrations: advisory lock plus a two-run concurrency test on a fresh database.
4. `.env` secrets: existing `SEED_ADMIN_PASSWORD` and `SEED_STAFF_PASSWORD` were used by the seed without being printed, generated, or overwritten. Only their presence and non-empty state were checked.
5. Constraints: `users_username_format`, `sales_total_price_non_negative`, and tests expecting `23514`.
6. Test safety: `NODE_ENV=test`, guarded-only connections, negative guard tests for non-`_test` names and production.
7. Shared validation module: `db/src/validation.ts`.
8. Placeholder env checks: only the DB password and obvious/loopback hosts; a production password containing the substring `example` is accepted and tested.
9. `set-password` non-interactive path: fails immediately with a clear message; tested.
10. FK indexes: `sales_item_id_idx`, `sales_user_id_idx`, `stock_records_user_id_idx`.

## Commands and Actual Output

### `npm run check`

```text
> smartcanteen-web@0.0.0 check
> npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build

> smartcanteen-web@0.0.0 typecheck
> npm run typecheck --workspaces --if-present

> @smartcanteen/db@0.0.0 typecheck
> tsc -p tsconfig.json --noEmit

> @smartcanteen/api@0.0.0 typecheck
> tsc -p tsconfig.json --noEmit

> @smartcanteen/web@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json

> smartcanteen-web@0.0.0 lint
> eslint .

> smartcanteen-web@0.0.0 format:check
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> smartcanteen-web@0.0.0 test
> npm run test --workspaces --if-present

> @smartcanteen/db@0.0.0 test
> vitest run

 RUN  v5.0.5 C:/Users/Justine/Desktop/ITP16 Finals/smartcanteen-web/db

 Test Files  6 passed (6)
      Tests  30 passed (30)
   Start at  20:12:16
   Duration  6.75s

> @smartcanteen/api@0.0.0 test
> vitest run

 RUN  v5.0.5 C:/Users/Justine/Desktop/ITP16 Finals/smartcanteen-web/api

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  20:12:24
   Duration  2.02s

> smartcanteen-web@0.0.0 build
> npm run build --workspaces --if-present

> @smartcanteen/db@0.0.0 build
> tsc -p tsconfig.json

> @smartcanteen/api@0.0.0 build
> tsc -p tsconfig.json

> @smartcanteen/web@0.0.0 build
> vite build

vite v8.3.4 building client environment for production...
✓ 15 modules transformed.
✓ built in 431ms
```

### `npm run db:migrate -w api`

```text
> @smartcanteen/api@0.0.0 db:migrate
> npm run migrate -w @smartcanteen/db

> @smartcanteen/db@0.0.0 migrate
> tsx src/migrate.ts

Migrations complete.
```

### User seed, run twice (idempotency)

```text
> @smartcanteen/db@0.0.0 seed
> tsx src/seed.ts

User seed complete: 2 created, 0 skipped.

> @smartcanteen/db@0.0.0 seed
> tsx src/seed.ts

User seed complete: 0 created, 2 skipped.
```

Database check (no password fields or hashes selected):

```text
 username | role
----------+-------
 admin    | ADMIN
 staff    | STAFF
(2 rows)
```

### Sample seed, run twice (idempotency)

```text
> @smartcanteen/db@0.0.0 seed:sample
> tsx src/seed-sample-items.ts

Sample item seed complete: 6 created, 0 skipped.

> @smartcanteen/db@0.0.0 seed:sample
> tsx src/seed-sample-items.ts

Sample item seed complete: 0 created, 6 skipped.
```

### Table definitions (`\d+`)

#### users

```text
                                                            Table "public.users"
    Column     |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description
---------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id            | uuid                     |           | not null | gen_random_uuid()  | plain    |             |              |
 username      | citext                   |           | not null |                    | extended |             |              |
 password_hash | text                     |           | not null |                    | extended |             |              |
 role          | user_role                |           | not null | 'STAFF'::user_role | plain    |             |              |
 created_at    | timestamp with time zone |           | not null | now()              | plain    |             |              |
Indexes:
    "users_pkey" PRIMARY KEY, btree (id)
    "users_username_unique" UNIQUE CONSTRAINT, btree (username)
Check constraints:
    "users_username_format" CHECK (username ~ '^[A-Za-z0-9_.-]{3,32}$'::citext)
Referenced by:
    TABLE "sales" CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    TABLE "sessions" CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "stock_records" CONSTRAINT "stock_records_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
```

#### food_items

```text
                                                         Table "public.food_items"
    Column     |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description
---------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id            | uuid                     |           | not null | gen_random_uuid() | plain    |             |              |
 name          | text                     |           | not null |                   | extended |             |              |
 category      | text                     |           | not null |                   | extended |             |              |
 price         | numeric(12,2)            |           | not null |                   | main     |             |              |
 current_stock | integer                  |           | not null | 0                 | plain    |             |              |
 min_threshold | integer                  |           | not null | 5                 | plain    |             |              |
 created_at    | timestamp with time zone |           | not null | now()             | plain    |             |              |
 updated_at    | timestamp with time zone |           | not null | now()             | plain    |             |              |
Indexes:
    "food_items_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "food_items_current_stock_non_negative" CHECK (current_stock >= 0)
    "food_items_min_threshold_non_negative" CHECK (min_threshold >= 0)
    "food_items_price_non_negative" CHECK (price >= 0::numeric)
Referenced by:
    TABLE "sales" CONSTRAINT "sales_item_id_food_items_id_fk" FOREIGN KEY (item_id) REFERENCES food_items(id) ON DELETE SET NULL
    TABLE "stock_records" CONSTRAINT "stock_records_item_id_food_items_id_fk" FOREIGN KEY (item_id) REFERENCES food_items(id) ON DELETE SET NULL
Triggers:
    food_items_set_updated_at BEFORE UPDATE ON food_items FOR EACH ROW EXECUTE FUNCTION set_updated_at()
```

#### sales

```text
                                                           Table "public.sales"
    Column     |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description
---------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id            | uuid                     |           | not null | gen_random_uuid() | plain    |             |              |
 item_id       | uuid                     |           |          |                   | plain    |             |              |
 item_name     | text                     |           | not null |                   | extended |             |              |
 quantity_sold | integer                  |           | not null |                   | plain    |             |              |
 total_price   | numeric(12,2)            |           | not null |                   | main     |             |              |
 user_id       | uuid                     |           |          |                   | plain    |             |              |
 username      | text                     |           | not null |                   | extended |             |              |
 created_at    | timestamp with time zone |           | not null | now()             | plain    |             |              |
Indexes:
    "sales_pkey" PRIMARY KEY, btree (id)
    "sales_created_at_idx" btree (created_at DESC NULLS LAST)
    "sales_item_id_idx" btree (item_id)
    "sales_user_id_idx" btree (user_id)
Check constraints:
    "sales_quantity_sold_positive" CHECK (quantity_sold > 0)
    "sales_total_price_non_negative" CHECK (total_price >= 0::numeric)
Foreign-key constraints:
    "sales_item_id_food_items_id_fk" FOREIGN KEY (item_id) REFERENCES food_items(id) ON DELETE SET NULL
    "sales_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
```

#### stock_records

```text
                                                         Table "public.stock_records"
      Column      |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description
------------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | gen_random_uuid() | plain    |             |              |
 item_id          | uuid                     |           |          |                   | plain    |             |              |
 item_name        | text                     |           | not null |                   | extended |             |              |
 quantity_changed | integer                  |           | not null |                   | plain    |             |              |
 type             | stock_type               |           | not null |                   | plain    |             |              |
 user_id          | uuid                     |           |          |                   | plain    |             |              |
 username         | text                     |           | not null | 'System'::text    | extended |             |              |
 created_at       | timestamp with time zone |           | not null | now()             | plain    |             |              |
Indexes:
    "stock_records_pkey" PRIMARY KEY, btree (id)
    "stock_records_created_at_idx" btree (created_at DESC NULLS LAST)
    "stock_records_item_id_idx" btree (item_id)
    "stock_records_user_id_idx" btree (user_id)
Check constraints:
    "stock_records_quantity_changed_positive" CHECK (quantity_changed > 0)
Foreign-key constraints:
    "stock_records_item_id_food_items_id_fk" FOREIGN KEY (item_id) REFERENCES food_items(id) ON DELETE SET NULL
    "stock_records_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
```

#### sessions

```text
                                                        Table "public.sessions"
   Column   |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description
------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id         | uuid                     |           | not null | gen_random_uuid() | plain    |             |              |
 user_id    | uuid                     |           | not null |                   | plain    |             |              |
 token_hash | text                     |           | not null |                   | extended |             |              |
 expires_at | timestamp with time zone |           | not null |                   | plain    |             |              |
 created_at | timestamp with time zone |           | not null | now()             | plain    |             |              |
Indexes:
    "sessions_pkey" PRIMARY KEY, btree (id)
    "sessions_expires_at_idx" btree (expires_at)
    "sessions_token_hash_unique" UNIQUE CONSTRAINT, btree (token_hash)
    "sessions_user_id_idx" btree (user_id)
Foreign-key constraints:
    "sessions_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

### Trigger query

```text
          tgname
---------------------------
 food_items_set_updated_at
(1 row)
```

### Production migrator proof (clean temp directory, no dev tools)

Exact commands used (the proof database URL was derived silently from `.env`; no secret was printed):

```powershell
npm run build -w @smartcanteen/db

$proof = 'C:\Users\Justine\AppData\Local\Temp\opencode\smartcanteen-migrator-proof'
if (Test-Path -LiteralPath $proof) { Remove-Item -LiteralPath $proof -Recurse -Force }
New-Item -ItemType Directory -Path $proof | Out-Null
Copy-Item -LiteralPath 'db\dist' -Destination (Join-Path $proof 'dist') -Recurse
Copy-Item -LiteralPath 'db\migrations' -Destination (Join-Path $proof 'migrations') -Recurse
Set-Content -LiteralPath (Join-Path $proof 'package.json') -Value '{ "name": "smartcanteen-migrator-proof", "private": true, "type": "module" }'

# In $proof:
npm install --omit=dev --no-audit --no-fund pg@8.23.1 drizzle-orm@0.45.4 dotenv@18.0.8
npm ls --omit=dev --depth=0
Test-Path -LiteralPath 'node_modules\drizzle-kit'
Test-Path -LiteralPath 'node_modules\tsx'

docker exec smartcanteen-db dropdb -U smartcanteen --if-exists smartcanteen_proof_test
docker exec smartcanteen-db createdb -U smartcanteen smartcanteen_proof_test

# Set DATABASE_URL to smartcanteen_proof_test without printing it, then:
node dist/migrate.js
```

Output:

```text
added 16 packages in 28s
smartcanteen-migrator-proof@ C:\Users\Justine\AppData\Local\Temp\opencode\smartcanteen-migrator-proof
├── dotenv@18.0.8
├── drizzle-orm@0.45.4
└── pg@8.23.1

drizzle-kit present: False
tsx present: False

Migrations complete.
```

Proof database verification:

```text
               List of relations
 Schema |     Name      | Type  |    Owner
--------+---------------+-------+--------------
 public | food_items    | table | smartcanteen
 public | sales         | table | smartcanteen
 public | sessions      | table | smartcanteen
 public | stock_records | table | smartcanteen
 public | users         | table | smartcanteen
(5 rows)

 migrations
------------
          3
(1 row)

          tgname
---------------------------
 food_items_set_updated_at
(1 row)
```

### Concurrent migrator test

```text
 ✓ src/__tests__/migrator.test.ts > migration runner > serializes two simultaneous runs without duplicate migrations 385ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

The test resets a dedicated `smartcanteen_migrator_test` database, starts two migration runs with `Promise.all`, and asserts both resolve, the migration row count equals the journal count, and hashes are not duplicated.

### Test database setup

```text
> @smartcanteen/api@0.0.0 db:test:setup
> npm run test:setup -w @smartcanteen/db

> @smartcanteen/db@0.0.0 test:setup
> tsx src/testing/setup-test-db.ts

Test database ready: smartcanteen_test
```

## Test Coverage Added

- Username format check (`23514`) and invalid characters (`23514`).
- Case-insensitive duplicate usernames (`23505`).
- Negative sales totals (`23514`), non-positive sale quantities (`23514`), negative stock (`23514`), non-positive stock record magnitudes (`23514`).
- Session cascade on user deletion, sale snapshot after item deletion, trigger-maintained `updated_at`.
- `citext` comparison and the three FK indexes.
- User seed idempotency, roles, argon2id hashes, password verification, no plaintext, unchanged hashes on rerun, missing/short/placeholder seed password refusals.
- Sample seed idempotency and production refusal.
- Password rotation hash update, session revocation, invalid length, unknown user.
- Non-interactive password input failure without `SET_PASSWORD`.
- Guard rejection for non-`_test` names and `NODE_ENV=production`.
- TLS mode defaults, production `off` rejection, explicit `ssl` options, CA requirement, and `sslmode` stripping.
- Production API env rejection of localhost/placeholder passwords, `DATABASE_SSL=off`, `TRUST_PROXY=false`, invalid time zones; acceptance of a password containing `example`.
- Two concurrent migration runs without duplicate migrations.

## Deviations from `docs/SPEC.md`

None functionally. Implementation details and review-driven additions are documented in `docs/SPEC.md`:

- `users_username_format` and `sales_total_price_non_negative` checks.
- `food_items.updated_at` trigger.
- FK indexes for `sales.item_id`, `sales.user_id`, and `stock_records.user_id`.
- TLS settings and the production refusal of `DATABASE_SSL=off`.

## Unfinished / Notes

- Phase 2 items were recorded in the plan but intentionally not implemented: opportunistic expired-session cleanup, last-ADMIN delete check with a row lock, explicit API pool sizing/timeouts, and precomputed dummy argon2 hash.
- The API has no database pool yet (Phase 2). It validates production TLS settings now; the Phase 2 pool will use the shared `createPool`/`createDb` from `db/src/client.ts`.
- The AWS RDS CA bundle is not shipped in Phase 1; Phase 5/6 will mount it and set `DATABASE_SSL_CA_FILE`.
- The production-migrator proof ran against a fresh database on the local Docker server with TLS `off` (local), proving runtime independence from `drizzle-kit`/`tsx`; RDS TLS verification will be exercised in deployment.
- `npm audit --omit=dev` reports 0 production vulnerabilities. `npm install` reports 4 moderate dev-only advisories; no forced audit fix was applied.
- No `SESSION_SECRET` remains in `.env.example` or README.
