# SmartCanteen Web

Responsive web port of the SmartCanteen Android app: canteen inventory and point-of-sale.
The Android app is the functional source of truth; parity details live in [docs/SPEC.md](docs/SPEC.md).

## Stack

- **Web:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Recharts
- **API:** Node 24 LTS, TypeScript, Fastify, Zod, Drizzle ORM
- **DB:** PostgreSQL 16 (Docker locally, Amazon RDS in production)
- **Infra:** AWS CDK (added in Phase 6)
- **Auth:** argon2id + DB-backed sessions in an httpOnly cookie

This repository is built in phases; see [PHASES.md](PHASES.md) and [AGENTS.md](AGENTS.md).

## Prerequisites

- Node.js 24 LTS (Node `>=22.12` is required by the toolchain)
- npm 11+
- Docker Desktop (for local PostgreSQL)

## Setup

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

- Replace `POSTGRES_PASSWORD` and the password in `DATABASE_URL` with the same local value.
- Set `SEED_ADMIN_PASSWORD` and `SEED_STAFF_PASSWORD` to local-only values of 8-128 characters. They are only used by the seed script.
- Leave `POSTGRES_PORT=5432` unless that port is already in use.
- Leave `DATABASE_SSL=off` locally. Production uses `verify` with `DATABASE_SSL_CA_FILE` pointing at the bundled AWS RDS CA file.

Install dependencies and start PostgreSQL:

```powershell
npm install
docker compose up -d db
```

Check the database and its extensions:

```powershell
docker compose ps
docker compose exec db psql -U smartcanteen -d smartcanteen -c "\dx"
```

Only `citext` is required. `gen_random_uuid()` is built into PostgreSQL 13+, so `pgcrypto` is not installed.

## Development

```powershell
npm run dev -w api    # Fastify on http://localhost:3000
npm run dev -w web    # Vite on http://localhost:5173 (proxies /api to the API)
```

Open `http://localhost:5173`. The API health check is `http://localhost:3000/api/health`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev -w api` | Run the API with watch mode |
| `npm run dev -w web` | Run the web app |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run test` | Tests across workspaces |
| `npm run check` | Typecheck, lint, format check, tests, and build |
| `npm run db:up` / `npm run db:down` | Start/stop local PostgreSQL |
| `npm run db:migrate -w api` | Run migrations |
| `npm run db:seed -w api` | Seed the `admin` and `staff` accounts |
| `npm run db:seed:sample -w api` | Seed local-only sample menu items |
| `npm run db:test:setup -w api` | Create and migrate the local test database |
| `npm run user:set-password -w api` | Rotate a user's password from env or prompt |

## Database

Migrations are forward-only and stored in `db/migrations`. Local development runs them with
`tsx`; production runs the compiled `node db/dist/migrate.js` against RDS. The runner takes a
PostgreSQL advisory lock, so two deploys cannot apply the same migration twice.

```powershell
npm run db:migrate -w api
npm run db:seed -w api
npm run db:seed:sample -w api
```

The seed is idempotent and never overwrites an existing user's password. Password rotation
(`npm run user:set-password -w api`) reads `SET_PASSWORD` or hidden prompt input and also deletes
all of that user's sessions.

Database connections build the TLS option explicitly: `DATABASE_SSL=off` (local default),
`require` (encrypted, no certificate verification), or `verify` (certificate and hostname
verification using `DATABASE_SSL_CA_FILE`). Production defaults to `verify` and refuses to start
with `off`. `sslmode` in the URL is ignored.

Tests use a separate database derived from `DATABASE_URL` with a `_test` suffix, or
`TEST_DATABASE_URL`. The test helper refuses any database whose name does not end in `_test` and
refuses to run when `NODE_ENV=production`.

## Layout

```
db/     Drizzle schema, migrations, seed scripts
api/    Fastify REST API
web/    React SPA
infra/  AWS CDK (Phase 6)
docs/   Spec and phase review records
```

## Security notes

- Never commit `.env` files or AWS credentials; only `.env.example` is tracked.
- Passwords are hashed with argon2id and are never returned by an endpoint or logged.
- Role checks are enforced on the server; hiding UI is not authorization.
- Sessions are random opaque tokens; only their SHA-256 hash is stored. Logout and user deletion revoke access.
- Database connections use TLS in production; `DATABASE_SSL=off` is rejected when `NODE_ENV=production`.
- In production the session cookie is `Secure` and uses the `__Host-` prefix. The API must refuse to start if production is configured without it.
- `TRUST_PROXY` defaults to `false`; set it to a comma-separated list of ALB/CloudFront CIDRs, or `true` only when the ALB is the sole ingress.
- All money is `numeric(12,2)` in PostgreSQL and handled as decimal strings or integer minor units in code.
