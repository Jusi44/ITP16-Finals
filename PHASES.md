# Phase prompts for opencode

How to use: put `AGENTS.md`, `PHASES.md` and `docs/SPEC.md` in the repo root. Start opencode there, stay in
**Plan** mode (Tab toggles Plan/Build), paste ONE phase prompt, review the plan, then switch to Build.
Each phase ends with a STOP. Do not paste the next prompt until you have reviewed the result.

---
## Phase 0 — Bootstrap
```
Read AGENTS.md and docs/SPEC.md fully. Do not write code yet.
1. Summarize your understanding of the app and list any ambiguities or conflicts you see in the spec.
2. Propose the final monorepo layout and package versions.
3. Create the monorepo skeleton: npm workspaces, TypeScript configs, ESLint/Prettier, docker-compose.yml
   (Postgres 16 + citext/pgcrypto), .env.example, .gitignore, README with setup steps.
Stop after the skeleton builds and `npm run typecheck` passes.
```
## Phase 1 — Database
```
Implement the schema in docs/SPEC.md section 2 as migrations (ORM of your choice from AGENTS.md).
Add a seed script that creates the admin and staff users from SEED_ADMIN_PASSWORD / SEED_STAFF_PASSWORD env
vars (hashed) and refuses to run in production without them. Add a script that loads a few sample menu items
for local dev only. Verify migrate + seed against the docker Postgres. Stop.
```
## Phase 2 — API
```
Implement the REST API in docs/SPEC.md section 5 with Zod validation, session auth, role guards,
login rate limiting, and the atomic sale/restock transactions. Add the /dashboard aggregation (7-day series,
top 3, low stock) computed in SQL using APP_TIMEZONE. Write integration tests (including a concurrent-sale
test proving stock can never go negative). Stop when `npm run test -w api` is green.
```
## Phase 3 — Web UI parity
```
Build the React app to match docs/SPEC.md section 1 and 3 screen by screen: Login, Dashboard, Inventory (with
Add/Edit/Restock/Delete dialogs), Orders (POS) with SUCCESS overlay, Reports, Stock History, Personnel (ADMIN
only). Same orange identity, responsive: sidebar on desktop, bottom nav on mobile. Use TanStack Query against
the real API. Include toasts, empty states, loading and error states. Add Playwright smoke tests for
login -> sell -> see stock drop -> see it in Reports and Audit Trail. Stop.
```
## Phase 4 — Real-time, export, polish
```
Add the SSE /events channel and have the web app invalidate queries on events (fall back to 5 s polling).
Add CSV export and the Share-report button (Web Share API + clipboard fallback). Accessibility pass
(labels, focus, contrast) and a basic PWA manifest. Stop.
```
## Phase 5 — Containerize
```
Write production Dockerfiles for api (multi-stage, non-root, healthcheck on /api/health) and a static build
for web. Provide docker-compose.prod-like.yml that runs everything locally behind one origin (nginx or caddy
emulating CloudFront routing: / -> web, /api -> api). Verify end to end. Stop.
```
## Phase 6 — AWS infrastructure (CDK)
```
In /infra, write AWS CDK (TypeScript) stacks: Network (VPC, 2 AZs, private subnets for DB), Data (RDS Postgres
16, Multi-AZ off by default behind a prop, encrypted, automated backups 7+ days, credentials in Secrets
Manager), Api (ECR, ECS Fargate service, ALB, autoscaling 1-3 tasks, task role with least privilege, secrets
injected as env), Web (private S3 bucket + CloudFront with OAC, behavior /api/* -> ALB, SPA fallback to
index.html, security headers), DNS (Route 53 + ACM, optional via context). Region and domain are CDK context
values. Run `cdk synth` and `cdk diff` only. DO NOT deploy. Output an estimated monthly cost table and a
deploy runbook. Stop.
```
## Phase 7 — CI/CD
```
Add GitHub Actions: on PR run lint/typecheck/tests; on main build+push the API image to ECR, run DB migrations
as a one-off ECS task, update the service, build web and sync to S3, invalidate CloudFront. Use GitHub OIDC
to assume an AWS role (no long-lived keys). Document the required repo variables. Stop.
```
## Phase 8 — Deploy to AWS (only when I say "deploy")
```
Walk me through first deployment step by step: bootstrap CDK, deploy stacks in order, run migrations, run the
production seed with passwords I provide via env, smoke test the public URL, and show me how to rotate the
admin password. Confirm each command with me before running it.
```
## Phase 9 — Optional: migrate existing Firestore data
```
Write a one-off Node script that reads a Firestore export (JSON) of food_items, sales, stock_records, users and
loads it into Postgres, preserving timestamps and mapping Firestore document ids to new UUIDs. Users' plaintext
passwords must be hashed during import and the original export deleted afterwards. Dry-run mode first.
```
## Phase 10 — Hardening
```
Add structured logging, CloudWatch alarms (5xx, DB CPU/storage, ECS task count), AWS WAF rate limiting on
/api/auth/login, RDS backup restore test notes, dependency audit, and a short SECURITY.md. Stop.
```
