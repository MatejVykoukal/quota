# Quota

An API usage control plane — meter who consumes your APIs, enforce rate
limits and quotas live at the gateway, and observe it all in one dashboard.

Quota is a full-stack demo: a single Next.js app acting both as the
management UI and as a gateway-style enforcement endpoint backed by Postgres.

## Features

- **Live enforcement** — every gateway request is checked against all of the
  project's meters atomically; over the limit means `429`, and rejected
  requests consume no quota
- **Two limit scopes** — *rate* meters throttle each API key individually
  (fair throttling), *quota* meters cap all keys of a project combined
  (shared budget)
- **Flexible windows** — fixed-slot rate windows (e.g. 60/min) and calendar
  quotas (per day / month, UTC)
- **API key lifecycle** — create (plaintext shown exactly once), temporarily
  disable, permanently revoke; only SHA-256 hashes are stored
- **Dashboard** — projects overview with usage stats, per-meter usage bars
  (segmented per key on project-scope meters), and a request log with
  infinite scroll
- **Login** — session cookie with HMAC signature, scrypt-hashed demo
  password, DB-backed login rate limiting

## Architecture

```
client → Caddy proxy (:8080) → Next.js app (UI + gateway) → Postgres
```

- **Caddy** — trusted reverse proxy, sole entry point; owns
  `X-Forwarded-For` (the app never trusts client-supplied proxy headers)
- **app** — Next.js App Router; dashboard server components read directly
  from the DB, mutations run as server actions, gateway enforcement lives at
  `/api/gateway/*`
- **db** — Postgres 17, internal network only

### Request flow through the gateway

```
POST /api/gateway/*  (Authorization: Bearer qk_live_…)
  → key lookup by SHA-256 hash          401 if unknown / revoked / disabled
  → for each project meter:
      INSERT … ON CONFLICT … DO UPDATE count = count + 1
        WHERE count + 1 <= limit        ← atomic, no overshoot under load
  → all meters pass  → 200, counters incremented, request logged
  → any meter over    → 429 with per-meter detail, increments rolled back
```

## Design decisions

- **Per-key vs. per-project limits** — both matter for different reasons:
  per-key protects against one abusive consumer, per-project caps the total
  budget regardless of key count. Meters carry a `scope` column; usage rows
  generalize via `coalesce(api_key_id, project_id)`.
- **Atomic upsert with expression index** — the uniqueness of
  `(meter, window, scope)` is enforced by a unique index on
  `coalesce(api_key_id, project_id)`, and enforcement is a single
  conditional `INSERT … ON CONFLICT DO UPDATE` per meter. Concurrent
  requests cannot overshoot a limit; a DB round-trip per meter replaces any
  distributed lock.
- **Revoke vs. disable** — revoke is a permanent soft-delete (one-way),
  disable is a reversible pause (incidents, unpaid invoices). Same effect at
  the gateway, different lifecycle.
- **Rejected requests consume nothing** — a `429` rolls back any counter
  increments made by earlier meters in the same check.
- **One-time key reveal** — the plaintext key exists only in the server
  action's return value and the client's memory; the DB holds only its hash.
- **Cursor pagination** — the request log pages via
  `createdAt < cursor`, which stays correct as new requests stream in.
- **Live data, explicitly** — dashboard routes are `force-dynamic`; a cached
  usage number in a control plane would be a lie.

## Getting Started

### Full stack in Docker (recommended)

```bash
cp .env.example .env   # set POSTGRES_PASSWORD and AUTH_SECRET
docker compose up --build
```

Migrations run automatically on app start. Open `http://localhost:8080`,
sign in with `demo@quota.dev` / `demo1234`, and create a project (or run
`cd app && npm run seed` for pre-filled demo data — the seed prints an API
key once).

> Note: `POSTGRES_PASSWORD` is applied only when the data volume is created
> for the first time. To change it later, run `docker compose down -v` and
> start again (wipes local data).

### Development mode

```bash
cp .env.example .env               # Postgres only
docker compose up -d db
cd app
cp .env.example .env               # DATABASE_URL + AUTH_SECRET
npm install
npm run db:migrate                 # or: docker compose exec db pg_dump …
npm run dev                        # http://localhost:3000
```

### Try the gateway

```bash
curl -X POST http://localhost:8080/api/gateway/hello \
  -H "Authorization: Bearer qk_live_…"

# {"ok":true,"results":[
#   {"meterName":"Rate limit (60/min per key)","limit":60,"used":1},
#   {"meterName":"Daily quota (20/day per project)","limit":20,"used":1}]}
```

Any path works (`/api/gateway/*` is a catch-all echo). Over a limit →
`429 rate_limit_exceeded` with per-meter detail. No/invalid key → `401`.

## Tech stack

- **Next.js 16** (App Router, server components, server actions, TypeScript)
- **Postgres 17** + **Drizzle ORM** (typed schema, versioned SQL migrations)
- **Tailwind CSS 4** (token-based light/dark theming)
- **Caddy** (reverse proxy) and **Docker Compose** (one-command deploy)

## Repository layout

```
app/src/db/          schema, migrations, connection
app/src/lib/         auth, env validation, enforcement core, rate limiting
app/src/app/api/     gateway (enforcement), auth, dashboard pagination
app/src/app/(ui)/    landing, login, dashboard (projects, meters, keys, log)
scripts/seed.ts      demo project + key + meters
Dockerfile / docker-compose.yml / Caddyfile
```

## Deployment

The repo deploys as a single container (see `app/Dockerfile`) — migrations
run on start. On [Railway](https://railway.app): create a project from this
repo, add a Postgres instance, and set `DATABASE_URL` and `AUTH_SECRET` for
the app service. The Dockerfile is detected automatically.
