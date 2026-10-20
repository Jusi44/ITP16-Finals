# SmartCanteen Web — Agent Instructions

Canteen inventory + point-of-sale system. We are porting an existing **native Android app
(Kotlin / Jetpack Compose / Firebase Firestore)** to a **responsive web app on AWS with PostgreSQL**.
The Android app is the functional source of truth. Full parity spec: @docs/SPEC.md

## Working agreement (read first)
1. Work in **phases** defined in @PHASES.md. Do ONE phase at a time.
2. At the start of each phase: stay in **Plan** mode, restate the phase goal, list files you will
   create/change, and wait for my approval before switching to Build.
3. At the end of each phase: run the verification commands below, summarize what changed, list
   anything deviating from @docs/SPEC.md, then STOP. Do not start the next phase.
4. Never invent features. If the spec is silent or ambiguous, ask.
5. Never commit secrets, `.env` files, or AWS credentials. No hardcoded default passwords in code
   paths that run in production (seed via a one-off script that reads credentials from env).

## Review loop
An external reviewer (Claude) reviews every phase; the human relays messages.
1. When planning a phase, write `docs/reviews/phase-N-plan.md` (the only file written before
   approval) with: Goal, Files to create/change, Key decisions and rejected alternatives,
   Deviations from `docs/SPEC.md` (or "none"), Open questions, Risks. Then STOP and say:
   "Plan saved. Send it to the reviewer."
2. On a "FEEDBACK FOR OPENCODE" message, treat every item marked `[Must fix]` as required.
   Update the plan file, add a section "How I addressed the feedback" listing each item and
   what changed, then STOP until the human says "APPROVED".
3. After "APPROVED": implement the phase, run the verification commands, and write
   `docs/reviews/phase-N-report.md` with what was built, commands run and results, test output,
   deviations from the spec, and unfinished items. Then STOP and say:
   "Report saved. Send it to the reviewer."
4. Never start the next phase until the human tells you to.

## Stack (decided unless I say otherwise)
- Monorepo (npm workspaces): `/web`, `/api`, `/infra`, `/db`
- **Web:** React 18 + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router, Recharts or hand-rolled SVG bars
- **API:** Node 24 LTS + TypeScript + Fastify, Zod validation, Drizzle ORM (or Prisma) + SQL migrations
- **DB:** PostgreSQL 16 (Amazon RDS in prod, docker-compose locally). Only the `citext` extension is required; `gen_random_uuid()` is built in (Postgres 13+), so no `pgcrypto`.
- **Auth:** username + password, argon2id (or bcrypt cost>=12), DB-backed sessions (random opaque token; only its SHA-256 hash stored), 8-hour expiry, httpOnly+SameSite=Lax cookie, Secure and `__Host-` prefix in production
- **Infra:** AWS CDK (TypeScript). S3 + CloudFront (SPA), ECS Fargate behind ALB (API), RDS Postgres, Secrets Manager, ACM, Route 53
- **CI/CD:** GitHub Actions -> ECR -> ECS; web build -> S3 + CloudFront invalidation
- Single public origin: CloudFront serves `/` from S3 and routes `/api/*` to the ALB (no CORS needed)

## Commands (keep this section accurate as the repo grows)
- `docker compose up -d db` — local Postgres
- `npm run dev -w api` / `npm run dev -w web`
- `npm run test -w api`, `npm run test -w @smartcanteen/db`, `npm run lint`, `npm run typecheck`, `npm run build`
- `npm run check` — end-of-phase gate: typecheck, lint, format check, tests, build
- `npm run db:migrate -w api`, `npm run db:seed -w api`, `npm run db:seed:sample -w api`
- `npm run db:test:setup -w api` — create/migrate the `_test` database
- `npm run user:set-password -w api` — rotate a user's password from env or prompt
- `node db/dist/migrate.js` — production migration runner (no dev tools required)
- `npx cdk diff` / `npx cdk deploy` (inside `/infra`) — NEVER deploy without my explicit go-ahead

## Non-negotiable rules
- All money is `numeric(12,2)` in DB and handled as integer minor units or decimal strings in code — never JS floats for totals. Currency symbol is **₱**.
- **Sales must be atomic and race-safe:** decrement stock with a conditional UPDATE inside one
  transaction that also inserts the `sales` row and the `stock_records` row. Price comes from the DB, never the client.
- Role checks are enforced on the **server**. The UI hiding a tab is not authorization. Role rules live in one policy map (`api/src/auth/permissions.ts`).
- Passwords are never returned by any endpoint and never logged.
- Timestamps stored as `timestamptz` (UTC). Day bucketing uses `APP_TIMEZONE` (default `Asia/Manila`).
- Production database connections must use TLS (`DATABASE_SSL=verify` by default); production startup
  fails when `DATABASE_SSL=off`. Never rely on `sslmode` in the URL.
- Tests may only connect to a database whose name ends in `_test`; never run test helpers against dev or production.
- Every endpoint validates input with Zod and returns consistent `{ error: { code, message } }` on failure.
- Write tests for: login, role guard, sale atomicity (concurrent sales cannot oversell), restock, report ranges.
