# Phase 0 — Bootstrap Report

Status: complete except Docker-dependent checks (Docker Desktop is not installed on this machine).
Date: 2026-10-20.

## What was built

- Moved `AGENTS.md`, `PHASES.md`, and `docs/SPEC.md` to the repo root and deleted `opencode-handoff/`.
- Added the REVIEW LOOP section to `AGENTS.md`.
- Updated `AGENTS.md` to Node 24 LTS, citext-only PostgreSQL, DB-backed sessions, the centralized permissions map, and the `user:set-password` command.
- Updated `docs/SPEC.md`: `sessions` table, `numeric(12,2)` price, `/api/health`, positive `stock_records.quantity_changed`, edit-item parity note, last-ADMIN protection, rate-limit details, 7-day/zero-bar clarifications, and username/password policy.
- Created the npm-workspaces monorepo with exact pinned versions and a `package-lock.json` that is present and not gitignored.
- Created shared TypeScript, ESLint 10 flat config, Prettier, EditorConfig, `.nvmrc` (24), `.gitignore`, and `.env.example`.
- Created `docker-compose.yml` for PostgreSQL 16 with a configurable `POSTGRES_PORT` (default 5432), healthcheck, named volume, and `db/init/00-extensions.sql` that creates `citext` only.
- Created the `@smartcanteen/db` workspace with a Drizzle config, empty schema entry point, and migrations folder. Migration 0000 and the schema arrive in Phase 1.
- Created the `@smartcanteen/api` workspace with Zod-validated env loading, Fastify with helmet/cookie, configurable `trustProxy`, graceful shutdown, and `GET /api/health`.
- Created the `@smartcanteen/web` workspace with React 18, Vite 8, Tailwind 4, a placeholder shell, and a `/api` dev proxy to port 3000.
- Created the `@smartcanteen/infra` workspace with only `package.json`, `tsconfig.json`, and a README placeholder. No CDK dependencies or stacks yet.
- Wrote `README.md` with setup, commands, layout, and security notes.
- Saved `docs/reviews/phase-0-plan.md` with the required feedback responses.

## Installed package versions

All versions match the approved plan. `npm ls --depth=0` reported no invalid or unmet peers.

- Root: typescript 6.0.3, eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0, eslint-plugin-react-hooks 7.1.1, eslint-plugin-react-refresh 0.5.7, eslint-config-prettier 10.1.8, prettier 3.9.10, globals 17.13.0, @types/node 24.19.2.
- Web: react 18.3.1, react-dom 18.3.1, react-is 18.3.1, react-router-dom 7.18.4, @tanstack/react-query 5.104.5, recharts 3.10.1, vite 8.3.4, @vitejs/plugin-react 6.1.2, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, @types/react 18.3.31, @types/react-dom 18.3.7.
- API: fastify 5.12.7, @fastify/cookie 11.1.3, @fastify/helmet 13.2.0, @fastify/rate-limit 11.2.1, zod 4.6.7, drizzle-orm 0.45.4, pg 8.23.1, @node-rs/argon2 2.2.2, dotenv 18.0.8, tsx 4.23.15, vitest 5.0.5, pino-pretty 13.2.0.
- DB: drizzle-orm 0.45.4, drizzle-kit 0.31.11, pg 8.23.1, dotenv 18.0.8, tsx 4.23.15.
- Infra: no dependencies (intentional until Phase 6).

## Commands run and results

| Command | Result |
|---|---|
| `npm install --no-audit --no-fund` | Exit 0; 350 packages added in ~3 min. Two deprecation warnings from `@esbuild-kit/esm-loader` and `@esbuild-kit/core-utils` (transitive, not directly used). |
| `npm run typecheck` | Exit 0 for db, api, and web. |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0. API and DB emitted to `dist/`; web built `dist/index.html`, a 7.19 kB CSS file, and a 140.99 kB JS file. |
| `npm run test` | Exit 0; Vitest ran with no test files (`passWithNoTests`). |
| `npm run format:check` | Initially flagged 7 files; added `*.md` to `.prettierignore` and formatted `docker-compose.yml` and `web/src/index.css`. Now exit 0. |
| Fastify inject smoke test | `GET /api/health` returned HTTP 200 with `{"status":"ok"}`. |
| `npm ls --depth=0` | No invalid or unmet peer dependencies. |

## Test output

```
RUN  v5.0.5 C:/Users/Justine/Desktop/ITP16 Finals/smartcanteen-web/api
No test files found, exiting with code 0
```

Tests begin in Phase 2.

## Docker-dependent checks — NOT VERIFIED

`docker` is not installed or not on PATH (`DOCKER_NOT_FOUND`). Nothing was installed for Docker. The following were **not** run:

- `docker compose config`
- `docker compose up -d db`
- `docker compose ps`
- `\dx` extension verification
- `npm run db:migrate -w api` (also needs the Phase 1 migration and schema)

Commands to run after installing Docker Desktop:

```powershell
Copy-Item .env.example .env
# Edit .env: set POSTGRES_PASSWORD, the same password in DATABASE_URL,
# SESSION_SECRET, and optionally POSTGRES_PORT.
docker compose config
docker compose up -d db
docker compose ps
docker compose exec db psql -U smartcanteen -d smartcanteen -c "\dx"
docker compose exec db psql -U smartcanteen -d smartcanteen -c "SELECT extname FROM pg_extension ORDER BY extname;"
```

Expected: the database is healthy, `citext` is present, and `pgcrypto` is absent. The init SQL runs only when the volume is first created; if the volume already exists, run `docker compose down -v` and bring it up again.

## Deviations from docs/SPEC.md

None in Phase 0. No product behavior was implemented. The approved schema/API clarifications were applied to `docs/SPEC.md` and `AGENTS.md`.

## Unfinished items / next phase

- Phase 1: Drizzle schema, migration 0000 (create `citext`), `sessions` table, seed users from env, sample menu seed, and the `user:set-password` ops script (scheduled for Phase 1/2).
- Phase 2: auth, session cookies, permissions map, API endpoints, atomic sale/restock, tests, and `_test` database guard.
- Phase 3: real web UI and Playwright smoke tests.
- Phase 4: SSE and CSV export.
- Phase 5: production Dockerfiles and single-origin local stack.
- Phase 6: CDK dependencies and stacks.
- `db:seed` and `user:set-password` are documented but not yet implemented; they are Phase 1/2 deliverables.
- No git commit was made; the working tree contains the new files and `package-lock.json`.

## Notes

- `TRUST_PROXY` defaults to `false`. It accepts `true` or a comma-separated list of trusted proxy addresses/CIDRs. Production should prefer the trusted CIDR list; `true` is appropriate only when the ALB is the sole ingress.
- `db/drizzle.config.ts` is linted but not included in the `db` TypeScript build; drizzle-kit executes it in Phase 1.
- The `db/init` script creates `citext` for local Docker. Phase 1 migration 0000 will create it for RDS as well.
- The web placeholder uses Tailwind 4's CSS-first setup (`@import "tailwindcss";`); no PostCSS or `tailwind.config` file is needed.
